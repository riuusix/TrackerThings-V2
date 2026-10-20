import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  validateAvatarFile,
  generateAvatarStoragePath,
  validateAvatarPathOwnership,
  sanitizeAvatarPublicUrl,
  MAX_AVATAR_FILE_SIZE,
  AVATAR_BUCKET_NAME,
  SUPPORTED_AVATAR_TYPES,
} from "../lib/avatarStorage.ts";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

// Sample valid buffers for magic-byte verification
const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const validWebp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const invalidFakeImage = Buffer.from("THIS_IS_NOT_AN_IMAGE_FILE_CONTENT");

describe("Avatar Upload & Storage Integration Tests", () => {
  // =========================================================================
  // 1. Static Contract & Schema Verification
  // =========================================================================
  it("verifies public.users schema uses profile_picture_url mapped to profilePictureUrl", () => {
    const prismaSchema = readRepoFile("prisma/schema.prisma");
    assert.match(prismaSchema, /profilePictureUrl\s+String\?\s+@map\("profile_picture_url"\)/);
    assert.doesNotMatch(prismaSchema, /photoProfileUrl/);
    assert.doesNotMatch(prismaSchema, /photo_profile_url/);
  });

  it("checks avatar upload route exists with magic-byte validation, session auth, and 2MB limit", () => {
    const avatarRoute = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(avatarRoute, /export async function POST/);
    assert.match(avatarRoute, /export async function DELETE/);
    assert.match(avatarRoute, /getAuthSession\(req\)/);
    assert.match(avatarRoute, /validateAvatarFile/);
    assert.match(avatarRoute, /generateAvatarStoragePath/);
    assert.match(avatarRoute, /validateAvatarPathOwnership/);
  });

  it("verifies Swift client services implement multipart upload and local cache update", () => {
    const networkService = readRepoFile("Sources/TrackerThings/Services/NetworkService.swift");
    const authService = readRepoFile("Sources/TrackerThings/Services/AuthService.swift");
    const settingsVM = readRepoFile("Sources/TrackerThings/ViewModels/SettingsViewModel.swift");
    const editProfileView = readRepoFile("Sources/TrackerThings/Views/Settings/EditProfileView.swift");
    const userAvatarView = readRepoFile("Sources/TrackerThings/Views/Components/UserAvatarView.swift");

    assert.match(networkService, /func uploadMultipart<T:\s*Decodable\s*&\s*Sendable>/);
    assert.match(networkService, /multipart\/form-data;\s*boundary=/);
    assert.match(authService, /func uploadAvatar\(data:\s*Data/);
    assert.match(authService, /LocalCacheService\.shared\.save\(updatedUser,\s*forKey:\s*LocalCacheService\.keyUserProfile\)/);
    assert.match(settingsVM, /public var isUploadingAvatar:\s*Bool/);
    assert.match(settingsVM, /public func uploadAvatar\(data:\s*Data/);
    assert.match(editProfileView, /import PhotosUI/);
    assert.match(editProfileView, /PhotosPicker\(/);
    assert.match(userAvatarView, /AppTheme\.Colors\.accent/);
  });

  it("verifies Web ProfileClient supports direct file upload and delete via /api/user/avatar", () => {
    const profileClient = readRepoFile("app/profile/ProfileClient.tsx");
    assert.match(profileClient, /handlePhotoUpload/);
    assert.match(profileClient, /fetch\("\/api\/user\/avatar"/);
    assert.match(profileClient, /method:\s*"DELETE"/);
    assert.match(profileClient, /accept="image\/jpeg,image\/png,image\/webp"/);
  });

  // =========================================================================
  // 2. File Signature & Size Validation Tests (validateAvatarFile)
  // =========================================================================
  it("rejects empty files with descriptive error", () => {
    const emptyBuf = Buffer.alloc(0);
    const result1 = validateAvatarFile(emptyBuf, 0);
    assert.equal(result1.valid, false);
    assert.match(result1.error, /tidak boleh kosong/i);

    const result2 = validateAvatarFile(validJpeg, 0);
    assert.equal(result2.valid, false);
    assert.match(result2.error, /tidak boleh kosong/i);
  });

  it("rejects files exceeding 2 MB limit", () => {
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_FILE_SIZE + 1);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;
    const result = validateAvatarFile(oversizedBuffer, oversizedBuffer.length);
    assert.equal(result.valid, false);
    assert.match(result.error, /melebihi batas maksimal 2 MB/i);
  });

  it("rejects corrupted files, text files, and fake extensions", () => {
    const result = validateAvatarFile(invalidFakeImage, invalidFakeImage.length);
    assert.equal(result.valid, false);
    assert.match(result.error, /Format gambar tidak didukung/i);
  });

  it("accepts valid JPEG, PNG, and WebP signatures with correct mime and extension", () => {
    const jpegRes = validateAvatarFile(validJpeg, validJpeg.length);
    assert.equal(jpegRes.valid, true);
    assert.equal(jpegRes.ext, "jpg");
    assert.equal(jpegRes.mime, "image/jpeg");

    const pngRes = validateAvatarFile(validPng, validPng.length);
    assert.equal(pngRes.valid, true);
    assert.equal(pngRes.ext, "png");
    assert.equal(pngRes.mime, "image/png");

    const webpRes = validateAvatarFile(validWebp, validWebp.length);
    assert.equal(webpRes.valid, true);
    assert.equal(webpRes.ext, "webp");
    assert.equal(webpRes.mime, "image/webp");
  });

  // =========================================================================
  // 3. Path Generation, Traversal Defense & Ownership Isolation
  // =========================================================================
  it("strictly confines avatar storage paths to users/{userId}/ and prevents traversal", () => {
    const userId = 42;
    const generatedPath = generateAvatarStoragePath(userId, "jpg");

    assert.ok(generatedPath.startsWith("users/42/avatar-"), `Path must start with users/42/avatar- but got ${generatedPath}`);
    assert.ok(generatedPath.endsWith(".jpg"), `Path must end with .jpg but got ${generatedPath}`);
    assert.doesNotMatch(generatedPath, /\.\./, "Generated path must never contain ..");
    assert.doesNotMatch(generatedPath, /[\\/]{2,}/, "Generated path must not contain double slashes");

    // Ownership validation
    assert.equal(validateAvatarPathOwnership(generatedPath, 42), true, "User 42 must own their path");
    assert.equal(validateAvatarPathOwnership(generatedPath, 43), false, "User 43 must NOT own User 42's path");
    assert.equal(validateAvatarPathOwnership("users/42/../43/avatar.jpg", 42), false, "Traversal must be rejected");
    assert.equal(validateAvatarPathOwnership("/users/42/avatar.jpg", 42), false, "Absolute path must be rejected");
    assert.equal(validateAvatarPathOwnership("users/42/avatar.jpg", 42), true, "Standard user path must be accepted");
  });

  it("sanitizes public avatar URLs with cache-busting query parameter", () => {
    const rawUrl = "https://mock.storage.supabase.co/storage/v1/object/public/avatars/users/1/avatar-123.jpg";
    const sanitized = sanitizeAvatarPublicUrl(rawUrl, 1792000000000);
    assert.equal(sanitized, `${rawUrl}?v=1792000000000`);

    const rawUrlWithQuery = `${rawUrl}?existing=1`;
    const sanitizedQuery = sanitizeAvatarPublicUrl(rawUrlWithQuery, 1792000000000);
    assert.equal(sanitizedQuery, `${rawUrlWithQuery}&v=1792000000000`);
  });

  // =========================================================================
  // 4. Server Route Security & Resilience Static Auditing
  // =========================================================================
  it("enforces session authentication and rejects unauthenticated requests (HTTP 401)", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /const session = await getAuthSession\(req\);/);
    assert.match(routeCode, /if \(!session\) \{\s*return apiError\("Sesi login telah berakhir/);
  });

  it("fails closed when server credentials are not configured (HTTP 503)", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /const storageClient = getStorageClient\(\);/);
    assert.match(routeCode, /if \(!storageClient\) \{\s*console\.warn\(\"\[Avatar Storage\]/);
    assert.match(routeCode, /return apiError\(\s*"Layanan penyimpanan profil belum terkonfigurasi/);
    assert.match(routeCode, /503/);
  });

  it("rolls back newly uploaded file if database update fails and preserves previous avatar", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    // Upload happens before DB update
    const uploadIndex = routeCode.indexOf("storageClient.upload(");
    const dbUpdateIndex = routeCode.indexOf("prisma.user.update(");
    const cleanupOldIndex = routeCode.indexOf("storageClient.remove([oldPath])");

    assert.ok(uploadIndex !== -1 && dbUpdateIndex !== -1, "Upload and DB update must be present");
    assert.ok(uploadIndex < dbUpdateIndex, "New file must be uploaded before database is updated");
    assert.ok(dbUpdateIndex < cleanupOldIndex, "Old avatar must NOT be cleaned up until database update succeeds");

    // Atomic rollback on db error
    assert.match(routeCode, /catch \(dbError: any\) \{\s*\/\/ Safe atomic rollback/);
    assert.match(routeCode, /await storageClient\.remove\(\[filePath\]\)/);
  });

  it("handles old avatar cleanup failure gracefully without failing user profile update", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /storageClient\.remove\(\[oldPath\]\)\.catch\(\(\) => \{\s*console\.warn\(\"\[Avatar Storage\] Warning: Cleanup of previous avatar/);
  });

  it("handles avatar deletion idempotently and securely", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /export async function DELETE/);
    assert.match(routeCode, /if \(!currentUser\?\.profilePictureUrl\) \{/);
    assert.match(routeCode, /validateAvatarPathOwnership\(oldPath, session\.userId\)/);
    assert.match(routeCode, /profilePictureUrl:\s*null/);
  });

  // =========================================================================
  // 5. Supabase Storage Migration SQL RLS & Bucket Contract Audit
  // =========================================================================

  /**
   * Helper to strip SQL single-line (-- ...) and block (/* ... *\/) comments.
   */
  function stripSqlComments(sql) {
    return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  }

  /**
   * Balanced parenthesis extractor for specific SQL clauses (e.g. USING (...), WITH CHECK (...)).
   * Handles arbitrary nesting of parentheses without regular expression recursion limitations.
   */
  function extractBalancedClauseContent(text, keyword) {
    const kwRegex = new RegExp(`\\b${keyword}\\s*\\(`, "i");
    const kwMatch = text.match(kwRegex);
    if (!kwMatch || kwMatch.index === undefined) return null;
    const startParen = text.indexOf("(", kwMatch.index);
    let depth = 0;
    for (let i = startParen; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) {
          return text.slice(startParen + 1, i).trim();
        }
      }
    }
    return null;
  }

  /**
   * Strict validator for the SELECT policy USING condition.
   * Strips matched outer parentheses and verifies the condition is strictly and
   * exclusively `bucket_id = 'avatars'`, rejecting any injection or relaxation (e.g. `OR true`, `OR 1=1`).
   */
  function isStrictlyAvatarsBucketCondition(condition) {
    if (!condition) return false;
    let stripped = condition.trim();
    while (stripped.startsWith("(") && stripped.endsWith(")")) {
      let depth = 0;
      let matchedOuter = false;
      for (let i = 0; i < stripped.length; i++) {
        if (stripped[i] === "(") depth++;
        else if (stripped[i] === ")") {
          depth--;
          if (depth === 0) {
            if (i === stripped.length - 1) matchedOuter = true;
            break;
          }
        }
      }
      if (matchedOuter) {
        stripped = stripped.slice(1, -1).trim();
      } else {
        break;
      }
    }
    return /^\s*bucket_id\s*=\s*'avatars'\s*$/i.test(stripped);
  }

  /**
   * Domain-specific policy extractor for storage.objects policies in migration SQL.
   * Note: This is an explicit, hardened auditor tailored to migration 20261020_harden_avatar_storage_rls.sql,
   * not a general-purpose SQL grammar parser.
   * Accurately models PostgreSQL RLS semantics:
   * - If FOR is omitted, PostgreSQL defaults to FOR ALL
   * - If TO is omitted, PostgreSQL defaults to TO PUBLIC
   * - Detects and parses both USING and WITH CHECK clauses with balanced parenthesis traversal
   */
  function extractStorageObjectsPolicies(cleanSql) {
    const policyRegex = /CREATE\s+POLICY\s+([\s\S]*?)\s+ON\s+storage\.objects\s+([\s\S]*?);/gi;
    const policies = [];
    let match;

    while ((match = policyRegex.exec(cleanSql)) !== null) {
      const rawName = match[1].trim().replace(/^["']|["']$/g, "");
      const body = match[2].trim();

      // Extract command: FOR ALL | SELECT | INSERT | UPDATE | DELETE (default is ALL)
      const forMatch = body.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
      const command = forMatch ? forMatch[1].toUpperCase() : "ALL";

      // Extract roles: TO role1, role2 (default is public)
      const toMatch = body.match(/\bTO\s+([a-zA-Z0-9_,\s"']+?)(?=\s+(?:USING|WITH\s+CHECK|$))/i);
      const roles = toMatch
        ? toMatch[1].split(",").map((r) => r.trim().replace(/^["']|["']$/g, "").toLowerCase()).filter(Boolean)
        : ["public"];

      const isPublic = roles.some((r) => r === "public" || r === "anon");

      // Extract balanced USING and WITH CHECK clauses
      const usingClause = extractBalancedClauseContent(body, "USING");
      const withCheckClause = extractBalancedClauseContent(body, "WITH\\s+CHECK");

      policies.push({
        name: rawName,
        command,
        roles,
        isPublic,
        using: usingClause,
        withCheck: withCheckClause,
      });
    }

    return policies;
  }

  /**
   * Core auditor for storage.objects RLS policies.
   */
  function auditStorageObjectsPolicies(cleanSql) {
    // 1. Verify required insecure policy drops
    const requiredDrops = [
      "Public Insert for Avatars",
      "Public Update for Avatars",
      "Public Delete for Avatars",
      "Allow public uploads for avatars",
      "Allow public updates for avatars",
      "Allow public deletes for avatars",
    ];
    for (const policyName of requiredDrops) {
      const dropRegex = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${policyName}"\\s+ON\\s+storage\\.objects;`, "i");
      if (!dropRegex.test(cleanSql)) {
        throw new Error(`Migration must drop insecure policy: "${policyName}"`);
      }
    }

    // 2. Extract and inspect all created policies on storage.objects
    const policies = extractStorageObjectsPolicies(cleanSql);

    // Exactly 1 policy must be created on storage.objects in this migration
    if (policies.length !== 1) {
      throw new Error(`Migration must define exactly 1 policy on storage.objects, found ${policies.length}`);
    }

    // Reject any public write/mutation policy (INSERT, UPDATE, DELETE, ALL, or WITH CHECK)
    const publicMutations = policies.filter(
      (p) => p.isPublic && (["INSERT", "UPDATE", "DELETE", "ALL"].includes(p.command) || p.withCheck !== null)
    );
    if (publicMutations.length > 0) {
      throw new Error(`Insecure public write policy found on storage.objects: ${JSON.stringify(publicMutations)}`);
    }

    // Ensure public SELECT policy exists and is strictly restricted to bucket_id = 'avatars'
    const publicSelects = policies.filter((p) => p.isPublic && p.command === "SELECT");
    if (publicSelects.length !== 1) {
      throw new Error(`Expected exactly 1 public SELECT policy on storage.objects, found ${publicSelects.length}`);
    }

    const selectPolicy = publicSelects[0];
    if (selectPolicy.name !== "Public Access for Avatars") {
      throw new Error(`Unexpected public SELECT policy name: "${selectPolicy.name}"`);
    }

    if (!isStrictlyAvatarsBucketCondition(selectPolicy.using)) {
      throw new Error(`Public SELECT policy USING clause must strictly and exclusively be (bucket_id = 'avatars'), got: "${selectPolicy.using}"`);
    }

    return { valid: true, policiesCount: policies.length };
  }

  /**
   * Core auditor for avatars bucket constraints in storage.buckets.
   * Verifies both INSERT and ON CONFLICT clauses with column-order independence.
   */
  function auditAvatarsBucketConstraints(cleanSql) {
    const expectedMimes = ["image/jpeg", "image/png", "image/webp"].sort();

    // 1. Locate and parse INSERT INTO storage.buckets (<columns>) VALUES (<values>)
    const insertMatch = cleanSql.match(/INSERT\s+INTO\s+storage\.buckets\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)(?:\)\s*(?:ON\s+CONFLICT|;|$))/i);
    if (!insertMatch) {
      throw new Error("Migration must include an INSERT INTO storage.buckets statement specifying columns and VALUES");
    }

    const columns = insertMatch[1].split(",").map((c) => c.trim().toLowerCase());
    const rawValuesClause = insertMatch[2].trim();

    // Split values by comma, respecting ARRAY[...] brackets
    const values = [];
    let cur = "";
    let inArray = false;
    for (let i = 0; i < rawValuesClause.length; i++) {
      const ch = rawValuesClause[i];
      if (ch === "[") inArray = true;
      else if (ch === "]") inArray = false;

      if (ch === "," && !inArray) {
        values.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) values.push(cur.trim());

    if (columns.length !== values.length) {
      throw new Error(`Column count (${columns.length}) does not match value count (${values.length}) in storage.buckets INSERT`);
    }

    const row = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i];
    }

    if (!row.id || row.id.replace(/^['"]|['"]$/g, "") !== "avatars") {
      throw new Error(`Bucket id must be 'avatars', got: ${row.id}`);
    }
    if (!row.name || row.name.replace(/^['"]|['"]$/g, "") !== "avatars") {
      throw new Error(`Bucket name must be 'avatars', got: ${row.name}`);
    }
    if (row.public !== "true") {
      throw new Error(`Bucket public flag must be true, got: ${row.public}`);
    }
    if (row.file_size_limit !== "2097152") {
      throw new Error(`Bucket file_size_limit must be 2097152 (2 MB), got: ${row.file_size_limit}`);
    }

    const arrayMatch = (row.allowed_mime_types || "").match(/ARRAY\s*\[([\s\S]*?)\]/i);
    if (!arrayMatch) {
      throw new Error(`INSERT allowed_mime_types must be an ARRAY[...], got: ${row.allowed_mime_types}`);
    }
    const mimes = arrayMatch[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).sort();
    if (JSON.stringify(mimes) !== JSON.stringify(expectedMimes)) {
      throw new Error(`INSERT allowed_mime_types must be exactly ${JSON.stringify(expectedMimes)}, got: ${JSON.stringify(mimes)}`);
    }

    // 2. Locate and parse ON CONFLICT (id) DO UPDATE SET ...
    const conflictMatch = cleanSql.match(/ON\s+CONFLICT\s*\(\s*id\s*\)\s*DO\s+UPDATE\s+SET\s+([\s\S]*?)(?:;|$)/i);
    if (!conflictMatch) {
      throw new Error("Migration must include ON CONFLICT (id) DO UPDATE SET clause for storage.buckets");
    }

    const setClause = conflictMatch[1].trim();
    const setParts = [];
    let partCur = "";
    let setInArray = false;
    for (let i = 0; i < setClause.length; i++) {
      const ch = setClause[i];
      if (ch === "[") setInArray = true;
      else if (ch === "]") setInArray = false;

      if (ch === "," && !setInArray) {
        setParts.push(partCur.trim());
        partCur = "";
      } else {
        partCur += ch;
      }
    }
    if (partCur.trim()) setParts.push(partCur.trim());

    const assignments = {};
    for (const part of setParts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx !== -1) {
        assignments[part.slice(0, eqIdx).trim().toLowerCase()] = part.slice(eqIdx + 1).trim();
      }
    }

    if (assignments.public !== "true") {
      throw new Error(`ON CONFLICT public must be set to true, got: ${assignments.public}`);
    }
    if (assignments.file_size_limit !== "2097152") {
      throw new Error(`ON CONFLICT file_size_limit must be set to 2097152, got: ${assignments.file_size_limit}`);
    }

    const conflictArrayMatch = (assignments.allowed_mime_types || "").match(/ARRAY\s*\[([\s\S]*?)\]/i);
    if (!conflictArrayMatch) {
      throw new Error(`ON CONFLICT allowed_mime_types must be an ARRAY[...], got: ${assignments.allowed_mime_types}`);
    }
    const conflictMimes = conflictArrayMatch[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).sort();
    if (JSON.stringify(conflictMimes) !== JSON.stringify(expectedMimes)) {
      throw new Error(`ON CONFLICT allowed_mime_types must be exactly ${JSON.stringify(expectedMimes)}, got: ${JSON.stringify(conflictMimes)}`);
    }

    return { valid: true };
  }

  it("audits migration SQL: ensures storage.objects denies public write/mutation policies and strictly limits public SELECT to avatars bucket", () => {
    const rawSql = readRepoFile("prisma/migrations/20261020_harden_avatar_storage_rls.sql");
    const cleanSql = stripSqlComments(rawSql);
    const result = auditStorageObjectsPolicies(cleanSql);
    assert.equal(result.valid, true);
    assert.equal(result.policiesCount, 1);
  });

  it("audits migration SQL: ensures avatars bucket in storage.buckets defines 2 MB limit, public SELECT, and strict MIME whitelist", () => {
    const rawSql = readRepoFile("prisma/migrations/20261020_harden_avatar_storage_rls.sql");
    const cleanSql = stripSqlComments(rawSql);
    const result = auditAvatarsBucketConstraints(cleanSql);
    assert.equal(result.valid, true);
  });

  it("negative test: proves policy auditor flags insecure public write, unconstrained SELECT, or omitted FOR/TO defaults", () => {
    const baseDrops = `
      DROP POLICY IF EXISTS "Public Insert for Avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Public Update for Avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Public Delete for Avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Allow public uploads for avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Allow public updates for avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Allow public deletes for avatars" ON storage.objects;
    `;

    // 1. Explicit FOR INSERT TO public
    const sqlInsecureInsert = `
      ${baseDrops}
      CREATE POLICY "Insecure Insert" ON storage.objects FOR INSERT TO public WITH CHECK (true);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlInsecureInsert),
      /Insecure public write policy found on storage\.objects/
    );

    // 2. Omitted FOR and TO (PostgreSQL defaults to FOR ALL TO PUBLIC)
    const sqlDefaultAll = `
      ${baseDrops}
      CREATE POLICY "Open Everything" ON storage.objects USING (true);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlDefaultAll),
      /Insecure public write policy found on storage\.objects/
    );

    // 3. Role 'anon' treated as unauthenticated public
    const sqlAnonInsert = `
      ${baseDrops}
      CREATE POLICY "Anon Write" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'avatars');
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlAnonInsert),
      /Insecure public write policy found on storage\.objects/
    );

    // 4. Public SELECT with injected condition (e.g. 'OR true')
    const sqlOrTrueSelect = `
      ${baseDrops}
      CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars' OR true);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlOrTrueSelect),
      /Public SELECT policy USING clause must strictly and exclusively be \(bucket_id = 'avatars'\)/
    );

    // 5. Public SELECT with injected condition 'OR 1=1'
    const sqlOr1Equals1 = `
      ${baseDrops}
      CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars' OR 1=1);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlOr1Equals1),
      /Public SELECT policy USING clause must strictly and exclusively be \(bucket_id = 'avatars'\)/
    );

    // 6. Public SELECT with WITH CHECK clause attached (invalid / mutation risk)
    const sqlSelectWithCheck = `
      ${baseDrops}
      CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars') WITH CHECK (true);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlSelectWithCheck),
      /Insecure public write policy found on storage\.objects/
    );

    // 7. Extra policy created on storage.objects (backdoor policy)
    const sqlMultiplePolicies = `
      ${baseDrops}
      CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
      CREATE POLICY "Backdoor Policy" ON storage.objects FOR SELECT TO authenticated USING (true);
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlMultiplePolicies),
      /Migration must define exactly 1 policy on storage\.objects, found 2/
    );

    // 8. Missing a required DROP POLICY statement
    const sqlMissingDrop = `
      DROP POLICY IF EXISTS "Public Insert for Avatars" ON storage.objects;
      CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
    `;
    assert.throws(
      () => auditStorageObjectsPolicies(sqlMissingDrop),
      /Migration must drop insecure policy: "Public Update for Avatars"/
    );
  });

  it("negative test: proves bucket auditor flags oversized limits, missing MIME types, or weakened ON CONFLICT clauses", () => {
    // 1. Oversized file limit (5 MB instead of 2 MB)
    const sqlOversized = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlOversized),
      /Bucket file_size_limit must be 2097152/
    );

    // 2. Dangerous extra MIME type in INSERT (allowing pdf)
    const sqlExtraMimeInsert = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlExtraMimeInsert),
      /INSERT allowed_mime_types must be exactly/
    );

    // 3. Dangerous extra MIME type in ON CONFLICT (allowing gif)
    const sqlExtraMimeConflict = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlExtraMimeConflict),
      /ON CONFLICT allowed_mime_types must be exactly/
    );

    // 4. Missing required MIME type (missing webp)
    const sqlMissingMime = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png'])
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlMissingMime),
      /INSERT allowed_mime_types must be exactly/
    );

    // 5. Column reordering with weakened limit must still fail accurately
    const sqlReorderedWeakLimit = `
      INSERT INTO storage.buckets (file_size_limit, id, allowed_mime_types, public, name)
      VALUES (10485760, 'avatars', ARRAY['image/jpeg', 'image/png', 'image/webp'], true, 'avatars')
      ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlReorderedWeakLimit),
      /Bucket file_size_limit must be 2097152/
    );

    // 6. Weakened ON CONFLICT update clause (public = false or limit not set)
    const sqlWeakConflict = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
      ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    `;
    assert.throws(
      () => auditAvatarsBucketConstraints(sqlWeakConflict),
      /ON CONFLICT public must be set to true/
    );
  });
});

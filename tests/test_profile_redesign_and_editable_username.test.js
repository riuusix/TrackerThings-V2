import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test.describe("Profile UI/UX Redesign & Editable Username Suite", () => {
  test("1. ProfileClient: Identity section, connected stats, and editable username input", () => {
    const clientPath = path.join(rootDir, "app", "profile", "ProfileClient.tsx");
    assert.ok(fs.existsSync(clientPath), "ProfileClient.tsx must exist");

    const content = fs.readFileSync(clientPath, "utf8");

    // Identity section
    assert.ok(
      content.includes("@{currentUser.username}"),
      "Must render @username handle in the profile overview"
    );
    assert.ok(
      content.includes("currentUser.fullName || currentUser.username"),
      "Must prioritize display name with fallback to username"
    );
    assert.ok(
      content.includes("userRole"),
      "Must display user role badge"
    );
    assert.ok(
      content.includes("Terdaftar sejak"),
      "Must display formatted registration date"
    );

    // Grouped contact details
    assert.ok(
      content.includes("Email Akun") && content.includes("WhatsApp / HP"),
      "Must group contact details with distinct labels"
    );

    // Connected Academic Stats & Progress Bar
    assert.ok(
      content.includes("Statistik & Beban Studi Akademik"),
      "Must display unified academic achievement section"
    );
    assert.ok(
      content.includes("stats.totalCourses") && content.includes("stats.totalTasks"),
      "Must display course and task counts"
    );
    assert.ok(
      content.includes("completionRate"),
      "Must display completion rate percentage"
    );
    assert.ok(
      content.includes("Progress Keseluruhan Tugas"),
      "Must feature integrated horizontal progress bar"
    );

    // Edit Profile Modal contains username input
    assert.ok(
      content.includes('name="username"'),
      "Edit modal must contain username input field"
    );
    assert.ok(
      content.includes('defaultValue={currentUser.username}'),
      "Username input must be prefilled with current username"
    );
  });

  test("2. Server Action (updateProfileAction): Validates and updates username with session refresh", () => {
    const actionPath = path.join(rootDir, "app", "actions", "profile.ts");
    assert.ok(fs.existsSync(actionPath), "app/actions/profile.ts must exist");

    const content = fs.readFileSync(actionPath, "utf8");

    // Username extraction and validation
    assert.ok(
      content.includes('formData.get("username")'),
      "Must extract username from formData"
    );
    assert.ok(
      content.includes("usernameRegex") || content.includes("/^[a-zA-Z0-9_.-]{3,30}$/"),
      "Must enforce regex validation for username"
    );

    // Case-insensitive uniqueness check
    assert.ok(
      content.includes('mode: "insensitive"') && content.includes("existingUsername"),
      "Must check username uniqueness with case-insensitivity"
    );

    // Session refresh
    assert.ok(
      content.includes("createSession("),
      "Must re-issue session cookie on successful profile update"
    );
  });

  test("3. REST API Routes (/api/profile & /api/user/profile): PUT handler supports username update with validation", () => {
    const apiProfilePath = path.join(rootDir, "app", "api", "profile", "route.ts");
    const apiUserProfilePath = path.join(rootDir, "app", "api", "user", "profile", "route.ts");
    assert.ok(fs.existsSync(apiProfilePath), "app/api/profile/route.ts must exist");
    assert.ok(fs.existsSync(apiUserProfilePath), "app/api/user/profile/route.ts must exist");

    const content1 = fs.readFileSync(apiProfilePath, "utf8");
    const content2 = fs.readFileSync(apiUserProfilePath, "utf8");

    for (const [name, content] of [["/api/profile", content1], ["/api/user/profile", content2]]) {
      assert.ok(
        content.includes("rawUsername") || content.includes("username"),
        `${name} must parse username in PUT handler`
      );
      assert.ok(
        content.includes("usernameRegex") || content.includes("/^[a-zA-Z0-9_.-]{3,30}$/"),
        `${name} must validate username format`
      );
      assert.ok(
        content.includes("Username sudah digunakan"),
        `${name} must return 409 conflict message on duplicate username`
      );
      assert.ok(
        content.includes("session.userId"),
        `${name} must scope updates strictly to authenticated user`
      );
    }
  });

  test("4. Username Validation Rules Unit Tests", () => {
    const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;

    // Valid usernames
    assert.ok(usernameRegex.test("budi_santoso"), "Valid: lowercase with underscore");
    assert.ok(usernameRegex.test("BudiSantoso99"), "Valid: alphanumeric mixed case");
    assert.ok(usernameRegex.test("john.doe-2026"), "Valid: dots and hyphens");
    assert.ok(usernameRegex.test("abc"), "Valid: minimum 3 chars");
    assert.ok(usernameRegex.test("a".repeat(30)), "Valid: maximum 30 chars");

    // Invalid usernames
    assert.strictEqual(usernameRegex.test("ab"), false, "Invalid: less than 3 chars");
    assert.strictEqual(usernameRegex.test("a".repeat(31)), false, "Invalid: more than 30 chars");
    assert.strictEqual(usernameRegex.test("budi santoso"), false, "Invalid: contains spaces");
    assert.strictEqual(usernameRegex.test("budi@santoso"), false, "Invalid: contains @");
    assert.strictEqual(usernameRegex.test("budi!"), false, "Invalid: contains exclamation");
    assert.strictEqual(usernameRegex.test(""), false, "Invalid: empty string");
  });
});


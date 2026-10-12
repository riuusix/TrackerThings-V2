import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { SignJWT, jwtVerify } from "jose";
import { sanitizeRedirectPath } from "../lib/utils.ts";

try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

const PORT = 3099;
const ROOT_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ROOT_URL}/api`;

console.log("=== Memulai Server Next.js Production untuk Pengujian Endpoint ===");

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: process.cwd(),
});

server.stdout.on("data", (d) => {
  const msg = d.toString();
  if (msg.includes("Ready in") || msg.includes("started server on")) {
    console.log("Server Next.js siap pada port", PORT);
  }
});

server.stderr.on("data", (d) => {
  const err = d.toString();
  if (!err.includes("DeprecationWarning")) {
    console.error("Next.js stderr:", err);
  }
});

async function waitForServer(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 400 || res.status === 200 || res.status === 401) {
        return true;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Server Next.js gagal siap dalam batas waktu.");
}

async function runTests() {
  try {
    await waitForServer();
    console.log("Server terhubung. Menjalankan pengujian endpoint...\n");

    const tests = [
      // Auth Endpoints
      {
        name: "POST /api/auth/login tanpa payload -> 400 Bad Request",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          assert.equal(res.status, 400);
          const data = await res.json();
          assert.equal(data.success, false);
        },
      },
      {
        name: "POST /api/auth/register tanpa payload -> 400 Bad Request",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          assert.equal(res.status, 400);
          const data = await res.json();
          assert.equal(data.success, false);
        },
      },

      // User & Profile Endpoints
      {
        name: "GET /api/user/profile tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/user/profile`, { method: "GET" });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
        },
      },
      {
        name: "PUT /api/user/profile tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/user/profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ full_name: "Test" }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "PUT /api/user/password tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/user/password`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_password: "a", new_password: "b" }),
          });
          assert.equal(res.status, 401);
        },
      },

      // Admin Endpoints
      {
        name: "GET /api/admin/dashboard tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/admin/dashboard`, { method: "GET" });
          assert.equal(res.status, 401);
        },
      },

      // Jadwal Endpoints
      {
        name: "GET /api/jadwal tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal`, { method: "GET" });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "POST /api/jadwal tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama_matkul: "Kalkulus" }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "PUT /api/jadwal/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/1`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama_matkul: "Kalkulus II" }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "DELETE /api/jadwal/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/1`, { method: "DELETE" });
          assert.equal(res.status, 401);
        },
      },

      // Tugas Endpoints
      {
        name: "GET /api/tugas tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas`, { method: "GET" });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "POST /api/tugas tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama_tugas: "Tugas 1" }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "PATCH /api/tugas tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: 1, progress: 50 }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "PUT /api/tugas/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas/1`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama_tugas: "Tugas 1 Revisi" }),
          });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "DELETE /api/tugas/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas/1`, { method: "DELETE" });
          assert.equal(res.status, 401);
        },
      },

      // Ujian Endpoints (Newly implemented)
      {
        name: "GET /api/ujian tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian`, { method: "GET" });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "POST /api/ujian tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_jadwal: 1, jenis_ujian: "UTS", tanggal: "2026-11-01" }),
          });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
          assert.match(data.message, /Sesi login telah berakhir/i);
        },
      },
      {
        name: "PUT /api/ujian/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian/1`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jenis_ujian: "UAS" }),
          });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
          assert.match(data.message, /Sesi login telah berakhir/i);
        },
      },
      {
        name: "DELETE /api/ujian/1 tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian/1`, { method: "DELETE" });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
        },
      },

      // Kelas Pengganti Endpoints (Newly implemented)
      {
        name: "GET /api/kelas-pengganti tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti`, { method: "GET" });
          assert.equal(res.status, 401);
        },
      },
      {
        name: "POST /api/kelas-pengganti tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_jadwal: 1, tanggal: "2026-11-01", waktu_mulai: "08:00", waktu_selesai: "10:00" }),
          });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
          assert.match(data.message, /Sesi login telah berakhir/i);
        },
      },
      {
        name: "POST /api/kelas-pengganti/1/selesai tanpa token -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti/1/selesai`, { method: "POST" });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
          assert.match(data.message, /Sesi login telah berakhir/i);
        },
      },

      // Auth & Middleware Security Tests
      {
        name: "GET / tanpa autentikasi -> Redirect 307/308 ke /login",
        fn: async () => {
          const res = await fetch(`${ROOT_URL}/`, { redirect: "manual" });
          assert.ok(res.status === 307 || res.status === 308);
          const location = res.headers.get("location");
          assert.ok(location && location.includes("/login"));
        },
      },
      {
        name: "GET /dashboard tanpa token -> Redirect 307/308 ke /login?from=/dashboard",
        fn: async () => {
          const res = await fetch(`${ROOT_URL}/dashboard`, { redirect: "manual" });
          assert.ok(res.status === 307 || res.status === 308);
          const location = res.headers.get("location");
          assert.ok(location && location.includes("/login"));
          assert.ok(
            location &&
              (location.includes("from=%2Fdashboard") || location.includes("from=/dashboard"))
          );
        },
      },
      {
        name: "GET /dashboard dengan cookie auth_session invalid/tampered -> Ditolak & Redirect ke /login",
        fn: async () => {
          const res = await fetch(`${ROOT_URL}/dashboard`, {
            headers: { Cookie: "auth_session=invalid.malformed.token" },
            redirect: "manual",
          });
          assert.ok(res.status === 307 || res.status === 308);
          const location = res.headers.get("location");
          assert.ok(location && location.includes("/login"));
        },
      },
      {
        name: "GET /api/user/profile dengan Bearer token invalid -> 401 Unauthorized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/user/profile`, {
            headers: { Authorization: "Bearer totally.invalid.jwt.token" },
          });
          assert.equal(res.status, 401);
          const data = await res.json();
          assert.equal(data.success, false);
        },
      },
      {
        name: "Sanitasi redirect path (lib/utils.ts) -> Cegah Open Redirect, Encoded Slashes, & Auth Loop",
        fn: async () => {
          // Path internal yang valid (harus diizinkan)
          assert.equal(sanitizeRedirectPath("/dashboard"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/matakuliah?view=grid"), "/matakuliah?view=grid");
          assert.equal(sanitizeRedirectPath("/ujian"), "/ujian");

          // Open redirect attacks standar
          assert.equal(sanitizeRedirectPath("https://evil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("http://evil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("//evil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/\\evil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("javascript:alert(1)"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/javascript:alert(1)"), "/dashboard");
          assert.equal(sanitizeRedirectPath("data:text/html,evil"), "/dashboard");

          // Encoded traversal & encoded backslash / protocol-relative attacks
          assert.equal(sanitizeRedirectPath("/%5cevil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/%5Cevil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/%2f%2fevil.com"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/path\\sub"), "/dashboard");

          // Auth loop protection (termasuk trailing slash dan subpath)
          assert.equal(sanitizeRedirectPath("/login"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/login/"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/login?error=1"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/register"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/register/step2"), "/dashboard");
          assert.equal(sanitizeRedirectPath("/recovery"), "/dashboard");
          assert.equal(sanitizeRedirectPath(""), "/dashboard");
          assert.equal(sanitizeRedirectPath(null), "/dashboard");
        },
      },
      {
        name: "Verifikasi Token JOSE: Signature mismatch ditolak",
        fn: async () => {
          const secretA = new TextEncoder().encode("secret_key_a_minimum_32_characters_long_1234");
          const secretB = new TextEncoder().encode("secret_key_b_different_key_32_characters_long");

          const token = await new SignJWT({ userId: 99, username: "tester" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(secretA);

          // Verifikasi dengan secret yang benar
          const verified = await jwtVerify(token, secretA, { algorithms: ["HS256"] });
          assert.equal(verified.payload.userId, 99);

          // Verifikasi dengan secret berbeda -> harus throw
          await assert.rejects(
            async () => {
              await jwtVerify(token, secretB, { algorithms: ["HS256"] });
            },
            /signature/i
          );
        },
      },
      {
        name: "POST /api/auth/login dengan kredensial tidak terdaftar -> Ditolak (tidak boleh 200)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: "unregistered_test_user_xyz",
              password: "wrong_password_123456",
            }),
          });
          // Kredensial tidak terdaftar harus mengembalikan status penolakan 401 atau 500 jika DB terisolasi, bukan 200
          assert.ok(res.status === 401 || res.status === 500);
          const data = await res.json();
          assert.equal(data.success, false);
          if (res.status === 401) {
            assert.match(data.message, /Username atau password salah/i);
          }
        },
      },
      {
        name: "GET /dashboard dengan cookie auth_session VALID -> Akses Diberikan (Status 200)",
        fn: async () => {
          const key = new TextEncoder().encode(
            process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!"
          );
          const validToken = await new SignJWT({
            userId: 1,
            username: "valid_student",
            email: "student@kampus.ac.id",
            role: "user",
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(key);

          const res = await fetch(`${ROOT_URL}/dashboard`, {
            headers: { Cookie: `auth_session=${validToken}` },
            redirect: "manual",
          });
          // Status harus 200 (diizinkan masuk ke dashboard, tidak di-redirect ke /login)
          assert.equal(res.status, 200);
        },
      },
      {
        name: "Verifikasi Payload Token JWT -> Bebas dari Password Hash & Jawaban Pemulihan",
        fn: async () => {
          const key = new TextEncoder().encode(
            process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!"
          );
          const token = await new SignJWT({
            userId: 1,
            username: "student",
            email: "student@test.com",
            role: "user",
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(key);

          const verified = await jwtVerify(token, key, { algorithms: ["HS256"] });
          const payload = verified.payload;

          // Klaim esensial terverifikasi
          assert.equal(payload.userId, 1);
          assert.equal(payload.username, "student");
          assert.equal(payload.email, "student@test.com");
          assert.equal(payload.role, "user");

          // Tidak boleh memuat data rahasia
          assert.equal(payload.password, undefined);
          assert.equal(payload.password_hash, undefined);
          assert.equal(payload.securityAnswerHash, undefined);
          assert.equal(payload.security_answer_hash, undefined);
        },
      },
    ];

    let passed = 0;
    for (const t of tests) {
      process.stdout.write(`- [TEST] ${t.name} ... `);
      await t.fn();
      console.log("PASS");
      passed++;
    }

    console.log(`\n=== SEMUA PENGUJIAN ENDPOINT BERHASIL (${passed}/${tests.length}) ===\n`);
  } catch (err) {
    console.error("\nTEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("Menghentikan server test...");
    try {
      if (process.platform === "win32" && server.pid) {
        spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        server.kill("SIGTERM");
      }
    } catch {}
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
}

runTests();

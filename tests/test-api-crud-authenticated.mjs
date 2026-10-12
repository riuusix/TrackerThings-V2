import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { PrismaClient } = req("@prisma/client");

try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

const PORT = 3199;
const ROOT_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ROOT_URL}/api`;

const JWT_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!"
);

const prisma = new PrismaClient();

console.log("=== Memulai Test Suite Authenticated CRUD, IDOR, dan RBAC ===");

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: process.cwd(),
});

server.stdout.on("data", (d) => {
  const msg = d.toString();
  if (msg.includes("Ready in") || msg.includes("started server on")) {
    console.log("Server test Next.js aktif pada port", PORT);
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
  throw new Error("Server test Next.js gagal siap dalam batas waktu.");
}

async function createToken(userId, username, email, role = "user") {
  return new SignJWT({ userId, username, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(JWT_KEY);
}

async function run() {
  const ts = Date.now();
  let userA = null;
  let userB = null;
  let userAdmin = null;

  try {
    await waitForServer();

    // 1. Setup Isolated Test Accounts in Database
    console.log("Menyiapkan akun uji terisolasi di database...");
    userA = await prisma.user.create({
      data: {
        username: `e2e_student_a_${ts}`,
        email: `student_a_${ts}@test.invalid`,
        password: "$2a$10$hashedfakepasswordforautomatedtests1234567890",
        role: "user",
        fullName: "Student A Automation",
      },
    });

    userB = await prisma.user.create({
      data: {
        username: `e2e_student_b_${ts}`,
        email: `student_b_${ts}@test.invalid`,
        password: "$2a$10$hashedfakepasswordforautomatedtests1234567890",
        role: "user",
        fullName: "Student B Automation",
      },
    });

    userAdmin = await prisma.user.create({
      data: {
        username: `e2e_admin_${ts}`,
        email: `admin_${ts}@test.invalid`,
        password: "$2a$10$hashedfakepasswordforautomatedtests1234567890",
        role: "admin",
        fullName: "Admin Automation",
      },
    });

    const tokenA = await createToken(userA.id, userA.username, userA.email, "user");
    const tokenB = await createToken(userB.id, userB.username, userB.email, "user");
    const tokenAdmin = await createToken(userAdmin.id, userAdmin.username, userAdmin.email, "admin");

    const authHeadersA = { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" };
    const authHeadersB = { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" };
    const authHeadersAdmin = { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" };

    let createdJadwalId = null;
    let createdTugasId = null;
    let createdUjianId = null;
    let createdKpId = null;

    const tests = [
      // --- PROFILE TESTS ---
      {
        name: "GET /api/user/profile (User A) -> 200 & Envelope Valid",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/user/profile`, { headers: authHeadersA });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.equal(body.data.username, userA.username);
          assert.equal(body.data.full_name, "Student A Automation");
          assert.equal(body.user.username, userA.username);
        },
      },
      {
        name: "GET /api/profile (User A) -> 200 & Dual-Naming Standardized",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/profile`, { headers: authHeadersA });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.equal(body.data.username, userA.username);
          assert.equal(body.data.fullName, "Student A Automation");
          assert.equal(body.data.full_name, "Student A Automation");
        },
      },
      {
        name: "PUT /api/profile (User A) -> 200 Update Profile Data",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/profile`, {
            method: "PUT",
            headers: authHeadersA,
            body: JSON.stringify({ full_name: "Student A Updated", phone_number: "081234567890" }),
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.equal(body.data.full_name, "Student A Updated");
          assert.equal(body.data.phone_number, "081234567890");
        },
      },

      // --- JADWAL CRUD & IDOR TESTS ---
      {
        name: "POST /api/jadwal (User A) -> 201 Created",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal`, {
            method: "POST",
            headers: authHeadersA,
            body: JSON.stringify({
              nama_matkul: "Algoritma & Pemrograman",
              hari: "Senin",
              waktu_mulai: "08:00",
              waktu_selesai: "10:30",
              dosen: "Dr. Budi Santoso",
              kategori: "Wajib",
              lokasi: "Gedung A 301",
            }),
          });
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(body.data.id > 0);
          assert.equal(body.data.nama_matkul, "Algoritma & Pemrograman");
          assert.equal(body.data.waktu_mulai, "08:00");
          assert.equal(body.data.waktu_selesai, "10:30");
          createdJadwalId = body.data.id;
        },
      },
      {
        name: "GET /api/jadwal (User A) -> 200 & Terdaftar",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal`, { headers: authHeadersA });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(Array.isArray(body.data));
          const found = body.data.find((j) => j.id === createdJadwalId);
          assert.ok(found, "Jadwal yang dibuat harus ditemukan di daftar");
        },
      },
      {
        name: "GET /api/jadwal (User B) -> 200 & Terisolasi (Tidak melihat jadwal User A)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal`, { headers: authHeadersB });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          const found = body.data.find((j) => j.id === createdJadwalId);
          assert.equal(found, undefined, "User B TIDAK BOLEH melihat jadwal User A");
        },
      },
      {
        name: "PUT /api/jadwal/:id (User B -> User A's jadwal) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/${createdJadwalId}`, {
            method: "PUT",
            headers: authHeadersB,
            body: JSON.stringify({ nama_matkul: "Hacked Matkul" }),
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "DELETE /api/jadwal/:id (User B -> User A's jadwal) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/${createdJadwalId}`, {
            method: "DELETE",
            headers: authHeadersB,
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "PUT /api/jadwal/:id (User A) -> 200 Update Sukses",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/${createdJadwalId}`, {
            method: "PUT",
            headers: authHeadersA,
            body: JSON.stringify({ nama_matkul: "Algoritma & Pemrograman Lanjutan" }),
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
        },
      },

      // --- TUGAS CRUD & IDOR TESTS ---
      {
        name: "POST /api/tugas (User A) -> 201 Created",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas`, {
            method: "POST",
            headers: authHeadersA,
            body: JSON.stringify({
              id_jadwal: createdJadwalId,
              nama_tugas: "Tugas Struktur Data Stack",
              deadline: "2026-11-20",
              prioritas: "Tinggi",
              jenis: "Individu",
            }),
          });
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(body.data.id > 0);
          createdTugasId = body.data.id;
        },
      },
      {
        name: "POST /api/tugas (User B mengaitkan jadwal User A) -> 404/403 Ditolak",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas`, {
            method: "POST",
            headers: authHeadersB,
            body: JSON.stringify({
              id_jadwal: createdJadwalId,
              nama_tugas: "Tugas Ilegal B",
              deadline: "2026-11-20",
            }),
          });
          assert.equal(res.status, 404);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "PUT /api/tugas/:id (User B -> User A's tugas) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas/${createdTugasId}`, {
            method: "PUT",
            headers: authHeadersB,
            body: JSON.stringify({ nama_tugas: "Hacked Tugas" }),
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "DELETE /api/tugas/:id (User B -> User A's tugas) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas/${createdTugasId}`, {
            method: "DELETE",
            headers: authHeadersB,
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "DELETE /api/tugas/:id (User A) -> 200 Deleted",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/tugas/${createdTugasId}`, {
            method: "DELETE",
            headers: authHeadersA,
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
        },
      },

      // --- UJIAN CRUD & IDOR TESTS ---
      {
        name: "POST /api/ujian (User A) -> 201 Created",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian`, {
            method: "POST",
            headers: authHeadersA,
            body: JSON.stringify({
              id_jadwal: createdJadwalId,
              jenis_ujian: "UTS",
              tanggal: "2026-11-25",
              waktu_mulai: "08:00",
              waktu_selesai: "10:00",
              ruangan: "Lab Komputer 2",
            }),
          });
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(body.data.id > 0);
          createdUjianId = body.data.id;
        },
      },
      {
        name: "PUT /api/ujian/:id (User B -> User A's ujian) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian/${createdUjianId}`, {
            method: "PUT",
            headers: authHeadersB,
            body: JSON.stringify({ ruangan: "Hacked Room" }),
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "DELETE /api/ujian/:id (User B -> User A's ujian) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian/${createdUjianId}`, {
            method: "DELETE",
            headers: authHeadersB,
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "DELETE /api/ujian/:id (User A) -> 200 Deleted",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/ujian/${createdUjianId}`, {
            method: "DELETE",
            headers: authHeadersA,
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
        },
      },

      // --- KELAS PENGGANTI CRUD & IDOR TESTS ---
      {
        name: "POST /api/kelas-pengganti (User A) -> 201 Created",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti`, {
            method: "POST",
            headers: authHeadersA,
            body: JSON.stringify({
              id_jadwal: createdJadwalId,
              tanggal: "2026-11-28",
              waktu_mulai: "13:00",
              waktu_selesai: "15:00",
              lokasi: "Ruang Teori 4",
              catatan: "Pengganti sesi 3",
            }),
          });
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(body.data.id > 0);
          createdKpId = body.data.id;
        },
      },
      {
        name: "POST /api/kelas-pengganti/:id/selesai (User B -> User A's KP) -> 403 Forbidden (IDOR dicegah)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti/${createdKpId}/selesai`, {
            method: "POST",
            headers: authHeadersB,
          });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
        },
      },
      {
        name: "POST /api/kelas-pengganti/:id/selesai (User A) -> 200 OK Selesai",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/kelas-pengganti/${createdKpId}/selesai`, {
            method: "POST",
            headers: authHeadersA,
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
        },
      },

      // --- CLEANUP JADWAL ---
      {
        name: "DELETE /api/jadwal/:id (User A) -> 200 Deleted",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/jadwal/${createdJadwalId}`, {
            method: "DELETE",
            headers: authHeadersA,
          });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
        },
      },

      // --- RBAC TESTS ---
      {
        name: "GET /api/admin/dashboard (User A biasa) -> 403 Forbidden (Bukan Admin)",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/admin/dashboard`, { headers: authHeadersA });
          assert.equal(res.status, 403);
          const body = await res.json();
          assert.equal(body.success, false);
          assert.match(body.message, /Administrator/i);
        },
      },
      {
        name: "GET /api/admin/dashboard (User Admin) -> 200 OK & Metrik Sistem",
        fn: async () => {
          const res = await fetch(`${BASE_URL}/admin/dashboard`, { headers: authHeadersAdmin });
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(typeof body.data.total_users === "number");
          assert.ok(typeof body.data.total_tasks === "number");
          assert.ok(Array.isArray(body.data.recent_users));
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

    console.log(`\n=== SEMUA INTEGRATION TEST AUTH, CRUD, IDOR, DAN RBAC BERHASIL (${passed}/${tests.length}) ===\n`);
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("Membersihkan akun uji dan mematikan server...");
    try {
      if (userA) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
      if (userB) await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
      if (userAdmin) await prisma.user.delete({ where: { id: userAdmin.id } }).catch(() => {});
    } catch {}
    await prisma.$disconnect();

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

run();


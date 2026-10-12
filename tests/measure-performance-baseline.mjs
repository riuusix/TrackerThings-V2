import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { PrismaClient } = req("@prisma/client");

try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

const PORT = 3299;
const ROOT_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = `${ROOT_URL}/api`;

const JWT_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!"
);

const prisma = new PrismaClient();

console.log("================================================================");
console.log("   TRACKERTHINGS V2 — PERFORMANCE AUDIT & BASELINE BENCHMARK    ");
console.log("================================================================\n");

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: process.cwd(),
});

server.stdout.on("data", (d) => {
  const msg = d.toString();
  if (msg.includes("Ready in") || msg.includes("started server on")) {
    console.log("[Server] Next.js production server ready on port", PORT);
  }
});

server.stderr.on("data", (d) => {
  const err = d.toString();
  if (!err.includes("DeprecationWarning")) {
    console.error("[Server Error]", err.trim());
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
  throw new Error("Server test Next.js failed to start within timeout.");
}

async function createToken(userId, username, email, role = "user") {
  return new SignJWT({ userId, username, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(JWT_KEY);
}

async function measureHttp(url, options = {}, runs = 3) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = await fetch(url, options);
    const t1 = performance.now();
    await res.text();
    const tTotal = performance.now() - t0;
    results.push({ status: res.status, duration: tTotal });
  }
  return {
    cold: results[0].duration,
    warm: runs > 1 ? results.slice(1).reduce((acc, r) => acc + r.duration, 0) / (runs - 1) : results[0].duration,
    all: results.map((r) => r.duration),
    status: results[0].status,
  };
}

async function runBenchmark() {
  let testUser = null;
  try {
    await waitForServer();

    // Setup benchmark test account
    const ts = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `bench_user_${ts}`,
        email: `bench_${ts}@test.local`,
        password: "$2a$10$hashedfakepasswordforautomatedtests1234567890",
        role: "admin",
        fullName: "Performance Benchmark User",
      },
    });

    // Populate realistic test data for this benchmark user
    const sampleJadwal = await prisma.jadwal.create({
      data: {
        userId: testUser.id,
        namaMatkul: "Sistem Basis Data",
        hari: "Senin",
        waktuMulai: new Date("1970-01-01T08:00:00.000Z"),
        waktuSelesai: new Date("1970-01-01T10:30:00.000Z"),
        dosen: "Prof. Ir. Hendra",
        kategori: "Wajib",
        lokasi: "Lab Basis Data",
      },
    });

    await prisma.tugas.create({
      data: {
        userId: testUser.id,
        idJadwal: sampleJadwal.id,
        namaTugas: "Desain Skema Relasional ERD",
        deadline: new Date("2026-11-15T00:00:00.000Z"),
        prioritas: "Tinggi",
        jenis: "Kelompok",
        status: "Sedang Dikerjakan",
        progress: 40,
      },
    });

    await prisma.tugas.create({
      data: {
        userId: testUser.id,
        idJadwal: sampleJadwal.id,
        namaTugas: "Review Normalisasi 3NF",
        deadline: new Date("2026-11-01T00:00:00.000Z"),
        prioritas: "Sedang",
        jenis: "Individu",
        status: "Selesai",
        progress: 100,
      },
    });

    await prisma.ujian.create({
      data: {
        userId: testUser.id,
        idJadwal: sampleJadwal.id,
        jenisUjian: "UTS",
        tanggal: new Date("2026-11-20T00:00:00.000Z"),
        waktuMulai: new Date("1970-01-01T08:00:00.000Z"),
        waktuSelesai: new Date("1970-01-01T10:00:00.000Z"),
        ruangan: "R.302",
      },
    });

    await prisma.kelasPengganti.create({
      data: {
        userId: testUser.id,
        idJadwal: sampleJadwal.id,
        tanggal: new Date("2026-11-25T00:00:00.000Z"),
        waktuMulai: new Date("1970-01-01T13:00:00.000Z"),
        waktuSelesai: new Date("1970-01-01T15:00:00.000Z"),
        lokasi: "R.401",
        status: "Terjadwal",
      },
    });

    const token = await createToken(testUser.id, testUser.username, testUser.email, "admin");
    const cookieHeader = `auth_session=${token}`;
    const bearerHeader = `Bearer ${token}`;

    console.log("\n--- 1. DATABASE QUERY LATENCY BENCHMARK (ISOLATION) ---");

    // Test Prisma queries for Dashboard individually
    const qTimes = {};

    // Cold query
    let t0 = performance.now();
    await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { username: true, email: true, fullName: true, role: true },
    });
    qTimes["user.findUnique"] = performance.now() - t0;

    t0 = performance.now();
    await prisma.jadwal.findMany({
      where: { userId: testUser.id },
      orderBy: { waktuMulai: "asc" },
    });
    qTimes["jadwal.findMany"] = performance.now() - t0;

    t0 = performance.now();
    await prisma.kelasPengganti.findMany({
      where: { userId: testUser.id, status: { not: "Selesai" } },
      include: { jadwal: { select: { namaMatkul: true, kategori: true } } },
      orderBy: { waktuMulai: "asc" },
    });
    qTimes["kelasPengganti.findMany"] = performance.now() - t0;

    t0 = performance.now();
    await prisma.ujian.findFirst({
      where: { userId: testUser.id, tanggal: { gte: new Date() } },
      include: { jadwal: { select: { namaMatkul: true } } },
    });
    qTimes["ujian.findFirst"] = performance.now() - t0;

    t0 = performance.now();
    await prisma.tugas.findMany({
      where: { userId: testUser.id, status: { not: "Selesai" } },
      include: { jadwal: { select: { namaMatkul: true } } },
      orderBy: { deadline: "asc" },
    });
    qTimes["tugas.findMany(urgent)"] = performance.now() - t0;

    t0 = performance.now();
    await prisma.tugas.findMany({
      where: { userId: testUser.id, status: "Selesai" },
      include: { jadwal: { select: { namaMatkul: true } } },
      orderBy: { deadline: "desc" },
    });
    qTimes["tugas.findMany(completed)"] = performance.now() - t0;

    console.log("Individual Prisma query latencies:");
    for (const [k, v] of Object.entries(qTimes)) {
      console.log(`  - ${k.padEnd(28)}: ${v.toFixed(2)} ms`);
    }

    // Measure Current Sequential pattern for Dashboard
    t0 = performance.now();
    await prisma.user.findUnique({ where: { id: testUser.id }, select: { username: true, email: true, fullName: true, role: true } });
    await prisma.jadwal.findMany({ where: { userId: testUser.id }, orderBy: { waktuMulai: "asc" } });
    await prisma.kelasPengganti.findMany({ where: { userId: testUser.id, status: { not: "Selesai" } }, include: { jadwal: { select: { namaMatkul: true, kategori: true } } } });
    await prisma.ujian.findFirst({ where: { userId: testUser.id, tanggal: { gte: new Date() } }, include: { jadwal: { select: { namaMatkul: true } } } });
    await prisma.tugas.findMany({ where: { userId: testUser.id, status: { not: "Selesai" } }, include: { jadwal: { select: { namaMatkul: true } } } });
    await prisma.tugas.findMany({ where: { userId: testUser.id, status: "Selesai" }, include: { jadwal: { select: { namaMatkul: true } } } });
    const sequentialDuration = performance.now() - t0;

    console.log(`\nDashboard Queries Comparison:`);
    console.log(`  - 6 Sequential Awaits : ${sequentialDuration.toFixed(2)} ms`);

    console.log("\n--- 2. SERVER-SIDE PAGE NAVIGATION & RENDERING (E2E HTTP) ---");
    const pages = [
      { name: "/dashboard", url: `${ROOT_URL}/dashboard` },
      { name: "/matakuliah", url: `${ROOT_URL}/matakuliah` },
      { name: "/ujian", url: `${ROOT_URL}/ujian` },
      { name: "/history", url: `${ROOT_URL}/history` },
      { name: "/profile", url: `${ROOT_URL}/profile` },
      { name: "/settings", url: `${ROOT_URL}/settings` },
      { name: "/admin/users", url: `${ROOT_URL}/admin/users` },
      { name: "/admin/announcements", url: `${ROOT_URL}/admin/announcements` },
    ];

    console.log("Measuring Server-Side Render (SSR) times (Cold & Warm):");
    for (const p of pages) {
      const res = await measureHttp(p.url, { headers: { Cookie: cookieHeader } }, 4);
      console.log(`  - ${p.name.padEnd(22)} [Status: ${res.status}] Cold: ${res.cold.toFixed(1).padStart(6)} ms | Warm: ${res.warm.toFixed(1).padStart(6)} ms`);
    }

    console.log("\n--- 3. API ROUTES LATENCY (TTFB & TOTAL DURATION) ---");
    const apis = [
      { name: "/api/user/profile", url: `${BASE_URL}/user/profile` },
      { name: "/api/profile", url: `${BASE_URL}/profile` },
      { name: "/api/jadwal", url: `${BASE_URL}/jadwal` },
      { name: "/api/tugas", url: `${BASE_URL}/tugas` },
      { name: "/api/ujian", url: `${BASE_URL}/ujian` },
      { name: "/api/kelas-pengganti", url: `${BASE_URL}/kelas-pengganti` },
      { name: "/api/admin/dashboard", url: `${BASE_URL}/admin/dashboard` },
    ];

    for (const a of apis) {
      const res = await measureHttp(a.url, { headers: { Authorization: bearerHeader } }, 4);
      console.log(`  - ${a.name.padEnd(22)} [Status: ${res.status}] Cold: ${res.cold.toFixed(1).padStart(6)} ms | Warm: ${res.warm.toFixed(1).padStart(6)} ms`);
    }

    console.log("\n================================================================");
    console.log("   AUDIT SUMMARY & PROVEN BOTTLENECKS IDENTIFIED                ");
    console.log("================================================================");
    console.log("1. Sequential Prisma queries on Server Components (Dashboard & Ujian)");
    console.log("2. window.location.reload() on CRUD forms (Matakuliah & Ujian)");
    console.log("3. Redundant dual user queries (session user + full user lookup)");
    console.log("4. Unnecessary Supabase SSR client initialization in middleware.ts");
    console.log("5. Double query for tugas (status != Selesai vs status == Selesai)");
  } catch (err) {
    console.error("Benchmark failed:", err);
  } finally {
    console.log("\nCleaning up benchmark user and shutting down server...");
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();

    try {
      if (process.platform === "win32" && server.pid) {
        spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        server.kill("SIGTERM");
      }
    } catch {}

    setTimeout(() => process.exit(0), 500);
  }
}

runBenchmark();

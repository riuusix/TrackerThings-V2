import { chromium } from "playwright";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function getSecret() {
  const secret = process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!";
  return new TextEncoder().encode(secret);
}

async function makeToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

async function main() {
  console.log("=== MEMULAI VERIFIKASI VISUAL & FUNGSIONAL PEMISAHAN DASHBOARD ===");

  let adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        username: "admin_test",
        email: "admin_test@trackerthings.com",
        password: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        fullName: "Administrator Test",
        role: "admin",
      },
    });
  }

  let studentUser = await prisma.user.findFirst({
    where: { role: "mahasiswa" },
  });

  if (!studentUser) {
    studentUser = await prisma.user.create({
      data: {
        username: "mhs_test",
        email: "mhs_test@trackerthings.com",
        password: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        fullName: "Mahasiswa Test",
        role: "mahasiswa",
      },
    });
  }

  const adminToken = await makeToken({
    userId: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    role: "admin",
  });

  const studentToken = await makeToken({
    userId: studentUser.id,
    username: studentUser.username,
    email: studentUser.email,
    role: "mahasiswa",
  });

  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const artifactDir = "C:\\Users\\Budy\\.gemini\\antigravity\\brain\\c3590d4b-c1b7-4ad4-9aea-2fb4cf0b79ec";

  try {
    // ----------------------------------------------------
    // TEST 1: Admin membuka /dashboard (Dashboard Pengguna)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Admin membuka /dashboard...");
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        name: "auth_session",
        value: adminToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const pageAdmin = await adminContext.newPage();
    await pageAdmin.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });

    // Klik tombol profile dropdown
    const profileBtn = pageAdmin.locator('button:has(div:text("Mahasiswa")), button:has(div:text("Administrator")), button:has(span:text("Mahasiswa"))').first();
    const fallbackProfileBtn = pageAdmin.locator('button:has(svg.lucide-chevron-down)').first();

    if (await profileBtn.count() > 0) {
      await profileBtn.click();
    } else {
      await fallbackProfileBtn.click();
    }

    await pageAdmin.waitForTimeout(500);

    // Ambil screenshot dashboard pengguna dengan dropdown terbuka
    const dashScreenshotPath = path.join(artifactDir, "dashboard_user_dropdown_verified.png");
    await pageAdmin.screenshot({ path: dashScreenshotPath });
    console.log(`✓ Screenshot /dashboard tersimpan di: ${dashScreenshotPath}`);

    // Periksa isi dropdown
    const dropdownText = await pageAdmin.locator(".animate-in").innerText().catch(() => "");
    console.log("\n--- Isi Dropdown Profil pada /dashboard ---");
    console.log(dropdownText);
    console.log("------------------------------------------");

    const containsAdminPanel =
      dropdownText.includes("Panel Administrator") ||
      dropdownText.includes("Dashboard Admin") ||
      dropdownText.includes("Manajemen User") ||
      dropdownText.includes("Kelola Pengumuman") ||
      dropdownText.includes("Admin Logs");

    if (containsAdminPanel) {
      console.error("❌ GAGAL: Dropdown profil di /dashboard masih memuat menu admin!");
      process.exit(1);
    } else {
      console.log("✓ LULUS: Dropdown profil di /dashboard BERSIH dari seluruh menu administratif!");
    }

    // ----------------------------------------------------
    // TEST 2: Admin membuka /admin (Area Admin Khusus)
    // ----------------------------------------------------
    console.log("\n[TEST 2] Admin membuka /admin...");
    await pageAdmin.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });

    const adminScreenshotPath = path.join(artifactDir, "admin_console_verified.png");
    await pageAdmin.screenshot({ path: adminScreenshotPath });
    console.log(`✓ Screenshot /admin tersimpan di: ${adminScreenshotPath}`);

    // Verifikasi AdminNavbar dan link Portal Mahasiswa
    const adminPageText = await pageAdmin.innerText("body");
    const hasAdminBrand = adminPageText.includes("Centralized Administration Console") || adminPageText.includes("Admin Console") || adminPageText.includes("Panel Administrator");
    const hasStudentPortalLink = adminPageText.includes("Portal Mahasiswa") || adminPageText.includes("Buka Dashboard Pengguna");

    console.log(`✓ Admin Console Header terdeteksi: ${hasAdminBrand}`);
    console.log(`✓ Tombol ke Portal Mahasiswa terdeteksi: ${hasStudentPortalLink}`);

    if (!hasAdminBrand || !hasStudentPortalLink) {
      console.error("❌ GAGAL: /admin tidak memiliki navigasi admin tersendiri atau link kembali!");
      process.exit(1);
    }

    // ----------------------------------------------------
    // TEST 3: Mahasiswa biasa membuka /admin (Otorisasi Server)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Mahasiswa biasa mencoba mengakses /admin secara langsung...");
    const studentContext = await browser.newContext();
    await studentContext.addCookies([
      {
        name: "auth_session",
        value: studentToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const pageStudent = await studentContext.newPage();
    const response = await pageStudent.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
    const finalUrl = pageStudent.url();

    console.log(`✓ URL Akhir mahasiswa saat akses /admin: ${finalUrl}`);
    if (finalUrl.includes("/dashboard") || finalUrl.includes("/login")) {
      console.log("✓ LULUS: Mahasiswa biasa otomatis ditolak dan dialihkan dari /admin ke /dashboard!");
    } else {
      console.error(`❌ GAGAL: Mahasiswa biasa diizinkan melihat /admin (URL: ${finalUrl})!`);
      process.exit(1);
    }

    console.log("\n=== SELURUH VERIFIKASI VISUAL & FUNGSIONAL LULUS 100% ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});


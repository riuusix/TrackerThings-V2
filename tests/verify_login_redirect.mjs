import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("=== MEMULAI PENGUJIAN LOGIN REDIRECT BERDASARKAN ROLE (BROWSER NYATA) ===");

  const passwordPlain = "Password123!";
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  // 1. Siapkan akun admin dan mahasiswa untuk pengujian login
  let adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  if (adminUser) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: passwordHash },
    });
  } else {
    adminUser = await prisma.user.create({
      data: {
        username: "admin_test",
        email: "admin_test@trackerthings.com",
        password: passwordHash,
        fullName: "Administrator Test",
        role: "admin",
      },
    });
  }

  let studentUser = await prisma.user.findFirst({
    where: { role: "mahasiswa" },
  });

  if (studentUser) {
    await prisma.user.update({
      where: { id: studentUser.id },
      data: { password: passwordHash },
    });
  } else {
    studentUser = await prisma.user.create({
      data: {
        username: "mhs_test",
        email: "mhs_test@trackerthings.com",
        password: passwordHash,
        fullName: "Mahasiswa Test",
        role: "mahasiswa",
      },
    });
  }

  console.log(`Akun Admin siap: ${adminUser.username} (role: ${adminUser.role})`);
  console.log(`Akun Mahasiswa siap: ${studentUser.username} (role: ${studentUser.role})`);

  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const artifactDir = "C:\\Users\\Budy\\.gemini\\antigravity\\brain\\c3590d4b-c1b7-4ad4-9aea-2fb4cf0b79ec";

  try {
    // ------------------------------------------------------------------------
    // SKENARIO 1: Login sebagai Admin -> Wajib diarahkan ke /admin
    // ------------------------------------------------------------------------
    console.log("\n[SKENARIO 1] Pengujian Login Admin...");
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await adminPage.fill('input[name="username"]', adminUser.username);
    await adminPage.fill('input[name="password"]', passwordPlain);
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForURL("**/admin**", { timeout: 15000 });
    const adminCurrentUrl = adminPage.url();
    console.log(`✓ Admin berhasil login dan diarahkan ke: ${adminCurrentUrl}`);
    if (!adminCurrentUrl.includes("/admin")) {
      throw new Error(`Admin harus diarahkan ke /admin, namun diarahkan ke: ${adminCurrentUrl}`);
    }

    const adminShot = path.join(artifactDir, "login_admin_redirect_verified.png");
    await adminPage.screenshot({ path: adminShot });
    console.log(`✓ Screenshot login admin tersimpan di: ${adminShot}`);

    // Verifikasi Admin dapat membuka /dashboard secara langsung jika diperlukan
    console.log("[SKENARIO 1.b] Admin membuka /dashboard secara langsung...");
    await adminPage.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
    const adminDashUrl = adminPage.url();
    console.log(`✓ Admin dapat mengakses portal mahasiswa di: ${adminDashUrl}`);
    if (!adminDashUrl.includes("/dashboard")) {
      throw new Error(`Admin harus dapat mengakses portal /dashboard jika diinginkan`);
    }

    // ------------------------------------------------------------------------
    // SKENARIO 2: Login sebagai Mahasiswa -> Wajib diarahkan ke /dashboard
    // ------------------------------------------------------------------------
    console.log("\n[SKENARIO 2] Pengujian Login Pengguna Biasa (Mahasiswa)...");
    const mhsCtx = await browser.newContext();
    const mhsPage = await mhsCtx.newPage();

    await mhsPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await mhsPage.fill('input[name="username"]', studentUser.username);
    await mhsPage.fill('input[name="password"]', passwordPlain);
    await mhsPage.click('button[type="submit"]');

    await mhsPage.waitForURL("**/dashboard**", { timeout: 15000 });
    const mhsCurrentUrl = mhsPage.url();
    console.log(`✓ Mahasiswa berhasil login dan diarahkan ke: ${mhsCurrentUrl}`);
    if (!mhsCurrentUrl.includes("/dashboard")) {
      throw new Error(`Mahasiswa harus diarahkan ke /dashboard, namun diarahkan ke: ${mhsCurrentUrl}`);
    }

    const mhsShot = path.join(artifactDir, "login_student_redirect_verified.png");
    await mhsPage.screenshot({ path: mhsShot });
    console.log(`✓ Screenshot login mahasiswa tersimpan di: ${mhsShot}`);

    // ------------------------------------------------------------------------
    // SKENARIO 3: Mahasiswa membuka /admin secara langsung -> Ditolak / diarahkan ke /dashboard
    // ------------------------------------------------------------------------
    console.log("\n[SKENARIO 3] Mahasiswa mencoba mengakses /admin secara langsung...");
    await mhsPage.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
    const rejectedUrl = mhsPage.url();
    console.log(`✓ URL setelah mahasiswa buka /admin: ${rejectedUrl}`);
    if (rejectedUrl.includes("/admin")) {
      throw new Error(`Mahasiswa tidak boleh diizinkan melihat /admin!`);
    }
    console.log("✓ LULUS: Mahasiswa ditolak dan dialihkan kembali ke /dashboard.");

    // ------------------------------------------------------------------------
    // SKENARIO 4: Login gagal (password salah) -> Tetap di /login dan menampilkan error
    // ------------------------------------------------------------------------
    console.log("\n[SKENARIO 4] Pengujian Login Gagal (Kredensial Salah)...");
    const failCtx = await browser.newContext();
    const failPage = await failCtx.newPage();

    await failPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await failPage.fill('input[name="username"]', studentUser.username);
    await failPage.fill('input[name="password"]', "SandiSalahTotal999!");
    await failPage.click('button[type="submit"]');

    await failPage.waitForTimeout(1000);
    const failUrl = failPage.url();
    console.log(`✓ URL setelah login gagal: ${failUrl}`);
    if (!failUrl.includes("/login")) {
      throw new Error(`Login gagal tidak boleh berpindah halaman`);
    }

    const errorVisible = await failPage.locator('text="Username atau password salah"').isVisible();
    console.log(`✓ Pesan error tampil di layar: ${errorVisible}`);
    if (!errorVisible) {
      throw new Error("Pesan error harus ditampilkan saat login gagal");
    }

    console.log("\n=== SELURUH SKENARIO PENGUJIAN LOGIN REDIRECT LULUS 100% ===");
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});


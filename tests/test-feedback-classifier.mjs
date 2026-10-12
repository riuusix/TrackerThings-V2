import assert from "node:assert/strict";
import { classifyApiError } from "../lib/feedback.ts";

console.log("=== Menjalankan Unit Test Pemetaan Feedback & Error Classifier ===");

// 1. String Sanitization: Prisma and SQL leaks prevented
const leak1 = classifyApiError("Invalid `prisma.jadwal.create()` invocation: column not found");
assert.equal(
  leak1,
  "Layanan basis data sedang mengalami gangguan. Silakan coba sesaat lagi.",
  "Prisma exception string must be converted to user-friendly Indonesian message"
);

const leak2 = {
  message: "P2002: Unique constraint failed on the fields: (`username`)",
};
assert.equal(
  classifyApiError(leak2),
  "Layanan data sedang mengalami gangguan. Silakan coba lagi.",
  "Prisma error codes in message must be sanitized"
);

// 2. HTTP Status Code Mapping
assert.equal(
  classifyApiError({ status: 400 }),
  "Permintaan tidak valid. Mohon periksa kembali data yang Anda masukkan."
);

assert.equal(
  classifyApiError({ status: 401 }),
  "Sesi login Anda telah berakhir. Silakan masuk kembali."
);

assert.equal(
  classifyApiError({ status: 403 }),
  "Anda tidak memiliki izin untuk mengakses atau mengubah data ini."
);

assert.equal(
  classifyApiError({ status: 404 }),
  "Data yang Anda cari tidak ditemukan atau telah dihapus."
);

assert.equal(
  classifyApiError({ status: 409 }),
  "Terjadi konflik data. Data serupa mungkin sudah tersimpan."
);

assert.equal(
  classifyApiError({ status: 500 }),
  "Server sedang mengalami kendala. Mohon coba beberapa saat lagi."
);

// 3. Network and Timeout errors
assert.equal(
  classifyApiError({ name: "AbortError" }),
  "Waktu tunggu permintaan habis. Periksa koneksi internet Anda."
);

assert.equal(
  classifyApiError({ message: "Failed to fetch" }),
  "Gagal terhubung ke server. Pastikan perangkat Anda terhubung ke internet."
);

console.log("PASS: Semua 9 skenario error-to-message mapping diverifikasi aman dan terstandarisasi.");


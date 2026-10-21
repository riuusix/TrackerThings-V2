import assert from "node:assert";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/loader.mjs", pathToFileURL("./"));

import { SelfHostedServerProvider } from "../lib/intelligence/academicEngine.ts";

async function main() {
  console.log("Testing SelfHostedServerProvider integration with Python Serverless route...");

  const provider = new SelfHostedServerProvider("http://127.0.0.1:8000");

  const available = await provider.isAvailable();
  assert.strictEqual(available, true, "SelfHostedServerProvider must be available on http://127.0.0.1:8000");
  console.log("✔ isAvailable() succeeded against /health");

  const fakeInput = {
    fileName: "jadwal_krs.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock text"),
    preExtractedText:
      "Senin 08:00 - 10:30 IF253418 Rekayasa Perangkat Lunak 3 SKS\nRabu 13:00 - 15:30 IF253425 Kecerdasan Buatan 3 SKS",
  };

  const result = await provider.extract(fakeInput);
  assert.strictEqual(result.documentType, "class_schedule");
  assert.ok(result.items.length >= 2, "Must return canonical academic items");
  assert.strictEqual(result.items[0].namaMatkul, "Rekayasa Perangkat Lunak");
  assert.strictEqual(result.items[0].kodeMatkul, "IF253418");
  assert.strictEqual(result.items[0].sks, 3);
  assert.strictEqual(result.items[1].namaMatkul, "Kecerdasan Buatan");
  console.log("✔ extract() succeeded and returned valid CanonicalAcademicExtractionResult");
  console.log("Integration test completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

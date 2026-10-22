import fs from 'fs';
import { pathToFileURL } from 'url';

const p1 = pathToFileURL('C:/Users/Budy/Documents/TrackerThings-V2/lib/scheduleParser.ts').href;
const p2 = pathToFileURL('C:/Users/Budy/Documents/TrackerThings-V2/lib/intelligence/academicEngine.ts').href;

const { extractTextFromPdf, recognizeScheduleData } = await import(p1);
const { AcademicHybridRouter, bridgeCanonicalToLegacyItem, evaluateExtractionQuality } = await import(p2);

// Ground Truth
const groundTruth = JSON.parse(fs.readFileSync('datasets/test_set/ground_truth.json', 'utf8'));
groundTruth["Jadwal_Kuliah_Arsitektur.pdf"] = {
  documentType: "class_schedule",
  totalItems: 8,
  items: [
    { namaMatkul: "Struktur & Konstruksi Bangunan 2", hari: "Senin", waktuMulai: "08:00", waktuSelesai: "10:30", lokasi: "R. G301", kodeMatkul: "ARS-301", sks: 3 },
    { namaMatkul: "Sejarah & Teori Arsitektur 2", hari: "Senin", waktuMulai: "13:00", waktuSelesai: "15:30", lokasi: "R. G302", kodeMatkul: "ARS-303", sks: 3 },
    { namaMatkul: "Studio Perancangan Arsitektur 3", hari: "Selasa", waktuMulai: "08:00", waktuSelesai: "13:00", lokasi: "Studio A", kodeMatkul: "ARS-305", sks: 6 },
    { namaMatkul: "Fisika Bangunan", hari: "Rabu", waktuMulai: "09:00", waktuSelesai: "11:30", lokasi: "R. G205", kodeMatkul: "ARS-307", sks: 3 },
    { namaMatkul: "Utilitas Bangunan", hari: "Rabu", waktuMulai: "13:00", waktuSelesai: "14:40", lokasi: "R. G205", kodeMatkul: "ARS-309", sks: 2 },
    { namaMatkul: "Aplikasi Komputer Arsitektur", hari: "Kamis", waktuMulai: "08:00", waktuSelesai: "10:30", lokasi: "Lab. Komputer", kodeMatkul: "ARS-311", sks: 3 },
    { namaMatkul: "Pendidikan Kewarganegaraan", hari: "Kamis", waktuMulai: "13:00", waktuSelesai: "14:40", lokasi: "R. MKU101", kodeMatkul: "MKU-104", sks: 2 },
    { namaMatkul: "Material Arsitektur", hari: "Jumat", waktuMulai: "08:00", waktuSelesai: "09:40", lokasi: "R. G301", kodeMatkul: "ARS-313", sks: 2 }
  ]
};

function normalizeStr(s) {
  if (!s) return "";
  return String(s).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function evaluate(extracted, gtList) {
  if (gtList.length === 0) {
    const isClean = extracted.length === 0;
    return {
      precision: isClean ? 100 : 0,
      recall: isClean ? 100 : 0,
      f1: isClean ? 100 : 0,
      fieldAcc: isClean ? 100 : 0,
      rowAcc: isClean ? 100 : 0,
      matched: 0,
      total: 0,
      extracted: extracted.length
    };
  }

  let matched = [];
  let unmatchedGt = gtList.slice();
  let falseRows = 0;

  for (const ext of extracted) {
    let foundIdx = -1;
    for (let i = 0; i < unmatchedGt.length; i++) {
      const g = unmatchedGt[i];
      const ne = normalizeStr(ext.namaMatkul);
      const ng = normalizeStr(g.namaMatkul);
      const ke = normalizeStr(ext.kodeMatkul);
      const kg = normalizeStr(g.kodeMatkul);
      if ((ke && kg && ke === kg) || (ne && ng && (ne.includes(ng) || ng.includes(ne)))) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx >= 0) {
      matched.push({ ext, gt: unmatchedGt[foundIdx] });
      unmatchedGt.splice(foundIdx, 1);
    } else {
      falseRows++;
    }
  }

  let correctFields = 0;
  let totalFields = gtList.length * 7;
  let completeRows = 0;

  for (const pair of matched) {
    let rowOk = true;
    const e = pair.ext;
    const g = pair.gt;

    // namaMatkul
    if (normalizeStr(e.namaMatkul) === normalizeStr(g.namaMatkul)) correctFields++; else rowOk = false;
    // hari
    if (normalizeStr(e.hari) === normalizeStr(g.hari)) correctFields++; else rowOk = false;
    // waktuMulai
    if ((e.waktuMulai || "").replace(".", ":") === (g.waktuMulai || "").replace(".", ":")) correctFields++; else rowOk = false;
    // waktuSelesai
    if ((e.waktuSelesai || "").replace(".", ":") === (g.waktuSelesai || "").replace(".", ":")) correctFields++; else rowOk = false;
    // lokasi
    const le = normalizeStr(e.lokasi);
    const lg = normalizeStr(g.lokasi);
    if ((le && lg && (le.includes(lg) || lg.includes(le))) || (!le && !lg)) correctFields++; else rowOk = false;
    // kodeMatkul
    const kde = normalizeStr(e.kodeMatkul);
    const kdg = normalizeStr(g.kodeMatkul);
    if ((kde && kdg && kde === kdg) || (!kde && !kdg)) correctFields++; else rowOk = false;
    // sks
    if (e.sks === g.sks) correctFields++; else rowOk = false;

    if (rowOk) completeRows++;
  }

  const tp = matched.length;
  const fp = falseRows;
  const fn = unmatchedGt.length;
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision: Math.round(precision * 10) / 10,
    recall: Math.round(recall * 10) / 10,
    f1: Math.round(f1 * 10) / 10,
    fieldAcc: Math.round((correctFields / totalFields) * 1000) / 10,
    rowAcc: Math.round((completeRows / gtList.length) * 1000) / 10,
    matched: tp,
    total: gtList.length,
    extracted: extracted.length
  };
}

async function run() {
  const docs = [
    { path: 'datasets/test_set/digital_schedule.pdf', id: 'digital_schedule.pdf' },
    { path: 'C:/Users/Budy/Downloads/Jadwal_Kuliah_Arsitektur.pdf', id: 'Jadwal_Kuliah_Arsitektur.pdf' },
    { path: 'datasets/test_set/scanned_schedule.pdf', id: 'scanned_schedule.pdf' },
  ];

  console.log('='.repeat(80));
  console.log('TYPESCRIPT EXTRACTION PIPELINES BENCHMARK');
  console.log('='.repeat(80));

  for (const doc of docs) {
    if (!fs.existsSync(doc.path)) continue;
    const buf = fs.readFileSync(doc.path);
    const gt = groundTruth[doc.id].items || groundTruth[doc.id].with_ocr?.items || [];

    console.log(`\nDocument: ${doc.id}`);

    // TS Legacy recognizeScheduleData
    const t0 = performance.now();
    let text = "";
    try {
      text = await extractTextFromPdf(buf);
    } catch {}
    const rec = recognizeScheduleData({ text, words: [] }, [], []);
    const dur1 = Math.round((performance.now() - t0) * 100) / 100;
    const ev1 = evaluate(rec.items, gt);

    // TS AcademicHybridRouter
    const t1 = performance.now();
    const router = new AcademicHybridRouter();
    let hybridRes = { items: [] };
    try {
      const h = await router.routeAndExtract({
        buffer: buf,
        mimeType: doc.id.endsWith('.pdf') ? 'application/pdf' : 'image/png',
        fileName: doc.id,
        preExtractedText: text
      });
      hybridRes = h.result;
    } catch (e) {
      console.error(e);
    }
    const dur2 = Math.round((performance.now() - t1) * 100) / 100;
    const ev2 = evaluate(hybridRes.items.map(bridgeCanonicalToLegacyItem), gt);

    console.log(`TS Legacy Parser:          F1: ${ev1.f1}% | Field Acc: ${ev1.fieldAcc}% | Row Acc: ${ev1.rowAcc}% | Rows: ${ev1.matched}/${ev1.total} (Extracted: ${ev1.extracted}) | Duration: ${dur1}ms`);
    console.log(`TS Hybrid Router:          F1: ${ev2.f1}% | Field Acc: ${ev2.fieldAcc}% | Row Acc: ${ev2.rowAcc}% | Rows: ${ev2.matched}/${ev2.total} (Extracted: ${ev2.extracted}) | Duration: ${dur2}ms`);
  }
}

run();


import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const req = createRequire(import.meta.url);
const { PrismaClient } = req('@prisma/client');

function loadEnvFile(relPath) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eqIdx = line.indexOf('=');
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('--- READ-ONLY CONNECTION CHECK ---');
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('STATUS: SUCCESSFUL');
    console.log('Result payload:', JSON.stringify(result));
  } catch (error) {
    console.log('STATUS: FAILED');
    console.log('Prisma Error Code:', error.code || 'NO_CODE');
    console.log('Error Name:', error.name || 'Error');
    if (error.message) {
      const lines = error.message.split('\n').filter(l => l.trim().length > 0);
      console.log('Sanitized error lines:', lines.slice(0, 3).map(l => l.replace(/:\/\/.*@/, '://<credentials-hidden>@')));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

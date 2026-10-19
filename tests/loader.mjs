import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }

  if (specifier.startsWith('@/')) {
    const rawPath = path.resolve(process.cwd(), specifier.slice(2));
    const target = resolveFileExtension(rawPath);
    return nextResolve(pathToFileURL(target).href, context);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    let parentDir = process.cwd();
    if (context.parentURL) {
      try {
        parentDir = path.dirname(fileURLToPath(context.parentURL));
      } catch {
        // fallback
      }
    }
    const rawPath = path.resolve(parentDir, specifier);
    const target = resolveFileExtension(rawPath);
    if (target && target !== rawPath) {
      return nextResolve(pathToFileURL(target).href, context);
    }
  }

  return nextResolve(specifier, context);
}

function resolveFileExtension(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) return basePath;
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return basePath;
}


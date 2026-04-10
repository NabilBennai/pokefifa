import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBaseUrl =
  process.env.APP_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000';
const outputDir = resolve(process.cwd(), 'public');
const outputFile = resolve(outputDir, 'runtime-config.js');

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, `window.__APP_CONFIG__ = ${JSON.stringify({ apiBaseUrl })};\n`, 'utf8');

console.log(`[runtime-config] apiBaseUrl=${apiBaseUrl}`);

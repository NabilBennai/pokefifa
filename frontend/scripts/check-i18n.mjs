import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const APP_DIR = resolve(ROOT, 'src', 'app');
const I18N_DIR = resolve(ROOT, 'public', 'i18n');
const LOCALES = ['en', 'fr', 'es'];

function walk(dir, extension, out = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, extension, out);
    } else if (fullPath.endsWith(extension)) {
      out.push(fullPath);
    }
  }
  return out;
}

function loadLocale(locale) {
  const file = resolve(I18N_DIR, `${locale}.json`);
  const raw = readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${locale}.json must contain a JSON object`);
  }
  return parsed;
}

function checkLocaleKeys() {
  const dictionaries = Object.fromEntries(LOCALES.map((locale) => [locale, loadLocale(locale)]));
  const baseKeys = new Set(Object.keys(dictionaries.en));
  const issues = [];

  for (const locale of LOCALES) {
    const keys = new Set(Object.keys(dictionaries[locale]));

    for (const key of baseKeys) {
      if (!keys.has(key)) {
        issues.push(`[i18n] Missing key in ${locale}.json: ${key}`);
      }
    }

    for (const key of keys) {
      if (!baseKeys.has(key)) {
        issues.push(`[i18n] Extra key in ${locale}.json not present in en.json: ${key}`);
      }
      const value = dictionaries[locale][key];
      if (typeof value !== 'string') {
        issues.push(`[i18n] Non-string value in ${locale}.json for key: ${key}`);
      }
    }
  }

  return issues;
}

function stripIgnoredBlocks(html) {
  return html
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function checkHardcodedHtmlText() {
  const files = walk(APP_DIR, '.html');
  const issues = [];
  const textNodeRegex = />\s*([^<{][^<{]*[A-Za-z�-�][^<{]*)\s*</g;

  for (const file of files) {
    const html = stripIgnoredBlocks(readFileSync(file, 'utf8'));
    for (const match of html.matchAll(textNodeRegex)) {
      const text = match[1].replace(/\s+/g, ' ').trim();
      if (!text) {
        continue;
      }
      issues.push(`[i18n] Hardcoded template text in ${file.replace(ROOT + '\\', '')}: "${text}"`);
    }
  }

  return issues;
}

try {
  const issues = [...checkLocaleKeys(), ...checkHardcodedHtmlText()];
  if (issues.length > 0) {
    console.error(issues.join('\n'));
    process.exit(1);
  }
  console.log('[i18n] OK: locale JSON keys are aligned and templates have no hardcoded text.');
} catch (error) {
  console.error(`[i18n] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

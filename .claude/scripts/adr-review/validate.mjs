#!/usr/bin/env node
/**
 * ADR Review Schema Validator
 *
 * Scans docs/adr/reviews/*.md, validates frontmatter against Layer 0 schema.
 * Exit 0 if all valid, 1 if any invalid.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const REVIEWS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/adr/reviews',
);

const VALID_SEVERITY = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const VALID_CATEGORY = [
  'evidence-missing',
  'generator-extension-gap',
  'migration-cost-unquantified',
  'phase-split-late',
  'ssot-violation',
  'alternative-strawman',
  'risk-4axis-incomplete',
  'adr-structure-violation',
  'correctness', // phase 구현 판독 — 구현이 Decision · Gate 와 어긋남 (2026-10-08, ADR-256 R4·5)
  'other',
];
const VALID_OUTCOME = ['fixed', 'deferred', 'rejected', 'pending'];

export function validateFile(filePath) {
  const errors = [];
  const raw = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = matter(raw).data;
  } catch (err) {
    return [`malformed frontmatter: ${err.message}`];
  }
  if (data.adr === undefined || data.adr === null) errors.push('missing adr');
  if (!Array.isArray(data.reviews)) {
    errors.push('reviews not array');
    return errors;
  }
  for (const [i, r] of data.reviews.entries()) {
    if (r.round === undefined) errors.push(`reviews[${i}].round missing`);
    if (!r.ts) errors.push(`reviews[${i}].ts missing`);
    if (!Array.isArray(r.issues)) {
      errors.push(`reviews[${i}].issues not array`);
      continue;
    }
    for (const [j, is] of r.issues.entries()) {
      const prefix = `reviews[${i}].issues[${j}]`;
      if (!is.severity) errors.push(`${prefix}.severity missing`);
      else if (!VALID_SEVERITY.includes(is.severity)) {
        errors.push(`${prefix}.severity invalid: ${is.severity}`);
      }
      if (!is.category) errors.push(`${prefix}.category missing`);
      else if (!VALID_CATEGORY.includes(is.category)) {
        errors.push(`${prefix}.category invalid: ${is.category}`);
      }
      if (!is.summary) errors.push(`${prefix}.summary missing`);
      if (is.outcome && !VALID_OUTCOME.includes(is.outcome)) {
        errors.push(`${prefix}.outcome invalid: ${is.outcome}`);
      }
    }
  }
  return errors;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(REVIEWS_DIR)) {
    console.error(`No reviews directory: ${REVIEWS_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(REVIEWS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md');

  let failed = 0;
  for (const f of files) {
    const errors = validateFile(resolve(REVIEWS_DIR, f));
    if (errors.length) {
      failed += 1;
      console.error(`[FAIL] ${f}`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.log(`[PASS] ${f}`);
    }
  }
  if (failed) {
    console.error(`\n${failed}/${files.length} files failed validation`);
    process.exit(1);
  }
  console.log(`\n${files.length}/${files.length} files passed`);
  process.exit(0);
}

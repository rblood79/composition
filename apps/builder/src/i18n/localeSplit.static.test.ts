/**
 * One chunk per language (사용자 결정 2026-10-29 「언어별로 분리」) — the gate.
 *
 * App code reaches messages only through `loadMessages.ts` (dynamic import per locale). Importing
 * a locale module or the eager two-locale `translations.ts` from app code would put that language
 * (or both) back in the initial bundle — silently, since everything still works.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");
const ALLOWED = new Set(["i18n/loadMessages.ts", "i18n/translations.ts"]);
const isTestFile = (rel: string) =>
  /(\.test\.tsx?$|__tests__\/|\/test\/|\/support\/)/.test(rel);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const EAGER_IMPORT =
  /(?:import|export)[^;]*?from\s+["'][^"']*i18n\/(?:translations|messages\/(?:ko-KR|en-US))["']|(?:import|export)[^;]*?from\s+["']\.\/(?:translations|messages\/(?:ko-KR|en-US))["']/;

describe("locale split — app code loads messages per locale", () => {
  it("no app module imports a locale module or the two-locale tables", () => {
    const offenders = walk(SRC)
      .map((file) => relative(SRC, file))
      .filter((rel) => !isTestFile(rel) && !ALLOWED.has(rel))
      .filter((rel) => {
        const text = readFileSync(join(SRC, rel), "utf8");
        // `./messages/<locale>` is only meaningful inside i18n/ (relative paths elsewhere differ).
        return EAGER_IMPORT.test(text);
      });
    expect(offenders).toEqual([]);
  });

  it("the loader imports each locale dynamically (not statically)", () => {
    const loader = readFileSync(join(SRC, "i18n/loadMessages.ts"), "utf8");
    expect(loader).toContain('import("./messages/ko-KR")');
    expect(loader).toContain('import("./messages/en-US")');
    expect(loader).not.toMatch(/^import\s+\w+\s+from\s+"\.\/messages\//m);
  });
});

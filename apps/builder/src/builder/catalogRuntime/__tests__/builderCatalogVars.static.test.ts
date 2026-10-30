/**
 * ADR-295 Decision 9 게이트 — 빌더 root 의 사용자 컴포넌트 치수 토큰 (`--catalog-token-*`).
 *
 * 생성 시트는 치수를 `--catalog-token-*` 로 읽고 빌더도 그 시트를 싣는다 (Data RowForm 의 ComboBox ·
 * CompactSelect · PropertySelect …). 빌더 위젯은 chrome 이라 S2 값 · 터치 scale 을 받지 않는다 (Decision 8):
 *   (a) 빌더가 싣는 생성 시트가 읽는 `--catalog-token-*` 는 전부 `builder-catalog-vars.css` 가 선언한다 (폴백
 *       없이 빈 값이 되지 않게).
 *   (b) 그 시트에 미디어 쿼리가 없다 (pointer: coarse 에서도 빌더 위젯은 desktop 값).
 *   (c) 그 값으로 푼 생성 시트의 모든 치수 == Phase 0 에서 뜬 295 전 기준 JSON (oracle 은 이름을 바꾸기 전
 *       시트를 chrome 토큰으로 푼 값 — 이 시트의 값과 독립).
 * 그리고 생성 시트에는 chrome 토큰 이름 (`var(--radius-*)` · `var(--text-*)`) 이 남지 않는다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILDER_CATALOG_VARS_CSS,
  BUILDER_COMPONENTS_CSS,
  THEME_CSS,
  resolveBuilderGeneratedSheets,
} from "../../../../scripts/adr295BuilderGeneratedSheets.mjs";
import baseline from "./fixtures/adr295-builder-consumed-generated-baseline.json";

const sheetsDir = BUILDER_COMPONENTS_CSS.replace(
  /builder-components\.css$/,
  "",
);
const builderSheets = baseline.sheets.map((rel) =>
  readFileSync(`${sheetsDir}${rel}`, "utf8"),
);
const varsCss = readFileSync(BUILDER_CATALOG_VARS_CSS, "utf8");

describe("ADR-295 Decision 9 — builder-catalog-vars.css", () => {
  it("(a) 빌더가 싣는 생성 시트의 --catalog-token-* 는 전부 선언돼 있다", () => {
    const declared = new Set(
      [...varsCss.matchAll(/(--catalog-token-[\w-]+)\s*:/g)].map((m) => m[1]),
    );
    const read = new Set(
      builderSheets.flatMap((css) =>
        [...css.matchAll(/var\((--catalog-token-[\w-]+)/g)].map((m) => m[1]!),
      ),
    );
    expect(read.size).toBeGreaterThan(10);
    expect([...read].filter((name) => !declared.has(name))).toEqual([]);
  });

  it("(b) 빌더 고정 시트에 미디어 쿼리가 없다 (desktop 한 벌)", () => {
    const rules = varsCss.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toMatch(/@media|pointer\s*:|hover\s*:/);
    // 생성 시트보다 앞에서 싣는다
    const order = readFileSync(BUILDER_COMPONENTS_CSS, "utf8");
    const at = order.indexOf('@import "./builder-catalog-vars.css"');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(order.indexOf('@import "./generated/'));
  });

  it("(c) 빌더 값으로 푼 생성 시트 치수 == 295 전 기준", () => {
    const now = resolveBuilderGeneratedSheets([
      THEME_CSS,
      BUILDER_CATALOG_VARS_CSS,
    ]);
    expect(now.sheets).toEqual(baseline.sheets);
    const changed = Object.entries(baseline.entries as Record<string, string>)
      .filter(([key, value]) => now.entries[key] !== value)
      .map(([key, value]) => `${key}: ${value} → ${now.entries[key]}`);
    expect(changed).toEqual([]);
    expect(
      Object.keys(now.entries).filter((key) => !(key in baseline.entries)),
    ).toEqual([]);
  });

  it("생성 시트는 chrome 토큰 이름을 읽지 않는다", () => {
    for (const [index, css] of builderSheets.entries())
      expect(
        [...css.matchAll(/var\(--(?:radius|text)-[\w-]+/g)].map((m) => m[0]),
        baseline.sheets[index],
      ).toEqual([]);
  });

  it("chrome CSS 는 --catalog-token-* 를 읽지 않는다 (보조 게이트 — 소비 경계는 (a) ~ (c))", () => {
    const repo = resolve(__dirname, "../../../../../..");
    const cssUnder = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
          return ["node_modules", "dist", "generated", "__tests__"].includes(
            entry.name,
          )
            ? []
            : cssUnder(path);
        return entry.name.endsWith(".css") ? [path] : [];
      });
    const chrome = [
      ...cssUnder(join(repo, "apps/builder/src")),
      ...cssUnder(join(repo, "packages/shared/src/components")),
    ].filter((path) => path !== BUILDER_CATALOG_VARS_CSS);
    expect(chrome.length).toBeGreaterThan(50);
    expect(
      chrome
        .filter((path) => /var\(--catalog-token-/.test(readFileSync(path, "utf8")))
        .map((path) => relative(repo, path)),
    ).toEqual([]);
  });
});

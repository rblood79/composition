/**
 * ADR-295 Decision 9 게이트 — 빌더 root 의 사용자 컴포넌트 치수 토큰 (`--catalog-token-*`).
 *
 * 생성 시트는 치수를 `--catalog-token-*` 로 읽고 빌더도 그 시트를 싣는다 (Data RowForm 의 ComboBox ·
 * CompactSelect · PropertySelect …). 빌더 위젯은 chrome 이라 S2 값 · 터치 scale 을 받지 않는다 (Decision 8):
 *   (a) 빌더가 싣는 생성 시트가 읽는 `--catalog-token-*` 는 전부 `builder-catalog-vars.css` 가 선언한다 (폴백
 *       없이 빈 값이 되지 않게).
 *   (b) 그 시트에 미디어 쿼리가 없다 (pointer: coarse 에서도 빌더 위젯은 desktop 값).
 *   (c) 그 값으로 푼 생성 시트의 모든 치수 == Phase 0 에서 뜬 295 전 기준 JSON (oracle 은 이름을 바꾸기 전
 *       시트를 chrome 토큰으로 푼 값 — 이 시트의 값과 독립). 생성 시트에서 사라진 선언 (S2 에 없는 값) 은
 *       `builder-catalog-pins.css` 가 같은 선택자로 유지한다 (Phase 3c-2).
 *   (d) 그 고정 시트는 생성 시트가 지금 주지 않는 값만 담는다 (낡은 고정 금지) · 미디어 쿼리 · 토큰 0.
 * 그리고 생성 시트에는 chrome 토큰 이름 (`var(--radius-*)` · `var(--text-*)`) 이 남지 않는다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILDER_CATALOG_PINS_CSS,
  BUILDER_CATALOG_VARS_CSS,
  BUILDER_COMPONENTS_CSS,
  THEME_CSS,
  effectiveEntries,
  normalizedEntries,
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

  it("(b2) 같은 탭의 `/publish` 경로 (`.publish-app`) 에는 빌더 값을 싣지 않는다", () => {
    // 헤더 Preview 버튼의 `/publish` 는 빌더 번들이라 이 시트도 실린다. resolver 가 내지 않는 빌더 전용 변수
    //   (`--catalog-token-input-padding-x-*` · 아이콘 · gap …) 가 사용자 컴포넌트에 새면 생성 시트의 S2 식
    //   (fallback) 대신 chrome 값이 된다 (Phase 4 G5: Publish Input 여백 12 vs Preview 터치 15).
    const rules = varsCss
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .matchAll(/([^{}]+)\{([^{}]*)\}/g);
    const selectors = [...rules]
      .filter(([, , body]) => /--catalog-token-/.test(body!))
      .map(([, selector]) => selector!.trim());
    expect(selectors.length).toBeGreaterThan(0);
    expect(
      selectors.filter(
        (selector) => selector !== ":root:not(:has(.publish-app))",
      ),
    ).toEqual([]);
  });

  it("(c) 빌더 값으로 푼 생성 시트 치수 == 295 전 기준", () => {
    const now = resolveBuilderGeneratedSheets(
      [THEME_CSS, BUILDER_CATALOG_VARS_CSS],
      [BUILDER_CATALOG_PINS_CSS],
    );
    expect(now.sheets).toEqual(baseline.sheets);
    // 값은 계산값으로 비교한다 — S2 padding 식 (`calc(높이 − 글자 × 행간 − 테두리 × 2) / 2`) 과 행간 토큰
    //   비율이 빌더 값에서 295 전 px 와 같으면 같다 (ADR-295 Phase 3).
    //   (3c-3b: 크기별 실효 값 — 지역 변수를 크기 블록 값으로 풀고 단축형을 네 변으로 펼쳐, 이름을 바꾼 선언 · 변수도
    //   빌더가 받는 값으로 비교한다.)
    const before = normalizedEntries(
      effectiveEntries(baseline.entries as Record<string, string>),
    );
    const after = normalizedEntries(effectiveEntries(now.entries));
    const changed = Object.entries(before)
      .filter(([key, value]) => after[key] !== value)
      .map(([key, value]) => `${key}: ${value} → ${after[key]}`);
    expect(changed).toEqual([]);
    // 새 선언은 빌더에서 효과가 없어야 한다 — 속성의 초기값으로 고정 (`builder-catalog-pins.css`) 하거나 빌더 값으로
    //   풀었을 때 초기값이다. `min-height` 도 같다 (Phase 4 G5): 처음에는 「control 상자의 `{size.height.<S>}` = 빌더
    //   control 높이 = 295 전 한 줄 높이」 라 효과가 없다고 봤지만, 빌더 chrome CSS 가 글자 · 여백을 줄인 위젯
    //   (Design 패널 Input 18 · NumberField 16 · ToggleButton 20) 은 그보다 작아 min-height 30 이 상자를 키웠다.
    const inert = (value: string) => value === "auto";
    const added = Object.keys(after).filter((key) => !(key in before));
    // (a sheet-local variable carrying the minimum — every declaration of it is inert)
    const inertLocal = new Set(
      added
        .map((key) => key.split(" | ")[1]!)
        .filter(
          (prop) =>
            prop.startsWith("--") &&
            added
              .filter((key) => key.endsWith(` | ${prop}`))
              .every((key) => inert(after[key]!)),
        ),
    );
    // (A new min · max width the builder pins to the property's initial value is inert too — Meter's
    //   S2 `bar()` widths, Phase 3c-2b, `builder-catalog-pins.css`.)
    //   (3c-3b: a field button's new start margin — S2 `text-to-control` — is 0 in the builder.)
    const INITIAL: Record<string, string> = {
      "min-width": "auto",
      "max-width": "none",
      "min-height": "auto",
      "margin-left": "0",
      // (3c-3c ②c: the Slider track row's new margins — S2 `track` 24 · 32 · 40 · 48 around the 4px bar — are 0 in
      //   the builder.)
      "margin-top": "0",
      "margin-bottom": "0",
    };
    // (Phase 3c-3: the Select trigger's new start padding — S2 Picker `edge-to-text` — is 0 in the builder, the
    //   value its own Select triggers take from the builder-system layer: `form-controls.css` `padding: 0`, a
    //   later layer than `components`.)
    const BUILDER_LAYER_ZERO = new Set([
      "generated/Select.css › @layer components › .react-aria-Select .react-aria-Button | padding-left",
    ]);
    /** (per-size effective keys: `<block> @S | prop` → `<block> | prop`) */
    const unsized = (key: string) => key.replace(/ @\w+ \| /, " | ");
    expect(
      added.filter((key) => {
        const prop = key.split(" | ")[1]!;
        if (prop.startsWith("--")) return !inertLocal.has(prop);
        const local = /^var\((--[\w-]+)\)$/.exec(after[key]!)?.[1];
        if (local && inertLocal.has(local)) return false;
        if (INITIAL[prop] !== undefined) return after[key] !== INITIAL[prop];
        if (BUILDER_LAYER_ZERO.has(unsized(key))) return after[key] !== "0";
        return true;
      }),
    ).toEqual([]);
  });

  it("(d) 고정 시트는 생성 시트가 주지 않는 값만 — 미디어 쿼리 · 토큰 0, 생성 시트 뒤", () => {
    const { pins, entries } = resolveBuilderGeneratedSheets(
      [THEME_CSS, BUILDER_CATALOG_VARS_CSS],
      [BUILDER_CATALOG_PINS_CSS],
    );
    expect(Object.keys(pins).length).toBeGreaterThan(0);
    // 생성 시트만으로 같은 값이면 고정이 낡았다 (S2 정렬이 되돌아갔거나 고정할 필요가 없어졌다).
    expect(
      Object.entries(pins)
        .filter(([key, generated]) => generated === entries[key])
        .map(([key]) => key),
    ).toEqual([]);
    const css = readFileSync(BUILDER_CATALOG_PINS_CSS, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(css).not.toMatch(/@media|var\(/);
    // 같은 탭의 `/publish` 경로 (Preview 버튼) 는 빌더 번들의 시트를 같이 싣는다 — 사용자 컴포넌트는 뺀다.
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      // (a long selector may be wrapped by the formatter)
      .map((m) =>
        m[1]!
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\(\s+/g, "(")
          .replace(/\s+\)/g, ")"),
      )
      .filter((selector) => !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    expect(
      selectors.filter(
        (selector) => !selector.endsWith(":not(:where(.publish-app *))"),
      ),
    ).toEqual([]);
    const order = readFileSync(BUILDER_COMPONENTS_CSS, "utf8");
    const at = order.indexOf('@import "./builder-catalog-pins.css"');
    // (`generated/CatalogStates.css` — 작성한 상태 값 — 만 그 뒤)
    const states = order.indexOf('@import "./generated/CatalogStates.css"');
    expect(at).toBeGreaterThan(
      order.lastIndexOf('@import "./generated/', states - 1),
    );
    expect(at).toBeLessThan(states);
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
        .filter((path) =>
          /var\(--catalog-token-/.test(readFileSync(path, "utf8")),
        )
        .map((path) => relative(repo, path)),
    ).toEqual([]);
  });
});

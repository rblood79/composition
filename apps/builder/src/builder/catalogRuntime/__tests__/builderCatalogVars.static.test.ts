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
import recordedBaseline from "./fixtures/adr295-builder-consumed-generated-baseline.json";

// Accordion 리네임은 기준 치수를 바꾸지 않는다. 동결된 oracle의 파일명·선택자만 대응시킨다.
const accordionName = (key: string) =>
  key.replaceAll("DisclosureGroup", "Accordion");
const baseline = {
  ...recordedBaseline,
  sheets: recordedBaseline.sheets.map(accordionName),
  entries: Object.fromEntries(
    Object.entries(recordedBaseline.entries).map(([key, value]) => [
      accordionName(key),
      value,
    ]),
  ),
};

// Components added after the 295 baseline was recorded — their sheets join the builder's.
const COMPONENTS_ADDED_SINCE = [
  "ActionButton",
  "ActionButtonGroup",
  "ActionBar",
  "LinkButton",
  "LabeledValue",
  "RangeSlider",
  "SegmentedControl",
  "SegmentedControlItem",
  "SelectBoxGroup",
  "SelectBox",
];

// (2026-11-09) The 295-before blocks — a pin may keep a declaration whose whole block left the generated
//   sheet (`resolveBuilderGeneratedSheets` `retiredBlocks`).
const retiredBlocks = new Map(
  Object.keys(baseline.entries).map((key) => {
    const [rel, ...rest] = key.split(" | ")[0]!.split(" › ");
    return [rest.join(" › "), rel!] as const;
  }),
);

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
      retiredBlocks,
    );
    // Every recorded sheet stays; the sheets added since are the components added since (8586c64bd ·
    //   8ac17dc12 · bbca53c78 — no 295-before value to compare: their declarations go through the
    //   `added` check below like any new declaration).
    expect(
      baseline.sheets.filter((sheet) => !now.sheets.includes(sheet)),
    ).toEqual([]);
    expect(
      now.sheets.filter((sheet) => !baseline.sheets.includes(sheet)),
    ).toEqual(COMPONENTS_ADDED_SINCE.map((name) => `generated/${name}.css`));
    // 값은 계산값으로 비교한다 — S2 padding 식 (`calc(높이 − 글자 × 행간 − 테두리 × 2) / 2`) 과 행간 토큰
    //   비율이 빌더 값에서 295 전 px 와 같으면 같다 (ADR-295 Phase 3).
    //   (3c-3b: 크기별 실효 값 — 지역 변수를 크기 블록 값으로 풀고 단축형을 네 변으로 펼쳐, 이름을 바꾼 선언 · 변수도
    //   빌더가 받는 값으로 비교한다.)
    // (ADR-297 Phase 3: the generated state blocks moved inside `:where()` — the same condition, the
    //  component class's specificity. The gate compares values, so the key drops the wrapper.)
    //  The state layer's blocks carry the class twice (0-2-0 — `stateStylesCssFor`), so the key drops the
    //  repeat too, and a list's spacing (`:is([a], [b])` · `:is([a],[b])`).)
    const unwhere = (key: string) => {
      let out = key.replace(/,\s+/g, ",");
      for (;;) {
        const at = out.indexOf(":where(");
        if (at < 0) break;
        let depth = 0;
        let end = at + 6;
        for (; end < out.length; end += 1) {
          if (out[end] === "(") depth += 1;
          else if (out[end] === ")" && --depth === 0) break;
        }
        out = out.slice(0, at) + out.slice(at + 7, end) + out.slice(end + 1);
      }
      return out
        .replace(/(\.react-aria-[\w-]+)\1/g, "$1")
        .replace(/(:is\(\.react-aria-[^)]*\))\1/g, "$1");
    };
    const unwhered = (entries: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(normalizedEntries(effectiveEntries(entries))).map(
          ([key, value]) => [unwhere(key), value],
        ),
      );
    const before = unwhered(baseline.entries as Record<string, string>);
    const after = unwhered(now.entries);
    // (ADR-297 Phase 3: ToggleButton's `--button-*` paint variables left the generated sheet — the
    //  catalog paint is the tree's `:where` blocks — and live on in `ToggleButton.css` for the Builder's
    //  own buttons under the same selectors; `adr297DomPaintParity.browser.test.ts` (Builder bundle)
    //  measures those widgets' computed paint unchanged. Not a dimension of this gate.)
    const movedPaintVariable = (key: string) =>
      key.startsWith("generated/ToggleButton.css ›") &&
      / \| --button-/.test(key);
    // (사용자 결정 2026-11-09: the focus outline's color is the builder token `--focus-ring` now — the width
    //  stays 2px. The 295-before value was the old accent literal.)
    const focusRingToken = (key: string, value: string) =>
      / \| outline$/.test(key) &&
      /^2px solid oklch\(/.test(value) &&
      after[key] === "2px solid var(--focus-ring)";
    // (2026-11-09: 295-before focus outlines the builder never painted, so dropping them changes nothing —
    //  installed RAC 1.22.1 sets no `data-focus-visible` on these field roots (only Select · RadioGroup do),
    //  and the Input outline's `var(--accent-content)` is undefined under the builder's `builder-system`
    //  scope (an invalid declaration). Select · RadioGroup's group ring went with S2 — the focused
    //  control carries the ring: a builder Select's keyboard focus draws the 2px `--focus-ring` on its
    //  Group (live 2026-11-09), a Radio has its own `[data-focus-visible]` ring (`generated/Radio.css`).)
    const NEVER_PAINTED_OR_INNER_RING = new Set([
      ...[
        "TextField",
        "NumberField",
        "SearchField",
        "ComboBox",
        "ColorField",
        "CheckboxGroup",
        "Select",
        "RadioGroup",
      ].flatMap((name) =>
        ["outline", "outline-offset"].map(
          (prop) =>
            `generated/${name}.css › @layer components › .react-aria-${name}[data-focus-visible] | ${prop}`,
        ),
      ),
      ...["outline", "outline-offset"].map(
        (prop) =>
          `generated/Input.css › @layer components › :is(.react-aria-Input,.react-aria-TextArea,.react-aria-FieldBox):is([data-focused],[data-focus-within]) | ${prop}`,
      ),
    ]);
    const changed = Object.entries(before)
      .filter(([key]) => !movedPaintVariable(key))
      .filter(
        ([key]) =>
          !(NEVER_PAINTED_OR_INNER_RING.has(key) && after[key] === undefined),
      )
      .filter(([key, value]) => !focusRingToken(key, value))
      .filter(([key, value]) => after[key] !== value)
      .map(([key, value]) => `${key}: ${value} → ${after[key]}`);
    expect(changed).toEqual([]);
    // 새 선언은 빌더에서 효과가 없어야 한다 — 속성의 초기값으로 고정 (`builder-catalog-pins.css`) 하거나 빌더 값으로
    //   풀었을 때 초기값이다. `min-height` 도 같다 (Phase 4 G5): 처음에는 「control 상자의 `{size.height.<S>}` = 빌더
    //   control 높이 = 295 전 한 줄 높이」 라 효과가 없다고 봤지만, 빌더 chrome CSS 가 글자 · 여백을 줄인 위젯
    //   (Design 패널 Input 18 · NumberField 16 · ToggleButton 20) 은 그보다 작아 min-height 30 이 상자를 키웠다.
    const inert = (value: string) => value === "auto";
    // (2026-11-09) New declarations the builder widgets do not feel — accepted, not pinned:
    //  · the sheets of the components added since — no 295-before look to keep (the builder's own
    //    ActionButton is `builder-action-button` chrome over today's values);
    //  · blocks matching builder widgets, switched off one by one in the live builder (idle · Design panel ·
    //    an open Select list): no box moved;
    //  · blocks no builder widget can match — its SearchFields carry their own class (`builder-search-field`
    //    · `icon-picker-search`), its menus are RAC Popovers without `data-size`, it renders no Disclosure.
    //  A new declaration in any other block still fails.
    const ADDED_SINCE_SHEETS = new Set(
      COMPONENTS_ADDED_SINCE.map((name) => `generated/${name}.css`),
    );
    const BUILDER_INERT_ADDED_BLOCKS = new Set([
      "generated/ToggleButton.css › @layer components › .react-aria-ToggleButton",
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-size="XS"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-size="S"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-size="M"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-size="L"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-size="XL"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-focus-visible][data-static-color="black"]',
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-focus-visible][data-static-color="white"]',
      "generated/ToggleButton.css › @layer components › .react-aria-ToggleButton .react-aria-Text",
      "generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-in-group]",
      "generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-justified]",
      'generated/ToggleButton.css › @layer components › .react-aria-ToggleButton[data-in-group][data-orientation="vertical"]',
      "generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup",
      'generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup[data-size="XS"]',
      'generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup[data-size="S"]',
      'generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup[data-size="M"]',
      'generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup[data-size="L"]',
      'generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup[data-size="XL"]',
      "generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup .react-aria-ToggleButton > span",
      'generated/Select.css › @layer components › .react-aria-Popover[data-trigger="Select"]',
      'generated/Select.css › @layer components › .react-aria-Popover[data-trigger="Select"] .react-aria-ListBox',
      "generated/SearchField.css › @layer components › .react-aria-SearchField .react-aria-Button .react-aria-Icon svg",
      'generated/SearchField.css › @layer components › .react-aria-SearchField[data-empty="true"] .react-aria-Input',
      'generated/SearchField.css › @layer components › .react-aria-SearchField[data-readonly="true"] .react-aria-Input',
      'generated/Menu.css › @layer components › .react-aria-Popover[data-trigger="MenuTrigger"][data-size]',
      'generated/Menu.css › @layer components › .react-aria-Popover[data-trigger="MenuTrigger"][data-size] > .react-aria-Menu',
      'generated/Menu.css › @layer components › .react-aria-Popover[data-trigger="SubmenuTrigger"][data-size]',
      'generated/Menu.css › @layer components › .react-aria-Popover[data-trigger="SubmenuTrigger"][data-size] > .react-aria-Menu',
      'generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-size="XL"]',
      "generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-density=\"compact\"] .react-aria-Button[slot='trigger']",
      "generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-density=\"spacious\"] .react-aria-Button[slot='trigger']",
      "generated/Disclosure.css › @layer components › .react-aria-Disclosure .react-aria-Button[slot='trigger']",
      "generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-size=\"XL\"] .react-aria-Button[slot='trigger']",
      'generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-size="XL"] .react-aria-DisclosurePanel > div',
      "generated/Disclosure.css › @layer components › .react-aria-Disclosure[data-size=\"XL\"] .react-aria-Button[slot='trigger'] .react-aria-Icon svg",
    ]);
    const addedBlock = (key: string) =>
      key.split(" | ")[0]!.replace(/ @\w+$/, "");
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
      // (S2 press, 2026-11-04 — `rule/pressScale.ts`: the builder's ToggleButtonGroup label keeps its old
      //   `scale: 0.9` press, so the new `transform` is pinned to its initial value.)
      transform: "none",
    };
    // (…and that label's old `scale` transition stays with it — a pin, but not a dimension.)
    // (…and the builder's Slider thumb keeps RAC's inline place while dragged — the value RAC writes.)
    const BUILDER_RAC_INLINE: Record<string, string> = {
      "generated/Slider.css › @layer components › .react-aria-Slider .react-aria-SliderThumb[data-dragging] | transform":
        "translate(-50%, -50%)",
    };
    const BUILDER_KEPT_NON_DIMENSION = new Set([
      "generated/ToggleButtonGroup.css › @layer components › .react-aria-ToggleButtonGroup .react-aria-ToggleButton > span | transition",
    ]);
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
        if (BUILDER_KEPT_NON_DIMENSION.has(key)) return false;
        if (ADDED_SINCE_SHEETS.has(key.split(" › ")[0]!)) return false;
        if (BUILDER_INERT_ADDED_BLOCKS.has(addedBlock(key))) return false;
        if (BUILDER_RAC_INLINE[key] !== undefined)
          return after[key] !== BUILDER_RAC_INLINE[key];
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
      retiredBlocks,
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

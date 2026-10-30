/**
 * ADR-295 G4 — D3 값 = S2 1.8.1 설치본 (breakdown Phase 3 · 3b).
 *
 * oracle 은 `fixtures/adr295-s2-oracle.json` — `apps/builder/scripts/adr295-s2-token-extract.mjs` 가 설치본
 * style macro 와 probe 페이지 (Playwright desktop · touch computed) 에서 뽑은 값이다 (손 편집 금지). 저장소
 * 토큰 표 · 상수 · rule 이 그 값과 같아야 한다. S2 를 올려 값이 갈리면 FAIL 이 정상 — 추출기를 다시 돌려
 * fixture 를 바꾸고 G2 를 다시 잰다.
 *
 * (b) 활성 테마 최종 snapshot 의 radius (preset 배율 · 델타 · reset) 는 `resolveThemeSnapshot.test.ts`
 * 「ADR-295 R9」 가 같은 표 (`RADIUS_BASE_PX` = rendering `radius`) 로 검사한다 — 여기서는 그 표가 S2 와 같은지.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  borderWidth,
  parseRuleLengthRef,
  parseRuleLengthTerms,
  radius,
  resolveToken,
  ruleSizeLengthRef,
  S2_BAR_MIN_WIDTH,
  S2_CONTROL_HEIGHT,
  S2_CONTROL_HEIGHT_SM,
  S2_DEVICE,
  S2_FIELD_BUTTON_SIZE,
  S2_FONT_RATIO,
  S2_FONT_SIZE_BASE,
  S2_ICON_SIZE,
  s2FontSize,
  s2LineHeight,
  s2SizeTokens,
  s2TypographyTokens,
  spacing,
  S2_SPACING_SCALE,
  TYPOGRAPHY_STEPS,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { manualBoxRule } from "../../../../../../packages/shared/src/catalog/document/manualBoxRules";
import { CATALOG_SLIDER_THICK_TRACK } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import oracle from "./fixtures/adr295-s2-oracle.json";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;
const rem = (css: string) => Number(/([\d.]+)rem/.exec(css)![1]) * 16;

/** 저장소 글자 이름 → S2 단계 이름 (본문 = ui, 제목 = heading — 사용자 결정 3). */
const FONT_NAME: Readonly<Record<string, string>> = {
  "text-2xs": "ui-xs",
  "text-xs": "ui-sm",
  "text-sm": "ui",
  "text-base": "ui-lg",
  "text-lg": "ui-xl",
  "text-xl": "ui-2xl",
  "text-2xl": "ui-3xl",
  "text-heading-xs": "heading-xs",
  "text-heading-sm": "heading-sm",
  "text-heading-md": "heading",
  "text-heading-lg": "heading-lg",
  "text-heading-xl": "heading-xl",
  "text-heading-2xl": "heading-2xl",
  "text-heading-3xl": "heading-3xl",
};

describe("ADR-295 G4 (a) — 토큰 표 · 상수 = S2 설치본", () => {
  const t = oracle.tokens;

  it("설치본 버전", () => {
    expect(t.s2Version).toBe("1.8.1");
  });

  it("radius: sm · md (S2 default) · lg · xl · full", () => {
    expect({
      sm: radius.sm,
      md: radius.md,
      lg: radius.lg,
      xl: radius.xl,
      full: radius.full,
    }).toEqual({
      sm: t.radius.sm,
      md: t.radius.default,
      lg: t.radius.lg,
      xl: t.radius.xl,
      full: t.radius.full,
    });
  });

  it("border 폭: none 0 · thin 1 · thick 2", () => {
    expect([borderWidth.none, borderWidth.thin, borderWidth.thick]).toEqual([
      t.borderWidth["0"],
      t.borderWidth["1"],
      t.borderWidth["2"],
    ]);
  });

  it("spacing 값은 S2 spacing 단에 있다", () => {
    for (const px of Object.values(spacing)) expect(t.spacing).toContain(px);
  });

  // Phase 3d 판정: `{spacing.*}` (resolveToken · Library Spacing 카드) 와 DOM `--spacing-*` (패널 preset ·
  // 수동 시트) 는 한 표 — 그 전 md 이상이 16 · 24 · 32 · 48 ↔ 12 · 16 · 24 · 32 로 갈려 있었다.
  it("spacing 한 표 — `{spacing.*}` = shared-tokens.css `--spacing-*`", () => {
    const css = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/theme/shared-tokens.css",
      ),
      "utf8",
    );
    const declared = Object.fromEntries(
      [...css.matchAll(/--spacing-([0-9a-z]+):\s*([\d.]+)rem;/g)].map(
        ([, name, value]) => [name, Number(value) * 16],
      ),
    );
    for (const [name, px] of Object.entries(spacing))
      expect([name, declared[name]]).toEqual([name, px]);
    // CSS 에만 있는 이름은 S2 단 밖의 chrome 값 (`3xs` 1px) 뿐이다.
    expect(Object.keys(declared).filter((name) => !(name in spacing))).toEqual([
      "3xs",
    ]);
  });

  it("S2 spacing 단 — rule 리터럴 분류의 고정 값 단 = 설치본 `generateSpacing`", () => {
    expect(S2_SPACING_SCALE).toEqual(t.spacing);
  });

  it("기기 두 벌 (scale · 기본 글자)", () => {
    expect(S2_DEVICE).toEqual({
      desktop: {
        scale: t.scale.desktop.scale,
        fontBase: t.scale.desktop.fontBase,
      },
      touch: { scale: t.scale.touch.scale, fontBase: t.scale.touch.fontBase },
    });
    expect(S2_FONT_SIZE_BASE).toBe(t.scale.desktop.fontBase);
    expect(S2_FONT_RATIO).toBe(t.font.ratio);
  });

  it("글자 단계 · 행간 식 — 두 벌 모두 설치본 표와 같다", () => {
    for (const [name, s2] of Object.entries(FONT_NAME)) {
      const step = TYPOGRAPHY_STEPS[name as keyof typeof TYPOGRAPHY_STEPS];
      const row = t.fontTable[s2 as keyof typeof t.fontTable];
      expect(step, name).toBe(row.step);
      for (const device of ["desktop", "touch"] as const) {
        const fontSize = s2FontSize(step, S2_DEVICE[device].fontBase);
        expect([fontSize, s2LineHeight(fontSize)], `${name} ${device}`).toEqual(
          [row[device].fontSize, row[device].lineHeight],
        );
      }
    }
  });

  it("control 높이 5단 (`controlSize`) — `{size.height.<S>}` 두 벌", () => {
    expect(S2_CONTROL_HEIGHT).toEqual(t.controlSize.md);
    for (const device of ["desktop", "touch"] as const) {
      const map = s2SizeTokens(S2_DEVICE[device].scale);
      for (const size of SIZES)
        expect(map[`height.${size}`]).toBe(
          t.controlSize.md[size] * S2_DEVICE[device].scale,
        );
    }
  });

  it("작은 control · field 버튼 · 막대 최소 폭 — `{size.height-sm | field-button | bar}` 두 벌 (3c-2)", () => {
    expect(S2_CONTROL_HEIGHT_SM).toEqual(t.controlSize.sm);
    // XS 는 S2 에 없다 (S2_FIELD_BUTTON_SIZE 의 머리말 — XS field 여백 3).
    const { XS: _xs, ...fieldButton } = S2_FIELD_BUTTON_SIZE;
    expect(fieldButton).toEqual(t.fieldButton);
    expect(S2_BAR_MIN_WIDTH).toBe(t.barMinWidth);
    for (const device of ["desktop", "touch"] as const) {
      const { scale } = S2_DEVICE[device];
      const map = s2SizeTokens(scale);
      for (const [size, px] of Object.entries(t.controlSize.sm))
        expect(map[`height-sm.${size}`]).toBe(px * scale);
      for (const [size, px] of Object.entries(S2_FIELD_BUTTON_SIZE))
        expect(map[`field-button.${size}`]).toBe(px * scale);
      expect(map["bar.min-width"]).toBe(t.barMinWidth * scale);
    }
  });

  it("아이콘 5단 (`iconStyle`) — `{size.icon.<S>}` 두 벌", () => {
    for (const size of SIZES) {
      expect(S2_ICON_SIZE[size]).toBe(rem(t.iconStyleSize[size][0]!));
      for (const device of ["desktop", "touch"] as const)
        expect(s2SizeTokens(S2_DEVICE[device].scale)[`icon.${size}`]).toBe(
          S2_ICON_SIZE[size] * S2_DEVICE[device].scale,
        );
    }
  });
});

describe("ADR-295 G4 (c) — 컴포넌트 값 = S2 computed", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    { sizes: Record<string, Record<string, unknown>> }
  >;
  const table = oracle.componentTable as unknown as Record<
    string,
    Record<string, Record<"desktop" | "touch", Record<string, number>>>
  >;
  const icons = oracle.iconTable as unknown as Record<
    string,
    Record<string, Record<"desktop" | "touch", { w: number }[]>>
  >;

  it.each([
    "TextField",
    "Select",
    "ComboBox",
    "NumberField",
    "Input",
    "TextArea",
    "ToggleButton",
    "Badge",
  ])("%s: field 모서리 S · M · L · XL = S2 control 모서리", (type) => {
    for (const size of ["S", "M", "L", "XL"])
      expect(rules[type]!.sizes[size]!.borderRadius, `${type} ${size}`).toBe(
        oracle.tokens.controlRadius.default[size as "S"],
      );
  });

  it("TextField · Picker 높이 (두 벌) = `{size.height.<S>}` 의 기기 값", () => {
    for (const family of ["TextField", "Picker", "ComboBox", "Button"])
      for (const [size, devices] of Object.entries(table[family]!))
        for (const device of ["desktop", "touch"] as const)
          expect(devices[device].height, `${family} ${size} ${device}`).toBe(
            s2SizeTokens(S2_DEVICE[device].scale)[`height.${size}`],
          );
  });

  it("Input · Button · Badge 의 minHeight 는 `{size.height.<S>}`", () => {
    for (const type of ["Input", "Button", "Badge"])
      for (const size of ["S", "M", "L", "XL"])
        expect(rules[type]!.sizes[size]!.minHeight).toBe(
          `{size.height.${size}}`,
        );
  });

  /**
   * Phase 3c — S2 control 안 아이콘은 `size: '1lh'` (그 글자의 행간 상자) · DatePicker 달력은 `1em` (글자
   * 크기) 이다. desktop 은 아이콘 단 (14 ~ 22) 과 같은 값이라 3b 의 `{size.icon}` 로도 맞았지만, 터치는 글자
   * 15 · 17 · 19 · 22 의 행간 (18 · 22 · 24 · 26) 이라 × 1.25 (20 · 22.5 · 25 · 27.5) 와 갈렸다.
   */
  it.each([
    ["Button", "ButtonIcon", "1lh"],
    ["ToggleButton", "ToggleButtonIcon", "1lh"],
    ["SearchField", "SearchField", "1lh"],
    ["DatePicker", "DatePicker", "1em"],
  ] as const)("%s 아이콘 = S2 %s 의 svg (두 벌 — %s)", (type, family, form) => {
    for (const [size, devices] of Object.entries(icons[family]!)) {
      const font = /^\{typography\.(text-[\w-]+)\}$/.exec(
        rules[type]!.sizes[size]!.fontSize as string,
      )![1]!;
      expect(rules[type]!.sizes[size]!.iconSize, `${type} ${size}`).toBe(
        form === "1lh"
          ? `{typography.${font}--line-height}`
          : `{typography.${font}}`,
      );
      const step = TYPOGRAPHY_STEPS[font as keyof typeof TYPOGRAPHY_STEPS];
      for (const device of ["desktop", "touch"] as const) {
        const fontSize = s2FontSize(step, S2_DEVICE[device].fontBase);
        expect(
          form === "1lh" ? s2LineHeight(fontSize) : fontSize,
          `${type} ${size} ${device}`,
        ).toBe(devices[device][0]!.w);
      }
      expect(
        resolveToken(rules[type]!.sizes[size]!.iconSize as TokenRef),
        `${type} ${size} installed`,
      ).toBe(devices.desktop[0]!.w);
    }
  });

  it("3c-2b — toggle 표시 상자 (두 벌) · Checkbox 모서리 · Switch track 폭 = S2 computed, 막대 폭 = `bar()`", () => {
    // The rule's indicator forms (size-map token · font × em) under each device's maps = the S2
    //   probe's computed box (`componentTable` — Checkbox box · Radio ring · Switch track).
    for (const [probe, type] of [
      ["Checkbox", "Checkbox"],
      ["RadioGroup", "Radio"],
      ["Switch", "Switch"],
    ] as const)
      for (const size of ["S", "M", "L", "XL"]) {
        const rule = rules[type]!.sizes[size]!;
        const indicator = rule.indicator as {
          boxSize?: string;
          boxRadius?: number;
          trackHeight?: string;
          trackWidthEm?: number;
        };
        const side = (indicator.boxSize ?? indicator.trackHeight)!;
        expect(side, `${type} ${size}`).toBe(`{size.height-sm.${size}}`);
        const font = /^\{typography\.(text-[a-z]+)\}$/.exec(
          rule.fontSize as string,
        )![1]!;
        for (const device of ["desktop", "touch"] as const) {
          const { scale, fontBase } = S2_DEVICE[device];
          const height = s2SizeTokens(scale)[`height-sm.${size}`]!;
          const width = indicator.trackWidthEm
            ? (
                s2TypographyTokens(fontBase) as unknown as Record<
                  string,
                  number
                >
              )[font]! * indicator.trackWidthEm
            : height;
          const s2 = table[probe]![size]![device]!;
          expect(height, `${type} ${size} ${device} height`).toBeCloseTo(
            s2.height!,
            3,
          );
          // (the probe's em width is rounded by the browser — 25.98 for 26)
          expect(
            Math.abs(width - s2.width!),
            `${type} ${size} ${device} width`,
          ).toBeLessThan(0.05);
        }
        if (type === "Checkbox")
          expect(indicator.boxRadius).toBe(
            oracle.tokens.controlRadius.sm[size as "S"],
          );
      }
    for (const type of ["Meter", "ProgressBar"])
      for (const size of Object.values(rules[type]!.sizes)) {
        expect(size.minWidth, type).toBe("{size.bar.min-width}");
        expect(size.maxWidth, type).toBe(oracle.tokens.barMaxWidth);
      }
  });

  it("3c-3 — 여백 · 간격의 형 (두 벌) = S2 computed: `edge-to-text` · `pill` · `text-to-visual` · `text-to-control`, toggle · DateField 글자", () => {
    // A size block's relative form (its length ref — base token × ratio, the touch ratio on the touch set)
    //   under each device's maps, read here from the token tables (not `resolveToken`), = the S2 probe.
    const typography = (fontBase: number) =>
      s2TypographyTokens(fontBase) as unknown as Record<string, number>;
    const formPx = (
      type: string,
      size: string,
      key: string,
      device: "desktop" | "touch",
    ): number => {
      const block = rules[type]!.sizes[size]!;
      const ref = ruleSizeLengthRef(block, key);
      expect(ref, `${type} ${size} ${key} is a form`).toBeDefined();
      const parts = parseRuleLengthRef(ref!)!;
      const { scale, fontBase } = S2_DEVICE[device];
      const name = parts.base.slice(1, -1);
      const base = name.startsWith("size.")
        ? s2SizeTokens(scale)[name.slice("size.".length)]!
        : typography(fontBase)[name.slice("typography.".length)]!;
      const ratio =
        device === "touch" && parts.touch ? parts.touch.ratio : parts.ratio;
      return base * ratio;
    };
    const cases: [
      probe: string,
      type: string,
      key: string,
      s2: string,
      sizes: string[],
    ][] = [
      ["Button", "Button", "paddingX", "paddingInline", ["S", "M", "L", "XL"]],
      ["Button", "Button", "gap", "gap", ["S", "M", "L", "XL"]],
      ["Button", "Button", "iconGap", "gap", ["S", "M", "L", "XL"]],
      ["ActionButton", "ToggleButton", "paddingX", "paddingInline", [...SIZES]],
      ["ActionButton", "ToggleButton", "gap", "gap", [...SIZES]],
      [
        "TextField",
        "Input",
        "paddingX",
        "paddingInline",
        ["S", "M", "L", "XL"],
      ],
      [
        "DateField",
        "DateInput",
        "paddingX",
        "paddingInline",
        ["S", "M", "L", "XL"],
      ],
      ["TagGroup", "Tag", "paddingX", "paddingInline", ["S", "M", "L"]],
      // 3c-3b: S2 Badge = `control({shape: 'default', wrap, icon})` — edge-to-text · text-to-visual.
      ["Badge", "Badge", "paddingX", "paddingInline", ["S", "M", "L", "XL"]],
      ["Badge", "Badge", "gap", "gap", ["S", "M", "L", "XL"]],
      ["Checkbox", "Checkbox", "gap", "rootGap", ["S", "M", "L", "XL"]],
      // (Radio's label gap is S2 `text-to-control` as Checkbox's — the probe's RadioGroup `rootGap` is the
      //   group's label-to-items gap, not the radio's, so it has no row here.)
      ["Switch", "Switch", "gap", "rootGap", ["S", "M", "L", "XL"]],
    ];
    for (const [probe, type, key, s2Key, sizes] of cases)
      for (const size of sizes)
        for (const device of ["desktop", "touch"] as const) {
          const s2 = table[probe]?.[size]?.[device]?.[s2Key];
          if (typeof s2 !== "number") continue;
          // (the probe rounds its computed px to 0.01)
          expect(
            Math.abs(formPx(type, size, key, device) - s2),
            `${type} ${size} ${key} ${device}: S2 ${s2}`,
          ).toBeLessThan(0.02);
        }
    // The desktop number every reader of the table sees is the same form in the installed (desktop) maps.
    expect(rules.Button!.sizes.M!.paddingX).toBe(16);
    expect(rules.Checkbox!.sizes.S!.gap).toBeCloseTo((12 * 10) / 14, 10);
    // Checkbox · Radio · DateField write S2's font one step down (S2 ui-sm · ui · ui-lg · ui-xl).
    for (const [probe, type] of [
      ["Checkbox", "Checkbox"],
      ["RadioGroup", "Radio"],
      ["DateField", "DateField"],
    ] as const)
      for (const size of ["S", "M", "L", "XL"]) {
        const font = /^\{typography\.(text-[a-z]+)\}$/.exec(
          rules[type]!.sizes[size]!.fontSize as string,
        )![1]!;
        for (const device of ["desktop", "touch"] as const)
          expect(
            typography(S2_DEVICE[device].fontBase)[font],
            `${type} ${size} ${device} font`,
          ).toBe(table[probe]![size]![device]!.fontSize);
      }
  });

  it("3c-3b — Select 트리거 시작 여백 = S2 Picker `edge-to-text` (높이 × 3/8, 두 벌)", () => {
    const delegation = (
      COMPONENT_RULES_TABLE as unknown as Record<
        string,
        {
          structure: {
            composition: {
              delegation: {
                prefix?: string;
                variables?: Record<string, Record<string, string>>;
              }[];
            };
          };
        }
      >
    ).Select!.structure.composition.delegation.find(
      (entry) => entry.prefix === "select-btn",
    )!.variables!;
    for (const size of SIZES) {
      const css = delegation[size]!["--select-btn-pad-start"];
      expect(css, size).toBe(
        `calc(var(--catalog-token-size-height-${size}) * 3 / 8)`,
      );
      for (const device of ["desktop", "touch"] as const) {
        const s2 = table.Picker![size]?.[device]?.paddingInline;
        if (s2 === undefined) continue;
        expect(
          Math.abs(
            s2SizeTokens(S2_DEVICE[device].scale)[`height.${size}`]! * (3 / 8) -
              s2,
          ),
          `${size} ${device}: S2 ${s2}`,
        ).toBeLessThan(0.02);
      }
    }
  });

  /**
   * 3c-3b ② — field 안 버튼 · SearchField 글리프의 자리 (S2 설치본 식). delegation 변수의 길이 ref (`{length.…}` — 여러
   * 기준의 합) 를 두 기기 토큰 표로 푼다 (resolveToken 아님). 상자 테두리는 1 (S2 2) — S2 의 안쪽 값과 맞춘다.
   * - ComboBox (`ComboBox.tsx`): FieldGroup `paddingEnd` = 높이 × 3/16 − 2 (probe `paddingInlineEnd`), 버튼 앞
   *   `text-to-control` (10/14 em).
   * - DatePicker (`DatePicker.tsx`): `paddingEnd` S 2 · M 4 · L · XL `space(6)` (고정 px), 버튼 앞 `text-to-control`.
   * - DateRangePicker (`DateRangePicker.tsx`): `paddingStart` `edge-to-text` · `paddingEnd` 4 · 버튼 앞 `text-to-control`.
   * - SearchField (`SearchField.tsx`): `paddingStart` `pill` (probe `paddingInline`) · 글리프 `1lh` + `marginEnd`
   *   `text-to-visual` · 지우기 버튼 = 높이의 정사각형 자리 (`ClearButton.tsx` `width: controlSize()`).
   */
  it("3c-3b — field 버튼 끝 여백 · 버튼 앞 간격 · SearchField 글리프 · 글자 자리 = S2 (두 벌)", () => {
    const delegation = (type: string, prefix: string) =>
      (
        COMPONENT_RULES_TABLE as unknown as Record<
          string,
          {
            structure: {
              composition: {
                delegation: {
                  prefix?: string;
                  variables?: Record<string, Record<string, string>>;
                }[];
              };
            };
          }
        >
      )[type]!.structure.composition.delegation.find(
        (entry) => entry.prefix === prefix,
      )!.variables!;
    const px = (ref: string, device: "desktop" | "touch") => {
      if (/^\d+(?:\.\d+)?px$/.test(ref)) return Number.parseFloat(ref);
      const parsed = parseRuleLengthTerms(ref);
      expect(parsed, ref).toBeDefined();
      const { scale, fontBase } = S2_DEVICE[device];
      const sizes = s2SizeTokens(scale) as Record<string, number>;
      const fonts = s2TypographyTokens(fontBase) as unknown as Record<
        string,
        number
      >;
      return parsed!.terms.reduce((total, term) => {
        const name = term.base.slice(1, -1);
        const base = name.startsWith("size.")
          ? sizes[name.slice("size.".length)]!
          : fonts[name.slice("typography.".length)]!;
        expect(base, name).toBeTypeOf("number");
        const ratio =
          device === "touch" && term.touch ? term.touch.ratio : term.ratio;
        return total + base * ratio;
      }, parsed!.add);
    };
    const font = (size: string, device: "desktop" | "touch") => {
      const name = /^\{typography\.(text-[a-z0-9]+)\}$/.exec(
        rules.Input!.sizes[size]!.fontSize as string,
      )![1]!;
      return (
        s2TypographyTokens(S2_DEVICE[device].fontBase) as unknown as Record<
          string,
          number
        >
      )[name]!;
    };
    const height = (size: string, device: "desktop" | "touch") =>
      s2SizeTokens(S2_DEVICE[device].scale)[`height.${size}`]!;
    const square = (size: string, device: "desktop" | "touch") =>
      s2SizeTokens(S2_DEVICE[device].scale)[`field-button.${size}`]!;
    const BORDER = 1;
    const near = (actual: number, expected: number, at: string) =>
      expect(
        Math.abs(actual - expected),
        `${at}: ${actual} vs ${expected}`,
      ).toBeLessThan(0.02);
    const DATE_PICKER_END = { XS: 2, S: 2, M: 4, L: 6, XL: 6 } as const;
    for (const size of SIZES)
      for (const device of ["desktop", "touch"] as const) {
        const at = `${size} ${device}`;
        const toControl = (font(size, device) * 10) / 14;
        // ComboBox: the button's start margin = −(square + the end inset + border); the input's room = the
        //   end inset + square + text-to-control.
        const combo = delegation("ComboBox", "combo-btn")[size]!;
        const comboInset =
          -px(combo["--combo-btn-offset"]!, device) -
          square(size, device) -
          BORDER;
        near(
          comboInset,
          (height(size, device) * 3) / 16 - 2,
          `ComboBox inset ${at}`,
        );
        const probe = table.ComboBox![size]?.[device]?.paddingInlineEnd;
        if (probe !== undefined)
          near(comboInset, probe, `ComboBox probe ${at}`);
        near(
          px(
            delegation("ComboBox", "combo-input")[size]![
              "--combo-input-pad-end"
            ]!,
            device,
          ),
          comboInset + square(size, device) + toControl,
          `ComboBox room ${at}`,
        );
        // DatePicker: the fixed end table.
        const dp = delegation("DatePicker", "dp-btn")[size]!;
        const dpInset =
          -px(dp["--dp-btn-offset"]!, device) - square(size, device) - BORDER;
        near(dpInset, DATE_PICKER_END[size], `DatePicker inset ${at}`);
        near(
          px(
            delegation("DatePicker", "dp-input")[size]!["--dp-input-pad-end"]!,
            device,
          ),
          dpInset + square(size, device) + toControl,
          `DatePicker room ${at}`,
        );
        // DateRangePicker: the group's start `edge-to-text` · end 4, the button's start margin + the group gap
        //   = text-to-control.
        const drp = delegation("DateRangePicker", "drp-group")[size]!;
        near(
          px(drp["--drp-group-pad-start"]!, device),
          (height(size, device) * 3) / 8,
          `DateRangePicker start ${at}`,
        );
        near(
          px(drp["--drp-group-pad-end"]!, device),
          4,
          `DateRangePicker end ${at}`,
        );
        near(
          px(
            delegation("DateRangePicker", "drp-btn")[size]!["--drp-btn-start"]!,
            device,
          ) +
            spacing[
              /^var\(--spacing-([\w]+)\)$/.exec(
                drp["--drp-group-gap"]!,
              )![1]! as keyof typeof spacing
            ],
          toControl,
          `DateRangePicker button gap ${at}`,
        );
        // SearchField: the glyph at `pill` (inner — its margin is from the outer edge), the text after the glyph
        //   (`1lh`) + text-to-visual, the clear button's square place (the field height) at the end.
        const icon = delegation("SearchField", "sf-icon")[size]!;
        near(
          px(icon["--sf-icon-inset"]!, device) - BORDER,
          height(size, device) / 2,
          `SearchField glyph ${at}`,
        );
        const sfProbe = table.SearchField![size]?.[device]?.paddingInline;
        if (sfProbe !== undefined)
          near(
            px(icon["--sf-icon-inset"]!, device) - BORDER,
            sfProbe,
            `SearchField probe ${at}`,
          );
        const input = delegation("SearchField", "sf-input")[size]!;
        const fontPx = font(size, device);
        near(
          px(icon["--sf-icon-size"]!, device),
          s2LineHeight(fontPx),
          `SearchField glyph size ${at}`,
        );
        near(
          px(input["--sf-input-pad"]!, device),
          height(size, device) / 2 +
            s2LineHeight(fontPx) +
            fontPx * (device === "touch" ? 8 / 17 : 6 / 14),
          `SearchField text start ${at}`,
        );
        near(
          px(input["--sf-input-pad-end"]!, device),
          height(size, device),
          `SearchField text end ${at}`,
        );
      }
  });

  it("3c-2 — field 버튼 · 막대 최소 폭 · 메뉴 항목은 S2 값의 토큰, TextField · SearchField 는 최소 폭 없음", () => {
    const delegation = (type: string, prefix: string) =>
      (
        COMPONENT_RULES_TABLE as unknown as Record<
          string,
          {
            structure?: {
              composition?: {
                delegation?: {
                  prefix?: string;
                  variables?: Record<string, Record<string, string>>;
                }[];
              };
            };
          }
        >
      )[type]!.structure!.composition!.delegation!.find(
        (entry) => entry.prefix === prefix,
      )!.variables!;
    for (const [type, prefix] of [
      ["ComboBox", "combo-btn"],
      ["DatePicker", "dp-btn"],
      ["DateRangePicker", "drp-btn"],
    ] as const)
      for (const size of SIZES)
        expect(delegation(type, prefix)[size]![`--${prefix}-size`]).toBe(
          `var(--catalog-token-size-field-button-${size})`,
        );
    for (const size of Object.values(rules.ProgressBar!.sizes))
      expect(size.minWidth).toBe("{size.bar.min-width}");
    for (const type of ["TextField", "SearchField"])
      for (const size of Object.values(rules[type]!.sizes))
        expect(size.minWidth, type).toBeUndefined();
    // S2 `menuitem` = `control({wrap, icon})` 테두리 없음: (32 − 18) / 2 = 7.
    const item = rules.ListBoxItem!.sizes.M!;
    expect([item.minHeight, item.borderWidth, item.paddingY]).toEqual([
      "{size.height.M}",
      "{border.width.none}",
      ((t) => (t.controlSize.md.M - s2LineHeight(S2_FONT_SIZE_BASE)) / 2)(
        oracle.tokens,
      ),
    ]);
  });
  it("3c-3b ③ — field label ↔ control 간격 = S2 `--field-gap` (두 벌)", () => {
    const px = (ref: string, device: "desktop" | "touch") => {
      const parsed = parseRuleLengthTerms(ref)!;
      expect(parsed, ref).toBeDefined();
      const { scale, fontBase } = S2_DEVICE[device];
      const sizes = s2SizeTokens(scale) as Record<string, number>;
      const fonts = s2TypographyTokens(fontBase) as unknown as Record<
        string,
        number
      >;
      return parsed.terms.reduce((total, term) => {
        const name = term.base.slice(1, -1);
        const base = name.startsWith("size.")
          ? sizes[name.slice("size.".length)]!
          : fonts[name.slice("typography.".length)]!;
        const ratio =
          device === "touch" && term.touch ? term.touch.ratio : term.ratio;
        return total + base * ratio;
      }, parsed.add);
    };
    const fontOf = (block: Record<string, unknown>) =>
      /^\{typography\.(text-[a-z0-9]+)\}$/.exec(block.fontSize as string)![1]!;
    for (const device of ["desktop", "touch"] as const) {
      const { scale, fontBase } = S2_DEVICE[device];
      const height = (size: string) => s2SizeTokens(scale)[`height.${size}`]!;
      const line = (font: string) =>
        (s2TypographyTokens(fontBase) as unknown as Record<string, number>)[
          `${font}--line-height`
        ]!;
      // S2 `field()`: `--field-gap` = centerPadding('var(--field-height)') = (control 높이 − 1lh) / 2 — 라벨의
      // paddingBottom · 도움말의 paddingTop (Field.tsx · style-utils.ts). 1lh = 그 크기의 S2 field 글자
      // (`controlFont` — XS ui-xs … XL ui-xl) 의 행간 — 루트 글자가 한 단 위인 TimeField · ColorField 도.
      const FIELD_FONT: Readonly<Record<string, string>> = {
        XS: "text-2xs",
        S: "text-xs",
        M: "text-sm",
        L: "text-base",
        XL: "text-lg",
      };
      for (const type of [
        "TextField",
        "TextArea",
        "TimeField",
        "DateField",
        "NumberField",
        "Select",
        "ComboBox",
        "DatePicker",
        "DateRangePicker",
        "ColorField",
        "SearchField",
      ])
        for (const [size, block] of Object.entries(rules[type]!.sizes)) {
          const ref = ruleSizeLengthRef(block, "gap");
          expect(ref, `${type}.${size}`).toBeDefined();
          expect(px(ref!, device), `${device} ${type}.${size}`).toBeCloseTo(
            (height(size) - line(FIELD_FONT[size]!)) / 2,
            10,
          );
          // (3c-3c: the field root's own font is the S2 field font too — TimeField · ColorField were one step up.)
          expect(block.fontSize, `${type}.${size} fontSize`).toBe(
            `{typography.${FIELD_FONT[size]}}`,
          );
        }
    }
  });
});

/**
 * 설치본 소스의 크기 표 — `anchor` 뒤 첫 `{ … }` (중첩 없는 칸) 의 `이름: 숫자` 와, anchor 바로 뒤 `default: n`.
 * S2 style macro 의 크기별 숫자 표를 손으로 옮기지 않고 읽는다 (fixture 추출기가 컴포넌트 표는 뽑지 않는다).
 */
function s2SizeTable(
  file: string,
  anchor: RegExp,
): Readonly<Record<string, number>> {
  const source = readFileSync(
    resolve(__dirname, "../../../../node_modules/@react-spectrum/s2/src", file),
    "utf8",
  );
  const at = anchor.exec(source);
  if (!at) throw new Error(`${file}: ${anchor} 없음`);
  const rest = source.slice(at.index + at[0].length);
  const table: Record<string, number> = {};
  const fallback = /^\s*default:\s*(\d+)/.exec(rest);
  const block = /\{([^{}]*)\}/.exec(rest)![1]!;
  for (const [, name, value] of block.matchAll(/(\w+):\s*(\d+)/g))
    table[name!] = Number(value);
  if (fallback) table.default = Number(fallback[1]);
  return table;
}

describe("ADR-295 G4 — 3c-3c ① 컴포넌트 고정 치수 = S2 설치본 표", () => {
  type Rule = {
    sizes: Record<string, Record<string, unknown>>;
    structure?: {
      composition?: {
        sizeSelectors?: Record<string, Record<string, Record<string, string>>>;
      };
    };
  };
  const rules = COMPONENT_RULES_TABLE as unknown as Record<string, Rule>;
  const heights = (type: string, key = "height") =>
    Object.fromEntries(
      Object.entries(rules[type]!.sizes).map(([size, block]) => [
        size,
        block[key],
      ]),
    );

  it("ColorSwatch · ColorSwatchPicker swatch = S2 ColorSwatch (S · M · L)", () => {
    const s2 = s2SizeTable("ColorSwatch.tsx", /size:\s*\{\s*size:\s*/);
    const expected = { S: s2.S, M: s2.M, L: s2.L };
    expect(heights("ColorSwatch")).toEqual(expected);
    expect(heights("ColorSwatchPicker", "iconSize")).toEqual(expected);
  });

  it("ProgressCircle 지름 = S2 (default = M)", () => {
    const s2 = s2SizeTable(
      "ProgressCircle.tsx",
      /const wrapper[\s\S]*?size:\s*\{/,
    );
    expect(heights("ProgressCircle")).toEqual({
      S: s2.S,
      M: s2.default,
      L: s2.L,
    });
  });

  it("Meter · ProgressBar 막대 두께 (`.bar` sizeSelectors · 기본) = S2 trackStyles", () => {
    for (const [type, file] of [
      ["Meter", "Meter.tsx"],
      ["ProgressBar", "ProgressBar.tsx"],
    ] as const) {
      const s2 = s2SizeTable(file, /const trackStyles[\s\S]*?height:\s*\{/);
      const selectors = rules[type]!.structure!.composition!.sizeSelectors!;
      for (const size of ["S", "M", "L", "XL"])
        expect(selectors[size]![".bar"]!.height, `${type}.${size}`).toBe(
          `${s2[size]}px`,
        );
      const base = (
        rules[type]!.structure!.composition as unknown as {
          staticSelectors: Record<string, Record<string, string>>;
        }
      ).staticSelectors[".bar"]!.height;
      expect(base, `${type} 기본`).toBe(`${s2.default}px`);
    }
  });

  it("Slider thumb (indicator.thumbSize · SliderThumb · SliderTrack.thumbSize) = S2 thumb", () => {
    const s2 = s2SizeTable(
      "Slider.tsx",
      /thumbStyle:\s*\{\s*default:\s*\{\s*size:\s*/,
    );
    const expected = { S: s2.S, M: s2.M, L: s2.L, XL: s2.XL };
    expect(
      Object.fromEntries(
        Object.entries(rules.Slider!.sizes).map(([size, block]) => [
          size,
          (block.indicator as { thumbSize: number }).thumbSize,
        ]),
      ),
    ).toEqual(expected);
    expect(heights("SliderThumb")).toEqual(expected);
    expect(heights("SliderTrack", "thumbSize")).toEqual(expected);
  });
});

/** 설치본 소스에서 `pattern` 의 첫 캡처 숫자. */
function s2Value(file: string, pattern: RegExp): number {
  const source = readFileSync(
    resolve(__dirname, "../../../../node_modules/@react-spectrum/s2/src", file),
    "utf8",
  );
  const match = pattern.exec(source);
  if (!match) throw new Error(`${file}: ${pattern} 없음`);
  return Number(match[1]);
}

describe("ADR-295 G4 — 3c-3c ②a 크기 축 없는 S2 고정 치수 (모든 크기에)", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    { sizes: Record<string, Record<string, unknown>> }
  >;
  const every = (type: string, key: string) =>
    Object.values(rules[type]!.sizes).map((block) => block[key]);

  it("Toast 최소 높이 = S2 Toast minHeight (높이는 내용)", () => {
    const s2 = s2Value("Toast.tsx", /borderRadius: 'lg',\s*minHeight: (\d+)/);
    expect(new Set(every("Toast", "minHeight"))).toEqual(new Set([s2]));
    expect(new Set(every("Toast", "height"))).toEqual(new Set([0]));
  });

  it("TreeView 행 = S2 TreeView row height — manualBoxRules TreeItem · Tree.css 행 둘 다", () => {
    const s2 = s2Value(
      "TreeView.tsx",
      /display: 'flex',\s*height: (\d+),\s*width: 'full'/,
    );
    expect(manualBoxRule("TreeItem")!.visual?.minHeight).toBe(s2);
    const sheet = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/Tree.css",
      ),
      "utf8",
    );
    const row =
      /:where\(\.react-aria-Tree\[data-composition-tree\]\) \.react-aria-TreeItem \{[^}]*?min-height: (\d+)px/.exec(
        sheet,
      );
    expect(Number(row![1])).toBe(s2);
  });

  it("Calendar · RangeCalendar 월 블록 간격 = S2 Calendar root gap", () => {
    const s2 = s2Value("Calendar.tsx", /flexDirection: 'column',\s*gap: (\d+)/);
    expect(every("Calendar", "gap")).toEqual([s2]);
    expect(every("RangeCalendar", "gap")).toEqual([s2]);
  });

  it("DropZone 높이 = 내용 (S2 DropZone 에 높이 · 최소 높이 지정 없음)", () => {
    expect(new Set(every("DropZone", "height"))).toEqual(new Set([0]));
  });
});

describe("ADR-295 G4 — 3c-3c ②b-1 control 높이 형 (Tooltip · Menu section header · Breadcrumbs)", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    { sizes: Record<string, Record<string, unknown>> }
  >;
  const source = (file: string) =>
    readFileSync(
      resolve(
        __dirname,
        "../../../../node_modules/@react-spectrum/s2/src",
        file,
      ),
      "utf8",
    );

  it("Tooltip = S2 Tooltip: 최소 높이 24 (control S) · 글자 ui-sm · 좌우 높이 × 3/8 · 위아래 centerPadding (모든 크기)", () => {
    const s2 = source("Tooltip.tsx");
    const minHeight = Number(/minHeight: (\d+),\s*boxSizing/.exec(s2)![1]);
    const font =
      /minHeight: \d+,\s*boxSizing: 'border-box',\s*font: '([\w-]+)'/.exec(
        s2,
      )![1];
    expect(s2).toMatch(
      /paddingX: 'edge-to-text',\s*paddingY: centerPadding\(\)/,
    );
    expect(S2_CONTROL_HEIGHT.S).toBe(minHeight);
    for (const [size, block] of Object.entries(rules.Tooltip!.sizes)) {
      expect(block.minHeight, size).toBe("{size.height.S}");
      expect(FONT_NAME[String(block.fontSize).slice(12, -1)], size).toBe(font);
      expect(
        parseRuleLengthRef(ruleSizeLengthRef(block, "paddingX")!),
        size,
      ).toMatchObject({
        base: "{size.height.S}",
        ratio: 3 / 8,
      });
      expect(block.paddingY, size).toBe((minHeight - 16) / 2);
    }
  });

  it("Menu section header = S2 sectionHeader: 최소 높이 control · 글자 ui bold · centerPadding", () => {
    const s2 = source("Menu.tsx");
    expect(s2).toMatch(
      /minHeight: controlSize\(\),\s*paddingY: centerPadding\(\)/,
    );
    const font =
      /export let sectionHeading = style\(\{\s*font: '([\w-]+)'/.exec(s2)![1];
    for (const [size, block] of Object.entries(rules.Header!.sizes)) {
      expect(block.minHeight, size).toBe(`{size.height.${size}}`);
      expect(FONT_NAME[String(block.fontSize).slice(12, -1)], size).toBe(font);
      expect(block.fontWeight, size).toBe(700);
      const height = S2_CONTROL_HEIGHT[size as keyof typeof S2_CONTROL_HEIGHT];
      expect(block.paddingY, size).toBe((height - 18) / 2);
    }
  });

  it("Breadcrumbs 높이 = S2 항목 `height: controlSize()` (최소 높이 control 토큰)", () => {
    expect(source("Breadcrumbs.tsx")).toMatch(/height: controlSize\(\)/);
    for (const [size, block] of Object.entries(rules.Breadcrumbs!.sizes)) {
      expect(block.minHeight, size).toBe(`{size.height.${size}}`);
      expect(block.height, size).toBe(0);
    }
  });
});

describe("ADR-295 G4 — 3c-3c ②b-2 ColorArea · StatusLight · Tag 간격", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    {
      sizes: Record<string, Record<string, unknown>>;
      structure?: {
        composition?: { containerStyles?: Record<string, string> };
      };
    }
  >;

  it("ColorArea 상자 = S2 `size` 정사각", () => {
    const s2 = s2Value("ColorArea.tsx", /size: (\d+),\s*minSize/);
    const box = rules.ColorArea!.structure!.composition!.containerStyles!;
    expect([box.width, box.height]).toEqual([`${s2}px`, `${s2}px`]);
  });

  it("StatusLight: 점 = S2 light 표 · 행 = controlFont 행간 (점 ↔ 글자 text-to-visual 은 후속)", () => {
    const dots = s2SizeTable(
      "StatusLight.tsx",
      /const light = style[\s\S]*?size:\s*\{\s*size:\s*/,
    );
    for (const [size, block] of Object.entries(rules.StatusLight!.sizes)) {
      expect((block.indicator as { dotSize: number }).dotSize, size).toBe(
        dots[size],
      );
      expect(block.height, size).toBe(
        s2LineHeight(s2FontSize({ S: -1, M: 0, L: 1, XL: 2 }[size]!)),
      );
    }
  });

  it("TagList 간격 = S2 Tag `margin` × 2 (크기 무관)", () => {
    const margin = s2Value("TagGroup.tsx", /\n  margin: (\d+),/);
    expect(
      new Set(Object.values(rules.TagList!.sizes).map((b) => b.gap)),
    ).toEqual(new Set([margin * 2]));
  });
});

describe("ADR-295 G4 — 3c-3c ②c Tab 높이 · TabList 간격 = S2 density", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    {
      sizes: Record<string, Record<string, unknown>>;
      densities?: Record<string, { gap?: number }>;
      structure?: {
        composition?: {
          containerVariants?: Record<
            string,
            Record<string, { styles?: Record<string, string> }>
          >;
        };
      };
    }
  >;

  it("Tab 높이 = S2 `tab` height (compact 32 · regular 48) — density 축, size 는 글자만", () => {
    const s2 = s2SizeTable(
      "Tabs.tsx",
      /gap: 'text-to-visual',\s*height: \{\s*orientation: \{\s*horizontal: \{\s*density: /,
    );
    expect(s2).toEqual({ compact: 32, regular: 48 });
    const variants =
      rules.Tab!.structure!.composition!.containerVariants!.density!;
    for (const [density, height] of Object.entries(s2))
      expect(variants[density]?.styles?.height).toBe(`${height}px`);
    for (const block of Object.values(rules.Tab!.sizes)) {
      expect(block.height).toBe(0);
      expect(block.paddingX).toBe(0);
    }
  });

  it("TabList 간격 = S2 `tablist` gap (compact 24 · regular 32)", () => {
    const s2 = s2SizeTable(
      "Tabs.tsx",
      /const tablist = style\(\{\s*display: 'flex',\s*gap: \{\s*orientation: \{\s*horizontal: \{\s*density: /,
    );
    expect(s2).toEqual({ compact: 24, regular: 32 });
    for (const [density, gap] of Object.entries(s2))
      expect(rules.TabList!.densities![density]?.gap).toBe(gap);
  });
});

describe("ADR-295 G4 — 3c-3c ②c Slider track 행 · 막대 = S2", () => {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<
    string,
    {
      sizes: Record<string, Record<string, unknown>>;
      structure?: {
        composition?: {
          sizeSelectors?: Record<
            string,
            Record<string, Record<string, string>>
          >;
        };
      };
    }
  >;

  it("막대 = S2 `trackStyling` (thin 4 · thick 16), 모든 크기", () => {
    const s2 = s2SizeTable(
      "Slider.tsx",
      /const trackStyling = \{\s*height: \{\s*trackStyle: /,
    );
    expect(s2).toEqual({ thin: 4, thick: 16 });
    for (const block of Object.values(rules.SliderTrack!.sizes))
      expect(block.height).toBe(s2.thin);
    expect(CATALOG_SLIDER_THICK_TRACK.height).toBe(s2.thick);
  });

  it("track 행 = S2 `track` height (24 · 32 · 40 · 48) = 막대 + 위아래 margin", () => {
    const s2 = s2SizeTable(
      "Slider.tsx",
      /export let track = style\(\{[^}]*?height: \{\s*size: /,
    );
    expect(s2).toEqual({ S: 24, M: 32, L: 40, XL: 48 });
    const selectors = rules.Slider!.structure!.composition!.sizeSelectors!;
    for (const [size, row] of Object.entries(s2)) {
      const track = selectors[size]![".react-aria-SliderTrack"]!;
      expect(track["margin-top"]).toBe(track["margin-bottom"]);
      const bar = rules.SliderTrack!.sizes[size]!.height as number;
      expect(bar + 2 * Number.parseFloat(track["margin-top"]!)).toBe(row);
      // (DOM: a press anywhere in the row moves the thumb — the track's row-tall `::before`.)
      const hit = (
        COMPONENT_RULES_TABLE.SliderTrack.structure?.composition as {
          rootSelectors: Record<string, { styles: Record<string, string> }>;
        }
      ).rootSelectors[
        `&:is(.react-aria-Slider *)[data-size="${size}"]::before`
      ];
      expect(hit?.styles.height).toBe(`${row}px`);
    }
  });
});

describe("ADR-295 G4 — 3c-3c ③ MenuItem = S2 menuitem (control 형 · label · description 글자)", () => {
  const source = (file: string) =>
    readFileSync(
      resolve(
        __dirname,
        "../../../../node_modules/@react-spectrum/s2/src",
        file,
      ),
      "utf8",
    );
  const rule = COMPONENT_RULES_TABLE.MenuItem as unknown as {
    sizes: Record<string, Record<string, unknown>>;
    structure: {
      composition: {
        sizeSelectors: Record<string, Record<string, Record<string, string>>>;
      };
    };
  };
  const CONTROL_FONT: Readonly<Record<string, string>> = {
    S: "ui-sm",
    M: "ui",
    L: "ui-lg",
    XL: "ui-xl",
  };
  const fontName = (css: string) =>
    FONT_NAME[/var\(--(text-[\w-]+)\)/.exec(css)![1]!];

  it("항목 = `control({ shape: 'default', icon: true })` — 최소 높이 control · centerPadding · edge-to-text · text-to-visual", () => {
    const menu = source("Menu.tsx");
    expect(menu).toMatch(
      /export let menuitem = style<[\s\S]*?\.\.\.control\(\{shape: 'default', wrap: true, icon: true\}\)/,
    );
    for (const [size, block] of Object.entries(rule.sizes)) {
      const height = S2_CONTROL_HEIGHT[size as keyof typeof S2_CONTROL_HEIGHT];
      expect(block.minHeight, size).toBe(`{size.height.${size}}`);
      expect(FONT_NAME[String(block.fontSize).slice(12, -1)], size).toBe(
        CONTROL_FONT[size],
      );
      expect(block.paddingY, size).toBe(
        (height - (resolveToken(block.lineHeight as TokenRef) as number)) / 2,
      );
      expect(
        parseRuleLengthRef(ruleSizeLengthRef(block, "paddingX")!),
        size,
      ).toMatchObject({ base: `{size.height.${size}}`, ratio: 3 / 8 });
      expect(ruleSizeLengthRef(block, "gap"), size).toBeDefined();
    }
  });

  it("label = controlFont · medium, description = S ui-xs · M ui-sm · L ui · XL ui-lg", () => {
    const menu = source("Menu.tsx");
    expect(menu).toMatch(
      /export let label = style<\{size: string\}>\(\{\s*gridArea: 'label',\s*font: controlFont\(\),[\s\S]*?fontWeight: 'medium'/,
    );
    const description =
      /export let description = style<[\s\S]*?size: \{\s*S: '([\w-]+)',\s*M: '([\w-]+)',\s*L: '([\w-]+)',\s*XL: '([\w-]+)'/.exec(
        menu,
      )!;
    const s2Description = {
      S: description[1],
      M: description[2],
      L: description[3],
      XL: description[4],
    };
    for (const [size, selectors] of Object.entries(
      rule.structure.composition.sizeSelectors,
    )) {
      const label = selectors['.react-aria-Text[slot="label"]']!;
      expect(fontName(label["font-size"]!), size).toBe(CONTROL_FONT[size]);
      expect(label["font-weight"], size).toBe("500");
      expect(
        fontName(
          selectors['.react-aria-Text[slot="description"]']!["font-size"]!,
        ),
        size,
      ).toBe(s2Description[size as keyof typeof s2Description]);
    }
  });
});

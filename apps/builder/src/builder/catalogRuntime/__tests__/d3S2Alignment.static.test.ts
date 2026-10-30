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
import { describe, expect, it } from "vitest";
import {
  borderWidth,
  radius,
  resolveToken,
  S2_CONTROL_HEIGHT,
  S2_DEVICE,
  S2_FONT_RATIO,
  S2_FONT_SIZE_BASE,
  S2_ICON_SIZE,
  s2FontSize,
  s2LineHeight,
  s2SizeTokens,
  spacing,
  TYPOGRAPHY_STEPS,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
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

  it("spacing 값은 S2 spacing 단에 있다 (이름 ↔ 단 대응은 3d)", () => {
    for (const px of Object.values(spacing)) expect(t.spacing).toContain(px);
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

  it("Input · Button 의 minHeight 는 `{size.height.<S>}`", () => {
    for (const type of ["Input", "Button"])
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
});

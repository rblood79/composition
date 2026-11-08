// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { darkColors, lightColors } from "@composition/rendering";

import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { TINT_PRESETS } from "../../../../utils/theme/tintToSkiaColors";
import { buildThemeColors } from "../../../../../../../packages/shared/src/catalog/runtime/ladderGenerate";
import {
  openStylesFixture,
  type StylesFixture,
  type StylesFixtureNode,
} from "../__tests__/support/catalogStylesFixture";
import { useAppearanceValues } from "./useAppearanceValues";
import { useTypographyValues } from "./useTypographyValues";
import { clearSpecPresetCache } from "../utils/specPresetResolver";

const PICKER_TRANSPARENT = "#00000000";

/** 테마 설치는 lightColors/darkColors 를 제자리 mutation 하므로 초기 팔레트를 스냅샷해 복원한다. */
const LIGHT_COLORS_SNAPSHOT = { ...lightColors };
const DARK_COLORS_SNAPSHOT = { ...darkColors };

/** ADR-248 4e-9 C: the nodes over the catalog Styles host (the old store host went with it). */
let fixture: StylesFixture;

async function setElements(nodes: StylesFixtureNode[]): Promise<void> {
  fixture = await openStylesFixture(nodes);
}

function makeElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
  parent?: string,
): StylesFixtureNode {
  return { id, type, props, ...(parent ? { parent } : {}) };
}

async function setButton(
  props: Record<string, unknown>,
  style?: Record<string, string>,
): Promise<void> {
  await setElements([{ id: "button-1", type: "Button", props, style }]);
}

function hookOf<T>(hook: (id: string) => T, id: string) {
  const record = fixture.recordOf(id);
  return renderHook(() => hook(record), { wrapper: fixture.wrapper });
}

function readColorValues(id: string) {
  const appearance = hookOf(useAppearanceValues, id);
  const typography = hookOf(useTypographyValues, id);
  const result = {
    backgroundColor: appearance.result.current?.backgroundColor,
    borderColor: appearance.result.current?.borderColor,
    color: typography.result.current?.color,
  };
  appearance.unmount();
  typography.unmount();
  return result;
}

describe("Style Panel catalog color values", () => {
  beforeEach(() => {
    clearSpecPresetCache();
    useThemeConfigStore.setState({ darkMode: "light", themeVersion: 0 });
  });

  afterEach(() => {
    Object.assign(lightColors, LIGHT_COLORS_SNAPSHOT);
    Object.assign(darkColors, DARK_COLORS_SNAPSHOT);
    useThemeConfigStore.setState({ tint: "blue" });
  });

  it("tint 변경(themeVersion 증가)을 같은 theme 문자열에서도 다시 해석한다", async () => {
    // resolveToken 은 lightColors 전역 객체를 읽고 테마 설치 (`installThemeMaps`) 는 그 객체를
    // 제자리 mutation 한 뒤 `applyResolvedTheme` 으로 themeVersion 을 올린다 (`builderTheme.ts`).
    // theme("light") 는 그대로라 themeVersion 이 유일한 재계산 신호다.
    await setButton({ size: "M", variant: "accent", fillStyle: "fill" });
    const appearance = hookOf(useAppearanceValues, "button-1");
    const before = appearance.result.current?.backgroundColor;
    expect(before).toBe(lightColors.accent);

    // rerender 를 강제하지 않는다 — themeVersion 구독만으로 다시 그려져야 한다.
    act(() => {
      Object.assign(
        lightColors,
        buildThemeColors({ accent: TINT_PRESETS.red }).light,
      );
      const theme = useThemeConfigStore.getState();
      theme.applyResolvedTheme({
        tint: "red",
        darkMode: theme.darkMode,
        neutral: theme.neutral,
        radiusScale: theme.radiusScale,
        baseTypography: theme.baseTypography,
      });
    });

    expect(lightColors.accent).not.toBe(before);
    expect(appearance.result.current?.backgroundColor).toBe(lightColors.accent);
    appearance.unmount();
  });

  it("신규 Button의 variant 배경/텍스트/테두리 색을 catalog와 동일하게 표시한다", async () => {
    await setButton({ size: "M", variant: "primary", fillStyle: "fill" });

    const appearance = hookOf(useAppearanceValues, "button-1");
    const typography = hookOf(useTypographyValues, "button-1");

    expect(appearance.result.current).toMatchObject({
      backgroundColor: lightColors.neutral,
      borderColor: lightColors.neutral,
    });
    expect(typography.result.current?.color).toBe(lightColors.base);
  });

  it("Button outline의 투명 배경과 outline 전용 텍스트/테두리 색을 표시한다", async () => {
    await setButton({ size: "M", variant: "accent", fillStyle: "outline" });

    const appearance = hookOf(useAppearanceValues, "button-1");
    const typography = hookOf(useTypographyValues, "button-1");

    // (`3ca03f661` S2 1.8.2: accent outline 테두리 = `currentColor` — outline 글자 `neutral-content`)
    expect(appearance.result.current).toMatchObject({
      backgroundColor: PICKER_TRANSPARENT,
      borderColor: lightColors["neutral-content"],
    });
    // outline 글자는 S2 `baseColor('neutral')` (ADR-297 3h #2 — S2 outline 에 variant 색 글자 없음)
    expect(typography.result.current?.color).toBe(lightColors.neutral);
  });

  it("premium catalog 색상을 현재 dark theme의 picker 입력값으로 해석한다", async () => {
    useThemeConfigStore.setState({ darkMode: "dark", themeVersion: 1 });
    await setButton({ size: "M", variant: "premium", fillStyle: "fill" });

    const appearance = hookOf(useAppearanceValues, "button-1");
    const typography = hookOf(useTypographyValues, "button-1");

    // (ADR-297 후속 ⑥: S2 premium = gray-100 under its gradient · white text — the gradient is the
    //  background image, not the Fill color; S2 gray-100 = `neutral-surface` — dark #2c2c2c, ADR-302)
    expect(appearance.result.current).toMatchObject({
      backgroundColor: darkColors["neutral-surface"],
    });
    expect(typography.result.current?.color).toBe(darkColors.white);
  });

  it("inline color override는 catalog variant보다 우선한다", async () => {
    await setButton(
      { size: "M", variant: "primary" },
      { backgroundColor: "#112233", borderColor: "#445566", color: "#778899" },
    );

    const appearance = hookOf(useAppearanceValues, "button-1");
    const typography = hookOf(useTypographyValues, "button-1");

    expect(appearance.result.current).toMatchObject({
      backgroundColor: "#112233",
      borderColor: "#445566",
    });
    expect(typography.result.current?.color).toBe("#778899");
  });

  describe("ADR-912 후속 — resolved catalog paint", () => {
    it.each([
      [
        "accent",
        lightColors.accent,
        lightColors["accent-subtle"],
        lightColors["on-accent"],
        lightColors["accent-content"],
      ],
      [
        "informative",
        lightColors["informative-background"],
        lightColors["informative-subtle"],
        lightColors.white,
        lightColors.informative,
      ],
      [
        "neutral",
        lightColors.neutral,
        lightColors["neutral-subtle"],
        lightColors.base,
        lightColors.neutral,
      ],
      [
        "positive",
        lightColors["positive-background"],
        lightColors["positive-subtle"],
        lightColors.white,
        lightColors.positive,
      ],
      [
        "notice",
        lightColors["notice-background"],
        lightColors["notice-subtle"],
        lightColors.black,
        lightColors.notice,
      ],
      [
        "negative",
        lightColors["negative-background"],
        lightColors["negative-subtle"],
        lightColors["on-negative"],
        lightColors.negative,
      ],
    ])(
      "D1 Badge %s의 bold/subtle/outline 3채널을 구분한다",
      async (variant, boldBackground, subtleBackground, boldText, hue) => {
        const actual = [];
        for (const fillStyle of ["bold", "subtle", "outline"] as const) {
          await setElements([
            makeElement("badge-1", "Badge", { size: "S", variant, fillStyle }),
          ]);
          actual.push(readColorValues("badge-1"));
        }

        expect(actual).toEqual([
          {
            backgroundColor: boldBackground,
            borderColor: PICKER_TRANSPARENT,
            color: boldText,
          },
          // (`4f71aa245` S2 Badge.tsx: subtle · outline 글자 = `gray-1000` — 대비 회귀 수리)
          {
            backgroundColor: subtleBackground,
            borderColor: PICKER_TRANSPARENT,
            color: lightColors["gray-1000"],
          },
          {
            backgroundColor: PICKER_TRANSPARENT,
            borderColor: hue,
            color: lightColors["gray-1000"],
          },
        ]);
      },
    );

    it("D2 Button staticColor=black의 고정색과 역상 text를 표시한다", async () => {
      await setButton({
        size: "M",
        variant: "primary",
        fillStyle: "fill",
        staticColor: "black",
      });
      // (ADR-297 3h #9: S2 static primary = `transparent-overlay-800` of the static color, `auto` text,
      //  no fill border — accent has no S2 static branch)
      expect(readColorValues("button-1")).toEqual({
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        borderColor: "#00000000",
        color: "#ffffff",
      });
    });

    it("D3 ToggleButton selected+emphasized paint를 표시한다", async () => {
      await setElements([
        makeElement("toggle-1", "ToggleButton", {
          size: "M",
          isSelected: true,
          isEmphasized: true,
        }),
      ]);

      // (`3ca03f661` S2 1.8.2 ActionButton.btnStyles: ToggleButton 테두리 없음 — 투명)
      expect(readColorValues("toggle-1")).toEqual({
        backgroundColor: lightColors.accent,
        borderColor: PICKER_TRANSPARENT,
        color: lightColors["on-accent"],
      });
    });

    it("같은 catalog key의 요소를 왕복 선택해도 이전 resolved paint가 남지 않는다", async () => {
      await setElements([
        makeElement("button-default", "Button", {
          size: "M",
          variant: "accent",
          fillStyle: "fill",
        }),
        makeElement("button-static", "Button", {
          size: "M",
          variant: "primary",
          fillStyle: "fill",
          staticColor: "black",
        }),
      ]);

      const record = (id: string) => fixture.recordOf(id);
      const appearance = renderHook(({ id }) => useAppearanceValues(id), {
        initialProps: { id: record("button-default") },
        wrapper: fixture.wrapper,
      });
      const typography = renderHook(({ id }) => useTypographyValues(id), {
        initialProps: { id: record("button-default") },
        wrapper: fixture.wrapper,
      });

      expect(appearance.result.current?.backgroundColor).toBe(
        lightColors.accent,
      );
      expect(typography.result.current?.color).toBe(lightColors["on-accent"]);

      appearance.rerender({ id: record("button-static") });
      typography.rerender({ id: record("button-static") });
      expect(appearance.result.current?.backgroundColor).toBe(
        "rgba(0, 0, 0, 0.85)",
      );
      expect(typography.result.current?.color).toBe("#ffffff");

      appearance.rerender({ id: record("button-default") });
      typography.rerender({ id: record("button-default") });
      expect(appearance.result.current?.backgroundColor).toBe(
        lightColors.accent,
      );
      expect(typography.result.current?.color).toBe(lightColors["on-accent"]);
    });
  });
});

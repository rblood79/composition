// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { darkColors, lightColors } from "@composition/rendering";

import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { TINT_PRESETS } from "../../../../utils/theme/tintToSkiaColors";
import { buildThemeColors } from "../../../../../../../packages/shared/src/catalog/runtime/ladderGenerate";
import { StylesHostContext, type StylesHost } from "../stylesHost";
import { ColorPickerPalettes } from "./ColorPickerPalettes.components";

/** 테마 설치는 lightColors/darkColors 를 제자리 mutation 하므로 초기 팔레트를 스냅샷해 복원한다. */
const LIGHT_COLORS_SNAPSHOT = { ...lightColors };
const DARK_COLORS_SNAPSHOT = { ...darkColors };

/** The palette reads the document colors through the Styles host — none here. */
const host = {
  documentColors: {
    subscribe: () => () => {},
    revision: () => 0,
    read: () => [],
  },
} as unknown as StylesHost;

const wrapper = ({ children }: { children: ReactNode }) => (
  <StylesHostContext.Provider value={host}>
    {children}
  </StylesHostContext.Provider>
);

/** RAC ColorSwatch names its color (`aria-label`) — jsdom drops the gradient background. */
const accentSwatchColor = (container: HTMLElement) =>
  container
    .querySelector('[data-token="accent"] .react-aria-ColorSwatch')
    ?.getAttribute("aria-label") ?? "";

describe("ColorPickerPalettes — Theme swatches follow the installed theme", () => {
  beforeEach(() => {
    useThemeConfigStore.setState({
      tint: "blue",
      darkMode: "light",
      themeVersion: 0,
    });
  });

  afterEach(() => {
    cleanup();
    Object.assign(lightColors, LIGHT_COLORS_SNAPSHOT);
    Object.assign(darkColors, DARK_COLORS_SNAPSHOT);
  });

  it("a custom accent (`color.accent` hex — the tint stays) re-reads the swatches while the picker is open", () => {
    const { container } = render(
      <ColorPickerPalettes value="#000000FF" onSelect={() => {}} />,
      { wrapper },
    );
    const before = accentSwatchColor(container);
    expect(before).not.toBe("");

    // The active theme takes a custom accent: the token maps change in place and the store's
    //   `themeVersion` goes up — `tint` is still "blue" (2026-11-10 사용자 보고: 닫고 다시 열어야 반영).
    act(() => {
      Object.assign(
        lightColors,
        buildThemeColors({ accent: TINT_PRESETS.green }).light,
      );
      const theme = useThemeConfigStore.getState();
      theme.applyResolvedTheme({
        tint: theme.tint,
        darkMode: theme.darkMode,
        neutral: theme.neutral,
        radiusScale: theme.radiusScale,
        baseTypography: theme.baseTypography,
      });
    });

    expect(accentSwatchColor(container)).not.toBe(before);
  });
});

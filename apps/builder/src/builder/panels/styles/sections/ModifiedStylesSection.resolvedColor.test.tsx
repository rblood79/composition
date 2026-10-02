// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { lightColors } from "@composition/specs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectedElement } from "../../../inspector/types";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { resolveAccentColorTokens } from "../../../../utils/theme/tintToSkiaColors";
import { openStylesFixture } from "../__tests__/support/catalogStylesFixture";
import { ModifiedStylesSection } from "./ModifiedStylesSection";

vi.mock("../../../components/panel/Section", () => ({
  Section: ({ children }: PropsWithChildren) => <section>{children}</section>,
}));
vi.mock("../../../components/feedback/EmptyState", () => ({
  EmptyState: () => null,
}));

// 행의 swatch — resolved 색을 그대로 받는지만 본다 (panel-ui 04: 편집기 대신 read-only 행)
vi.mock("@composition/shared/components/ColorSwatch", () => ({
  ColorSwatch: ({ color }: { color: { toString: (f: string) => string } }) => (
    <output data-testid="color-Color" data-value={color.toString("hex")} />
  ),
}));

vi.mock("../hooks/useResetStyles", () => ({
  useDirtyStyleProps: () => ["color"],
  useResetStyles: () => vi.fn(),
}));

describe("ADR-912 후속 — Modified Styles resolved color", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThemeConfigStore.setState({ darkMode: "light", themeVersion: 0 });
  });

  it("D5 var(--accent)를 picker가 파싱 가능한 현재 theme 색으로 전달한다", async () => {
    const fixture = await openStylesFixture([{ id: "text-1", type: "Text" }]);
    const selectedElement: SelectedElement = {
      id: fixture.recordOf("text-1"),
      type: "Text",
      properties: {},
      style: { color: "var(--accent)" },
    };

    render(<ModifiedStylesSection selectedElement={selectedElement} />, {
      wrapper: fixture.wrapper,
    });

    expect(screen.getByTestId("color-Color").getAttribute("data-value")).toBe(
      lightColors.accent.toUpperCase(),
    );
  });

  it("D5 요소 accent의 CSS variable도 picker concrete color로 해석한다", async () => {
    const fixture = await openStylesFixture([
      { id: "card-1", type: "Card", props: { accentColor: "red" } },
    ]);
    const selectedElement: SelectedElement = {
      id: fixture.recordOf("card-1"),
      type: "Card",
      properties: { accentColor: "red" },
      style: { color: "var(--accent)" },
    };

    render(<ModifiedStylesSection selectedElement={selectedElement} />, {
      wrapper: fixture.wrapper,
    });

    expect(screen.getByTestId("color-Color").getAttribute("data-value")).toBe(
      resolveAccentColorTokens("red", "light")?.accent.toUpperCase(),
    );
  });
});

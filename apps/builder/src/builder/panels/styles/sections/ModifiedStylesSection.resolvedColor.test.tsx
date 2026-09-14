// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { lightColors } from "@composition/specs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectedElement } from "../../../inspector/types";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { resolveAccentColorTokens } from "../../../../utils/theme/tintToSkiaColors";
import { seedPanelElements } from "../../../__tests__/panelFixture";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { ModifiedStylesSection } from "./ModifiedStylesSection";

vi.mock("../../../components", () => ({
  PropertySection: ({ children }: PropsWithChildren) => (
    <section>{children}</section>
  ),
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
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useStore.setState({ elements: [], elementsMap: new Map() } as never);
  });

  it("D5 var(--accent)를 picker가 파싱 가능한 현재 theme 색으로 전달한다", () => {
    const selectedElement: SelectedElement = {
      id: "text-1",
      type: "Text",
      properties: {},
      style: { color: "var(--accent)" },
    };

    render(<ModifiedStylesSection selectedElement={selectedElement} />);

    expect(screen.getByTestId("color-Color").getAttribute("data-value")).toBe(
      lightColors.accent.toUpperCase(),
    );
  });

  it("D5 요소 accent의 CSS variable도 picker concrete color로 해석한다", () => {
    const selectedElement: SelectedElement = {
      id: "card-1",
      type: "Card",
      properties: { accentColor: "red" },
      style: { color: "var(--accent)" },
    };
    const element = {
      id: "card-1",
      type: "Card",
      parent_id: null,
      props: { accentColor: "red", style: selectedElement.style },
    };
    seedPanelElements([element as never]);

    render(<ModifiedStylesSection selectedElement={selectedElement} />);

    expect(screen.getByTestId("color-Color").getAttribute("data-value")).toBe(
      resolveAccentColorTokens("red", "light")?.accent.toUpperCase(),
    );
  });
});

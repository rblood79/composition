// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { lightColors } from "@composition/specs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectedElement } from "../../../inspector/types";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { resolveAccentColorTokens } from "../../../../utils/theme/tintToSkiaColors";
import { seedPanelElements } from "../hooks/__tests__/panelFixture";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { ModifiedStylesSection } from "./ModifiedStylesSection";

vi.mock("../../../components", () => ({
  PropertySection: ({ children }: PropsWithChildren) => (
    <section>{children}</section>
  ),
  PropertyColor: ({ label, value }: { label: string; value: string }) => (
    <output data-testid={`color-${label}`} data-value={value} />
  ),
  PropertyUnitInput: () => null,
  PropertySelect: () => null,
}));

vi.mock("../hooks/useResetStyles", () => ({
  useDirtyStyleProps: () => ["color"],
}));

vi.mock("../hooks/useStyleActions", () => ({
  useStyleActions: () => ({ updateStyle: vi.fn() }),
}));

vi.mock("../hooks/useOptimizedStyleActions", () => ({
  useOptimizedStyleActions: () => ({ updateStylePreview: vi.fn() }),
}));

vi.mock("../hooks/useStylePresentationActions", () => ({
  useStylePresentationActions: () => ({
    cancelBorderColorPresentation: vi.fn(),
    commitBorderColorPresentation: vi.fn(() => false),
    isBorderColorPresentationOwned: vi.fn(() => false),
    previewBorderColorPresentation: vi.fn(() => false),
    cancelTextColorPresentation: vi.fn(),
    commitTextColorPresentation: vi.fn(() => false),
    isTextColorPresentationOwned: vi.fn(() => false),
    previewTextColorPresentation: vi.fn(() => false),
    commitOpacityPresentation: vi.fn(() => false),
    isOpacityPresentationOwned: vi.fn(() => false),
    previewOpacityPresentation: vi.fn(() => false),
  }),
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
      lightColors.accent,
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
      resolveAccentColorTokens("red", "light")?.accent,
    );
  });
});

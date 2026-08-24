// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { render, screen } from "@testing-library/react";
import { lightColors } from "@composition/specs";
import { describe, expect, it, vi } from "vitest";

import type { SelectedElement } from "../../../inspector/types";
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

describe("ADR-912 후속 Phase 0 — Modified Styles expected RED", () => {
  it.fails(
    "D5 var(--accent)를 picker가 파싱 가능한 현재 theme 색으로 전달한다",
    () => {
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
    },
  );
});

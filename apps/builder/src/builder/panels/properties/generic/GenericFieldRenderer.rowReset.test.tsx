// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedField } from "@composition/shared";
import { I18nProvider } from "@/i18n";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { GenericFieldRenderer } from "./GenericFieldRenderer";

vi.mock("../hooks/useOwnerCollectionColumns", async (importActual) => {
  const actual =
    await importActual<typeof import("../hooks/useOwnerCollectionColumns")>();
  return { ...actual, useOwnerCollectionFields: () => null };
});

const field = (
  key: string,
  label: string,
  baseValue: unknown,
  extra: Partial<ResolvedField> = {},
): ResolvedField => ({
  key,
  kind: "enum",
  label,
  section: "appearance",
  origin: "semantic",
  isOverridden: true,
  baseValue,
  currentValue: baseValue,
  options: [
    { value: "primary", label: "Primary" },
    { value: "accent", label: "Accent" },
  ],
  ...extra,
});

const seed = (props: Record<string, unknown>) =>
  seedPanelElements([
    { id: "btn", type: "Button", props, page_id: "page-1", parent_id: null },
  ]);

const renderFields = (fields: ResolvedField[], update = vi.fn()) => {
  const utils = render(
    <GenericFieldRenderer
      fields={fields}
      onSemanticUpdate={update}
      onStyleUpdate={vi.fn()}
      elementId="btn"
    />,
    { wrapper: I18nProvider },
  );
  return { ...utils, update };
};

// 행 끝 28 열 「기본값으로」 (2026-09-16) — 기본값이 있고 값이 다를 때만 선다.
describe("GenericFieldRenderer — 행 reset 액션", () => {
  beforeEach(resetPanelFixture);
  afterEach(() => {
    cleanup();
    resetPanelFixture();
  });

  it("값이 기본값과 같으면 액션이 없다", () => {
    seed({ variant: "primary" });
    const { container } = renderFields([field("variant", "Variant", "primary")]);
    expect(container.querySelector(".actions-reset")).toBeNull();
  });

  it("기본값이 없는 필드는 값이 있어도 대상이 아니다", () => {
    seed({ children: "Hello" });
    const { container } = renderFields([
      field("children", "Text", undefined, { kind: "string", options: undefined }),
    ]);
    expect(container.querySelector(".actions-reset")).toBeNull();
  });

  it("값이 다르면 서고, 누르면 기본값을 쓴다", () => {
    seed({ variant: "accent" });
    const { container, update } = renderFields([
      field("variant", "Variant", "primary"),
    ]);
    const button = screen.getByRole("button", {
      name: "Reset Variant to default",
    });
    expect(container.querySelector(".fieldset-row .actions-reset")).toContain(
      button,
    );
    fireEvent.click(button);
    expect(update).toHaveBeenCalledWith("variant", "primary");
  });

  it("반폭 두 필드 행은 바뀐 필드만 이름에 싣고 그것만 되돌린다", () => {
    seed({ variant: "accent", size: "md" });
    const { update } = renderFields([
      field("variant", "Variant", "primary", { kind: "variant" }),
      field("size", "Size", "md", {
        kind: "size",
        options: [
          { value: "sm", label: "S" },
          { value: "md", label: "M" },
        ],
      }),
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Variant to default" }),
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("variant", "primary");
  });
});

// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedField } from "@composition/shared";
import { I18nProvider } from "@/i18n";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { useStore } from "../../../stores";
import { GenericFieldRenderer } from "./GenericFieldRenderer";

vi.mock("../hooks/useOwnerCollectionColumns", async (importActual) => {
  const actual =
    await importActual<typeof import("../hooks/useOwnerCollectionColumns")>();
  return { ...actual, useOwnerCollectionFields: () => null };
});

// jsdom 에는 Web Animations 의 getAnimations 가 없다 — RAC SelectionIndicator 가 부른다.
if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

const labelPosition: ResolvedField = {
  key: "labelPosition",
  kind: "enum",
  label: "Label Position",
  section: "layout",
  origin: "semantic",
  isOverridden: true,
  baseValue: "top",
  currentValue: "top",
  options: [
    { value: "top", label: "Top" },
    { value: "side", label: "Side" },
  ],
};
const labelAlign: ResolvedField = {
  key: "labelAlign",
  kind: "enum",
  label: "Label Align",
  section: "layout",
  origin: "semantic",
  isOverridden: false,
  baseValue: "start",
  currentValue: "start",
  options: [
    { value: "start", label: "Start" },
    { value: "end", label: "End" },
  ],
  visibleWhen: { key: "labelPosition", equals: "side" },
};

const necessity: ResolvedField = {
  key: "necessityIndicator",
  kind: "enum",
  label: "Necessity Indicator",
  section: "layout",
  origin: "semantic",
  isOverridden: false,
  baseValue: "icon",
  currentValue: "icon",
  options: [
    { value: "icon", label: "Icon" },
    { value: "label", label: "Label" },
  ],
};

// 2026-09-16 사용자 지적 — Styles 와 같은 ToggleButtonGroup 인데 Properties 만 인디케이터가
// 점프했다. 원인은 행 key: 게이트가 종속 필드를 드러내면 행 구성이 바뀌어 행이 remount 됐다.
describe("GenericFieldRenderer — 게이트 seg 는 종속 필드가 합류해도 같은 DOM 노드", () => {
  beforeEach(resetPanelFixture);
  afterEach(() => {
    cleanup();
    resetPanelFixture();
  });

  it("labelPosition top → side: Label Align 이 옆 칸에 나타나도 seg 그룹은 remount 되지 않는다", () => {
    seedPanelElements([
      { id: "tf", type: "TextField", props: { labelPosition: "top" }, page_id: "page-1", parent_id: null },
    ]);
    const { container, rerender } = render(
      <GenericFieldRenderer
        fields={[labelPosition, labelAlign, necessity]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
        elementId="tf"
      />,
      { wrapper: I18nProvider },
    );
    const before = container.querySelector(".react-aria-ToggleButtonGroup");
    expect(before).not.toBeNull();
    // TextField 실제 구성: [Label Position | Necessity Indicator] 한 행 → side 로 바꾸면
    //   [Label Position | Label Align] [Necessity Indicator] 로 행 짝이 바뀐다
    expect(container.querySelectorAll(".react-aria-ToggleButtonGroup")).toHaveLength(2);

    act(() => {
      useStore.getState().updateElementProps("tf", { labelPosition: "side" });
    });
    // 실제 패널은 계약을 다시 풀어 currentValue 가 갱신된 새 필드 객체를 넘긴다
    rerender(
      <GenericFieldRenderer
        fields={[
          { ...labelPosition, currentValue: "side" },
          { ...labelAlign },
          { ...necessity },
        ]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
        elementId="tf"
      />,
    );
    const groups = container.querySelectorAll(".react-aria-ToggleButtonGroup");
    expect(groups).toHaveLength(3);
    expect(groups[0]).toBe(before);
  });
});

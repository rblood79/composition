// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import { useStore } from "../../stores";
import { GridListCardFieldsSection } from "./GridListCardFieldsSection";

/**
 * ADR-162 Phase 5 — 「카드 필드」 절: 데이터 GridList 를 선택하면 항목 origin 자손 prop 마다 ADR-159 필드
 * 입력이 서고 (컬럼 피커 활성), commit 은 origin 자손 문서 노드에 쓴다.
 */

const origin = {
  id: "component-gridlist-item-default",
  type: "GridListItem",
  reusable: true,
  props: {},
  children: [
    {
      id: "card-image",
      type: "Image",
      props: { alt: "{title}" },
    },
  ],
} as unknown as CanonicalNode;

const byId = new Map<string, CanonicalNode>([
  [origin.id, origin],
  ["card-image", origin.children![0]!],
  [
    "gl",
    {
      id: "gl",
      type: "GridList",
      dataBinding: {
        type: "collection",
        source: "static",
        config: { data: [{ id: "a", title: "A", photo: "p.png" }] },
      },
      props: {},
    } as unknown as CanonicalNode,
  ],
  ["plain", { id: "plain", type: "GridList", props: {} } as CanonicalNode],
]);

vi.mock(
  import("../../stores/canonical/canonicalElementsBridge"),
  async (importOriginal) => ({
    ...(await importOriginal()),
    useActiveCanonicalDocument: () =>
      ({ version: "composition-1.0", children: [] }) as never,
  }),
);
vi.mock(
  import("../../stores/canonical/canonicalTraversalHelpers"),
  async (importOriginal) => ({
    ...(await importOriginal()),
    getNodeMap: () => byId,
  }),
);
vi.mock(import("./hooks/useCanonicalPropertyRead"), async (importOriginal) => ({
  ...(await importOriginal()),
  useCanonicalPropertyElementType: () => "GridList",
}));

afterEach(cleanup);

const renderSection = (elementId: string) =>
  render(
    <I18nProvider initialLocale="ko-KR">
      <GridListCardFieldsSection elementId={elementId} />
    </I18nProvider>,
  );

describe("ADR-162 Phase 5 — GridListCardFieldsSection", () => {
  it("데이터 GridList — origin Image 의 src · alt 입력, commit 은 origin 자손에 쓴다", () => {
    const updateElementProps = vi.fn(async () => {});
    useStore.setState({ updateElementProps } as never);
    renderSection("gl");

    const src = screen.getByRole("group", { name: "Image · src" });
    const input = src.querySelector("input")!;
    expect(input.value).toBe("");
    // 컬럼 피커가 선다 (선택된 GridList 의 데이터 키).
    expect(
      src.querySelector<HTMLButtonElement>(".field-picker-trigger")?.disabled,
    ).toBe(false);

    fireEvent.change(input, { target: { value: "{photo}" } });
    fireEvent.blur(input);
    expect(updateElementProps).toHaveBeenCalledWith("card-image", {
      src: "{photo}",
    });
    expect(
      screen.getByRole("group", { name: "Image · alt" }).querySelector("input")
        ?.value,
    ).toBe("{title}");
  });

  it("데이터 없는 GridList — 절 없음", () => {
    const { container } = renderSection("plain");
    expect(container.innerHTML).toBe("");
  });
});

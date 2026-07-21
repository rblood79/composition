import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 2026-07-21 (Issue: ListBoxItem padding 0 높이 붕괴) — collection item(ListBoxItem/
 * GridListItem) 자식 Text 의 `props.size` 토큰이 fontSize 로 해소되는지 가드.
 *
 * `injectCollectionItemFontStyles` 가 `style.fontSize` 만 읽고 `props.size`(3xl 등)를 무시하면
 * fallback 14 로 clobber 되어 origin 자식이 자기 size 를 잃고 행 높이가 붕괴(padding 0 에서
 * 특히 가시). props.size → catalog fontSize 해소로 방지.
 */

function makeText(id: string, props: Record<string, unknown>): Element {
  return {
    id,
    type: "Text",
    props: { style: {}, ...props },
    childrenIds: [],
  } as unknown as Element;
}

function applyContainer(
  type: string,
  props: Record<string, unknown>,
  children: Element[],
): ReturnType<typeof applyImplicitStyles> {
  const containerId = `${type}-1`;
  const normalizedChildren = children.map((child) => ({
    ...child,
    parent_id: containerId,
  })) as Element[];
  const container = {
    id: containerId,
    type,
    props,
    childrenIds: normalizedChildren.map((child) => child.id),
  } as unknown as Element;
  const byId = new Map<string, Element>([
    [container.id, container],
    ...normalizedChildren.map((child) => [child.id, child] as const),
  ]);
  return applyImplicitStyles(
    container,
    normalizedChildren,
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((childId: string) => byId.get(childId)!) ?? [],
    byId,
  );
}

function textStyle(
  result: ReturnType<typeof applyImplicitStyles>,
  id: string,
): Record<string, unknown> {
  return (result.filteredChildren.find((child) => child.id === id)?.props
    ?.style ?? {}) as Record<string, unknown>;
}

describe("collection item font — props.size 해소 (2026-07-21)", () => {
  it("ListBoxItem 자식 Text 의 props.size(3xl) 가 fontSize 30 으로 해소 (14 clobber 방지)", () => {
    const result = applyContainer(
      "ListBoxItem",
      { style: { paddingTop: 0, paddingBottom: 0 } },
      [makeText("lbl", { slot: "label", size: "3xl" })],
    );
    expect(textStyle(result, "lbl").fontSize).toBe(30);
  });

  it("서로 다른 size(label 3xl / description 2xl)가 각자 해소된다", () => {
    const result = applyContainer("ListBoxItem", {}, [
      makeText("lbl", { slot: "label", size: "3xl" }),
      makeText("desc", { slot: "description", size: "2xl" }),
    ]);
    expect(textStyle(result, "lbl").fontSize).toBe(30);
    expect(textStyle(result, "desc").fontSize).toBe(24);
  });

  it("size 없는 Text 는 14 fallback (BC)", () => {
    const result = applyContainer("ListBoxItem", {}, [
      makeText("lbl", { slot: "label" }),
    ]);
    expect(textStyle(result, "lbl").fontSize).toBe(14);
  });

  it("explicit style.fontSize 가 props.size 보다 우선", () => {
    const result = applyContainer("ListBoxItem", {}, [
      makeText("lbl", { slot: "label", size: "3xl", style: { fontSize: 18 } }),
    ]);
    expect(textStyle(result, "lbl").fontSize).toBe(18);
  });
});

import { describe, expect, it } from "vitest";

import { LISTBOX_ORIGIN_ID } from "../../../components/listbox/listBoxTemplateOrigins";
import { useStore } from "../../../stores";
import { createElementsFromDefinition } from "../../utils/elementCreation";
import { createListBoxDefinition } from "../SelectionComponents";
import type { ComponentCreationContext } from "../../types";

function makeContext(): ComponentCreationContext {
  return {
    parentElement: null,
    pageId: "page-home",
    elements: [],
    doc: {
      version: "composition-1.0",
      children: [],
    },
  };
}

describe("createListBoxDefinition (Option B anchor-less)", () => {
  it("creates the page ListBox as a ref instance of the Components page origin", () => {
    const definition = createListBoxDefinition(makeContext());

    expect(definition.parent).toMatchObject({
      type: "ref",
      ref: LISTBOX_ORIGIN_ID,
      componentName: "ListBox",
      props: expect.objectContaining({
        orientation: "vertical",
        selectionMode: "single",
      }),
    });
  });

  // Option B: panel-add 와 origin copy-paste 가 동일한 bare ref 구조를 만든다.
  //   in-tree template anchor(ListBoxItem ref)를 주입하지 않는다 — 행 template 은 projection 이
  //   component 정의의 origin slot 에서 해석한다(canvasSceneNode resolveListBoxTemplateOriginId).
  it("does not inject an in-instance ListBoxItem template anchor child", () => {
    const definition = createListBoxDefinition(makeContext());

    expect(definition.children).toEqual([]);
  });

  // 2026-07-22 사용자 보고 회귀 방지: 스크롤 발화/휠/scrollbar 4 소비자가 raw props.style.overflow·
  //   maxHeight 를 읽으므로(catalog fallback 미도달), instance 가 real props.style 로 bounded
  //   scroll 기본값을 가져야 콘텐츠 초과 시 300px clamp + 스크롤바가 나온다.
  it("materializes bounded-scroll defaults (maxHeight/overflow) on the instance props.style", () => {
    const definition = createListBoxDefinition(makeContext());
    const style = (
      definition.parent as { props?: { style?: Record<string, unknown> } }
    ).props?.style;

    expect(style).toMatchObject({
      width: "100%",
      maxHeight: "300px",
      overflow: "auto",
    });
  });

  it("uses component names for the generated custom id and creates no child elements", () => {
    useStore.setState({ elements: [] });

    const definition = createListBoxDefinition(makeContext());
    const { parent, children } = createElementsFromDefinition(definition, {
      pageId: "page-home",
      layoutId: null,
    });

    expect(parent).toMatchObject({
      type: "ref",
      ref: LISTBOX_ORIGIN_ID,
      customId: "listbox_1",
    });
    // anchor-less → 생성되는 자식 element 없음 (copy-paste 와 동일 layer 트리).
    expect(children).toEqual([]);
  });
});

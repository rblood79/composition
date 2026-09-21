import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";
import { buildCatalogOrigin } from "../catalogOrigins";
import {
  STATE_VARIANT_BASE_TYPES,
  ensureStateVariantOrigins,
  readStateVariantSelf,
  stateVariantOriginId,
} from "../stateVariantOrigins";

function docWithOrigins(origins: CanonicalNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        props: {},
        metadata: { type: "page", systemOwned: true },
        children: [
          {
            id: COMPONENTS_SYSTEM_BODY_ID,
            type: "body",
            props: {},
            children: origins,
          } as unknown as CanonicalNode,
        ],
      } as CanonicalNode,
      {
        id: "page-home",
        type: "frame",
        props: {},
        metadata: { type: "page" },
        children: [
          {
            id: "home-body",
            type: "body",
            props: {},
            children: [],
          } as unknown as CanonicalNode,
        ],
      } as CanonicalNode,
    ],
  };
}

function bodyChildren(doc: CompositionDocument): CanonicalNode[] {
  const page = doc.children.find((n) => n.id === "page-components")!;
  return page.children!.find((n) => n.id === COMPONENTS_SYSTEM_BODY_ID)!
    .children!;
}

describe("ADR-230 stateVariantOrigins — 기본 요소 상태 변형 origin seed", () => {
  it("상태 열은 타입별 계약 — Button/Link 는 disabled 만, ToggleButton/Checkbox/Switch 는 selected+disabled", () => {
    expect(STATE_VARIANT_BASE_TYPES.Button).toEqual(["disabled"]);
    expect(STATE_VARIANT_BASE_TYPES.Link).toEqual(["disabled"]);
    expect(STATE_VARIANT_BASE_TYPES.ToggleButton).toEqual([
      "selected",
      "disabled",
    ]);
    expect(STATE_VARIANT_BASE_TYPES.Checkbox).toEqual(["selected", "disabled"]);
    expect(STATE_VARIANT_BASE_TYPES.Switch).toEqual(["selected", "disabled"]);
    expect(stateVariantOriginId("component-togglebutton", "selected")).toBe(
      "component-togglebutton--selected",
    );
  });

  it("default origin 바로 오른쪽에 변형 origin 을 시드한다 — metadata.variant/variantOf · 이름 · style 비움 · 자식 동형", () => {
    const doc = docWithOrigins([
      buildCatalogOrigin("ToggleButton"),
      buildCatalogOrigin("Switch"),
    ]);
    const next = ensureStateVariantOrigins(doc);
    const ids = bodyChildren(next).map((n) => n.id);
    expect(ids).toEqual([
      "component-togglebutton",
      "component-togglebutton--selected",
      "component-togglebutton--disabled",
      "component-switch",
      "component-switch--selected",
      "component-switch--disabled",
    ]);

    const selected = bodyChildren(next)[1]!;
    expect(selected.type).toBe("ToggleButton");
    expect(selected.name).toBe("ToggleButton/Selected");
    expect(selected.reusable).toBe(true);
    expect(selected.metadata).toMatchObject({
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "ToggleButton",
      variant: "selected",
      variantOf: "component-togglebutton",
    });
    // 변형 origin 자체에 isSelected:true 를 굽지 않는다 — 해소기가 variant 로 상태를 가정.
    expect(selected.props?.isSelected).toBe(false);
    expect(selected.props?.style ?? {}).toEqual({});
    expect(selected.fills).toBeUndefined();

    const switchDisabled = bodyChildren(next)[5]!;
    expect(switchDisabled.children?.map((c) => c.id)).toEqual([
      "component-switch--disabled__1",
    ]);
    expect(switchDisabled.children?.[0]?.type).toBe("Label");
    expect(readStateVariantSelf(switchDisabled)).toEqual({
      state: "disabled",
      variantOf: "component-switch",
    });
    expect(readStateVariantSelf(bodyChildren(next)[3]!)).toBeNull();
  });

  it("Button 은 --disabled 만 · base origin 이 없는 타입은 시드하지 않는다", () => {
    const doc = docWithOrigins([buildCatalogOrigin("Button")]);
    const ids = bodyChildren(ensureStateVariantOrigins(doc)).map((n) => n.id);
    expect(ids).toEqual(["component-button", "component-button--disabled"]);
  });

  it("멱등 — 두 번째 호출은 같은 문서 객체 · 사용자가 편집한 변형 style 보존 · 위치 보존", () => {
    const once = ensureStateVariantOrigins(
      docWithOrigins([buildCatalogOrigin("Checkbox")]),
    );
    expect(ensureStateVariantOrigins(once)).toBe(once);

    const edited: CompositionDocument = {
      ...once,
      children: once.children.map((page) =>
        page.id !== "page-components"
          ? page
          : {
              ...page,
              children: page.children!.map((body) => ({
                ...body,
                children: body.children!.map((n) =>
                  n.id === "component-checkbox--selected"
                    ? {
                        ...n,
                        props: { ...n.props, style: { color: "#ff0000" } },
                        fills: [{ type: "color", color: "#00ff00" }],
                      }
                    : n,
                ),
              })),
            },
      ),
    };
    const again = ensureStateVariantOrigins(edited);
    expect(again).toBe(edited);
    const sel = bodyChildren(again).find(
      (n) => n.id === "component-checkbox--selected",
    )!;
    expect(sel.props?.style).toEqual({ color: "#ff0000" });
    expect(sel.fills).toEqual([{ type: "color", color: "#00ff00" }]);
  });

  it("Components 페이지 밖의 같은 id 노드는 무시하고 body 에만 둔다 · 다른 페이지 불변", () => {
    const doc = docWithOrigins([buildCatalogOrigin("Link")]);
    const next = ensureStateVariantOrigins(doc);
    expect(next.children[1]).toBe(doc.children[1]);
    expect(bodyChildren(next).map((n) => n.id)).toEqual([
      "component-link",
      "component-link--disabled",
    ]);
  });
});

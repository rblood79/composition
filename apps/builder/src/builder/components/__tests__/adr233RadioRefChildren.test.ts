// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";

/**
 * ADR-233 G0 ② — RadioGroup origin 자식을 Radio ref 로 둔 문서가 두 leg 에서 Radio 로 실체화되는가.
 *
 * Preview `renderRadioGroup` 은 자식을 `child.type === "Radio"` 로 거르고 (F16), Skia 는 Radio 의 선택을
 * 조상 RadioGroup `value` 로 판정한다 (F15). ref 자식이 `type:"ref"` 로 남으면 Preview 는 Radio 0개를
 * 그리고 Skia 는 조상 탐색이 끊긴다. 이 스위트는 base 해소기 (Preview `resolveCanonicalDocument` ·
 * Skia `buildCanonicalSceneModel`) 가 이미 master type 으로 실체화하는지 고정한다.
 */

function radioOrigin(): CanonicalNode {
  return {
    id: "component-radio",
    type: "Radio",
    reusable: true,
    props: { value: "radio", children: "Radio" },
    children: [
      { id: "component-radio__1", type: "Label", props: { children: "Radio" } },
    ],
  } as CanonicalNode;
}

function radioGroup(id: string, reusable: boolean): CanonicalNode {
  return {
    id,
    type: "RadioGroup",
    ...(reusable ? { reusable: true } : {}),
    props: { value: "b", label: "Group" },
    children: [
      { id: `${id}__label`, type: "Label", props: { children: "Group" } },
      { id: `${id}__a`, type: "ref", ref: "component-radio", props: { value: "a" } },
      { id: `${id}__b`, type: "ref", ref: "component-radio", props: { value: "b" } },
    ],
  } as CanonicalNode;
}

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "body-components",
            type: "Body",
            props: {},
            children: [radioOrigin(), radioGroup("component-radiogroup", true)],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [
              { id: "rg-inst", type: "ref", ref: "component-radiogroup", props: { value: "a" } },
              radioGroup("rg-plain", false),
            ],
          } as CanonicalNode,
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function walk(nodes: readonly unknown[], out: Map<string, Record<string, unknown>>) {
  for (const node of nodes) {
    const record = node as Record<string, unknown>;
    if (typeof record.id === "string") out.set(record.id, record);
    if (Array.isArray(record.children)) walk(record.children, out);
  }
  return out;
}

describe("ADR-233 G0 ② — RadioGroup 의 Radio ref 자식 두 leg 실체화", () => {
  it("Preview 해소기: plain RadioGroup · instance RadioGroup 의 ref 자식이 type Radio + value 유지", () => {
    const byId = walk(resolveCanonicalDocument(makeDoc()), new Map());
    const plainChildren = (byId.get("rg-plain")?.children ?? []) as Array<Record<string, unknown>>;
    const radios = plainChildren.filter((child) => child.type === "Radio");
    expect(radios.map((r) => (r.props as Record<string, unknown>).value)).toEqual(["a", "b"]);
    const instChildren = (byId.get("rg-inst")?.children ?? []) as Array<Record<string, unknown>>;
    expect(instChildren.filter((child) => child.type === "Radio")).toHaveLength(2);
  });

  it("Skia scene: ref 자식이 type Radio 이고 부모가 RadioGroup", () => {
    const model = buildCanonicalSceneModel(makeDoc(), { activeBreakpoint: "desktop" });
    for (const id of ["rg-plain__a", "rg-plain__b"]) {
      const node = model.sceneNodesMap.get(id);
      expect(node?.type, id).toBe("Radio");
      const parent = model.sceneNodesMap.get(String(node?.parentId));
      expect(parent?.type).toBe("RadioGroup");
    }
    const instRadios = [...model.sceneNodesMap.values()].filter(
      (node) => node.type === "Radio" && String(node.id).startsWith("rg-inst/"),
    );
    expect(instRadios).toHaveLength(2);
    for (const radio of instRadios) {
      expect(model.sceneNodesMap.get(String(radio.parentId))?.type).toBe("RadioGroup");
    }
  });
});

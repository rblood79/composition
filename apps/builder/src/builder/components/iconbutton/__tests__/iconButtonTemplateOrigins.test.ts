import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  extractTemplateBindingKeys,
  getReusableEntry,
  readPropsSchema,
  resolveEditContract,
} from "@composition/shared";

import {
  ensureIconButtonTemplateOrigins,
  ICONBUTTON_ORIGIN_ID,
  ICONBUTTON_PROPS_SCHEMA,
} from "../iconButtonTemplateOrigins";
import {
  REUSABLE_ORIGIN_ENSURERS,
  getReusableCompositeOriginId,
  isReusableCompositeType,
} from "../../reusableCompositeOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

describe("ADR-148 Phase 2 IconButton reusable origin", () => {
  it("bootstraps the IconButton origin (Button > Icon + Text) with propsSchema", () => {
    const doc = ensureIconButtonTemplateOrigins(makeDocument());

    const origin = findById(doc.children, ICONBUTTON_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: ICONBUTTON_ORIGIN_ID,
      type: "Button",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "IconButton",
        systemOwned: true,
      }),
    });
    expect(readPropsSchema(origin)).toEqual(ICONBUTTON_PROPS_SCHEMA);

    // 조합 자식: Icon(slotRole:icon, optional) + Text(slotRole:label)
    expect(origin?.children?.map((c) => c.type)).toEqual(["Icon", "Text"]);
    expect(origin?.children?.[0]).toMatchObject({
      props: { slot: "icon", iconName: "{icon}" },
      metadata: expect.objectContaining({ slotRole: "icon", optional: true }),
    });
    expect(origin?.children?.[1]).toMatchObject({
      props: { slot: "label", children: "{label}" },
      metadata: expect.objectContaining({ slotRole: "label" }),
    });
  });

  it("is idempotent — 재적용해도 내용 무변 + origin 중복 seed 없음", () => {
    const once = ensureIconButtonTemplateOrigins(makeDocument());
    const twice = ensureIconButtonTemplateOrigins(once);
    expect(twice).toEqual(once);

    const componentsBody = findById(twice.children, "page-components-body");
    const origins = (componentsBody?.children ?? []).filter(
      (c) => c.id === ICONBUTTON_ORIGIN_ID,
    );
    expect(origins).toHaveLength(1);
  });

  it("catalog reusable entry / ensurer / origin id 가 정합한다", () => {
    expect(getReusableEntry("IconButton")?.reusableId).toBe(
      ICONBUTTON_ORIGIN_ID,
    );
    expect(isReusableCompositeType("IconButton")).toBe(true);
    expect(getReusableCompositeOriginId("IconButton")).toBe(
      ICONBUTTON_ORIGIN_ID,
    );
    expect(REUSABLE_ORIGIN_ENSURERS[ICONBUTTON_ORIGIN_ID]).toBe(
      ensureIconButtonTemplateOrigins,
    );
  });

  /**
   * ADR-148 R2 — propsSchema ↔ 템플릿 바인딩 키 1:1 정적 검증.
   * 두 축으로 나뉜다:
   * - placeholder 축: origin 자식의 `{키}` 전부가 propsSchema 에 선언돼 있어야 한다
   *   (미선언 placeholder = 치환 gate 가 값을 못 채워 시각 무반응).
   * - passthrough 축: placeholder 가 아닌 schema 키(variant/size)는 origin root props
   *   에 기본값이 있어야 한다 (resolve merge 로 Button 이 직접 소비).
   */
  it("R2 — 템플릿 placeholder ↔ propsSchema 키 1:1 (placeholder ⊆ schema, 잔여 키는 root props passthrough)", () => {
    const doc = ensureIconButtonTemplateOrigins(makeDocument());
    const origin = findById(doc.children, ICONBUTTON_ORIGIN_ID);
    expect(origin).toBeDefined();

    const placeholderKeys = extractTemplateBindingKeys(origin);
    const schemaKeys = new Set(Object.keys(ICONBUTTON_PROPS_SCHEMA));

    // placeholder 축
    for (const key of placeholderKeys) {
      expect(
        schemaKeys.has(key),
        `origin 템플릿 placeholder "{${key}}" 가 propsSchema 에 미선언 — 편집 UI 없는 dead 바인딩`,
      ).toBe(true);
    }

    // passthrough 축
    for (const key of schemaKeys) {
      if (placeholderKeys.has(key)) continue;
      expect(
        Object.hasOwn(origin?.props ?? {}, key),
        `propsSchema 키 "${key}" 가 placeholder 도 origin root props 도 아님 — 편집해도 시각 무반응 (R2)`,
      ).toBe(true);
    }
  });

  it("Inspector — ref instance 선택 시 propsSchema 가 semantic 필드로 파생된다", () => {
    const doc = ensureIconButtonTemplateOrigins(makeDocument());
    const instance = {
      id: "inst-1",
      type: "ref",
      ref: ICONBUTTON_ORIGIN_ID,
      props: { label: "Save" },
    } as unknown as CanonicalNode;

    const contract = resolveEditContract(instance, doc);
    const semantic = contract.fields.filter((f) => f.origin === "semantic");
    expect(semantic.map((f) => f.key).sort()).toEqual([
      "icon",
      "label",
      "size",
      "variant",
    ]);

    const label = semantic.find((f) => f.key === "label");
    expect(label).toMatchObject({
      isOverridden: true,
      currentValue: "Save",
      baseValue: "Button",
    });
    const icon = semantic.find((f) => f.key === "icon");
    expect(icon).toMatchObject({
      isOverridden: false,
      currentValue: "star",
    });
    // variant/size 옵션은 origin root type(Button)의 theme rule 에서 파생돼야 한다.
    const variant = semantic.find((f) => f.key === "variant");
    expect(variant?.options?.map((o) => o.value)).toContain("primary");
    const size = semantic.find((f) => f.key === "size");
    expect(size?.options?.map((o) => o.value)).toContain("md");
  });

  it("Inspector — propsSchema 미선언 reusable(Toolbar)은 semantic 필드 없음 유지", () => {
    const doc = ensureIconButtonTemplateOrigins(makeDocument());
    const instance = {
      id: "inst-2",
      type: "ref",
      ref: "component-toolbar",
      props: {},
    } as unknown as CanonicalNode;

    const contract = resolveEditContract(instance, doc);
    expect(contract.fields.filter((f) => f.origin === "semantic")).toEqual([]);
  });
});

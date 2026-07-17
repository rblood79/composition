import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  extractTemplateBindingKeys,
  getReusableEntry,
  readPropsSchema,
  resolveEditContract,
} from "@composition/shared";

import {
  ensureInlineAlertTemplateOrigins,
  INLINE_ALERT_ORIGIN_ID,
  INLINE_ALERT_PROPS_SCHEMA,
} from "../inlineAlertTemplateOrigins";
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

describe("ADR-148 Phase 3 InlineAlert reusable origin", () => {
  it("bootstraps the InlineAlert origin (InlineAlert > Heading + Description) with propsSchema", () => {
    const doc = ensureInlineAlertTemplateOrigins(makeDocument());

    const origin = findById(doc.children, INLINE_ALERT_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: INLINE_ALERT_ORIGIN_ID,
      type: "InlineAlert",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "InlineAlert",
        systemOwned: true,
      }),
    });
    expect(readPropsSchema(origin)).toEqual(INLINE_ALERT_PROPS_SCHEMA);

    // 조합 자식: Heading(slotRole:label, {title}) + Description(slotRole:description, {description})
    expect(origin?.children?.map((c) => c.type)).toEqual([
      "Heading",
      "Description",
    ]);
    expect(origin?.children?.[0]).toMatchObject({
      props: { slot: "label", children: "{title}", level: 3 },
      metadata: expect.objectContaining({ slotRole: "label" }),
    });
    expect(origin?.children?.[1]).toMatchObject({
      props: { slot: "description", children: "{description}" },
      metadata: expect.objectContaining({ slotRole: "description" }),
    });
  });

  it("is idempotent — 재적용해도 내용 무변 + origin 중복 seed 없음", () => {
    const once = ensureInlineAlertTemplateOrigins(makeDocument());
    const twice = ensureInlineAlertTemplateOrigins(once);
    expect(twice).toEqual(once);

    const componentsBody = findById(twice.children, "page-components-body");
    const origins = (componentsBody?.children ?? []).filter(
      (c) => c.id === INLINE_ALERT_ORIGIN_ID,
    );
    expect(origins).toHaveLength(1);
  });

  it("catalog reusable entry / ensurer / origin id 가 정합한다", () => {
    expect(getReusableEntry("InlineAlert")?.reusableId).toBe(
      INLINE_ALERT_ORIGIN_ID,
    );
    expect(isReusableCompositeType("InlineAlert")).toBe(true);
    expect(getReusableCompositeOriginId("InlineAlert")).toBe(
      INLINE_ALERT_ORIGIN_ID,
    );
    expect(REUSABLE_ORIGIN_ENSURERS[INLINE_ALERT_ORIGIN_ID]).toBe(
      ensureInlineAlertTemplateOrigins,
    );
  });

  it("R2 — 템플릿 placeholder ↔ propsSchema 키 1:1 (placeholder ⊆ schema, 잔여 키는 root props passthrough)", () => {
    const doc = ensureInlineAlertTemplateOrigins(makeDocument());
    const origin = findById(doc.children, INLINE_ALERT_ORIGIN_ID);
    expect(origin).toBeDefined();

    const placeholderKeys = extractTemplateBindingKeys(origin);
    const schemaKeys = new Set(Object.keys(INLINE_ALERT_PROPS_SCHEMA));

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
    const doc = ensureInlineAlertTemplateOrigins(makeDocument());
    const instance = {
      id: "inst-1",
      type: "ref",
      ref: INLINE_ALERT_ORIGIN_ID,
      props: { title: "Saved!" },
    } as unknown as CanonicalNode;

    const contract = resolveEditContract(instance, doc);
    const semantic = contract.fields.filter((f) => f.origin === "semantic");
    expect(semantic.map((f) => f.key).sort()).toEqual([
      "description",
      "title",
      "variant",
    ]);

    const title = semantic.find((f) => f.key === "title");
    expect(title).toMatchObject({
      isOverridden: true,
      currentValue: "Saved!",
      baseValue: "Alert Heading",
    });
    const description = semantic.find((f) => f.key === "description");
    expect(description).toMatchObject({ isOverridden: false });
    // variant 옵션은 origin root type(InlineAlert)의 theme rule 에서 파생돼야 한다.
    const variant = semantic.find((f) => f.key === "variant");
    expect(variant?.options?.map((o) => o.value)).toContain("info");
  });
});

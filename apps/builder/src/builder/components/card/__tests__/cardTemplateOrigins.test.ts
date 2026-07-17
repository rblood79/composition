import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  extractTemplateBindingKeys,
  getReusableEntry,
  readPropsSchema,
  resolveEditContract,
} from "@composition/shared";

import {
  CARD_ORIGIN_ID,
  CARD_PROPS_SCHEMA,
  ensureCardTemplateOrigins,
} from "../cardTemplateOrigins";
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

describe("ADR-148 Phase 3 Card reusable origin (4-region)", () => {
  it("bootstraps the Card origin (Card > Preview/Header/Content/Footer) with propsSchema", () => {
    const doc = ensureCardTemplateOrigins(makeDocument());

    const origin = findById(doc.children, CARD_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: CARD_ORIGIN_ID,
      type: "Card",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "Card",
        systemOwned: true,
      }),
    });
    expect(readPropsSchema(origin)).toEqual(CARD_PROPS_SCHEMA);

    // 4-region 자식 — 구 factory 자식 트리 승계 + slotRole named-region vocabulary.
    expect(origin?.children?.map((c) => c.type)).toEqual([
      "CardPreview",
      "CardHeader",
      "CardContent",
      "CardFooter",
    ]);
    expect(origin?.children?.map((c) => c.metadata?.slotRole ?? null)).toEqual([
      "preview",
      "header",
      "content",
      "footer",
    ]);

    // 템플릿 바인딩은 depth-2 자식(Heading/Description)에 위치한다.
    const title = findById(doc.children, `${CARD_ORIGIN_ID}__title`);
    expect(title).toMatchObject({
      type: "Heading",
      props: { children: "{title}", level: 3 },
    });
    const description = findById(
      doc.children,
      `${CARD_ORIGIN_ID}__description`,
    );
    expect(description).toMatchObject({
      type: "Description",
      props: { children: "{description}" },
    });
  });

  it("is idempotent — 재적용해도 내용 무변 + origin 중복 seed 없음", () => {
    const once = ensureCardTemplateOrigins(makeDocument());
    const twice = ensureCardTemplateOrigins(once);
    expect(twice).toEqual(once);

    const componentsBody = findById(twice.children, "page-components-body");
    const origins = (componentsBody?.children ?? []).filter(
      (c) => c.id === CARD_ORIGIN_ID,
    );
    expect(origins).toHaveLength(1);
  });

  it("catalog reusable entry / ensurer / origin id 가 정합한다", () => {
    expect(getReusableEntry("Card")?.reusableId).toBe(CARD_ORIGIN_ID);
    expect(isReusableCompositeType("Card")).toBe(true);
    expect(getReusableCompositeOriginId("Card")).toBe(CARD_ORIGIN_ID);
    expect(REUSABLE_ORIGIN_ENSURERS[CARD_ORIGIN_ID]).toBe(
      ensureCardTemplateOrigins,
    );
  });

  it("R2 — 템플릿 placeholder ↔ propsSchema 키 1:1 (placeholder ⊆ schema, 잔여 키는 root props passthrough)", () => {
    const doc = ensureCardTemplateOrigins(makeDocument());
    const origin = findById(doc.children, CARD_ORIGIN_ID);
    expect(origin).toBeDefined();

    const placeholderKeys = extractTemplateBindingKeys(origin);
    // depth-2 placeholder 추출 자체가 계약이다 (Card 는 IconButton 과 달리 중첩 위치).
    expect([...placeholderKeys].sort()).toEqual(["description", "title"]);
    const schemaKeys = new Set(Object.keys(CARD_PROPS_SCHEMA));

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
    const doc = ensureCardTemplateOrigins(makeDocument());
    const instance = {
      id: "inst-1",
      type: "ref",
      ref: CARD_ORIGIN_ID,
      props: { variant: "secondary" },
    } as unknown as CanonicalNode;

    const contract = resolveEditContract(instance, doc);
    const semantic = contract.fields.filter((f) => f.origin === "semantic");
    expect(semantic.map((f) => f.key).sort()).toEqual([
      "description",
      "size",
      "title",
      "variant",
    ]);

    const title = semantic.find((f) => f.key === "title");
    expect(title).toMatchObject({
      isOverridden: false,
      currentValue: "Card Title",
    });
    const variant = semantic.find((f) => f.key === "variant");
    expect(variant).toMatchObject({
      isOverridden: true,
      currentValue: "secondary",
      baseValue: "primary",
    });
    // variant/size 옵션은 origin root type(Card)의 theme rule 에서 파생돼야 한다.
    expect(variant?.options?.map((o) => o.value)).toContain("primary");
    const size = semantic.find((f) => f.key === "size");
    expect(size?.options?.map((o) => o.value)).toContain("md");
  });
});

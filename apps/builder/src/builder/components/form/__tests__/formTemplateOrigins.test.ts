import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  ensureFormTemplateOrigins,
  FORM_ORIGIN_ID,
} from "../formTemplateOrigins";
import {
  REUSABLE_COMPOSITE_ORIGINS,
  ensureReusableCompositeOrigins,
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

describe("ADR-912 R-5 Form reusable composite origin (2단 중첩)", () => {
  it("bootstraps the Form origin under the Components page with Heading + Description + FormField×2", () => {
    const doc = ensureFormTemplateOrigins(makeDocument());

    // Components system page 가 보장됨
    const componentsPage = findById(doc.children, "page-components");
    expect(componentsPage).toMatchObject({
      name: "Components",
      metadata: expect.objectContaining({ pageRole: "components" }),
    });

    // Form origin = reusable composite (direct children, slot 없음)
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: FORM_ORIGIN_ID,
      type: "Form",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "Form",
        systemOwned: true,
      }),
    });

    // 조합 자식 = Heading + Description + FormField×2 (종전 createFormDefinition 1:1)
    const children = origin?.children ?? [];
    const types = children.map((c) => c.type);
    expect(types).toEqual(["Heading", "Description", "FormField", "FormField"]);

    const heading = children.find((c) => c.type === "Heading");
    expect((heading?.props as { children?: string }).children).toBe(
      "Form Title",
    );
  });

  it("preserves the 2-level nested tree (FormField > Label + TextField) intact", () => {
    const doc = ensureFormTemplateOrigins(makeDocument());
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    // FormField 는 childSpec 라 ComponentTag union 비멤버 → string 비교로 좁힘
    const fields = (origin?.children ?? []).filter(
      (c) => (c.type as string) === "FormField",
    );
    expect(fields).toHaveLength(2);

    // 각 FormField 가 2단 중첩(Label + TextField)을 무손실 보존
    const labels: string[] = [];
    for (const field of fields) {
      const inner = field.children ?? [];
      expect(inner.map((c) => c.type)).toEqual(["Label", "TextField"]);
      const label = inner.find((c) => c.type === "Label");
      labels.push((label?.props as { children?: string }).children ?? "");
    }
    expect(labels).toEqual(["Field Label", "Another Field"]);
  });

  it("is idempotent — re-running produces identical content (no duplicate origins)", () => {
    const once = ensureFormTemplateOrigins(makeDocument());
    const twice = ensureFormTemplateOrigins(once);
    expect(twice).toEqual(once);

    // origin 이 중복 seed 되지 않음 (strip + re-add 멱등)
    const componentsBody = findById(twice.children, "page-components-body");
    const formOrigins = (componentsBody?.children ?? []).filter(
      (c) => c.id === FORM_ORIGIN_ID,
    );
    expect(formOrigins).toHaveLength(1);
  });

  it("preserves user edits to an existing origin (repair-not-overwrite)", () => {
    const seeded = ensureFormTemplateOrigins(makeDocument());
    // 사용자가 origin children 을 편집 (FormField 하나 제거)
    const edited: CompositionDocument = JSON.parse(JSON.stringify(seeded));
    const origin = findById(edited.children, FORM_ORIGIN_ID);
    if (origin) origin.children = (origin.children ?? []).slice(0, 2);

    const reEnsured = ensureFormTemplateOrigins(edited);
    const reOrigin = findById(reEnsured.children, FORM_ORIGIN_ID);
    // children 은 사용자 편집 보존 (createFormOrigin 으로 덮어쓰지 않음)
    expect(reOrigin?.children?.length).toBe(2);
    // system metadata 는 회복
    expect(reOrigin?.metadata).toMatchObject({
      systemOwned: true,
      componentFamily: "Form",
    });
  });
});

describe("ADR-912 R-5 reusable composite registry — Form 합류 (코드 변경 0)", () => {
  it("maps Form to its origin id without touching factory code", () => {
    expect(REUSABLE_COMPOSITE_ORIGINS.Form).toBe(FORM_ORIGIN_ID);
    expect(isReusableCompositeType("Form")).toBe(true);
    expect(getReusableCompositeOriginId("Form")).toBe(FORM_ORIGIN_ID);
  });

  it("ensureReusableCompositeOrigins seeds both Toolbar and Form origins", () => {
    const doc = ensureReusableCompositeOrigins(makeDocument());
    expect(findById(doc.children, FORM_ORIGIN_ID)).toBeDefined();
    expect(findById(doc.children, "component-toolbar")).toBeDefined();
  });
});

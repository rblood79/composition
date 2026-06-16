import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  ensureToolbarTemplateOrigins,
  TOOLBAR_ORIGIN_ID,
} from "../toolbarTemplateOrigins";
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

describe("ADR-912 R-5 Toolbar reusable composite origin", () => {
  it("bootstraps the Toolbar origin under the Components page with Button×3 + Separator", () => {
    const doc = ensureToolbarTemplateOrigins(makeDocument());

    // Components system page 가 보장됨
    const componentsPage = findById(doc.children, "page-components");
    expect(componentsPage).toMatchObject({
      name: "Components",
      metadata: expect.objectContaining({ pageRole: "components" }),
    });

    // Toolbar origin = reusable composite (direct children, slot 없음)
    const origin = findById(doc.children, TOOLBAR_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: TOOLBAR_ORIGIN_ID,
      type: "Toolbar",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "Toolbar",
        systemOwned: true,
      }),
    });

    // 조합 자식 = Button×3 + Separator (종전 createToolbarDefinition 1:1)
    const children = origin?.children ?? [];
    const types = children.map((c) => c.type);
    expect(types).toEqual(["Button", "Button", "Separator", "Button"]);

    const buttonLabels = children
      .filter((c) => c.type === "Button")
      .map((c) => (c.props as { children?: string }).children);
    expect(buttonLabels).toEqual(["Action 1", "Action 2", "Action 3"]);

    const separator = children.find((c) => c.type === "Separator");
    expect(separator?.props).toMatchObject({
      orientation: "vertical",
      style: { width: "1px", height: "20px" },
    });
  });

  it("is idempotent — re-running produces identical content (no duplicate origins)", () => {
    const once = ensureToolbarTemplateOrigins(makeDocument());
    const twice = ensureToolbarTemplateOrigins(once);
    expect(twice).toEqual(once);

    // origin 이 중복 seed 되지 않음 (strip + re-add 멱등)
    const componentsBody = findById(twice.children, "page-components-body");
    const toolbarOrigins = (componentsBody?.children ?? []).filter(
      (c) => c.id === TOOLBAR_ORIGIN_ID,
    );
    expect(toolbarOrigins).toHaveLength(1);
  });

  it("preserves user edits to an existing origin (repair-not-overwrite)", () => {
    const seeded = ensureToolbarTemplateOrigins(makeDocument());
    // 사용자가 origin children 을 편집 (Separator 제거)
    const edited: CompositionDocument = JSON.parse(JSON.stringify(seeded));
    const origin = findById(edited.children, TOOLBAR_ORIGIN_ID);
    if (origin) origin.children = (origin.children ?? []).slice(0, 1);

    const reEnsured = ensureToolbarTemplateOrigins(edited);
    const reOrigin = findById(reEnsured.children, TOOLBAR_ORIGIN_ID);
    // children 은 사용자 편집 보존 (createToolbarOrigin 으로 덮어쓰지 않음)
    expect(reOrigin?.children?.length).toBe(1);
    // system metadata 는 회복
    expect(reOrigin?.metadata).toMatchObject({
      systemOwned: true,
      componentFamily: "Toolbar",
    });
  });
});

describe("ADR-912 R-5 reusable composite registry", () => {
  it("maps Toolbar to its origin id (code change 0 enabler)", () => {
    expect(REUSABLE_COMPOSITE_ORIGINS.Toolbar).toBe(TOOLBAR_ORIGIN_ID);
    expect(isReusableCompositeType("Toolbar")).toBe(true);
    expect(getReusableCompositeOriginId("Toolbar")).toBe(TOOLBAR_ORIGIN_ID);
  });

  it("returns null / false for non-composite types", () => {
    expect(isReusableCompositeType("Button")).toBe(false);
    expect(getReusableCompositeOriginId("Button")).toBeNull();
  });

  it("ensureReusableCompositeOrigins seeds the Toolbar origin", () => {
    const doc = ensureReusableCompositeOrigins(makeDocument());
    expect(findById(doc.children, TOOLBAR_ORIGIN_ID)).toBeDefined();
  });
});

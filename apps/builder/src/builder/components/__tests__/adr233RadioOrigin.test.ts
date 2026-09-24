import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  NESTED_REUSABLE_ORIGIN_TYPES,
  PALETTE_REUSABLE_ORIGIN_TYPES,
  getCatalogEntry,
  getReusableEntry,
  getReusableOriginId,
} from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { buildCatalogOrigin, getCatalogOriginTypes } from "../catalogOrigins";
import { STATE_VARIANT_BASE_TYPES } from "../stateVariantOrigins";

/**
 * ADR-233 Phase 2 — Radio 를 팔레트 밖 reusable origin 으로 등록한다.
 *
 * - 등록: reusable entry 1 (다른 reusable 과 같은 모양 — primitive placeable:false) · 팔레트 노출 0 은
 *   `PALETTE_ORDER` 정본 (Radio 없음) · 팔레트 목록 불변.
 * - seed: `component-radio` = `buildCatalogOrigin("Radio")` (factory 와 같은 트리).
 * - 조합 자식 규칙 (ADR-229): **새로 생기는** `component-radiogroup` origin 의 Radio 자식 → ref.
 *   기존 문서의 RadioGroup origin 자식은 plain 그대로 (2단 seed, F12).
 * - 상태 변형 (ADR-230 경로): Radio × [selected, disabled, hover, pressed, focus-visible].
 */

function emptyDocument(): CompositionDocument {
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ADR-233 Phase 2 — Radio origin", () => {
  it("등록 — Radio 는 팔레트 밖 reusable (reusable 이 placeable · primitive 는 false — R②) 이고 팔레트 목록은 그대로", () => {
    // ADR-239 Phase 4 — ColorSwatchPicker · ColorSwatch 가 같은 목록에 합류.
    expect(NESTED_REUSABLE_ORIGIN_TYPES).toEqual([
      "Radio",
      "ColorSwatchPicker",
      "ColorSwatch",
    ]);
    expect(PALETTE_REUSABLE_ORIGIN_TYPES).not.toContain("Radio");
    const entry = getReusableEntry("Radio");
    expect(entry?.reusableId).toBe("component-radio");
    expect(entry?.panel.placeable).toBe(true);
    expect(getCatalogEntry("Radio")?.panel.placeable).toBe(false);
    expect(getReusableOriginId("Radio")).toBe("component-radio");
    expect(getCatalogOriginTypes()).toContain("Radio");
  });

  it("새 문서 — component-radio seed = factory 트리, 새 RadioGroup origin 의 Radio 자식은 ref (변환 보류 0)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = ensureReusableCompositeOrigins(emptyDocument());
    const radio = findById(doc.children, "component-radio")!;
    const generic = buildCatalogOrigin("Radio");
    expect(radio.type).toBe("Radio");
    expect(radio.reusable).toBe(true);
    expect(radio.children?.map((c) => c.type)).toEqual(
      generic.children?.map((c) => c.type),
    );
    const group = findById(doc.children, "component-radiogroup")!;
    const radios = (group.children ?? []).filter(
      (child) => child.type === "ref",
    );
    expect(radios.length).toBeGreaterThanOrEqual(2);
    for (const child of radios) {
      expect((child as { ref?: string }).ref).toBe("component-radio");
    }
    // Radio 는 plain 으로 남지 않는다.
    expect((group.children ?? []).some((child) => child.type === "Radio")).toBe(
      false,
    );
    // Radio 변환 보류 0 (subtree 불일치 등). CardView → Card 보류 3 은 233 이전부터 있던 경고.
    const radioWarnings = warn.mock.calls
      .filter((call) =>
        String(call[0]).includes("ADR-229 조합 자식 ref 변환 보류"),
      )
      .flatMap((call) => call[1] as string[])
      .filter((line) => line.includes("component-radio"));
    expect(radioWarnings).toEqual([]);
  });

  it("기존 문서 — 이미 있던 component-radiogroup 의 plain Radio 자식은 그대로 (F12 · BC i)", () => {
    // ADR-233 이전 모양: RadioGroup origin 은 있고 Radio origin 은 없다.
    const before = ensureReusableCompositeOrigins(emptyDocument());
    const legacyGroup = buildCatalogOrigin("RadioGroup");
    const strip = (nodes: CanonicalNode[]): CanonicalNode[] =>
      nodes
        .filter((node) => !node.id.startsWith("component-radio") || node.id === "component-radiogroup")
        .map((node) => {
          if (node.id === "component-radiogroup") {
            return { ...legacyGroup, id: node.id };
          }
          return node.children ? { ...node, children: strip(node.children) } : node;
        });
    const pre233: CompositionDocument = {
      ...before,
      children: strip(before.children),
    };
    expect(findById(pre233.children, "component-radio")).toBeUndefined();
    const plainBefore = findById(pre233.children, "component-radiogroup")!;
    expect(plainBefore.children?.some((c) => c.type === "Radio")).toBe(true);

    const after = ensureReusableCompositeOrigins(pre233);
    expect(findById(after.children, "component-radio")).toBeDefined();
    const groupAfter = findById(after.children, "component-radiogroup")!;
    expect(JSON.stringify(groupAfter.children)).toBe(
      JSON.stringify(plainBefore.children),
    );
  });

  it("상태 변형 — Radio × 5 (selected · disabled · hover · pressed · focus-visible) 이 default 옆에 시드된다", () => {
    expect(STATE_VARIANT_BASE_TYPES.Radio).toEqual([
      "selected",
      "disabled",
      "hover",
      "pressed",
      "focus-visible",
    ]);
    // ADR-234: origin = 선택 상태 (표식) · 휴지 모양은 `--unselected` · 변형은 origin 의 ref.
    const doc = ensureReusableCompositeOrigins(emptyDocument());
    expect(findById(doc.children, "component-radio")?.metadata).toMatchObject({
      variant: "selected",
    });
    expect(findById(doc.children, "component-radio--selected")).toBeUndefined();
    for (const state of STATE_VARIANT_BASE_TYPES.Radio.map((s) =>
      s === "selected" ? "unselected" : s,
    )) {
      const variant = findById(doc.children, `component-radio--${state}`);
      expect(variant, state).toMatchObject({
        type: "ref",
        ref: "component-radio",
        metadata: { variant: state },
      });
    }
  });

  it("재hydration 멱등", () => {
    const once = ensureReusableCompositeOrigins(emptyDocument());
    expect(JSON.stringify(ensureReusableCompositeOrigins(once))).toBe(
      JSON.stringify(once),
    );
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { applyCanonicalDocumentMigrations } from "../canonicalDocumentMigrations";
import { normalizeCompositionImportPayload } from "../../../resolvers/canonical/importPayloadAdapter";

/**
 * ADR-923 r17m2 (2026-09-01) — 형태 migration 단일 체인 + 세 진입점 (hydration · persist-back · external
 * import) 결선 가드. 종전엔 두 체인이 4개 migration 을 각자 중첩 호출하고 import 는 어느 것도 안 거쳐
 * import master 의 legacy ColorField 가 Preview 무라벨 / Skia "Color" 로 남았다.
 */
function node(
  type: string,
  id: string,
  props: Record<string, unknown> = {},
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    type,
    id,
    props,
    ...(children ? { children } : {}),
  } as CanonicalNode;
}

const legacyColorFieldDoc = (): CompositionDocument =>
  ({
    version: "composition-1.0",
    children: [
      node("body", "body", {}, [
        node("ColorField", "cf", { labelPosition: "top" }, [
          node("Label", "cf-l", { children: "Legacy Color" }),
          node("Input", "cf-i", { placeholder: "#000000" }),
        ]),
      ]),
    ],
  }) as CompositionDocument;

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = findNode(n.children ?? [], id);
    if (f) return f;
  }
  return undefined;
}

describe("applyCanonicalDocumentMigrations", () => {
  it("legacy ColorField parent label 을 채운다 · 멱등 (변경 없으면 같은 참조)", () => {
    const out = applyCanonicalDocumentMigrations(legacyColorFieldDoc());
    expect(findNode(out.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
    expect(applyCanonicalDocumentMigrations(out)).toBe(out);
  });
  it("external import (CompositionDocument payload) 도 같은 체인을 통과한다 (r17m2)", () => {
    const out = normalizeCompositionImportPayload(
      legacyColorFieldDoc(),
      "test://import",
    );
    expect(findNode(out.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
  });
  it("정적 결선: 세 진입점이 단일 체인만 호출하고 개별 migration 을 직접 부르지 않는다", () => {
    const root = resolve(__dirname, "../../../..");
    const entries = [
      "src/adapters/canonical/index.ts",
      "src/builder/hooks/usePageManager.ts",
      "src/resolvers/canonical/importPayloadAdapter.ts",
    ];
    const individual = [
      "migrateCheckboxRadioItemsStructure(",
      "migrateColorFieldParentLabel(",
      "migrateFieldInlineLayout(",
      "migrateCircleLeafInlineSize(",
    ];
    for (const rel of entries) {
      const src = readFileSync(resolve(root, rel), "utf8");
      expect(src, rel).toContain("applyCanonicalDocumentMigrations(");
      for (const name of individual) {
        expect(src, `${rel} 이 ${name} 을 직접 호출`).not.toContain(name);
      }
    }
  });
});

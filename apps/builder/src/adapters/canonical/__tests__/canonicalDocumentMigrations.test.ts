import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { applyCanonicalDocumentMigrations } from "../canonicalDocumentMigrations";
import { normalizeMainDocument } from "../mainDocumentNormalization";
import { normalizeCompositionImportPayload } from "../../../resolvers/canonical/importPayloadAdapter";

/**
 * ADR-923 r17m2 → r18m2/r18m3 (2026-09-01) — 형태 migration 단일 체인 + main document 정규화 체인의
 * 결선 가드.
 *
 * - r17m2: 두 체인이 4개 migration 을 각자 중첩 호출하고 import 는 어느 것도 안 거쳐 import master 의
 *   legacy ColorField 가 Preview 무라벨 / Skia "Color" 로 남았다.
 * - r18m2: 진입점 인벤토리가 hydration · persist-back · import 에 한정돼 **전체 문서 교체 경계**
 *   (`applySnapshotDocument` — snapshot 복원 · undo/redo 재적용 · 프로젝트 JSON 파일 가져오기) 를
 *   빠뜨렸다 → origin 시드 + 형태 migration 을 `normalizeMainDocument` 한 함수로 모으고 main document
 *   경계 3곳이 전부 이것을 호출한다 (기능 게이트: `stores/history/__tests__/snapshotRestoreNormalization`).
 * - r18m3: import adapter 의 파일 단위 "문자열 1회 이상" 게이트가 한 분기의 누락을 못 잡았다 →
 *   변환 (3 분기) 과 migration (단일 출구) 을 분리하고 분기별 기능 테스트 + 단일 출구 정적 게이트.
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

/**
 * Pencil 분기용 legacy 형태 — field 가족의 inline `display`/`flexDirection` (migrateFieldInlineLayout 이
 * 제거). Pencil 노드는 `children` 이 노드 필드라 Label 텍스트를 실을 수 없어 ColorField label 이 아닌
 * 이 migration 으로 통과 여부를 잰다. `metadata.compositionType` 으로 canonical 타입을 지정.
 */
const legacyTextFieldPencilNode = () => ({
  id: "tf",
  type: "frame",
  metadata: { compositionType: "TextField" },
  style: { display: "flex", flexDirection: "column", width: "200px" },
});

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
});

describe("normalizeMainDocument (r18m2) — origin 시드 + 형태 migration 단일 체인", () => {
  it("형태 migration 을 포함하고 (ColorField label) 멱등이다", () => {
    const once = normalizeMainDocument(legacyColorFieldDoc());
    expect(findNode(once.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
    const twice = normalizeMainDocument(once);
    expect(twice).toEqual(once);
  });
});

describe("normalizeCompositionImportPayload (r17m2 → r18m3) — 세 분기 전부 같은 체인", () => {
  it("CompositionDocument payload", () => {
    const out = normalizeCompositionImportPayload(
      legacyColorFieldDoc(),
      "test://import",
    );
    expect(findNode(out.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
  });
  it("Pencil document payload (`{children: [...]}`, version 없음)", () => {
    const out = normalizeCompositionImportPayload(
      { children: [legacyTextFieldPencilNode()] },
      "test://pencil-doc",
    );
    const tf = findNode(out.children, "tf")!;
    expect(tf.type).toBe("TextField");
    expect(tf.props).toMatchObject({ style: { width: "200px" } });
    expect(
      (tf.props as { style: Record<string, unknown> }).style,
    ).not.toHaveProperty("display");
  });
  it("Pencil node payload (`{id, type, ...}` 단일 노드)", () => {
    const out = normalizeCompositionImportPayload(
      legacyTextFieldPencilNode(),
      "test://pencil-node",
    );
    const tf = findNode(out.children, "tf")!;
    expect(tf.type).toBe("TextField");
    expect(
      (tf.props as { style: Record<string, unknown> }).style,
    ).not.toHaveProperty("display");
  });
});

describe("정적 결선 (r17m2 → r18m2/r18m3)", () => {
  const root = resolve(__dirname, "../../../..");
  const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
  const individualMigrations = [
    "migrateCheckboxRadioItemsStructure(",
    "migrateColorFieldParentLabel(",
    "migrateFieldInlineLayout(",
    "migrateCircleLeafInlineSize(",
  ];
  const seeds = [
    "ensureReusableCompositeOrigins(",
    "ensureMenuTemplateOrigins(",
    "ensureGridListTemplateOrigins(",
    "migrateLegacyListBoxTemplatesToOrigins(",
  ];

  it("main document 경계 3곳 (hydration · persist-back · 전체 문서 교체) 은 normalizeMainDocument 만 호출한다", () => {
    for (const rel of [
      "src/adapters/canonical/index.ts",
      "src/builder/hooks/usePageManager.ts",
      "src/builder/stores/history/snapshotRestore.ts",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("normalizeMainDocument(");
      for (const name of [
        ...individualMigrations,
        ...seeds,
        "applyCanonicalDocumentMigrations(",
      ]) {
        expect(src, `${rel} 이 ${name} 을 직접 호출`).not.toContain(name);
      }
    }
  });
  it("normalizeMainDocument 만이 시드 + 형태 체인을 조립한다", () => {
    const src = read("src/adapters/canonical/mainDocumentNormalization.ts");
    for (const name of seeds) expect(src).toContain(name);
    expect(src).toContain("applyCanonicalDocumentMigrations(");
    for (const name of individualMigrations) expect(src).not.toContain(name);
  });
  it("import adapter 는 단일 출구 — applyCanonicalDocumentMigrations(convertImportPayload(...)) 1회, 분기 안 호출 0", () => {
    const src = read("src/resolvers/canonical/importPayloadAdapter.ts");
    const calls = src.match(/applyCanonicalDocumentMigrations\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(src).toMatch(
      /return applyCanonicalDocumentMigrations\(\s*convertImportPayload\(payload, source\),?\s*\)/,
    );
    for (const name of [...individualMigrations, ...seeds]) {
      expect(src).not.toContain(name);
    }
  });
  it("전체 문서 교체 소비자 (프로젝트 파일 가져오기 · 복원 · undo/redo) 는 applySnapshotDocument 를 경유한다", () => {
    expect(read("src/builder/main/BuilderCore.tsx")).toContain(
      "applySnapshotDocument(",
    );
    const restore = read("src/builder/stores/history/snapshotRestore.ts");
    expect(
      restore.match(/applySnapshotDocument\(/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(restore).toContain(".setDocument(projectId, docCopy)");
  });
});

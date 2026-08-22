import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("fullTreeLayout shared filtered children key contract", () => {
  it("uses the same page/layout/id fallback key for filtered children as layout maps", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    expect(source).toContain("const rootKey = getLayoutRootKey(rootEl);");
    expect(source).toContain('from "../layoutRootKey"');
    expect(source).not.toContain("getFrameElementMirrorId");
    expect(source).toContain(
      "publishFilteredChildrenMap(filteredChildIdsMap, rootKey);",
    );
    expect(source).not.toContain(
      "publishFilteredChildrenMap(filteredChildIdsMap, rootPageId ?? undefined)",
    );
  });

  it("keys persistent Taffy trees by page/layout/id so reusable Frames do not share __default__", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    expect(source).toContain("const rootKey = getLayoutRootKey(rootEl);");
    expect(source).toContain("persistentTrees.get(rootKey)");
    expect(source).toContain("persistentTrees.set(rootKey, persistentTree)");
    expect(source).not.toContain(
      'const pageId = rootEl.page_id ?? "__default__";',
    );
  });

  it("exposes cloned filtered children maps for layout cache hit republish", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    expect(source).toMatch(/function cloneFilteredChildrenMap\(/);
    expect(source).toMatch(/export function getPublishedFilteredChildrenMap\(/);
    expect(source).toMatch(
      /return map \? cloneFilteredChildrenMap\(map\) : null;/,
    );
  });

  it("stores synthetic layout children by the same root key as filtered children", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    expect(source).toContain("const _perPageSyntheticElementsMaps");
    expect(source).toContain("beginSyntheticElementsCollection();");
    expect(source).toContain("publishCollectedSyntheticElements(rootKey);");
    expect(source).toContain("publishSyntheticElementsMap(null, pageId);");
  });

  it("batch-publishes layout map updates with a single listener notification", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    expect(source).toMatch(/export function publishLayoutMapsBatch\(/);
    expect(source).toMatch(
      /for \(const \{ key, map \} of updates\) \{[\s\S]*_perPageLayoutMaps\.set\(key, map\);/,
    );
    expect(source).toMatch(
      /for \(const cb of _layoutPublishListeners\) cb\(\);/,
    );
  });
});

/**
 * Grid container dimension-change full rebuild contract (2026-06-16).
 *
 * 버그: display:grid 컨테이너 자신의 width/height 변경 시 Skia 렌더에서 grid track 이
 * stale degrade(1줄) → 새로고침(buildFull) 후에만 정상 복귀. 원인 = `GRID_REBUILD_TRIGGER_KEYS`
 * 에 dimension 키가 없어 incremental(updateStyleRaw) 경로를 타고, Taffy set_style 이 grid
 * track/placement 캐시를 무효화하지 못함. padding/gap 과 동일 병인 → 동일 처방(full rebuild).
 *
 * `calculateFullTreeLayout` 은 Taffy WASM 의존이라 단위 테스트에서 직접 행동 검증 불가 →
 * 소스 정적 계약으로 dimension 키 누락 회귀를 가드한다. 키 비교는 `node.style[k]` JSON 비교
 * (= `taffyStyleToRecord` 출력 = camelCase 단일 키) 이므로 키 이름 정확성도 함께 확증.
 */
describe("fullTreeLayout grid dimension-change full rebuild contract", () => {
  const DIMENSION_KEYS = [
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
  ] as const;

  it("includes all dimension keys in GRID_REBUILD_TRIGGER_KEYS so grid width/height edits force full rebuild", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    const match = source.match(
      /const GRID_REBUILD_TRIGGER_KEYS = \[([\s\S]*?)\] as const;/,
    );
    expect(match).not.toBeNull();
    const body = match![1];

    // 주석 처리된 키("// \"width\",")가 통과하지 않도록, 실제 활성 배열 항목만 추출
    // (줄 시작 공백 뒤 따옴표로 시작 — 주석 prefix `//` 가 있는 줄은 제외)
    const activeKeys = new Set(
      body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => !line.startsWith("//"))
        .map((line) => line.match(/^"([^"]+)",?$/)?.[1])
        .filter((k): k is string => Boolean(k)),
    );

    for (const key of DIMENSION_KEYS) {
      expect(activeKeys).toContain(key);
    }

    // 기존 padding/gap/grid-template 키도 회귀 방지로 함께 가드
    for (const key of [
      "gridTemplateColumns",
      "padding",
      "gap",
      "rowGap",
      "columnGap",
    ]) {
      expect(activeKeys).toContain(key);
    }
  });

  it("uses GRID_REBUILD_TRIGGER_KEYS in the incremental-vs-rebuild grid branch", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    // grid container 분기에서 GRID_REBUILD_TRIGGER_KEYS 를 순회하며 변경 시 full rebuild 강제
    expect(source).toMatch(
      /for \(const k of GRID_REBUILD_TRIGGER_KEYS\) \{[\s\S]*?needsFullRebuild = true;/,
    );
  });

  it("compares prev vs current grid style with the same camelCase record shape as taffyStyleToRecord", async () => {
    const source = await readFile(
      resolve(__dirname, "fullTreeLayout.ts"),
      "utf-8",
    );

    // 비교는 prevParsed[k] vs node.style[k] — 둘 다 taffyStyleToRecord 출력 shape
    expect(source).toMatch(
      /JSON\.stringify\(prevParsed\[k\]\) !==\s*JSON\.stringify\(node\.style\[k\]\)/,
    );
    // taffyStyleToRecord 가 width/height/min/max 를 camelCase 단일 키로 emit (비교 키와 1:1)
    expect(source).toMatch(/result\.width =/);
    expect(source).toMatch(/result\.minWidth =/);
    expect(source).toMatch(/result\.maxHeight =/);
  });
});

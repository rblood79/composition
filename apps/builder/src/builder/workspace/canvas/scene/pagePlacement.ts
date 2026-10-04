import {
  createLayoutEngine,
  type LayoutEngineAPI,
} from "../wasm-bindings/layoutBridge";
import { CANVAS_VIEWPORT } from "../../canvasBreakpoints";
import type { PagePositionPoint } from "@composition/shared";
import {
  type PagePositionMap,
  type DerivePagePositionsInput,
  type ResolvedPageLayout,
  resolvePageLayout,
  resolveSystemPagePlacementStyle,
  resolvePagePlacementStyle,
  placementToEngineStyle,
  clampPinnedCell,
  buildContainerStyle,
  resolveAvailableWidth,
} from "../../../../../../../packages/shared/src/catalog/runtime/pagePlacement";
export * from "../../../../../../../packages/shared/src/catalog/runtime/pagePlacement";
let placementEngine: LayoutEngineAPI | null = null;

function getPlacementEngine(): LayoutEngineAPI | null {
  if (!placementEngine) placementEngine = createLayoutEngine();
  return placementEngine.isAvailable() ? placementEngine : null;
}

/** 테스트 전용 — 엔진 인스턴스 재설정. */
export function __resetPagePlacementEngine(): void {
  placementEngine = null;
}

/** 테스트 전용 — 엔진 주입 (미준비 분기 커버). */
export function __setPagePlacementEngine(engine: LayoutEngineAPI | null): void {
  placementEngine = engine;
}

/** 엔진 호출 카운터 (G3 메모 검증용 — 키 불변이면 증가하지 않는다). */
let derivationCount = 0;
export function getPagePlacementDerivationCount(): number {
  return derivationCount;
}
export function resetPagePlacementDerivationCount(): void {
  derivationCount = 0;
}

/**
 * `"legacy"` 모드 — 모든 페이지가 absolute 다 (흐름 0).
 *
 * 흐름을 섞으면 all-absolute 부모에 남은 flow 자식이 첫 칸 (Home 자리) 으로 가 겹친다
 * (리뷰 round 3 m2 재현). 좌표는 `pagePositions` → `legacyFallback` 순서.
 */
function readLegacyPositions(
  input: DerivePagePositionsInput,
  layout: ResolvedPageLayout,
): PagePositionMap {
  const out: PagePositionMap = {};
  const fallback = input.pageLayout?.legacyFallback?.[input.activeBreakpoint];
  for (const page of input.pages) {
    const stored = input.legacyPositions?.[page.id]?.[input.activeBreakpoint];
    const point = stored ?? fallback?.[page.id];
    if (point) out[page.id] = { x: point.x, y: point.y };
  }
  void layout;
  return out;
}

/**
 * 페이지 위치 파생. 엔진 미준비면 `null` (호출자는 이전 값을 유지한다).
 */
/**
 * 저장 좌표를 읽어야 하는가.
 *
 * `"legacy"` 는 물론이고, **모델이 아직 없는 문서** (이관 직전 프레임) 도 저장 좌표가 정본이다 —
 * 그 순간 흐름으로 그리면 이관 전후로 화면이 한 번 튄다. 저장 좌표가 없으면 (새 문서) 흐름이다.
 */
function shouldReadStoredPositions(
  input: DerivePagePositionsInput,
  layout: ResolvedPageLayout,
): boolean {
  if (layout.placementModel === "legacy") return true;
  if (layout.placementModel === "derived") return false;
  const stored = input.legacyPositions;
  if (!stored) return false;
  return input.pages.some(
    (page) =>
      !input.systemPageIds?.has(page.id) &&
      stored[page.id]?.[input.activeBreakpoint] !== undefined,
  );
}

export function derivePagePositions(
  input: DerivePagePositionsInput,
): PagePositionMap | null {
  const layout = resolvePageLayout(
    input.pageLayout,
    input.activeBreakpoint,
    input.autoColumns,
  );
  if (shouldReadStoredPositions(input, layout)) {
    return readLegacyPositions(input, layout);
  }
  if (input.pages.length === 0) return {};

  const engine = getPlacementEngine();
  if (!engine) return null;

  const tier = CANVAS_VIEWPORT[input.activeBreakpoint];
  const placements = input.pageLayout?.placements;
  const nodes: Array<{ style: Record<string, unknown>; children: number[] }> =
    [];
  const usedCells = new Set<string>();
  for (const page of input.pages) {
    const size = input.pageSizes[page.id];
    let style = resolvePagePlacementStyle(
      placements?.[page.id],
      input.activeBreakpoint,
    );
    if (
      Object.keys(style).length === 0 &&
      input.systemPageIds?.has(page.id) === true
    ) {
      style = resolveSystemPagePlacementStyle(
        size?.width ?? tier.width,
        layout.gap,
      );
    }
    nodes.push({
      style: {
        display: "block",
        width: `${size?.width ?? tier.width}px`,
        height: `${size?.height ?? tier.height}px`,
        ...clampPinnedCell(placementToEngineStyle(style), layout, usedCells),
      },
      children: [],
    });
  }
  nodes.push({
    style: buildContainerStyle(layout),
    children: input.pages.map((_, index) => index),
  });

  derivationCount += 1;
  try {
    engine.clear();
    const handles = engine.buildTreeBatch(JSON.stringify(nodes));
    if (handles.length !== nodes.length) return null;
    const rootHandle = handles[handles.length - 1];
    engine.computeLayout(
      rootHandle,
      resolveAvailableWidth(layout, input.pages.length),
      Number.MAX_SAFE_INTEGER / 4,
    );
    const results = engine.getLayoutsBatch(handles.slice(0, -1));
    const out: PagePositionMap = {};
    input.pages.forEach((page, index) => {
      const rect = results.get(handles[index]);
      if (!rect) return;
      out[page.id] = { x: rect.x, y: rect.y };
    });
    return out;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn("[pagePlacement] 파생 실패 — 엔진 오류:", error);
    }
    return null;
  }
}

/**
 * 메모 키 — 입력이 같으면 엔진을 부르지 않는다 (R4).
 *
 * frame 크기 벡터 · 페이지 순서 · 컨테이너 설정 · placement · activeBreakpoint ·
 * `placementModel` 전부 포함. 하나라도 빠지면 "바뀌었는데 옛 위치" 가 된다.
 */
export function buildPagePlacementMemoKey(
  input: DerivePagePositionsInput,
): string {
  const layout = resolvePageLayout(
    input.pageLayout,
    input.activeBreakpoint,
    input.autoColumns,
  );
  const sizes = input.pages
    .map((page) => {
      const size = input.pageSizes[page.id];
      return `${page.id}:${size?.width ?? ""}x${size?.height ?? ""}`;
    })
    .join(",");
  const placements = input.pages
    .map((page) => {
      const style = resolvePagePlacementStyle(
        input.pageLayout?.placements?.[page.id],
        input.activeBreakpoint,
      );
      const keys = Object.keys(style).sort();
      const system = input.systemPageIds?.has(page.id) === true ? "S" : "";
      return keys.length === 0
        ? `${page.id}:-${system}`
        : `${page.id}:${keys.map((k) => `${k}=${style[k]}`).join(";")}`;
    })
    .join(",");
  const legacy = shouldReadStoredPositions(input, layout)
    ? input.pages
        .map((page) => {
          const stored =
            input.legacyPositions?.[page.id]?.[input.activeBreakpoint] ??
            input.pageLayout?.legacyFallback?.[input.activeBreakpoint]?.[
              page.id
            ];
          return stored ? `${page.id}:${stored.x},${stored.y}` : `${page.id}:-`;
        })
        .join(",")
    : "";
  return [
    input.activeBreakpoint,
    layout.placementModel ?? "none",
    layout.direction,
    layout.gap,
    layout.columns,
    layout.trackWidth,
    sizes,
    placements,
    legacy,
  ].join("|");
}

// ── 메모 1칸 (직전 입력) ───────────────────────────────────────────────
let memoKey: string | null = null;
let memoValue: PagePositionMap | null = null;

/** 메모를 거친 파생 — 같은 키면 엔진 호출 0. */
export function derivePagePositionsMemo(
  input: DerivePagePositionsInput,
): PagePositionMap | null {
  const key = buildPagePlacementMemoKey(input);
  if (key === memoKey && memoValue) return memoValue;
  const next = derivePagePositions(input);
  if (next) {
    memoKey = key;
    memoValue = next;
  }
  return next;
}

/**
 * 파생 좌표 map 의 version — 내용 주소 방식.
 *
 * 파생 모드에서는 store `pagePositionsVersion` 이 오르지 않으므로 stale 프레임 카운터
 * (`skiaTreeBuilder`) 와 커맨드 캐시 키가 이 값을 읽는다.
 */
export function pagePlacementVersion(positions: PagePositionMap): number {
  let hash = 0;
  for (const [id, point] of Object.entries(positions)) {
    const text = `${id}:${point.x},${point.y}|`;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
  }
  return hash;
}

/** 테스트 전용 — 메모 비우기. */
export function __resetPagePlacementMemo(): void {
  memoKey = null;
  memoValue = null;
}

/**
 * ADR-232 — 페이지 배치는 페이지 컨테이너의 **레이아웃 파생값**이다.
 *
 * 저장 좌표 (`pagePositions`) 대신 합성 grid root 하나에 페이지 frame 을 leaf 로 넣고
 * 엔진에 돌려 위치를 받는다. 입력이 바뀌면 다시 계산할 뿐이라 "추가 · 삭제 · breakpoint 전환 ·
 * 크기 변화 · reload · align 여섯 사건마다 좌표를 맞춰 주는 코드" 가 사라진다 (ADR-232 §Context).
 *
 * **입력** = 페이지 순서 · 페이지별 frame 크기 (`readPageFrameSize`, ADR-231 neutral 포함) ·
 * 컨테이너 설정 (`pageLayout`) · 페이지별 `placement` · activeBreakpoint · `placementModel`.
 * **출력** = `pagePositions` 와 같은 모양의 좌표 map (전환기 — 소비처 교체를 나눠 커밋하려고
 * 일부러 같은 형태로 낸다, breakdown Phase 1-3).
 *
 * **direction 매핑** (2026-09-22 엔진 실측 — `/tmp/.../adr232-engine-probe.mjs`):
 * | direction    | root style                                                            | 현행 `calculatePagePositions` 대조 |
 * | ------------ | --------------------------------------------------------------------- | ---------------------------------- |
 * | `auto`       | `gridTemplateColumns: repeat(N, <tier 폭>px)` · `gridAutoRows: auto`  | 열 stride · 행 = 행 최대 높이 일치 |
 * | `vertical`   | 같은 root, N = 1                                                       | x = 0 · y 누적 일치                |
 * | `horizontal` | `gridAutoFlow: column` · `gridTemplateRows: [auto]`                    | x 누적 (자기 폭) 일치              |
 *
 * `justifyContent: "start"` 가 필수다 — 없으면 implicit column 이 available width 로 늘어나
 * horizontal 의 x 가 현행과 어긋난다 (실측 [0, 4240, 7360] vs 기대 [0, 2000, 2880]).
 *
 * 열 track 이 **고정 폭**인 이유: `max-content` 면 빈 열이 0 폭으로 접혀 고정 칸이 밀린다
 * (리뷰 round 2 m3). 저작 폭이 track 보다 넓은 페이지는 칸을 넘치되 다음 칸을 밀지 않는다
 * (실측 G — 현행과 같음).
 *
 * 엔진 미준비 (부팅 초기) 면 `null` 을 낸다. 그 구간에 화면에 나오는 것은 없다 — `SkiaRenderer`
 * 는 `await initAllWasm()` 뒤에만 생성된다 (G0 §4 실측, R3 도달 불가).
 */

import type {
  BreakpointName,
  PagePlacement,
  PagePlacementModel,
  PageLayoutSettingsDocument,
  PagePositionPoint,
} from "@composition/shared";
import {
  PAGE_PLACEMENT_STYLE_KEYS,
  getResponsiveValueWithCascade,
} from "@composition/shared";
import { CANVAS_VIEWPORT } from "../../canvasBreakpoints";
import { createLayoutEngine } from "../wasm-bindings/layoutBridge";
import type { LayoutEngineAPI } from "../wasm-bindings/layoutBridge";
import { resolveResponsiveStyleMap } from "../layout/resolveResponsive";

export type PagePositionMap = Record<string, PagePositionPoint>;

export type PageLayoutDirection = "auto" | "vertical" | "horizontal";

/** 페이지 배치 기본값 — 현행 Settings 기본과 같다 (`PAGE_STACK_GAP` 80 · auto). */
export const DEFAULT_PAGE_LAYOUT_GAP = 80;
export const DEFAULT_PAGE_LAYOUT_COLUMNS = 3;
export const DEFAULT_PAGE_LAYOUT_DIRECTION: PageLayoutDirection = "auto";

export interface PagePlacementSize {
  width: number;
  height: number;
}

export interface DerivePagePositionsInput {
  /** canonical children 순서. Home = 첫 사용자 페이지 (흐름 원점, 이동 불가). */
  pages: readonly { id: string }[];
  /** 페이지별 frame 크기 (`readPageFrameSize`). 없으면 tier 크기. */
  pageSizes: Readonly<Record<string, PagePlacementSize | undefined>>;
  /** 문서 `pageLayout` (부재 = 기본값 + 미이관). */
  pageLayout?: PageLayoutSettingsDocument;
  activeBreakpoint: BreakpointName;
  /**
   * 시스템 페이지 (Components) — placement 가 없으면 **기본값** 으로 격자 밖 왼쪽 열에 둔다
   * (ADR-232 Decision 5 · ADR-231 시스템 열 재현). 저장하지 않는 기본값이라 align 이
   * placement 를 지워도 같은 자리로 돌아온다 (live 실측 2026-09-22 — 지웠더니 흐름 첫 칸에
   * 합류해 Home 을 밀어냈다).
   */
  systemPageIds?: ReadonlySet<string>;
  /**
   * `"legacy"` 모드에서 읽는 저장 좌표 — `pagePositions[pageId][tier]`.
   * `"derived"` 에서는 읽지 않는다 (`placementModel` 이 읽기 모드를 정한다 — 리뷰 round 3 l3).
   */
  legacyPositions?: Readonly<
    Record<string, Partial<Record<BreakpointName, PagePositionPoint>>>
  >;
}

/** 활성 tier 로 해석된 컨테이너 설정. */
export interface ResolvedPageLayout {
  direction: PageLayoutDirection;
  gap: number;
  columns: number;
  /** 열 track 폭 = 그 breakpoint 의 페이지 폭 (저장하지 않고 파생 시 계산). */
  trackWidth: number;
  placementModel: PagePlacementModel | null;
}

function normalizeDirection(value: unknown): PageLayoutDirection {
  return value === "vertical" || value === "horizontal" || value === "auto"
    ? value
    : DEFAULT_PAGE_LAYOUT_DIRECTION;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min
    ? value
    : fallback;
}

/**
 * 활성 tier 의 컨테이너 설정. `gap` · `columns` 만 tier override 대상이고 `direction` 은
 * breakpoint 공통이다 — `gridAutoFlow` 가 responsive eligible 이 아니기 때문 (F11).
 * cascade 는 style override 와 같은 함수 (`getResponsiveValueWithCascade`) 를 쓴다.
 */
export function resolvePageLayout(
  pageLayout: PageLayoutSettingsDocument | undefined,
  activeBreakpoint: BreakpointName,
): ResolvedPageLayout {
  const baseGap = normalizeNumber(pageLayout?.gap, DEFAULT_PAGE_LAYOUT_GAP, 0);
  const baseColumns = normalizeNumber(
    pageLayout?.columns,
    DEFAULT_PAGE_LAYOUT_COLUMNS,
    1,
  );
  return {
    direction: normalizeDirection(pageLayout?.direction),
    gap: normalizeNumber(
      getResponsiveValueWithCascade(
        pageLayout?.responsive?.gap,
        activeBreakpoint,
        baseGap,
      ),
      baseGap,
      0,
    ),
    columns: Math.max(
      1,
      Math.round(
        normalizeNumber(
          getResponsiveValueWithCascade(
            pageLayout?.responsive?.columns,
            activeBreakpoint,
            baseColumns,
          ),
          baseColumns,
          1,
        ),
      ),
    ),
    trackWidth: CANVAS_VIEWPORT[activeBreakpoint].width,
    placementModel: pageLayout?.placementModel ?? null,
  };
}

/**
 * 페이지 1개의 활성 tier placement style.
 *
 * base + override 병합은 **요소와 같은 SSOT** (`resolveResponsiveStyleMap`) 를 지난다 —
 * eligibility 표와 desktop→tablet→mobile cascade 가 그대로 적용된다. 표에 없는 키는
 * 그 함수가 skip 하므로 placement 가 eligibility 를 우회할 길이 없다.
 */
/** 시스템 페이지 기본 배치 — 사용자 격자 왼쪽 열 (폭은 그 페이지 자신의 frame 폭). */
export function resolveSystemPagePlacementStyle(
  width: number,
  gap: number,
): Record<string, string | number> {
  return { position: "absolute", left: -(width + gap), top: 0 };
}

export function resolvePagePlacementStyle(
  placement: PagePlacement | undefined,
  activeBreakpoint: BreakpointName,
): Record<string, string | number> {
  if (!placement) return {};
  const base = placement.style ?? {};
  const merged = resolveResponsiveStyleMap(
    base as Record<string, unknown>,
    placement.responsive ? { styles: placement.responsive } : undefined,
    activeBreakpoint,
  ) as Record<string, string | number>;
  const out: Record<string, string | number> = {};
  for (const key of PAGE_PLACEMENT_STYLE_KEYS) {
    const value = merged[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function toPx(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}px` : undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

/**
 * placement style → 엔진 leaf style.
 *
 * 흐름 복귀 reset 을 엔진 어법으로 옮긴다: line `"auto"` (또는 `"static"` position) 은
 * 키를 **싣지 않는 것**과 같다 (실측 — `"auto"` · `""` · `"0"` 전부 auto-placement).
 */
function placementToEngineStyle(
  style: Record<string, string | number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (style.position === "absolute") {
    out.position = "absolute";
    const left = toPx(style.left);
    const top = toPx(style.top);
    out.insetLeft = left ?? "0px";
    out.insetTop = top ?? "0px";
    return out; // absolute 는 격자 밖 — line 키는 의미가 없다.
  }
  for (const key of [
    "gridColumnStart",
    "gridColumnEnd",
    "gridRowStart",
    "gridRowEnd",
  ] as const) {
    const value = style[key];
    if (value === undefined) continue;
    const text = String(value).trim();
    if (text === "" || text === "auto" || text === "0") continue;
    out[key] = text;
  }
  return out;
}

/** 합성 root style — direction 별 매핑 (위 표). */
export function buildContainerStyle(
  layout: ResolvedPageLayout,
): Record<string, unknown> {
  const gap = `${layout.gap}px`;
  const common = {
    display: "grid",
    columnGap: gap,
    rowGap: gap,
    alignItems: "start",
    justifyItems: "start",
    // 없으면 implicit column 이 available width 로 늘어난다 (horizontal x 발산).
    justifyContent: "start",
    alignContent: "start",
  };
  if (layout.direction === "horizontal") {
    return {
      ...common,
      gridAutoFlow: "column",
      gridTemplateRows: ["auto"],
      gridAutoColumns: ["auto"],
    };
  }
  const columns = layout.direction === "vertical" ? 1 : layout.columns;
  return {
    ...common,
    gridTemplateColumns: Array<string>(columns).fill(`${layout.trackWidth}px`),
    gridAutoRows: ["auto"],
    width: `${columns * layout.trackWidth + (columns - 1) * layout.gap}px`,
  };
}

/** 컨테이너에 넣을 available width — 고정 track 합계 (horizontal 은 상한만 준다). */
function resolveAvailableWidth(
  layout: ResolvedPageLayout,
  pageCount: number,
): number {
  if (layout.direction === "horizontal") {
    return Math.max(1, pageCount) * (layout.trackWidth + layout.gap) * 4;
  }
  const columns = layout.direction === "vertical" ? 1 : layout.columns;
  return columns * layout.trackWidth + (columns - 1) * layout.gap;
}

// ── 엔진 인스턴스 (파생 전용, 메인 레이아웃 트리와 분리) ───────────────────
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
export function derivePagePositions(
  input: DerivePagePositionsInput,
): PagePositionMap | null {
  const layout = resolvePageLayout(input.pageLayout, input.activeBreakpoint);
  if (layout.placementModel === "legacy") {
    return readLegacyPositions(input, layout);
  }
  if (input.pages.length === 0) return {};

  const engine = getPlacementEngine();
  if (!engine) return null;

  const tier = CANVAS_VIEWPORT[input.activeBreakpoint];
  const placements = input.pageLayout?.placements;
  const nodes: Array<{ style: Record<string, unknown>; children: number[] }> =
    [];
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
        ...placementToEngineStyle(style),
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
  const layout = resolvePageLayout(input.pageLayout, input.activeBreakpoint);
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
  const legacy =
    layout.placementModel === "legacy"
      ? input.pages
          .map((page) => {
            const stored =
              input.legacyPositions?.[page.id]?.[input.activeBreakpoint] ??
              input.pageLayout?.legacyFallback?.[input.activeBreakpoint]?.[
                page.id
              ];
            return stored
              ? `${page.id}:${stored.x},${stored.y}`
              : `${page.id}:-`;
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

/**
 * ADR-162 Phase 4 — 펼친 GridList 카드 (항목 origin 에 역할 없는 자식) 의 **실측 · 추정 카드 높이**.
 *
 * 펼친 카드 높이는 자식 크기 (Image · 여러 줄 `{title}`) 에 달려 layout 전에는 알 수 없다. 그래서:
 * - window 안에 실체화된 카드는 layout 결과 (카드 projection 상자 높이) 를 캐시한다 — 캐시 키 = owner +
 *   템플릿 서명 + owner 폭 + 행 key (+ 행 데이터 참조). 템플릿 · 폭이 바뀌면 owner 캐시 전체를 비운다.
 * - 아직 안 본 카드는 추정 — 이 owner 의 첫 실측 카드 높이 (없으면 템플릿 공식). 첫 실측 뒤 고정이라
 *   추정이 스크롤마다 흔들리지 않는다 (react-virtuoso 의 기본 항목 크기와 같은 방식).
 * - 시각 행 높이 = 그 행 카드들의 최대 (DOM grid stretch). 행 위치 · window · spacer · maxScrollTop 은
 *   ADR-150 행 offset 함수 (`resolveCollectionRowOffsets`) 가 이 목록으로 산출한다 — 여기서 계산하지 않는다.
 * - 실측이 들어와 앞쪽 합이 바뀌면 scroll anchoring: 끝에 있었으면 새 끝으로, 아니면 화면 첫 시각 행의
 *   화면 y 가 그대로이게 scrollTop 을 옮긴다 (G3 d).
 * - 진동 차단: 한 카드는 키가 같으면 값이 바뀔 때만 다시 쓴다 (±0.5). 같은 스크롤 위치의 연속 build 는 같은
 *   목록 → 같은 window · offset.
 *
 * 무효화 신호는 layout publish (`onLayoutPublished`) 하나다 — 수확이 값을 바꿨을 때만 version 을 올리고
 * 가상화 resolver 가 그 version 으로 plan 캐시를 다시 만든다.
 */
import { toCollectionRowProjectionId } from "../../../projection/renderProjectionIds";
import { resolveCollectionRowOffsets } from "./collectionRowOffsets";

export interface ExpandedCardPlanInput {
  ownerId: string;
  /** origin 서브트리 서명 — 바뀌면 이 owner 의 실측을 모두 버린다. */
  templateSig: string;
  itemKeys: readonly string[];
  /** 행 데이터 참조 (item) — 같은 key 라도 데이터가 바뀌면 그 카드 실측을 버린다. */
  items: readonly unknown[];
  /** 첫 실측 전 카드별 추정 (템플릿 공식). */
  formulaCardHeights: readonly number[];
  columns: number;
  gap: number;
  leadingExtent: number;
  trailingExtent: number;
  viewportHeight: number;
}

interface OwnerEntry {
  templateSig: string;
  ownerWidth: number | null;
  measured: Map<string, { item: unknown; height: number }>;
  firstMeasured: number | null;
  plan: ExpandedCardPlanInput | null;
  window: { startIndex: number; endIndex: number } | null;
  /** 이 owner 의 실측이 바뀐 횟수 — resolver plan 캐시 조건. */
  version: number;
}

const owners = new Map<string, OwnerEntry>();
let globalVersion = 0;
const listeners = new Set<() => void>();

function entryFor(ownerId: string, templateSig: string): OwnerEntry {
  let entry = owners.get(ownerId);
  if (!entry) {
    entry = {
      templateSig,
      ownerWidth: null,
      measured: new Map(),
      firstMeasured: null,
      plan: null,
      window: null,
      version: 0,
    };
    owners.set(ownerId, entry);
  } else if (entry.templateSig !== templateSig) {
    entry.templateSig = templateSig;
    entry.measured.clear();
    entry.firstMeasured = null;
    entry.version += 1;
  }
  return entry;
}

function cardHeightsOf(
  plan: ExpandedCardPlanInput,
  entry: OwnerEntry,
): number[] {
  return plan.itemKeys.map((key, i) => {
    const hit = entry.measured.get(key);
    if (hit && hit.item === plan.items[i]) return hit.height;
    return entry.firstMeasured ?? plan.formulaCardHeights[i] ?? 0;
  });
}

/** 카드 높이 → 시각 행 높이 (그 행 카드들 중 최대). */
export function toVisualRowHeights(
  cardHeights: readonly number[],
  columns: number,
): number[] {
  const cols = Math.max(1, columns);
  const out: number[] = [];
  for (let i = 0; i < cardHeights.length; i += cols) {
    let max = 0;
    for (let j = i; j < Math.min(cardHeights.length, i + cols); j += 1) {
      if (cardHeights[j] > max) max = cardHeights[j];
    }
    out.push(max);
  }
  return out;
}

/**
 * resolver 가 plan 을 만들 때 부른다 — plan 을 등록하고 카드별 높이 (실측 ?? 추정) 를 돌려준다.
 */
export function resolveExpandedCardHeights(
  plan: ExpandedCardPlanInput,
): number[] {
  const entry = entryFor(plan.ownerId, plan.templateSig);
  entry.plan = plan;
  return cardHeightsOf(plan, entry);
}

/**
 * resolver 가 scroll 소유자의 window 를 정한 뒤 부른다 — 수확은 이 구간의 카드만 읽고, anchoring 은 이
 * viewport 로 스크롤 범위를 잰다 (plan 은 viewport 와 무관하게 캐시된다).
 */
export function noteExpandedCardWindow(
  ownerId: string,
  window: { startIndex: number; endIndex: number },
  viewportHeight: number,
): void {
  const entry = owners.get(ownerId);
  if (!entry) return;
  entry.window = window;
  if (entry.plan && entry.plan.viewportHeight !== viewportHeight) {
    entry.plan = { ...entry.plan, viewportHeight };
  }
}

/** 이 owner 의 실측 version (resolver plan 캐시 조건). 등록 전이면 −1. */
export function expandedCardHeightsVersionOf(ownerId: string): number {
  return owners.get(ownerId)?.version ?? -1;
}

export function getExpandedCardHeightsVersion(): number {
  return globalVersion;
}

export function subscribeExpandedCardHeights(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * resolver 가 한 번 돌 때 끝에서 부른다 — 문서에서 사라진 owner 는 지우고, 남았지만 이번에 펼친 scroll
 * 소유자로 window 를 받지 못한 owner (접힘 · sample 모드로 바뀜) 는 수확 구간을 비운다. 남은 plan 으로
 * 수확하면 접힌 카드 높이를 실측으로 읽어 옛 plan 의 maxScrollTop 으로 scroll state 를 덮는다.
 */
export function pruneExpandedCardOwners(
  liveOwnerIds: ReadonlySet<string>,
  windowedOwnerIds: ReadonlySet<string>,
) {
  for (const [id, entry] of owners) {
    if (!liveOwnerIds.has(id)) owners.delete(id);
    else if (!windowedOwnerIds.has(id)) entry.window = null;
  }
}

export interface ExpandedCardScrollAccess {
  get(ownerId: string): { scrollTop: number } | undefined;
  /** maxScrollTop 을 먼저 넣고 scrollTop 을 맞춘다 (clamp 순서). */
  apply(ownerId: string, maxScrollTop: number, scrollTop: number): void;
}

interface LayoutRect {
  width: number;
  height: number;
}

function rowTops(heights: readonly number[], gap: number): Float64Array {
  const tops = new Float64Array(heights.length + 1);
  for (let i = 0; i < heights.length; i += 1) {
    tops[i + 1] = tops[i] + heights[i] + gap;
  }
  return tops;
}

function offsetsOf(plan: ExpandedCardPlanInput, visual: number[], top: number) {
  return resolveCollectionRowOffsets({
    visualRowCount: visual.length,
    rowHeights: visual,
    gap: plan.gap,
    leadingExtent: plan.leadingExtent,
    trailingExtent: plan.trailingExtent,
    viewportHeight: plan.viewportHeight,
    scrollTop: top,
    overscan: 0,
  });
}

/**
 * scroll anchoring — 실측 교체 전후 시각 행 높이로 새 scrollTop 을 정한다. 끝에 있었으면 새 끝, 아니면 화면
 * 첫 시각 행 (bottom 이 화면 위 끝보다 아래인 첫 행) 의 top 변화만큼 옮긴다.
 */
export function anchorScrollTop(
  plan: Pick<
    ExpandedCardPlanInput,
    "gap" | "leadingExtent" | "trailingExtent" | "viewportHeight"
  >,
  oldVisual: readonly number[],
  newVisual: readonly number[],
  scrollTop: number,
): {
  scrollTop: number;
  maxScrollTop: number;
  /** 기준 — 끝 고정이면 "end", 아니면 화면 첫 시각 행 index. */
  anchor: "end" | number;
  /** 기준 행 top (행 영역 기준) — 교체 전 · 후. 끝 고정이면 마지막 행. */
  anchorTopBefore: number;
  anchorTopAfter: number;
} {
  const full = plan as ExpandedCardPlanInput;
  const oldMax = offsetsOf(full, [...oldVisual], scrollTop).maxScrollTop;
  const newMax = offsetsOf(full, [...newVisual], scrollTop).maxScrollTop;
  const oldTops = rowTops(oldVisual, plan.gap);
  const newTops = rowTops(newVisual, plan.gap);
  if (oldMax > 0 && scrollTop >= oldMax - 0.5) {
    const last = Math.max(0, oldVisual.length - 1);
    return {
      scrollTop: newMax,
      maxScrollTop: newMax,
      anchor: "end",
      anchorTopBefore: oldTops[last],
      anchorTopAfter: newTops[last],
    };
  }
  const y = scrollTop - plan.leadingExtent;
  let anchor = 0;
  while (
    anchor < oldVisual.length - 1 &&
    oldTops[anchor] + oldVisual[anchor] <= y
  ) {
    anchor += 1;
  }
  const next = scrollTop + (newTops[anchor] - oldTops[anchor]);
  return {
    scrollTop: Math.min(newMax, Math.max(0, next)),
    maxScrollTop: newMax,
    anchor,
    anchorTopBefore: oldTops[anchor],
    anchorTopAfter: newTops[anchor],
  };
}

/**
 * layout publish 뒤 부른다 — 등록된 owner 의 window 카드 상자 높이를 캐시에 넣고, 바뀌었으면 anchoring 후
 * version 을 올려 알린다. 바뀐 owner 가 없으면 아무것도 하지 않는다.
 */
export function harvestExpandedCardHeights(
  layoutMap: ReadonlyMap<string, LayoutRect> | null,
  scroll: ExpandedCardScrollAccess,
): boolean {
  if (!layoutMap) return false;
  let anyChanged = false;
  for (const [ownerId, entry] of owners) {
    const plan = entry.plan;
    const window = entry.window;
    if (!plan || !window) continue;
    const ownerRect = layoutMap.get(ownerId);
    if (!ownerRect) continue;
    const oldVisual = toVisualRowHeights(
      cardHeightsOf(plan, entry),
      plan.columns,
    );
    let changed = false;
    // 폭 (열 폭 · wrap) 이 바뀌면 이전 실측은 모두 틀린다.
    if (
      entry.ownerWidth != null &&
      Math.abs(entry.ownerWidth - ownerRect.width) > 0.5
    ) {
      entry.measured.clear();
      entry.firstMeasured = null;
      changed = true;
    }
    entry.ownerWidth = ownerRect.width;
    const end = Math.min(window.endIndex, plan.itemKeys.length);
    for (let i = Math.max(0, window.startIndex); i < end; i += 1) {
      const key = plan.itemKeys[i];
      const rect = layoutMap.get(
        toCollectionRowProjectionId("gridlist", ownerId, key),
      );
      if (!rect || !(rect.height > 0)) continue;
      const prev = entry.measured.get(key);
      if (
        prev &&
        prev.item === plan.items[i] &&
        Math.abs(prev.height - rect.height) <= 0.5
      ) {
        continue;
      }
      entry.measured.set(key, { item: plan.items[i], height: rect.height });
      if (entry.firstMeasured == null) entry.firstMeasured = rect.height;
      changed = true;
    }
    if (!changed) continue;
    const newVisual = toVisualRowHeights(
      cardHeightsOf(plan, entry),
      plan.columns,
    );
    const current = scroll.get(ownerId)?.scrollTop ?? 0;
    const anchored = anchorScrollTop(plan, oldVisual, newVisual, current);
    scroll.apply(ownerId, anchored.maxScrollTop, anchored.scrollTop);
    recordAnchorEvent({
      ownerId,
      anchor: anchored.anchor,
      anchorTopBefore: anchored.anchorTopBefore,
      anchorTopAfter: anchored.anchorTopAfter,
      scrollTopBefore: current,
      scrollTopAfter: scroll.get(ownerId)?.scrollTop ?? anchored.scrollTop,
      maxScrollTop: anchored.maxScrollTop,
    });
    entry.version += 1;
    anyChanged = true;
  }
  if (anyChanged) {
    globalVersion += 1;
    for (const cb of listeners) cb();
  }
  return anyChanged;
}

interface AnchorEvent {
  ownerId: string;
  anchor: "end" | number;
  anchorTopBefore: number;
  anchorTopAfter: number;
  scrollTopBefore: number;
  scrollTopAfter: number;
  maxScrollTop: number;
}

// dev 전용 — live 하니스가 anchoring (G3 d) 를 관찰한다 (`__composition_LAYOUT_DEBUG__` 와 같은 방식, production 제외).
const anchorEvents: AnchorEvent[] = [];
function recordAnchorEvent(event: AnchorEvent): void {
  if (!import.meta.env?.DEV) return;
  anchorEvents.push(event);
  if (anchorEvents.length > 200) anchorEvents.shift();
}
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_EXPANDED_CARDS_DEBUG__ = { anchorEvents };
}

/** 테스트 전용 — 캐시 초기화. */
export function __resetExpandedCardHeightsForTest(): void {
  owners.clear();
  globalVersion = 0;
}

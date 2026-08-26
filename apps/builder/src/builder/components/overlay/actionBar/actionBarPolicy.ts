/**
 * ADR-192 Contextual Action Bar — 노출 정책 (순수).
 *
 * 바는 항목을 새로 정의하지 않는다. ADR-182 컨텍스트 메뉴 provider 가 산출한
 * `ContextMenuItem[]` (surface `canvas-element`) 을 받아 컨텍스트별 allowlist ·
 * 순서 · 상한 5 를 적용한 부분집합만 돌려준다. 나머지는 ⋯ (오버플로) 가
 * 182 메뉴를 그대로 연다.
 *
 * 컨텍스트 판정도 182 항목의 존재로만 한다 — provider 가 이미 선택 집합을
 * 해석해 조건 미충족 항목을 숨기므로 (182 노출 정책), 바가 요소 타입을 다시
 * 읽으면 두 표면의 판정이 갈릴 수 있다.
 *
 * - C2 frame/group: `ungroup` 존재
 * - C3 인스턴스: `go-to-origin` 존재
 * - C4 다중: `align` 존재 (182 는 2+ 선택에만 정렬 서브메뉴를 만든다)
 * - C1 단일 일반: 그 외
 * - C0: 항목 없음 → null (바 미마운트)
 */
import type { ContextMenuItem } from "../contextMenu/types";

export type ActionBarContext = "single" | "frame" | "instance" | "multi";

export interface ActionBarModel {
  context: ActionBarContext;
  /** 노출 순서대로 — 길이 ≤ ACTION_BAR_MAX_ITEMS */
  items: ContextMenuItem[];
}

export const ACTION_BAR_MAX_ITEMS = 5;

/**
 * 컨텍스트별 allowlist (좌→우 순서). 182 항목 id 가 계약이다 —
 * `actionBarPolicy.test.ts` 가 이 집합을 고정해 182 쪽 리네임이 조용히
 * 바 노출을 바꾸지 못하게 한다 (ADR-192 R1/G1).
 *
 * 의도적 배제: copy/paste (키보드·메뉴 경로 충분), delete (파괴적 — 레퍼런스
 * 공통 배제), z-order 4종 (⋯ 로 접근).
 */
export const ACTION_BAR_ALLOWLIST: Readonly<
  Record<ActionBarContext, readonly string[]>
> = {
  // group 은 182 가 단일 선택에도 만들지만 `groupSelection` 은 2+ 에서만 실행
  // (canvasActions.ts:259) — 단일 컨텍스트에서는 결정적 no-op 이라 뺀다.
  single: ["duplicate", "toggle-component-origin"],
  frame: ["ungroup", "duplicate", "toggle-component-origin"],
  instance: ["go-to-origin", "detach-instance", "duplicate"],
  multi: ["align", "group", "duplicate", "detach-instance"],
};

function collectIds(items: readonly ContextMenuItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.kind === "separator") continue;
    ids.add(item.id);
  }
  return ids;
}

export function resolveActionBarContext(
  items: readonly ContextMenuItem[],
): ActionBarContext | null {
  const ids = collectIds(items);
  if (ids.size === 0) return null;
  // body 만 선택: 182 는 copy/paste/duplicate 만 만든다 (group·컴포넌트 토글은
  // "body 제외"). group 이 없으면 적격 요소가 없는 것 — C0 미마운트.
  if (!ids.has("group")) return null;
  if (ids.has("align")) return "multi";
  if (ids.has("ungroup")) return "frame";
  if (ids.has("go-to-origin")) return "instance";
  return "single";
}

/**
 * 182 항목 배열 → 바 모델. 적격 항목이 하나도 없으면 null (C0 — 미마운트).
 */
export function applyActionBarPolicy(
  items: readonly ContextMenuItem[],
): ActionBarModel | null {
  const context = resolveActionBarContext(items);
  if (context === null) return null;

  const byId = new Map<string, ContextMenuItem>();
  for (const item of items) {
    if (item.kind === "separator") continue;
    byId.set(item.id, item);
  }

  const picked: ContextMenuItem[] = [];
  for (const id of ACTION_BAR_ALLOWLIST[context]) {
    const item = byId.get(id);
    if (!item) continue;
    picked.push(item);
    if (picked.length >= ACTION_BAR_MAX_ITEMS) break;
  }

  if (picked.length === 0) return null;
  return { context, items: picked };
}

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
 * - C4 다중: `align` 존재 (182 는 body 를 뺀 2+ 선택에만 정렬 서브메뉴를 만든다)
 * - C2 frame/group: `ungroup` 존재
 * - C3 인스턴스: `go-to-origin` 존재
 * - C1 단일 일반: `toggle-component-origin` 존재 (182 는 "단일 && non-body"
 *   에만 만든다 — 단일 body 판정의 정확한 대응물)
 * - C0: 위 어느 것도 없음 → null (바 미마운트)
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
  // 단일 컨텍스트에 group 을 두지 않는다 — 182 도 더 이상 단일 선택에 group 을
  // 만들지 않으므로(2026-08-27 code-review #10) 여기 실릴 일 자체가 없다.
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
  // 182 는 body 를 뺀 2+ 선택에만 정렬 서브메뉴를 만든다. ⌘A 처럼 body 가
  // 섞여도 non-body 가 2개 이상이면 그대로 multi 다. body + 요소 1개만 고른
  // 선택은 정렬·분배·그룹이 전부 조건 미충족이라 바가 뜨지 않는다 — 이전에는
  // 떴지만 그때 노출되던 정렬이 페이지 루트에 좌표를 쓰는 쪽이었다.
  if (ids.has("align")) return "multi";
  if (ids.has("ungroup")) return "frame";
  if (ids.has("go-to-origin")) return "instance";
  // 단일 선택의 body 판정. 구 센티널 `!ids.has("group")` 은 provider 의 group
  // 조건("선택 전원 non-body")과 달라 body 가 섞인 다중 선택(⌘A)에서 바를
  // 통째로 내렸고, 단일 선택에서 결정적 no-op 인 group 항목의 존재에 C1/C2/C3
  // 판정 전체가 매달려 있었다 (2026-08-27 code-review #5).
  if (!ids.has("toggle-component-origin")) return null;
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

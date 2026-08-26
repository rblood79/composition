/**
 * ADR-192 — 선택 집합 → 바 모델.
 *
 * 182 레지스트리 dispatcher (`buildContextMenuItems`) 를 surface
 * `canvas-element` 로 호출해 provider 정본 항목을 받고, 바 정책을 적용한다.
 * provider 는 BuilderCanvas 가 등록한다 (`registerCanvasContextMenuProviders`)
 * — 캔버스가 없으면 항목도 없어 바는 자연히 미마운트.
 *
 * clientX/clientY 는 provider 가 "Paste here" 좌표 계산에만 쓰므로 바에서는
 * 0 을 넘긴다 (바가 고르는 allowlist 에 paste 는 없다).
 */
import { buildContextMenuItems } from "../contextMenu/buildContextMenuItems";
import type { ContextMenuDeps, ContextMenuRequest } from "../contextMenu/types";
import { applyActionBarPolicy, type ActionBarModel } from "./actionBarPolicy";

export function buildActionBarRequest(
  targetElementIds: readonly string[],
): ContextMenuRequest {
  return {
    surface: "canvas-element",
    clientX: 0,
    clientY: 0,
    targetElementIds: [...targetElementIds],
  };
}

export function buildActionBarItems(
  targetElementIds: readonly string[],
  deps: ContextMenuDeps = {},
): ActionBarModel | null {
  if (targetElementIds.length === 0) return null;
  const items = buildContextMenuItems(
    buildActionBarRequest(targetElementIds),
    deps,
  );
  return applyActionBarPolicy(items);
}

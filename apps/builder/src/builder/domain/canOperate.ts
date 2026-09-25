/**
 * 구조 변경 판정 (ADR-236 Phase 3) — "이 노드에 이 작업을 해도 되는가" 를 한 곳에서 답한다.
 *
 * 같은 판정을 표면마다 따로 두면 한쪽만 막히고 다른 쪽은 뚫린다 (Phase 0 인벤토리 §3.4 E1 ·
 * E3 · E5 · E11: body toggle 이 단축키로 뚫리고, 삭제가 막힌 노드에도 메뉴 항목이 보였다).
 * 메뉴 · 액션 바 · 단축키 · Layers · AI 도구는 노출 판정에, 구조 변경 store 액션은 진입부에서
 * 이 함수를 부른다. 판정은 술어 (`isBodyType` · `isSystemOwnedOrigin` …) 만 읽는다.
 *
 * 입력은 id 와 store 조회 함수다 — 캔버스 상호작용 맵에는 `reusable` · `metadata` 가 없어
 * systemOwned · template anchor 를 판정할 수 없다. 조회 결과가 없으면 거부 (`notFound`).
 */

import { isBodyType } from "@composition/shared";
import {
  canDetachInstance,
  isSystemOwnedOrigin,
} from "../../adapters/canonical/editingSemantics";
import { isListBoxTemplateAnchor } from "../components/listbox/listBoxTemplateOrigins";
import { isRenderProjectionId } from "../projection/renderProjectionIds";
import { isSyntheticDescendantId } from "../stores/canonical/syntheticDescendantLookup";
import { isFrameOrLegacyGroup } from "../stores/utils/elementGrouping";
import { globalToast } from "../stores/toast";

export type StructuralOp =
  | "delete"
  | "copy"
  | "duplicate"
  | "group"
  | "ungroup"
  | "detach"
  | "toggleOrigin"
  | "move";

export type OperationRejectReason =
  | "notFound"
  | "synthetic"
  | "projection"
  | "body"
  | "systemOwned"
  | "templateAnchor"
  | "notGroup"
  | "notInstance";

export type OperationVerdict =
  { ok: true } | { ok: false; reason: OperationRejectReason };

/** store 노드에서 판정이 읽는 필드. legacy mirror 필드 (instance 판정) 는 어댑터 술어가 런타임에 읽는다 (ADR-116 G5). */
export interface OperableNode {
  id: string;
  type: string;
  ref?: string;
  reusable?: boolean;
  metadata?: unknown;
}

export type OperableNodeLookup = (id: string) => OperableNode | undefined;

const OK: OperationVerdict = { ok: true };
const reject = (reason: OperationRejectReason): OperationVerdict => ({
  ok: false,
  reason,
});

/** render projection id 를 받지 않는 작업 — store 액션이 projection 에서 이미 멈춘다. */
const PROJECTION_REJECTED: ReadonlySet<StructuralOp> = new Set<StructuralOp>([
  "delete",
  "move",
  "ungroup",
  "toggleOrigin",
  "detach",
]);

export function canOperate(
  op: StructuralOp,
  id: string,
  lookup: OperableNodeLookup,
): OperationVerdict {
  // instance 의 synthetic 자식은 store 노드가 아니다 — 자식은 origin · `descendants` 에서 온다 (B-3).
  if (isSyntheticDescendantId(id)) return reject("synthetic");
  if (PROJECTION_REJECTED.has(op) && isRenderProjectionId(id)) {
    return reject("projection");
  }
  const node = lookup(id);
  if (!node) return reject("notFound");
  // body 는 페이지 루트다 — 어떤 구조 변경의 대상도 아니다.
  if (isBodyType(node.type)) return reject("body");

  switch (op) {
    case "delete":
      if (isListBoxTemplateAnchor(node)) return reject("templateAnchor");
      // ADR-228 Decision 4 — 지우면 그 ref instance 전부가 빈 노드가 된다.
      if (isSystemOwnedOrigin(node)) return reject("systemOwned");
      return OK;
    case "toggleOrigin":
      // 해제하면 팔레트 배치 instance 와 상태 층이 원본을 잃는다.
      if (isSystemOwnedOrigin(node)) return reject("systemOwned");
      return OK;
    case "ungroup":
      if (!isFrameOrLegacyGroup(node.type)) return reject("notGroup");
      // ungroup 은 자식을 옮긴 뒤 frame 을 지운다 — 지울 수 없는 origin 이면 빈 origin 만 남는다 (E5).
      if (isSystemOwnedOrigin(node)) return reject("systemOwned");
      return OK;
    case "detach":
      return canDetachInstance(node) ? OK : reject("notInstance");
    case "copy":
    case "duplicate":
    case "group":
    case "move":
      return OK;
  }
}

export interface OperableSelection {
  ids: string[];
  rejected: { id: string; reason: OperationRejectReason }[];
}

/** 선택 중 작업 가능한 id 와 거부 사유. 순서는 입력 순서. */
export function filterOperable(
  op: StructuralOp,
  ids: readonly string[],
  lookup: OperableNodeLookup,
): OperableSelection {
  const result: OperableSelection = { ids: [], rejected: [] };
  for (const id of ids) {
    const verdict = canOperate(op, id, lookup);
    if (verdict.ok) result.ids.push(id);
    else result.rejected.push({ id, reason: verdict.reason });
  }
  return result;
}

/** 거부 사유 → 사용자에게 보일 문구 키. 사유를 보일 필요가 없는 것 (없는 노드 등) 은 null. */
export function getOperationRejectMessageKey(
  reason: OperationRejectReason,
): string | null {
  switch (reason) {
    case "body":
      return "operation.bodyLocked";
    case "systemOwned":
      return "operation.systemOriginLocked";
    case "templateAnchor":
      return "operation.templateAnchorLocked";
    case "synthetic":
      return "operation.instanceChildLocked";
    case "notFound":
    case "projection":
    case "notGroup":
    case "notInstance":
      return null;
  }
}

/**
 * 표면의 맵과 store 맵을 겹친 조회 — 대상은 표면 맵에 있는 id 만 (표면이 보지 않는 노드는
 * 고르지 않는다), 필드는 store 노드 (canonical 타입 · `reusable` · `metadata`) 를 먼저 읽는다.
 */
export function createOperableLookup(
  surfaceMap: ReadonlyMap<string, OperableNode>,
  storeMap?: ReadonlyMap<string, OperableNode>,
): OperableNodeLookup {
  return (id) =>
    surfaceMap.has(id) ? (storeMap?.get(id) ?? surfaceMap.get(id)) : undefined;
}

/** 거부된 대상 중 사유를 보일 첫 항목을 토스트로 알린다. 알렸으면 true. */
export function notifyOperationRejected(
  rejected: readonly { reason: OperationRejectReason }[],
): boolean {
  for (const { reason } of rejected) {
    const messageKey = getOperationRejectMessageKey(reason);
    if (!messageKey) continue;
    globalToast.info(messageKey, { messageKey });
    return true;
  }
  return false;
}

/**
 * 구조 변경 store 액션의 진입부 가드 — 표면을 거치지 않는 호출 (AI · 붙여넣기 · 단축키 · 내부
 * 경로) 도 같은 판정을 지난다. 통과한 id 만 돌려주고, 하나도 통과하지 못하면 이유를 알린다
 * (표면은 이미 걸렀으므로 여기 닿는 거부는 표면 밖 호출이다). 액션 목록은
 * `structuralStoreActionGuard.static.test.ts` 가 고정한다.
 */
export function guardStoreOperation(
  op: StructuralOp,
  ids: readonly string[],
  lookup: OperableNodeLookup,
): string[] {
  const selection = filterOperable(op, ids, lookup);
  if (selection.ids.length === 0) notifyOperationRejected(selection.rejected);
  return selection.ids;
}

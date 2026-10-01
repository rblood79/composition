import type { ShortcutId } from "./keyboardShortcuts";
import {
  ALIGN_MIN_SELECTION,
  DISTRIBUTE_MIN_SELECTION,
  GROUP_MIN_SELECTION,
  type CanvasActionElement,
} from "../workspace/canvas/actions/canvasActions";
import {
  canOperate,
  createOperableLookup,
  filterOperable,
  type OperationRejectReason,
  type StructuralOp,
} from "../domain/canOperate";
import {
  COMMAND_META,
  type AgentReadModel,
  type CommandMeta,
  type PreconditionResult,
} from "./commandMeta";

/**
 * ADR-248 4e-7: the old element store's command preconditions (ADR-196) — the handler's guard
 * over the old selection and element map (`canOperate`, minimum selection, single target). The
 * catalog Builder answers them through its agent command host; this table serves the old store
 * and its tests and goes with it.
 */
export interface LegacyAgentReadModel extends AgentReadModel {
  currentPageId: string | null;
  selectedElementId: string | null;
  selectedElementIds: readonly string[];
  multiSelectMode: boolean;
  elementsMap: ReadonlyMap<string, CanvasActionElement>;
  /** ADR-181 가이드 선택 — delete 가 요소 대신 가이드를 지우는 분기 */
  guideSelected: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const OK: PreconditionResult = { ok: true };
const fail = (reason: string): PreconditionResult => ({ ok: false, reason });
const operable = (op: StructuralOp, s: LegacyAgentReadModel) =>
  filterOperable(op, s.selectedElementIds, createOperableLookup(s.elementsMap))
    .ids;
const canOperateOn = (op: StructuralOp, s: LegacyAgentReadModel, id: string) =>
  canOperate(op, id, createOperableLookup(s.elementsMap));
/** 거부 사유 → precondition reason (kebab). */
const REJECT_REASON: Readonly<Record<OperationRejectReason, string>> = {
  notFound: "selection-empty",
  synthetic: "instance-child",
  projection: "projection",
  body: "body",
  systemOwned: "system-origin",
  templateAnchor: "template-anchor",
  notGroup: "not-a-frame",
  notInstance: "not-an-instance",
  delegatedSubpart: "delegated-subpart",
};
const singleTarget = (s: LegacyAgentReadModel) =>
  s.selectedElementIds.length > 1
    ? null
    : (s.selectedElementId ?? s.selectedElementIds[0] ?? null);

const requirePage = (s: LegacyAgentReadModel) =>
  s.currentPageId ? OK : fail("no-current-page");
const requireSelection = (op: StructuralOp) => (s: LegacyAgentReadModel) =>
  operable(op, s).length >= 1 ? OK : fail("selection-empty");
const requirePageAndSelection =
  (op: StructuralOp) =>
  (s: LegacyAgentReadModel): PreconditionResult => {
    const page = requirePage(s);
    return page.ok ? requireSelection(op)(s) : page;
  };
const requireSingle = (s: LegacyAgentReadModel) =>
  s.selectedElementIds.length > 1
    ? fail("multi-selection")
    : singleTarget(s)
      ? OK
      : fail("selection-empty");
// 개수로만 판정한다 — `multiSelectMode` 를 따로 요구하면 메뉴 (개수 판정) 에 선 항목이 no-op 이 된다 (E9).
const requireMulti =
  (op: StructuralOp, min: number) => (s: LegacyAgentReadModel) =>
    operable(op, s).length >= min ? OK : fail(`selection-lt-${min}`);
/** 단일 대상 + 그 작업의 판정. */
const requireSingleOperable =
  (op: StructuralOp) =>
  (s: LegacyAgentReadModel): PreconditionResult => {
    const id = singleTarget(s);
    if (!id) return fail("selection-empty");
    const verdict = canOperateOn(op, s, id);
    return verdict.ok ? OK : fail(REJECT_REASON[verdict.reason]);
  };
/** 선택의 대표 요소 (`selectedElementId`) 하나에 작용하는 핸들러 — 다중 선택도 허용. */
const requireSelectedElement = (s: LegacyAgentReadModel): PreconditionResult =>
  s.selectedElementId ? OK : fail("selection-empty");
/** z-order — 다중 선택이면 거부 (`multi-selection`), 아니면 이동 판정 (synthetic · projection · body). */
const requireSingleMove = (s: LegacyAgentReadModel): PreconditionResult => {
  const single = requireSingle(s);
  return single.ok ? requireSingleOperable("move")(s) : single;
};

const LEGACY_PRECONDITIONS: Partial<
  Record<ShortcutId, (s: LegacyAgentReadModel) => PreconditionResult>
> = {
  undo: (s) => (s.canUndo ? OK : fail("nothing-to-undo")),
  redo: (s) => (s.canRedo ? OK : fail("nothing-to-redo")),
  copy: requirePageAndSelection("copy"),
  paste: requirePage,
  // 잘라내기 = 복사 + 삭제 — 삭제할 수 있는 대상이 있어야 한다.
  cut: requirePageAndSelection("delete"),
  bringToFront: requireSingleMove,
  bringForward: requireSingleMove,
  sendBackward: requireSingleMove,
  sendToBack: requireSingleMove,
  duplicate: requirePageAndSelection("duplicate"),
  toggleComponentOrigin: (s) => {
    if (!s.selectedElementId) return fail("selection-empty");
    const verdict = canOperateOn("toggleOrigin", s, s.selectedElementId);
    return verdict.ok ? OK : fail(REJECT_REASON[verdict.reason]);
  },
  detachInstance: requireSingleOperable("detach"),
  selectAll: requirePage,
  delete: (s) => (s.guideSelected ? OK : requireSelection("delete")(s)),
  group: (s) => {
    const page = requirePage(s);
    return page.ok ? requireMulti("group", GROUP_MIN_SELECTION)(s) : page;
  },
  ungroup: (s) => {
    if (!s.selectedElementId) return fail("selection-empty");
    const verdict = canOperateOn("ungroup", s, s.selectedElementId);
    return verdict.ok ? OK : fail(REJECT_REASON[verdict.reason]);
  },
  alignLeft: requireMulti("move", ALIGN_MIN_SELECTION),
  alignHCenter: requireMulti("move", ALIGN_MIN_SELECTION),
  alignRight: requireMulti("move", ALIGN_MIN_SELECTION),
  alignTop: requireMulti("move", ALIGN_MIN_SELECTION),
  alignVCenter: requireMulti("move", ALIGN_MIN_SELECTION),
  alignBottom: requireMulti("move", ALIGN_MIN_SELECTION),
  distributeH: requireMulti("move", DISTRIBUTE_MIN_SELECTION),
  distributeV: requireMulti("move", DISTRIBUTE_MIN_SELECTION),
  // 스타일 복사/붙여넣기 — `selectedElementId` 한 요소에만 작용 (ADR-249 R1).
  copyStyles: requireSelectedElement,
  pasteStyles: requireSelectedElement,
};

/** `COMMAND_META` with the old store's preconditions (the old executor, menu and their tests). */
export const LEGACY_COMMAND_META: Readonly<Record<ShortcutId, CommandMeta>> =
  Object.fromEntries(
    (Object.keys(COMMAND_META) as ShortcutId[]).map((id) => {
      const precondition = LEGACY_PRECONDITIONS[id];
      return [
        id,
        precondition ? { ...COMMAND_META[id], precondition } : COMMAND_META[id],
      ];
    }),
  ) as Record<ShortcutId, CommandMeta>;

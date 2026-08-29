/**
 * COMMAND_META — 명령 정의 옆의 정적 metadata 표 (ADR-196 Phase 1).
 *
 * `SHORTCUT_DEFINITIONS` (무엇) 과 `commandRegistry` (마운트된 handler) 는 그대로 두고,
 * agent 호출에 필요한 **정적 사실** — 호출 가능 여부 · mutation 등급 · 되돌림 단위 ·
 * 승인 필요 · precondition — 을 별도 표로 둔다 (breakdown §3-1 세 층 분리).
 *
 * - 71 정의 전부 명시 — 누락은 type error (`Record<ShortcutId, CommandMeta>`).
 * - `agentCallable` 기본 false, allowlist 40 만 true (Phase 0 확정 — breakdown §2
 *   Phase 0 실측 결과). 상한 40 (HC2).
 * - 정적 게이트 4조항은 `validateCommandMeta` 가 판정하고 `commandMeta.static.test.ts`
 *   가 실제 표 + 민감도 사본으로 검사한다. 조항 5 (adapter export 표면) 는 같은 테스트가
 *   소스로 본다.
 *
 * precondition 은 handler 의 앞단 조건을 그대로 옮긴 것 — `canvasActions` 의 관문
 * (`selectableWithoutBody` · 최소 선택 수) 과 등록 hook 의 단일 선택 판정.
 */
import type { ShortcutId } from "./keyboardShortcuts";
import type { ShortcutDefinition } from "../types/keyboard";
import {
  ALIGN_MIN_SELECTION,
  DISTRIBUTE_MIN_SELECTION,
  GROUP_MIN_SELECTION,
  selectableWithoutBody,
  type CanvasActionElement,
} from "../workspace/canvas/actions/canvasActions";
import { isFrameOrLegacyGroup } from "../stores/utils/elementGrouping";
import { canDetachInstance } from "../utils/editingSemantics";

/**
 * mutation 등급.
 * - none: 읽기 · view: 줌/패널/포커스 (문서 무변경) · selection: 선택만
 * - document: 요소/스타일 변경 (history) · project: 페이지/프로젝트 메타
 * - external: DB/publish/navigation — 되돌림 불가, 본 ADR 에서 agent 노출 금지
 */
export type MutationScope =
  "none" | "view" | "selection" | "document" | "project" | "external";

/**
 * 되돌림 단위.
 * - history: agent 호출 1건 = history 1 entry (사용자 ⌘Z 1회) · none: 문서 무변경
 * - inverse: 반대 명령으로 되돌린다 (undo ↔ redo — entry 0, index 이동)
 * - irreversible: 되돌릴 수 없음 — document/project 면 confirm 필수 (조항 2)
 */
export type UndoKind = "history" | "none" | "inverse" | "irreversible";

export type PreconditionResult = { ok: true } | { ok: false; reason: string };

/** executor 가 store 에서 조립해 precondition 에 넘기는 읽기 모델 (Phase 2). */
export interface AgentReadModel {
  currentPageId: string | null;
  selectedElementId: string | null;
  selectedElementIds: readonly string[];
  multiSelectMode: boolean;
  elementsMap: ReadonlyMap<string, CanvasActionElement>;
  /** ADR-181 가이드 선택 — delete 가 요소 대신 가이드를 지우는 분기 */
  guideSelected: boolean;
  canUndo: boolean;
  canRedo: boolean;
  viewport: { containerSize: { width: number; height: number } };
}

/** 134 D11 호환 최소 JSON Schema — 파라미터 있는 명령만 (현재 allowlist 에는 없음). */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: readonly string[];
}

export interface CommandMeta {
  /** 기본 false — allowlist 만 true */
  agentCallable: boolean;
  mutation: MutationScope;
  undo: UndoKind;
  /** true 면 사용자 승인 없이는 실행 0 (destructive · external 은 필수) */
  confirm: boolean;
  precondition?: (s: AgentReadModel) => PreconditionResult;
  args?: JsonSchema;
}

// ---------- precondition 조각 ----------

const OK: PreconditionResult = { ok: true };
const fail = (reason: string): PreconditionResult => ({ ok: false, reason });
const nonBody = (s: AgentReadModel) =>
  selectableWithoutBody(s.selectedElementIds, s.elementsMap);
const singleTarget = (s: AgentReadModel) =>
  s.selectedElementIds.length > 1
    ? null
    : (s.selectedElementId ?? s.selectedElementIds[0] ?? null);

const requirePage = (s: AgentReadModel) =>
  s.currentPageId ? OK : fail("no-current-page");
const requireSelection = (s: AgentReadModel) =>
  nonBody(s).length >= 1 ? OK : fail("selection-empty");
const requirePageAndSelection = (s: AgentReadModel) => {
  const page = requirePage(s);
  return page.ok ? requireSelection(s) : page;
};
const requireSingle = (s: AgentReadModel) =>
  s.selectedElementIds.length > 1
    ? fail("multi-selection")
    : singleTarget(s)
      ? OK
      : fail("selection-empty");
const requireMulti = (min: number) => (s: AgentReadModel) =>
  !s.multiSelectMode
    ? fail("multi-select-mode-off")
    : nonBody(s).length >= min
      ? OK
      : fail(`selection-lt-${min}`);

// ---------- meta 조각 ----------

const view = (agentCallable = true): CommandMeta => ({
  agentCallable,
  mutation: "view",
  undo: "none",
  confirm: false,
});
const doc = (
  precondition: CommandMeta["precondition"],
  confirm = false,
): CommandMeta => ({
  agentCallable: true,
  mutation: "document",
  undo: "history",
  confirm,
  precondition,
});
/** 노출 금지 항목 — 등급만 기록 */
const off = (mutation: MutationScope, undo: UndoKind): CommandMeta => ({
  agentCallable: false,
  mutation,
  undo,
  confirm: mutation === "external",
});

export const COMMAND_META: Readonly<Record<ShortcutId, CommandMeta>> = {
  // ---- system ----
  undo: {
    agentCallable: true,
    mutation: "document",
    undo: "inverse", // entry 0 — index 이동 (Phase 0 실측), redo 로 되돌린다
    confirm: false,
    precondition: (s) => (s.canUndo ? OK : fail("nothing-to-undo")),
  },
  redo: {
    agentCallable: true,
    mutation: "document",
    undo: "inverse",
    confirm: false,
    precondition: (s) => (s.canRedo ? OK : fail("nothing-to-redo")),
  },
  openProject: off("external", "irreversible"), // navigate("/dashboard")

  // ---- navigation ----
  zoomIn: view(),
  zoomInNumpad: view(false), // alias of zoomIn
  zoomOut: view(),
  zoomToFit: {
    ...view(),
    precondition: (s) =>
      s.viewport.containerSize.width > 0 && s.viewport.containerSize.height > 0
        ? OK
        : fail("container-size-zero"),
  },
  zoomToSelection: view(false), // BuilderCanvas 클로저 (frameAreas) 의존 — store 만으로 재현 불가
  zoom100: view(),
  zoom200: view(),

  // ---- panels ----
  toggleNavigator: view(),
  toggleComponents: view(),
  toggleDatatable: view(),
  toggleTheme: view(),
  toggleProperties: view(),
  toggleStyles: view(),
  toggleEvents: view(),
  toggleHistory: view(),
  toggleWorkflowOverlay: view(false),
  toggleMonitor: view(false), // 개발 계측 패널
  toggleRulers: view(),
  openSettings: view(),
  toggleAI: view(false), // agent 가 자기 host 패널을 닫는다
  commandPalette: view(false), // palette:false

  // ---- canvas ----
  copy: {
    agentCallable: true,
    mutation: "none",
    undo: "none",
    confirm: false,
    precondition: requirePageAndSelection,
  },
  paste: doc(requirePage),
  cut: doc(requirePageAndSelection, true),
  bringToFront: doc(requireSingle),
  bringForward: doc(requireSingle),
  sendBackward: doc(requireSingle),
  sendToBack: doc(requireSingle),
  duplicate: doc(requirePageAndSelection),
  toggleComponentOrigin: doc((s) =>
    s.selectedElementId ? OK : fail("selection-empty"),
  ),
  detachInstance: doc((s) => {
    const id = singleTarget(s);
    if (!id) return fail("selection-empty");
    return canDetachInstance(s.elementsMap.get(id))
      ? OK
      : fail("not-an-instance");
  }, true),
  selectAll: {
    agentCallable: true,
    mutation: "selection",
    undo: "none",
    confirm: false,
    precondition: requirePage,
  },
  delete: doc((s) => (s.guideSelected ? OK : requireSelection(s)), true),
  deleteAlt: off("document", "history"), // alias of delete
  escape: off("selection", "none"),
  nextElement: off("selection", "none"),
  prevElement: off("selection", "none"),
  group: doc((s) => {
    const page = requirePage(s);
    return page.ok ? requireMulti(GROUP_MIN_SELECTION)(s) : page;
  }),
  ungroup: doc((s) => {
    if (!s.selectedElementId) return fail("selection-empty");
    return isFrameOrLegacyGroup(s.elementsMap.get(s.selectedElementId)?.type)
      ? OK
      : fail("not-a-frame");
  }),
  alignLeft: doc(requireMulti(ALIGN_MIN_SELECTION)),
  alignHCenter: doc(requireMulti(ALIGN_MIN_SELECTION)),
  alignRight: doc(requireMulti(ALIGN_MIN_SELECTION)),
  alignTop: doc(requireMulti(ALIGN_MIN_SELECTION)),
  alignVCenter: doc(requireMulti(ALIGN_MIN_SELECTION)),
  alignBottom: doc(requireMulti(ALIGN_MIN_SELECTION)),
  distributeH: doc(requireMulti(DISTRIBUTE_MIN_SELECTION)),
  distributeV: doc(requireMulti(DISTRIBUTE_MIN_SELECTION)),
  // 화살표 — 형제 순서 / 페이지 nudge (연속키, 노출 금지)
  arrowUp: off("document", "history"),
  arrowDown: off("document", "history"),
  arrowLeft: off("document", "history"),
  arrowRight: off("document", "history"),
  arrowUpShift: off("document", "history"),
  arrowDownShift: off("document", "history"),
  arrowLeftShift: off("document", "history"),
  arrowRightShift: off("document", "history"),

  // ---- properties (패널 로컬 클립보드 — 노출 금지) ----
  copyProperties: off("none", "none"),
  pasteProperties: off("document", "history"),
  copyStyles: off("none", "none"),
  pasteStyles: off("document", "history"),
  toggleFocusMode: view(), // useSectionCollapse 전역 store
  toggleSections: view(false), // 패널 UI 전용

  // ---- navigator (RAC TreeBase 네이티브 — registry 밖, palette:false) ----
  treeNavDown: off("selection", "none"),
  treeNavUp: off("selection", "none"),
  treeNavRight: off("selection", "none"),
  treeNavLeft: off("selection", "none"),
  treeNavHome: off("selection", "none"),
  treeNavEnd: off("selection", "none"),
  treeSelect: off("selection", "none"),
  treeSelectSpace: off("selection", "none"),
};

/** agentCallable:true 인 id — 정의 순서 그대로. */
export function agentCallableIds(
  meta: Readonly<Record<ShortcutId, CommandMeta>> = COMMAND_META,
): ShortcutId[] {
  return (Object.keys(meta) as ShortcutId[]).filter(
    (id) => meta[id].agentCallable,
  );
}

export interface CommandMetaViolation {
  rule: 1 | 2 | 3 | 4;
  id: ShortcutId;
  message: string;
}

/**
 * 정적 게이트 조항 1~4 (breakdown §3-2).
 * 1. agentCallable ⇔ adapter 존재 (양방향 — adapter 없는 노출 0, 노출 없는 adapter 0)
 * 2. mutation ∈ {document, project} ∧ undo ∉ {history, inverse} ⇒ confirm
 * 3. mutation external ⇒ agentCallable false
 * 4. palette:false 정의 ⇒ agentCallable false
 */
export function validateCommandMeta(
  meta: Readonly<Record<ShortcutId, CommandMeta>>,
  adapterIds: ReadonlySet<ShortcutId>,
  definitions: Readonly<Record<ShortcutId, ShortcutDefinition>>,
): CommandMetaViolation[] {
  const out: CommandMetaViolation[] = [];
  for (const id of Object.keys(meta) as ShortcutId[]) {
    const m = meta[id];
    const hasAdapter = adapterIds.has(id);
    if (m.agentCallable && !hasAdapter)
      out.push({ rule: 1, id, message: "agentCallable 이지만 adapter 없음" });
    if (!m.agentCallable && hasAdapter)
      out.push({
        rule: 1,
        id,
        message: "adapter 가 있지만 agentCallable 아님",
      });
    if (
      (m.mutation === "document" || m.mutation === "project") &&
      m.undo !== "history" &&
      m.undo !== "inverse" &&
      !m.confirm
    )
      out.push({ rule: 2, id, message: "되돌릴 수 없는 변경은 confirm 필수" });
    if (m.mutation === "external" && m.agentCallable)
      out.push({ rule: 3, id, message: "external 은 agent 노출 금지" });
    if (definitions[id]?.palette === false && m.agentCallable)
      out.push({
        rule: 4,
        id,
        message: "palette:false 정의는 agent 노출 금지",
      });
  }
  return out;
}

/**
 * executeAgentCommand — agent 호출의 단일 진입점 (ADR-196 Phase 2, breakdown §3-4).
 *
 *   allowlist → precondition → confirm 게이트 → adapter 실행 → 기록 1건
 *
 * - 기본 거부: `COMMAND_META[id].agentCallable` 이 false 면 실행 0 (HC2). 정의에 없는 id 도 거부.
 * - 승인: `confirm: true` 명령은 `ctx.requestConfirm` 이 true 를 돌려줄 때만 실행 (HC3).
 *   승인 전 store 변경 0 — adapter 는 게이트 뒤에서만 불린다.
 * - 배치: 원소별 승인 (한 번의 승인으로 destructive 를 묶어 숨기지 못한다 — R2). 첫 non-ok
 *   에서 멈춘다 — 뒤 원소는 앞 원소의 결과를 전제하는 경우가 많고, agent 는 부분 결과를
 *   받아 다음 판단을 한다.
 * - transaction 으로 감싸지 않는다 — `runInTransaction` 은 동기 창 전용이고 adapter 는
 *   async. 1 entry 는 액션 자체가 보장한다 (Phase 0 실측 — `agentCommands.history.test.ts`).
 * - 호출 1건 = 기록 1건, 5 status 전부 (HC4) — `useAgentCommandLogStore`.
 * - ADR-213 Phase 5: `data.*` 4 명령 (`DATA_COMMAND_META` · `DATA_AGENT_COMMANDS`) 은 id 축이
 *   다르지만 (`ShortcutId` 가 아니다) 같은 게이트를 지난다 — 인자를 받고 (`args`), precondition
 *   이 데이터 store 읽기 모델을 본다. `importPaste` 는 승인·기록을 데이터 proposal dispatcher
 *   가 맡는다 (`provenance:"dispatcher"`) — executor 는 ok 기록을 남기지 않는다 (1 호출 = 1 기록).
 */
import { useStore } from "../../builder/stores";
import { historyManager } from "../../builder/stores/history";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import { getSelectedGuide } from "../../builder/workspace/canvas/interaction/guideEmphasis";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../builder/config/keyboardShortcuts";
import {
  COMMAND_META,
  agentCallableIds,
  type AgentReadModel,
  type CommandMeta,
} from "../../builder/config/commandMeta";
import {
  DATA_AGENT_COMMAND_IDS,
  DATA_COMMAND_META,
  isDataAgentCommandId,
  type DataAgentCommandId,
  type DataAgentReadModel,
  type DataCommandArgs,
} from "../../builder/config/dataCommandMeta";
import { useDataStore } from "../../builder/stores/data";
import {
  useAgentCommandLogStore,
  type AgentCommandLogEntry,
  type AgentCommandStatus,
  type AgentHost,
} from "../../builder/stores/agentCommandLog";
import type { ToolTranslate } from "../../types/integrations/ai.types";
import { localizedStrings } from "../../i18n/translations";
import { getStoredLocale } from "../../i18n/locales";
import { AGENT_COMMANDS, type AgentCommandInput } from "./agentCommands";
import { DATA_AGENT_COMMANDS } from "./dataAgentCommands";

/** agent 명령 id — 단축키 allowlist (ADR-196) + `data.*` (ADR-213). */
export type AgentCommandId = ShortcutId | DataAgentCommandId;

export interface AgentConfirmRequest {
  id: AgentCommandId;
  /** 사용자에게 보여 줄 한 줄 — 정의의 description */
  summary: string;
  meta: Pick<CommandMeta, "mutation" | "undo" | "confirm">;
  args?: unknown;
}

export interface AgentExecutionContext {
  host: AgentHost;
  /** 승인 게이트 — `confirm: true` 명령마다 호출. false 면 `declined`. */
  requestConfirm: (request: AgentConfirmRequest) => Promise<boolean>;
  clipboard?: AgentCommandInput["clipboard"];
  /** 데이터 proposal 승인 요약 문구 — 미지정 시 저장된 locale 의 카탈로그로 해소 */
  t?: ToolTranslate;
}

export type AgentExecutionResult =
  | {
      status: "ok";
      id: AgentCommandId;
      undoable: boolean;
      historyIndex?: number;
      durationMs: number;
    }
  | {
      status: Exclude<AgentCommandStatus, "ok">;
      id: AgentCommandId | string;
      reason: string;
      durationMs: number;
    };

export interface AgentCommandRequest {
  id: string;
  args?: unknown;
}

/** consumer (AI tool · window · 134 D11) 가 노출하는 descriptor — allowlist 만. */
export interface AgentCommandDescriptor {
  id: AgentCommandId;
  description: string;
  mutation: CommandMeta["mutation"];
  undo: CommandMeta["undo"];
  /** `data.runEndpoint` 는 인자 (method) 로 판정 — descriptor 에는 "물을 수 있음" 으로 true */
  confirm: boolean;
  args?: CommandMeta["args"];
}

export function listAgentCommands(): AgentCommandDescriptor[] {
  const shortcuts = agentCallableIds().map((id): AgentCommandDescriptor => {
    const meta = COMMAND_META[id];
    return {
      id,
      description: SHORTCUT_DEFINITIONS[id].description,
      mutation: meta.mutation,
      undo: meta.undo,
      confirm: meta.confirm,
      ...(meta.args ? { args: meta.args } : {}),
    };
  });
  const data = DATA_AGENT_COMMAND_IDS.map((id): AgentCommandDescriptor => {
    const meta = DATA_COMMAND_META[id];
    return {
      id,
      description: meta.description,
      mutation: meta.mutation,
      undo: meta.undo,
      confirm: meta.confirm !== false,
      args: meta.args,
    };
  });
  return [...shortcuts, ...data];
}

/** precondition 이 읽는 모델 — handler 가 읽는 것과 같은 store 들에서 조립. */
export function buildAgentReadModel(): AgentReadModel {
  const s = useStore.getState();
  const history = historyManager.getCurrentPageHistory();
  return {
    currentPageId: s.currentPageId,
    selectedElementId: s.selectedElementId,
    selectedElementIds: s.selectedElementIds,
    multiSelectMode: s.multiSelectMode,
    elementsMap: s.elementsMap,
    guideSelected: getSelectedGuide() !== null,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    viewport: { containerSize: useViewportSyncStore.getState().containerSize },
  };
}

/** `data.*` precondition 이 읽는 모델 — 패널 handler 와 같은 데이터 store. */
export function buildDataAgentReadModel(): DataAgentReadModel {
  const s = useDataStore.getState();
  return {
    projectLoaded: s.isInitialized && s.currentProjectId !== null,
    collections: [...s.collections.values()].map(({ id, name }) => ({
      id,
      name,
    })),
    endpoints: [...s.apiEndpoints.values()].map(({ id, name, method }) => ({
      id,
      name,
      method,
    })),
  };
}

/** React 밖 translate — 저장된 locale 의 평탄 카탈로그 (함수 메시지는 params 적용). */
function catalogTranslate(): ToolTranslate {
  const catalog = localizedStrings[getStoredLocale()];
  return (key, params) => {
    const message = catalog[key];
    if (message === undefined) return key;
    return typeof message === "function" ? message(params ?? {}) : message;
  };
}

function isShortcutId(id: string): id is ShortcutId {
  return Object.prototype.hasOwnProperty.call(SHORTCUT_DEFINITIONS, id);
}

function asArgs(args: unknown): DataCommandArgs {
  return typeof args === "object" && args !== null && !Array.isArray(args)
    ? (args as DataCommandArgs)
    : {};
}

/**
 * Phase 1에서 외부 agent에 노출된 구 명령 ID. 신규 descriptor에는
 * canonical ID만 노출하고, 기존 호출만 executor 경계에서 정규화한다.
 */
const LEGACY_AGENT_COMMAND_ALIASES = {
  toggleNodes: "toggleNavigator",
} as const satisfies Readonly<Record<string, ShortcutId>>;

function canonicalAgentCommandId(id: string): string {
  return (
    LEGACY_AGENT_COMMAND_ALIASES[
      id as keyof typeof LEGACY_AGENT_COMMAND_ALIASES
    ] ?? id
  );
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function record(
  entry: Omit<AgentCommandLogEntry, "seq" | "ts">,
): AgentCommandLogEntry {
  return useAgentCommandLogStore
    .getState()
    .append({ ...entry, ts: Date.now() });
}

export async function executeAgentCommand(
  id: string,
  args: unknown,
  ctx: AgentExecutionContext,
): Promise<AgentExecutionResult> {
  const started = now();
  const finishDenied = (
    status: Exclude<AgentCommandStatus, "ok">,
    reason: string,
    mutation: AgentCommandLogEntry["mutation"],
  ): AgentExecutionResult => {
    const durationMs = now() - started;
    record({
      host: ctx.host,
      id,
      args,
      status,
      reason,
      mutation,
      undoable: false,
      durationMs,
    });
    return { status, id, reason, durationMs };
  };

  if (isDataAgentCommandId(id)) {
    return executeDataAgentCommand(id, asArgs(args), ctx, started, finishDenied);
  }

  // 1. allowlist
  const canonicalId = canonicalAgentCommandId(id);
  if (!isShortcutId(canonicalId))
    return finishDenied("denied", "unknown-command", "unknown");
  const meta = COMMAND_META[canonicalId];
  if (!meta.agentCallable) {
    return finishDenied(
      "denied",
      meta.mutation === "external" ? "external" : "not-agent-callable",
      meta.mutation,
    );
  }
  const adapter = AGENT_COMMANDS[canonicalId];
  if (!adapter) return finishDenied("denied", "adapter-missing", meta.mutation);

  // 2. precondition
  if (meta.precondition) {
    const check = meta.precondition(buildAgentReadModel());
    if (!check.ok)
      return finishDenied("precondition-failed", check.reason, meta.mutation);
  }

  // 3. confirm 게이트 — 승인 전 store 변경 0
  if (meta.confirm) {
    const approved = await ctx.requestConfirm({
      id: canonicalId,
      summary: SHORTCUT_DEFINITIONS[canonicalId].description,
      meta,
      args,
    });
    if (!approved)
      return finishDenied("declined", "user-declined", meta.mutation);
  }

  // 4. 실행 — transaction 없음 (동기 창 전용), 1 entry 는 액션이 보장
  try {
    await adapter({
      elementsMap: useStore.getState().elementsMap,
      clipboard: ctx.clipboard,
    });
  } catch (error) {
    return finishDenied(
      "error",
      error instanceof Error ? error.message : String(error),
      meta.mutation,
    );
  }

  // 5. 기록
  const durationMs = now() - started;
  const undoable = meta.undo === "history";
  const historyIndex = undoable
    ? historyManager.getCurrentPageHistory().currentIndex
    : undefined;
  record({
    host: ctx.host,
    id: canonicalId,
    args,
    status: "ok",
    mutation: meta.mutation,
    undoable,
    ...(historyIndex !== undefined ? { historyIndex } : {}),
    durationMs,
  });
  return {
    status: "ok",
    id: canonicalId,
    undoable,
    ...(historyIndex !== undefined ? { historyIndex } : {}),
    durationMs,
  };
}

/** `data.*` — 같은 게이트 순서 (precondition → confirm → adapter → 기록), 표만 다르다. */
async function executeDataAgentCommand(
  id: DataAgentCommandId,
  args: DataCommandArgs,
  ctx: AgentExecutionContext,
  started: number,
  finishDenied: (
    status: Exclude<AgentCommandStatus, "ok">,
    reason: string,
    mutation: AgentCommandLogEntry["mutation"],
  ) => AgentExecutionResult,
): Promise<AgentExecutionResult> {
  const meta = DATA_COMMAND_META[id];
  const adapter = DATA_AGENT_COMMANDS[id];
  if (!adapter) return finishDenied("denied", "adapter-missing", meta.mutation);

  // 2. precondition — 프로젝트 로드 · 대상 존재 · 필수 인자
  const read = buildDataAgentReadModel();
  const check = meta.precondition(read, args);
  if (!check.ok)
    return finishDenied("precondition-failed", check.reason, meta.mutation);

  // 3. confirm 게이트 — 정적 또는 인자 판정. dispatcher 가 묻는 명령 (importPaste) 은 여기서 0.
  const needsConfirm =
    typeof meta.confirm === "function" ? meta.confirm(read, args) : meta.confirm;
  if (needsConfirm) {
    const approved = await ctx.requestConfirm({
      id,
      summary: meta.description,
      meta: { mutation: meta.mutation, undo: meta.undo, confirm: true },
      args,
    });
    if (!approved)
      return finishDenied("declined", "user-declined", meta.mutation);
  }

  // 4. 실행
  let outcome: Awaited<ReturnType<typeof adapter>>;
  try {
    outcome = await adapter(args, {
      read,
      host: ctx.host,
      t: ctx.t ?? catalogTranslate(),
    });
  } catch (error) {
    return finishDenied(
      "error",
      error instanceof Error ? error.message : String(error),
      meta.mutation,
    );
  }
  if (!outcome.ok) {
    if (meta.provenance === "dispatcher") {
      // dispatcher 가 declined/error 를 이미 기록했다 — 결과만 돌려준다.
      return {
        status: outcome.status,
        id,
        reason: outcome.reason,
        durationMs: now() - started,
      };
    }
    return finishDenied(outcome.status, outcome.reason, meta.mutation);
  }

  // 5. 기록 — dispatcher 가 남긴 명령은 생략 (호출 1건 = 기록 1건)
  const durationMs = now() - started;
  const undoable = meta.undo === "history";
  const historyIndex = outcome.historyIndex;
  if (meta.provenance === "executor") {
    record({
      host: ctx.host,
      id,
      args,
      status: "ok",
      mutation: meta.mutation,
      undoable,
      ...(historyIndex !== undefined ? { historyIndex } : {}),
      durationMs,
    });
  }
  return {
    status: "ok",
    id,
    undoable,
    ...(historyIndex !== undefined ? { historyIndex } : {}),
    durationMs,
  };
}

/**
 * 배치 — 원소별 승인, 첫 non-ok 에서 중단. mutation 등급은 원소 max 지만 게이트는
 * 원소마다 따로 지난다 (승인 1회로 묶지 않는다 — R2).
 */
export async function executeAgentCommands(
  requests: readonly AgentCommandRequest[],
  ctx: AgentExecutionContext,
): Promise<AgentExecutionResult[]> {
  const results: AgentExecutionResult[] = [];
  for (const request of requests) {
    const result = await executeAgentCommand(request.id, request.args, ctx);
    results.push(result);
    if (result.status !== "ok") break;
  }
  return results;
}

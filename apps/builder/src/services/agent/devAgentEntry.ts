/**
 * `window.__compositionAgent` — DEV 전용 agent 진입점 (ADR-196 Phase 3, §3-6).
 *
 * Chrome MCP 로 빌더를 조작하는 외부 agent (Claude/Codex) 와 Phase 3 live 게이트가 쓴다.
 * 프로덕션 번들에는 들어가지 않는다 (`import.meta.env.DEV` 호출부 가드 — HC6).
 * 실행 경로는 AI 패널 도구와 완전히 같다 (executor 경유) — host 이름만 다르다.
 */
import {
  executeAgentCommand,
  executeAgentCommands,
  listAgentCommands,
  type AgentCommandDescriptor,
  type AgentExecutionContext,
  type AgentExecutionResult,
} from "./executeAgentCommand";
import {
  hasAgentCommandConfirmationHost,
  requestAgentCommandConfirmation,
} from "./agentCommandConfirmation";
import {
  useAgentCommandLogStore,
  type AgentCommandLogEntry,
} from "../../builder/stores/agentCommandLog";

export interface DevAgentEntry {
  /** allowlist descriptor — id · mutation · undo · confirm */
  list: () => AgentCommandDescriptor[];
  /** 명령 1건 실행 — 승인 필요 명령은 다이얼로그가 뜨고 사용자가 누른다 */
  run: (id: string, args?: unknown) => Promise<AgentExecutionResult>;
  /** 순서 실행 — 원소마다 승인, 첫 실패에서 중단 */
  runMany: (ids: readonly string[]) => Promise<AgentExecutionResult[]>;
  /** 세션 기록 (호출 1건 = 1건) */
  log: () => readonly AgentCommandLogEntry[];
  clearLog: () => void;
  /** 승인 UI 마운트 여부 — false 면 파괴적 명령은 실행되지 않고 declined */
  hasConfirmHost: () => boolean;
}

const context: AgentExecutionContext = {
  host: "chrome-mcp",
  requestConfirm: ({ id, summary, meta, args }) =>
    requestAgentCommandConfirmation({
      id,
      summary,
      mutation: meta.mutation,
      undo: meta.undo,
      host: "chrome-mcp",
      args,
    }),
};

export function createDevAgentEntry(): DevAgentEntry {
  return {
    list: listAgentCommands,
    run: (id, args) => executeAgentCommand(id, args, context),
    runMany: (ids) =>
      executeAgentCommands(
        ids.map((id) => ({ id })),
        context,
      ),
    log: () => useAgentCommandLogStore.getState().entries,
    clearLog: () => useAgentCommandLogStore.getState().clear(),
    hasConfirmHost: hasAgentCommandConfirmationHost,
  };
}

declare global {
  interface Window {
    __compositionAgent?: DevAgentEntry;
  }
}

/** 호출부는 `import.meta.env.DEV` 로 감싼다 (BuilderCore). 반환값은 해제 함수. */
export function installDevAgentEntry(): () => void {
  if (typeof window === "undefined") return () => {};
  window.__compositionAgent = createDevAgentEntry();
  return () => {
    delete window.__compositionAgent;
  };
}

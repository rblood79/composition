/**
 * agentCommandLog — agent 가 실행(또는 거부당)한 명령의 세션 기록 (ADR-196 Phase 2, §3-5).
 *
 * 호출 1건 = 기록 1건 (HC4) — 5 status 전부 (`ok · denied · precondition-failed ·
 * declined · error`). AIPanel 이 "agent 가 실행한 명령" 으로 보여 주는 소비처이고,
 * dev harness (`window.__compositionAgent.log()`) 는 같은 배열을 읽는다.
 *
 * 세션 메모리 — 영속하지 않는다 (R5). 앱이 파일을 쓰지 않는다. root store 에 편입하지
 * 않고 독립 store 로 둔 이유: 문서 상태와 무관한 관측 데이터라 history/persist/undo
 * 경로에 섞이면 안 되고 (`useSectionCollapse`·`useViewportSyncStore` 와 같은 어법),
 * 소비처가 AIPanel 뿐이라 root 슬라이스 타입을 넓힐 이유가 없다.
 */
import { create } from "zustand";
import type { ShortcutId } from "../config/keyboardShortcuts";
import type { MutationScope } from "../config/commandMeta";

export type AgentHost = "ai-panel" | "chrome-mcp" | "mcp";

export type AgentCommandStatus =
  "ok" | "denied" | "precondition-failed" | "declined" | "error";

export interface AgentCommandLogEntry {
  /** 세션 내 단조 증가 */
  seq: number;
  ts: number;
  host: AgentHost;
  id: ShortcutId | string;
  args?: unknown;
  status: AgentCommandStatus;
  reason?: string;
  mutation: MutationScope | "unknown";
  /** `undo: "history"` 명령이 ok 로 끝났을 때만 true */
  undoable: boolean;
  /** 실행 직후 `historyManager.getCurrentPageHistory().currentIndex` (undoable 일 때) */
  historyIndex?: number;
  durationMs: number;
}

/** 세션 상한 — 초과 시 오래된 것부터 버린다 (관측 데이터, 감사 로그 아님). */
export const AGENT_COMMAND_LOG_LIMIT = 500;

interface AgentCommandLogState {
  entries: readonly AgentCommandLogEntry[];
  append: (entry: Omit<AgentCommandLogEntry, "seq">) => AgentCommandLogEntry;
  clear: () => void;
}

let nextSeq = 1;

export const useAgentCommandLogStore = create<AgentCommandLogState>()(
  (set) => ({
    entries: [],
    append: (entry) => {
      const full: AgentCommandLogEntry = { ...entry, seq: nextSeq++ };
      set((state) => ({
        entries: [...state.entries, full].slice(-AGENT_COMMAND_LOG_LIMIT),
      }));
      return full;
    },
    clear: () => set({ entries: [] }),
  }),
);

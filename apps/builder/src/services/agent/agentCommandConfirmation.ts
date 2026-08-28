/**
 * agent 명령 승인 채널 (ADR-196 Phase 3).
 *
 * `confirm: true` 명령 (`delete` · `cut` · `detachInstance`) 은 이 채널로 사용자에게 묻고,
 * 승인 없이는 실행 0 (HC3). 구조는 `utils/editingSemanticsImpactConfirmation.ts` 와 같은
 * 어법 — 요청을 구독 중인 host 다이얼로그가 열고, `resolve...` 로 Promise 를 닫는다.
 *
 * **host 가 없으면 승인이 아니라 거부** (`false`). 기존 편집 다이얼로그는 `window.confirm`
 * 으로 물러서지만 agent 경로는 그럴 수 없다 — 호출자가 사람이 아니라서 native 모달을
 * 띄우면 자동화(Chrome MCP/헤드리스)가 그 자리에서 멈추고, "물어볼 수 없는 상태" 를
 * 통과로 해석하면 승인 없는 파괴가 생긴다 (HC3). 승인 UI 가 살아 있을 때만 파괴적
 * 명령이 실행된다.
 */
import type { ShortcutId } from "../../builder/config/keyboardShortcuts";
import type { CommandMeta } from "../../builder/config/commandMeta";
import type { AgentHost } from "../../builder/stores/agentCommandLog";

export interface AgentCommandConfirmationRequest {
  id: ShortcutId;
  summary: string;
  mutation: CommandMeta["mutation"];
  undo: CommandMeta["undo"];
  host: AgentHost;
  args?: unknown;
}

type Listener = (request: AgentCommandConfirmationRequest | null) => void;

let activeRequest: AgentCommandConfirmationRequest | null = null;
let activeResolve: ((confirmed: boolean) => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(activeRequest);
}

/** 승인 UI 가 마운트돼 있는가 — 없으면 파괴적 명령은 실행되지 않는다. */
export function hasAgentCommandConfirmationHost(): boolean {
  return listeners.size > 0;
}

export function subscribeAgentCommandConfirmation(
  listener: Listener,
): () => void {
  listeners.add(listener);
  listener(activeRequest);
  return () => {
    listeners.delete(listener);
  };
}

export function requestAgentCommandConfirmation(
  request: AgentCommandConfirmationRequest,
): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(false);

  // 앞선 요청이 열려 있으면 그것은 거부로 닫는다 (한 번에 하나만 묻는다).
  if (activeResolve) {
    const previous = activeResolve;
    activeResolve = null;
    previous(false);
  }

  activeRequest = request;
  notify();

  return new Promise<boolean>((resolve) => {
    activeResolve = resolve;
  });
}

export function resolveAgentCommandConfirmation(confirmed: boolean): void {
  const resolve = activeResolve;
  activeResolve = null;
  activeRequest = null;
  notify();
  resolve?.(confirmed);
}

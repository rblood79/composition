/**
 * ADR-248 Phase 4e-5: the document host of agent commands. The open Builder installs one
 * (`setAgentCommandHost`); the agent executor (ADR-196) and the header menu (ADR-249) ask it first
 * — a plan runs, a reason refuses (the precondition), `undefined` leaves the command to its
 * default adapter and `COMMAND_META` precondition (view commands: zoom, panels). Without a host
 * the old store adapters apply.
 */
import type { PreconditionResult } from "../../builder/config/commandMeta";
import type { ShortcutId } from "../../builder/config/keyboardShortcuts";

export interface AgentCommandPlan {
  run(): void | Promise<void>;
}

export interface AgentCommandHost {
  /** What the command does now: a plan, a refusal reason, or `undefined` (not this host's). */
  plan(id: ShortcutId): AgentCommandPlan | { reason: string } | undefined;
  /** The history position after a document command (the log's `historyIndex`). */
  historyIndex(): number;
}

let current: AgentCommandHost | null = null;

/** Install the host of the open Builder; returns the uninstall. */
export function setAgentCommandHost(host: AgentCommandHost): () => void {
  current = host;
  return () => {
    if (current === host) current = null;
  };
}

export function getAgentCommandHost(): AgentCommandHost | null {
  return current;
}

/** The host's precondition of a command (`undefined` = the host leaves it to `COMMAND_META`). */
export function hostPrecondition(
  id: ShortcutId,
): PreconditionResult | undefined {
  const plan = current?.plan(id);
  if (!plan) return undefined;
  return "run" in plan ? { ok: true } : { ok: false, reason: plan.reason };
}

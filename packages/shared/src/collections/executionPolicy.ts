import type { ExecutionPolicy } from "../types/collection.types";

/**
 * ADR-218 — when a collection an endpoint fills loads. 사용자 결정 2026-11-26: a collection with no
 * policy loads when the app (and the Builder's Preview) opens — `auto`. 「Manual」 is a stored choice:
 * the app waits for a rule's reload (a search screen's 「조회」 button). One reading for the Data
 * panel, the Builder's Preview opening and the published app's session.
 * **Why**: no policy used to read as manual and the panel's 「Manual」 removed the policy — after the
 * published app began loading by policy (none = on open) there was no way to author 「load on press」,
 * and the Preview (no load) and the published app (load) disagreed about a collection with no policy.
 */
export function executionModeOf(
  policy: Readonly<ExecutionPolicy> | undefined,
): ExecutionPolicy["mode"] {
  return policy?.mode ?? "auto";
}

/** The policy a panel choice stores — every choice is stored (`manual` is not 「no policy」). */
export function executionPolicyOfChoice(
  mode: ExecutionPolicy["mode"],
  intervalSec?: number,
): ExecutionPolicy {
  return mode === "interval"
    ? { mode, intervalSec: intervalSec ?? 30 }
    : { mode };
}

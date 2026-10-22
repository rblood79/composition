import {
  CAPABILITY_REGISTRY,
  COMMON_CAPABILITIES,
} from "../../interactions/capabilityRegistry";
import { NEVER_OFFERED_GROUPS } from "../../interactions/exposure";
import type { InteractionEntry } from "./types";

/**
 * ADR-248 Phase 4e-4e: the code catalog library's execution vocabulary — the Interactions rule
 * vocabulary (ADR-158 · ADR-214): triggers are the RAC callbacks a component type declares, the
 * capabilities its registered Do-axis features plus the common three (deferred ones are not
 * exposed), and the app actions the rules editor offers. ADR-281 — a group's hidden events (the
 * panel's "all of RAC" toggle) are names a document may use too; keyboard never (Q3). Which triggers and capabilities a given
 * type may use stays the registry's (`resolveTriggers` · `resolveCapabilities`); the library holds
 * the set a document may name.
 */
export const CATALOG_ACTION_OPCODES = [
  "setState",
  "navigate",
  "toast",
  "capability",
  // ADR-281 Decision 5 — a Form's submit to an API endpoint.
  "callEndpoint",
  // ADR-281 user decision 3, second step — a rule appends to a collection (`useListData.append`).
  "append",
] as const satisfies readonly InteractionEntry["action"]["opcode"][];

export function codeExecutionVocabulary(): {
  triggerIds: string[];
  capabilityIds: string[];
  actionOpCodes: InteractionEntry["action"]["opcode"][];
} {
  const triggers = new Set<string>();
  const capabilities = new Set<string>(Object.keys(COMMON_CAPABILITIES));
  for (const entry of Object.values(CAPABILITY_REGISTRY)) {
    for (const trigger of entry.events) triggers.add(trigger);
    for (const group of entry.groups ?? [])
      if (!NEVER_OFFERED_GROUPS.includes(group.id))
        for (const trigger of group.hiddenEvents) triggers.add(trigger);
    for (const capability of Object.keys(entry.capabilities))
      capabilities.add(capability);
  }
  return {
    triggerIds: [...triggers].sort(),
    capabilityIds: [...capabilities].sort(),
    actionOpCodes: [...CATALOG_ACTION_OPCODES],
  };
}

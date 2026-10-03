/**
 * The view commands' precondition model — the agent executor (ADR-196) and the header menu
 * (ADR-249) read it. Document · selection commands are the open Builder's host
 * (`agentCommandHost`); the old store's model is `agentReadModel.legacy.ts`.
 */
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import type { AgentReadModel } from "../../builder/config/commandMeta";

export function buildAgentReadModel(): AgentReadModel {
  return {
    viewport: { containerSize: useViewportSyncStore.getState().containerSize },
  };
}

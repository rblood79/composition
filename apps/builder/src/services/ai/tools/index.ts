/**
 * AI Tool Registry
 *
 * 모든 도구를 등록하고 레지스트리로 제공
 */

import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { getEditorStateTool } from "./getEditorState";
import { getSelectionTool } from "./getSelection";
import { createElementTool } from "./createElement";
import { updateElementTool } from "./updateElement";
import { deleteElementTool } from "./deleteElement";
import { searchElementsTool } from "./searchElements";
import { batchDesignTool } from "./batchDesign";
import { bindCollectionTool } from "./bindCollection";
import { createInteractionRuleTool } from "./createInteractionRule";

export { toolDefinitions, getToolDefinitions } from "./definitions";

/**
 * ADR-196 — `run_command` 는 지연 로딩. agent 명령 표면 (COMMAND_META + adapter + executor)
 * 은 실제 호출 시점에만 필요하므로 초기 번들에서 뺀다 (HC6).
 */
const runCommandLazyTool: ToolExecutor = {
  name: "run_command",
  execute: async (args): Promise<ToolExecutionResult> => {
    const { runCommandTool } = await import("./runCommand");
    return runCommandTool.execute(args);
  },
};

/**
 * 도구 레지스트리 생성
 */
export function createToolRegistry(): Map<string, ToolExecutor> {
  const registry = new Map<string, ToolExecutor>();

  const tools: ToolExecutor[] = [
    getEditorStateTool,
    getSelectionTool,
    createElementTool,
    updateElementTool,
    deleteElementTool,
    searchElementsTool,
    batchDesignTool,
    bindCollectionTool,
    createInteractionRuleTool,
    runCommandLazyTool,
  ];

  for (const tool of tools) {
    registry.set(tool.name, tool);
  }

  return registry;
}

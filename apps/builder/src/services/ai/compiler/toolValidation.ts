/** 기존 Agent tool과 compiler가 공유하는 mutation preflight. */
import { isFillDerivedStyleProp } from "../../../builder/panels/styles/utils/fillDerivedStyleProps";
import { elementToolContracts, type ElementToolName } from "./contracts";
import { validateProgram } from "./manifest";
import { readCompilerState } from "./builderHost";
import { getAiToolReadModel } from "../tools/canonicalToolReadModel";
import { resolveElementRef } from "../tools/elementRef";
import type { ToolTranslate } from "../../../types/integrations/ai.types";

export function validateCompilerToolCall(
  name: string,
  args: Record<string, unknown>,
  t: ToolTranslate,
): string | null {
  if (!Object.hasOwn(elementToolContracts, name)) return null;
  if (
    args.styles &&
    typeof args.styles === "object" &&
    Object.keys(args.styles).some(isFillDerivedStyleProp)
  )
    return "use-canonical-fills-for-background";
  const state = readCompilerState();
  let normalized = args;
  if (name === "update_element" || name === "delete_element") {
    const model = getAiToolReadModel();
    if (typeof args.elementId !== "string") return "elementId-required";
    const ref = resolveElementRef(
      args.elementId,
      {
        selectedElementId: model.state.selectedElementId,
        elementsById: model.elementsById,
      },
      t,
    );
    if ("error" in ref) return ref.error;
    normalized = { ...args, elementId: ref.id };
  }
  // 기존 creative run_command 배치는 원소별 기존 승인 표면을 유지한다.
  if (
    name === "run_command" &&
    Array.isArray(args.ids) &&
    (args.ids.length === 0 || Object.keys(args).some((key) => key !== "ids"))
  )
    return "invalid-command-batch";
  const commandArgs =
    name === "run_command" && Array.isArray(args.ids)
      ? args.ids.map((id) => ({ id }))
      : [normalized];
  for (const entry of commandArgs) {
    const parsed =
      elementToolContracts[name as ElementToolName].safeParse(entry);
    if (!parsed.success) return "invalid-tool-arguments";
    const result = validateProgram(
      {
        version: 1,
        source: "llm",
        operations: [{ op: name, args: parsed.data }],
      },
      state.manifest,
      state.context,
    );
    if (!result.ok) return result.error;
  }
  return null;
}

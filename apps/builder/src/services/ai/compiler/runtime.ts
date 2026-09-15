import type {
  ToolExecutionResult,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { createToolRegistry } from "../tools";
import { compileRequest } from "./compile";
import { validateProgram } from "./manifest";
import { readCompilerState } from "./builderHost";

export interface CompilerMetric {
  route: "direct" | "one-shot" | "creative-multistep" | "legacy" | "rejected";
  providerCalls: number;
  toolExecutions: number;
  errorCode?: string;
}
const metrics: CompilerMetric[] = [];
export const getCompilerMetrics = (): readonly CompilerMetric[] =>
  metrics.map((m) => ({ ...m }));
export const clearCompilerMetrics = (): void => {
  metrics.length = 0;
};

export async function runCompilerRequest(
  message: string,
  t: ToolTranslate,
  signal: AbortSignal,
): Promise<{
  handled: boolean;
  result?: ToolExecutionResult;
  route: CompilerMetric["route"];
}> {
  const metric: CompilerMetric = {
    route: "rejected",
    providerCalls: 0,
    toolExecutions: 0,
  };
  const record = () => {
    metrics.push({ ...metric });
    if (metrics.length > 30) metrics.shift();
  };
  const rejected = (error: string) => {
    metric.errorCode = error;
    record();
    return {
      handled: true,
      route: metric.route,
      result: { success: false, error },
    };
  };
  try {
    const state = readCompilerState();
    const compiled = compileRequest(message, state.manifest, state.context);
    if (compiled.route === "creative-multistep") {
      metric.route = compiled.route;
      record();
      return { handled: false, route: metric.route };
    }
    let raw: unknown;
    if (compiled.route === "direct") {
      metric.route = "direct";
      raw = compiled.program;
    } else {
      const { resolveProvider } = await import("../providers/agentProfiles");
      if (signal.aborted) return rejected("aborted");
      const provider = resolveProvider("main");
      if (!provider) return rejected("provider-not-configured");
      // G4: prompt-only JSON 유효율이 검증되지 않은 어댑터는 기존 Agent fallback 유지.
      if (provider.id !== "anthropic") {
        metric.route = "legacy";
        record();
        return { handled: false, route: metric.route };
      }
      metric.route = "one-shot";
      const { requestOneShotProgram } = await import("./oneShot");
      if (signal.aborted) return rejected("aborted");
      metric.providerCalls += 1;
      raw = await requestOneShotProgram(
        provider,
        message,
        state.manifest,
        state.context,
        signal,
      );
    }
    if (signal.aborted) return rejected("aborted");
    const current = readCompilerState();
    if (current.identity !== state.identity) return rejected("context-changed");
    const checked = validateProgram(raw, current.manifest, current.context);
    if (!checked.ok) return rejected(checked.error);
    const op = checked.program.operations[0];
    if (
      checked.program.source !==
      (metric.route === "direct" ? "compiler" : "llm")
    )
      return rejected("source-mismatch");
    // 모호한 요청의 모델 출력으로 삭제/명령 실행을 새로 추론하지 않는다.
    if (
      metric.route === "one-shot" &&
      (op.op === "delete_element" || op.op === "run_command")
    )
      return rejected("uncertain-action");
    // One-shot가 사용자 선택과 무관한 기존 요소를 대상으로 삼는 것을 차단한다.
    if (
      metric.route === "one-shot" &&
      (op.op === "update_element" || op.op === "delete_element") &&
      op.args.elementId !== state.context.selectedId
    )
      return rejected("unrequested-target");
    if (signal.aborted || readCompilerState().identity !== state.identity)
      return rejected("context-changed");
    const executor = createToolRegistry().get(op.op);
    if (!executor) return rejected("missing-executor");
    metric.toolExecutions += 1;
    const result = await executor.execute(op.args, t);
    if (!result.success) metric.errorCode = "execution-failed";
    record();
    return { handled: true, route: metric.route, result };
  } catch {
    return rejected(
      signal.aborted ? "aborted" : "invalid-or-unavailable-output",
    );
  }
}

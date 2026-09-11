/**
 * get_api_endpoint Tool — endpoint 정의 1개 (ADR-213 Phase 1, 읽기).
 *
 * 정의 전체를 돌려주되 **공유 redactor 를 지난 뒤** 다 — auth header · auth query ·
 * userinfo · 기존 평문 토큰은 `{{secret.KEY}}` placeholder 로 바뀐다 (HC5 · R8).
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { findEndpoint, getDataToolReadModel } from "../data/dataToolReadModel";
import { redactEndpointSecrets } from "../security/redactEndpointAuth";

export const getApiEndpointTool: ToolExecutor = {
  name: "get_api_endpoint",

  async execute(args, t): Promise<ToolExecutionResult> {
    const hasRef =
      (typeof args.endpointId === "string" && args.endpointId) ||
      (typeof args.name === "string" && args.name);
    if (!hasRef) {
      return { success: false, error: t("aiToolError.endpointRefRequired") };
    }

    try {
      const { apiEndpoints, lastErrors } = getDataToolReadModel();
      const endpoint = findEndpoint(apiEndpoints, args);
      if (!endpoint) {
        return {
          success: false,
          error: t("aiToolError.endpointNotFound", {
            ref: String(args.endpointId ?? args.name),
            names: apiEndpoints.map((e) => e.name).join(", "),
          }),
        };
      }
      const lastError = lastErrors.get(endpoint.id);
      return {
        success: true,
        data: {
          ...redactEndpointSecrets(endpoint),
          lastRun: lastError ? { ok: false, error: lastError.message } : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

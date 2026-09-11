/**
 * list_api_endpoints Tool — API endpoint 목록 (ADR-213 Phase 1, 읽기).
 *
 * url 은 baseUrl + path 를 합친 뒤 공유 redactor 를 지난다 (userinfo · auth query).
 * `lastRun` 은 현재 store 가 남기는 것 (마지막 실행 **오류**) 만 — 성공 기록은 Phase 3
 * 실행 스냅샷이 붙인다.
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { getDataToolReadModel } from "../data/dataToolReadModel";
import { redactUrl } from "../security/redactEndpointAuth";
import { readFormat } from "./listCollections";

export function joinEndpointUrl(baseUrl: string, path: string): string {
  if (!path) return baseUrl;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export const listApiEndpointsTool: ToolExecutor = {
  name: "list_api_endpoints",

  async execute(args): Promise<ToolExecutionResult> {
    try {
      const { apiEndpoints, lastErrors } = getDataToolReadModel();
      const detailed = readFormat(args) === "detailed";
      return {
        success: true,
        data: apiEndpoints.map((endpoint) => {
          const lastError = lastErrors.get(endpoint.id);
          return {
            id: endpoint.id,
            name: endpoint.name,
            method: endpoint.method,
            url: redactUrl(joinEndpointUrl(endpoint.baseUrl, endpoint.path)),
            targetCollectionId: endpoint.targetCollectionId ?? null,
            lastRun: lastError ? { ok: false, error: lastError.message } : null,
            ...(detailed
              ? {
                  ...(endpoint.description
                    ? { description: endpoint.description }
                    : {}),
                  executionMode: endpoint.executionMode,
                  headerKeys: endpoint.headers
                    .filter((h) => h.enabled)
                    .map((h) => h.key),
                  queryParamKeys: endpoint.queryParams.map((q) => q.key),
                }
              : {}),
          };
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

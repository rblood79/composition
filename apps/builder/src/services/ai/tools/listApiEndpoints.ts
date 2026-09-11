/**
 * list_api_endpoints Tool — API endpoint 목록 (ADR-213 Phase 1, 읽기).
 *
 * url 은 baseUrl + path 를 합친 뒤 공유 redactor 를 지난다 (userinfo · auth query).
 * `lastRun` 은 Phase 3 실행 스냅샷 요약 (`ok · status · at · runId · error`) — 자세한
 * 것은 `explain_request_failure` 가 redactor 를 지나 준다.
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import {
  getDataToolReadModel,
  summarizeLastRun,
} from "../data/dataToolReadModel";
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
      const model = getDataToolReadModel();
      const { apiEndpoints } = model;
      const detailed = readFormat(args) === "detailed";
      return {
        success: true,
        data: apiEndpoints.map((endpoint) => {
          return {
            id: endpoint.id,
            name: endpoint.name,
            method: endpoint.method,
            url: redactUrl(joinEndpointUrl(endpoint.baseUrl, endpoint.path)),
            targetCollectionId: endpoint.targetCollectionId ?? null,
            lastRun: summarizeLastRun(endpoint.id, model),
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

/**
 * explain_request_failure Tool — "왜 실패했지?" (ADR-213 Phase 3, AI-3, 읽기).
 *
 * 컨텍스트 조립은 **코드가** 한다: endpoint 정의 · 실제로 보낸 요청 (최종 URL · 헤더 · 본문)
 * · 응답 status/headers · 응답 본문 앞 2KB · 대상 테이블 스키마. 전부 공유 redactor
 * (`redactEndpointSecrets` · `redactUrl` · `redactHeaderRecord` · `redactBodyText`) 를 지난
 * 뒤에야 tool 결과로 나간다 — tool 결과는 다음 turn 의 provider payload 에 실리므로 이
 * 경계가 R8 (HC5) 의 집행점이다. 원문 스냅샷은 `useDataStore.apiRuns` 에만 있다.
 *
 * 모델은 결과의 `guidance` 대로 **원인 + 제안** 을 답한다. 제안이 정의 변경이면
 * `define_endpoint` patch (DataOp) 형태 — 적용은 Phase 4 `propose_data_change` 승인 경로
 * (그 전엔 제안 텍스트만, breakdown Phase 3). 이 tool 자체는 쓰기 0.
 *
 * 표면: ADR-212 Phase 4 응답 패널 오류 옆 버튼이 같은 tool 을 부른다. 그 전에는 AI 패널
 * 프롬프트 ("마지막 실행 왜 실패했어?") — 참조 없이 부르면 가장 최근 실패 실행을 고른다.
 */
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../types/builder/data.types";
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import {
  findCollection,
  findEndpoint,
  getDataToolReadModel,
} from "../data/dataToolReadModel";
import {
  redactBodyText,
  redactEndpointSecrets,
  redactHeaderRecord,
  redactUrl,
} from "../security/redactEndpointAuth";

/** 컨텍스트에 싣는 응답 본문 상한 (바이트) — breakdown "본문 앞 2KB". 스냅샷 상한과 별개로 다시 자른다. */
export const REQUEST_FAILURE_BODY_MAX_BYTES = 2_048;

const utf8 = new TextEncoder();

function clampBytes(
  text: string,
  maxBytes: number,
): {
  text: string;
  truncated: boolean;
} {
  if (utf8.encode(text).length <= maxBytes) return { text, truncated: false };
  let used = 0;
  let out = "";
  for (const ch of text) {
    const n = utf8.encode(ch).length;
    if (used + n > maxBytes) break;
    used += n;
    out += ch;
  }
  return { text: out, truncated: true };
}

export interface RequestFailureContext {
  endpoint: ReturnType<typeof redactEndpointSecrets<ApiEndpoint>>;
  run: {
    runId: string;
    startedAt: string;
    durationMs: number;
    ok: boolean;
    error: string | null;
  };
  request: {
    method: ApiRunRecord["request"]["method"];
    url: string;
    headers: Record<string, string>;
    bodyType: ApiRunRecord["request"]["bodyType"];
    body: string | null;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    bodyTruncated: boolean;
    bodyBytes: number;
  } | null;
  targetCollection: {
    id: string;
    name: string;
    fields: Array<{
      id: string | undefined;
      key: string;
      type: string;
      required: boolean;
    }>;
  } | null;
}

/** 순수 — 입력 무변경. 나가는 모든 문자열이 redactor 를 지난다. */
export function buildRequestFailureContext(
  endpoint: ApiEndpoint,
  run: ApiRunRecord,
  collections: readonly DataTable[],
): RequestFailureContext {
  const target = findCollection(collections, {
    collectionId: endpoint.targetCollectionId,
    name: endpoint.targetCollection,
  });

  let response: RequestFailureContext["response"] = null;
  if (run.response) {
    const clamped = clampBytes(
      run.response.bodyPreview,
      REQUEST_FAILURE_BODY_MAX_BYTES,
    );
    response = {
      status: run.response.status,
      statusText: run.response.statusText,
      headers: redactHeaderRecord(run.response.headers),
      body: redactBodyText(clamped.text),
      bodyTruncated: run.response.bodyTruncated || clamped.truncated,
      bodyBytes: run.response.bodyBytes,
    };
  }

  return {
    endpoint: redactEndpointSecrets(endpoint),
    run: {
      runId: run.runId,
      startedAt: run.startedAt,
      durationMs: run.durationMs,
      ok: run.ok,
      error: run.error === undefined ? null : redactBodyText(run.error),
    },
    request: {
      method: run.request.method,
      url: redactUrl(run.request.url),
      headers: redactHeaderRecord(run.request.headers),
      bodyType: run.request.bodyType,
      body:
        run.request.body === undefined
          ? null
          : redactBodyText(run.request.body),
    },
    response,
    targetCollection: target
      ? {
          id: target.id,
          name: target.name,
          fields: target.schema.map((field) => ({
            id: field.id,
            key: field.key,
            type: field.type,
            required: field.required === true,
          })),
        }
      : null,
  };
}

/** 참조 없이 불렀을 때 — 가장 최근 **실패** 실행, 없으면 가장 최근 실행. */
export function pickLatestRun(
  runs: ReadonlyMap<string, ApiRunRecord>,
): ApiRunRecord | null {
  let latestFailed: ApiRunRecord | null = null;
  let latest: ApiRunRecord | null = null;
  for (const run of runs.values()) {
    if (!latest || run.startedAt > latest.startedAt) latest = run;
    if (!run.ok && (!latestFailed || run.startedAt > latestFailed.startedAt)) {
      latestFailed = run;
    }
  }
  return latestFailed ?? latest;
}

function resolveTarget(
  args: Record<string, unknown>,
  t: ToolTranslate,
): { endpoint: ApiEndpoint; run: ApiRunRecord } | { error: string } {
  const { apiEndpoints, runs } = getDataToolReadModel();
  const hasRef =
    (typeof args.endpointId === "string" && args.endpointId) ||
    (typeof args.name === "string" && args.name);

  if (!hasRef) {
    const run = pickLatestRun(runs);
    if (!run) return { error: t("aiToolError.noRunAtAll") };
    const endpoint = findEndpoint(apiEndpoints, { endpointId: run.endpointId });
    if (!endpoint) return { error: t("aiToolError.noRunAtAll") };
    if (
      typeof args.runId === "string" &&
      args.runId &&
      args.runId !== run.runId
    ) {
      return {
        error: t("aiToolError.runNotFound", {
          runId: args.runId,
          latest: run.runId,
        }),
      };
    }
    return { endpoint, run };
  }

  const endpoint = findEndpoint(apiEndpoints, args);
  if (!endpoint) {
    return {
      error: t("aiToolError.endpointNotFound", {
        ref: String(args.endpointId ?? args.name),
        names: apiEndpoints.map((e) => e.name).join(", "),
      }),
    };
  }
  const run = runs.get(endpoint.id);
  if (!run) {
    return { error: t("aiToolError.noRunRecorded", { name: endpoint.name }) };
  }
  if (
    typeof args.runId === "string" &&
    args.runId &&
    args.runId !== run.runId
  ) {
    return {
      error: t("aiToolError.runNotFound", {
        runId: args.runId,
        latest: run.runId,
      }),
    };
  }
  return { endpoint, run };
}

export const explainRequestFailureTool: ToolExecutor = {
  name: "explain_request_failure",

  async execute(args, t): Promise<ToolExecutionResult> {
    try {
      const target = resolveTarget(args, t);
      if ("error" in target) return { success: false, error: target.error };
      const { collections } = getDataToolReadModel();
      const context = buildRequestFailureContext(
        target.endpoint,
        target.run,
        collections,
      );
      return {
        success: true,
        data: {
          ...context,
          guidance: t("aiPrompt.explainFailureGuidance"),
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

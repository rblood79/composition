/**
 * 데이터 읽기 tool 4 의 공통 read model — ADR-213 Phase 1.
 *
 * `useDataStore` (collections · apiEndpoints · 실행 오류) 와 요소 투영 (`getAiToolReadModel`,
 * usedBy 역참조) 을 한 번에 읽는다. 쓰기는 없다 — 쓰기는 `propose_data_change` 승인
 * 경로 하나뿐이다 (HC1).
 */
import { resolveCollectionByName } from "@composition/shared";
import { useDataStore } from "../../../builder/stores/data";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../types/builder/data.types";
import { getAiToolReadModel } from "../tools/canonicalToolReadModel";
import { resolveCollectionUsage } from "./collectionReadModel";

export interface DataToolReadModel {
  collections: DataTable[];
  apiEndpoints: ApiEndpoint[];
  usage: Map<string, number>;
  /** `executeApiEndpoint` 가 남긴 마지막 오류 (endpoint id → Error) — 스냅샷 이전 형식 (호환). */
  lastErrors: Map<string, Error>;
  /** endpoint id → 마지막 실행 스냅샷 (Phase 3, 원문 — 밖으로 낼 때는 redactor 를 지난다). */
  runs: Map<string, ApiRunRecord>;
}

/** list/get 이 싣는 마지막 실행 요약 — 스냅샷 우선, 없으면 종전 오류 Map. 원문 secret 없음. */
export function summarizeLastRun(
  endpointId: string,
  model: Pick<DataToolReadModel, "runs" | "lastErrors">,
):
  | {
      ok: boolean;
      status: number | null;
      at: string;
      runId: string;
      error?: string;
    }
  | { ok: false; error: string }
  | null {
  const run = model.runs.get(endpointId);
  if (run) {
    return {
      ok: run.ok,
      status: run.response?.status ?? null,
      at: run.startedAt,
      runId: run.runId,
      ...(run.error !== undefined ? { error: run.error } : {}),
    };
  }
  const lastError = model.lastErrors.get(endpointId);
  return lastError ? { ok: false, error: lastError.message } : null;
}

export function getDataToolReadModel(): DataToolReadModel {
  const { collections, apiEndpoints, errors, apiRuns } =
    useDataStore.getState();
  const tables = [...collections.values()];
  const { elements } = getAiToolReadModel();
  const lastErrors = new Map<string, Error>();
  for (const [key, error] of errors) {
    if (key.startsWith("executeApi_")) {
      lastErrors.set(key.slice("executeApi_".length), error);
    }
  }
  return {
    collections: tables,
    apiEndpoints: [...apiEndpoints.values()],
    usage: resolveCollectionUsage(elements, tables),
    lastErrors,
    runs: apiRuns,
  };
}

/** `collectionId` 우선 · `name` fallback (id 가 name 자리에 와도 잡는다 — 152 계약). */
export function findCollection(
  collections: readonly DataTable[],
  ref: { collectionId?: unknown; name?: unknown },
): DataTable | null {
  if (typeof ref.collectionId === "string" && ref.collectionId) {
    const byId = collections.find((c) => c.id === ref.collectionId);
    if (byId) return byId;
    return resolveCollectionByName(ref.collectionId, collections);
  }
  if (typeof ref.name === "string" && ref.name) {
    return resolveCollectionByName(ref.name, collections);
  }
  return null;
}

export function findEndpoint(
  endpoints: readonly ApiEndpoint[],
  ref: { endpointId?: unknown; name?: unknown },
): ApiEndpoint | null {
  const id = typeof ref.endpointId === "string" ? ref.endpointId : "";
  const name = typeof ref.name === "string" ? ref.name : "";
  if (id) {
    const byId = endpoints.find((e) => e.id === id);
    if (byId) return byId;
    const byName = endpoints.find((e) => e.name === id);
    if (byName) return byName;
  }
  if (name) {
    return (
      endpoints.find((e) => e.name === name) ??
      endpoints.find((e) => e.id === name) ??
      null
    );
  }
  return null;
}

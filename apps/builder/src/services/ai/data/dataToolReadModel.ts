/**
 * 데이터 읽기 tool 4 의 공통 read model — ADR-213 Phase 1.
 *
 * `useDataStore` (collections · apiEndpoints · 실행 오류) 와 요소 투영 (`getAiToolReadModel`,
 * usedBy 역참조) 을 한 번에 읽는다. 쓰기는 없다 — 쓰기는 `propose_data_change` 승인
 * 경로 하나뿐이다 (HC1).
 */
import { resolveCollectionByName } from "@composition/shared";
import { useDataStore } from "../../../builder/stores/data";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";
import { getAiToolReadModel } from "../tools/canonicalToolReadModel";
import { resolveCollectionUsage } from "./collectionReadModel";

export interface DataToolReadModel {
  collections: DataTable[];
  apiEndpoints: ApiEndpoint[];
  usage: Map<string, number>;
  /** `executeApiEndpoint` 가 남긴 마지막 오류 (endpoint id → Error). 성공 기록은 없다 (Phase 3). */
  lastErrors: Map<string, Error>;
}

export function getDataToolReadModel(): DataToolReadModel {
  const { collections, apiEndpoints, errors } = useDataStore.getState();
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

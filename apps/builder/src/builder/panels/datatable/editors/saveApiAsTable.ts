/**
 * "테이블로 저장" DataChange 빌더 — ADR-212 Phase 4 UX-2.
 *
 * API 응답을 collection 으로 저장하는 op 묶음을 만든다 (순수). 적용은 `applyDataChange` 가
 * ADR-213 cross-store coordinator 로 preflight → 1회 commit/History/inverse, 중간 실패 시
 * collection·endpoint·canonical 전부 rollback 한다. 신규(create)면 `create_collection`(source
 * api) + `set_source` + `define_endpoint`(targetCollectionId), 기존에 잇기(attach)면
 * `create_collection` 없이 나머지. endpoint 는 targetCollectionId·dataPath 를 채워 재정의한다.
 */
import type { DataOp } from "@composition/shared";
import type {
  ApiEndpoint,
  DataField,
} from "../../../../types/builder/data.types";
import { toEndpointDraft } from "../../../stores/utils/dataChange";

export interface SaveApiAsTableInput {
  projectId: string;
  collectionId: string;
  tableName: string;
  schema: { key: string; type: DataField["type"] }[];
  rows: Record<string, unknown>[];
  endpoint: ApiEndpoint;
  dataPath: string;
  mode: "create" | "attach";
}

export function buildSaveApiAsTableOps(input: SaveApiAsTableInput): DataOp[] {
  const {
    projectId,
    collectionId,
    tableName,
    schema,
    rows,
    endpoint,
    dataPath,
    mode,
  } = input;
  const ops: DataOp[] = [];
  if (mode === "create") {
    ops.push({
      op: "create_collection",
      id: collectionId,
      projectId,
      name: tableName,
      schema: schema.map((f) => ({ key: f.key, type: f.type })),
      rows,
      source: "api",
    });
  }
  ops.push({
    op: "set_source",
    collectionId,
    source: "api",
    endpointId: endpoint.id,
  });
  ops.push({
    op: "define_endpoint",
    endpoint: {
      ...toEndpointDraft(endpoint),
      dataPath,
      targetCollectionId: collectionId,
    },
  });
  return ops;
}

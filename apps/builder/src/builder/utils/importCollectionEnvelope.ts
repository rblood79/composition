import type { CompositionDocument, ProjectExportData } from "@composition/shared";
import { resolveCollectionByName } from "@composition/shared";
import type { ApiEndpointCreate, DataField, DataStoreActions, DataStoreState } from "../../types/builder/data.types";

type ImportStore = Pick<DataStoreActions, "createDataTable" | "updateCollection" | "setRuntimeData" | "createApiEndpoint" | "updateApiEndpoint"> & Pick<DataStoreState, "collections" | "apiEndpoints">;

/** 공통 JSON envelope의 데이터 소스를 기존 store/DB 액션으로 복원한다. */
export async function importCollectionEnvelope(projectId: string, data: ProjectExportData, store: ImportStore): Promise<CompositionDocument> {
  const ids = new Map<string, string>();
  for (const source of data.collections ?? []) {
    // store Map 은 id 키 (ADR-152 HC8) — envelope 은 이름이 정본이라 name resolve.
    const current = resolveCollectionByName(source.name, Array.from(store.collections.values())) ?? undefined;
    const config = {name: source.name, schema: (source.schema ?? []) as DataField[], mockData: source.mockData ?? [], useMockData: source.useMockData ?? true};
    const target = current ?? await store.createDataTable({...config, project_id: projectId});
    if (current) await store.updateCollection(current.id, config);
    ids.set(source.id, target.id);
    if (source.runtimeData) store.setRuntimeData(source.name, source.runtimeData);
  }
  for (const source of data.apiEndpoints ?? []) {
    const current = store.apiEndpoints.get(source.name);
    const config: ApiEndpointCreate = {
      name:source.name, project_id:projectId, baseUrl:source.baseUrl, path:source.path,
      method:(source.method ?? "GET") as ApiEndpointCreate["method"],
      headers:Array.isArray(source.headers) ? source.headers : Object.entries(source.headers ?? {}).map(([key,value])=>({key,value,enabled:true})),
      queryParams:source.queryParams?.map((param)=>({...param,type:"string",required:false})),
      bodyType:(source.bodyType ?? "none") as ApiEndpointCreate["bodyType"], bodyTemplate:source.bodyTemplate,
      responseMapping:source.responseMapping ?? {dataPath:""}, executionMode:source.executionMode ?? "client", timeout:source.timeout,
    };
    if (current) await store.updateApiEndpoint(current.id, config);
    else await store.createApiEndpoint(config);
  }
  // 이름 바인딩은 그대로다. 다른 프로젝트에서 가져온 기존 ID 바인딩만 새 DB ID로 연결한다.
  if (![...ids].some(([from,to])=>from!==to)) return data.document;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child])=> {
      if (key === "datatableId" && typeof child === "string" && ids.has(child)) return [key,ids.get(child)];
      if (key === "dataBinding" && child && typeof child === "object" && "source" in child && child.source === "dataTable") {
        const binding = child as { collectionId?: unknown; name?: unknown };
        const next = { ...binding };
        // v2 `collectionId` 와 구 형식 (name 자리의 id) 둘 다 새 DB id 로 연결한다.
        if (typeof binding.collectionId === "string" && ids.has(binding.collectionId)) next.collectionId = ids.get(binding.collectionId);
        if (typeof binding.name === "string" && ids.has(binding.name)) next.name = ids.get(binding.name);
        return [key, next];
      }
      return [key,visit(child)];
    }));
  };
  return visit(data.document) as CompositionDocument;
}

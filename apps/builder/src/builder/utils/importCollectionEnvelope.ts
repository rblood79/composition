import type {
  DataTableDefinition,
  ApiEndpointDefinition,
  VariableDef,
} from "@composition/shared";
interface ProjectDataParts {
  collections?: DataTableDefinition[];
  apiEndpoints?: ApiEndpointDefinition[];
  variables?: VariableDef[];
}
import { resolveCollectionByName } from "@composition/shared";
import type {
  ApiEndpointCreate,
  DataField,
  DataStoreActions,
  DataStoreState,
} from "../../types/builder/data.types";

type ImportStore = Pick<
  DataStoreActions,
  | "createDataTable"
  | "updateCollection"
  | "setRuntimeData"
  | "createApiEndpoint"
  | "updateApiEndpoint"
  | "applyDataChange"
> &
  Pick<DataStoreState, "collections" | "apiEndpoints" | "variables">;

/**
 * 파일의 collections · API endpoints · 변수 정의를 이 프로젝트 data store 에 넣는다 (이름이 같으면 갱신).
 * 돌려주는 map = 파일의 collection id → 이 프로젝트의 collection id (문서 참조 재연결용).
 */
export async function importDataParts(
  projectId: string,
  data: ProjectDataParts,
  store: ImportStore,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const source of data.collections ?? []) {
    // store Map 은 id 키 (ADR-152 HC8) — envelope 은 이름이 정본이라 name resolve.
    const current =
      resolveCollectionByName(
        source.name,
        Array.from(store.collections.values()),
      ) ?? undefined;
    const config = {
      name: source.name,
      schema: (source.schema ?? []) as DataField[],
      mockData: source.mockData ?? [],
      useMockData: source.useMockData ?? true,
    };
    const target =
      current ??
      (await store.createDataTable({ ...config, project_id: projectId }));
    if (current) await store.updateCollection(current.id, config);
    ids.set(source.id, target.id);
    if (source.runtimeData)
      store.setRuntimeData(source.name, source.runtimeData);
  }
  for (const source of data.apiEndpoints ?? []) {
    const current = store.apiEndpoints.get(source.name);
    const config: ApiEndpointCreate = {
      name: source.name,
      project_id: projectId,
      baseUrl: source.baseUrl,
      path: source.path,
      method: (source.method ?? "GET") as ApiEndpointCreate["method"],
      headers: Array.isArray(source.headers)
        ? source.headers
        : Object.entries(source.headers ?? {}).map(([key, value]) => ({
            key,
            value,
            enabled: true,
          })),
      queryParams: source.queryParams?.map((param) => ({
        ...param,
        type: "string",
        required: false,
      })),
      bodyType: (source.bodyType ?? "none") as ApiEndpointCreate["bodyType"],
      bodyTemplate: source.bodyTemplate,
      responseMapping: source.responseMapping ?? { dataPath: "" },
      executionMode: source.executionMode ?? "client",
      timeout: source.timeout,
    };
    if (current) await store.updateApiEndpoint(current.id, config);
    else await store.createApiEndpoint(config);
  }
  // ADR-214 — 프로젝트 변수 정의 복원: 같은 이름이 있으면 그 변수를 갱신, 없으면 envelope 의 id 로
  //   생성 (문서 안 `setState.variableId` 참조가 그대로 살아야 한다). 한 DataChange (History 1).
  const variableOps = (data.variables ?? []).map((def) => {
    const current = store.variables.get(def.name);
    return {
      op: "define_variable" as const,
      variableId: current?.id ?? def.id,
      definition: {
        name: def.name,
        type: def.type,
        ...(def.defaultValue !== undefined
          ? { defaultValue: def.defaultValue }
          : {}),
        persist: def.persist ?? false,
      },
    };
  });
  if (variableOps.length > 0) {
    await store.applyDataChange(
      { ops: variableOps, origin: "user", label: "import variables" },
      { projectId },
    );
  }
  return ids;
}

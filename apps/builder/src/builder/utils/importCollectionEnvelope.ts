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
 * 돌려주는 map = 문서 참조의 파일 쪽 id → 이 프로젝트 쪽 id (`data:collection:` · `data:endpoint:` ·
 * `data:variable:` — 같은 것은 빠진다). 문서의 바인딩 · `callEndpoint` · `setState` 가 가져온 뒤에도
 * 같은 대상을 가리키게 한다 (ADR-281 — endpoint 는 새 id 로 생기고, 같은 이름의 변수는 이 프로젝트의 id).
 */
export async function importDataParts(
  projectId: string,
  data: ProjectDataParts,
  store: ImportStore,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const link = (kind: string, from: string, to: string) => {
    if (from !== to) ids.set(`data:${kind}:${from}`, `data:${kind}:${to}`);
  };
  const importedCollections = new Map<string, { id: string; name: string }>();
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
    // ADR-218 — the file carries the execution policy (`toExportCollection`) for this restore.
    // (`updateCollection`'s diff does not cover it — the policy is its own op, as the editor's.)
    if (source.executionPolicy)
      await store.applyDataChange(
        {
          ops: [
            {
              op: "set_execution_policy",
              collectionId: target.id,
              policy: source.executionPolicy,
            },
          ],
          origin: "user",
          label: "import execution policy",
        },
        { projectId },
      );
    importedCollections.set(source.name, target);
    link("collection", source.id, target.id);
    if (source.runtimeData)
      store.setRuntimeData(source.name, source.runtimeData);
  }
  // The collection a query endpoint fills: the file names it (`targetCollection`) — it is re-pointed
  // at the collection this import put in the store, or an existing one of that name.
  const targetOf = (source: ApiEndpointDefinition) => {
    const name = source.targetCollection;
    if (!name) return {};
    const target =
      importedCollections.get(name) ??
      resolveCollectionByName(name, Array.from(store.collections.values()));
    return target
      ? { targetCollectionId: target.id, targetCollection: target.name }
      : { targetCollection: name };
  };
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
      ...targetOf(source),
      executionMode: source.executionMode ?? "client",
      timeout: source.timeout,
    };
    if (current) await store.updateApiEndpoint(current.id, config);
    const target = current ?? (await store.createApiEndpoint(config));
    link("endpoint", source.id, target.id);
  }
  // ADR-214 — 프로젝트 변수 정의 복원: 같은 이름이 있으면 그 변수를 갱신, 없으면 envelope 의 id 로
  //   생성 (문서 안 `setState.variableId` 참조가 그대로 살아야 한다). 한 DataChange (History 1).
  const variableOps = (data.variables ?? []).map((def) => {
    const current = store.variables.get(def.name);
    if (current) link("variable", def.id, current.id);
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

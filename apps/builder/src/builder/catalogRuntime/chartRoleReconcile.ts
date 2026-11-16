/**
 * ADR-312 Decision 10 · breakdown §5.2 — 원천이 바뀔 때 Chart 의 역할을 맞춘다.
 *
 * 연결 · 다른 컬렉션이나 보기로 변경 · 해제 (`catalogBindingCommand`) 가 같은 step 에서 이 명령을 돌린다 (Undo 한 번).
 * 「원천의 열」 은 Chart 가 실제로 읽는 행의 열이다 — 연결이면 보기 사슬의 **결과 schema** (묶기 · 집계가 있으면 묶음
 * 열과 집계 이름 — F14), 아니면 표본 행의 열. 행을 읽는 경로 (`catalogBoundRows` — HC7) 는 건드리지 않는다: 순수한
 * schema 계산이다. 맞추는 규칙은 rendering 의 `reconcileChartRoles` 하나다.
 */
import {
  chartColumnsOfRows,
  chartFamilyOf,
  createChartInitialProps,
  getChartFamily,
  reconcileChartRoles,
  standardizeChartSample,
  type ChartRow,
  type ChartSourceColumn,
  type ChartType,
} from "@composition/rendering";
import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  CatalogReader,
  DataBindingRef,
  NodeEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingViews } from "../../../../../packages/shared/src/catalog/runtime/viewQuery";
import {
  viewResultSchema,
  type ViewRunField,
} from "../../../../../packages/shared/src/collections/view/evaluate";

const columnType = (type: unknown): ChartSourceColumn["type"] =>
  type === "number" || type === "integer" || type === "currency"
    ? "number"
    : type === "date" || type === "datetime" || type === "timestamp"
      ? "date"
      : "string";

/**
 * 연결의 원천 열 — 컬렉션 schema 를 보기 사슬로 접은 결과 schema. 컬렉션 schema 의 필드는 id (`#id` 로 저장 —
 * 필드 색인에 등록된다), 결과에만 있는 집계 열은 id 없이 key 로 (Phase 0 — 결과 열은 색인에 없다).
 */
export function chartBindingColumns(
  reader: Pick<CatalogReader, "getEntry">,
  binding: DataBindingRef,
): ChartSourceColumn[] | undefined {
  const collection = reader.getEntry(binding.collectionId as never);
  if (collection?.kind !== "collection") return undefined;
  const schema: ViewRunField[] = collection.schema
    .filter((field) => typeof field.key === "string" && field.key !== "")
    .map((field) => ({
      id: field.id ?? field.key,
      key: field.key,
      type: field.type,
    }));
  const ids = new Set(
    collection.schema.flatMap((field) => (field.id ? [field.id] : [])),
  );
  let result: readonly ViewRunField[] = schema;
  for (const query of catalogBindingViews(reader, binding) ?? [])
    result = viewResultSchema(query, result);
  return result.map((field) => ({
    key: field.key,
    ...(ids.has(field.id) ? { id: field.id } : {}),
    type: columnType(field.type),
  }));
}

/** 이 Chart 노드의 원천이 `binding` 으로 바뀔 때 역할 patch 명령 (바꿀 것이 없으면 undefined). */
export function chartBindingRolesCommand(
  reader: CatalogReader,
  nodeId: string,
  binding: DataBindingRef | undefined,
): CatalogCommand | undefined {
  const entry = reader.getEntry(nodeId as never) as NodeEntry | undefined;
  if (entry?.kind !== "node") return undefined;
  const own: Record<string, unknown> = {};
  for (const [key, write] of Object.entries(entry.props))
    if (write.kind === "set") own[key] = write.value;
  const chartType = (own.chartType ?? "bar") as ChartType;
  let columns: ChartSourceColumn[] | undefined;
  let sample: Record<string, unknown> | undefined;
  if (binding) columns = chartBindingColumns(reader, binding);
  else {
    // 해제 — 표본으로 돌아간다 (표본 행은 연결 중에도 보존돼 있다). 그 종류의 표본 지정은 family 가 로드돼 있을 때만
    //   (아니면 형이 맞는 표본 열로 — 보장은 「표본으로 다시 그려진다」 까지).
    const rows = (
      Array.isArray(own.data) ? own.data : createChartInitialProps().data
    ) as ChartRow[];
    columns = chartColumnsOfRows(rows);
    const familyId = chartFamilyOf(chartType);
    const family = familyId ? getChartFamily(familyId) : undefined;
    sample = family
      ? (standardizeChartSample(
          chartType,
          family.sample(chartType as never),
          family.sampleProps(chartType as never),
        ).props as Record<string, unknown>)
      : {};
  }
  if (!columns) return undefined;
  // 역할의 실제 값 = 자기 값, 없으면 Chart 원본 template 의 값 (`dimension` · `metric` · `color` — 직접 생성의 기존
  //   기본값과 같다). 원본 값이 원천에 없는 열을 가리키면 그것도 맞출 대상이다.
  const legacy = createChartInitialProps();
  const inherited = {
    dimension: legacy.dimension,
    metric: legacy.metric,
    color: legacy.color,
  };
  const patch = reconcileChartRoles({
    props: { ...inherited, ...own, chartType } as never,
    columns,
    ...(sample ? { sample } : {}),
  });
  const props: Record<
    string,
    { kind: "set"; value: never } | { kind: "remove" }
  > = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      if (key in own) props[key] = { kind: "remove" };
      // Chart 원본 template 이 `dimension: "category"` · `metric: "value"` · `color: "series"` 를 든다 — 연결한
      //   원천에 그 열이 없으면 지울 자기 값이 없으니 빈 글자 (해제) 를 쓴다. 해제하면 같은 함수가 이 빈 글자를 지워
      //   표본의 지정이 돌아온다. **Why (Phase 5 live)**: `color` 만 그렇게 해, sparkline 의 선택 `dimension` 이
      //   없는 열 `category` 를 가리킨 채 남아 모든 행이 한 항목으로 합쳐졌다 (Sales 연결 — 810 하나).
      else if (binding && key in inherited)
        props[key] = { kind: "set", value: "" as never };
    } else props[key] = { kind: "set", value: value as never };
  }
  if (Object.keys(props).length === 0) return undefined;
  return setFields({
    targets: [{ kind: "node", id: nodeId as never }],
    props: props as never,
    label: binding ? "Bind data" : "Unbind data",
  });
}

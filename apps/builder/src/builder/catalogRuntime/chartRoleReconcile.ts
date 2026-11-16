/**
 * ADR-312 Decision 10 · breakdown §5.2 — 원천이 바뀔 때 Chart 의 역할을 맞춘다.
 *
 * 연결 · 다른 컬렉션이나 보기로 변경 · 해제 (`catalogBindingCommand`) 가 같은 step 에서 이 명령을 돌린다 (Undo 한 번).
 * 「원천의 열」 은 Chart 가 실제로 읽는 행의 열이다 — 연결이면 보기 사슬의 **결과 schema** (묶기 · 집계가 있으면 묶음
 * 열과 집계 이름 — F14), 아니면 표본 행의 열. 행을 읽는 경로 (`catalogBoundRows` — HC7) 는 건드리지 않는다: 순수한
 * schema 계산이다. 맞추는 규칙은 rendering 의 `reconcileChartRoles` 하나다.
 */
import {
  chartColumnTypeOfField,
  chartColumnsOfRows,
  chartFamilyOf,
  createChartInitialProps,
  getChartFamily,
  reconcileChartRoles,
  standardizeChartSampleProps,
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
    // 숫자 · 날짜 밖 (boolean · 목록 …) 은 글자 열로 고른다 (범주 · 계열 역할이 받는다).
    type: chartColumnTypeOfField(field.type) ?? "string",
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
      ? (standardizeChartSampleProps(
          chartType,
          family.sampleProps(chartType as never),
        ) as Record<string, unknown>)
      : {};
  }
  if (!columns) return undefined;
  // 역할의 값 = 자기 값. Chart 원본 template 은 역할 값을 들지 않는다 (`createChartInitialProps` — 값이 없는
  //   역할은 기본 열 이름으로 읽힌다). 원천에 없는 열을 가리키는 선택 역할은 그리는 쪽이 해제로 읽는다
  //   (`resolveChartRoleDefaults`).
  const patch = reconcileChartRoles({
    props: { ...own, chartType } as never,
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
    } else props[key] = { kind: "set", value: value as never };
  }
  if (Object.keys(props).length === 0) return undefined;
  return setFields({
    targets: [{ kind: "node", id: nodeId as never }],
    props: props as never,
    label: binding ? "Bind data" : "Unbind data",
  });
}

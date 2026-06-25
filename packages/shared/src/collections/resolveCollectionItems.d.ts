/**
 * collection items 단일 계약 (ADR-912 영역 B 연장) — DOM wrapper / Skia projector 공통 source.
 *
 * **배경**: collection items 의 source(static props.items / dataBinding / collections / fallback)가
 * DOM(wrapper 별 `useCollectionData` + ad-hoc 정적 items 분기)과 Skia(`getFlatProjectionRows`)에서
 * 분산 처리되어, 같은 데이터가 두 경로에서 다르게 흐른다(TagGroup `9e84c2707` items 누락 버그의 근원).
 *
 * **본 모듈**: 기존 builder `collectionRowProjectionModel.ts`(import 0 순수 함수)를 `packages/shared`
 * 로 hoist 하여, DOM wrapper(shared)와 Skia projector(builder)가 **동일 row normalizer** 를 소비한다.
 * builder 의 기존 2 경로(`components/collection/` + `components/listbox/`)는 본 모듈을 재export 하는
 * thin alias 로 유지(BC 0, ADR-912 C1 hoist 선례).
 *
 * **계약 분리 (설계 §2-D)**:
 * - `resolveCollectionItems(input)` — **동기 순수 함수**. raw source → `CollectionProjectionRow[]` 정규화
 *   + `sourceKind` 판정. Skia projector 는 canonical props + collections snapshot 을 넘겨 직접 호출.
 * - DOM wrapper 는 직접 호출 금지(shared/service 경계). `useResolvedCollectionItems` hook adapter
 *   (별도 파일, Task 2-A)가 `useCollectionData` 로 async/dataTable 을 해소한 뒤 본 함수로 통과.
 *
 * **RAC 정합**: RAC 가 "collection data source" ↔ "item render adapter" 를 분리하듯, 본 계약은
 * source 통합만 담당하고 render adapt(JSX children / items+render fn / `<Collection>`)는 wrapper.
 *
 * **family 무관 = generic**: readDataBindingRows(collections/dataBinding 3경로) +
 *   readStringField(고정 필드 휴리스틱) + getItem*(Key/Label/Description/Icon/Value/Disabled).
 * **family 차이 = getRows 구현**: ListBox=flat row / GridList=section flatten(kind 분기) /
 *   Table=cell 차원(2D 직교). 차이는 caller 의 getRows 가 흡수, 본 모듈은 공통 primitive 만.
 */
export declare const COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100;
/**
 * collection data source (collections store entry). dataTable/static/collection 바인딩의
 * row 데이터 출처. ListBox/GridList/Table 공통.
 */
export type CollectionDataSource = {
    id?: string;
    mockData?: Record<string, unknown>[];
    name?: string;
    runtimeData?: Record<string, unknown>[];
    useMockData?: boolean;
};
/**
 * collection projected row (ListBoxProjectionRow 일반화).
 *
 * `kind` discriminator: `item`=데이터 행/카드 / `section`=GridList section header(props.items mode 한정).
 * `header`=section 제목(kind:'section' 일 때). 나머지 필드는 item 의 fixed-field 추출값.
 */
export type CollectionProjectionRow = {
    /** ADR-912 C1: GridList section flatten 용. ListBox 는 항상 'item'. */
    kind: "item" | "section";
    /** section header 텍스트 (kind:'section' 일 때만). */
    header?: string;
    description: string | null;
    /** ADR-147: icon slot — lucide icon name (data row field) 또는 null. */
    icon: string | null;
    isDisabled: boolean;
    item: unknown;
    itemKey: string;
    label: string;
    rowIndex: number;
    value: string | null;
};
export type CollectionProjectionRowsInput = {
    collections?: readonly CollectionDataSource[];
    dataBinding?: unknown;
    props?: Record<string, unknown>;
};
/**
 * collection source 의 정규화 결과 — DOM wrapper / Skia projector 공통 소비 (설계 §2-C).
 *
 * `sourceKind` 는 render adapter 가 분기 없이 동일 처리하되, 디버깅/write 라우팅 보조용.
 * write target 변환은 본 계약에 포함하지 않고 `resolveCollectionWriteTarget(projection, intent)`
 * 단일 책임에 위임한다(중복 source of truth 방지).
 */
export interface ResolvedCollectionItems {
    /** 정규화된 item 행 (kind:'item'|'section'). */
    rows: CollectionProjectionRow[];
    /** source 판정 — 어느 경로에서 rows 가 나왔는지. */
    sourceKind: "static-items" | "dataBinding" | "collection" | "fallback" | "empty";
}
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function readArray(value: unknown): unknown[];
export declare function isProjectionRowsInput(value: Record<string, unknown> | CollectionProjectionRowsInput | undefined): value is CollectionProjectionRowsInput;
/**
 * dataBinding → row 배열. dataTable/static/collection 3경로 (ListBox/GridList/Table 공통).
 * collections store 에서 mockData/runtimeData 선택.
 */
export declare function readDataBindingRows(dataBinding: unknown, collections?: readonly CollectionDataSource[]): unknown[];
/** 고정 필드 우선순위로 string 값 추출 (number 는 String 변환). */
export declare function readStringField(item: Record<string, unknown>, keys: readonly string[]): string | null;
export declare function getItemKey(item: unknown, index: number): string;
export declare function getItemLabel(item: unknown, itemKey: string, index: number): string;
export declare function getItemDescription(item: unknown): string | null;
/**
 * ADR-147: icon slot 값 — data row field 에서 lucide icon name 추출.
 * label/description 와 동일한 fixed-field 휴리스틱.
 */
export declare function getItemIcon(item: unknown): string | null;
export declare function getItemValue(item: unknown): string | null;
export declare function getItemDisabled(item: unknown): boolean;
/**
 * data row 1개 → CollectionProjectionRow(kind:'item'). ListBox/GridList item 공통 변환.
 * section 분기는 caller(getGridListProjectionRows)가 kind:'section' 으로 별도 emit.
 */
export declare function toItemProjectionRow(item: unknown, rowIndex: number): CollectionProjectionRow;
/**
 * collections/dataBinding/props.items → flat item row 배열 (kind:'item' 만, section 없음).
 * ListBox getRows 정본. GridList 는 본 함수 대신 getGridListProjectionRows(section 분기) 사용.
 */
export declare function getFlatProjectionRows(input: Record<string, unknown> | CollectionProjectionRowsInput | undefined, windowLimit?: number): CollectionProjectionRow[];
/**
 * 단일 계약 진입점 (설계 §2-C) — flat rows + sourceKind 판정.
 *
 * `getFlatProjectionRows` 가 rows 를 산출하고, 본 함수는 어느 source 에서 나왔는지를 추가 판정한다.
 * 판정 우선순위는 `getFlatProjectionRows` 의 source 선택과 동일(dataBinding 우선 → props.items).
 * `dataBinding` 의 dataTable/collection 세부 구분은 `sourceKind` 로 노출(write 라우팅 보조).
 *
 * **순수 함수**: DOM wrapper 직접 호출 금지(§2-D). Skia projector + `useResolvedCollectionItems`
 * hook adapter 만 호출한다.
 */
export declare function resolveCollectionItems(input: Record<string, unknown> | CollectionProjectionRowsInput | undefined, windowLimit?: number): ResolvedCollectionItems;
/** Table column 정의 (Table.spec TableColumn 동형 — id/label/width). */
export type TableColumnDef = {
    id: string;
    label: string;
    width: number;
};
/**
 * Table projected row(2D). flat row 와 달리 `cells`(columnId→string 값) + `isHeader` 차원을 가진다.
 *
 * `kind:'header'`=컬럼 헤더 행(데이터 무관, label 사용) / `kind:'data'`=데이터 행(cells 사용).
 * `rowIndex` 는 data 행 인덱스(header 는 -1) — striped(짝수/홀수) + selected 시각의 SSOT.
 */
export type TableProjectionRow = {
    kind: "header" | "data";
    /** columnId → 셀 텍스트. header 행은 빈 객체(컬럼 label 은 column.label 에서). */
    cells: Record<string, string>;
    isSelected: boolean;
    rowIndex: number;
    rowKey: string;
};
/** props.columns(TableColumn[]) → TableColumnDef[]. 없으면 빈 배열 (reference 정합 — 샘플 미주입). */
export declare function readTableColumns(props: Record<string, unknown> | undefined): TableColumnDef[];
/**
 * collections/dataBinding/props.rows → TableProjectionRow[](header 1행 + data N행).
 *
 * data source: readDataBindingRows(flat 와 동일) → cells 차원 부착. props.columns 가 컬럼 차원.
 * window: data 행만 windowLimit 적용(header 행은 항상 1개 포함, limit 무관).
 */
export declare function getTableProjectionRows(input: Record<string, unknown> | CollectionProjectionRowsInput | undefined, windowLimit?: number): {
    columns: TableColumnDef[];
    rows: TableProjectionRow[];
};
//# sourceMappingURL=resolveCollectionItems.d.ts.map
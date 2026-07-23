/**
 * ADR-159 P4a — slot Text 필드 피커의 컬럼 목록 소스.
 *
 * 편집 중인 Text(slot 자식/템플릿 자식)의 조상에서 collection 소유자(데이터 바인딩
 * 또는 정적 items 보유)를 찾아, 그 데이터의 필드 키 목록을 돌려준다. 소유자가 없으면
 * null — 피커 미노출(일반 입력 유지). 컬럼 출처 우선순위:
 *
 * 1. `props.dataBinding` — property binding(`{source:"dataTable", name}`) → collections
 *    store 의 해당 테이블 schema 키 (없으면 mockData[0] 키) — `readTableColumns` 계보
 * 2. `props.dataBinding` — legacy collection binding(`{type:"collection", source:"static"}`)
 *    → `config.data[0]` 키
 * 3. `props.items` — 정적 items 행의 첫 record 키
 */
import { useMemo } from "react";

import type { DataTable } from "../../../../types/builder/data.types";
import { useCollections } from "../../../stores/data";
import { useCanonicalPropertyElementsMap } from "./useCanonicalPropertyRead";
import type { PanelNode } from "../../panelNode";

const MAX_ANCESTOR_DEPTH = 20;

/**
 * ADR-159 P4a: `{field}` 템플릿 대상 텍스트 prop 키 — 이 키의 string 필드는 소유
 * collection 컬럼이 있으면 필드 피커 입력(PropertyFieldTemplateInput)으로 렌더한다.
 * CatalogInspectorFields(레거시 Inspector)와 GenericFieldRenderer(Properties view) 공유.
 */
export const TEMPLATE_TEXT_KEYS: ReadonlySet<string> = new Set([
  "children",
  "text",
  "description",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordKeys(value: unknown): string[] | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys : null;
}

function columnsFromCollection(table: DataTable | undefined): string[] | null {
  if (!table) return null;
  const schemaKeys = (table.schema ?? [])
    .map((field) => field.key)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
  if (schemaKeys.length > 0) return schemaKeys;
  return recordKeys(table.mockData?.[0]);
}

function columnsFromOwner(
  owner: PanelNode,
  collectionsByName: ReadonlyMap<string, DataTable>,
): string[] | null {
  const binding = owner.props?.dataBinding;
  if (isRecord(binding)) {
    // property binding — dataTable 단일 소스 (ADR-159 P4b)
    if (binding.source === "dataTable" && typeof binding.name === "string") {
      const fromTable = columnsFromCollection(
        collectionsByName.get(binding.name),
      );
      if (fromTable) return fromTable;
    }
    // legacy collection binding — static data
    if (binding.type === "collection" && isRecord(binding.config)) {
      const data = binding.config.data;
      if (Array.isArray(data)) {
        const fromStatic = recordKeys(data[0]);
        if (fromStatic) return fromStatic;
      }
    }
  }
  const items = owner.props?.items;
  if (Array.isArray(items) && items.length > 0) {
    return recordKeys(items[0]);
  }
  return null;
}

/**
 * master(reusable origin) 편집 컨텍스트 역추적 — Components 페이지의 slot Text 는
 * 조상에 collection 소유자가 없다. 이 master 를 소비하는 인스턴스를 문서에서 찾아
 * 그 소유자의 컬럼을 쓴다 (첫 매치 승):
 *
 * 1. direct: `ref === masterRootId` 인 소비자(예: ListBox template anchor) → 그 조상 소유자
 * 2. container-slot: `slot[]` 에 masterRootId 를 가진 컨테이너 master(예: component-gridlist)
 *    → 그 컨테이너를 `ref` 하는 인스턴스 자신(또는 조상)의 items/binding
 */
function columnsFromMasterConsumers(
  elementsMap: ReadonlyMap<string, PanelNode>,
  masterRootId: string,
  collectionsByName: ReadonlyMap<string, DataTable>,
): string[] | null {
  const ownerColumnsFromChain = (startId: string): string[] | null => {
    let current = elementsMap.get(startId);
    for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      const columns = columnsFromOwner(current, collectionsByName);
      if (columns) return columns;
      const parentId = current.parent_id;
      current = parentId ? elementsMap.get(parentId) : undefined;
    }
    return null;
  };

  const containerIds: string[] = [];
  for (const nodeEntry of elementsMap.values()) {
    if (nodeEntry.ref === masterRootId) {
      // direct 소비자 (anchor/인스턴스) — 자신 포함 조상 체인에서 소유자 탐색.
      const columns = ownerColumnsFromChain(nodeEntry.id);
      if (columns) return columns;
    }
    if (
      Array.isArray(nodeEntry.slot) &&
      nodeEntry.slot.includes(masterRootId)
    ) {
      containerIds.push(nodeEntry.id);
    }
  }
  for (const containerId of containerIds) {
    for (const nodeEntry of elementsMap.values()) {
      if (nodeEntry.ref !== containerId) continue;
      const columns = ownerColumnsFromChain(nodeEntry.id);
      if (columns) return columns;
    }
  }
  return null;
}

/** 순수 판정 — vitest 대상. elementId 의 조상 체인에서 첫 collection 소유자의 컬럼. */
export function resolveOwnerCollectionColumns(
  elementsMap: ReadonlyMap<string, PanelNode>,
  elementId: string | undefined,
  collectionsByName: ReadonlyMap<string, DataTable>,
): string[] | null {
  if (!elementId) return null;
  let current = elementsMap.get(elementId);
  // 걷는 중 만난 reusable master (가까운 순) — 라이브 문서에서 master 는 Components
  // 페이지 body 안에 중첩되므로 체인 "최상단" 단독 판정은 body 에서 끝나 실패한다.
  const reusableAncestorIds: string[] = [];
  for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    if (depth > 0) {
      // 자기 자신(Text)은 소유자 아님 — 조상부터 판정.
      const columns = columnsFromOwner(current, collectionsByName);
      if (columns) return columns;
    }
    if (current.reusable) reusableAncestorIds.push(current.id);
    const parentId = current.parent_id;
    current = parentId ? elementsMap.get(parentId) : undefined;
  }
  // 조상에 소유자 없음 → reusable master 조상(가까운 순)의 소비자 인스턴스 역추적.
  for (const masterId of reusableAncestorIds) {
    const columns = columnsFromMasterConsumers(
      elementsMap,
      masterId,
      collectionsByName,
    );
    if (columns) return columns;
  }
  return null;
}

export function useOwnerCollectionColumns(
  elementId: string | undefined,
): string[] | null {
  const elementsMap = useCanonicalPropertyElementsMap();
  const collections = useCollections();

  return useMemo(() => {
    const byName = new Map(collections.map((table) => [table.name, table]));
    return resolveOwnerCollectionColumns(elementsMap, elementId, byName);
  }, [elementsMap, elementId, collections]);
}

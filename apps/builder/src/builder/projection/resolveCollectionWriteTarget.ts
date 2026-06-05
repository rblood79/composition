/**
 * Collection projected cell/row 편집 → canonical write target 3-route 변환 (ADR-912 단계 4).
 *
 * projected render id 는 비영속(canonical / IndexedDB / history 저장 금지, canonical-rendering.md §9)
 * 이므로, projected 노드에서 발생한 편집은 **canonical document 의 어느 노드/데이터로 써야 하는지**
 * 를 결정해야 한다. 본 함수는 projection metadata(`CanvasProjectionMetadata`)와 편집 의도(intent)
 * 를 받아 3-route 중 하나의 **canonical-only** target 을 산출한다.
 *
 * **3-route** (ADR-135 D5 재사용):
 *   - `template` : style/시각 편집 → origin master 노드(`templateOriginId`). 모든 행에 반영.
 *   - `data`     : content 편집 → collection 데이터(`listBoxId` + `itemKey`). 구조 불변.
 *   - `override` : per-row 시각/값 편집 → `RefNode.descendants[itemKey]`. 해당 행만.
 *
 * **boundary 계약 (G-boundary)**: 반환 target 의 모든 id 필드는 canonical id 다.
 * `projection:` prefix id 는 입력으로만 들어오고 출력에는 절대 없다(`isRenderProjectionId`
 * 로 출력 self-check). 이로써 `assertCanonicalMoveTarget`/canonical mutation 차단과 정합.
 */

import {
  isRenderProjectionId,
  isCollectionRowProjectionKind,
  isCollectionCellProjectionKind,
} from "./renderProjectionIds";
import type { CanvasProjectionMetadata } from "../workspace/canvas/scene/canvasSceneNode";

/** 편집 의도 — 어느 패널/view 에서의 편집인지로 caller 가 결정. */
export type CollectionWriteIntent =
  | { kind: "style" } // 시각 편집(Style view) → template route
  | { kind: "content" } // 데이터 편집(Properties content) → data route
  | { kind: "override" }; // per-row 편집 → override route

/** template route — origin master 노드 직접 write (모든 행 반영). */
export interface CollectionTemplateWriteTarget {
  route: "template";
  /** origin(template ref master) canonical node id. */
  originNodeId: string;
}

/** data route — collection 데이터 write (구조 불변, content 변경). */
export interface CollectionDataWriteTarget {
  route: "data";
  /** 데이터 소유 collection 노드 canonical id. */
  collectionNodeId: string;
  /** 편집 대상 행 key. */
  itemKey: string;
  /**
   * 2D collection(Table) 셀 편집 시 대상 컬럼 id. row 1단 family(listbox/gridlist)는 undefined.
   * 있으면 `row.cells[columnId]` 단위 write, 없으면 행 전체(label 등) write.
   */
  columnId?: string;
}

/** override route — per-row 시각/값 override (RefNode.descendants). */
export interface CollectionOverrideWriteTarget {
  route: "override";
  /** descendants 를 소유하는 RefNode canonical id (= collection 노드). */
  refNodeId: string;
  /** descendants path key (= 행 itemKey). */
  descendantPath: string;
}

export type CollectionWriteTarget =
  | CollectionTemplateWriteTarget
  | CollectionDataWriteTarget
  | CollectionOverrideWriteTarget;

/**
 * 본 함수가 인식하는 collection row/cell projection metadata 부분집합.
 * listbox-row / gridlist-row / table-row 동형 메타(listBoxId/itemKey/templateOriginId) +
 * table-cell(columnId 추가). 신규 row family 는 `isCollectionRowProjectionKind` 단일 진입점에
 * kind 추가만으로 동일 변환, cell 은 `isCollectionCellProjectionKind` 로 columnId 라우팅.
 */
type CollectionRowProjection = Extract<
  CanvasProjectionMetadata,
  { kind: "listbox-row" | "gridlist-row" | "table-row" | "tag-row" | "tab-row" }
>;
type CollectionCellProjection = Extract<
  CanvasProjectionMetadata,
  { kind: "table-cell" }
>;

function isCollectionRowProjection(
  meta: CanvasProjectionMetadata | undefined | null,
): meta is CollectionRowProjection {
  return isCollectionRowProjectionKind(meta?.kind);
}

function isCollectionCellProjection(
  meta: CanvasProjectionMetadata | undefined | null,
): meta is CollectionCellProjection {
  return isCollectionCellProjectionKind(meta?.kind);
}

/**
 * projected cell/row 편집 → canonical write target.
 *
 * @returns 3-route target. 변환 불가(메타 불충분 / template route 인데 origin 없음)면 null.
 * @throws 산출된 target 에 projected id 가 섞이면 boundary 위반으로 throw(self-check).
 */
export function resolveCollectionWriteTarget(
  projection: CanvasProjectionMetadata | undefined | null,
  intent: CollectionWriteIntent,
): CollectionWriteTarget | null {
  // table-cell 은 row 동형 메타 + columnId — content route 에 columnId 부착, 나머지 동일.
  if (isCollectionCellProjection(projection)) {
    return resolveCellWriteTarget(projection, intent);
  }
  if (!isCollectionRowProjection(projection)) return null;

  const { listBoxId, itemKey, templateOriginId } = projection;

  let target: CollectionWriteTarget | null;
  switch (intent.kind) {
    case "style":
      // style 편집은 origin master 에 써서 전 행 반영. origin 미해결이면 변환 불가.
      target = templateOriginId
        ? { route: "template", originNodeId: templateOriginId }
        : null;
      break;
    case "content":
      target = { route: "data", collectionNodeId: listBoxId, itemKey };
      break;
    case "override":
      target = {
        route: "override",
        refNodeId: listBoxId,
        descendantPath: itemKey,
      };
      break;
  }

  if (target) assertCanonicalWriteTarget(target);
  return target;
}

/**
 * 2D collection(Table) 셀 편집 → write target. row 변환과 동형이되 content route 에
 * `columnId` 를 부착해 `row.cells[columnId]` 단위 write 가 되게 한다. header 셀(isHeader)은
 * 컬럼 정의(label) 편집이므로 content route 로 같은 columnId 를 전달(데이터 행 아님은 caller 판정).
 */
function resolveCellWriteTarget(
  projection: CollectionCellProjection,
  intent: CollectionWriteIntent,
): CollectionWriteTarget | null {
  const { listBoxId, itemKey, columnId, templateOriginId } = projection;

  let target: CollectionWriteTarget | null;
  switch (intent.kind) {
    case "style":
      target = templateOriginId
        ? { route: "template", originNodeId: templateOriginId }
        : null;
      break;
    case "content":
      target = {
        route: "data",
        collectionNodeId: listBoxId,
        itemKey,
        columnId,
      };
      break;
    case "override":
      target = {
        route: "override",
        refNodeId: listBoxId,
        descendantPath: itemKey,
      };
      break;
  }

  if (target) assertCanonicalWriteTarget(target);
  return target;
}

/**
 * 산출 target 의 모든 id 필드가 canonical id 임을 보장(G-boundary self-check).
 * projected id 가 출력에 섞이면 즉시 throw — `assertCanonicalMoveTarget` 의 입력 차단과
 * 대칭으로, 변환 출력 측에서도 비영속 id 누출을 차단한다.
 */
function assertCanonicalWriteTarget(target: CollectionWriteTarget): void {
  const ids: string[] =
    target.route === "template"
      ? [target.originNodeId]
      : target.route === "data"
        ? [target.collectionNodeId]
        : [target.refNodeId];
  for (const id of ids) {
    if (isRenderProjectionId(id)) {
      throw new Error(
        `[resolveCollectionWriteTarget] projected id leaked into ${target.route} target: ${id}`,
      );
    }
  }
}

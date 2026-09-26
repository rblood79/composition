import type { CanonicalNode } from "@composition/shared";
import { getCanonicalNodePathSegment } from "../../../../adapters/canonical/canonicalPathWalk";
import {
  isRenderProjectionId,
  toCollectionRowProjectionId,
} from "../../../projection/renderProjectionIds";

/**
 * ADR-150 A3' — owner 로 돌린 클릭의 원래 hit (가상 · projected 노드). 선택 · mutation · history 에는
 * 넣지 않고 double-click 연속성 키와 origin 해석 입력으로만 쓴다 (HC3).
 */
export interface CanvasSourceHit {
  nodeId: string;
  projection: {
    kind: string;
    listBoxId: string;
    itemKey?: string;
    templateOriginId?: string | null;
  };
}

/** double-click handler 의 두 번째 인자 — 두 double-click 분기가 같은 모양으로 넘긴다. */
export interface ElementDoubleClickOptions {
  sourceHit?: CanvasSourceHit;
}

const MAX_ORIGIN_REF_CHAIN = 16;

/** 템플릿 origin 을 갖는 데이터 행 kind → row projection id family (§2-4 표 — Table · Breadcrumbs 비대상). */
const ORIGIN_ROW_FAMILY: Readonly<Record<string, string>> = {
  "listbox-row": "listbox",
  "gridlist-row": "gridlist",
  "tag-row": "tag",
  "tab-row": "tab",
};

/**
 * 데이터 행의 hit 노드 → 그 행이 펼친 템플릿 origin 의 대응 canonical id. 해석 못 하면 null (호출자는
 * owner 선택으로 돌아간다).
 *
 * - 행 노드 자체 (접힌 카드 · ListBox 행 · chip · tab) → origin 루트.
 * - 펼친 카드 안 자식 (`<row id>/<path>`) → origin 서브트리를 path 구간 이름으로 따라간 노드. 행 id 에 `/`
 *   가 들어갈 수 있어 (ref instance 안 owner) 첫 `/` 로 자르지 않고 행 id 를 다시 만들어 뗀다.
 * - 따라가다 origin 안 ref (중첩 instance) 를 만나면 `<그 ref id>/<나머지 path>` (synthetic 자식 — 쓰기는
 *   그 ref 의 `descendants[path]`). 중첩 master 로 들어가지 않는다 ("이 원본을 쓰는 카드 전체" 범위).
 */
export function resolveDataRowOriginTarget(
  sourceHit: CanvasSourceHit | null | undefined,
  nodesById: ReadonlyMap<string, CanonicalNode>,
): { targetId: string; originId: string } | null {
  if (!sourceHit) return null;
  const { projection } = sourceHit;
  const family = ORIGIN_ROW_FAMILY[projection.kind];
  const originId = projection.templateOriginId;
  if (!family || !originId || projection.itemKey == null) return null;
  // 행이 가리키는 origin 이 상태 변형 (휴지 `--unselected` · `--selected` — 기본 origin 의 reusable ref,
  //   ADR-234) 이면 체인 끝 기본 origin 으로 간다. 변형 ref 의 synthetic 자식을 고르면 편집이 그 상태의
  //   행에만 퍼진다 — "이 원본을 쓰는 카드 전체" 는 기본 origin 이다 (§2-4: 선택 행도 기본 origin).
  let origin = nodesById.get(originId);
  for (
    let depth = 0;
    origin?.type === "ref" && depth < MAX_ORIGIN_REF_CHAIN;
    depth += 1
  ) {
    origin = nodesById.get((origin as { ref?: string }).ref ?? "");
  }
  if (!origin || origin.type === "ref") return null;

  const rowId = toCollectionRowProjectionId(
    family,
    projection.listBoxId,
    projection.itemKey,
  );
  let resolved: string | null = null;
  if (sourceHit.nodeId === rowId) {
    resolved = origin.id;
  } else if (sourceHit.nodeId.startsWith(`${rowId}/`)) {
    const segments = sourceHit.nodeId.slice(rowId.length + 1).split("/");
    let current: CanonicalNode = origin;
    resolved = origin.id;
    for (let index = 0; index < segments.length; index += 1) {
      if (current.type === "ref") {
        resolved = `${current.id}/${segments.slice(index).join("/")}`;
        break;
      }
      const child = (current.children ?? []).find(
        (node) => getCanonicalNodePathSegment(node) === segments[index],
      );
      if (!child) return null;
      current = child;
      resolved = child.id;
    }
  }
  // 출력 자기 검사 — 가상 · projected id 는 선택에 들어가지 않는다.
  if (!resolved || isRenderProjectionId(resolved)) return null;
  return { targetId: resolved, originId: origin.id };
}

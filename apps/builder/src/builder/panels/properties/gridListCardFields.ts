/**
 * ADR-162 Phase 5 — 데이터 GridList Properties 「카드 필드」 절의 입력 목록 (순수 판정).
 *
 * 선택된 GridList 의 항목 origin (`resolveGridListTemplateOriginId` — Canvas scene · 가상화와 같은 함수) 자손
 * 중 행 데이터로 연결할 수 있는 prop (`rowTemplateBindableKeysFor` — Canvas · DOM 보간과 같은 허용표) 을
 * 문서 순서로 나열한다. 쓰기 위치는 origin 문서 노드 (모든 instance 가 공유). Components 페이지 origin 을
 * 직접 편집하면 조상에 데이터 소유자가 없어 컬럼 피커가 서지 않는다 — 이 절이 소유자 쪽 편집 경로다.
 */
import {
  getElementDataBinding,
  rowTemplateBindableKeysFor,
  type CanonicalNode,
  type RowTemplateBindablePropKey,
} from "@composition/shared";

import { resolveGridListTemplateOriginId } from "../../components/gridlist/gridListTemplateOriginId";
import { resolveChainEnd } from "../../components/staticCollectionMigration";

export interface GridListCardFieldRow {
  /** 쓰기 대상 — origin 자손 문서 노드 id. */
  nodeId: string;
  /** 사람이 읽는 노드 이름 (name → 해석된 type). */
  nodeLabel: string;
  key: RowTemplateBindablePropKey;
  value: string;
}

export interface GridListCardFields {
  originId: string;
  /** 소유자 (선택된 GridList) — 컬럼 목록 출처. `props.dataBinding` 을 보강한 읽기 전용 사본. */
  owner: { props: Record<string, unknown> };
  rows: GridListCardFieldRow[];
}

const MAX_DEPTH = 8;

function effectiveType(
  node: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
): string {
  if (node.type !== "ref") return node.type;
  return resolveChainEnd(node.id, byId)?.type ?? node.type;
}

/** 선택이 데이터 소유 GridList 가 아니면 null — 절 미노출. */
export function readGridListCardFields(
  elementId: string,
  byId: ReadonlyMap<string, CanonicalNode>,
): GridListCardFields | null {
  const node = byId.get(elementId);
  if (!node || effectiveType(node, byId) !== "GridList") return null;
  const binding = getElementDataBinding(
    node as unknown as Parameters<typeof getElementDataBinding>[0],
    "props-first",
  );
  if (binding === undefined) return null;

  const originId = resolveGridListTemplateOriginId(node, () => byId);
  const origin = byId.get(originId);
  if (!origin) return null;

  const rows: GridListCardFieldRow[] = [];
  const visit = (
    children: readonly CanonicalNode[] | undefined,
    depth: number,
  ) => {
    if (!children || depth > MAX_DEPTH) return;
    for (const child of children) {
      const type = effectiveType(child, byId);
      const props = (child.props ?? {}) as Record<string, unknown>;
      const nodeLabel =
        typeof child.name === "string" && child.name.length > 0
          ? child.name
          : type;
      for (const key of rowTemplateBindableKeysFor(type, props)) {
        const value = props[key];
        rows.push({
          nodeId: child.id,
          nodeLabel,
          key,
          value: typeof value === "string" ? value : "",
        });
      }
      visit(child.children, depth + 1);
    }
  };
  visit(origin.children, 0);

  return {
    originId,
    owner: { props: { ...(node.props ?? {}), dataBinding: binding } },
    rows,
  };
}

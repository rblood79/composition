/**
 * ADR-923 Phase 5 후속 — read-only sub-part 의 owner 를 **요소 id 로** 판정한다.
 *
 * 술어 (`resolveSubpartStyleOwnerType` · `resolveDelegatedSubpartOwnerType`) 는 `@composition/shared`
 * 하나지만, 입력 (자기 · 부모 · 조부모 type) 을 store `elementsMap` 에서만 읽으면 instance 의
 * synthetic 자식 (`<instance>/<path>` — 팔레트 배치의 기본, ADR-228) 은 store 에 없어 판정이 항상
 * null 이었다. 그래서 TextField instance 의 Label 을 고르면 패널은 편집을 다 열고, 캔버스 resize ·
 * spacing 도 descendants patch 에 값을 썼다 — layout · Skia · DOM 이 모두 무시하는 값이다.
 *
 * 여기서 synthetic 자식은 해소된 instance 트리에서, instance 부모는 origin type 으로 읽는다.
 * 패널 (안내) 과 캔버스 (resize · spacing 진입 차단) 가 같이 쓴다.
 */
import {
  resolveDelegatedSubpartOwnerType,
  resolveSubpartStyleOwnerType,
} from "@composition/shared";

import {
  getResolvedInstanceType,
  getSyntheticDescendantLookup,
} from "./syntheticDescendantLookup";

type OwnerLookupElement = {
  type: string;
  parent_id?: string | null;
};

export type SubpartElementLookup = Pick<
  ReadonlyMap<string, OwnerLookupElement>,
  "get"
>;

type NodeFacts = { type: string; parentId: string | null };

function readNodeFacts(
  elementId: string,
  elementsMap: SubpartElementLookup,
): NodeFacts | null {
  const synthetic = getSyntheticDescendantLookup(elementId);
  if (synthetic) {
    return { type: synthetic.node.type, parentId: synthetic.parentId };
  }
  const element = elementsMap.get(elementId);
  if (!element) return null;
  const type =
    element.type === "ref"
      ? (getResolvedInstanceType(elementId) ?? element.type)
      : element.type;
  return { type, parentId: element.parent_id ?? null };
}

function readChain(
  elementId: string | null | undefined,
  elementsMap: SubpartElementLookup,
): [NodeFacts, NodeFacts, NodeFacts | null] | null {
  if (!elementId) return null;
  const self = readNodeFacts(elementId, elementsMap);
  if (!self?.parentId) return null;
  const parent = readNodeFacts(self.parentId, elementsMap);
  if (!parent) return null;
  const grandparent = parent.parentId
    ? readNodeFacts(parent.parentId, elementsMap)
    : null;
  return [self, parent, grandparent];
}

/** style 축 owner type (SelectValue 포함) — Styles 패널 · 캔버스 resize · spacing. */
export function resolveSubpartStyleOwnerTypeById(
  elementId: string | null | undefined,
  elementsMap: SubpartElementLookup,
): string | null {
  const chain = readChain(elementId, elementsMap);
  if (!chain) return null;
  const [self, parent, grandparent] = chain;
  return resolveSubpartStyleOwnerType(
    self.type,
    parent.type,
    grandparent?.type,
  );
}

/** 전체 sub-part owner type — Properties 패널 (텍스트 축이 자식에 남는 SelectValue 제외). */
export function resolveDelegatedSubpartOwnerTypeById(
  elementId: string | null | undefined,
  elementsMap: SubpartElementLookup,
): string | null {
  const chain = readChain(elementId, elementsMap);
  if (!chain) return null;
  const [self, parent, grandparent] = chain;
  return resolveDelegatedSubpartOwnerType(
    self.type,
    parent.type,
    grandparent?.type,
  );
}

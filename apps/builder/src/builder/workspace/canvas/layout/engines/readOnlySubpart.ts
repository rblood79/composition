/**
 * ADR-923 Phase 5 후속 — **read-only sub-part** 의 read-time 투영 (2026-09-03 판정 A × 4).
 *
 * DOM (Preview·publish 공통 `@composition/shared/renderers`) 은 parent props 만으로 self-compose 하고
 * canonical 자식 (FieldError · Label · Input · DateInput · SelectTrigger 래퍼) 을 읽지 않는다 — 자식에 준
 * 인라인 style 은 어떤 채널로도 DOM 에 닿지 않는다. Canvas read 경로 (layout · Skia) 는 그 인라인을
 * **통째로 무시**하고, DOM 이 CSS 로 갖는 구조값만 read-time 에 투영한다:
 *   - 투영 `display` (propagation / factory `none`) — 전 type.
 *   - SelectValue 는 **style 축만** sub-part (2026-09-04 판정 A): 인라인 style 은 무시하되 텍스트/placeholder 는
 *     자식이 정본이라 props 는 그대로 둔다. 구조값 (flex 1 · minWidth 0 · fontSize · nowrap) 은 implicitStyles
 *     selecttrigger 분기의 read-through 주입이 유일 채널.
 *   - FieldError 글자 크기 = owner rule delegation (`.react-aria-FieldError` hint 변수 — DOM computed 원천).
 *   - Input · DateInput (field 직계) 폭 100% — DOM 실효 폭 (root 가 `align-items:flex-start` 라 stretch 가
 *     아니라 CSS width 로 채운다). SelectTrigger 아래 DateInput 은 implicitStyles selecttrigger 분기가
 *     flex:1 · minWidth:0 · height:100% 를 주입한다 (여기서 더할 것 없음).
 *   - SelectTrigger 래퍼 · 그룹 Label: implicitStyles 가 같은 값을 read-through 로 주입한다 (래퍼 flex row ·
 *     width 100% · gap · padding · height, Label 의 gridArea + 숫자 grid line) — factory 인라인은 그 중복.
 *
 * 술어 (`isDelegatedSubpartChild`) 와 owner 판정은 `@composition/shared` 하나를 layout · Skia · 패널 · overlay
 * 가 같이 읽는다. 이 모듈은 layout 쪽 소비처 (자식 visit · implicitStyles 입력 · 3.6 delta 기준) 를 한 함수로
 * 묶는다 — 세 곳이 따로 계산하면 한 곳에서 걷어낸 인라인이 다른 곳에서 되살아난다 (3.6 implicit 전체 재패치
 * 사례, Label/Input 확장 때 실측).
 */
import {
  FIELD_ERROR_CHILD_SELECTOR,
  resolveDelegatedChildFontSize,
  resolveSubpartStyleOwnerType,
} from "@composition/shared";

import type { CanvasLayoutNode } from "../layoutNode";

type ElementLookup = Pick<Map<string, CanvasLayoutNode>, "get">;

/** 이 요소를 sub-part 로 소유한 DOM parent (직계, 또는 직계가 래퍼면 조부모). 아니면 undefined. */
export function resolveReadOnlySubpartOwner(
  element: CanvasLayoutNode,
  elementsMap: ElementLookup,
): CanvasLayoutNode | undefined {
  if (!element.parent_id) return undefined;
  const parent = elementsMap.get(element.parent_id);
  if (!parent) return undefined;
  const grandparent = parent.parent_id
    ? elementsMap.get(parent.parent_id)
    : undefined;
  const ownerType = resolveSubpartStyleOwnerType(
    element.type,
    parent.type,
    grandparent?.type,
  );
  if (!ownerType) return undefined;
  return ownerType === parent.type ? parent : grandparent;
}

export function isReadOnlySubpart(
  element: CanvasLayoutNode,
  elementsMap: ElementLookup,
): boolean {
  return resolveReadOnlySubpartOwner(element, elementsMap) !== undefined;
}

/** sub-part 자식이 layout 에 가져가는 style — 인라인 대신 이것만. */
export function projectReadOnlySubpartStyle(
  element: CanvasLayoutNode,
  owner: CanvasLayoutNode,
  directParentType: string,
): Record<string, unknown> {
  const inline = (element.props?.style ?? {}) as Record<string, unknown>;
  const projected: Record<string, unknown> =
    inline.display !== undefined ? { display: inline.display } : {};
  if (element.type === "FieldError") {
    const fontSize = resolveDelegatedChildFontSize(
      owner.type,
      FIELD_ERROR_CHILD_SELECTOR,
      (owner.props as Record<string, unknown> | undefined)?.size as
        string | undefined,
    );
    if (fontSize != null) projected.fontSize = fontSize;
  } else if (
    (element.type === "Input" || element.type === "DateInput") &&
    directParentType === owner.type
  ) {
    projected.width = "100%";
  }
  return projected;
}

/**
 * sub-part 면 인라인을 투영값으로 바꾼 사본을, 아니면 같은 참조를 돌려준다 (참조 동일성은 3.6 의
 * "implicit 이 수정했는가" 비교가 쓴다).
 */
export function projectReadOnlySubpart(
  element: CanvasLayoutNode,
  elementsMap: ElementLookup,
): CanvasLayoutNode {
  const owner = resolveReadOnlySubpartOwner(element, elementsMap);
  if (!owner) return element;
  const parent = elementsMap.get(element.parent_id as string);
  const style = projectReadOnlySubpartStyle(
    element,
    owner,
    parent?.type ?? owner.type,
  );
  return {
    ...element,
    props: { ...element.props, style },
  } as CanvasLayoutNode;
}

/**
 * 계층적 선택 유틸리티
 *
 * Pencil/Figma 스타일의 계층적 선택 모델을 위한 순수 함수들.
 * - 캔버스 클릭 시 현재 editingContext의 직계 자식만 선택 가능
 * - 더블클릭으로 컨테이너 진입 (한 단계 아래)
 * - Escape로 한 단계 위로 복귀
 */

interface MinimalElement {
  id: string;
  type: string;
  parent_id?: string | null;
  props?: Record<string, unknown> | null;
}

/**
 * 클릭된 요소에서 parent chain을 올라가
 * editingContext의 직계 자식을 찾아 반환한다.
 *
 * @param clickedElementId - Canvas pointer 이벤트로 감지된 가장 깊은 요소
 * @param editingContextId - 현재 진입한 컨테이너 (null = body 직계 자식 레벨)
 * @param elementsMap - O(1) 요소 조회
 * @returns 선택해야 할 요소 ID, 또는 null (context에 속하지 않는 경우)
 */
export function resolveClickTarget(
  clickedElementId: string,
  editingContextId: string | null,
  elementsMap: ReadonlyMap<string, MinimalElement>,
): string | null {
  let current: string | undefined = clickedElementId;

  while (current) {
    const element = elementsMap.get(current);
    if (!element) return null;

    if (editingContextId === null) {
      // 루트 레벨: parent가 body인 요소를 찾는다
      if (isRootSelectableElement(element, elementsMap)) return current;
    } else {
      // 특정 컨테이너 내부: parent_id가 editingContextId인 요소를 찾는다
      if (element.parent_id === editingContextId) return current;
    }

    current = element.parent_id ?? undefined;
  }

  return null;
}

export function resolveContextEntryTarget(
  clickedElementId: string,
  contextElementId: string,
  elementsMap: Map<string, MinimalElement>,
): string | null {
  const target = resolveClickTarget(
    clickedElementId,
    contextElementId,
    elementsMap,
  );
  return target && target !== contextElementId ? target : null;
}

/** label 인라인 편집 시 button host 의 자식 Text 를 우선하는 대상 태그 */
const LABEL_EDIT_HOST_TAGS = new Set(["Button", "ToggleButton"]);

/**
 * 더블클릭 label 편집 대상 해석.
 *
 * icon 이 추가된 Button/ToggleButton 은 RSP composite — 자식 Icon+Text element 를 보유하고
 * host 자체의 `children` prop 은 빈 문자열이다(텍스트가 자식 Text element 로 이관됨). 이때
 * host(Button/ToggleButton)를 그대로 편집 대상으로 삼으면 빈 children 을 편집하는 잘못된
 * label 에디트 상태가 된다. host 에 자식 Text element 가 있으면 그 Text 를 편집 대상으로
 * 해석한다(사용자 결정 — icon 없는 button 과 동일한 label 편집 경험, 대상만 자식 Text).
 *
 * icon 없는 leaf button(children prop 에 텍스트, 자식 element 없음)이나 Text 자식이 없는
 * icon-only button 은 resolvedTarget 을 그대로 반환(기존 동작 보존).
 *
 * @param resolvedTarget - resolveClickTarget 으로 해석된 host element id
 * @param resolvedElement - 해당 host element (type 판정용)
 * @param childrenMap - host id → 직계 자식 노드 배열
 * @returns 편집 대상 element id (자식 Text 또는 resolvedTarget 그대로)
 */
export function resolveLabelEditTarget(
  resolvedTarget: string,
  resolvedElement: MinimalElement,
  childrenMap: Map<string, MinimalElement[]>,
): string {
  if (!LABEL_EDIT_HOST_TAGS.has(resolvedElement.type)) return resolvedTarget;
  const children = childrenMap.get(resolvedTarget);
  if (!children || children.length === 0) return resolvedTarget;
  const textChild = children.find(
    (child) =>
      child.type === "Text" &&
      !(child.props as { deleted?: boolean } | null | undefined)?.deleted,
  );
  return textChild ? textChild.id : resolvedTarget;
}

export function resolveModifierClickTarget(
  clickedElementId: string,
  editingContextId: string | null,
  elementsMap: Map<string, MinimalElement>,
): string | null {
  const boundaryTarget = resolveClickTarget(
    clickedElementId,
    editingContextId,
    elementsMap,
  );
  if (!boundaryTarget || boundaryTarget === clickedElementId) return null;

  const clickedElement = elementsMap.get(clickedElementId);
  if (!clickedElement || isBodyElement(clickedElement)) return null;

  return clickedElementId;
}

function isRootSelectableElement(
  element: MinimalElement,
  elementsMap: ReadonlyMap<string, MinimalElement>,
): boolean {
  let parentId = element.parent_id;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parentElement = elementsMap.get(parentId);
    if (!parentElement) return false;
    if (isBodyElement(parentElement)) return true;
    if (!isTransparentSelectionContainer(parentElement)) return false;
    parentId = parentElement.parent_id ?? null;
  }

  return false;
}

function isBodyElement(element: MinimalElement): boolean {
  return element.type.toLowerCase() === "body";
}

function isTransparentSelectionContainer(element: MinimalElement): boolean {
  return element.props?._slotChrome === "hidden";
}

/**
 * 요소가 자식을 가지고 있는지 확인한다.
 * (더블클릭으로 진입 가능한지 판단)
 */
export function hasEditableChildren(
  elementId: string,
  childrenMap: Map<string, Array<{ id: string }>>,
): boolean {
  const children = childrenMap.get(elementId);
  return Boolean(children && children.length > 0);
}

/**
 * 요소의 ancestor chain을 배열로 반환한다 (자기 자신 포함).
 * [element, parent, grandparent, ..., body]
 */
export function getAncestorChain(
  elementId: string,
  elementsMap: Map<string, MinimalElement>,
): string[] {
  const chain: string[] = [];
  let current: string | undefined = elementId;

  while (current) {
    chain.push(current);
    const element = elementsMap.get(current);
    if (!element) break;
    current = element.parent_id ?? undefined;
  }

  return chain;
}

/**
 * 레이어 트리에서 직접 선택 시 editingContextId를 자동 조정한다.
 * 선택된 요소의 부모가 body이면 null(루트), 아니면 parent_id를 반환한다.
 */
export function resolveEditingContextForTreeSelection(
  selectedElementId: string,
  elementsMap: Map<string, MinimalElement>,
): string | null {
  const element = elementsMap.get(selectedElementId);
  if (!element) return null;

  const parentId = element.parent_id;
  if (!parentId) return null;

  const parentElement = elementsMap.get(parentId);
  if (parentElement?.type === "body") return null;

  return parentId;
}

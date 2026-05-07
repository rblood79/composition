/**
 * ADR-076 P5: 컬렉션 items SSOT 마이그레이션 (Select/ComboBox/ListBox 3종 공통)
 *
 * 프로젝트 로드 시 호출되어 legacy element tree 를 부모 props.items 배열로 흡수.
 * ADR-073 P5 `applySelectComboBoxMigration` 을 ListBox 포함 3종 공통 오케스트레이터로 일반화.
 *
 * ListBox 듀얼 모드 (ADR-076 Hard Constraint #1/#3):
 *   - 정적 모드: props.label 또는 Text/Description subtree 자식 → items[] 흡수
 *   - 템플릿 모드: Field 자식 보유 → 부모 전체 skip (element tree 영구 유지)
 *   - 혼합 금지: 부모 단위 원자 판정 — 자식 ListBoxItem 중 하나라도 Field 자식 보유 시
 *     부모 전체 템플릿 모드 유지
 *
 * Select/ComboBox 는 항상 흡수 (ADR-073 패턴).
 *
 * 삭제는 `removeElements(orphanIds, { skipHistory: true })` 로 별도 수행 — undo 스택 보존.
 */

import type {
  StoredSelectItem,
  StoredComboBoxItem,
  StoredListBoxItem,
  StoredTagItem,
} from "@composition/specs";

interface ElementLike {
  id: string;
  type: string;
  parent_id?: string | null;
  props: Record<string, unknown>;
}

export interface CollectionItemsMigrationResult<T extends ElementLike> {
  migratedElements: T[];
  orphanIds: string[];
}

/** ADR-073 호환 alias — deprecated, applyCollectionItemsMigration 사용 권장 */
export type SelectComboBoxMigrationResult<T extends ElementLike> =
  CollectionItemsMigrationResult<T>;

/**
 * 프로젝트 로드 시점 오케스트레이터 (ADR-076 P5).
 *
 * 입력 elements 로부터 Select/ComboBox/ListBox 부모의 Item 자식을 수집하여
 * `items[]` 배열로 변환, 부모 props 에 주입한다. 흡수된 자식은 `orphanIds` 로 분리 반환.
 *
 * 호출 측(예: usePageManager.initializeProject)은:
 *  1. `migratedElements` 로 store hydrate (자식 제거 + 부모 props.items 병합)
 *  2. `orphanIds` 로 IDB `deleteMany` 수행 (영속 정리)
 *
 * 제네릭 T 로 호출 측의 실제 Element 타입을 보존 (추가 필드 유지).
 */
export function applyCollectionItemsMigration<T extends ElementLike>(
  elements: T[],
): CollectionItemsMigrationResult<T> {
  // 전체 parent_id 기반 자식 인덱스 (ListBox subtree 직렬화 + DFS orphan 용)
  const childrenByParent = new Map<string, T[]>();
  for (const el of elements) {
    if (!el.parent_id) continue;
    pushInto(childrenByParent, el.parent_id, el);
  }

  // 태그별 자식 그룹: Select/ComboBox/ListBox 부모의 Item 자식
  const selectItemChildrenByParent = new Map<string, T[]>();
  const comboBoxItemChildrenByParent = new Map<string, T[]>();
  const listBoxItemChildrenByParent = new Map<string, T[]>();
  // ADR-097: TagGroup 2단 이전 — Tag 는 TagList (중간 컨테이너) 의 자식이므로
  //   parent_id 가 TagList ID. TagList 자체는 TagGroup 의 자식으로 유지.
  const tagChildrenByTagListId = new Map<string, T[]>();
  const tagListIdToTagGroupId = new Map<string, string>();
  for (const el of elements) {
    if (!el.parent_id) continue;
    // ADR-100 Phase 1 (098-a 슬롯): legacy "SelectItem" Element → items SSOT 흡수.
    //   RAC 공식: ListBoxItem. composition 고유 식별자 유지 (BC HIGH 회피).
    // ADR-101 Phase 1 (098-b 슬롯): legacy "ComboBoxItem" Element → items SSOT 흡수.
    //   RAC alias: ComboBoxItem (이름 동일). ADR-073 이관 완료 → 저장 데이터에 type 없음 (BC 0%).
    //   본 경로는 migration 전 기존 프로젝트 호환 경로.
    if (el.type === "SelectItem") {
      pushInto(selectItemChildrenByParent, el.parent_id, el);
    } else if (el.type === "ComboBoxItem") {
      pushInto(comboBoxItemChildrenByParent, el.parent_id, el);
    } else if (el.type === "ListBoxItem") {
      pushInto(listBoxItemChildrenByParent, el.parent_id, el);
    } else if (el.type === "Tag") {
      pushInto(tagChildrenByTagListId, el.parent_id, el);
    } else if (el.type === "TagList") {
      tagListIdToTagGroupId.set(el.id, el.parent_id);
    }
  }

  const hasAnyWork =
    selectItemChildrenByParent.size > 0 ||
    comboBoxItemChildrenByParent.size > 0 ||
    listBoxItemChildrenByParent.size > 0 ||
    tagChildrenByTagListId.size > 0;

  // ADR-097 Phase 4A: 이미 마이그레이션된 프로젝트 보정.
  //   Tag children 이 이미 제거되어 hasAnyWork=false 이더라도, TagGroup.props.items 가
  //   이미 있고 TagList.props.items 가 비어있는 경우가 존재 (이전 버전 migration 결과).
  //   이 케이스에서도 TagList 에 items 를 propagation 해야 Skia chip 이 렌더됨.
  const tagListNeedsItemsPropagation: Array<{
    tagListId: string;
    tagGroupItems: StoredTagItem[];
  }> = [];
  if (!hasAnyWork) {
    const tagGroupById = new Map<string, T>();
    const tagListsByTagGroupId = new Map<string, T[]>();
    for (const el of elements) {
      if (el.type === "TagGroup") tagGroupById.set(el.id, el);
    }
    for (const el of elements) {
      if (el.type === "TagList" && el.parent_id) {
        pushInto(tagListsByTagGroupId, el.parent_id, el);
      }
    }
    for (const [tagGroupId, tg] of tagGroupById) {
      const tgItems = (tg.props ?? {}).items as StoredTagItem[] | undefined;
      if (!Array.isArray(tgItems) || tgItems.length === 0) continue;
      const tls = tagListsByTagGroupId.get(tagGroupId) ?? [];
      for (const tl of tls) {
        const tlItems = (tl.props ?? {}).items as StoredTagItem[] | undefined;
        if (Array.isArray(tlItems) && tlItems.length > 0) continue;
        tagListNeedsItemsPropagation.push({
          tagListId: tl.id,
          tagGroupItems: tgItems,
        });
      }
    }

    if (tagListNeedsItemsPropagation.length === 0) {
      return { migratedElements: elements, orphanIds: [] };
    }

    // 이미 마이그레이션된 프로젝트 — TagList items propagation 만 수행.
    const pendingMap = new Map<string, StoredTagItem[]>();
    for (const { tagListId, tagGroupItems } of tagListNeedsItemsPropagation) {
      pendingMap.set(tagListId, tagGroupItems);
    }
    const patched = elements.map((el) => {
      const items = pendingMap.get(el.id);
      if (!items) return el;
      return {
        ...el,
        props: { ...(el.props ?? {}), items },
      };
    });
    return { migratedElements: patched, orphanIds: [] };
  }

  // ListBox 부모 단위 원자 판정 — 자식 ListBoxItem 중 하나라도 Field 보유 → 전체 skip
  const listBoxAbsorbParents = new Set<string>();
  for (const [parentId, lbiChildren] of listBoxItemChildrenByParent) {
    let anyTemplate = false;
    for (const lbi of lbiChildren) {
      const subs = childrenByParent.get(lbi.id) ?? [];
      if (subs.some((s) => s.type === "Field")) {
        anyTemplate = true;
        break;
      }
    }
    if (!anyTemplate) listBoxAbsorbParents.add(parentId);
  }

  // ADR-097 Phase 2: TagGroup 2단 이전 — TagList 별 items 계산 + TagGroup 매핑
  //   Tag Field 자식 불가 (Tag.children: string 만) → 항상 정적 흡수 (ListBox 원자 판정 불필요).
  //   TagList 는 유지 (ADR-093 containerStyles 리프팅 + ADR-094 expandChildSpecs 자동 재생성).
  const tagGroupItemsById = new Map<string, StoredTagItem[]>();
  for (const [tagListId, tagChildren] of tagChildrenByTagListId) {
    const tagGroupId = tagListIdToTagGroupId.get(tagListId);
    if (!tagGroupId) continue; // TagList 가 있는데 TagGroup 부모 없는 경우 — edge case, skip
    tagGroupItemsById.set(tagGroupId, tagChildrenToItemsArray(tagChildren));
  }

  // orphan 수집: Select/ComboBox 자식 전부 + ListBox 정적 모드 부모의 ListBoxItem + 자식 subtree DFS
  //             + ADR-097 TagGroup 의 Tag elements 전부 (TagList 는 유지)
  const orphanSet = new Set<string>();
  for (const children of selectItemChildrenByParent.values()) {
    for (const child of children) orphanSet.add(child.id);
  }
  for (const children of comboBoxItemChildrenByParent.values()) {
    for (const child of children) orphanSet.add(child.id);
  }
  for (const parentId of listBoxAbsorbParents) {
    const lbiChildren = listBoxItemChildrenByParent.get(parentId) ?? [];
    for (const lbi of lbiChildren) {
      orphanSet.add(lbi.id);
      collectSubtreeIds(lbi.id, childrenByParent, orphanSet);
    }
  }
  // ADR-097: Tag elements 를 orphan 처리 (TagList 자체는 유지, ADR-094 expandChildSpecs
  //   가 spec 기반 자동 재생성 담당). Tag 자식 subtree 는 현재 children:string 만 → DFS 불필요하지만
  //   향후 description slot 추가 시 subtree 생성 가능 — 선제 DFS.
  // BC 보호: Tag parent_id 가 실제 TagList ID 가 아닌 경우 (edge case / deformed data)
  //   orphan skip — items 주입 없이 Tag element 유지되어 안전.
  for (const [tagListId, tagChildren] of tagChildrenByTagListId) {
    if (!tagListIdToTagGroupId.has(tagListId)) continue;
    for (const type of tagChildren) {
      orphanSet.add(type.id);
      collectSubtreeIds(type.id, childrenByParent, orphanSet);
    }
  }

  const migratedElements: T[] = [];
  for (const el of elements) {
    // orphan 으로 판정된 element 는 제외
    if (orphanSet.has(el.id)) continue;

    // Select 부모 — items[] 주입
    if (el.type === "Select") {
      const children = selectItemChildrenByParent.get(el.id);
      if (children) {
        migratedElements.push({
          ...el,
          props: {
            ...(el.props ?? {}),
            items: selectItemChildrenToItemsArray(children),
          },
        });
        continue;
      }
    }

    // ComboBox 부모 — items[] 주입
    if (el.type === "ComboBox") {
      const children = comboBoxItemChildrenByParent.get(el.id);
      if (children) {
        migratedElements.push({
          ...el,
          props: {
            ...(el.props ?? {}),
            items: comboBoxItemChildrenToItemsArray(children),
          },
        });
        continue;
      }
    }

    // ADR-097: TagGroup 부모 — items[] 주입 (2단 이전, TagList 유지)
    if (el.type === "TagGroup") {
      const items = tagGroupItemsById.get(el.id);
      if (items && items.length > 0) {
        migratedElements.push({
          ...el,
          props: {
            ...(el.props ?? {}),
            items,
          },
        });
        continue;
      }
    }

    // ADR-097 Phase 4A: TagList — 부모 TagGroup 의 items 를 propagation 으로 전파.
    //   TagList spec.shapes 가 props.items 기반 chip self-render (Skia). Inspector edit
    //   경로는 buildPropagationUpdates 로 자동 전파되지만, migration 경로는 별도 주입 필요.
    //   TagGroup.propagation rule `{ parentProp: "items", childPath: "TagList", override: true }`
    //   와 동일 시맨틱.
    if (el.type === "TagList" && el.parent_id) {
      const parentItems = tagGroupItemsById.get(el.parent_id);
      if (parentItems && parentItems.length > 0) {
        migratedElements.push({
          ...el,
          props: {
            ...(el.props ?? {}),
            items: parentItems,
          },
        });
        continue;
      }
    }

    // ListBox 정적 모드 부모 — items[] + selectedIndex→selectedKey 변환
    if (el.type === "ListBox" && listBoxAbsorbParents.has(el.id)) {
      const lbiChildren = listBoxItemChildrenByParent.get(el.id) ?? [];
      const items = listBoxItemChildrenToItemsArray(
        lbiChildren,
        childrenByParent as Map<string, ElementLike[]>,
      );
      const nextProps: Record<string, unknown> = {
        ...(el.props ?? {}),
        items,
      };

      // legacy selectedIndex → selectedKey (canonical 없을 때만 주입)
      const rawSelectedIndex = el.props?.selectedIndex;
      if (
        typeof rawSelectedIndex === "number" &&
        typeof nextProps.selectedKey !== "string"
      ) {
        const key = items[rawSelectedIndex]?.id;
        if (key) nextProps.selectedKey = key;
      }

      // legacy selectedIndices → selectedKeys (canonical 없을 때만 주입)
      const rawSelectedIndices = el.props?.selectedIndices;
      if (
        Array.isArray(rawSelectedIndices) &&
        rawSelectedIndices.length > 0 &&
        !Array.isArray(nextProps.selectedKeys)
      ) {
        const keys = (rawSelectedIndices as unknown[])
          .map((idx) => (typeof idx === "number" ? items[idx]?.id : undefined))
          .filter((k): k is string => typeof k === "string");
        if (keys.length > 0) nextProps.selectedKeys = keys;
      }

      migratedElements.push({ ...el, props: nextProps });
      continue;
    }

    migratedElements.push(el);
  }

  return { migratedElements, orphanIds: Array.from(orphanSet) };
}

/**
 * @deprecated ADR-076 P5 이후 applyCollectionItemsMigration 사용.
 * 본 함수는 BC alias — 3종 오케스트레이터로 위임.
 */
export function applySelectComboBoxMigration<T extends ElementLike>(
  elements: T[],
): CollectionItemsMigrationResult<T> {
  return applyCollectionItemsMigration(elements);
}

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

function collectSubtreeIds<T extends ElementLike>(
  rootId: string,
  childrenByParent: Map<string, T[]>,
  target: Set<string>,
): void {
  const stack: string[] = [rootId];
  while (stack.length > 0) {
    const parentId = stack.pop()!;
    const subs = childrenByParent.get(parentId);
    if (!subs) continue;
    for (const s of subs) {
      if (target.has(s.id)) continue;
      target.add(s.id);
      stack.push(s.id);
    }
  }
}

export function selectItemChildrenToItemsArray(
  selectItemChildren: ElementLike[],
): StoredSelectItem[] {
  return selectItemChildren.map((child) => {
    const p = child.props ?? {};
    return {
      id: child.id,
      label:
        typeof p.label === "string" && p.label.length > 0 ? p.label : child.id,
      value: typeof p.value === "string" ? p.value : undefined,
      textValue: typeof p.textValue === "string" ? p.textValue : undefined,
      isDisabled: p.isDisabled === true || undefined,
      icon: typeof p.icon === "string" ? p.icon : undefined,
      description:
        typeof p.description === "string" ? p.description : undefined,
    };
  });
}

export function comboBoxItemChildrenToItemsArray(
  comboBoxItemChildren: ElementLike[],
): StoredComboBoxItem[] {
  return comboBoxItemChildren.map((child) => {
    const p = child.props ?? {};
    return {
      id: child.id,
      label:
        typeof p.label === "string" && p.label.length > 0 ? p.label : child.id,
      value: typeof p.value === "string" ? p.value : undefined,
      textValue: typeof p.textValue === "string" ? p.textValue : undefined,
      isDisabled: p.isDisabled === true || undefined,
      icon: typeof p.icon === "string" ? p.icon : undefined,
      description:
        typeof p.description === "string" ? p.description : undefined,
    };
  });
}

/**
 * ListBox 정적 모드 ListBoxItem 자식 → StoredListBoxItem[] 변환.
 * props.label 우선, 부재 시 자식 Text element(slot 없음 또는 slot!=="description")의
 * children 문자열 사용. description 은 props.description 우선, 부재 시 자식 Description
 * element 또는 Text[slot="description"] 의 children 사용.
 */
export function listBoxItemChildrenToItemsArray(
  lbiChildren: ElementLike[],
  childrenByParent: Map<string, ElementLike[]>,
): StoredListBoxItem[] {
  return lbiChildren.map((lbi) => {
    const p = lbi.props ?? {};
    const subs = childrenByParent.get(lbi.id) ?? [];

    const titleChild = subs.find((s) => {
      if (s.type !== "Text") return false;
      const slot = (s.props as { slot?: string })?.slot;
      return !slot || slot === "title" || slot === "label";
    });
    const descChild = subs.find((s) => {
      if (s.type === "Description") return true;
      if (s.type === "Text") {
        const slot = (s.props as { slot?: string })?.slot;
        return slot === "description";
      }
      return false;
    });

    const labelFromChild = extractStringChildren(titleChild);
    const descFromChild = extractStringChildren(descChild);

    return {
      id: lbi.id,
      label:
        typeof p.label === "string" && p.label.length > 0
          ? p.label
          : labelFromChild && labelFromChild.length > 0
            ? labelFromChild
            : lbi.id,
      value: typeof p.value === "string" ? p.value : undefined,
      textValue: typeof p.textValue === "string" ? p.textValue : undefined,
      isDisabled: p.isDisabled === true || undefined,
      description:
        typeof p.description === "string" ? p.description : descFromChild,
      href: typeof p.href === "string" ? p.href : undefined,
    };
  });
}

function extractStringChildren(
  el: ElementLike | undefined,
): string | undefined {
  if (!el) return undefined;
  const children = (el.props as { children?: unknown })?.children;
  return typeof children === "string" && children.length > 0
    ? children
    : undefined;
}

/**
 * ADR-097 Phase 2: TagGroup 2단 이전 migration helper.
 *
 * TagList 의 자식 Tag elements → `StoredTagItem[]` 변환.
 * Tag.children 이 label 역할 (Tag.children: string). 현재 description slot 없음 —
 * 향후 ADR-097 Addendum 1 에서 확장 시 본 함수 시그니처 확장.
 *
 * caller source order 기준 정렬. props.children 이 label source (Tag.spec.ts:25 참조).
 */
export function tagChildrenToItemsArray(
  tagChildren: ElementLike[],
): StoredTagItem[] {
  return tagChildren.map((type) => {
    const p = type.props ?? {};
    const labelFromChildren =
      typeof p.children === "string" && p.children.length > 0
        ? p.children
        : undefined;
    return {
      id: type.id,
      label: labelFromChildren ?? type.id,
      isDisabled: p.isDisabled === true || undefined,
      allowsRemoving:
        typeof p.allowsRemoving === "boolean" ? p.allowsRemoving : undefined,
    };
  });
}

/**
 * ADR-076 P5: 컬렉션 items SSOT 마이그레이션 (Select/ComboBox/ListBox 3종 공통)
 *
 * legacy element tree 를 부모 props.items 배열로 흡수하는 변환 오케스트레이터.
 * ADR-073 P5 `applySelectComboBoxMigration` 을 ListBox 포함 3종 공통으로 일반화.
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
 *
 * ⚠️ **`applyCollectionItemsMigration` family = test-only (production 호출 0)**:
 *   `applyCollectionItemsMigration` / `listBoxItemChildrenToItemsArray` /
 *   `tagChildrenToItemsArray` / `applySelectComboBoxMigration`(BC alias) 는
 *   production 경로에서 호출되지 않는다. ADR-076 시점(2026-04-18)에는
 *   `usePageManager.initializeProject` 가 element-array hydrate 시 호출했으나,
 *   ADR-116 canonical 전환(`ae79affc0`, 2026-05-02)이 hydration 을 canonical
 *   document 기반으로 바꾸면서 이 호출을 제거했다. 이후 신규 ListBox origin
 *   bootstrap 은 `ensureListBoxTemplateOrigins`(별도 경로) 가 담당한다.
 *   `usePageManager.canonical.test.ts` 가 `initFnSource).not.toMatch(
 *   /applyCollectionItemsMigration\(/)` 로 **hydration 재도입 금지**를 negative-pin 한다.
 *
 *   그럼에도 본 family 는 **ADR-076 "items SSOT decision 보존"**(ADR-145 patch
 *   재확인) 의 변환 계약을 검증하는 정당한 test 자산이다 — `migrateCollectionItems.test.ts`
 *   (ListBoxItem 자식→items[] 흡수 / Text·Description 직렬화 / idempotency / TagGroup
 *   2단 이전) + `migrateSelectComboBoxItems.test.ts` 가 SUT 로 사용한다.
 *   production reachable 0 만 보고 dead 로 제거하지 말 것 (ADR-912 단계5
 *   `resolveComponentVisual` test-only 와 동형).
 */
import type { StoredSelectItem, StoredComboBoxItem, StoredListBoxItem, StoredTagItem } from "@composition/specs";
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
export type SelectComboBoxMigrationResult<T extends ElementLike> = CollectionItemsMigrationResult<T>;
/**
 * 컬렉션 items 흡수 오케스트레이터 (ADR-076 P5).
 *
 * 입력 elements 로부터 Select/ComboBox/ListBox 부모의 Item 자식을 수집하여
 * `items[]` 배열로 변환, 부모 props 에 주입한다. 흡수된 자식은 `orphanIds` 로 분리 반환.
 *
 * legacy element-array hydration 계약(현재 production 미호출 — 파일 헤더 참조):
 *  1. `migratedElements` 로 store hydrate (자식 제거 + 부모 props.items 병합)
 *  2. `orphanIds` 로 IDB `deleteMany` 수행 (영속 정리)
 *
 * 제네릭 T 로 호출 측의 실제 Element 타입을 보존 (추가 필드 유지).
 */
export declare function applyCollectionItemsMigration<T extends ElementLike>(elements: T[]): CollectionItemsMigrationResult<T>;
/**
 * @deprecated ADR-076 P5 이후 applyCollectionItemsMigration 사용.
 * 본 함수는 BC alias — 3종 오케스트레이터로 위임.
 */
export declare function applySelectComboBoxMigration<T extends ElementLike>(elements: T[]): CollectionItemsMigrationResult<T>;
export declare function selectItemChildrenToItemsArray(selectItemChildren: ElementLike[]): StoredSelectItem[];
export declare function comboBoxItemChildrenToItemsArray(comboBoxItemChildren: ElementLike[]): StoredComboBoxItem[];
/**
 * ListBox 정적 모드 ListBoxItem 자식 → StoredListBoxItem[] 변환.
 * props.label 우선, 부재 시 자식 Text element(slot 없음 또는 slot!=="description")의
 * children 문자열 사용. description 은 props.description 우선, 부재 시 자식 Description
 * element 또는 Text[slot="description"] 의 children 사용.
 */
export declare function listBoxItemChildrenToItemsArray(lbiChildren: ElementLike[], childrenByParent: Map<string, ElementLike[]>): StoredListBoxItem[];
/**
 * ADR-097 Phase 2: TagGroup 2단 이전 migration helper.
 *
 * TagList 의 자식 Tag elements → `StoredTagItem[]` 변환.
 * Tag.children 이 label 역할 (Tag.children: string). 현재 description slot 없음 —
 * 향후 ADR-097 Addendum 1 에서 확장 시 본 함수 시그니처 확장.
 *
 * caller source order 기준 정렬. props.children 이 label source (Tag.spec.ts:25 참조).
 */
export declare function tagChildrenToItemsArray(tagChildren: ElementLike[]): StoredTagItem[];
export {};
//# sourceMappingURL=migrateCollectionItems.d.ts.map
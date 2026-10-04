/**
 * GridList Items SSOT — Stored/Runtime 인터페이스 분리 (ADR-099 Phase 5)
 *
 * rendering 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → rendering (단방향)
 *
 * ADR-073 select-items.ts / combobox-items.ts 와 1:1 정합.
 * ADR-099 Phase 5 (GridList/Menu 대칭): Phase 1 ListBox items 패턴 복제.
 *
 * GridList 는 카드형 선택 UI (S2 SelectBoxGroup 통합) — 현재 items props 는
 * `GridListItem` interface (label/description) 였으나, Section/Header 지원을 위해
 * `StoredGridListSection` + `StoredGridListEntry` discriminated union 추가.
 * 기존 `StoredGridListItem` (discriminator 미보유) 는 default "item" 으로 해석 (BC 0%).
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredGridListItem {
  id: string;
  label: string;
  description?: string;
  /** 검색 가능한 텍스트 (RAC `textValue`) */
  textValue?: string;
  isDisabled?: boolean;
  /**
   * ADR-099 discriminator. 미지정 시 "item" 으로 해석 (기존 프로젝트 BC 보존).
   * 명시 시 `"item"` 만 허용 (section 엔트리와 구분용).
   */
  type?: "item";
}

/**
 * ADR-099 Phase 5: RAC `GridListSection` + `<Header>` 대응.
 *
 * items 배열 내부 discriminated union 엔트리. LayerTree element tree 변경 없음 —
 * items-manager UI 에서 "Section 추가" 직렬화 + 렌더 시 Header shape + 내부 items flat 전개.
 */
export interface StoredGridListSection {
  id: string;
  type: "section";
  /** 표시 텍스트 (RAC `<Header>` 자식 텍스트 대응) */
  header: string;
  /** 섹션 내부 items — nested section 미지원 (RAC 단일 level) */
  items: StoredGridListItem[];
  /** 섹션 자체 aria-label (header 없는 경우 RAC 에서 필수) */
  ariaLabel?: string;
}

/**
 * ADR-099 Phase 5: items 배열 엔트리 union.
 *
 * 기존 저장 프로젝트 items 엔트리는 `type` 미지정 → `StoredGridListItem` 로 해석.
 * 신규 프로젝트가 "Section 추가" 선택 시 `StoredGridListSection` 엔트리 삽입.
 */
export type StoredGridListEntry = StoredGridListItem | StoredGridListSection;

/** Runtime 모델 — RAC `<GridList items>{...}` 호출 직전 CollectionRenderers 에서 변환 */
export interface RuntimeGridListItem extends StoredGridListItem {
  /** items 배열 내 위치 (0-based). selectedIndex legacy 변환에 사용 */
  index: number;
}

/**
 * Stored → Runtime 변환 (개별 item)
 * @param stored 저장 모델
 * @param index items 배열 내 위치
 */
export function toRuntimeGridListItem(
  stored: StoredGridListItem,
  index: number,
): RuntimeGridListItem {
  return { ...stored, index };
}

/**
 * ADR-099 Phase 5: Type guard — entry 가 section 엔트리인지 판별.
 *
 * 기존 `StoredGridListItem` (type 미지정) 는 false 반환 → default "item" 해석 (BC 0%).
 */
export function isGridListSectionEntry(
  entry: StoredGridListEntry,
): entry is StoredGridListSection {
  return (entry as StoredGridListSection).type === "section";
}

/**
 * ListBox Items SSOT — Stored/Runtime 인터페이스 분리 (ADR-076 P1)
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-073 select-items.ts / combobox-items.ts 와 1:1 정합.
 * ListBox 는 onAction 연동 미사용 (정적 모드 = 선택만, 템플릿 모드 = Field 자식 렌더) →
 * onActionId/onAction 필드는 포함하지 않음. 향후 필요 시 Select/ComboBox 선례로 확장 가능.
 *
 * ADR-099 Phase 1 (098-c 슬롯): Section/Header 확장을 위해 `StoredListBoxSection` +
 * `StoredListBoxEntry` discriminated union 추가. 기존 `StoredListBoxItem` 은
 * discriminator `type` 필드 미보유 → default "item" 으로 해석 (BC 0%).
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredListBoxItem {
  id: string;
  label: string;
  value?: string;
  /** 검색 가능한 텍스트 (RAC `textValue`) */
  textValue?: string;
  isDisabled?: boolean;
  /** 항목 부가 설명 (Text slot="description" 대응) */
  description?: string;
  /** ADR-147: icon slot — lucide icon name (RAC decorative icon child 대응). */
  icon?: string;
  /** 링크 항목용 (RAC `<ListBoxItem href>`) */
  href?: string;
  /**
   * ADR-099 discriminator. 미지정 시 "item" 으로 해석 (기존 프로젝트 BC 보존).
   * 명시 시 `"item"` 만 허용 (section 엔트리와 구분용).
   */
  type?: "item";
}

/**
 * ADR-099 Phase 1 (098-c 슬롯): RAC `ListBoxSection` + `<Header>` 대응.
 *
 * items 배열 내부 discriminated union 엔트리. LayerTree element tree 변경 없음 —
 * items-manager UI 에서 "Section 추가" 직렬화 + 렌더 시 Header shape + 내부 items flat 전개.
 */
export interface StoredListBoxSection {
  id: string;
  type: "section";
  /** 표시 텍스트 (RAC `<Header>` 자식 텍스트 대응) */
  header: string;
  /** 섹션 내부 items — nested section 미지원 (RAC 단일 level) */
  items: StoredListBoxItem[];
  /** 섹션 자체 aria-label (header 없는 경우 RAC 에서 필수) */
  ariaLabel?: string;
}

/**
 * ADR-099 Phase 1: items 배열 엔트리 union.
 *
 * 기존 저장 프로젝트 items 엔트리는 `type` 미지정 → `StoredListBoxItem` 로 해석.
 * 신규 프로젝트가 "Section 추가" 선택 시 `StoredListBoxSection` 엔트리 삽입.
 */
export type StoredListBoxEntry = StoredListBoxItem | StoredListBoxSection;

/** Runtime 모델 — RAC `<ListBox items>{...}` 호출 직전 SelectionRenderers 에서 변환 */
export interface RuntimeListBoxItem extends StoredListBoxItem {
  /** items 배열 내 위치 (0-based). selectedIndex legacy 변환에 사용 */
  index: number;
}

/**
 * Stored → Runtime 변환 (개별 item)
 * @param stored 저장 모델
 * @param index items 배열 내 위치
 */
export function toRuntimeListBoxItem(
  stored: StoredListBoxItem,
  index: number,
): RuntimeListBoxItem {
  return { ...stored, index };
}

/**
 * ADR-099 Phase 1: Type guard — entry 가 section 엔트리인지 판별.
 *
 * 기존 `StoredListBoxItem` (type 미지정) 는 false 반환 → default "item" 해석 (BC 0%).
 */
export function isListBoxSectionEntry(
  entry: StoredListBoxEntry,
): entry is StoredListBoxSection {
  return (entry as StoredListBoxSection).type === "section";
}

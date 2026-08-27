/**
 * Menu Items SSOT — Stored/Runtime 인터페이스 분리
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-099 Phase 5 (Menu 대칭): Section/Separator entry union 추가.
 * - `StoredMenuSection`: per-section selection (RAC 공식 지원)
 * - `StoredMenuSeparator`: horizontal divider (RAC 수동 삽입 대응)
 * - `StoredMenuEntry = StoredMenuItem | StoredMenuSection | StoredMenuSeparator` union
 * 기존 `StoredMenuItem` (discriminator 미보유) 는 default "item" 으로 해석 (BC 0%).
 *
 * @packageDocumentation
 */

/**
 * Store 직렬화 모델 — JSON 직렬화 가능.
 *
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId` (EVENT_REGISTRY 참조 id) 는
 * 제거됐다 — event-id 채널이 실행 경로 없는 dead seam (preview `resolveActionId`
 * 상시 undefined). 항목 → 페이지 이동은 `href` 가 정식 경로 (RAC MenuItem href).
 * 항목 단위 커맨드가 필요해지면 인터랙션 규칙에 itemKey 매칭을 확장한다
 * (dispatcher 가 callback 인자를 전달하도록 여는 것이 전제 — bindings.ts 참조).
 */
export interface StoredMenuItem {
  id: string;
  label: string;
  isDisabled?: boolean;
  icon?: string;
  shortcut?: string;
  description?: string;
  value?: string;
  textValue?: string;
  href?: string;
  /** 서브메뉴 (재귀) */
  children?: StoredMenuItem[];
  /**
   * ADR-099 discriminator. 미지정 시 "item" 으로 해석 (기존 프로젝트 BC 보존).
   * 명시 시 `"item"` 만 허용.
   */
  type?: "item";
}

/**
 * ADR-099 Phase 5: RAC `MenuSection` + `<Header>` 대응.
 *
 * per-section selection 필드 3개 (RAC 공식 지원).
 * items 배열 내부 discriminated union 엔트리.
 */
export interface StoredMenuSection {
  id: string;
  type: "section";
  /** 표시 텍스트 (RAC `<Header>` 자식 텍스트 대응) */
  header: string;
  /** 섹션 내부 items — nested section 미지원 (RAC 단일 level) */
  items: StoredMenuItem[];
  /** 섹션 자체 aria-label (header 없는 경우 RAC 에서 필수) */
  ariaLabel?: string;
  /** per-section selection mode (RAC 공식 지원) */
  selectionMode?: "none" | "single" | "multiple";
  /** per-section selected keys */
  selectedKeys?: string[];
  /** per-section default selected keys */
  defaultSelectedKeys?: string[];
}

/**
 * ADR-099 Phase 5: Menu Separator — horizontal divider.
 *
 * RAC Menu 수동 삽입 대응 — `<Separator>` 컴포넌트 (1px height, neutral-subdued 색상).
 */
export interface StoredMenuSeparator {
  id: string;
  type: "separator";
}

/**
 * ADR-099 Phase 5: items 배열 엔트리 union.
 *
 * 기존 저장 프로젝트 items 엔트리는 `type` 미지정 → `StoredMenuItem` 로 해석.
 */
export type StoredMenuEntry =
  StoredMenuItem | StoredMenuSection | StoredMenuSeparator;

/** Runtime 모델 — RAC `<Menu items>{...}` 호출 직전 CollectionRenderers에서 변환 */
export interface RuntimeMenuItem extends Omit<
  StoredMenuItem,
  "children" | "type"
> {
  children?: RuntimeMenuItem[];
}

/**
 * ADR-099 Phase 5: Type guard — entry 가 section 엔트리인지 판별.
 *
 * 기존 `StoredMenuItem` (type 미지정) 는 false 반환 → default "item" 해석 (BC 0%).
 */
export function isMenuSectionEntry(
  entry: StoredMenuEntry,
): entry is StoredMenuSection {
  return (entry as StoredMenuSection).type === "section";
}

/**
 * ADR-099 Phase 5: Type guard — entry 가 separator 엔트리인지 판별.
 */
export function isMenuSeparatorEntry(
  entry: StoredMenuEntry,
): entry is StoredMenuSeparator {
  return (entry as StoredMenuSeparator).type === "separator";
}

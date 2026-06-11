/**
 * builderAliasMap — Builder UI alias → 정본 Spec 매핑 (ADR-108 P0)
 *
 * packages/specs 의 `BASE_TAG_SPEC_MAP` (정본 102 entries) 에 존재하지 않는
 * Builder UI 전용 type 들이 정본 spec 을 share 하도록 alias 계층을 분리 정의한다.
 *
 * 배경:
 *   - Canvas / Preview / Panel / Publish 4 consumer 가 `@composition/specs` 의
 *     정본 TAG_SPEC_MAP 을 공유하도록 ADR-108 P0 에서 통합.
 *   - Builder 는 Compositional Architecture 편의 상 ComboBox/SearchField 의 내부
 *     DOM slot 을 별도 type 로 취급 (ComboBoxWrapper 등) — 이 type 들은 RAC 공식
 *     구조 외 composition 고유 D3 element 이므로 정본 spec 이 존재하지 않는다.
 *   - 각 alias 는 대응되는 정본 spec 을 lookup 하여 동일 D3 시각 결과 산출.
 *
 * alias 정책 (ADR-108 r5 R2):
 *   - alias 자체는 `containerVariants` 보유 0 (CSS 미생성).
 *   - 정본 spec 의 variant 를 alias 가 share — Canvas/Panel 소비 시 alias → 정본
 *     spec lookup 후 `resolveContainerVariants` 호출.
 *
 * IMAGE_TAGS 와의 분리:
 *   - 본 파일은 "Spec 공유 alias" 만 정의 (BC 직렬화 type 보존 목적).
 *   - 이미지 렌더링 대상 (Avatar/Logo/Thumbnail 등) 은 sprites/tagSpecMap.ts
 *     의 `IMAGE_TAGS` 유지.
 */

import type { ComponentSpec } from "@composition/specs";
import {
  SelectTriggerSpec,
  SelectValueSpec,
  SelectIconSpec,
  BodySpec,
} from "@composition/specs";

/**
 * 8 진짜 alias — ADR-108 r5 P0 분류 (ADR-912 4단계: TabBar BC alias 제거):
 *
 * ComboBox 계열 (3): ADR-101 Compositional Architecture 고유 element
 *   - ComboBoxWrapper → SelectTriggerSpec (field 컨테이너 시각)
 *   - ComboBoxInput   → SelectValueSpec   (값 표시 시각)
 *   - ComboBoxTrigger → SelectIconSpec    (chevron 아이콘 시각)
 *
 * SearchField 계열 (4): ADR-102 SelectIcon 4 type 공유 정책
 *   - SearchFieldWrapper → SelectTriggerSpec
 *   - SearchInput        → SelectValueSpec
 *   - SearchIcon         → SelectIconSpec
 *   - SearchClearButton  → SelectIconSpec
 *
 * body (1): 페이지 루트 lowercase 규약 alias
 *
 * **ADR-912 4단계 (2026-06-11)**: TabBar(Switcher 구명 BC alias) 제거. live producer 0건
 * (factory/specs 전수 grep) → 신규 생성 경로 없음. 과거 직렬화 TabBar 노드는 canonical
 * hydration 시 tagToType("TabBar") → "Switcher" 1회 정규화로 흡수
 * (adapters/canonical/tagRename.ts isLegacyTabBarForSwitcher). 잔여 7 sub-part alias
 * (ComboBox / Search 계열)는 참조 spec(SelectTrigger/Value/Icon) catalog 미전환(cutover=false)
 * 이라 spec 객체가 load-bearing → 즉시 제거 불가(별도 slice: sub-part catalog 전환 선행).
 * body 도 Skia 는 catalog rule 이나 Style 패널 소비처가 spec 직접 의존 → 별도 slice.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BUILDER_ALIAS_MAP: Record<string, ComponentSpec<any>> = {
  ComboBoxWrapper: SelectTriggerSpec,
  ComboBoxInput: SelectValueSpec,
  ComboBoxTrigger: SelectIconSpec,
  SearchFieldWrapper: SelectTriggerSpec,
  SearchInput: SelectValueSpec,
  SearchIcon: SelectIconSpec,
  SearchClearButton: SelectIconSpec,
  // ADR-902 후속: 페이지 루트 element.type 가 lowercase "body" 로 저장되지만
  // BASE_TAG_SPEC_MAP 은 PascalCase 규약이므로 Builder 측에 lowercase alias 로 노출.
  // getSpecForTag("body") → BodySpec 해석되어 Skia spec 경로 진입.
  body: BodySpec,
};

/**
 * builderAliasMap — Builder UI alias → 정본 Spec 매핑 (ADR-108 P0)
 *
 * packages/specs 의 `BASE_TAG_SPEC_MAP` 에 존재하지 않는 Builder UI 전용 type 이
 * 정본 spec 을 share 하도록 alias 계층을 분리 정의한다.
 *
 * **ADR-912 R1 Select family rebuild (2026-06-12)**: ComboBox 계열 3
 * (ComboBoxWrapper/Input/Trigger) + SearchField 계열 4 (SearchFieldWrapper/Input/
 * Icon/ClearButton) alias 전수 제거 — factory 가 자식을 Select family 공용 type
 * (SelectTrigger/SelectValue/SelectIcon, catalog cutover) 으로 직접 생성하도록
 * retype 되어 alias 가 가리키던 synthetic type 의 live producer 가 0건이 됨.
 * 개발 단계라 BC hydration migration 없이 단순 제거 (Switcher/TabBar 선례,
 * `0c60d/2b0bb`). SelectTrigger/Value/Icon spec 자체도 같은 slice 에서 삭제
 * (rule table + buildCatalogShapes generic + icon_font escape 로 이전).
 *
 * ADR-912 단계5 step4 (2026-06-17): body alias 제거 — BodySpec 물리 삭제. body 는 catalog
 * cutover(FAMILY_1_CUTOVER, isCatalogSkiaCutover("body")=true) 로 buildSpecNodeData 게이트
 * (`if(!spec && !isCatalogSkiaCutover) return null`)가 spec 부재를 흡수하고 generic box(catalog
 * rule.body fill {color.base}) 로 그린다. Style 패널 소비처(specPresetResolver)는 spec?.sizes
 * optional chaining 으로 빈 preset degrade(height/padding 0 = auto marker 라 무영향),
 * useElementStyleContext 는 body 가 ref 아니라 element.type 직접 반환 경로(spec lookup 미경유).
 * → alias 불요. BUILDER_ALIAS_MAP 메커니즘 자체는 향후 alias 위해 보존(빈 맵).
 */

import type { ComponentSpec } from "@composition/specs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BUILDER_ALIAS_MAP: Record<string, ComponentSpec<any>> = {};

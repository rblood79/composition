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
 * 잔여 1 — body: 페이지 루트 lowercase 규약 alias. Skia 는 catalog rule 경로지만
 * Style 패널 소비처가 spec 직접 의존 → 별도 slice 에서 해소.
 */

import type { ComponentSpec } from "@composition/specs";
import { BodySpec } from "@composition/specs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BUILDER_ALIAS_MAP: Record<string, ComponentSpec<any>> = {
  // ADR-902 후속: 페이지 루트 element.type 가 lowercase "body" 로 저장되지만
  // BASE_TAG_SPEC_MAP 은 PascalCase 규약이므로 Builder 측에 lowercase alias 로 노출.
  // getSpecForTag("body") → BodySpec 해석되어 Skia spec 경로 진입.
  body: BodySpec,
};

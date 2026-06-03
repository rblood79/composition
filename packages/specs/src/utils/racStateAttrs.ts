/**
 * ADR-912 단계 3 — RAC state vocabulary → ComponentState derive (HC#6).
 *
 * RAC 가 DOM 에 emit 하는 `data-*` 상호작용 vocabulary(`data-disabled` / `data-hovered` /
 * `data-pressed` / `data-focus-visible`)를 Skia 렌더가 소비하는 `ComponentState` 로 환원한다.
 * 두 backend(DOM=data-* CSS / Skia=ComponentState)가 **같은 theme rule[state]** 를 base 로
 * 쓰게 만드는 단일 변환점 — DOM/Skia state parity 의 메커니즘.
 *
 * **selection 직교성**: `ComponentState` 타입은 selection 을 포함하지 않는다(default/hover/
 * pressed/focused/focusVisible/disabled). RAC `data-selected`(ToggleButton 류 런타임 selection)
 * 는 `buildCatalogShapes` 가 `props.isSelected`/`props.isEmphasized` 로 **직교 차원**에서 직접
 * 처리하므로 본 함수 밖이다. 빌더 에디터 selection(selectedElementIds)도 별개(overlay outline).
 *
 * **단계 3 scope (사용자 결정 2026-06-03 "selection·disabled 먼저, hover·pressed 후속")**:
 * `disabled` 만 우선 derive(pointer hot path 아님 — props 변경 시 자연 scene rebuild). hover/
 * pressed/focusVisible 는 interaction 입력 자리만 두고 후속 단계에서 활성화(매 pointermove 가
 * sceneVersion signature 를 유발하는 ADR-136 §9 충돌 + 60fps 성능 정밀화 필요).
 */

import type { ComponentState } from "../types";

/**
 * RAC 상호작용 상태 입력 — builder 측 interaction 추적값을 backend-중립으로 추상화.
 *
 * specs 는 builder 를 import 하지 못하므로(`specs ← shared ← builder` 경계), 각 채널을
 * plain boolean 으로 받는다. caller(buildSpecNodeData)가 hoveredId/pressedId/focusedId 와
 * 노드 id 를 비교해 boolean 으로 평탄화한 뒤 전달한다.
 */
export interface RacStateInput {
  /** props.isDisabled / 부모 disabled 전파 (RAC `data-disabled`). */
  isDisabled?: boolean;
  /** interaction.hoveredId === nodeId (RAC `data-hovered`). 단계 3 후속. */
  isHovered?: boolean;
  /** interaction.pressedId === nodeId (RAC `data-pressed`). 단계 3 후속. */
  isPressed?: boolean;
  /** interaction.focusedId === nodeId (RAC `data-focus-visible`). 단계 3 후속. */
  isFocusVisible?: boolean;
}

/**
 * RAC `data-*` → `ComponentState`.
 *
 * 우선순위(RAC 시각 규칙): disabled > pressed > hover > focusVisible > default.
 * disabled 는 다른 상호작용을 가린다(비활성 요소는 hover/press 시각 미적용).
 *
 * 단계 3 은 `disabled` 만 실효 — hover/pressed/focusVisible 입력은 현재 caller 가
 * 항상 false 로 전달(후속 단계에서 interaction threading 활성화). 우선순위 로직은
 * 미리 확정해 두어 후속 단계가 입력 평탄화만 추가하면 되도록 한다.
 */
export function racStateAttrs(input: RacStateInput): ComponentState {
  if (input.isDisabled) return "disabled";
  if (input.isPressed) return "pressed";
  if (input.isHovered) return "hover";
  if (input.isFocusVisible) return "focusVisible";
  return "default";
}

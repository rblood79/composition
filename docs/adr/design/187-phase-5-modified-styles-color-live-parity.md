# ADR-187 Phase 5 — Modified Styles color live parity

## 범위

`StylesPanel`의 `Modified` 필터가 `Typography`/`Appearance` 본문과 달리
`useOptimizedStyleActions.updateStylePreview`로 직접 진입하던 누락을 닫았다.
`borderColor`는 border presentation owner, `color`는 현재 검증된 `Text`/`Button`
text-root owner를 사용한다. `backgroundColor`는 Fill V2 파생 스타일이므로 기존
read-only/fail-closed 경계를 유지한다.

ColorField/ColorPicker shell, multi-child inherited subtree, indicator-only
Checkbox/Radio/Switch, 기타 미검증 component root는 자동 descendant fan-out을 하지
않고 canonical/legacy 경로에 남긴다.

## 구현 계약

- `ModifiedStylesSection`이 `useStylePresentationActions`를 사용한다.
- owner가 획득되면 `preview/commit/cancel`이 typed transaction으로만 실행되고,
  `updateStylePreview`/`updateStyle`는 fallback으로 실행되지 않는다.
- owner를 획득하지 못한 대상은 기존 fallback을 유지한다.
- `ColorPickerPanel`의 frame scheduling ownership은 기존
  `presentationOwnsFrameScheduling` 계약을 그대로 소비한다.

## Builder live evidence

실행: `/private/tmp/adr187-phase5-modified-color-live.mjs`

- 실제 Builder에서 Button(`220×120`, `#112233`)을 생성하고 `Style → Modify` 필터의
  `Color` picker를 열어 ColorArea를 drag했다.
- drag 중 canonical color는 `#112233`로 유지되고, terminal 뒤 `#297ACC`로 1회
  handoff됐다.
- terminal Preview는 `rgb(41, 122, 204)`, border color는
  `rgb(34, 51, 68)`, rect는 `x=110, y=70, width=220, height=120`으로 유지됐다.
- action/control RAF `0/0`, legacy write `0`, console error/warning `0/0`.
- presentation delta message는 drag 중 `+9`, target incremental patch는 terminal
  포함 `60`, terminal event `1`이었다.
- screenshot: `/private/tmp/adr187-phase5-modified-color-live.png`

## 검증

- focused gate: 2 files / 23 tests PASS
- 이후 전체 Phase 5 관련 gate와 `codex:preflight`를 재실행한다.

## 남은 Phase 5 범위

element-level opacity UI, multi-child inherited/component color, 미검증 text root,
layout allowlist 확대, text metrics/resource, structure는 각각 별도 materialization
또는 G6 조건이 필요하므로 이번 slice에서 자동 이행하지 않는다.

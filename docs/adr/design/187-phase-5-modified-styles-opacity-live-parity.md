# ADR-187 Phase 5 — Modified Styles opacity live parity

## 범위

`Modified Styles`에 이미 표시되는 명시적 `style.opacity` 입력을 typed
presentation owner로 연결했다. Skia opacity effect가 materialize된 `0..1` unitless
값만 연속 paint lane으로 열고, effect가 없거나 상태/상속 opacity인 경우는
기존 commit/legacy 경로에 남긴다.

## 구현 계약

- `PANEL_STYLE_PROPS`와 Appearance reset union에 `opacity`를 포함해 modified count와
  reset baseline을 일치시킨다.
- `useStylePresentationActions`가 `begin/publish/finish/cancel`을 소유하며,
  `ModifiedStylesSection`의 opacity 입력은 owner가 있을 때 `updateStylePreview`를
  호출하지 않는다.
- Skia는 기존 `opacity` effect object의 `value`만 patch하고, Preview는 semantic
  `style.patch.opacity`만 얕게 병합한다.
- opacity 값이 `1`이라 effect slot이 없거나 상태 opacity와 충돌할 수 있는 대상은
  fail-closed한다.

## Builder live evidence

실행: `/private/tmp/adr187-phase5-opacity-live.mjs`

- 실제 Builder에서 `Button`(`220×120`, 명시적 opacity `0.5`)을 생성하고
  `Style → Modify → Modified Styles → Opacity` 입력에서 ArrowDown drag를 수행했다.
- drag 중 canonical style은 `0.5`로 유지되고 Preview opacity는 `0`으로 반영됐다.
- terminal 뒤 canonical style과 Preview opacity가 `0`으로 수렴했다.
- drag 전/중/후 Preview rect는 모두 `x=110, y=70, width=220, height=120`으로
  불변이었다.
- action/control RAF `0/0`, legacy write `0`, console error/warning `0/0`이었다.
- drag 중 Preview delta message `+1`, frame apply `+1`이 기록됐다.
- screenshot: `/private/tmp/adr187-phase5-opacity-live.png`

## 검증

- focused gate: 6 files / 119 tests PASS
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 위반 없음
- `git diff --check`: PASS

## 남은 Phase 5 범위

default opacity `1`의 effect materialization, inherited/state opacity, multi-child
inherited/component color, 미검증 component root, layout allowlist 확대, text
metrics/resource와 structure는 이번 explicit Modified Styles slice에 포함하지 않는다.

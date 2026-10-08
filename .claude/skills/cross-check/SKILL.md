---
name: cross-check
description: Canvas와 Preview의 시각 차이를 조사하거나 catalog·렌더러 변경의 정합성을 검증할 때 사용.
user-invocable: true
---

# Canvas ↔ Preview 정합성

Canvas(Skia)와 Preview(DOM/CSS)는 catalog + theme/tokens의 대등한 소비자입니다.
구현 방식이 아니라 동일한 입력에서의 시각 결과를 비교합니다.
[SSOT 경계](../../rules/ssot-hierarchy.md)와 [렌더링 버그 수정 원칙](../../rules/canvas-rendering.md)
§0 (원칙 전문 · 금지 패턴) 을 따릅니다.

## 변경 경로

영향받은 컴포넌트와 상태를 정하고 catalog 정의·origin template → CSS/DOM·Skia 소비 경로를 대조합니다. 구체적인 파일과 확인 항목은
[레이어 참조](references/layers.md)에서 해당 부분만 읽습니다.
스타일 패널을 건드렸다면 저장한 값이 양쪽 renderer에 도달하는지도 확인합니다.
변경이 family (field · toggle · picker 등) 에 닿으면 영향받은 컴포넌트마다 반복합니다 —
한 컴포넌트의 PASS 를 family 로 확대하지 않습니다.

모든 컴포넌트는 catalog 경로입니다 — Frame/Group/Slot 도 `COMPONENT_RULES_TABLE` 의
`frame` · `Group` · `Slot` 키 (spec 파일 없음, ADR-248). 고정 색·opacity·크기 예시를 정본보다 우선하지 않습니다.

## 실제 검증

- `COMPONENT_RULES_TABLE` 의 variant 색상·CSS 에 닿는 값이 바뀌었으면 `pnpm generate:css` 후 확인합니다
  (generated CSS 는 build-time 주입). dist 는 없습니다 — `@composition/rendering` · `@composition/shared` 는 소스 직접 export.
- 현재 dev 서버·탭과 사용 가능한 브라우저 도구를 사용합니다. 렌더 측정은 foreground나
  활성 RAF 환경에서 수행합니다. 고정 포트·과거 store 조작 예제를 가정하지 않습니다.
- 같은 fixture·viewport·theme·상태에서 Canvas와 Preview를 비교하고 필요하면 패널 값도 대조합니다.
  판정표의 한 행은 양쪽을 **같은 production 상태**에서 잰 값이어야 합니다 — 상태가 다른 두 값을
  설명문으로 제외하면 검증이 빕니다.
- 자동 비교는 ADR-248 G3 하니스 (`apps/builder/vitest.adr248-g3.browser.config.ts`, 새 Canvas↔DOM 과
  옛 앱 기준선) 입니다. ADR-198 visual-parity smoke 는 옛 Skia 경로와 함께 지워졌습니다 (ADR-248 Phase 4e).
  하니스 PASS 를 전체 시각 동일성으로 확대하지 않습니다.

## 판정 함정

- Canvas↔DOM 의 차이는 pixelmatch (임계 0.1) 로 잽니다. raw RGB 1채널 차이 카운트는 같은
  rasterizer 의 전후 비교에만 씁니다.
- DOM leg 은 shared CSS 만이 아니라 Preview 가 주입하는 전역 reset 까지 실어야 production 입니다.
  빠지면 가짜 격차가 「별도 작업」 으로 문서를 떠돕니다.
- Compare Mode 는 캔버스를 반폭으로 줄여 면적 변화를 지웁니다. 픽셀 측정은 Compare Mode 를 끄고 합니다.
- G3 승인 쌍은 변경이 쓸고 간 영역만 귀속합니다. old∪new 상자 전체를 귀속하면 상자 안의 칠 변화가
  PASS 로 가려집니다. 판정기를 바꿨으면 원복 RED 로 판정기 자체를 확인합니다.

불일치는 컴포넌트·상태·소비 경로·재현 근거로 보고합니다. 수정이 요청 범위에 있으면
정본에서 해결하고 영향받은 검사만 다시 실행합니다. 검증만 요청되면 보고까지 수행합니다.

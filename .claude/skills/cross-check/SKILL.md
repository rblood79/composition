---
name: cross-check
description: Canvas와 Preview의 시각 차이를 조사하거나 catalog·렌더러 변경의 정합성을 검증할 때 사용.
user-invocable: true
---

# Canvas ↔ Preview 정합성

Canvas(Skia)와 Preview(DOM/CSS)는 catalog + theme/tokens의 대등한 소비자입니다.
구현 방식이 아니라 동일한 입력에서의 시각 결과를 비교합니다.
[SSOT 경계](../../rules/ssot-hierarchy.md)를 따릅니다.

## 변경 경로

영향받은 컴포넌트와 상태를 정하고 catalog 정의·origin template → CSS/DOM·Skia 소비 경로를 대조합니다. 구체적인 파일과 확인 항목은
[레이어 참조](references/layers.md)에서 해당 부분만 읽습니다.
스타일 패널을 건드렸다면 저장한 값이 양쪽 renderer에 도달하는지도 확인합니다.

모든 컴포넌트는 catalog 경로입니다 — Frame/Group/Slot 도 `COMPONENT_RULES_TABLE` 의
`frame` · `Group` · `Slot` 키 (spec 파일 없음, ADR-248). 고정 색·opacity·크기 예시를 정본보다 우선하지 않습니다.

## 실제 검증

- `COMPONENT_RULES_TABLE` 의 variant 색상·CSS 에 닿는 값이 바뀌었으면 `pnpm generate:css` 후 확인합니다
  (generated CSS 는 build-time 주입). dist 는 없습니다 — `@composition/rendering` · `@composition/shared` 는 소스 직접 export.
- 현재 dev 서버·탭과 사용 가능한 브라우저 도구를 사용합니다. 렌더 측정은 foreground나
  활성 RAF 환경에서 수행합니다. 고정 포트·과거 store 조작 예제를 가정하지 않습니다.
- 같은 fixture·viewport·theme·상태에서 Canvas와 Preview를 비교하고 필요하면 패널 값도 대조합니다.
- 자동 비교는 ADR-248 G3 하니스 (`apps/builder/vitest.adr248-g3.browser.config.ts`, 새 Canvas↔DOM 과
  옛 앱 기준선) 입니다. ADR-198 visual-parity smoke 는 옛 Skia 경로와 함께 지워졌습니다 (ADR-248 Phase 4e).
  하니스 PASS 를 전체 시각 동일성으로 확대하지 않습니다.

불일치는 컴포넌트·상태·소비 경로·재현 근거로 보고합니다. 수정이 요청 범위에 있으면
정본에서 해결하고 영향받은 검사만 다시 실행합니다. 검증만 요청되면 보고까지 수행합니다.

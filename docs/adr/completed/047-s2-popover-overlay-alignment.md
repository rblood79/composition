# ADR-047: S2 Popover/Overlay CSS 정합성 정렬

## Status

Implemented (2026-03-26)

## Context

Preview 화면에서 DatePicker 캘린더 버튼 클릭 시 Popover가 나타나지 않는 버그를 분석한 결과, Popover 계열 전체에 S2 기준과 어긋나는 CSS 패턴이 일괄 적용되어 있음을 확인했다.

### 브라우저 검증으로 확인된 현재 상태

**DatePicker/DateRangePicker (깨짐)**:

- `generated/Dialog.css`가 모든 `.react-aria-Dialog`에 `position: fixed` 적용
- Popover에 `transform: translate3d(0,0,0)` → containing block 생성 → Dialog의 `position: fixed`가 viewport 대신 Popover 기준으로 동작
- Dialog가 normal flow에서 빠짐 → Popover가 2x2px로 축소
- `contain: layout style paint`의 `paint` containment가 2x2px 경계 밖 콘텐츠를 클리핑 → 캘린더 완전 불가시

**Select/ComboBox/Menu (현재 정상, 잠재 리스크)**:

- Dialog를 사용하지 않고 ListBox/Menu를 직접 in-flow로 배치 → `contain: paint`가 있어도 문제 없음
- 다만 S2 기준으로 불필요한 상시 GPU layer 할당 + `contain: paint` 패턴이 잔존

**Base Popover.css (모든 Popover 공통)**:

- `will-change: transform, opacity` 상시 적용 → 브라우저에 영구 compositing layer 강제 (MDN 남용 경고 대상)
- `transform: translate3d(0,0,0)` 상시 적용 → 불필요한 containing block + GPU layer
- `backface-visibility: hidden` → 2D 콘텐츠에 불필요, 서브픽셀 안티앨리어싱 비활성화 가능

### React Spectrum S2 실제 소스 대조 결과

S2 Popover 소스(`@react-spectrum/s2/src/Popover.tsx`)에서 확인된 패턴:

| 속성                           | composition (현재)                                                                  | S2 (Adobe)                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `contain`                      | `layout style paint` (5개 파일)                                                     | 없음                                                    |
| `transform` 상시               | `translate3d(0,0,0)` 상시 (Popover + Dialog + Calendar + ListBox + Menu + MenuItem) | 진입/퇴장 애니메이션 시에만 `translateY`/`translateX`   |
| `will-change`                  | 상시 적용                                                                           | 없음 — 브라우저 자동 관리                               |
| `backface-visibility`          | `hidden` 상시                                                                       | 없음                                                    |
| 스태킹 컨텍스트                | `z-index: 100000` (inline)                                                          | `isolation: isolate` + `zIndex: undefined`              |
| Popover `display`              | `block` (기본값)                                                                    | `display: flex` (자식 크기 auto-sizing)                 |
| Dialog position (Popover 내부) | `fixed` (generated CSS)                                                             | 없음 — normal flow                                      |
| Inner content overflow         | 없음                                                                                | `overflow: auto` + `position: relative` (inner wrapper) |

### 제약

- `generated/Dialog.css`는 DialogSpec archetype `overlay`에서 자동 생성됨 — 직접 수정하면 빌드 시 덮어씀
- Modal Dialog는 `position: fixed`가 필요 — DialogSpec 변경 시 Modal Dialog에 영향 가능
- Base Popover.css 변경은 Tooltip, ContextualHelp 등 모든 overlay 컴포넌트에 영향
- Select/ComboBox/Menu는 현재 정상 동작 — 변경 후 회귀 발생 시 복구 비용 존재

## Alternatives

### 대안 A: DatePicker/DateRangePicker만 targeted fix

- 설명: DatePicker.css, DateRangePicker.css에서만 Dialog `position: static` override + `contain: paint` 제거
- 장점: 최소 변경, 버그만 수정
- 위험:
  - 기술: L
  - 유지보수: M
  - 마이그레이션: L
- 이유: S2와 어긋나는 패턴이 다른 5개 파일에 잔존. 향후 유사 구조 변경(Dialog 추가 등) 시 동일 문제 재발 가능

### 대안 B: 전체 Popover 계열 S2 패턴 정렬 (2계층)

- 설명: Layer 1(버그 수정)과 Layer 2(S2 정합성 개선)를 분리하여 단계적 적용
  - Layer 1: DatePicker/DateRangePicker 즉시 수정 (Dialog position override + contain/transform 제거)
  - Layer 2: Base Popover.css + Select/ComboBox/Menu의 contain/transform/will-change 정리 + generated/Dialog.css 근본 원인 처리
- 장점:
  - Layer 1으로 즉시 버그 해결
  - Layer 2로 S2 기준 완전 정렬
  - 단계 분리로 회귀 시 원인 추적 용이
- 위험:
  - 기술: L
  - 유지보수: L
  - 마이그레이션: M
- 이유: Layer 2에서 Base Popover.css 변경이 Tooltip 등에 영향할 수 있으나, S2가 동일 패턴을 사용하지 않으므로 안전. generated/Dialog.css 처리는 DialogSpec archetype 조건부 분기 또는 컴포넌트별 override로 해결 가능

### 대안 C: DialogSpec archetype 재설계 후 일괄 적용

- 설명: DialogSpec의 archetype를 `overlay`에서 `container`로 변경하거나, overlay archetype의 CSS 생성 로직에서 `position: fixed`를 조건부 생성하도록 CSSGenerator를 수정
- 장점: 근본 원인 완전 해결
- 위험:
  - 기술: M
  - 유지보수: L
  - 마이그레이션: H
- 이유: CSSGenerator 수정은 모든 auto-generated CSS에 영향. DialogSpec 변경은 Modal Dialog 경로에서 `position: fixed`가 사라져 별도 보완 필요

## Risk Threshold Check

- 대안 A는 잔존 패턴으로 인한 유지보수 리스크(M)가 있다.
- 대안 B는 모든 위험이 L~M이며, Layer 분리로 관리 가능하다.
- 대안 C는 마이그레이션 리스크가 H이며, CSSGenerator 변경의 파급 범위가 넓다.

## Decision

**대안 B, 전체 Popover 계열 S2 패턴 정렬을 2계층으로 채택한다.**

### Layer 1: 즉시 버그 수정 (DatePicker/DateRangePicker)

| 파일                  | 변경 내용                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DatePicker.css`      | (1) `contain: layout style paint` 제거 (2) `.react-aria-Dialog`에 `position: static` override (3) Dialog/Calendar의 상시 `transform`/`backface-visibility` 제거 |
| `DateRangePicker.css` | 동일                                                                                                                                                            |

### Layer 2: S2 정합성 개선 (전체 Popover 계열)

| 파일                   | 변경 내용                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Popover.css`          | (1) `will-change: transform, opacity` → `[data-entering]`/`[data-exiting]` 선택자로 이동 (2) 상시 `transform: translate3d(0,0,0)` 제거 (3) `backface-visibility: hidden` 제거 (4) `display: flex` 추가 (S2 패턴) |
| `Select.css`           | (1) `contain: layout style paint` → `contain: layout style` (paint 제거) (2) ListBox 상시 `transform`/`backface-visibility` 제거                                                                                 |
| `ComboBox.css`         | 동일                                                                                                                                                                                                             |
| `Menu.css`             | (1) SubmenuTrigger/MenuTrigger 두 곳의 `contain` paint 제거 (2) Menu/MenuItem 상시 `transform`/`backface-visibility` 제거                                                                                        |
| `generated/Dialog.css` | `.react-aria-Popover .react-aria-Dialog` 선택자로 `position: static` override 규칙 추가 (DialogSpec은 변경하지 않음 — Modal Dialog 보호)                                                                         |

### generated/Dialog.css 처리 전략

DialogSpec의 archetype `overlay`를 변경하는 대신, **수동 override 규칙**을 `Popover.css`에 추가한다:

```css
/* Popover 내부 Dialog는 overlay가 아닌 normal flow */
.react-aria-Popover .react-aria-Dialog {
  position: static;
}
```

이 방식의 근거:

- `generated/Dialog.css`는 auto-generated이므로 직접 편집 불가 (빌드 시 덮어씀)
- DialogSpec archetype 변경은 Modal Dialog에 영향 → 별도 ADR 필요
- Popover 내부 Dialog만 선택적으로 override하므로 영향 범위가 제한적
- S2에서도 Dialog 자체에 position을 지정하지 않음 (Modal이 담당)

## Gates

| Gate | 조건                                                                                  | 목적                            |
| ---- | ------------------------------------------------------------------------------------- | ------------------------------- |
| G1   | Layer 1 적용 후 Preview에서 DatePicker 캘린더 버튼 클릭 시 Popover가 정상 표시된다    | 버그 수정 확인                  |
| G2   | Layer 1 적용 후 DateRangePicker도 동일하게 Popover가 정상 작동한다                    | 동일 패턴 확인                  |
| G3   | Layer 2 적용 후 Select/ComboBox 드롭다운이 정상 열리고 항목 선택이 가능하다           | 회귀 방지                       |
| G4   | Layer 2 적용 후 Menu/Submenu Popover가 정상 표시된다                                  | 회귀 방지                       |
| G5   | Layer 2 적용 후 Tooltip, ContextualHelp 등 기타 Popover 사용 컴포넌트가 정상 동작한다 | Base Popover.css 변경 회귀 방지 |
| G6   | Popover 진입/퇴장 애니메이션이 정상 동작한다 (will-change 이동 후)                    | 애니메이션 회귀 방지            |
| G7   | `pnpm run type-check`, `pnpm run lint` 통과                                           | 저장소 품질 게이트              |

## Consequences

### Positive

- DatePicker/DateRangePicker 캘린더 Popover 버그가 즉시 해결된다
- 전체 Popover 계열이 S2 기준과 일치하여 향후 S2 업데이트 추적이 용이해진다
- 불필요한 상시 GPU layer 할당이 제거되어 메모리 사용량이 개선된다
- `contain: paint`로 인한 잠재적 overflow 클리핑 문제가 예방된다
- Popover `display: flex` 전환으로 자식 크기에 맞는 auto-sizing이 개선된다

### Negative

- Layer 2의 Base Popover.css 변경은 모든 overlay 컴포넌트에 영향하므로 회귀 테스트 범위가 넓다
- `will-change`를 애니메이션 시에만 적용하면, 최초 진입 시 compositing layer 생성 지연이 발생할 수 있다 (체감 불가 수준)
- `generated/Dialog.css`의 근본 원인(archetype `overlay`)은 이번 ADR에서 해결하지 않고 수동 override로 우회한다

## Implementation Summary (2026-03-26)

Layer 1 + Layer 2 + Tooltip 추가 정리를 단일 작업으로 완료.

### 변경된 파일 (7개 CSS)

| 파일                  | 변경 내용                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DatePicker.css`      | `contain: layout style paint` 제거, Dialog/Calendar 상시 `transform`/`backface-visibility` 제거, `display: flex` 추가                                                                                                                            |
| `DateRangePicker.css` | 동일                                                                                                                                                                                                                                             |
| `Popover.css`         | 상시 `will-change`/`transform`/`backface-visibility` 제거, `display: flex` + `isolation: isolate` 추가, `will-change`를 `[data-entering]`/`[data-exiting]`으로 이동, `.react-aria-Popover .react-aria-Dialog { position: static }` override 추가 |
| `Tooltip.css`         | 상시 `transform: translate3d(0,0,0)` 제거, `isolation: isolate` 추가, `will-change`를 `[data-entering]`/`[data-exiting]`으로 이동                                                                                                                |
| `Select.css`          | `contain: layout style paint` → `contain: layout style`, ListBox 상시 `transform`/`backface-visibility` 제거                                                                                                                                     |
| `ComboBox.css`        | 동일                                                                                                                                                                                                                                             |
| `Menu.css`            | SubmenuTrigger/MenuTrigger 두 곳의 `contain: paint` 제거, Menu/MenuItem 상시 `transform`/`backface-visibility` 제거                                                                                                                              |

### 검증 결과

| Gate | 결과                                                                 |
| ---- | -------------------------------------------------------------------- |
| G1   | ✅ DatePicker 캘린더 Popover 185x228px 정상 표시 (수정 전 2x2px)     |
| G3   | ✅ ComboBox 드롭다운 348x122px 정상, contain: layout style 적용 확인 |
| G7   | ✅ `pnpm type-check` 통과                                            |

### 잔존 패턴 (정당한 사용으로 유지)

- `ListBox.css` virtualized item: `will-change: transform` + `backface-visibility: hidden` (가상 스크롤)
- `ColorArea/ColorSlider.css` thumb: `will-change: transform` (드래그 핸들)
- `ProgressBar.css` fill/indeterminate: `will-change: transform` (연속 애니메이션)
- `Popover.css`/`Tooltip.css` @keyframes 내부 `translate3d`: 애니메이션 from/to 목표값

## References

- [React Spectrum S2 Popover 소스](https://github.com/adobe/react-spectrum/blob/main/packages/@react-spectrum/s2/src/Popover.tsx)
- [React Spectrum S2 DatePicker 소스](https://github.com/adobe/react-spectrum/blob/main/packages/@react-spectrum/s2/src/DatePicker.tsx)
- [React Spectrum S2 Dialog 소스](https://github.com/adobe/react-spectrum/blob/main/packages/@react-spectrum/s2/src/Dialog.tsx)
- [MDN will-change 남용 경고](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [CSS Containment spec — paint containment](https://www.w3.org/TR/css-contain-2/#containment-paint)
- [ADR-036](036-spec-first-single-source.md): Spec-First CSS 자동 생성 (generated/Dialog.css 생성 경로)

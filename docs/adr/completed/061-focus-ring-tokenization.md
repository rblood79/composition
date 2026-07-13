# ADR-061: Focus Ring 토큰화 — 50개 리터럴 해체

> **SSOT domain**: D3 (시각 스타일). Focus ring 리터럴 50건을 TokenRef로 전환하여 Spec 시각 SSOT 강화. D3 내부 정리. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md).

## Status

Implemented — 2026-04-13

- **Pre-Phase 0** (토큰 인프라): Implemented — `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-inset-offset` CSS 변수 신설. `StateEffect.focusRing` 필드 + `resolveFocusRingToken()` + `FOCUS_RING_TOKENS` 상수 + CSSGenerator 분기 완료
- **Phase 1** (시험대 5개): Implemented — Button/TextField/Checkbox/Radio/Link 전환
- **Phase 2** (Field 12개): Implemented — NumberField/SearchField/ColorField/DateField/TimeField/TextArea/Select/ComboBox/DatePicker/DateRangePicker(공유 상수 경유)/ColorPicker/Slider 전환
- **Phase 3** (잔존 37개): Implemented — 35개 bulk perl 치환 + Tabs (inset variant) + Menu (--focus-ring 통일)
- **Phase 4** (레거시 제거): Implemented — `StateEffect.outline/outlineOffset` 필드 제거, CSSGenerator의 `states.focused.outline` + focusVisible fallback 경로 삭제. Fallback도 토큰 기반 (`{focus.ring.default}`)으로 전환
- **Phase 5** (Inset variant): Implemented — Tabs에 `{focus.ring.inset}` 적용 (계획의 SliderThumb/Switch/ColorSwatch는 실제 `outlineOffset: "2px"` 양수 사용이라 default로 유지)

**최종 수치**: 53개 TokenRef 사용 (default 52 + inset 1), 리터럴 0건, 107 CSS 정상 생성, type-check 통과.

## 원칙

본 ADR의 원칙 선언은 [ADR-057 §원칙](./057-text-spec-first-migration.md#원칙--spec-ssot--symmetric-consumers-adr-036-준수)을 그대로 상속한다.

핵심:

- **Spec이 SSOT**, CSS/Skia는 대등한 consumer
- **ADR-061의 본질**: 50개 컴포넌트 spec에서 `outline: "2px solid var(--accent)", outlineOffset: "2px"` 리터럴이 **소스 코드 복제** 형태로 분산되어 있다. 디자인 시스템의 focus ring 규약이 단일 토큰으로 정의되지 않아 SSOT 외부에 존재한다. 본 ADR은 focus ring 전용 토큰을 신설하여 이 50개 리터럴을 해체한다.

## Context

React Aria 접근성 요구사항에 따라 모든 인터랙션 컴포넌트는 `data-focus-visible` 상태에서 focus ring을 표시한다. 현재 이 focus ring 스타일은 **각 spec 파일에 리터럴로 중복 복제**되어 있다.

### 실측 증거 (2026-04-11)

- `grep "outline: \"2px solid var(--accent)\""` → **50개 파일에서 50개 occurrence**
- 패턴:
  ```ts
  states: {
    focusVisible: {
      outline: "2px solid var(--accent)",
      outlineOffset: "2px",
    }
  }
  ```
- 해당 50개 컴포넌트: Button, Checkbox, Radio, Switch, Link, Tab, Tag, TextField, NumberField, SearchField, ColorField, Select, ComboBox, DatePicker, Slider, SliderThumb, TextArea, Toolbar, Breadcrumb, Breadcrumbs, Panel, Card, Calendar, Input, MaskedFrame, List, ListBox, Switcher, Disclosure, DisclosureGroup, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel, ColorArea, CheckboxGroup, RadioGroup, Pagination, Tree, Table, ButtonGroup, Nav, ToggleButton, ToggleButtonGroup, DateSegment, FileTrigger, DropZone, TagGroup, SelectTrigger

### 토큰 부재의 증상

1. **단일 변경의 O(N) 비용** — 디자인 시스템이 "focus ring width 3px"로 변경하면 50 파일 수동 업데이트
2. **일관성 drift 위험** — 리터럴 복제는 부분적 drift를 유발할 수 있음 (예: `outline: "2px solid var(--accent)"` vs `"2px solid var(--focus-color)"` 혼재)
3. **Dark mode / accent 커스터마이제이션 제약** — per-theme focus ring 변경 시 50곳 일괄 처리 필요
4. **inset ring 변형 부재** — Slider thumb 등 inset focus가 필요한 컴포넌트는 현재 리터럴 override 패턴 없음

### Hard Constraints

1. **React Aria `data-focus-visible` activation 규칙 불변** — 키보드 focus 감지 로직 보존
2. **모든 기존 50개 컴포넌트 외관 ≤1px** — 토큰 도입 후 동일 픽셀 결과
3. **Dark mode 호환** — `--accent` CSS 변수 fallback 정상 동작
4. **per-element accent override 호환** (ADR-021) — 개별 컴포넌트 accent 변경 시 focus ring도 따라감
5. **Skia 경로 동기화** — CSS가 focus 토큰 사용 시 Skia renderer도 동일 값 참조

### Soft Constraints

- `inset` focus ring 변형 (일부 컴포넌트에서 외부 outline 대신 내부 border 사용)
- `offset` 값 per-component override 가능성 (compact UI에서 0px offset)
- 미래 토큰 확장: `thickness`, `style`, `color-variant` (error/positive/warning focus)

## 의존성

- **ADR-021** (선행 완료): Theme System Redesign — `--accent` 변수 + Tint Color System
- **ADR-022** (선행 완료): S2 Color Token — `--accent` 시맨틱 토큰
- **ADR-059** (병행 권장): Composite skipCSSGeneration 해체 — CSS 자동 생성 경로와 focus ring 토큰 통합

## Alternatives Considered

### 대안 A: 현상 유지 (50개 리터럴 복제)

- 설명: 유지
- 근거: 최소 변경
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — 디자인 변경 시 50 파일 수동 업데이트, drift 위험 지속
  - 마이그레이션: L

### 대안 B: Spec 헬퍼 함수 도입 (`focusVisibleRing()`)

- 설명: `packages/specs/src/runtime/focusRing.ts` 신설, `states.focusVisible = focusVisibleRing()` 호출로 치환
- 근거: TypeScript 함수 재사용, 커스터마이즈 용이 (`focusVisibleRing({ offset: 0 })`)
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: M — 헬퍼가 리터럴을 반환하면 결국 spec 빌드 타임에 인라인됨 (runtime CSS 변수 기반 아님)
  - 마이그레이션: M

### 대안 C: Design Token 신설 + TokenRef (`{focus.ring}`) (본 제안)

- 설명:
  1. `packages/specs/src/tokens/focus.ts` (신설) — `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-color`, `--focus-ring-style` 4개 CSS 변수 정의
  2. `spec.types.ts`에 `FocusRingToken` 타입 추가
  3. `tokenResolver.ts`에 `{focus.ring.default}` / `{focus.ring.inset}` TokenRef 지원
  4. 50개 spec을 `states.focusVisible = "{focus.ring.default}"` 로 치환
  5. CSS 생성 시 `outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color); outline-offset: var(--focus-ring-offset);` 자동 생성
- 근거:
  - 런타임 CSS 변수 기반 → 디자인 변경 시 1곳 수정
  - TokenRef 일관성 (color/typography/radius와 동일 매커니즘)
  - theme/dark mode 자동 반영
  - Skia resolver 재사용 가능
- 위험:
  - 기술: M — `tokenResolver`의 TokenRef 타입 확장 (기존은 color/typography 중심)
  - 성능: L
  - 유지보수: L
  - 마이그레이션: M — 50개 spec 치환

### 대안 D: CSS utility class (`.focus-ring`)

- 설명: `packages/shared/src/components/styles/utilities.css`에 `.focus-ring` 유틸 신설, 각 컴포넌트 CSS에서 `@extend` 또는 클래스 명시
- 근거: CSS 관점에서 단일 source
- 위험:
  - 기술: M — utility class는 Skia 경로에서 해석 불가
  - 성능: L
  - 유지보수: M — CSS SSOT는 달성하지만 spec SSOT는 미달성
  - 마이그레이션: M

### 대안 E: @sync-ring 매크로

- 설명: ESLint rule + build-time 매크로로 `@focus-ring` 주석을 `outline: "2px solid var(--accent)"`로 자동 확장
- 근거: 코드 최소 침습
- 위험:
  - 기술: **H** — 빌드 매크로 파이프라인 신규 구축
  - 성능: L
  - 유지보수: M — 커스텀 매크로는 학습 비용
  - 마이그레이션: M

### Risk Threshold Check

| 대안                        | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| --------------------------- | ----- | ---- | -------- | ------------ | :--------: |
| A (현상 유지)               | L     | L    | **H**    | L            |     1      |
| B (헬퍼 함수)               | L     | L    | M        | M            |     0      |
| C (**TokenRef + CSS 변수**) | M     | L    | L        | M            |     0      |
| D (CSS utility class)       | M     | L    | M        | M            |     0      |
| E (@sync-ring 매크로)       | **H** | L    | M        | M            |     1      |

루프 판정: 대안 A/E 제외. B/C/D 중 SSOT 일관성 + theme 자동 반영이 모두 충족되는 것은 대안 C.

**선택 기준**: 런타임 CSS 변수 기반 단일 source + TokenRef 일관성 + 양쪽 consumer(CSS/Skia) 대등.

## Decision

**대안 C: Design Token 신설 + TokenRef + CSS 변수 파생**을 선택한다.

기각 사유:

- **대안 A**: 50개 리터럴 복제 영속화
- **대안 B**: 헬퍼가 리터럴 반환 시 빌드 타임 인라인 → 런타임 변경 불가. dark mode/theme override 처리 부족
- **대안 D**: Skia 경로에서 CSS utility class 해석 불가 → Skia/CSS 비대칭
- **대안 E**: 매크로 파이프라인은 본 ADR 범위 초과, 학습 비용 과다

### 실행 구조 (요약)

- **Pre-Phase 0** (Phase 1 선행): CSS 변수 4개 신설 + `tokenResolver` 확장 + `FocusRingToken` 타입 + `{focus.ring.default}` TokenRef
- **Phase 1** — **시험대 5개** (Button/TextField/Checkbox/Radio/Link) 치환. 외관 diff 0 확인
- **Phase 2** — **Field 계열 12개** (NumberField/SearchField/ColorField/DateField/TimeField/TextArea/Select/ComboBox/DatePicker/DateRangePicker/TimeField/Slider) 치환
- **Phase 3** — **잔존 33개** (Tag/Tab/Panel/Card/Calendar/Disclosure/ColorPicker/ColorArea 등) 치환
- **Phase 4** — 50개 grep 0건 확인 + CSS utility 기반 `:focus-visible` 공통 스타일 정리 (중복 제거)
- **Phase 5** — inset variant 도입 (`{focus.ring.inset}`) — Slider thumb / Switch thumb 등 inset focus 필요 컴포넌트에 적용

> 구현 상세: [061-focus-ring-tokenization-breakdown.md](../design/completed/061-focus-ring-tokenization-breakdown.md)

## Gates

잔존 HIGH 위험 없음. 50개 컴포넌트 외관 ≤1px가 최대 관심사.

| Gate                               | 시점             | 통과 조건                                                                                                                   | 실패 시 대안                   |
| ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| CSS 변수 + TokenRef 해석           | Pre-Phase 0 완료 | `{focus.ring.default}` TokenRef를 `outline: 2px solid var(--accent); outline-offset: 2px;` 로 정확히 해석, 단위 테스트 통과 | TokenRef 확장 롤백             |
| 시험대 5개 외관                    | Phase 1 완료     | Button/TextField/Checkbox/Radio/Link focus-visible 상태 screenshot diff 0 (픽셀 단위)                                       | Phase 1 롤백, 리터럴 복원      |
| Field 12개 외관                    | Phase 2 완료     | 전체 Field 계열 focus-visible diff 0                                                                                        | Phase 2 롤백                   |
| 잔존 33개 외관                     | Phase 3 완료     | 전체 33개 focus-visible diff 0                                                                                              | Phase 3 롤백                   |
| grep 0건                           | Phase 4 완료     | `grep "outline: \"2px solid var(--accent)\""` 0건, `grep "outlineOffset: \"2px\""` (spec 파일 전체) 0건                     | 잔존 컴포넌트 개별 재전환      |
| inset variant 도입                 | Phase 5 완료     | `{focus.ring.inset}` TokenRef 동작, Slider thumb focus ring inset 렌더링 정확                                               | Phase 5 롤백, 개별 리터럴 유지 |
| Dark mode 무회귀                   | 각 Phase 완료    | `--accent` 변경 시 focus ring 색상 자동 반영 (ADR-021 Dark Mode)                                                            | 토큰 정의 재검토               |
| per-element accent override 무회규 | 각 Phase 완료    | 개별 element의 accent override 시 focus ring도 override 값 사용 (ADR-021)                                                   | CSS 변수 cascade 경로 재검토   |
| Skia focus 렌더링 정합성           | 각 Phase 완료    | Skia renderer가 `{focus.ring.default}` TokenRef 해석 시 CSS와 동일 outline 수치                                             | `tokenResolver` Skia 경로 수정 |

## Consequences

### Positive

- **단일 source** — focus ring 규약이 `tokens/focus.ts` 1곳에 정의
- **50개 리터럴 소멸** — 디자인 변경 시 1곳 수정으로 50 컴포넌트 자동 반영
- **Dark mode 자동 반영** — CSS 변수 cascade로 theme 전환 시 별도 작업 불필요
- **per-element override 강화** — ADR-021 per-element accent override가 focus ring에도 자동 적용
- **inset variant 확장성** — `{focus.ring.inset}` 토큰으로 내부 focus 패턴 표준화
- **Skia 정합성 개선** — CSS/Skia가 동일 TokenRef resolver 경유
- **ADR-059 시너지** — CSSGenerator 확장 시 focus ring 자동 생성 (CSS 변수 경유)
- **미래 확장** — `thickness`, `style`, `color-variant` 등 focus ring 변형 토큰 추가 시 단일 지점

### Negative

- **TokenRef 타입 확장 부담** — 기존 color/typography 중심 resolver에 focus 카테고리 추가
- **Pre-Phase 0 선행** — CSS 변수 + resolver가 Phase 1 이전에 준비되어야 함
- **5 Phase coordinated 변경** — 50개 spec 점진 전환
- **CSS 변수 충돌 가능성** — `--focus-ring-*` prefix가 기존 css 변수와 충돌 없는지 grep 확인 필요
- **ESLint rule 필요** — 미래 spec 추가 시 리터럴 재도입 방지를 위한 lint rule 검토

### 후속 작업

- **ESLint rule 신설** — `no-focus-ring-literal`: spec 파일에서 `outline: "2px solid var(--accent)"` 리터럴 금지
- **focus state 확장 토큰** — `{focus.ring.error}`, `{focus.ring.positive}` — 상태별 focus ring 색상 변형
- **ADR-036 재승격 준비** — ADR-058 + ADR-059 + ADR-060 + ADR-061 완료 시 ADR-036 "Fully Implemented" 재평가
- **Skia outline 렌더링 경로 통합** — Skia renderer의 focus ring 렌더링 로직이 CSS와 동일 TokenRef 경유 확인 (canvas-rendering.md 업데이트)

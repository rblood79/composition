# ADR-106-a: Color Family skipCSSGeneration 해체 — 수동 CSS 정당화 + Spec SSOT 강화

## Status

Implemented — 2026-04-21
Proposed — 2026-04-21

## Context

### 배경 — ADR-106 Charter G3 슬롯 착수

ADR-106 (skipCSSGeneration 감사 Charter, Proposed 2026-04-21) §G3 "수동 CSS 독립 정의 debt" 5건 중 **Color family 4건** (ColorPicker / ColorSlider / ColorSwatchPicker / ColorWheel) 이 106-a 슬롯으로 지정되었다.

4개 spec은 모두 `skipCSSGeneration: true`를 선언하고 있으며, 각각 `packages/shared/src/components/styles/Color*.css` 수동 파일을 보유한다. Charter 분류는 "G3 수동 CSS 독립 정의 debt"이지만, 본 ADR 착수 시 실측 조사 결과 **분류 재판정**이 필요한 케이스가 발견되었다.

### D3 Domain 판정

**D3 (시각 스타일) 전용 작업**. CSS 수동 파일의 색상/크기/레이아웃이 Spec SSOT에서 파생되어야 한다는 원칙(ADR-036/ADR-059/ADR-063). D1(DOM/접근성) — RAC가 `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorSwatchPicker` 내부 DOM 구조 전체를 제공; 본 ADR은 D1에 비침범. D2(Props/API) — 영향 없음.

### Hard Constraints

1. **CSSGenerator 자식 selector emit 지원 여부** 사전 판정 의무 (ADR-106 Charter §Context, 반복 패턴 체크 #2)
2. **BC 0%** — `element.tag` 변경 없음, CSS 경로 변경만. 수동 CSS 구조 변경 시 `/cross-check` 의무 (반복 패턴 체크 #3)
3. **Skia 경로 무회귀** — 4개 spec의 `render.shapes`가 이미 spec token 참조 → 변경 대상 아님. CSS 변경만
4. **ADR-105 @sync 비충돌** — Color family CSS에 `@sync` 주석 없음 (grep 확인). ADR-105 F2/F4 scope와 무관
5. **testing 기준선** — type-check 3/3 + specs PASS + builder PASS

### 소비 코드 경로 (반복 패턴 체크 #1 — 5건 이상 grep 가능 경로)

| 경로                                                               | 역할                                                     | Color family 관련            |
| ------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------- |
| `packages/specs/src/renderers/CSSGenerator.ts:146`                 | `if (spec.skipCSSGeneration && !_embedMode) return null` | 4건 emit 전면 차단           |
| `packages/shared/src/components/styles/ColorPicker.css:20-63`      | `--cp-*` 독립 CSS 변수 블록                              | sm/md/lg size 로컬 변수 선언 |
| `packages/shared/src/components/styles/ColorSlider.css:4-82`       | `grid-template-areas` + `ColorThumb` + orientation 분기  | RAC 내부 구조체 selector     |
| `packages/shared/src/components/styles/ColorWheel.css:4-28`        | `ColorWheelTrack` + `ColorThumb` disabled state          | RAC 내부 구조체 selector     |
| `packages/shared/src/components/styles/ColorSwatchPicker.css:4-41` | `ColorSwatchPickerItem[data-selected]::after`            | 선택 표시 pseudo-element     |
| `packages/specs/src/components/ColorPicker.spec.ts:40`             | `skipCSSGeneration: true` 선언                           | —                            |
| `packages/specs/src/components/ColorSlider.spec.ts:34`             | `skipCSSGeneration: true` 선언                           | —                            |
| `packages/specs/src/components/ColorSwatchPicker.spec.ts:37`       | `skipCSSGeneration: true` 선언                           | —                            |
| `packages/specs/src/components/ColorWheel.spec.ts:32`              | `skipCSSGeneration: true` 선언                           | —                            |

### CSSGenerator 자식 selector emit 지원 여부 판정 (CRITICAL — 반복 패턴 체크 #2)

현재 `CSSGenerator.ts`가 지원하는 emit 범위:

| emit 기능                                              | 지원 여부 | 경로                                           |
| ------------------------------------------------------ | :-------: | ---------------------------------------------- |
| `.react-aria-{Name}` root selector                     |    ✅     | `generateBaseStyles`                           |
| `[data-variant][data-size]` attribute selector         |    ✅     | `generateVariantStyles`, `generateSizeStyles`  |
| `[data-state]` (hover/pressed/disabled/focusVisible)   |    ✅     | `generateStateStyles`                          |
| `composition.staticSelectors` (고정 자식 selector)     |    ✅     | `generateStaticSelectorRules` (Phase 4-infra2) |
| `composition.sizeSelectors` (per-size 자식 selector)   |    ✅     | `generateSizeSelectorRules`                    |
| `composition.rootSelectors` (root pseudo selector)     |    ✅     | `generateRootSelectorRules`                    |
| `childSpecs` inline embed emit                         |    ✅     | ADR-078 Phase 2                                |
| RAC 내부 구조체 selector (`.react-aria-ColorThumb` 등) |    ❌     | 미지원                                         |
| pseudo-element (`::after`, `::before`)                 |    ❌     | 미지원                                         |
| orientation/disabled 분기 선언형                       |    ❌     | 미지원                                         |
| conic gradient CSS (hue wheel)                         |    ❌     | CSS 백그라운드 자체 속성                       |

**컴포넌트별 판정 매트릭스**:

| 컴포넌트              | CSS 핵심 구조                                                                                   |     Generator 지원?      | 판정                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------- | :----------------------: | ---------------------------------------------------------------- |
| **ColorPicker**       | `--cp-*` 로컬 CSS 변수 + `color-picker-popover` 중첩 dialog 구조                                |      ❌ 복합 미지원      | G3 → **G2 재판정** (spec token 파생 + RAC 구조 수동 재정의)      |
| **ColorSlider**       | `grid-template-areas` + `.react-aria-SliderTrack` + `.react-aria-ColorThumb` + orientation 분기 | ❌ 자식 selector 미지원  | G3 → **G2 재판정** (spec token 파생 + RAC 내부 구조 수동 재정의) |
| **ColorWheel**        | `.react-aria-ColorWheelTrack` + `.react-aria-ColorThumb` + `[data-disabled]` 분기               | ❌ 자식 selector 미지원  | G3 → **G2 재판정** (spec token 파생 + RAC 내부 구조 수동 재정의) |
| **ColorSwatchPicker** | `.react-aria-ColorSwatchPickerItem[data-selected]::after` pseudo-element                        | ❌ pseudo-element 미지원 | G3 → **G2 재판정** (spec token 파생 + RAC 구조 수동 재정의)      |

**판정 결론: 4건 전부 G3 → G2 재판정.**

- `ColorSlider.css`의 `var(--bg-raised)`, `var(--shadow-sm)` — spec token 파생
- `ColorWheel.css`의 `var(--bg-raised)`, `var(--shadow-sm)` — spec token 파생
- `ColorSwatchPicker.css`의 `var(--radius-lg)`, `var(--focus-ring)` — spec token 파생
- `ColorPicker.css`의 `var(--accent)`, `var(--radius-sm)`, `var(--text-sm)`, `var(--fg)`, `var(--bg-raised)`, `var(--bg-overlay)`, `var(--border)`, `var(--bg-muted)`, `var(--accent-subtle)` — spec token 파생

단, `ColorPicker.css`에는 독립 정의 요소도 존재:

- `--cp-btn-width: 32px`, `--cp-btn-height: 32px`, `--cp-dialog-padding: 14px`, `--cp-dialog-min-width: 192px` 등의 로컬 CSS 변수
- 이 값들이 spec `sizes.*`과 매핑 불일치 (spec `paddingX: 14, gap: 10`이지만 CSS는 `--cp-dialog-min-width: 192px` 같은 파생 값)

이 로컬 CSS 변수들은 spec token 파생이 아닌 **독자 수치**이므로, ColorPicker는 G2 정당화 범위 내의 **부분 debt**를 포함한다. 그러나 완전 해체(G3 경로)보다 spec과의 alignment를 점진적으로 높이는 G2 경로가 현실적이다.

### BC 영향 수식화 (반복 패턴 체크 #3)

`skipCSSGeneration: true` → 유지 (수동 CSS 정당화, Generator 전환 불가). BC 영향: **0%** (element tag 변경 없음, 수동 CSS 파일 구조 변경 없음). Skia `render.shapes` 변경 없음 → Preview/Canvas 시각 결과 변화 없음.

### Soft Constraints

- ADR-059 Tier 3 예외 9개에 Color family 4건이 포함되어 있지 않음 (2026-04-15 확정 기준). 본 ADR에서 추가 Tier 3 예외로 공식 등록
- ADR-106 Charter R2 (Color CSS가 spec token 파생으로 G2 이동 가능성) — 본 ADR이 이를 확정

## Alternatives Considered

### 대안 A: 수동 CSS 전면 유지 + ADR-059 Tier 3 예외 공식 등록 (G2 정당화 경로)

- 설명: 4개 spec의 `skipCSSGeneration: true`를 유지하되, 수동 CSS가 spec token 파생임을 문서화하고 ADR-059 Tier 3 예외에 공식 추가. `--cp-*` 로컬 변수 중 spec token 비파생 값은 spec `sizes`와 alignment 주석 추가. 코드 변경 없음, 문서화만.
  - 장점: 구현 비용 0. CSSGenerator 미지원 구조(RAC 내부 selector, pseudo-element)를 강제 변환하지 않음. D3 원칙 준수 상태 확인
  - 단점: `--cp-*` 독립 수치가 spec `sizes.*`와 장기적으로 drift 가능성 유지
- 위험:
  - 기술: LOW — 기존 동작 완전 유지
  - 성능: LOW — N/A
  - 유지보수: LOW — Tier 3 예외 문서화로 drift 감지 의무 명시. 단, `--cp-*` 값이 spec `sizes.*`과 이중 관리됨
  - 마이그레이션: LOW — BC 변경 없음

### 대안 B: CSSGenerator 확장 후 자동 생성 전환 (Generator 지원 확대)

- 설명: CSSGenerator에 (1) RAC 내부 구조체 selector emit, (2) pseudo-element emit, (3) orientation 분기 emit을 추가하여 Color family 4건을 `skipCSSGeneration: false`로 전환. ADR-078 수준 인프라 작업.
  - 장점: D3 fully automated. spec이 CSS consumer를 100% 제어
  - 단점: RAC 내부 구조체(`ColorThumb`, `ColorWheelTrack`, `ColorSwatchPickerItem`) selector가 Color family 전용 → 일반화 어려움. conic gradient CSS는 배경 자체 속성이라 Generator 표현 범위 밖. `[data-selected]::after` 복잡 pseudo-element도 Generator 스키마 설계 필요
- 위험:
  - 기술: **HIGH** — Generator 3축 확장(RAC child selector / pseudo-element / orientation 분기) + Color family 전용 케이스 일반화 불가능. ADR-078보다 복잡한 케이스
  - 성능: LOW
  - 유지보수: **HIGH** — Generator가 Color family 전용 로직을 내재화하면 다른 컴포넌트와 구조적으로 이질적. `conic` gradient CSS는 표현 불가 → Color family에만 escape hatch 필요
  - 마이그레이션: MEDIUM — Generator 확장이 기존 53개+ spec에 무회귀여야 함

### 대안 C: spec.composition.staticSelectors + sizeSelectors 경로 (부분 자동화)

- 설명: 현재 Generator가 지원하는 `composition.staticSelectors`와 `composition.sizeSelectors`를 활용하여 Color family의 일부 CSS(고정 자식 selector)를 자동 생성으로 이전. RAC 내부 구조체 selector와 pseudo-element는 수동 유지.
  - 장점: Generator 확장 없이 부분 자동화 가능. `skipCSSGeneration: false` 전환 가능성 탐색
  - 단점: `.react-aria-ColorThumb`가 ColorSlider/ColorWheel/ColorArea 모두에서 공유되는 전역 selector → spec 단일 컴포넌트의 `staticSelectors`에 선언하면 다른 컴포넌트에서도 영향 받음. `.react-aria-ColorSwatchPickerItem[data-selected]::after` pseudo-element는 staticSelectors 미지원. 결과적으로 분할 관리가 더 복잡해짐
- 위험:
  - 기술: **HIGH** — 공유 `.react-aria-ColorThumb` selector가 여러 spec에 중복 emit되면 CSS specificity 충돌. pseudo-element 미지원으로 ColorSwatchPicker 완전 전환 불가
  - 성능: LOW
  - 유지보수: **HIGH** — 부분 자동화 + 수동 잔존으로 2-source 상태가 더 불투명해짐. `staticSelectors`에 전역 selector를 선언하는 패턴이 안티패턴화될 위험
  - 마이그레이션: MEDIUM

### Risk Threshold Check

| 대안                           | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------------ | :---: | :--: | :------: | :----------: | :------: | -------- |
| A: Tier 3 정당화 문서화        |   L   |  L   |    L     |      L       |    0     | **PASS** |
| B: Generator 전면 확장         | **H** |  L   |  **H**   |      M       |    2     | 기각     |
| C: staticSelectors 부분 자동화 | **H** |  L   |  **H**   |      M       |    2     | 기각     |

**Risk Threshold Check — 반복 패턴 선차단 (adr-writing.md Top 1~4)**:

- [x] **#1 코드 경로 인용**: Context 소비 코드 경로 표에 9건 grep 가능 파일:라인 명시
- [x] **#2 Generator 확장 여부**: CSSGenerator 컴포넌트별 판정 매트릭스 + 미지원 기능 목록 명시
- [x] **#3 BC 훼손 수식화**: element.tag 변경 없음 → BC 0%, CSS 파일 구조 변경 없음 → Preview 무변화
- [x] **#4 Phase 분리 가능성**: 4건이 G3 → G2 재판정되어 단일 Phase 정당화 문서화로 충분 (Phase 분리 불필요)

대안 A만 HIGH+ 없음. 대안 B/C는 Generator 확장 기술/유지보수 HIGH 2개. ADR-106 Charter R2 예측이 정확히 실현됨 — Color CSS가 spec token 파생으로 재판정됨.

## Decision

**대안 A (수동 CSS 정당화 + ADR-059 Tier 3 예외 공식 등록)** 채택.

**선택 근거**:

1. **실측 결과 G3 → G2 재판정**: 4개 수동 CSS 파일이 spec token(`var(--bg-raised)`, `var(--radius-md)`, `var(--focus-ring)` 등) 파생임이 확인됨. ADR-059 §Tier 3 허용 패턴("수동 CSS가 spec 토큰 파생이면 D3 대칭 consumer 준수")에 해당
2. **CSSGenerator 구조적 미지원**: RAC Color 컴포넌트들의 내부 구조체(`ColorThumb`, `ColorWheelTrack`, `ColorSwatchPickerItem`)는 전역 공유 selector로, spec 단위 emit이 오히려 CSS specificity 충돌을 유발함. pseudo-element(`::after`) 미지원도 확정
3. **Skia 경로는 이미 SSOT 준수**: 4개 spec의 `render.shapes`가 모두 spec token(`{color.border}`, `{color.base}`, `{color.accent}`) 참조 → Builder Canvas는 D3 대칭 Consumer 조건 충족. CSS만 문서화하면 D3 symmetric 원칙 완성
4. **ADR-106 Charter R2 실현**: Charter가 예측한 "G2 이동 가능성" — 본 ADR이 이를 확정하여 분류 재판정 완료

**ColorPicker `--cp-*` 로컬 변수 처리**: `--cp-dialog-min-width: 192px`, `--cp-btn-width/height` 등은 spec `sizes.*` (paddingX, gap 등)에서 파생 가능하지만 현재는 독자 수치. 이는 **Tier 3 예외 내 residual debt**로 분류하되, 별도 Phase에서 spec.sizes alignment 주석으로 감지 가능성 명시 (코드 변경 없음).

**기각 사유**:

- **대안 B 기각**: HIGH 2개 초과. Generator 확장에 필요한 전역 공유 selector(`ColorThumb`) 일반화 및 pseudo-element 지원이 Color family 전용 케이스로 일반화 불가. ADR-078 이상의 복잡도를 정당화할 D3 개선이 없음 (G2 재판정으로 이미 D3 준수 상태)
- **대안 C 기각**: HIGH 2개. 부분 자동화가 전역 `ColorThumb` selector 이중 emit과 pseudo-element 공백으로 2-source 상태를 오히려 더 불투명하게 만듦

> 구현 상세: [106-a-color-family-skipcss-dismantle-breakdown.md](../../adr/design/106-a-color-family-skipcss-dismantle-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                       | 심각도 | 대응                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------- |
| R1  | `ColorPicker.css`의 `--cp-*` 독자 수치가 spec `sizes.*`과 장기 drift — sm/md/lg 값이 spec과 어긋나도 감지 어려움                           |  MED   | breakdown Phase 2에서 spec.sizes 매핑 주석 추가. 추후 ColorPicker spec 편집 시 sizes↔CSS 정합 체크리스트 명시 |
| R2  | ADR-059 Tier 3 예외 목록에 Color family 4건 추가가 누락되면 Charter G3 건수가 stale 유지됨                                                 |  LOW   | 본 ADR Implemented 후 ADR-059 §최종 SSOT 순도 표 갱신                                                         |
| R3  | RAC Color family 내 전역 `ColorThumb` selector가 `ColorArea.css`, `ColorSlider.css`, `ColorWheel.css` 세 파일에 중복 정의됨 — 이미 현 상태 |  LOW   | 본 ADR scope 밖. 전역 `.react-aria-ColorThumb` 단일화는 ADR-106 d (G4) 또는 별도 ADR                          |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

| Gate                 | 시점               | 통과 조건                                                                            | 실패 시 대안   |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------ | -------------- |
| G1: G2 재판정 근거   | ADR Proposed       | 4건 CSS 파일 전수 조사 + spec token 파생 확인 목록 기록됨 (breakdown)                | 재조사         |
| G2: Tier 3 예외 등록 | ADR Implemented 시 | ADR-059 §최종 SSOT 순도 표에 Color family 4건 추가                                   | 보강           |
| G3: 정합성 확인      | Phase 3 완료 시    | ColorPicker/Slider/Wheel/SwatchPicker spec.sizes ↔ CSS 로컬 변수 매핑 주석 완성      | Phase 3 반복   |
| G4: type-check       | 각 Phase 완료 시   | type-check 3/3 PASS (코드 변경 없음이므로 자동 통과 예상)                            | 해당 변경 롤백 |
| G5: D3 대칭          | ADR Implemented 시 | "수동 CSS가 spec token 파생 + Skia render.shapes가 동일 token 참조" 상태 문서화 완료 | 재조사         |

## Consequences

### Positive

- **ADR-106 Charter G3 → G2 재판정 확정**: 4건이 실측 결과 D3 위반 debt가 아니라 ADR-059 Tier 3 허용 케이스임을 명시. Charter 건수 보정 (G3 5건 → 1건 — Label 잔존)
- **Tier 3 예외 목록 완결성 향상**: ADR-059 §최종 SSOT 순도 표에 Color family 4건이 누락되어 있던 상태 해소
- **CSSGenerator 확장 위험 회피**: Generator에 전역 공유 selector(`ColorThumb`) 및 pseudo-element 일반화를 강제하지 않아 ADR-078 인프라의 안정성 보존
- **Skia 경로 D3 준수 확인**: 4개 spec `render.shapes`가 이미 spec token 참조 — Builder Canvas 측은 변경 없이 SSOT 준수 상태
- **ADR-106 Charter Implemented 전환 조건 충족**: 첫 후속 sub-ADR (106-a) Proposed 발행으로 Charter가 Implemented로 전환 가능

### Negative

- **G3 완전 해체 아님**: `ColorPicker.css`의 `--cp-*` 독자 수치 잔존. 장기적으로 spec.sizes alignment 작업이 추가 필요
- **수동 CSS 파일 유지**: 4개 CSS 파일이 계속 수동 관리됨. CSSGenerator가 자동 커버하지 않으므로 이중 편집 가능성 존재 (Skia + CSS 양쪽 수정 시)
- **전역 `ColorThumb` 중복**: `ColorArea.css`, `ColorSlider.css`, `ColorWheel.css` 3파일에 `ColorThumb` 스타일 중복 정의 상태 유지. 별도 정리 ADR 필요

## 참조

- [ADR-059](059-composite-field-skip-css-dismantle.md) — Composite Field CSS SSOT 확립, Tier 3 예외 9개 확정 + `@sync` 해체 원칙
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 3번 정본
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — Generator 자식 selector emit 확장 인프라 (ADR-078 Phase 2가 `childSpecs` inline emit 지원)
- [ADR-106](106-skipcssgeneration-audit-charter.md) — skipCSSGeneration 감사 Charter, G3 Color family 슬롯 정의
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 domain §6 금지 패턴 3번, §7 허용 패턴
- [canvas-rendering.md](../../../.claude/rules/canvas-rendering.md) — Spec-CSS 경계 §4

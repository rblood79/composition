# ADR-026: Responsive Constraint UI — Figma식 시각적 제약 조건 → CSS 매핑

## Status

Implemented (타협) — 2026-05-13. Phase 1-4 land 완료. 보류 3건 (Phase 3 Box Model 다이어그램 / Phase 4 부모 display 변경 시 자동 CSS 재매핑 / Phase 4 다중 선택 일괄 적용) + Phase 1 §변경 파일 목록 "신규" 항목 `sizeModeResolver.test.ts` 1건은 **이행 안 함 결정** (사용자 결정 2026-05-13). 사유: 본 ADR 의 핵심 가치인 "Figma/Framer Size Mode UI + CSS 역추론" 은 Phase 1-4 land 로 달성. 보류 3건은 본문 §"Phase X 완료 (2026-03-08)" 진행 로그에 명시된 ROI/위험 사유로 의도된 잔존이며, 별 ADR 발의 또는 향후 필요 시점에 재평가.

## Context

### 문제 정의

composition는 노코드 웹 빌더로서 CSS Flex/Grid/Block 레이아웃을 Taffy WASM 엔진으로 지원한다. 스타일 패널의 `PropertyUnitInput`은 이미 `px`, `%`, `rem`, `em`, `vh`, `vw` 단위와 `auto`, `fit-content`, `min-content`, `max-content` 키워드를 지원하며, Taffy WASM도 `min-width`, `max-width`, `min-height`, `max-height`를 계산할 수 있다.

**문제는 이 기능들의 접근성이 낮다는 것이다:**

| 현재 상태                          | 사용자 체감                                   |
| ---------------------------------- | --------------------------------------------- |
| width에 `100%` 직접 입력           | "부모 너비에 맞추려면 어떤 값을 넣어야 하지?" |
| `margin: 0 auto` 직접 입력         | "가운데 정렬은 어떻게?"                       |
| `flex-grow: 1` 직접 입력           | "남은 공간을 채우려면?"                       |
| `min-width`, `max-width` 각각 입력 | "최소/최대 제한은 어디서 설정하지?"           |
| `aspect-ratio` 미지원              | "비율 유지가 안 되네"                         |

Figma/Framer 등 디자인 도구에 익숙한 사용자는 **시각적 constraint UI**(핀, 스트레치, 고정/허그 등)로 이러한 동작을 직관적으로 설정한다. composition에 이 UI를 도입하되, **내부적으로는 순수 CSS 속성으로 변환**하여 웹 산출물 품질을 보장한다.

### 왜 Figma식 Constraint를 "그대로" 도입하지 않는가

Figma constraint는 **절대 좌표 기반 디자인 도구**를 위해 설계되었다:

```
Figma:  모든 요소가 절대 위치 → 부모 리사이즈 시 자식 재배치 규칙 필요
        → constraint (pin left/right/center, stretch, scale)

composition: CSS 레이아웃이 기본 → Flex/Grid/Block이 이미 부모-자식 관계 처리
        → constraint는 CSS 속성의 시각적 인터페이스로 재해석
```

Figma constraint를 별도 레이어로 도입하면:

- CSS 레이아웃과 constraint 두 시스템이 공존 → 충돌 케이스 다수
- constraint → CSS 변환이 1:1 대응 안 됨 (lossy mapping)
- 최종 웹 산출물에 불필요한 추상 레이어 잔존

### Hard Constraints

- 기존 CSS 레이아웃 엔진(Taffy WASM Flex/Grid/Block) 유지
- 새로운 레이아웃 시스템 추가 금지 — CSS 속성만으로 구현
- `PropertyUnitInput` 기존 단위/키워드 체계 보존
- Preview/Publish 산출물은 순수 CSS (비표준 속성 금지)
- 상태 변경 파이프라인 순서 보존 (Memory → Index → History → DB → Preview → Rebalance)
- 60fps Canvas 성능 기준 유지

### 업계 참조

| 도구            | 접근 방식                              | 산출물                     |
| --------------- | -------------------------------------- | -------------------------- |
| **Figma**       | Constraint (pin/stretch) + Auto Layout | 디자인 파일 (웹 변환 별도) |
| **Framer**      | Flex 기반 + Size 모드 (Fixed/Fill/Fit) | React 코드                 |
| **Webflow**     | CSS 직접 노출 + 시각적 보조            | 순수 HTML/CSS              |
| **Squarespace** | 제한된 레이아웃 옵션                   | 순수 HTML/CSS              |

**composition 전략: Framer의 "Size 모드" + Webflow의 "CSS 직접 매핑" 조합**

## Alternatives Considered

### 대안 A: Figma Constraint 전용 레이어 추가

CSS 레이아웃과 별개로 constraint 시스템을 추가하고, 렌더링 시 constraint → CSS 변환.

- 설명: 요소에 `constraints: { horizontal: 'left-right', vertical: 'top' }` 속성 추가. 부모 리사이즈 시 constraint 규칙으로 자식 위치/크기 재계산 후 CSS로 변환.
- 위험:
  - 기술: **HIGH** — CSS 레이아웃과 constraint 간 충돌 해소 로직 복잡 (Flex justify-content vs constraint pin)
  - 성능: **MEDIUM** — 매 리사이즈마다 constraint → CSS 변환 계산 추가
  - 유지보수: **HIGH** — 두 시스템 간 동기화, 엣지 케이스 지속 발생
  - 마이그레이션: **LOW** — 기존 요소에 기본 constraint 자동 부여

### 대안 B: CSS 속성의 시각적 Constraint UI (Size Mode)

새 속성 없이, 기존 CSS 속성 조합을 시각적 UI로 추상화. Framer의 "Size Mode" 패턴 채택.

- 설명: 요소의 width/height에 대해 `Fixed` / `Fill` / `Fit` 3가지 모드를 시각적으로 선택. 각 모드는 CSS 속성 조합으로 변환. constraint 전용 데이터 모델 없이 CSS 속성만 사용.
- 위험:
  - 기술: **LOW** — 기존 CSS 속성 조합, 새 시스템 없음
  - 성능: **LOW** — CSS 속성 변경만, 추가 계산 없음
  - 유지보수: **LOW** — CSS 표준만 사용, 별도 동기화 불필요
  - 마이그레이션: **LOW** — 기존 요소의 CSS 값에서 모드 역추론 가능

### 대안 C: Webflow식 CSS 직접 노출 + 시각적 보조

CSS 속성명을 그대로 노출하되, 시각적 다이어그램과 프리셋을 추가.

- 설명: 현재 스타일 패널에 Box Model 다이어그램, CSS 속성 자동완성, 프리셋 버튼(예: "가운데 정렬" → `margin: 0 auto`) 추가.
- 위험:
  - 기술: **LOW** — 기존 패널 확장
  - 성능: **LOW** — UI 변경만
  - 유지보수: **LOW** — CSS 표준
  - 마이그레이션: **MEDIUM** — CSS 지식 없는 사용자에게 여전히 높은 학습 곡선

## Threshold Check

대안 A: HIGH 2개 (기술, 유지보수) → 부적합
대안 B: 전 항목 LOW → **최적**
대안 C: 전 항목 LOW~MEDIUM → 적합하나 사용성 개선 폭 제한적

## Decision

**대안 B: CSS 속성의 시각적 Constraint UI (Size Mode)** 채택.

Framer의 Size Mode 패턴을 기반으로, 요소의 크기/정렬을 3가지 직관적 모드로 제어하되 내부적으로는 CSS 속성 조합으로만 변환한다. 대안 C의 Box Model 다이어그램은 Phase 2에서 보조적으로 추가.

### Size Mode 정의

#### Width Mode

| 모드      | 아이콘 | 설명             | 생성되는 CSS                                                                                                | 부모 컨텍스트   |
| --------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| **Fixed** | `[━]`  | 고정 너비        | `width: {value}px`                                                                                          | 모든 컨텍스트   |
| **Fill**  | `[←→]` | 부모 너비 채우기 | Flex 자식: `flex-grow: 1; flex-basis: 0`<br>Block 자식: `width: 100%`<br>Grid 자식: `justify-self: stretch` | Flex/Block/Grid |
| **Fit**   | `[↔]`  | 콘텐츠에 맞추기  | `width: fit-content`                                                                                        | 모든 컨텍스트   |

#### Height Mode

| 모드      | 아이콘 | 설명             | 생성되는 CSS                                                                                                                  | 부모 컨텍스트 |
| --------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Fixed** | `[━]`  | 고정 높이        | `height: {value}px`                                                                                                           | 모든 컨텍스트 |
| **Fill**  | `[↑↓]` | 부모 높이 채우기 | Flex(column) 자식: `flex-grow: 1; flex-basis: 0`<br>Flex(row) 자식: `align-self: stretch`<br>Grid 자식: `align-self: stretch` | Flex/Grid     |
| **Fit**   | `[↕]`  | 콘텐츠에 맞추기  | `height: auto` 또는 `height: fit-content`                                                                                     | 모든 컨텍스트 |

#### 정렬 (Alignment) — Fill이 아닌 경우

부모가 Flex/Grid일 때, Fixed/Fit 모드의 요소 정렬 위치 선택:

| 정렬       | 생성되는 CSS                                                                  |
| ---------- | ----------------------------------------------------------------------------- |
| **Start**  | `align-self: flex-start` / `justify-self: start`                              |
| **Center** | `align-self: center` / `justify-self: center`<br>Block: `margin-inline: auto` |
| **End**    | `align-self: flex-end` / `justify-self: end`<br>Block: `margin-left: auto`    |

#### Min/Max 제약

모든 모드에서 선택적 min/max 제약 추가 가능:

| 제약         | 생성되는 CSS            |
| ------------ | ----------------------- |
| Min Width    | `min-width: {value}`    |
| Max Width    | `max-width: {value}`    |
| Min Height   | `min-height: {value}`   |
| Max Height   | `max-height: {value}`   |
| Aspect Ratio | `aspect-ratio: {w}/{h}` |

### CSS 역추론 (기존 요소 호환)

기존 요소의 CSS 값에서 Size Mode를 역추론하여 UI에 표시:

```
width: {number}px          → Fixed
width: 100% / flex-grow: 1 → Fill
width: auto / fit-content  → Fit
그 외                      → Fixed (값 표시)
```

### UI 위치

스타일 패널 상단, 현재 width/height 입력 필드를 **Size Mode 세그먼트 컨트롤 + 값 입력**으로 교체:

```
┌─────────────────────────────────┐
│ Size                            │
│ W: [Fixed ▾][━][←→][↔]  200px  │
│ H: [Fixed ▾][━][↑↓][↕]  auto   │
│                                 │
│ ☐ Min W ___  ☐ Max W ___       │
│ ☐ Min H ___  ☐ Max H ___       │
│ ☐ Aspect Ratio ___:___         │
│                                 │
│ Align: [←] [↔] [→]            │
│        [↑] [↕] [↓]            │
└─────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Size Mode 코어 (P2)

**목표**: Width/Height에 Fixed/Fill/Fit 3모드 도입

| 작업                | 파일                                                | 설명                                                                |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Size Mode 타입 정의 | `types/builder/unified.types.ts`                    | `SizeMode = 'fixed' \| 'fill' \| 'fit'`                             |
| CSS 변환 로직       | `stores/utils/sizeModeResolver.ts` (신규)           | `resolveSizeMode(mode, axis, parentDisplay) → CSSProperties`        |
| CSS 역추론 로직     | `stores/utils/sizeModeResolver.ts`                  | `inferSizeMode(element, parentDisplay) → { widthMode, heightMode }` |
| SizeModeControl UI  | `panels/styles/sections/SizeModeSection.tsx` (신규) | 3버튼 세그먼트 + 값 입력                                            |
| LayoutSection 통합  | `panels/styles/sections/LayoutSection.tsx`          | 기존 width/height 입력을 SizeMode로 교체                            |
| 히스토리 기록       | `stores/utils/sizeModeResolver.ts`                  | CSS 속성 변경 전 recordHistory                                      |
| layoutVersion 증가  | `sizeModeResolver.ts`                               | 레이아웃 영향 속성 변경 시 필수                                     |

**예상 변경**: 3~~4파일 신규, 2~~3파일 수정

### Phase 2: Min/Max 제약 + Aspect Ratio (P3)

**목표**: 크기 제약과 비율 유지 기능

| 작업                         | 파일                  | 설명                         |
| ---------------------------- | --------------------- | ---------------------------- |
| Min/Max 토글 UI              | `SizeModeSection.tsx` | 체크박스 + PropertyUnitInput |
| Aspect Ratio 입력            | `SizeModeSection.tsx` | w:h 비율 입력, 잠금 토글     |
| Taffy aspect-ratio 지원 확인 | `layout/engines/`     | WASM 엔진에 전달 여부 검증   |
| Preview CSS 반영             | `preview/`            | `aspect-ratio` CSS 속성 전달 |

**예상 변경**: 1~2파일 수정

### Phase 3: 정렬 컨트롤 + Box Model 다이어그램 (P3)

**목표**: 요소 자체 정렬(align-self) + 시각적 Box Model

| 작업                         | 파일                         | 설명                                            |
| ---------------------------- | ---------------------------- | ----------------------------------------------- |
| Self-Alignment 그리드 UI     | `SizeModeSection.tsx`        | 3x3 정렬 매트릭스 (9방향)                       |
| align-self/justify-self 변환 | `sizeModeResolver.ts`        | 부모 display에 따른 CSS 분기                    |
| Box Model 다이어그램         | `BoxModelDiagram.tsx` (신규) | margin/border/padding 시각화 (대안 C 일부 채택) |

**예상 변경**: 1~~2파일 신규, 2~~3파일 수정

### Phase 4: 컨텍스트 인지 + 스마트 전환 (P4)

**목표**: 부모 display 변경 시 자식 Size Mode 자동 조정

| 작업                   | 파일                  | 설명                                         |
| ---------------------- | --------------------- | -------------------------------------------- |
| 부모 display 변경 감지 | `sizeModeResolver.ts` | 부모 flex→grid 전환 시 CSS 속성 자동 재매핑  |
| Fill 비활성화 힌트     | `SizeModeSection.tsx` | Block 컨텍스트에서 Height Fill 비활성 + 툴팁 |
| 다중 선택 일괄 적용    | `SizeModeSection.tsx` | 선택된 여러 요소에 동시 Size Mode 적용       |

**예상 변경**: 2~3파일 수정

## Gates

| Gate | 시점            | 조건                                                            | 실패 시                                                |
| ---- | --------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| G1   | Phase 1 완료 후 | Fixed/Fill/Fit 3모드가 Flex/Block/Grid 부모에서 정상 동작       | Phase 2 진입 불가                                      |
| G2   | Phase 1 완료 후 | 기존 요소의 CSS → Size Mode 역추론 정확도 95% 이상              | 역추론 로직 보강 후 재검증                             |
| G3   | Phase 2 완료 후 | aspect-ratio가 Canvas(Skia) + Preview(CSS) 양쪽에서 동일 렌더링 | Taffy WASM 지원 여부에 따라 Canvas 전용 계산 로직 추가 |

## Consequences

### Positive

- Figma/Framer 사용자에게 익숙한 Size Mode UI로 **학습 곡선 대폭 감소**
- 내부적으로 순수 CSS만 사용하여 **Preview/Publish 산출물 품질 보장**
- 새로운 레이아웃 시스템 없이 기존 Taffy WASM 엔진 **그대로 활용**
- CSS 역추론으로 **기존 프로젝트 하위 호환** 유지
- Phase별 점진 도입 가능 — Phase 1만으로도 핵심 가치 전달

### Negative

- CSS 속성 조합이 복잡해지면 Size Mode ↔ CSS 매핑이 모호해질 수 있음 (예: `width: 50%`는 Fixed? Fill?)
- 부모 display 컨텍스트에 따라 같은 모드가 다른 CSS를 생성 → 사용자 혼란 가능성
- `PropertyUnitInput` 직접 입력과 Size Mode UI 간 동기화 필요

---

---

## 구현 계획: Phase 1 (2026-03-08)

### 현황 분석

핵심 인프라가 이미 구현되어 있다:

- `sizeModeResolver.ts` **완성**: `inferSizeMode(style, axis, parentDisplay, parentFlexDirection)` + `resolveSizeMode(mode, axis, parentDisplay, parentFlexDirection, currentValue)` + `sizeModeToStyleUpdates(mode, axis, parentDisplay, parentFlexDirection, currentValue)` — 부모 컨텍스트별 CSS 분기 처리 완료
- `styleAtoms.ts`: `widthSizeModeAtom` + `heightSizeModeAtom` + `parentDisplayAtom` + `parentFlexDirectionAtom` — Jotai atom 정의 완료. 현재 `inferSizeMode()` 호출로 CSS 역추론 동작 중.
- `TransformSection.tsx`: Size Mode 세그먼트 컨트롤 **이미 구현** (ADR-026 Phase 1). `resolveSizeMode()` + `sizeModeToStyleUpdates()` 호출하여 모드 변경 → CSS 속성 업데이트 연동.
- `LayoutSection.tsx`: direction/alignment/gap/padding/margin 편집. **width/height 입력 UI 없음** — 이는 TransformSection(Size 섹션)에서 담당.
- `PropertyUnitInput`: px/%, rem, auto, fit-content 등 단위 입력 완성.
- `inspectorActions.ts`: `updateSelectedStyle()` + `LAYOUT_AFFECTING_PROPS` 인프라 완성.

**핵심 발견: Phase 1의 코어 로직(sizeModeResolver + Jotai atoms + TransformSection 세그먼트 UI)은 이미 구현 완료**. 남은 작업은 UI 폴리싱과 엣지 케이스 처리이다.

#### Phase 1 완료 (2026-03-08)

- `SelectedElement` 인터페이스에 `parentDisplay`, `parentFlexDirection` 필드 추가 (`inspector/types.ts`)
- `styleAtoms.ts`의 타입 캐스팅 우회(`as Record<string, unknown>`) 제거 → 정식 타입 참조로 전환
- `useZustandJotaiBridge.ts`에서 부모 display/flexDirection 주입 정상 동작 확인

#### Phase 2 완료 (2026-03-08)

- `styleAtoms.ts`에 minWidth/maxWidth/minHeight/maxHeight/aspectRatio atom 5개 추가
- `transformValuesAtom` 확장: 5개 constraint 값 포함 + equality 체크
- `TransformSection.tsx`: Min/Max 4개 PropertyUnitInput + Aspect Ratio 입력/잠금 UI 추가
- `inspector-layout.css`: grid-template-areas에 min/max/aspect-ratio 행 추가
- 토글 버튼으로 constraint 패널 접기/펼치기 (기존 값 있으면 자동 펼침)
- Taffy WASM이 minWidth/maxWidth/minHeight/maxHeight/aspectRatio 네이티브 지원 확인 — 추가 엔진 작업 불필요
- Preview/Publish: 인라인 style 자동 변환으로 별도 작업 불필요

#### Phase 3 완료 (2026-03-08)

- `styleAtoms.ts`에 `selfAlignmentKeysAtom` 추가 (align-self + justify-self → 9방향 매핑)
- `TransformSection.tsx`: Self-Alignment 3x3 그리드 UI 추가 (9개 ToggleButton + alignment-dot)
- 부모가 flex/grid일 때만 Self-Alignment 그리드 표시 (block 부모에서는 숨김)
- `handleSelfAlignment()`: 9방향 위치 → align-self/justify-self CSS 속성 변환
- `inspector-layout.css`: grid-template-areas에 self-alignment 행 추가 + 3x3 그리드 스타일
- Box Model 다이어그램은 보류 (핵심 가치 대비 복잡도 높음)

#### Phase 4 완료 (2026-03-08)

- `SizeModeToggle`에 `fillDisabled`/`fillDisabledReason` props 추가
- Block 부모에서 Height Fill 버튼 비활성화 + aria-label에 사유 표시
- Width Fill은 모든 부모 컨텍스트에서 가능 (block: 100%, flex: flex-grow, grid: stretch)
- 자동 CSS 재매핑(부모 display 변경 시)은 위험도 높아 보류 — 사용자가 수동으로 모드 재선택
- 다중 선택 일괄 적용은 스타일 패널이 단일 selectedElementId만 지원하므로 보류

### 변경 파일 목록

| 파일                                            | 구분 | 변경 내용                                                                           |
| ----------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `panels/styles/sections/TransformSection.tsx`   | 수정 | Size Mode 세그먼트 UI 폴리싱 — 아이콘 교체, 비활성 상태 힌트, 현재값 표시 개선      |
| `panels/styles/sections/TransformSection.css`   | 수정 | Size Mode 세그먼트 스타일 정리 (tv() 패턴 적용 확인)                                |
| `stores/utils/sizeModeResolver.ts`              | 수정 | 엣지 케이스 보강 — `width: 50%`/`flex-basis: auto` 등 모호한 CSS 역추론 정확도 향상 |
| `panels/styles/atoms/styleAtoms.ts`             | 수정 | parentDisplay/parentFlexDirection atom의 부모 요소 조회 로직 검증 및 보강           |
| `builder/stores/utils/sizeModeResolver.test.ts` | 신규 | inferSizeMode + resolveSizeMode 단위 테스트 (부모 컨텍스트별 분기 검증)             |

### 구현 순서

#### Step 1: 현재 TransformSection Size Mode UI 감사

**대상**: `TransformSection.tsx`

현재 구현 상태를 검증:

1. Fixed/Fill/Fit 3모드 세그먼트 컨트롤의 시각적 완성도 확인
2. 모드 전환 → CSS 속성 업데이트 정상 동작 검증
3. 현재 CSS에서 역추론된 모드가 세그먼트에 정확히 활성 표시되는지 확인
4. PropertyUnitInput과 Size Mode 간 동기화 확인 (모드 변경 → 값 입력 필드 업데이트)

#### Step 2: CSS 역추론 정확도 검증 및 보강

**대상**: `sizeModeResolver.ts`

`inferSizeMode()`의 엣지 케이스 검증:

| CSS 값                        | 기대 모드           | 현재 동작 확인 필요                 |
| ----------------------------- | ------------------- | ----------------------------------- |
| `width: 50%`                  | Fixed (50% 값 표시) | `%` 값이 Fixed로 추론되는지         |
| `flex-grow: 1; flex-basis: 0` | Fill                | flex-grow만 있고 flex-basis 누락 시 |
| `width: auto`                 | Fit                 | auto가 Fit으로 정확히 매핑되는지    |
| `width: fit-content`          | Fit                 | fit-content 키워드 처리             |
| `width: 100%; flex-grow: 1`   | Fill                | 중복 속성 시 우선순위               |
| `height: auto` (Block 자식)   | Fit                 | Block 컨텍스트에서 height auto 처리 |

보강이 필요한 경우 `inferSizeMode()`에 분기 추가.

#### Step 3: 부모 컨텍스트 감지 정확도 검증

**대상**: `styleAtoms.ts`의 `parentDisplayAtom`, `parentFlexDirectionAtom`

현재 atom이 선택 요소의 부모 display/flexDirection을 정확히 반영하는지 검증:

1. 부모가 없는 root 요소 → Block 기본값
2. 부모가 Flex Row → Fill Width = `flex-grow: 1`
3. 부모가 Flex Column → Fill Height = `flex-grow: 1`
4. 부모가 Grid → Fill = `stretch`
5. 부모가 Block → Fill Width = `width: 100%`, Fill Height 비활성

#### Step 4: 비활성 상태 힌트

**대상**: `TransformSection.tsx`

부모 컨텍스트에 따라 특정 모드가 의미 없는 경우 시각적 힌트 추가:

- Block 부모의 자식: Height Fill 비활성 (Block은 높이 채우기 불가) → 세그먼트 disabled + 툴팁 "Block 부모에서는 높이 채우기 불가"
- Root 요소(body 직접 자식): parentDisplay 기본값 적용

#### Step 5: 단위 테스트 작성

**대상**: `sizeModeResolver.test.ts` (신규)

테스트 매트릭스:

| 테스트 그룹                   | 케이스 수 | 내용                                                   |
| ----------------------------- | --------- | ------------------------------------------------------ |
| inferSizeMode (Block 부모)    | 6         | width: px/100%/auto/fit-content/%, height: px/auto     |
| inferSizeMode (Flex Row 부모) | 8         | flex-grow/flex-basis 조합, width: px/auto/fit-content  |
| inferSizeMode (Flex Col 부모) | 8         | flex-grow/flex-basis 조합, height: px/auto/fit-content |
| inferSizeMode (Grid 부모)     | 4         | justify-self/align-self: stretch vs auto               |
| resolveSizeMode (모든 부모)   | 12        | Fixed/Fill/Fit × Block/FlexRow/FlexCol/Grid            |
| 왕복 테스트                   | 6         | infer → resolve → infer 결과 일치 확인                 |

### Gate 검증 항목

| Gate | 검증 내용                   | 통과 조건                                                                      |
| ---- | --------------------------- | ------------------------------------------------------------------------------ |
| G1-1 | Fixed 모드 동작             | 값 입력 → width/height CSS 직접 설정, Canvas + Preview 동일 렌더링             |
| G1-2 | Fill 모드 동작 (Flex 부모)  | 세그먼트 선택 → `flex-grow: 1; flex-basis: 0` 설정, 요소가 남은 공간 채움      |
| G1-3 | Fill 모드 동작 (Block 부모) | 세그먼트 선택 → `width: 100%` 설정, 부모 너비 채움                             |
| G1-4 | Fit 모드 동작               | 세그먼트 선택 → `width: fit-content` 또는 `auto`, 콘텐츠에 맞춤                |
| G1-5 | CSS 역추론 정확도           | 기존 프로젝트 열기 → Size Mode 세그먼트가 현재 CSS 값을 정확히 반영 (95% 이상) |
| G1-6 | layoutVersion 계약          | Size Mode 변경 → `layoutVersion + 1` → Canvas 즉시 반영                        |
| G1-7 | 히스토리 통합               | Size Mode 변경 → Undo/Redo 정상 동작                                           |

### 예상 위험 및 대응

| 위험                                 | 등급  | 설명                                                                       | 대응                                                                                                                                                |
| ------------------------------------ | ----- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `%` 값의 모드 모호성                 | **M** | `width: 50%`가 Fixed인지 Fill인지 판단 어려움. 100%만 Fill? 기타 %도 Fill? | ADR 결정: **100%만 Fill, 기타 %는 Fixed(값 표시)**. sizeModeResolver에서 `100%` 특별 처리. 사용자가 직접 %를 입력하면 Fixed 모드에서 % 단위로 표시. |
| PropertyUnitInput 동기화             | **L** | Size Mode 변경 시 PropertyUnitInput의 값/단위가 올바르게 업데이트되어야 함 | `sizeModeToStyleUpdates()`가 반환하는 CSS 속성을 `updateSelectedStyle()`에 일괄 전달. PropertyUnitInput은 style atom 구독으로 자동 반영.            |
| 부모 display 변경 시 자식 CSS 불일치 | **L** | 부모를 block→flex로 변경하면 자식의 Fill 모드 CSS가 맞지 않을 수 있음      | Phase 1에서는 **사용자가 수동으로 모드 재선택**. Phase 4에서 자동 재매핑 구현 예정.                                                                 |
| TransformSection 기존 동작 회귀      | **L** | Size Mode UI 폴리싱으로 기존 width/height 직접 입력이 깨질 수 있음         | PropertyUnitInput 직접 입력 경로는 변경하지 않음. Size Mode는 래핑 UI이며 내부적으로 동일한 `updateSelectedStyle()` 호출.                           |

---

**관련 문서:**

- [ADR-008: Layout Engine](008-layout-engine.md) — Taffy WASM 단일 엔진
- [ADR-009: Figma-Class Rendering](009-full-tree-wasm-layout.md) — 렌더링/레이아웃 파이프라인
- [PENCIL_VS_XSTUDIO_UI_UX.md](../../legacy/PENCIL_VS_XSTUDIO_UI_UX.md) — Pencil 비교 분석 (정렬/배치/스냅)

---

## 이행 안 함 결정 (2026-05-13)

사용자 결정으로 다음 4건은 본 ADR scope 안에서 이행하지 않고 종결한다. Status 헤더 "Implemented (타협)" 의 근거.

| #   | 항목                                          | Phase                                  | 본문 명시 보류 사유                                                                                  | 처리 방향                                                                                     |
| --- | --------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `BoxModelDiagram.tsx` (신규 컴포넌트)         | Phase 3                                | "Box Model 다이어그램은 보류 — 핵심 가치 대비 복잡도 높음" (본문 §301)                               | 별 ADR 발의 필요 시 재평가. 현 시점 ROI 없음                                                  |
| 2   | 부모 display 변경 시 자식 CSS 자동 재매핑     | Phase 4                                | "위험도 높아 보류 — 사용자가 수동으로 모드 재선택" (본문 §307)                                       | 사용자가 모드 재선택하는 현 동작 유지. 향후 사용성 이슈 누적 시 재평가                        |
| 3   | 다중 선택 일괄 적용                           | Phase 4                                | "스타일 패널이 단일 selectedElementId 만 지원하므로 보류" (본문 §308)                                | 다중 선택 인프라가 도입되는 시점에 별 ADR 으로 묶어 처리                                      |
| 4   | `sizeModeResolver.test.ts` (단위 테스트 신규) | Phase 1 변경 파일 목록 §변경 파일 목록 | 변경 파일 목록에 "신규" 로 명시되었으나 land 0건 (`find` 검증) — G1-1~G1-7 Gate 검증 evidence 미land | 신규 회귀 발견 시점에 회귀 fixture 형태로 추가. 현재 동작 정합은 사용자 runtime 검증으로 갈음 |

본 결정은 본 ADR Status 를 `Partial` 에서 `Implemented (타협)` 로 전이하는 근거이며, 이후 본문은 `docs/adr/completed/026-responsive-constraint-ui.md` 로 이관 (`feedback-adr-closure-5-step.md` 절차).

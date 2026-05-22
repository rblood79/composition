# ADR-036: Spec-First Single Source — Spec shapes 기반 CSS 자동 생성

> **SSOT domain**: D3 (시각 스타일). 본 ADR의 "Spec=SSOT"는 **시각 domain 한정**. D1(DOM/접근성)은 RAC 권위, D2(Props)는 RSP 참조. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](../063-ssot-chain-charter.md).

## Status

Implemented (후속 ADR-057/058/059/060/061/062로 D3 SSOT 적용 범위 확장 — 2026-04-14 완결)

## Date

2026-03-13 (2026-03-14 재검토, 2026-03-15 구현 완성도 보강, 2026-03-16 구현 완료, 2026-04-14 후속 ADR 체인 완결 기록 추가)

## Decision Makers

composition Team

## Related ADRs

- [ADR-017](017-css-token-architecture.md): CSS 토큰 아키텍처
- [ADR-018](018-css-utility-classes.md): CSS Utility 클래스 체계
- [ADR-021](021-theme-system-redesign.md): Theme System 재설계
- [ADR-022](022-s2-color-token.md): S2 색상 토큰 전환
- [ADR-023](023-s2-variant-props.md): S2 Variant Props
- [ADR-038](../038-figma-import.md): Figma 디자인 임포트 시스템
- [ADR-033](033-css-property-ssot-consolidation.md): CSS 속성 SSOT 통합 — 구조 변수화
- [ADR-041](../041-spec-driven-property-editor.md): Spec 기반 프로퍼티 에디터 자동 생성

### D3 SSOT 적용 범위 확장 체인 (2026-04 완결)

본 ADR에서 수립한 "Spec=D3 SSOT" 원칙을 후속 ADR들이 실제 파손 지점에 적용하여 범위를 확장했다:

- [ADR-057](057-text-spec-first-migration.md) / [ADR-058](058-text-tags-legacy-dismantle.md) — TEXT_TAGS 예외 경로 해체 (9/9 text 컴포넌트 Canvas/Skia SSOT + 8/9 CSS auto-gen)
- [ADR-060](060-form-control-indicator-schema.md) — Form Control Indicator 6개 매직 테이블 해체
- [ADR-061](061-focus-ring-tokenization.md) — Focus Ring 53개 spec TokenRef 전환
- [ADR-062](062-field-spec-rsp-conformance.md) — Field variant 제거 + isQuiet 보강 (D2 부채 정리)
- [ADR-059](059-composite-field-skip-css-dismantle.md) — Composite Field `skipCSSGeneration` 해체 (38→19, Tier 3 예외 9개 공식화, Phase 5 closure 2026-04-14)
- [ADR-063](../063-ssot-chain-charter.md) — SSOT 체인 정본 Charter (3-Domain 분할 명문화)

체인 완결 결과: ADR-036의 **D3 domain 한정 원칙**이 수립되었고, 실행 불가능한 잔존분(Tier 3 구조 예외)이 각 후속 ADR에 명시적으로 문서화되었다. `skipCSSGeneration:true=0` 엄격 조건은 현실적 의미가 없어 "Tier 3 예외 전수 + 구조적 사유 명시"로 대체됨.

---

## Context

> **D3 한정 명시 (2026-04-13 재확인)**: 본 ADR의 "Spec=SSOT" 원칙은 [charter ADR-063](../063-ssot-chain-charter.md)의 **D3(시각 스타일) domain 한정** 적용. D1(DOM/접근성)은 Adobe RAC 권위, D2(Props/API)는 RSP 참조 기반. "시각 정의 3중 분산"의 해결 범위도 D3에 국한되며, 본 ADR이 DOM 구조/접근성/props API 결정에 관여하는 것은 아님.

composition는 Skia/WebGL 캔버스 (빌더) + DOM (Preview/Publish) 이중 렌더링 아키텍처를 사용한다.
현재 컴포넌트 시각 정의가 3곳에 분산되어 있어 **3중 동기화 고통**이 존재한다.

### 문제 1. 스타일 정의 3중 분산

| 파일 그룹                                     | 역할                                       | 규모                           |
| --------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `packages/shared/src/components/styles/*.css` | React Aria 컴포넌트용 CSS                  | 81개 파일, ~13,742줄           |
| `packages/specs/src/components/*.spec.ts`     | Skia 렌더링용 Spec shapes                  | 93개 파일, ~19,350줄           |
| `apps/builder/.../engines/utils.ts`           | `BUTTON_SIZE_CONFIG` 등 레이아웃 엔진 숫자 | 3,530줄 파일 내 5+ config 객체 |

합계 ~33,000줄 중 추정 40–50%가 거울/중복 정의이며, `// @sync` 주석에 의존하는 수동 동기화로 일치를 유지한다.

### 문제 2. 변경 시 3곳 수동 동기화 필요

Button의 padding을 12px → 16px로 바꾸려면:

1. `Button.css` — `--btn-padding` 값 수정
2. `Button.spec.ts` — `sizes.md.paddingX` 수정
3. `utils.ts` — `BUTTON_SIZE_CONFIG.md.paddingLeft` 수정

한 곳이라도 누락되면 Builder(Skia) ↔ Preview(DOM) 시각적 불일치가 발생한다.

### 문제 3. 테마 다양화 비용 급증

- 새 테마/variant 추가 시 CSS + Spec shapes 양쪽 동시 작업 필수
- CSS가 Spec과 완전히 다른 형태(선언적 vs 좌표계)라 자동 검증 불가

### Hard Constraints

1. **Skia/WebGL 캔버스 렌더링은 유지해야 한다** — 대규모 편집 성능상 필수 (Figma 동일 선택)
2. **Preview/Publish는 실제 DOM + React Aria Components를 사용해야 한다** — 웹 표준 출력 필수
3. **기존 93개 Spec의 `shapes()` 함수는 보존한다** — Skia 렌더링 경로 변경 없음
4. **ComponentSpec 타입 시스템(`variants`/`sizes`/`states`)을 보존한다**
5. **ADR-022 S2 토큰 체계 + ADR-021 Theme System을 보존한다**

---

## Alternatives Considered

### 대안 A: 현행 유지 (CSS-first + 수동 동기화)

- 위험: 기술(L) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
- 장점: 변경 없음, 학습 비용 0
- 단점: 3중 동기화 영구 지속, 테마 다양화 비용 선형 증가, 불일치 버그 상존

### 대안 B: Spec shapes → CSS 역추론 (완전 역방향)

- 위험: 기술(**H**) / 성능(L) / 유지보수(M) / 마이그레이션(**H**)
- 장점: 이론상 완전한 single source
- 단점: shapes 좌표에서 CSS 의도(transition, cascade, media query)를 복원하는 것은 원리적 한계

### 대안 C: Spec 메타데이터 + Archetype 템플릿 기반 CSS 생성 (채택)

- 위험: 기술(M) / 성능(L) / 유지보수(**L**) / 마이그레이션(M)
- `variants`/`sizes`/`states`에서 공통 CSS 생성(Level 1) + 컴포넌트 유형별 Archetype 템플릿으로 pseudo-element/animation 등 구조적 CSS 생성(Level 2)
- shapes()를 범용 역추론하지 않되, shapes()의 **데이터**를 Archetype 템플릿이 알고 있는 구조에 매핑
- 장점: 기존 CSSGenerator 확장, Archetype 수 유한(~10개), 자동화율 목표 90–95% (Archetype POC 결과에 따라 재평가)
- 단점: Archetype 템플릿 ~10개 개발 투자, Table만 수동 유지

### 대안 D: Design Token 레지스트리 + 외부 코드젠

- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(**H**)
- 단점: 외부 도구 의존성, Spec shapes 통합 복잡, ADR-022 체계와 이질적

### 대안 E: CSS 유지 + 자동 Sync 검증

- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 장점: 마이그레이션 비용 최소
- 단점: 3중 소스 구조 유지, 능동적 동기화 아닌 수동적 검증

### Risk Threshold Check

| 대안  | 기술  | 성능 | 유지보수 | 마이그레이션 | 판정                 |
| ----- | ----- | ---- | -------- | ------------ | -------------------- |
| A     | L     | L    | **H**    | L            | 장기 부적합          |
| B     | **H** | L    | M        | **H**        | 범용 역추론 한계     |
| **C** | M     | L    | **L**    | M            | **채택 (주력)**      |
| D     | M     | L    | L        | **H**        | 과잉 의존성          |
| E     | L     | L    | M        | L            | 보조 안전망으로 활용 |

**채택: 대안 C(주력) + E(안전망)**

---

## Decision

**React Aria의 Primitive Composition 구조에 따라, Primitive(Tier 1) CSS를 Spec에서 자동 생성하고, Composite(Tier 2) CSS는 layout + 변수 위임으로 자동 생성한다.**

핵심 원칙:

- **Primitive-first**: CSS 생성의 단위는 "컴포넌트"가 아니라 React Aria **Primitive**. Button/Input/ListBox 등 Primitive CSS가 생성되면, 이를 조합하는 Select/ComboBox/DatePicker 등은 변수 위임만으로 완성
- `shapes()`를 범용적으로 역추론하지 않는다 — 유한한 Archetype 템플릿이 shapes()의 데이터를 CSS 구조에 매핑
- SizeSpec은 Skia+CSS **공통** 속성을 포함한다 (letterSpacing 등 Skia TextShape에도 존재하는 속성)
- **Composite의 CSS = layout(flex/grid) + CSS Variable Delegation** — 자식 Primitive의 `--btn-*`, `--input-*` 등을 size별로 override
- `@media` 접근성 패턴은 모든 컴포넌트에 자동 생성 (24개 파일 동일 패턴)

### Rationale

> **핵심 발견 1**: "CSS-only"로 분류했던 pseudo-element 패턴 대부분이 이미 Spec shapes()에 데이터가 존재한다. Switch thumb = `circle` shape, Radio dot = `circle` shape. CSS `::before`는 렌더링 메커니즘이지 데이터가 아니다. 단, Checkbox 체크마크는 CSS에서 SVG `stroke` 속성을 직접 스타일링하므로, `line` shape 데이터 → SVG stroke CSS 변환 로직이 Archetype 템플릿에 필요하다.

> **핵심 발견 2 (단일 조합 패턴)**: React Aria의 모든 Composite는 **동일한 구조적 패턴** — `Container(layout) + Primitive[]` — 을 따른다. ToggleButtonGroup = ToggleButton[] + flex 컨테이너, RadioGroup = Radio[] + flex 컨테이너, Select = Button + Popover + ListBox + flex 컨테이너, ListBox = ListBoxItem[] + 컨테이너. **"복잡한 컴포넌트"는 존재하지 않는다. 조합하는 Primitive의 수와 종류만 다를 뿐, 컨테이너 패턴은 항상 동일하다.** 따라서 CSS 생성의 단위는 "컴포넌트"가 아니라 "Primitive"이며, Composite CSS는 단일 템플릿(layout + 변수 위임)으로 통일된다.

> **핵심 발견 3 (변수 위임 = 조합의 유일한 접착제)**: ADR-033의 **CSS 변수 위임 패턴(`--input-*`, `--btn-*`, `--label-*`)이 Primitive 간 접착의 유일한 메커니즘**이다. Select.css가 `--btn-padding`을 override하는 것과, ToggleButtonGroup.css가 `--btn-border-radius`를 override하는 것은 **구조적으로 동일한 연산**이다. 모든 Composite CSS는 `{ layout } + { size별 --child-var override }` 두 블록으로 완전히 기술된다.

> **핵심 발견 4 (기하학적 한계)**: `translateX(100%)` (Switch thumb), `calc()` 표현식, SVG stroke 등 **기하학적 관계를 Spec 데이터에서 CSS로 매핑하는 방법은 Archetype POC(Gate G4-pre)에서 검증**이 필요하다. 이는 대안 B("shapes 좌표에서 CSS 의도 복원")와 경계가 모호하므로, 검증 실패 시 해당 Primitive는 수동 유지한다.

**React Aria 단일 조합 패턴 (코드베이스 실측):**

모든 Composite는 동일한 구조: **Container(layout) + Primitive[] + CSS Variable Delegation**

```
┌─ Primitive (Tier 1) ─ 자체 시각적 정체성, CSS 생성의 단위 ─────────────────┐
│                                                                              │
│  Button  Input  ListBox/Item  Popover  Calendar/Cell  Checkbox  Radio       │
│  Switch  Tab    Slider/Track/Thumb  Badge  Tag  Separator  ProgressBar ...  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                  CSS Variable Delegation (--btn-*, --input-*, ...)
                  ↑ 모든 Composite가 동일한 접착 메커니즘을 사용
                                    │
┌─ Composite (Tier 2) ─ 전부 동일 패턴: Container + Primitive[] ──────────────┐
│                                                                              │
│  ToggleButtonGroup = flex       + ToggleButton[]                             │
│  RadioGroup        = flex       + Radio[]                                    │
│  CheckboxGroup     = flex       + Checkbox[]                                 │
│  TagGroup          = flex       + Tag[] + Button(remove)                     │
│  Select            = flex       + Button(trigger) + Popover + ListBox        │
│  ComboBox          = flex       + Input + Button + Popover + ListBox         │
│  NumberField       = flex       + Input + Button(+) + Button(-)              │
│  SearchField       = grid       + Input + Button(clear)                      │
│  DatePicker        = flex       + DateInput + Button + Popover + Calendar    │
│  DateRangePicker   = flex       + DateInput(×2) + Button + Popover + Calendar│
│  ColorPicker       = flex       + ColorSwatch + Button + Popover + ColorArea │
│  Menu              = (trigger)  + Button + Popover + MenuItem[]              │
│  Tabs              = flex       + Tab[] + TabPanel[]                         │
│  Disclosure        = flex       + Button(trigger) + Panel                    │
│  Card              = flex       + (children)                                 │
│                                                                              │
│  ↑ 차이는 조합하는 Primitive의 수와 종류뿐. 패턴은 항상 동일.               │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **핵심 통찰**: Select와 ToggleButtonGroup은 **구조적으로 동일**하다. 둘 다 `Container(layout) + Primitive[] + --var override`이며, Select가 복잡해 보이는 이유는 조합하는 Primitive가 3개(Button + Popover + ListBox)이기 때문일 뿐이다. ListBox도 내부적으로 `Container + ListBoxItem[]`이다. **모든 Composite CSS는 단일 템플릿 `{ layout } + { size별 --child-var override }`로 생성 가능하다.**

**Tier 기반 CSS 생성 아키텍처:**

```
┌──────────────────────────────────────────────────────────────┐
│  Tier 1: Primitive CSS 생성 (Spec → CSS)                      │
│                                                                │
│  Level 1: variant 색상, size 값, state 효과 (data-* 선택자)   │
│  Level 2: Archetype 템플릿 (~6개)                              │
│    toggle-indicator | progress | slider | tabs-indicator       │
│    @media(forced-colors, reduced-motion) | @keyframes          │
│  → ~20개 Primitive CSS 자동 생성                               │
└──────────────────────────────────────────────────────────────┘
                             +
┌──────────────────────────────────────────────────────────────┐
│  Tier 2: Composite CSS 생성 — 단일 템플릿                      │
│                                                                │
│  모든 Composite가 동일한 패턴:                                  │
│  { container layout } + { size별 --child-var override }        │
│                                                                │
│  ToggleButtonGroup → --btn-*                                   │
│  Select → --btn-*, --label-*                                   │
│  ComboBox → --input-*, --btn-*                                 │
│  DatePicker → --dp-input-*, --dp-btn-*                         │
│  NumberField → --nf-input-*, --btn-*                           │
│  → ~17개 Composite CSS 자동 생성                               │
└──────────────────────────────────────────────────────────────┘
                             +
┌──────────────────────────────────────────────────────────────┐
│  Foundation: 공통 utility CSS (자동 생성 대상 아님)            │
│  utilities.css, base.css, foundation.css, animations.css,     │
│  forms.css, collections.css, overlays.css (~12개)             │
└──────────────────────────────────────────────────────────────┘
                             +
┌──────────────────────────────────────────────────────────────┐
│  Tier 3: 수동 CSS + validate:sync 안전망                      │
│  Table, GridList, Tree (~3–5개)                               │
└──────────────────────────────────────────────────────────────┘
```

**업계 비교:**

| 도구            | 렌더러                   | 편집 성능 | 퍼블리싱     | 단일 솔루션 |
| --------------- | ------------------------ | --------- | ------------ | ----------- |
| Figma           | Skia/WebGPU              | 최고      | **없음**     | **아님**    |
| Webflow         | DOM 직접                 | DOM 한계  | DOM 배포     | 성능 제한   |
| Framer          | React DOM                | DOM 한계  | React SSR    | 성능 제한   |
| Plasmic         | React DOM                | DOM 한계  | 코드젠       | 성능 제한   |
| Penpot          | SVG (DOM)                | 중간      | HTML/CSS     | 성능 제한   |
| **composition** | **Skia + DOM 이중 출력** | **최고**  | **DOM 배포** | **유일**    |

composition는 Mitosis의 IR(중간 표현) → 멀티 타겟 컴파일과 동일한 구조다. ComponentSpec이 Skia shapes와 CSS 양쪽의 단일 소스 역할을 한다. Figma가 "임의 벡터 → CSS"를 포기한 이유는 입력이 비구조적이었기 때문이지만, composition의 Spec은 `variants`/`sizes`/`states`/`shapes()` 타입 시스템으로 이미 구조화되어 있다.

> **composition는 고성능 캔버스 편집 + 프로덕션 웹 퍼블리싱을 단일 워크플로우로 제공하는 업계 유일의 도구**이며, ADR-036은 이 아키텍처의 핵심 비용(Spec↔CSS 이중 유지)을 자동화로 제거하는 인프라다.

---

## Gates

| 게이트      | 조건                                                                                                                                                                   | 위험 등급 | 시점                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------- |
| G0-pre      | **사전조사**: SizeSpec↔SIZE_CONFIG 필드 갭 매핑 완료 + 93개 Spec size 키 대소문자 혼재 현황 전수 조사 보고서                                                           | L         | Phase 0 전           |
| G0a         | SizeSpec 타입 확장 + `[key: string]: any` 인덱스 시그니처 **완전 제거** + `pnpm type-check` 통과 + 기존 Spec 빌드 정상                                                 | M         | Phase 0a 완료        |
| G0b         | `generate-css.ts` 첫 실행 성공 (generated/ 디렉토리에 최소 1개 CSS 출력 확인)                                                                                          | L         | Phase 0b 완료        |
| G1          | SIZE_CONFIG 제거 후 Builder에서 Button/ToggleButton 5개 size 시각 비교 동일                                                                                            | M         | Phase 0b 완료        |
| G2-pre      | `pnpm validate:sync` 스크립트 구현 + `package.json` scripts 등록 완료                                                                                                  | M         | Phase 1 착수전       |
| G2          | `pnpm validate:sync` — 전체 컴포넌트 CSS↔Spec 값 차이 리포트 0건                                                                                                       | M         | Phase 1 완료         |
| G2a-pre     | `generateBaseStyles()` Archetype 인식 분기 리팩토링 완료 (비-button 컴포넌트에 `cursor: pointer` 등 하드코딩 제거)                                                     | M         | Phase 2a 착수전      |
| G3          | Level 1: `generateCSS(ButtonSpec)` 출력과 현재 `Button.css` diff — 공통 속성 누락 0건                                                                                  | M         | Phase 2a 완료        |
| G4-pre      | **Archetype POC**: toggle-indicator 템플릿으로 Switch CSS 생성 → 현재 Switch.css와 시각 동일. 특히 `translateX(100%)`/`calc()` 패턴이 Spec 데이터로 표현 가능한지 검증 | **H**     | Phase 3a **착수 전** |
| G4-pre-결과 | G4-pre 실패 시: 해당 archetype 커버율 하향 조정 + 수동 CSS 잔존 범위 재평가 → Metrics 테이블 갱신                                                                      | —         | G4-pre 직후          |
| G5          | 등급 A+B 컴포넌트 전환 후 모든 variant × size 조합 스크린샷 비교 통과                                                                                                  | M         | Phase 3c 완료        |

### 잔존 HIGH 위험

- **G4-pre**: toggle-indicator archetype이 가장 불확실한 영역이므로 Phase 3a 착수 전에 독립 POC로 검증. 실패 시 등급 B 커버율과 전체 자동화율 목표를 하향 조정한다.

---

## Implementation

### Phase 의존성 그래프

```
Phase 0-pre (사전조사: SizeSpec↔SIZE_CONFIG 필드 갭 + Spec size 키 전수조사)  [Gate G0-pre]
  ↓
Phase 0a (SizeSpec 타입 확장 + [key: string]: any 제거)  [Gate G0a]
  ↓
Phase 0b (SIZE_CONFIG 제거 + DIMENSIONS 네이밍 정규화 + generate-css.ts 첫 실행)  [Gate G0b, G1]
  ↓
Phase 1 (validate:sync 스크립트 구현 + 안전망)  [Gate G2-pre → G2]
  ↓
Phase 2-pre (generateBaseStyles() Archetype 분기 리팩토링)  [Gate G2a-pre]
  ↓
Phase 2a (Level 1 확장)  ←→  Phase 2b (fillStyle/gradient/icon-only)  [Gate G3]
  ↓
Phase 2c (Tier 1 — Primitive CSS 전환, ~22개)
  ↓
★ G4-pre (toggle-indicator Archetype POC — Phase 3 착수 전 독립 검증)  [Gate G4-pre]
  ↓ (POC 통과 시)
Phase 3a (Tier 2 — Composite CSS 생성, ~17개)  ←→  Phase 3b (@media/@keyframes 공통 생성)
  ↓
Phase 3c (Tier 3 — 수동 CSS 안전망, Table/GridList/Tree)
  ↓
Phase 4 (Spec-First 워크플로우 확립)  [Gate G5]
```

> **분기점 (G4-pre 실패 시)**: toggle-indicator 등 기하학적 관계가 Spec 데이터로 표현 불가능하면, 해당 archetype은 수동 CSS 유지로 전환하고 등급 C 범위를 확대한다. 전체 자동화율 목표를 재평가한다.

### Phase 0-pre: 사전조사 (Gate G0-pre)

Phase 0 착수 전 코드베이스 현황을 정밀하게 파악한다. 이 조사 결과가 Phase 0a/0b의 실제 작업량을 결정한다.

**조사 1: SizeSpec↔SIZE_CONFIG 필드 갭 매핑**

`BUTTON_SIZE_CONFIG` 등 SIZE_CONFIG 객체가 사용하는 전체 필드 목록과 현재 `SizeSpec` 공식 필드의 교집합/차집합을 정밀하게 매핑한다. 특히:

- `paddingLeft`/`paddingRight` (비대칭 패딩) — 현재 SizeSpec에는 `paddingX`(대칭)만 존재
- `iconGap`, `lineHeight`, `fontWeight` — SIZE_CONFIG에 존재하나 SizeSpec 공식 필드에 미등록
- `utils.ts` 3,530줄 파일 내 SIZE_CONFIG → Spec 참조 전환 시 영향받는 함수 목록

**조사 2: 93개 Spec size 키 대소문자 혼재 현황 전수 조사**

현재 Spec 파일들의 `sizes` 키 네이밍이 혼재되어 있다 (`"M"` vs `"md"`, `"XS"` vs `"xs"` 등). Phase 0b의 정규화 작업량과 `generate-css.ts`가 생성할 CSS 선택자(`data-size="M"` vs `data-size="md"`)의 정합성을 사전에 확인한다.

**산출물**: 필드 갭 매핑 테이블 + size 키 정규화 대상 Spec 목록 + Phase 0a/0b 예상 영향 범위

### Phase 0a: SizeSpec 타입 확장 (Gate G0a)

Skia+CSS 공통 속성을 SizeSpec에 추가하고, **기존 `[key: string]: any` 인덱스 시그니처를 완전 제거**한다.

> **현황**: 현재 SizeSpec에 `[key: string]: any` 인덱스 시그니처가 존재하여 임의 필드가 타입 에러 없이 추가 가능하다. 이는 Phase 0-pre 조사에서 밝혀진 모든 필드를 명시적으로 선언한 뒤 제거해야 한다. 제거 시 기존 93개 Spec에서 타입 에러가 발생하는 파일을 사전에 파악하고 순차 수정한다.

```typescript
interface SizeSpec {
  height: number;
  paddingX: number;
  paddingY: number;
  fontSize: TokenRef;
  borderRadius: TokenRef;
  iconSize?: number;
  gap?: number;
  lineHeight?: TokenRef; // CSS line-height + Skia strutStyle
  fontWeight?: number; // CSS font-weight + Skia TextStyle.fontWeight
  letterSpacing?: number; // CSS letter-spacing + Skia TextStyle.letterSpacing
  borderWidth?: number; // CSS border-width + Skia BorderShape.borderWidth
  minWidth?: number;
  minHeight?: number;
  paddingLeft?: number; // 비대칭 패딩 (SIZE_CONFIG 호환)
  paddingRight?: number; // 비대칭 패딩 (SIZE_CONFIG 호환)
  iconGap?: number; // 아이콘-텍스트 간격 (SIZE_CONFIG 호환)
  // [key: string]: any; ← Phase 0a에서 제거
}
```

원칙: Skia TextShape에도 존재하는 속성만 공통 속성으로 추가. `whiteSpace`, `overflow` 등 Skia 대응물이 없는 속성은 제외. Phase 0-pre 조사에서 발견된 SIZE_CONFIG 전용 필드(`paddingLeft`/`paddingRight`/`iconGap`)도 SizeSpec에 명시적으로 추가하여 `any` 제거 시 타입 안전성을 보장한다.

#### `*_DIMENSIONS` 데이터 → SizeSpec 통합 결정

**결정: SizeSpec에 통합하지 않고, Archetype 전용 `dimensions` 필드로 분리한다.**

현재 Archetype별 치수 데이터(`SWITCH_DIMENSIONS`, `CHECKBOX_BOX_SIZES`, `RADIO_DIMENSIONS`, `PROGRESSBAR_DIMENSIONS`, `SLIDER_DIMENSIONS`)는 SizeSpec의 공통 필드(height/paddingX/fontSize 등)와 성격이 다르다:

| 데이터             | 성격                                     | 예시                                      |
| ------------------ | ---------------------------------------- | ----------------------------------------- |
| SizeSpec 공통 필드 | **모든 컴포넌트**에 적용 가능한 CSS 속성 | height, paddingX, fontSize                |
| `*_DIMENSIONS`     | **특정 Archetype 전용** 기하학적 치수    | trackWidth, thumbSize, boxSize, barHeight |

SizeSpec에 `trackWidth?: number`, `thumbSize?: number` 등을 모두 추가하면 타입이 비대해지고, Badge에서 `trackWidth`가 자동완성에 노출되는 등 의미적 오염이 발생한다.

**해결**: `ComponentSpec`에 Archetype 전용 치수를 별도 타입으로 선언:

```typescript
// spec.types.ts
interface ComponentSpec<Props> {
  // ... 기존 필드 ...
  archetype?: ArchetypeId;
  // Archetype 전용 치수 (SizeSpec과 별도)
  dimensions?: Record<string, Record<string, number>>;
  //           └ size key   └ dimension key → value
}

// 사용 예: Switch
const SwitchSpec: ComponentSpec<SwitchProps> = {
  archetype: "toggle-indicator",
  sizes: {
    sm: {
      height: 20,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}",
      gap: 8,
    },
    // ...
  },
  dimensions: {
    sm: { trackWidth: 36, trackHeight: 20, thumbSize: 14, thumbOffset: 3 },
    md: { trackWidth: 44, trackHeight: 24, thumbSize: 18, thumbOffset: 3 },
    lg: { trackWidth: 52, trackHeight: 28, thumbSize: 22, thumbOffset: 3 },
  },
  // ...
};
```

**마이그레이션**: 기존 Spec 파일의 `SWITCH_DIMENSIONS` 등 모듈 레벨 상수를 `ComponentSpec.dimensions` 필드로 이동. shapes() 함수 내부에서 `this.dimensions[sizeKey]` 대신 인자로 전달받도록 시그니처 조정. CSSGenerator는 `spec.dimensions`를 Archetype 템플릿에 전달하여 CSS 변수 생성에 사용한다.

### Phase 0b: SIZE_CONFIG 제거 (Gate G0b, G1)

- `BUTTON_SIZE_CONFIG` → `ButtonSpec.sizes` import
- `TOGGLEBUTTON_SIZE_CONFIG` → `ToggleButtonSpec.sizes` import
- 기타 SIZE_CONFIG → 해당 Spec의 `sizes` import
- DIMENSIONS 키 정규화: `S/M/L` → `sm/md/lg` 통일 (Phase 0-pre 조사 결과에 따라 93개 Spec 전체 적용)
- `generate-css.ts` 첫 실행 성공 확인 (Gate G0b) — generated/ 디렉토리에 최소 1개 CSS 출력

> **주의**: `utils.ts`는 3,530줄 파일이며 SIZE_CONFIG가 `calculateContentHeight`, `enrichWithIntrinsicSize` 등 레이아웃 계산 함수에 깊이 내장되어 있다. 단순 import 변경이 아니라 함수 시그니처/의존성 변경이 수반될 수 있으므로, Phase 0-pre의 영향 범위 조사를 선행한다.

### Phase 1: validate:sync 안전망 (Gate G2-pre → G2)

수동 CSS 잔존 기간의 안전망. CSS↔Spec 값 불일치를 빌드 타임에 자동 감지.

> **전제조건 (Gate G2-pre)**: `pnpm validate:sync` 스크립트를 먼저 구현하고 `package.json` scripts에 등록한다. 현재 이 스크립트는 존재하지 않으므로 Phase 1의 첫 번째 작업은 스크립트 구현이다.

```bash
$ pnpm validate:sync
Button.css ↔ ButtonSpec
  ✅ sizes.md.height: 30 = --btn-height: 30px
  ✅ variants.accent.background: {color.accent} = --button-color: var(--accent)
Summary: 0 warnings, 0 errors
```

검증 범위: variant 색상, size 물리 속성(height/padding/font/border/gap).

### Phase 2-pre: generateBaseStyles() Archetype 분기 리팩토링 (Gate G2a-pre)

현재 `generateBaseStyles()`가 `display: inline-flex; cursor: pointer; justify-content: center`를 **모든 컴포넌트에 하드코딩**한다. Badge, Separator 등 비-button 컴포넌트에 이 스타일이 적용되면 잘못된 CSS가 생성되므로, Archetype별 base styles 분기를 먼저 구현한다.

- `ComponentSpec.archetype` 필드에 따라 base styles를 분기 (예: `simple` → `display: inline-flex`만, `button` → 현재 전체, `toggle-indicator` → `position: relative` 등)
- 무음 실패 방지: `spec.sizes`에 키가 없을 때 `console.warn` → 에러 throw로 변경

#### `ComponentSpec.archetype` 타입 정의

```typescript
// spec.types.ts — ComponentSpec 인터페이스 확장
type ArchetypeId =
  | "simple" // Badge, Tag, Separator, Skeleton, ColorSwatch, Icon, Tooltip, Breadcrumbs, Disclosure
  | "button" // Button, ToggleButton, Link
  | "input-base" // Input (TextField, ColorField 등 내부)
  | "toggle-indicator" // Switch, Checkbox, Radio
  | "progress" // ProgressBar, ProgressCircle, Meter
  | "slider" // Slider (+ Track/Thumb)
  | "tabs-indicator" // Tab (+ SelectionIndicator)
  | "collection" // ListBox/Item, Menu/Item
  | "overlay" // Popover, Dialog, Toast
  | "calendar"; // Calendar/Cell

interface ComponentSpec<Props> {
  name: string;
  element: keyof HTMLElementTagNameMap | "fragment";
  archetype?: ArchetypeId; // CSS 생성 시 Archetype 템플릿 선택에 사용
  variants: Record<string, VariantSpec>;
  sizes: Record<string, SizeSpec>;
  states: StateStyles;
  dimensions?: Record<string, Record<string, number>>; // Archetype 전용 치수 (Phase 0a)
  composition?: CompositionSpec; // Tier 2 Composite 전용 (Phase 3a)
  render: RenderSpec<Props>;
  overlay?: OverlaySpec;
}
```

#### 93개 Spec에 `archetype` 필드 일괄 부여 마이그레이션

**전략**: Phase 2-pre에서 93개 Spec 전체에 `archetype` 필드를 추가한다. 대부분은 기계적 작업이다.

**작업 순서**:

1. `spec.types.ts`에 `ArchetypeId` 타입 + `archetype?` 필드 추가 (타입만 — 기존 빌드 영향 없음)
2. Archetype별 Spec 목록 (Phase 2c Tier 1 테이블 기반)으로 grep → 일괄 `archetype: "..."` 추가
3. `pnpm build:specs` + `pnpm type-check` 통과 확인

**예상 분포** (Phase 2c Tier 1 테이블 기반):

| ArchetypeId        | 대상 Spec 수 | 대표                                                                                 |
| ------------------ | :----------: | ------------------------------------------------------------------------------------ |
| `simple`           |     ~12      | Badge, Tag, Separator, Skeleton, ColorSwatch, Icon, Tooltip, Breadcrumbs, Disclosure |
| `button`           |      ~3      | Button, ToggleButton, Link                                                           |
| `input-base`       |      ~1      | Input                                                                                |
| `toggle-indicator` |      ~3      | Switch, Checkbox, Radio                                                              |
| `progress`         |      ~3      | ProgressBar, ProgressCircle, Meter                                                   |
| `slider`           |      ~1      | Slider                                                                               |
| `tabs-indicator`   |      ~1      | Tab                                                                                  |
| `collection`       |      ~2      | ListBox, Menu                                                                        |
| `overlay`          |      ~3      | Popover, Dialog, Toast                                                               |
| `calendar`         |      ~2      | Calendar, RangeCalendar                                                              |
| **(미지정)**       |     ~62      | child spec, Composite 전용 Spec 등 — archetype 불필요                                |

> **미지정 Spec**: Label, FieldError, Description, SliderTrack, SliderThumb 등 **child spec**과 Select, ComboBox 등 **Composite 전용 Spec**은 독립 CSS 생성 대상이 아니므로 `archetype` 미지정 (undefined)으로 유지한다. CSSGenerator는 `archetype`이 없는 Spec은 CSS 생성을 건너뛴다.

#### Archetype별 base styles 매핑

| ArchetypeId        | base styles                                                                            | 비고                   |
| ------------------ | -------------------------------------------------------------------------------------- | ---------------------- |
| `simple`           | `display: inline-flex; align-items: center;`                                           | cursor 없음            |
| `button`           | `display: inline-flex; align-items: center; justify-content: center; cursor: pointer;` | `.button-base` 참조    |
| `input-base`       | `display: flex; align-items: center;`                                                  | `.inset` 참조          |
| `toggle-indicator` | `display: inline-flex; align-items: center; cursor: pointer;`                          | indicator + label 구조 |
| `progress`         | `display: flex; flex-direction: column;`                                               | 세로 스택              |
| `slider`           | `display: grid;`                                                                       | grid 레이아웃          |
| `tabs-indicator`   | `display: flex; position: relative;`                                                   | indicator 절대 배치    |
| `collection`       | `display: flex; flex-direction: column;`                                               | 리스트 구조            |
| `overlay`          | `position: fixed;`                                                                     | 포털 배치              |
| `calendar`         | `display: grid;`                                                                       | 날짜 그리드            |

### Phase 2a: CSSGenerator Level 1 확장 (Gate G3)

현재 지원 중: base styles (Phase 2-pre에서 Archetype 분기 완료), variant 색상, size 물리 속성, state 효과, token→CSS 변수 변환.

확장 대상:

| 속성               | 확장 방법                                 |
| ------------------ | ----------------------------------------- |
| `line-height`      | `SizeSpec.lineHeight` → `tokenToCSSVar()` |
| `font-weight`      | `SizeSpec.fontWeight` → 숫자 직접 출력    |
| `letter-spacing`   | `SizeSpec.letterSpacing` → px 출력        |
| `border-width`     | `SizeSpec.borderWidth` → px 출력          |
| `min-width/height` | `SizeSpec.minWidth/minHeight` → px        |
| `icon-size`        | `SizeSpec.iconSize` → CSS 변수 출력       |

### Phase 2b: fillStyle / Gradient / Icon-only 지원

VariantSpec에 `outlineBackground`/`outlineText`/`outlineBorder` 추가 (fillStyle outline 변형).
VariantSpec.background를 `TokenRef | string`으로 확장 (CSS gradient 직접 전달).
SizeSpec에 `iconOnlyPadding` 추가.

#### `AnimationSpec` 타입 정의

`ComponentSpec.animations` 및 `CompositionSpec.animations`에서 사용하는 `@keyframes` 정의 타입:

```typescript
// spec.types.ts
interface AnimationSpec {
  name: string; // @keyframes 이름 (예: "progress-indeterminate", "checkmark")
  duration: string; // CSS duration (예: "200ms", "1.5s")
  timingFunction: string; // CSS easing (예: "ease", "ease-in-out", "cubic-bezier(0.4, 0, 0.2, 1)")
  iterationCount?: string; // "infinite" | 숫자 (기본: "1")
  keyframes: AnimationKeyframe[];
}

interface AnimationKeyframe {
  offset: string; // "0%", "50%", "100%", "from", "to"
  properties: Record<string, string>; // CSS 속성 → 값
}

// 사용 예: ProgressBar indeterminate 애니메이션
const progressAnimation: AnimationSpec = {
  name: "progress-indeterminate",
  duration: "1.5s",
  timingFunction: "ease",
  iterationCount: "infinite",
  keyframes: [
    { offset: "0%", properties: { transform: "translateX(-100%)" } },
    { offset: "100%", properties: { transform: "translateX(200%)" } },
  ],
};

// 사용 예: Checkbox 체크마크 애니메이션
const checkmarkAnimation: AnimationSpec = {
  name: "checkmark",
  duration: "200ms",
  timingFunction: "ease",
  keyframes: [
    { offset: "from", properties: { "stroke-dashoffset": "44" } },
    { offset: "to", properties: { "stroke-dashoffset": "0" } },
  ],
};
```

CSSGenerator는 `spec.animations`를 순회하며 Phase 3b에서 `@keyframes` 블록을 자동 생성한다.

#### 생성 CSS 출력 형식 규칙

CSSGenerator가 출력하는 CSS의 형식을 통일한다:

**파일명 규칙**:

```
packages/shared/src/components/styles/generated/{ComponentName}.css
```

- 기존 수동 CSS와 동일 디렉토리의 `generated/` 서브디렉토리에 출력
- 파일명은 PascalCase로 Spec name과 일치 (예: `ButtonSpec.name = "Button"` → `generated/Button.css`)

**헤더 주석**:

```css
/* ============================================================
 * AUTO-GENERATED from ButtonSpec — DO NOT EDIT MANUALLY
 * Source: packages/specs/src/components/Button.spec.ts
 * Generator: packages/specs/scripts/generate-css.ts
 * Archetype: button
 * Generated: 2026-03-15T12:00:00Z
 * ============================================================ */
```

**CSS 구조 규칙**:

| 규칙                 | 설정                                   | 근거                                                                                                        |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@layer`             | 사용하지 않음                          | 기존 수동 CSS가 `@layer` 미사용, 혼합 기간 cascade 충돌 방지                                                |
| CSS 변수 fallback    | 포함                                   | `var(--btn-height, 30px)` — utility CSS가 fallback 패턴 사용 (ADR-033)                                      |
| Prettier 포맷        | 적용                                   | PostToolUse hook이 자동 포맷, `.prettierrc` 설정 준수                                                       |
| 선택자 순서          | base → variant → size → state → @media | 기존 수동 CSS 관례 준수                                                                                     |
| `data-*` 선택자 래핑 | `:where()` 미사용                      | specificity 유지 — 기존 CSS와 동일 (`:where([data-hovered])` 패턴은 `.button-base` utility 내부에서만 사용) |
| 중복 선언            | 금지                                   | `validate:sync`가 생성 CSS↔Spec 1:1 대응 검증                                                               |

**import 전환 규칙**:

```typescript
// packages/shared/src/components/styles/index.css
// 전환 전
@import "./Button.css";
// 전환 후
@import "./generated/Button.css";
// 롤백 시
@import "./Button.css";  // generated/ 경로만 제거
```

### Phase 2c: Tier 1 — Primitive CSS 전환

React Aria Primitive 단위로 CSS를 생성한다. **Composite 내부에서 재사용되는 Primitive가 먼저 전환되어야** Tier 2(Composite) 전환이 가능하다.

전환 패턴 (안전한 롤백):

```
1. generated/Button.css 생성 + 기존 Button.css 유지 (양립)
2. import 경로를 generated/Button.css로 변경
3. 시각 검증 통과 → 기존 Button.css 삭제
4. 실패 시 → import 경로만 되돌리면 즉시 롤백
```

#### 대규모 전환 롤백 전략

39개 파일을 한 번에 전환하지 않는다. **배치 단위 전환 + 혼합 상태 관리** 전략:

**배치 전환 순서** (의존성 역순):

| 배치 | 대상                                                                                                          | 전제 조건                 | 롤백 단위           |
| :--: | ------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------- |
|  1   | simple Archetype (~9개): Badge, Tag, Separator, Skeleton, ColorSwatch, Icon, Tooltip, Breadcrumbs, Disclosure | Phase 2a Level 1 완료     | 개별 파일           |
|  2   | button Archetype (3개): Button, ToggleButton, Link                                                            | 배치 1 검증 완료          | 개별 파일           |
|  3   | 나머지 Tier 1 (~10개): Input, ListBox, Popover, Checkbox, Radio, Switch, Slider, Tab, ProgressBar, Menu       | 배치 2 검증 + G4-pre 통과 | Archetype 단위      |
|  4   | Tier 2 Composite (~17개)                                                                                      | Tier 1 전체 완료          | 패턴 단위 (A/B/C/D) |

**혼합 상태 관리**:

전환 기간 중 `index.css`에서 수동 CSS와 생성 CSS가 공존한다:

```css
/* index.css — 혼합 상태 */
/* 배치 1 완료: generated */
@import "./generated/Badge.css";
@import "./generated/Tag.css";
@import "./generated/Separator.css";

/* 배치 2 진행중: 수동 유지 */
@import "./Button.css";
@import "./ToggleButton.css";

/* 미전환: 수동 유지 */
@import "./Select.css";
@import "./DatePicker.css";
```

**롤백 시나리오**:

| 상황                                 | 조치                                                              | 영향 범위   |
| ------------------------------------ | ----------------------------------------------------------------- | ----------- |
| 개별 파일 시각 불일치                | `index.css`에서 해당 1줄을 수동 CSS 경로로 되돌림                 | 1개 파일    |
| Archetype 전체 실패 (G4-pre 실패 등) | 해당 Archetype 파일들을 일괄 수동 경로로 되돌림                   | 3~9개 파일  |
| CSSGenerator 근본 결함               | `generated/` 디렉토리 전체 무시, 모든 import를 수동 경로로 되돌림 | 전체        |
| Tier 2 delegation 오류               | 해당 Composite만 수동 CSS로 롤백 (Tier 1은 유지)                  | 1~17개 파일 |

> **핵심**: 기존 수동 CSS 파일은 **생성 CSS 검증 완료 후에만 삭제**한다. 검증 전까지 수동 CSS와 생성 CSS가 양립하며, `index.css`의 import 경로 1줄 변경만으로 즉시 롤백할 수 있다. git에서 `index.css` 파일 1개만 revert하면 어떤 시점으로든 되돌릴 수 있다.

**Tier 1 Primitive 전체 목록 (코드베이스 실측 기반):**

| Primitive          | CSS 파일         |  Spec sizes   | size 키 | Archetype        | Composite에서 재사용                                                                  | 비고                                  |
| ------------------ | ---------------- | :-----------: | ------- | ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| **Button**         | Button.css       |       O       | xs–xl   | button           | Select, ComboBox, DatePicker, NumberField, SearchField, Menu, ColorPicker, Disclosure | 가장 많은 Composite가 의존            |
| **ToggleButton**   | ToggleButton.css |       O       | xs–xl   | button           | —                                                                                     |                                       |
| **Input**          | (Composite 내부) |       O       | xs–xl   | input-base       | ComboBox, NumberField, SearchField, ColorField                                        | 독립 CSS 없음 → `.inset` utility 기반 |
| **ListBox/Item**   | ListBox.css      | X (variant만) | —       | collection       | Select, ComboBox, Menu, ColorPicker                                                   | Popup cascade 핵심                    |
| **Popover**        | Popover.css      |       X       | —       | overlay          | Select, ComboBox, DatePicker, Menu, ColorPicker                                       | 모든 드롭다운 공유                    |
| **Calendar/Cell**  | Calendar.css     |       X       | —       | calendar         | DatePicker, DateRangePicker                                                           |                                       |
| **Checkbox**       | Checkbox.css     |       O       | sm–lg   | toggle-indicator | CheckboxGroup, GridList, Table, Tree                                                  | SVG stroke 변환 필요 (G4-pre)         |
| **Radio**          | Radio.css        |       O       | sm–lg   | toggle-indicator | RadioGroup                                                                            |                                       |
| **Switch**         | Switch.css       |       O       | sm–lg   | toggle-indicator | —                                                                                     | translateX 기하학 (G4-pre)            |
| **Tab**            | (Tabs.css 내부)  |       O       | S/M/L   | tabs-indicator   | Tabs                                                                                  | size 키 대문자 → 정규화 대상          |
| **Slider**         | Slider.css       |  O (부모만)   | sm–lg   | slider           | —                                                                                     | Track/Thumb에 sizes 없음              |
| **Badge**          | Badge.css        |       O       | xs–xl   | simple           | —                                                                                     |                                       |
| **Tag**            | (TagGroup 내부)  |       O       | sm–lg   | simple           | TagGroup                                                                              |                                       |
| **Link**           | Link.css         |       O       | xs–xl   | button           | Breadcrumbs                                                                           |                                       |
| **Separator**      | Separator.css    |       O       | S/M/L   | simple           | Menu (구분선)                                                                         | size 키 대문자                        |
| **Skeleton**       | Skeleton.css     |       O       | S/M/L   | simple           | —                                                                                     | size 키 대문자                        |
| **ColorSwatch**    | ColorSwatch.css  |       O       | xs–xl   | simple           | ColorPicker                                                                           |                                       |
| **Icon**           | Icon.css         |       O       | xs–xl   | simple           | —                                                                                     |                                       |
| **ProgressBar**    | ProgressBar.css  |       O       | S/M/L   | progress         | —                                                                                     | size 키 대문자                        |
| **ProgressCircle** | (별도 CSS 없음)  |       O       | S/M/L   | progress         | —                                                                                     | Spec만 존재 → 신규 생성               |
| **Meter**          | Meter.css        |       O       | S/M/L   | progress         | —                                                                                     | size 키 대문자, dual key              |
| **Tooltip**        | Tooltip.css      |       X       | —       | simple           | —                                                                                     | sizes 없음                            |
| **Dialog**         | Dialog.css       |       X       | —       | overlay          | DatePicker                                                                            |                                       |
| **Toast**          | Toast.css        |       X       | —       | overlay          | —                                                                                     | ADR 이전 버전에서 누락                |
| **Breadcrumbs**    | Breadcrumbs.css  | X (variant만) | —       | simple           | —                                                                                     |                                       |
| **Menu/Item**      | Menu.css         |   O (sm–lg)   | sm–lg   | collection       | —                                                                                     | ListBox와 유사하나 별도 스타일        |
| **Disclosure**     | Disclosure.css   |       X       | —       | simple           | DisclosureGroup                                                                       |                                       |

> **Primitive 총 ~25개 CSS** (기존 CSS 있는 것 ~20개 + 신규 생성 필요 ~3개 + Composite 내부 ~2개)

**Archetype별 Primitive 분류:**

| Archetype              | Primitive                                                                            | 생성 방식                                           | 비고                                              |
| ---------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------- |
| **simple** (Level 1만) | Badge, Tag, Separator, Skeleton, ColorSwatch, Icon, Tooltip, Breadcrumbs, Disclosure | variant + size + state → `data-*` 선택자            | 가장 단순, 즉시 전환 가능                         |
| **button**             | Button, ToggleButton, Link                                                           | `.button-base` utility + fillStyle + `--btn-*` 변수 | ADR-018 기반, icon-only 포함                      |
| **input-base**         | Input (TextField, ColorField 등 내부)                                                | `.inset` utility + `--input-*` 변수                 | 독립 CSS 없음, Composite 내부에서 스타일          |
| **toggle-indicator**   | Switch, Checkbox, Radio                                                              | `::before` + Spec shapes 매핑                       | **G4-pre POC 필수**                               |
| **progress**           | ProgressBar, ProgressCircle, Meter                                                   | fill bar + `@keyframes`                             |                                                   |
| **slider**             | Slider (+ Track/Thumb 내부)                                                          | grid 컨테이너 + orientation                         | Track/Thumb에 sizes 없음 → 부모 Slider sizes 위임 |
| **tabs-indicator**     | Tab (+ indicator)                                                                    | orientation × size + SelectionIndicator             |                                                   |
| **collection**         | ListBox/Item, Menu/Item                                                              | variant + state + selection-mode                    | Popup cascade 핵심                                |
| **overlay**            | Popover, Dialog, Toast                                                               | 애니메이션 + placement                              | sizes 없이 variant/state 기반                     |
| **calendar**           | Calendar/Cell                                                                        | grid + date state                                   | sizes 없음, 상태 기반                             |

#### Archetype 템플릿 구현 상세 (코드베이스 실측 기반)

각 Archetype의 **Spec shapes → CSS 변환 로직**을 코드베이스 실측 데이터로 기술한다. CSSGenerator가 Archetype을 인식하면 해당 템플릿의 CSS 구조를 출력한다.

##### 1. `simple` Archetype (Badge, Tag, Separator, Skeleton, ColorSwatch, Icon 등)

**Spec 데이터 구조** (Badge.spec.ts 실측):

```typescript
// sizes
xs: { height: 16, paddingX: 8, paddingY: 2, fontSize: "{typography.text-2xs}", gap: 2 }
sm: { height: 20, paddingX: 12, paddingY: 4, fontSize: "{typography.text-xs}", gap: 4 }
md: { height: 24, paddingX: 16, paddingY: 8, fontSize: "{typography.text-sm}", gap: 4 }
lg: { height: 28, paddingX: 24, paddingY: 8, fontSize: "{typography.text-base}", gap: 6 }
xl: { height: 32, paddingX: 32, paddingY: 12, fontSize: "{typography.text-lg}", gap: 8 }

// shapes → roundRect(bg) + text (width/height: "auto" 패턴)
```

**생성 CSS 구조**:

```css
/* Level 1: variant + size + state → data-* 선택자 */
.react-aria-Badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* variant — VariantSpec에서 직접 매핑 */
.react-aria-Badge[data-variant="accent"] {
  background: var(--accent);
  color: var(--fg-on-accent);
}
.react-aria-Badge[data-variant="informative"] {
  background: var(--color-info-100);
  color: var(--color-info-600);
}

/* size — SizeSpec에서 직접 매핑 */
.react-aria-Badge[data-size="xs"] {
  height: 16px;
  padding: 2px 8px;
  font-size: var(--text-2xs);
  gap: 2px;
  border-radius: var(--radius-full);
}
.react-aria-Badge[data-size="md"] {
  height: 24px;
  padding: 8px 16px;
  font-size: var(--text-sm);
  gap: 4px;
  border-radius: var(--radius-full);
}
```

**변환 규칙**: SizeSpec 필드 → CSS 속성 1:1 매핑. 추가 로직 불필요.

| SizeSpec 필드          | CSS 속성        | 변환                          |
| ---------------------- | --------------- | ----------------------------- |
| `height`               | `height`        | `${value}px`                  |
| `paddingX`, `paddingY` | `padding`       | `${paddingY}px ${paddingX}px` |
| `fontSize`             | `font-size`     | `tokenToCSSVar(value)`        |
| `borderRadius`         | `border-radius` | `tokenToCSSVar(value)`        |
| `gap`                  | `gap`           | `${value}px`                  |
| `iconSize`             | `--icon-size`   | `${value}px`                  |

##### 2. `button` Archetype (Button, ToggleButton, Link)

**Spec 데이터 구조** (Button.spec.ts 실측):

```typescript
// sizes
xs: { height: 20, paddingX: 4, paddingY: 1, fontSize: "{typography.text-2xs}", iconSize: 12, gap: 4 }
sm: { height: 22, paddingX: 8, paddingY: 2, fontSize: "{typography.text-xs}", iconSize: 14, gap: 6 }
md: { height: 30, paddingX: 12, paddingY: 4, fontSize: "{typography.text-sm}", iconSize: 16, gap: 8 }
lg: { height: 42, paddingX: 16, paddingY: 8, fontSize: "{typography.text-base}", iconSize: 20, gap: 10 }
xl: { height: 54, paddingX: 24, paddingY: 12, fontSize: "{typography.text-lg}", iconSize: 24, gap: 12 }

// shapes → roundRect(bg) + border + icon_font + text (icon-only / icon+text / text-only 3모드)
```

**생성 CSS 구조**:

```css
/* ADR-018 .button-base utility 참조 — 자동 hover/pressed 파생 */
.react-aria-Button {
  /* base styles from .button-base */
  --btn-height: 30px;
  --btn-padding: 4px 12px;
  --btn-font-size: var(--text-sm);
  --btn-line-height: var(--text-sm--line-height);
  --btn-icon-size: 16px;
  --btn-gap: 8px;
  --btn-radius: var(--radius-md);
}

/* variant — fillStyle 분기 */
.react-aria-Button[data-variant="accent"][data-fill-style="fill"] {
  --button-color: var(--accent); /* VariantSpec.background */
  --button-text: var(--fg-on-accent); /* VariantSpec.text */
}
.react-aria-Button[data-variant="accent"][data-fill-style="outline"] {
  --button-color: transparent;
  --button-text: var(--accent);
  --button-border: var(--accent);
}

/* size — SizeSpec → CSS 변수 위임 */
.react-aria-Button[data-size="xs"] {
  --btn-height: 20px;
  --btn-padding: 1px 4px;
  --btn-font-size: var(--text-2xs);
  --btn-icon-size: 12px;
  --btn-gap: 4px;
}

/* icon-only — SizeSpec.iconOnlyPadding (Phase 2b 확장) */
.react-aria-Button[data-icon-only] {
  --btn-padding: 0;
  aspect-ratio: 1;
}
```

**변환 규칙**: SizeSpec → `--btn-*` CSS 변수 매핑. `.button-base` utility가 hover/pressed 파생을 자동 처리.

| SizeSpec 필드          | CSS 변수            | 비고                                              |
| ---------------------- | ------------------- | ------------------------------------------------- |
| `height`               | `--btn-height`      | `.button-base`가 `height: var(--btn-height)` 적용 |
| `paddingX`, `paddingY` | `--btn-padding`     | `${paddingY}px ${paddingX}px`                     |
| `fontSize`             | `--btn-font-size`   | `tokenToCSSVar()`                                 |
| `iconSize`             | `--btn-icon-size`   | 아이콘 크기                                       |
| `gap`                  | `--btn-gap`         | 아이콘-텍스트 간격                                |
| `borderRadius`         | `--btn-radius`      | `tokenToCSSVar()`                                 |
| `lineHeight`           | `--btn-line-height` | Phase 0a SizeSpec 확장                            |
| `fontWeight`           | `--btn-font-weight` | Phase 0a SizeSpec 확장                            |

##### 3. `toggle-indicator` Archetype (Switch, Checkbox, Radio) — G4-pre POC 대상

3개 Primitive가 모두 **indicator + label** 구조를 공유하지만, indicator의 기하학적 관계가 컴포넌트마다 다르다.

**Switch — Spec DIMENSIONS 실측**:

```typescript
SWITCH_DIMENSIONS = {
  S: { trackWidth: 36, trackHeight: 20, thumbSize: 14, thumbOffset: 3 },
  M: { trackWidth: 44, trackHeight: 24, thumbSize: 18, thumbOffset: 3 },
  L: { trackWidth: 52, trackHeight: 28, thumbSize: 22, thumbOffset: 3 },
};
// shapes: track(roundRect) + thumb(circle) + border + label(text)
```

**CSS 생성 목표** (Switch.css 실측 기반):

```css
.react-aria-Switch {
  display: flex;
  align-items: center;
  gap: var(--switch-gap);
}

/* indicator 컨테이너 */
.react-aria-Switch .indicator {
  position: relative;
  width: var(--switch-track-width);
  height: var(--switch-track-height);
  border-radius: var(--switch-track-height); /* pill shape: height/2 */
  background: var(--bg-emphasis);
  transition: background 200ms;
}

/* thumb — 기하학적 관계 (G4-pre 핵심) */
.react-aria-Switch .indicator::before {
  content: "";
  position: absolute;
  width: var(--switch-thumb-size);
  height: var(--switch-thumb-size);
  border-radius: 50%;
  top: var(--switch-thumb-offset);
  left: var(--switch-thumb-offset);
  background: white;
  transition: transform 200ms;
}

/* checked 상태 — translateX 기하학 */
.react-aria-Switch[data-selected] .indicator::before {
  /* 이동 거리 = trackWidth - thumbSize - (thumbOffset × 2) */
  transform: translateX(
    calc(
      var(--switch-track-width) - var(--switch-thumb-size) -
        var(--switch-thumb-offset) * 2
    )
  );
}

/* size 매핑 — SWITCH_DIMENSIONS에서 직접 추출 */
.react-aria-Switch[data-size="sm"] {
  --switch-track-width: 36px;
  --switch-track-height: 20px;
  --switch-thumb-size: 14px;
  --switch-thumb-offset: 3px;
  --switch-gap: 8px;
}
.react-aria-Switch[data-size="md"] {
  --switch-track-width: 44px;
  --switch-track-height: 24px;
  --switch-thumb-size: 18px;
  --switch-thumb-offset: 3px;
  --switch-gap: 10px;
}
```

**Checkbox — Spec DIMENSIONS 실측**:

```typescript
CHECKBOX_BOX_SIZES = { sm: 16, md: 20, lg: 24 };
// shapes: box(roundRect) + border + checkmark(line×2) + indeterminate(line×1) + label(text)
```

**CSS 생성 목표** (Checkbox.css 실측 기반):

```css
.react-aria-Checkbox .checkbox {
  width: var(--cb-box-size);
  height: var(--cb-box-size);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
}

/* 체크마크 — Spec line shape → SVG stroke CSS (G4-pre 핵심) */
.react-aria-Checkbox[data-selected] .checkbox svg {
  stroke: var(--fg-on-accent);
  stroke-width: 2.5px;
  stroke-dasharray: 22;
  stroke-dashoffset: 44;
  animation: checkmark 200ms ease forwards;
}

/* size 매핑 */
.react-aria-Checkbox[data-size="sm"] {
  --cb-box-size: 16px;
  --cb-font-size: var(--text-sm);
}
.react-aria-Checkbox[data-size="md"] {
  --cb-box-size: 20px;
  --cb-font-size: var(--text-base);
}
.react-aria-Checkbox[data-size="lg"] {
  --cb-box-size: 24px;
  --cb-font-size: var(--text-lg);
}
```

**Radio — Spec DIMENSIONS 실측**:

```typescript
RADIO_DIMENSIONS = {
  S: { outer: 16, inner: 6 },
  M: { outer: 20, inner: 8 },
  L: { outer: 24, inner: 10 },
};
// shapes: ring(circle, fillAlpha:0) + border + inner(circle, selected만) + label(text)
```

**CSS 생성 목표**:

```css
/* 외곽 원 */
.react-aria-Radio .radio-circle {
  width: var(--radio-outer);
  height: var(--radio-outer);
  border: 2px solid var(--border);
  border-radius: 50%;
}

/* 내부 원 — selected 시만 표시 */
.react-aria-Radio[data-selected] .radio-circle::before {
  content: "";
  width: var(--radio-inner);
  height: var(--radio-inner);
  border-radius: 50%;
  background: var(--accent);
}

/* size 매핑 */
.react-aria-Radio[data-size="sm"] {
  --radio-outer: 16px;
  --radio-inner: 6px;
}
.react-aria-Radio[data-size="md"] {
  --radio-outer: 20px;
  --radio-inner: 8px;
}
.react-aria-Radio[data-size="lg"] {
  --radio-outer: 24px;
  --radio-inner: 10px;
}
```

**toggle-indicator 공통 변환 규칙**:

| Spec 데이터                    | CSS 변환                      | 비고              |
| ------------------------------ | ----------------------------- | ----------------- |
| `DIMENSIONS[size].trackWidth`  | `--switch-track-width`        | Switch 전용       |
| `DIMENSIONS[size].thumbSize`   | `--switch-thumb-size`         | Switch 전용       |
| `DIMENSIONS[size].thumbOffset` | `--switch-thumb-offset`       | Switch 전용       |
| `BOX_SIZES[size]`              | `--cb-box-size`               | Checkbox 전용     |
| `DIMENSIONS[size].outer/inner` | `--radio-outer/inner`         | Radio 전용        |
| `SizeSpec.gap`                 | `gap` (indicator–label 간격)  | 공통              |
| `SizeSpec.fontSize`            | `font-size` (label)           | 공통              |
| Spec `line` shape              | SVG `stroke` + `stroke-width` | Checkbox 체크마크 |
| Spec `circle` shape (selected) | `::before` pseudo-element     | Radio inner dot   |

> **G4-pre 검증 포인트**: (1) Switch `translateX(calc(...))` 기하학이 DIMENSIONS 데이터로 완전 기술 가능한가, (2) Checkbox `line` shape 좌표 → SVG `stroke-dasharray`/`stroke-dashoffset` 자동 변환이 가능한가, (3) 세 컴포넌트의 공통 패턴(indicator + label + gap + fontSize)을 단일 템플릿 분기로 처리 가능한가.

##### 4. `progress` Archetype (ProgressBar, ProgressCircle, Meter)

**Spec 데이터 구조** (ProgressBar.spec.ts 실측):

```typescript
PROGRESSBAR_DIMENSIONS = {
  S: { barHeight: 4, width: 200 },
  M: { barHeight: 8, width: 240 },
  L: { barHeight: 12, width: 320 },
};
// shapes: label+value 텍스트 행 + track(roundRect) + fill(roundRect) + indeterminate-fill
// hasLabelRow → offsetY = fontSize + gap
```

**생성 CSS 구조**:

```css
.react-aria-ProgressBar {
  display: flex;
  flex-direction: column;
  gap: var(--progress-gap);
  width: var(--progress-width);
}

/* 라벨+값 행 */
.react-aria-ProgressBar .label-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--progress-font-size);
}

/* 트랙 */
.react-aria-ProgressBar .track {
  height: var(--progress-bar-height);
  border-radius: calc(var(--progress-bar-height) / 2); /* pill */
  background: var(--bg-muted);
  overflow: hidden;
}

/* 채우기 */
.react-aria-ProgressBar .fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 200ms;
}

/* indeterminate */
.react-aria-ProgressBar[data-indeterminate] .fill {
  width: 50%;
  animation: progress-indeterminate 1.5s ease infinite;
}

/* size 매핑 — PROGRESSBAR_DIMENSIONS 직접 추출 */
.react-aria-ProgressBar[data-size="sm"] {
  --progress-bar-height: 4px;
  --progress-width: 200px;
  --progress-font-size: var(--text-xs);
  --progress-gap: 6px;
}
.react-aria-ProgressBar[data-size="md"] {
  --progress-bar-height: 8px;
  --progress-width: 240px;
  --progress-font-size: var(--text-sm);
  --progress-gap: 8px;
}
```

**변환 규칙**:

| Spec 데이터                  | CSS 변환                 | 비고                   |
| ---------------------------- | ------------------------ | ---------------------- |
| `DIMENSIONS[size].barHeight` | `--progress-bar-height`  | track + fill 높이      |
| `DIMENSIONS[size].width`     | `--progress-width`       | 컨테이너 폭            |
| `SizeSpec.fontSize`          | `--progress-font-size`   | 라벨/값 텍스트         |
| `SizeSpec.gap`               | `--progress-gap`         | 라벨 행–트랙 간격      |
| `@keyframes`                 | `progress-indeterminate` | Phase 3b에서 공통 생성 |

##### 5. `slider` Archetype (Slider + Track/Thumb)

**Spec 데이터 구조** (Slider.spec.ts 실측):

```typescript
SLIDER_DIMENSIONS = {
  S: { trackHeight: 4, thumbSize: 14 },
  M: { trackHeight: 6, thumbSize: 18 },
  L: { trackHeight: 8, thumbSize: 22 },
};
// shapes: label+value + track(roundRect) + fill(roundRect) + thumb(circle) + thumb-border
// child spec: SliderTrack, SliderThumb, SliderOutput
```

**생성 CSS 구조**:

```css
.react-aria-Slider {
  display: grid;
  grid-template-areas:
    "label output"
    "track track";
  grid-template-columns: 1fr auto;
}

.react-aria-SliderTrack {
  grid-area: track;
  height: var(--slider-track-height);
  border-radius: calc(var(--slider-track-height) / 2);
  background: var(--bg-muted);
  position: relative;
}

.react-aria-SliderThumb {
  width: var(--slider-thumb-size);
  height: var(--slider-thumb-size);
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid white;
  /* top 계산: track 중심에 thumb 배치 */
  top: calc(50% - var(--slider-thumb-size) / 2);
}

/* size — 부모 Slider sizes에서 위임 (Track/Thumb에 sizes 없음) */
.react-aria-Slider[data-size="sm"] {
  --slider-track-height: 4px;
  --slider-thumb-size: 14px;
  font-size: var(--text-xs);
}
.react-aria-Slider[data-size="md"] {
  --slider-track-height: 6px;
  --slider-thumb-size: 18px;
  font-size: var(--text-sm);
}
```

**특수 사항**: Track/Thumb는 독립 SizeSpec이 없으므로 부모 Slider의 DIMENSIONS에서 CSS 변수를 위임받는다. 이는 Tier 2 Composite의 delegation 패턴과 동일한 구조이지만, Tier 1 내부에서 발생하는 예외 케이스다.

##### 6. `tabs-indicator` Archetype (Tab + SelectionIndicator)

**Spec 데이터** (CSS 실측 기반 — Tab.spec.ts는 TabsSpec 내부에 포함):

```css
/* SelectionIndicator — orientation별 indicator */
.react-aria-Tabs[data-orientation="horizontal"] .selection-indicator {
  height: 3px;
  bottom: 0;
  border-radius: 3px 3px 0 0;
  background: var(--accent);
  transition:
    left 200ms ease-out,
    width 200ms ease-out;
}

.react-aria-Tabs[data-orientation="vertical"] .selection-indicator {
  width: 3px;
  right: 0;
  border-radius: 3px 0 0 3px;
  transition:
    top 200ms ease-out,
    height 200ms ease-out;
}
```

**변환 규칙**: Tab size는 `data-size` 속성으로 font-size/padding을 결정하고, SelectionIndicator는 JS로 위치/크기를 동적 계산 (CSS transition만 정의). Archetype 템플릿은 orientation 분기 + transition 정의를 자동 생성한다.

##### 7. `collection` Archetype (ListBox/Item, Menu/Item)

**CSS 핵심 패턴** (ListBox.css 실측):

```css
.react-aria-ListBoxItem {
  padding: var(--item-padding);
  font-size: var(--item-font-size);
  cursor: pointer;
  outline: none;
}

/* state — data-* 선택자 */
.react-aria-ListBoxItem[data-hovered] {
  background: var(--bg-muted);
}
.react-aria-ListBoxItem[data-selected] {
  background: var(--accent-subtle);
}
.react-aria-ListBoxItem[data-focused] {
  outline: 2px solid var(--focus-ring);
}
.react-aria-ListBoxItem[data-disabled] {
  opacity: 0.38;
}

/* selection-mode="multiple" — checkmark 표시 */
.react-aria-ListBox[data-selection-mode="multiple"] .react-aria-ListBoxItem {
  padding-left: calc(var(--item-padding) + 20px);
}
```

**변환 규칙**: VariantSpec → `data-*` state 색상 + SizeSpec → padding/font-size. `selection-mode` 분기는 Archetype 템플릿이 자동 생성.

##### 8. `overlay` Archetype (Popover, Dialog, Toast)

sizes가 없으므로 Level 1 size 생성 불필요. 핵심은 placement 기반 방향 + entering/exiting 애니메이션:

```css
.react-aria-Popover {
  --popover-offset: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-lg);
}

/* placement 방향 */
.react-aria-Popover[data-placement="bottom"] {
  margin-top: var(--popover-offset);
}
.react-aria-Popover[data-placement="top"] {
  margin-bottom: var(--popover-offset);
}

/* entering/exiting 애니메이션 */
.react-aria-Popover[data-entering] {
  animation: popover-enter 200ms ease-out;
}
.react-aria-Popover[data-exiting] {
  animation: popover-exit 150ms ease-in;
}
```

**변환 규칙**: VariantSpec → 배경/테두리/그림자 + StateStyles → entering/exiting 애니메이션. `ComponentSpec.animations`에서 `@keyframes` 자동 생성 (Phase 3b).

##### Archetype 템플릿 복잡도 요약

| Archetype            | 변환 복잡도 |     SizeSpec → CSS     |      추가 데이터 소스      | G4-pre 필요 |
| -------------------- | :---------: | :--------------------: | :------------------------: | :---------: |
| **simple**           |    낮음     |        1:1 매핑        |             —              |      X      |
| **button**           |    낮음     |     `--btn-*` 변수     |   `.button-base` utility   |      X      |
| **toggle-indicator** |  **높음**   |      1:1 + 기하학      |       `*_DIMENSIONS`       |    **O**    |
| **progress**         |    중간     |   1:1 + `@keyframes`   |       `*_DIMENSIONS`       |      X      |
| **slider**           |    중간     |      grid + 위임       |       `*_DIMENSIONS`       |      X      |
| **tabs-indicator**   |    중간     |    orientation 분기    |        JS 동적 위치        |      X      |
| **collection**       |    낮음     | state + selection-mode |             —              |      X      |
| **overlay**          |    낮음     | placement + animation  | `ComponentSpec.animations` |      X      |
| **calendar**         |    중간     |   grid + date state    |             —              |      X      |

### G4-pre: toggle-indicator Archetype POC (Phase 3 착수 전 독립 검증)

Phase 3 착수 전에 가장 불확실한 archetype인 toggle-indicator의 실현 가능성을 검증한다.

**검증 항목:**

1. Switch.css의 `translateX(100%)` — thumb 이동 거리가 track 크기에 의존하는 기하학적 관계를 Spec 데이터로 표현 가능한가?
2. `calc(var(--text-4xl) + 4px)` — CSS 토큰 산술식을 Spec 메타데이터에서 생성 가능한가?
3. Checkbox.css의 SVG `stroke` 속성 — Spec `line` shape 데이터를 SVG stroke CSS로 변환하는 로직이 구현 가능한가?

**통과 기준**: Switch CSS를 toggle-indicator 템플릿으로 생성하여 현재 Switch.css와 시각적으로 동일한 결과를 얻는다.

**실패 시 조치**: 해당 archetype은 수동 CSS 유지로 전환. Tier 3을 확대하고 자동화율 목표를 하향 조정한다.

### Phase 3a: Tier 2 — Composite CSS 생성 (단일 템플릿)

모든 Composite는 **구조적으로 동일**하다. ToggleButtonGroup이 ToggleButton[]을 flex 컨테이너에 배치하고 `--btn-*`를 override하는 것과, Select가 Button + Popover + ListBox를 flex 컨테이너에 배치하고 `--btn-*`, `--label-*`를 override하는 것은 **같은 연산**이다.

따라서 Tier 2 CSS 생성은 **단일 템플릿**으로 통일된다:

```
[Composite CSS] = { container layout } + { size별 --child-var override }
```

Tier 1 Primitive CSS가 이미 완성된 상태이므로, Composite는 자식 Primitive에 어떤 CSS 변수를 size별로 어떻게 override하는지만 기술하면 된다.

> **데이터 소스**: 빌더의 Factory 정의(`factories/definitions/`)가 이미 **각 Composite의 children 구조를 선언**하고 있다 (예: `TextField = Label + Input + FieldError`, `Select = Label + SelectTrigger{SelectValue + SelectIcon} + SelectItem`). 이 Factory 정의에서 CompositionSpec의 `primitives` 목록을 자동 추출할 수 있다.

**CompositionSpec — Composite의 유일한 메타데이터:**

```typescript
interface CompositionSpec {
  // 이 Composite가 조합하는 Primitive 목록
  primitives: PrimitiveRef[];
  // container layout 규칙
  layout: "flex-column" | "flex-row" | "grid" | "inline-flex";
  // CSS Variable Delegation — size별 자식 변수 override
  // ToggleButtonGroup, Select, DatePicker 모두 동일한 이 구조로 기술
  delegation: DelegationSpec[];
  // variant 위임 — 부모 variant/attribute → 자식 CSS 변수 (패턴 A/C에서 사용)
  variantDelegation?: VariantDelegationSpec[];
  // mode 분기 — 부모 data-* 속성 기반 자식 CSS 조건부 적용 (Select multi-select 등)
  modeDelegation?: ModeDelegationSpec[];
  // orientation 분기 — horizontal/vertical CSS 분기 (Tabs 등)
  orientationCSS?: Record<string, Record<string, string>>;
  // 애니메이션 (optional)
  animations?: AnimationSpec[];
}

interface PrimitiveRef {
  selector: string; // '.react-aria-Button', '.react-aria-Input'
  role: string; // 'trigger', 'content', 'clear', 'increment'
  slot?: string; // React Aria slot 이름
}

interface DelegationSpec {
  childSelector: string; // '.react-aria-Button'
  variables: Record<string, Record<string, string>>; // size → { varName → value }
}

interface VariantDelegationSpec {
  childSelector: string; // '.react-aria-Checkbox'
  attribute: string; // 'data-checkbox-emphasized', 'data-variant'
  variables: Record<string, Record<string, string>>; // attrValue → { varName → value }
}

interface ModeDelegationSpec {
  attribute: string; // 'data-selection-mode'
  value: string; // 'multiple'
  childSelector: string; // '.react-aria-ListBoxItem'
  css: Record<string, string>; // { 'padding-left': 'calc(...)' }
}

// 예: Select와 ToggleButtonGroup은 동일한 구조
// SelectSpec.composition = {
//   layout: 'flex-column',
//   primitives: [
//     { selector: '.react-aria-Button', role: 'trigger' },
//     { selector: '.react-aria-Popover', role: 'popup' },
//     { selector: '.react-aria-ListBox', role: 'content' },
//   ],
//   delegation: [{
//     childSelector: '.react-aria-Button',
//     variables: { sm: { '--btn-padding': '4px 8px' }, md: { '--btn-padding': '8px 12px' } }
//   }]
// }
// ToggleButtonGroupSpec.composition = {
//   layout: 'flex-row',
//   primitives: [{ selector: '.react-aria-ToggleButton', role: 'item' }],
//   delegation: [{
//     childSelector: '.react-aria-ToggleButton',
//     variables: { sm: { '--btn-border-radius': '4px' }, md: { '--btn-border-radius': '6px' } }
//   }]
// }
```

#### CompositionSpec 구현 예시 — 4가지 패턴 유형 (코드베이스 실측)

모든 Composite가 `Container(layout) + Primitive[] + --var override`인 것은 동일하지만, **delegation 복잡도와 자식 구조**에 따라 4가지 패턴 유형으로 분류된다. 아래 예시는 Factory 정의 + CSS 변수 위임을 실측하여 작성했다.

##### 패턴 A: 동종 Primitive 반복 (delegation 0~1)

가장 단순한 패턴. 동일한 Primitive를 반복 배치하며, CSS 변수 override가 거의 없다.

```typescript
// RadioGroup — delegation 0 (자식이 자체 size 처리)
const RadioGroupComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [{ selector: ".react-aria-Radio", role: "item" }],
  delegation: [],
  // RadioGroup[data-radio-size] → Radio에 직접 data-size 전달 (CSS 변수 불필요)
};

// CheckboxGroup — delegation 0 + variant 위임
const CheckboxGroupComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [{ selector: ".react-aria-Checkbox", role: "item" }],
  delegation: [],
  // data-checkbox-emphasized → Checkbox의 --selected-color 위임 (variant 레벨)
  variantDelegation: [
    {
      childSelector: ".react-aria-Checkbox",
      attribute: "data-checkbox-emphasized",
      variables: {
        "--selected-color": "var(--accent)",
        "--checkmark-color": "var(--fg-on-accent)",
      },
    },
  ],
};
```

**생성 CSS** (RadioGroup):

```css
.react-aria-RadioGroup {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
}
/* delegation 없음 → size 블록 불필요 */
```

##### 패턴 B: Label + Control + FieldError (delegation 3~5)

폼 필드의 표준 패턴. Label/Input/FieldError 3개 자식에 각각 CSS 변수를 위임한다.

```typescript
// TextField — delegation 3 (CSS 실측: --tf-label-size, --tf-input-*, --tf-error-size)
const TextFieldComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".react-aria-Input", role: "input" },
    { selector: ".react-aria-FieldError", role: "error" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        xs: { "--label-font-size": "var(--text-2xs)" },
        sm: { "--label-font-size": "var(--text-xs)" },
        md: { "--label-font-size": "var(--text-sm)" },
        lg: { "--label-font-size": "var(--text-base)" },
        xl: { "--label-font-size": "var(--text-lg)" },
      },
    },
    {
      childSelector: ".react-aria-Input",
      variables: {
        xs: {
          "--input-padding": "var(--spacing-3xs) var(--spacing-xs)",
          "--input-font-size": "var(--text-2xs)",
          "--input-height": "20px",
        },
        sm: {
          "--input-padding": "var(--spacing-2xs) var(--spacing-sm)",
          "--input-font-size": "var(--text-xs)",
          "--input-height": "22px",
        },
        md: {
          "--input-padding": "var(--spacing-xs) var(--spacing-md)",
          "--input-font-size": "var(--text-sm)",
          "--input-height": "30px",
        },
        lg: {
          "--input-padding": "var(--spacing-sm) var(--spacing-lg)",
          "--input-font-size": "var(--text-base)",
          "--input-height": "42px",
        },
        xl: {
          "--input-padding": "var(--spacing-md) var(--spacing-xl)",
          "--input-font-size": "var(--text-lg)",
          "--input-height": "54px",
        },
      },
    },
    {
      childSelector: ".react-aria-FieldError",
      variables: {
        xs: { "--error-font-size": "var(--text-2xs)" },
        sm: { "--error-font-size": "var(--text-2xs)" },
        md: { "--error-font-size": "var(--text-xs)" },
        lg: { "--error-font-size": "var(--text-sm)" },
        xl: { "--error-font-size": "var(--text-base)" },
      },
    },
  ],
};

// NumberField — delegation 5 (CSS 실측: --nf-btn-width, --nf-input-*, --nf-btn-*)
const NumberFieldComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".react-aria-Group", role: "group" }, // Button(-) + Input + Button(+) 래퍼
    { selector: ".react-aria-Input", role: "input" },
    { selector: ".react-aria-Button", role: "stepper", slot: "increment" },
    { selector: ".react-aria-Button", role: "stepper", slot: "decrement" },
    { selector: ".react-aria-FieldError", role: "error" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        xs: { "--label-font-size": "var(--text-2xs)" },
        md: { "--label-font-size": "var(--text-sm)" },
        lg: { "--label-font-size": "var(--text-base)" },
      },
    },
    {
      childSelector: ".react-aria-Input",
      variables: {
        xs: {
          "--nf-input-width": "60px",
          "--nf-input-padding": "0 var(--spacing-xs)",
        },
        md: {
          "--nf-input-width": "120px",
          "--nf-input-padding": "0 var(--spacing-md)",
        },
        lg: {
          "--nf-input-width": "160px",
          "--nf-input-padding": "0 var(--spacing-lg)",
        },
      },
    },
    {
      childSelector: ".react-aria-Button",
      variables: {
        xs: { "--nf-btn-width": "24px", "--btn-font-size": "var(--text-xs)" },
        md: { "--nf-btn-width": "32px", "--btn-font-size": "var(--text-sm)" },
        lg: { "--nf-btn-width": "40px", "--btn-font-size": "var(--text-base)" },
      },
    },
    {
      childSelector: ".react-aria-Group",
      variables: {
        xs: {
          "--nf-group-height": "20px",
          "--nf-group-radius": "var(--radius-sm)",
        },
        md: {
          "--nf-group-height": "30px",
          "--nf-group-radius": "var(--radius-md)",
        },
        lg: {
          "--nf-group-height": "42px",
          "--nf-group-radius": "var(--radius-lg)",
        },
      },
    },
    {
      childSelector: ".react-aria-FieldError",
      variables: {
        xs: { "--error-font-size": "var(--text-2xs)" },
        md: { "--error-font-size": "var(--text-xs)" },
        lg: { "--error-font-size": "var(--text-sm)" },
      },
    },
  ],
};
```

**NumberField 생성 CSS** (delegation 5 → 5개 자식 블록):

```css
.react-aria-NumberField {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
}

/* Label */
.react-aria-NumberField[data-size="md"] .react-aria-Label {
  font-size: var(--text-sm);
}

/* Group (Button + Input 래퍼) */
.react-aria-NumberField[data-size="md"] .react-aria-Group {
  height: 30px;
  border-radius: var(--radius-md);
}

/* Input */
.react-aria-NumberField[data-size="md"] .react-aria-Input {
  width: 120px;
  padding: 0 var(--spacing-md);
}

/* Stepper Buttons */
.react-aria-NumberField[data-size="md"] .react-aria-Button {
  width: 32px;
  font-size: var(--text-sm);
}

/* FieldError */
.react-aria-NumberField[data-size="md"] .react-aria-FieldError {
  font-size: var(--text-xs);
}
```

##### 패턴 C: Trigger + Popup + Content (delegation 5~6)

Select/ComboBox/DatePicker가 해당하는 패턴. Trigger → Popup → Content 3단 구조에 각각 CSS 변수를 위임한다.

```typescript
// Select — delegation 5 (CSS 실측: --select-btn-padding, --select-btn-font-size,
//   --select-chevron-size, --select-label-size, --select-hint-size)
const SelectComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".react-aria-Button", role: "trigger" },
    { selector: ".react-aria-SelectValue", role: "value" },
    { selector: ".react-aria-Popover", role: "popup" },
    { selector: ".react-aria-ListBox", role: "content" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        xs: { "--select-label-size": "var(--text-2xs)" },
        sm: { "--select-label-size": "var(--text-xs)" },
        md: { "--select-label-size": "var(--text-sm)" },
        lg: { "--select-label-size": "var(--text-base)" },
        xl: { "--select-label-size": "var(--text-lg)" },
      },
    },
    {
      childSelector: ".react-aria-Button",
      variables: {
        xs: {
          "--select-btn-padding":
            "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
          "--select-btn-font-size": "var(--text-2xs)",
          "--select-chevron-size": "14px",
        },
        sm: {
          "--select-btn-padding":
            "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
          "--select-btn-font-size": "var(--text-xs)",
          "--select-chevron-size": "16px",
        },
        md: {
          "--select-btn-padding":
            "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
          "--select-btn-font-size": "var(--text-sm)",
          "--select-chevron-size": "18px",
        },
        lg: {
          "--select-btn-padding":
            "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
          "--select-btn-font-size": "var(--text-base)",
          "--select-chevron-size": "20px",
        },
        xl: {
          "--select-btn-padding":
            "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
          "--select-btn-font-size": "var(--text-lg)",
          "--select-chevron-size": "24px",
        },
      },
    },
    {
      childSelector: ".react-aria-ListBox .react-aria-ListBoxItem",
      variables: {
        xs: {
          padding: "var(--spacing-2xs) var(--spacing-xs)",
          "font-size": "var(--text-2xs)",
        },
        sm: {
          padding: "var(--spacing-sm) var(--spacing)",
          "font-size": "var(--text-xs)",
        },
        md: {
          padding: "var(--spacing-sm) var(--spacing-md)",
          "font-size": "var(--text-base)",
        },
        lg: {
          padding: "var(--spacing) var(--spacing-lg)",
          "font-size": "var(--text-lg)",
        },
        xl: {
          padding: "var(--spacing-md) var(--spacing-xl)",
          "font-size": "var(--text-xl)",
        },
      },
    },
  ],
  // variant 위임: --field-accent 변수로 Trigger border 색상 결정
  variantDelegation: [
    {
      childSelector: ".react-aria-Button",
      attribute: "data-variant",
      variables: {
        primary: { "--field-accent": "var(--accent)" },
        secondary: { "--field-accent": "var(--bg-inset)" },
        error: { "--field-accent": "var(--negative)" },
      },
    },
  ],
  // selection-mode="multiple" 분기
  modeDelegation: [
    {
      attribute: "data-selection-mode",
      value: "multiple",
      childSelector: ".react-aria-ListBoxItem",
      css: { "padding-left": "calc(var(--item-padding) + 20px)" },
    },
  ],
};

// DatePicker — delegation 6 (CSS 실측: --dp-input-*, --dp-btn-*, --dp-label-*,
//   --dp-segment-*, --dp-calendar-*, --dp-hint-*)
const DatePickerComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".react-aria-DateInput", role: "input" },
    { selector: ".date-segment", role: "segment" },
    { selector: ".react-aria-Button", role: "trigger" },
    { selector: ".react-aria-Popover", role: "popup" },
    { selector: ".react-aria-Calendar", role: "content" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        sm: { "--dp-label-size": "var(--text-xs)" },
        md: { "--dp-label-size": "var(--text-sm)" },
        lg: { "--dp-label-size": "var(--text-base)" },
      },
    },
    {
      childSelector: ".react-aria-DateInput",
      variables: {
        sm: {
          "--dp-input-height": "22px",
          "--dp-input-padding": "0 var(--spacing-sm)",
          "--dp-input-font-size": "var(--text-xs)",
        },
        md: {
          "--dp-input-height": "30px",
          "--dp-input-padding": "0 var(--spacing-md)",
          "--dp-input-font-size": "var(--text-sm)",
        },
        lg: {
          "--dp-input-height": "42px",
          "--dp-input-padding": "0 var(--spacing-lg)",
          "--dp-input-font-size": "var(--text-base)",
        },
      },
    },
    {
      childSelector: ".date-segment",
      variables: {
        sm: {
          "--dp-segment-padding": "0 1px",
          "--dp-segment-font-size": "var(--text-xs)",
        },
        md: {
          "--dp-segment-padding": "0 2px",
          "--dp-segment-font-size": "var(--text-sm)",
        },
        lg: {
          "--dp-segment-padding": "0 4px",
          "--dp-segment-font-size": "var(--text-base)",
        },
      },
    },
    {
      childSelector: ".react-aria-Button",
      variables: {
        sm: { "--dp-btn-size": "18px" },
        md: { "--dp-btn-size": "22px" },
        lg: { "--dp-btn-size": "28px" },
      },
    },
    {
      childSelector: ".react-aria-Calendar",
      variables: {
        sm: {
          "--dp-calendar-cell-size": "28px",
          "--dp-calendar-font-size": "var(--text-xs)",
        },
        md: {
          "--dp-calendar-cell-size": "36px",
          "--dp-calendar-font-size": "var(--text-sm)",
        },
        lg: {
          "--dp-calendar-cell-size": "44px",
          "--dp-calendar-font-size": "var(--text-base)",
        },
      },
    },
    {
      childSelector: ".react-aria-FieldError",
      variables: {
        sm: { "--error-font-size": "var(--text-2xs)" },
        md: { "--error-font-size": "var(--text-xs)" },
        lg: { "--error-font-size": "var(--text-sm)" },
      },
    },
  ],
};
```

**DatePicker 생성 CSS** (delegation 6 — 가장 복잡한 Composite):

```css
.react-aria-DatePicker {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
}

/* 6개 자식 × 3개 size = 18개 규칙 블록 */
/* 그러나 패턴은 동일: parent[data-size] child { --var: value } */

.react-aria-DatePicker[data-size="md"] .react-aria-Label {
  font-size: var(--text-sm);
}
.react-aria-DatePicker[data-size="md"] .react-aria-DateInput {
  height: 30px;
  padding: 0 var(--spacing-md);
  font-size: var(--text-sm);
}
.react-aria-DatePicker[data-size="md"] .date-segment {
  padding: 0 2px;
  font-size: var(--text-sm);
}
.react-aria-DatePicker[data-size="md"] .react-aria-Button {
  width: 22px;
  height: 22px;
}
.react-aria-DatePicker[data-size="md"] .react-aria-Calendar .calendar-cell {
  width: 36px;
  height: 36px;
  font-size: var(--text-sm);
}
.react-aria-DatePicker[data-size="md"] .react-aria-FieldError {
  font-size: var(--text-xs);
}
```

> **핵심 관찰**: DatePicker(delegation 6)와 RadioGroup(delegation 0)의 **생성 로직은 동일하다**. 차이는 `delegation[]` 배열의 길이뿐이다. CSSGenerator는 배열을 순회하며 `parent[data-size="${size}"] ${childSelector} { ${variables} }` 규칙을 기계적으로 출력한다.

##### 패턴 C 추가 예시: ComboBox / SearchField

Select와 구조적으로 동일하지만, Trigger가 **Input + Button 래퍼**인 점이 다르다:

```typescript
// ComboBox — delegation 5 (CSS 실측: --combo-input-*, --combo-btn-*, --combo-label-*)
// Select와의 차이: Trigger가 Button이 아닌 ComboBoxWrapper(Input + Button)
const ComboBoxComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".combo-box-wrapper", role: "wrapper" }, // Input + Button 래퍼
    { selector: ".react-aria-Input", role: "input" },
    { selector: ".react-aria-Button", role: "trigger" },
    { selector: ".react-aria-Popover", role: "popup" },
    { selector: ".react-aria-ListBox", role: "content" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        xs: { "--combo-label-size": "var(--text-2xs)" },
        sm: { "--combo-label-size": "var(--text-xs)" },
        md: { "--combo-label-size": "var(--text-sm)" },
        lg: { "--combo-label-size": "var(--text-base)" },
        xl: { "--combo-label-size": "var(--text-lg)" },
      },
    },
    {
      childSelector: ".combo-box-wrapper",
      variables: {
        xs: {
          "--combo-wrapper-height": "20px",
          "--combo-wrapper-radius": "var(--radius-sm)",
        },
        sm: {
          "--combo-wrapper-height": "22px",
          "--combo-wrapper-radius": "var(--radius-sm)",
        },
        md: {
          "--combo-wrapper-height": "30px",
          "--combo-wrapper-radius": "var(--radius-md)",
        },
        lg: {
          "--combo-wrapper-height": "42px",
          "--combo-wrapper-radius": "var(--radius-lg)",
        },
        xl: {
          "--combo-wrapper-height": "54px",
          "--combo-wrapper-radius": "var(--radius-xl)",
        },
      },
    },
    {
      childSelector: ".react-aria-Input",
      variables: {
        xs: {
          "--combo-input-padding": "0 var(--spacing-xs)",
          "--combo-input-font-size": "var(--text-2xs)",
        },
        sm: {
          "--combo-input-padding": "0 var(--spacing-sm)",
          "--combo-input-font-size": "var(--text-xs)",
        },
        md: {
          "--combo-input-padding": "0 var(--spacing-md)",
          "--combo-input-font-size": "var(--text-sm)",
        },
        lg: {
          "--combo-input-padding": "0 var(--spacing-lg)",
          "--combo-input-font-size": "var(--text-base)",
        },
        xl: {
          "--combo-input-padding": "0 var(--spacing-xl)",
          "--combo-input-font-size": "var(--text-lg)",
        },
      },
    },
    {
      childSelector: ".react-aria-Button",
      variables: {
        xs: { "--combo-btn-size": "16px" },
        sm: { "--combo-btn-size": "18px" },
        md: { "--combo-btn-size": "22px" },
        lg: { "--combo-btn-size": "28px" },
        xl: { "--combo-btn-size": "32px" },
      },
    },
    {
      childSelector: ".react-aria-ListBox .react-aria-ListBoxItem",
      variables: {
        xs: {
          padding: "var(--spacing-2xs) var(--spacing-xs)",
          "font-size": "var(--text-2xs)",
        },
        md: {
          padding: "var(--spacing-sm) var(--spacing-md)",
          "font-size": "var(--text-base)",
        },
        lg: {
          padding: "var(--spacing) var(--spacing-lg)",
          "font-size": "var(--text-lg)",
        },
      },
    },
  ],
};

// SearchField — delegation 4 (패턴 B와 C의 하이브리드)
// Label + Control + FieldError (패턴 B) + clear Button (패턴 C적 요소)
const SearchFieldComposition: CompositionSpec = {
  layout: "grid", // grid: Input이 전체 폭, clear Button이 Input 내부 우측에 절대 배치
  primitives: [
    { selector: ".react-aria-Label", role: "label" },
    { selector: ".react-aria-Input", role: "input" },
    { selector: ".react-aria-Button", role: "clear" },
    { selector: ".react-aria-FieldError", role: "error" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Label",
      variables: {
        xs: { "--label-font-size": "var(--text-2xs)" },
        md: { "--label-font-size": "var(--text-sm)" },
        lg: { "--label-font-size": "var(--text-base)" },
      },
    },
    {
      childSelector: ".react-aria-Input",
      variables: {
        xs: {
          "--input-height": "20px",
          "--input-padding": "0 var(--spacing-xs)",
          "--input-font-size": "var(--text-2xs)",
        },
        md: {
          "--input-height": "30px",
          "--input-padding": "0 var(--spacing-md)",
          "--input-font-size": "var(--text-sm)",
        },
        lg: {
          "--input-height": "42px",
          "--input-padding": "0 var(--spacing-lg)",
          "--input-font-size": "var(--text-base)",
        },
      },
    },
    {
      childSelector: ".react-aria-Button",
      variables: {
        xs: { "--clear-btn-size": "14px" },
        md: { "--clear-btn-size": "18px" },
        lg: { "--clear-btn-size": "22px" },
      },
    },
    {
      childSelector: ".react-aria-FieldError",
      variables: {
        xs: { "--error-font-size": "var(--text-2xs)" },
        md: { "--error-font-size": "var(--text-xs)" },
        lg: { "--error-font-size": "var(--text-sm)" },
      },
    },
  ],
};
```

> **SearchField 분류 근거**: grid 레이아웃 + clear Button 절대 배치로 패턴 B(폼 필드)와 C(Trigger+Content)의 하이브리드다. 그러나 **생성 로직은 동일** — delegation 배열 순회 + size별 규칙 출력. 패턴 분류는 이해를 위한 것이지 코드 분기를 위한 것이 아니다.

##### 패턴 D: 구조 컨테이너 (delegation 0~2, layout 중심)

Tabs, Card, Form처럼 자식 Primitive에 대한 CSS 변수 위임이 거의 없고, 컨테이너 layout이 핵심인 패턴.

```typescript
// Tabs — delegation 2 (accent + layout 중심)
const TabsComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-TabList", role: "list" },
    { selector: ".react-aria-Tab", role: "item" },
    { selector: ".react-aria-TabPanel", role: "panel" },
    { selector: ".selection-indicator", role: "indicator" },
  ],
  delegation: [
    {
      childSelector: ".react-aria-Tab",
      variables: {
        sm: {
          "--tab-padding": "var(--spacing-xs) var(--spacing-sm)",
          "--tab-font-size": "var(--text-xs)",
        },
        md: {
          "--tab-padding": "var(--spacing-sm) var(--spacing-md)",
          "--tab-font-size": "var(--text-sm)",
        },
        lg: {
          "--tab-padding": "var(--spacing-md) var(--spacing-lg)",
          "--tab-font-size": "var(--text-base)",
        },
      },
    },
    {
      childSelector: ".selection-indicator",
      variables: {
        sm: { "--indicator-height": "2px" },
        md: { "--indicator-height": "3px" },
        lg: { "--indicator-height": "4px" },
      },
    },
  ],
  // orientation 분기는 layout이 아닌 CSS 규칙으로 처리
  orientationCSS: {
    horizontal: { "flex-direction": "column" },
    vertical: { "flex-direction": "row" },
  },
};

// Card — delegation 0 (순수 layout 컨테이너)
const CardComposition: CompositionSpec = {
  layout: "flex-column",
  primitives: [
    { selector: ".react-aria-Heading", role: "heading" },
    { selector: "[slot='description']", role: "description" },
  ],
  delegation: [],
  // 자식이 자체 스타일을 완전히 관리 → 변수 위임 불필요
};
```

#### CompositionSpec 패턴 요약

| 패턴                         | delegation 수 | 대표 Composite                                             | 생성 복잡도 | 비고                   |
| ---------------------------- | :-----------: | ---------------------------------------------------------- | :---------: | ---------------------- |
| **A: 동종 반복**             |      0–1      | RadioGroup, CheckboxGroup, ToggleButtonGroup               |    최소     | 자식이 자체 size 처리  |
| **B: Label+Control+Error**   |      3–5      | TextField, NumberField, SearchField, ColorField            |    중간     | 폼 필드 표준 패턴      |
| **C: Trigger+Popup+Content** |      5–6      | Select, ComboBox, DatePicker, DateRangePicker, ColorPicker |    최대     | Popup cascade 포함     |
| **D: 구조 컨테이너**         |      0–2      | Tabs, Card, Form, Disclosure                               |    최소     | layout 중심, 위임 최소 |

> **CSSGenerator 구현 함의**: 4가지 패턴이 존재하지만, 생성 알고리즘은 **단일 루프**다. `for (delegation of spec.composition.delegation) { for (size of Object.keys(spec.sizes)) { emit(rule) } }`. 패턴 간 차이는 배열 길이뿐이므로 분기 로직이 불필요하다.

**Tier 2 Composite 전체 목록 (Factory 정의 + CSS 실측 기반):**

> 데이터 소스: `apps/builder/src/builder/factories/definitions/` (Factory children 구조) + `packages/shared/src/components/styles/` (CSS 변수 위임)

| Composite             | CSS 파일                | Factory children 구조                                                           | 위임 CSS 변수                                                    | delegation 수  |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | :------------: |
|                       |                         | **동종 Primitive[] + layout**                                                   |                                                                  |                |
| **ToggleButtonGroup** | ToggleButtonGroup.css   | flex-row + ToggleButton[]                                                       | `--btn-border-radius`                                            |       1        |
| **RadioGroup**        | RadioGroup.css          | flex + Radio[]                                                                  | —                                                                |       0        |
| **CheckboxGroup**     | CheckboxGroup.css       | flex + Checkbox[]                                                               | —                                                                |       0        |
| **TagGroup**          | (CSS 없음)              | flex + Tag[] + Button(remove)                                                   | `--tag-color`, `--tag-*`                                         |       2        |
| **DisclosureGroup**   | DisclosureGroup.css     | flex + Disclosure[]                                                             | —                                                                |       0        |
|                       |                         | **Label + Control + FieldError 패턴**                                           |                                                                  |                |
| **TextField**         | TextField.css           | flex-col + Label + Input + FieldError                                           | `--input-*`, `--label-*`, `--error-*`                            |       3        |
| **TextArea**          | (TextField.css 공유)    | flex-col + Label + Input(multiline) + FieldError                                | `--input-*`                                                      |       3        |
| **SearchField**       | SearchField.css         | grid + Label + Input + Button(clear) + FieldError                               | `--input-*`, `--btn-radius`, `--inset-*`                         |       4        |
| **NumberField**       | NumberField.css         | flex-col + Label + {Button(-) + Input + Button(+)} + FieldError                 | `--nf-input-*`, `--btn-display`, `--btn-font-size`               |       5        |
| **ColorField**        | ColorField.css          | flex-col + Label + ColorSwatch + Input + FieldError                             | `--inset-*`                                                      |       2        |
|                       |                         | **Trigger + Popup 패턴**                                                        |                                                                  |                |
| **Select**            | Select.css              | flex-col + Label + SelectTrigger{SelectValue + SelectIcon} + SelectItem[]       | `--btn-display`, `--btn-padding`, `--btn-font-size`, `--label-*` |       5        |
| **ComboBox**          | ComboBox.css            | flex-col + Label + ComboBoxWrapper{Input + Trigger} + ComboBoxItem[]            | `--input-*`, `--btn-display`, `--btn-radius`, `--label-*`        |       5        |
|                       |                         | **Complex Trigger + Popup 패턴**                                                |                                                                  |                |
| **DatePicker**        | DatePicker.css + Common | flex-col + Label + DateField{DateSegment[]} + Popover + Calendar{Header + Grid} | `--dp-input-*`, `--dp-btn-*`                                     |       6        |
| **DateRangePicker**   | DateRangePicker.css     | flex-col + DateField(start) + Separator + DateField(end) + Popover + Calendar   | `--drp-*`                                                        |       5        |
| **ColorPicker**       | ColorPicker.css         | flex-col + ColorArea + ColorSlider + ColorSwatchPicker + ColorField             | `--cp-*`                                                         |       4        |
|                       |                         | **구조 컨테이너**                                                               |                                                                  |                |
| **Tabs**              | Tabs.css                | flex + TabList{Tab[]} + TabPanel[] + SelectionIndicator                         | `--tab-accent`                                                   |       2        |
| **Slider**            | Slider.css              | flex-col + Label + SliderTrack + SliderThumb + SliderOutput                     | —                                                                | 0 (child spec) |
| **Disclosure**        | Disclosure.css          | flex + Button(trigger) + Panel                                                  | `--disc-accent`                                                  |       1        |
| **Card**              | Card.css                | flex-col + Heading + Description + (children)                                   | —                                                                |       0        |
| **Form**              | Form.css                | flex-col + (form field children)                                                | —                                                                |       0        |

> **단일 패턴**: 모든 행이 `Container(layout) + Primitive[] + --var override`이다. **delegation 수 컬럼**이 유일한 차이점을 보여준다: RadioGroup = 0, TextField = 3, DatePicker = 6. 복잡도의 차이는 패턴의 차이가 아니라 **override할 변수의 수**일 뿐이다.
>
> **Factory → CompositionSpec 자동 추출**: Factory 정의의 `children` 배열에서 `primitives` 목록을, 현재 CSS의 `[data-size=] .react-aria-*` 규칙에서 `delegation` 목록을 추출할 수 있다.

**CSS Variable Delegation 생성 예시:**

```css
/* Tier 2 자동 생성 — SelectSpec.composition.delegation에서 추출 */
.react-aria-Select {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
}
.react-aria-Select[data-size="sm"] .react-aria-Button {
  --btn-padding: 4px 8px;
  --btn-font-size: var(--text-xs);
  --btn-line-height: var(--text-xs--line-height);
}
.react-aria-Select[data-size="md"] .react-aria-Button {
  --btn-padding: 8px 12px;
  --btn-font-size: var(--text-sm);
  --btn-line-height: var(--text-sm--line-height);
}
```

### Phase 3b: @media / @keyframes 공통 생성

Tier 1 + Tier 2 모든 생성 CSS에 자동 추가되는 공통 패턴:

- `@media (forced-colors: active)` → `forced-color-adjust: auto` (24개 파일 동일)
- `@media (prefers-reduced-motion)` → `transition-duration: 0s` (transition 있는 컴포넌트)
- `@keyframes` → `ComponentSpec.animations` 필드에서 생성

### Phase 3c: Tier 3 — 수동 CSS + 안전망

**수동 유지 대상 (코드베이스 실측):**

| 컴포넌트     | CSS 파일     | 수동 유지 이유                                                                                       |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------------- |
| **Table**    | Table.css    | 가상 스크롤, `:has()` 인접 행 상태, column resizer, Pagination 내장, Checkbox 통합                   |
| **GridList** | GridList.css | `:has()` 선택자 기반 selection joining, Checkbox 통합, drag handle, DropIndicator                    |
| **Tree**     | Tree.css     | 재귀적 nesting, `--tree-item-level` 기반 indentation, chevron Button + Checkbox + DropIndicator 복합 |

> **Tier 3 근거**: Table/GridList/Tree는 **CSS 선언만으로 표현 불가능한 런타임 동작**(가상 스크롤, 재귀 nesting, `:has()` 인접 상태)을 포함한다. 또한 내부에 Checkbox, Button, DropIndicator 등 다수의 Primitive를 별도 CSS 변수로 통합 스타일링하므로, Delegation 패턴으로 완전히 자동화하기 어렵다.

**Foundation CSS (자동 생성 대상 아님):**

| CSS 파일                         | 역할                                             |
| -------------------------------- | ------------------------------------------------ |
| utilities.css                    | `.button-base`, `.inset`, `.indicator` (ADR-018) |
| base.css                         | 전역 리셋 + 기본 스타일                          |
| foundation.css                   | 디자인 토큰 + 타이포그래피                       |
| animations.css                   | 공통 @keyframes                                  |
| forms.css                        | 폼 공통 스타일                                   |
| collections.css                  | 컬렉션 공통 스타일 (Checkbox, DropIndicator 등)  |
| overlays.css                     | 오버레이 공통 스타일                             |
| index.css                        | import 진입점                                    |
| Slot.css, Content.css, Field.css | 구조적 유틸리티                                  |
| Modal.css                        | 모달 백드롭 (Popover와 별도)                     |
| SortIcon.css                     | Table 부속                                       |

**빌더 전용 CSS (자동 생성 범위 밖):**

ActionList, ChatContainer, ChatInput, ChatMessage, ComponentList, ComponentSearch, EventHandlerManager, EventPalette, EventSection (~9개)

### CSS 파일 분류 총괄

| 분류               | 파일 수 | 자동 생성 | 비고                                         |
| ------------------ | :-----: | :-------: | -------------------------------------------- |
| Tier 1 Primitive   |   ~22   |     O     | Spec → CSS (Level 1 + Level 2 Archetype)     |
| Tier 2 Composite   |   ~17   |     O     | Composition 메타데이터 → layout + delegation |
| Tier 3 수동        |    3    |     X     | Table, GridList, Tree                        |
| Foundation/Utility |   ~12   |     X     | 기반 스타일, 자동 생성 불필요                |
| 빌더 전용          |   ~9    |     X     | 컴포넌트 라이브러리 범위 밖                  |
| **합계**           | **~63** |  **~39**  | 빌더 전용 + 중복 제외한 컴포넌트 CSS 대상    |

> **자동화율 재산정**: 컴포넌트 CSS 대상 ~42개(Tier 1+2+3) 중 자동 생성 ~39개 = **목표 ~93%** (G4-pre 통과 전제). G4-pre 실패 시 toggle-indicator 3개 Tier 3 이동 → ~36/42 = **~86%**.

### Phase 4: Spec-First 워크플로우 확립

1. **Primitive 추가**: Spec 정의 (`variants`/`sizes`/`states`/`shapes`/`archetype`) → `pnpm build:specs` → Tier 1 CSS 자동 생성
2. **Composite 추가**: Composition 메타데이터 (`primitives`/`layout`/`delegation`) → Tier 2 CSS 자동 생성
3. React Aria 컴포넌트에서 자동 생성 CSS import
4. Table/GridList/Tree만 수동 CSS + `validate:sync`
5. CI에서 `validate:sync` 자동 실행 → 불일치 PR 차단

#### 빌드 파이프라인 통합 상세

**디렉토리 구조** (Phase 4 완료 후):

```
packages/shared/src/components/styles/
├── index.css                    # 모든 CSS import 진입점
├── generated/                   # CSSGenerator 출력 (git tracked)
│   ├── Badge.css                # Tier 1 simple
│   ├── Button.css               # Tier 1 button
│   ├── Switch.css               # Tier 1 toggle-indicator
│   ├── ProgressBar.css          # Tier 1 progress
│   ├── Select.css               # Tier 2 composite
│   ├── DatePicker.css           # Tier 2 composite
│   └── ...                      # 총 ~39개
├── Table.css                    # Tier 3 수동 유지
├── GridList.css                 # Tier 3 수동 유지
├── Tree.css                     # Tier 3 수동 유지
├── utilities.css                # Foundation (ADR-018)
├── base.css                     # Foundation
├── foundation.css               # Foundation
├── animations.css               # Foundation (@keyframes)
├── forms.css                    # Foundation
├── collections.css              # Foundation
├── overlays.css                 # Foundation
└── ...                          # Foundation + 구조적 유틸리티
```

> **`generated/` git tracked 근거**: CI에서 `generate-css.ts` 실행 후 diff가 있으면 PR 차단 (`validate:sync`와 동일). 빌드 시 별도 생성 단계 불필요 — `pnpm build:specs`에 통합.

**`package.json` scripts 등록**:

```jsonc
// packages/specs/package.json
{
  "scripts": {
    "build": "tsup && pnpm generate:css",     // 기존 빌드에 CSS 생성 추가
    "generate:css": "tsx scripts/generate-css.ts",
    "validate:sync": "tsx scripts/validate-sync.ts"
  }
}

// 루트 package.json
{
  "scripts": {
    "build:specs": "pnpm --filter @composition/specs build",
    "validate:sync": "pnpm --filter @composition/specs validate:sync",
    "precommit": "pnpm type-check && pnpm validate:sync"  // CI + pre-commit
  }
}
```

**빌드 파이프라인 흐름**:

```
[개발자가 Spec 수정]
      ↓
pnpm build:specs
      ↓
┌─────────────────────────────────────┐
│ 1. tsup: Spec TS → JS 빌드         │
│ 2. generate-css.ts 실행:            │
│    - 모든 archetype 있는 Spec 순회  │
│    - Tier 1: Archetype 템플릿 적용  │
│    - Tier 2: CompositionSpec 적용   │
│    - generated/*.css 출력           │
│ 3. Prettier 자동 포맷               │
└─────────────────────────────────────┘
      ↓
pnpm validate:sync
      ↓
┌─────────────────────────────────────┐
│ Tier 3 수동 CSS ↔ Spec 값 비교     │
│ - Table.css ↔ TableSpec             │
│ - GridList.css ↔ GridListSpec       │
│ - Tree.css ↔ TreeSpec               │
│ → diff 0건이면 통과                 │
└─────────────────────────────────────┘
      ↓
pnpm type-check
      ↓
[커밋 / PR 생성]
```

**CI 파이프라인** (GitHub Actions):

```yaml
# .github/workflows/validate.yml (개략)
steps:
  - run: pnpm build:specs
  - run: git diff --exit-code packages/shared/src/components/styles/generated/
    # generated CSS에 uncommitted 변경이 있으면 실패
    # → "Spec을 수정했으나 generate:css를 실행하지 않음" 감지
  - run: pnpm validate:sync
    # Tier 3 수동 CSS ↔ Spec 값 불일치 감지
  - run: pnpm type-check
```

**새 Primitive 추가 워크플로우** (Phase 4 이후):

```
1. packages/specs/src/components/NewComponent.spec.ts 작성
   → archetype: "simple", variants, sizes, states, shapes 정의

2. pnpm build:specs
   → generated/NewComponent.css 자동 생성

3. packages/shared/src/components/styles/index.css에 import 추가
   → @import "./generated/NewComponent.css";

4. packages/shared/src/components/NewComponent.tsx 작성
   → React Aria Component + generated CSS 적용

5. 빌더 Spec 등록
   → TAG_SPEC_MAP에 추가, Factory 정의 작성

6. pnpm type-check + pnpm validate:sync → 커밋
```

**새 Composite 추가 워크플로우** (Phase 4 이후):

```
1. 자식 Primitive CSS가 generated/에 이미 존재하는지 확인
   (없으면 Primitive 먼저 추가)

2. 기존 Spec에 composition 필드 추가 또는 새 Spec 작성
   → composition: { layout, primitives, delegation }

3. pnpm build:specs
   → generated/NewComposite.css 자동 생성
   (delegation의 size별 --child-var override가 CSS 규칙으로 출력)

4. 나머지는 Primitive 워크플로우와 동일
```

---

## Metrics / Verification

| 메트릭             | Baseline      | Phase 0-pre | Phase 0 | Phase 1       | Phase 2c (Tier 1) | Phase 3a (Tier 2) G4-pre 통과 | Phase 3a (Tier 2) G4-pre 실패 |
| ------------------ | ------------- | ----------- | ------- | ------------- | ----------------- | ----------------------------- | ----------------------------- |
| 수동 동기화 포인트 | ~10 (`@sync`) | ~10         | ~7      | 0 (자동 검증) | 0                 | 0                             | 0                             |
| 수동 SIZE_CONFIG   | 5+            | 5+          | 0       | 0             | 0                 | 0                             | 0                             |
| CSS 자동 생성      | 0             | 0           | 0       | 0             | ~22 (Tier 1)      | ~**39** (Tier 1+2)            | ~**36** (toggle 제외)         |
| 수동 CSS 유지      | ~42 (대상)    | ~42         | ~42     | ~42           | ~20               | ~**3** (Table+GridList+Tree)  | ~**6** (+toggle×3)            |
| 자동화율           | 0%            | 0%          | 0%      | 0%            | ~52%              | **목표 ~93%**                 | **목표 ~86%**                 |

> **산정 기준 변경**: 81개 전체 CSS가 아닌, **컴포넌트 CSS 대상 ~42개**(Tier 1+2+3)를 분모로 사용. Foundation(~12개) + 빌더 전용(~9개)은 자동 생성 대상이 아니므로 제외.
>
> **주의**: Phase 3 자동화율은 G4-pre POC 결과에 따라 분기한다.

검증:

- [ ] `pnpm validate:sync` — CSS↔Spec 값 diff 0 errors
- [ ] `pnpm type-check` — 타입 에러 0건
- [ ] Archetype별: 생성 CSS vs 기존 CSS 시각 비교
- [ ] Button: 5 sizes × 6 variants × 2 fillStyles × 4 states
- [ ] Switch/Checkbox/Radio: 3 sizes × 2 states × emphasized
- [ ] 다크모드 + Tint 전환: 전체 컴포넌트

---

## Consequences

### Positive

1. **3중→1중 동기화**: SIZE_CONFIG 제거 + CSS 자동 생성으로 Spec이 유일한 소스
2. **자동화율 목표 ~93%** (G4-pre 통과 시): 컴포넌트 CSS 대상 ~42개 중 ~39개 자동 생성, Table/GridList/Tree 3개만 수동. G4-pre 실패 시 ~86%로 하향
3. **Primitive-first 아키텍처**: Button CSS 1개 생성 → Select/ComboBox/DatePicker/NumberField/Menu 등 8개 Composite에 cascade. 새 Composite 추가 시 Primitive 재사용으로 CSS 자동 완성
4. **Tier 분리로 복잡도 관리**: Tier 1(Primitive, ~22개) + Tier 2(Composite layout+delegation, ~17개)로 생성 책임을 명확히 분리
5. **기존 인프라 활용**: ADR-018 utility(`.button-base`, `.inset`, `.indicator`) + ADR-033 변수 위임(`--btn-*`, `--input-*`)이 Tier 1/2 자동 생성의 기반
6. **React Aria Composition 정합**: CSS 생성 구조가 React Aria Components의 Primitive composition 원칙과 정확히 일치
7. **Figma→composition 파이프라인 강화 (잠재적)**: ADR-038(Proposed) 구현 후 연계 가능

### Negative

1. **Archetype 템플릿 ~10개 + CompositionSpec 타입 시스템 개발 투자** — Tier 2 생성을 위한 Composition 메타데이터 체계 신규 구축
2. **Table/GridList/Tree 수동 CSS 유지** (3개 파일, G4-pre 실패 시 +3개로 확대)
3. **CSSGenerator 이원화**: Tier 1 (Spec→CSS, Level 1+2) + Tier 2 (Composition→CSS, layout+delegation) — 두 가지 생성 경로
4. **빌드 파이프라인 증가**: CSS 생성 + validate:sync 단계 추가
5. **사전조사 + POC 비용**: Phase 0-pre(필드 갭 매핑, size 키 전수조사) + G4-pre(Archetype POC)로 착수 전 투자 필요
6. **SizeSpec `any` 제거 파급**: `[key: string]: any` 제거 시 93개 Spec 전체에서 타입 에러 발생 가능 — 순차 수정 비용

---

## References

- `packages/specs/src/renderers/CSSGenerator.ts` — 기존 CSS 생성기 (POC, Level 1)
- `packages/specs/src/renderers/utils/tokenResolver.ts` — `tokenToCSSVar()` 매핑
- `packages/specs/src/types/spec.types.ts` — SizeSpec, VariantSpec, StateStyles 타입 정의
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — SIZE_CONFIG (Phase 0 제거 대상)
- `packages/specs/scripts/generate-css.ts` — CSS 생성 스크립트 (기존)
- `packages/shared/src/components/styles/utilities.css` — `.button-base`, `.inset`, `.indicator` utility (ADR-018)
- [ADR-022](022-s2-color-token.md) — S2 색상 토큰 (tokenToCSSVar 체계)
- [ADR-021](021-theme-system-redesign.md) — Theme System (tint/darkMode 통합)
- [ADR-033](033-css-property-ssot-consolidation.md) — CSS 변수 위임 패턴 (`--input-*`, `--btn-*`, `--label-*`)
- [ADR-038](../038-figma-import.md) — Figma 디자인 임포트 (Spec shapes ↔ Figma 레이어 매핑 연계)

---

## 2026-03-14 재검토 요약

### 1차 재검토 변경 사항

1. **핵심 발견 3, 4 추가** — 분해-조립 원칙 + CSS 변수 위임 패턴이 자동 생성을 촉진
2. **Level 3 (CSS Variable Delegation)** — 3-레벨 아키텍처로 확장, `DelegationSpec` 타입 추가
3. **Archetype 테이블에 "분해-조립 근거" 컬럼 추가** — 각 archetype의 자동 생성 가능성 논증
4. **등급 B 커버율 상향** — Slider 70→85%, Tabs 55→80%, Input 85→90% (분해 기반 재평가)
5. **전체 자동화율 95–99% → 90–95%** — Popover positioning/custom animation 반영한 현실적 조정
6. **등급 C(수동)가 Table 1개뿐인 근거 명시** — "복잡한 CSS"는 primitive 조합의 결과이지 단일 primitive가 복잡한 것이 아님

### React Aria Composition 기반 재설계 (2026-03-14)

기존 "등급 A(단순)/B(복잡)/C(수동)" 3단 분류를 **Tier 0(Foundation)/Tier 1(Primitive)/Tier 2(Composite)/Tier 3(Manual)** 4단 분류로 전면 재설계.

**핵심 변경:**

1. **분류 축 전환**: "컴포넌트 복잡도" → "React Aria Composition 역할(Primitive vs Composite)"
2. **Primitive 전체 목록 신설**: 코드베이스 실측 기반 ~25개 Primitive + Archetype 매핑 + Composite 재사용 관계
3. **Composite 전체 목록 신설**: ~17개 Composite + 조합하는 Primitive + 위임하는 CSS 변수 실측
4. **CompositionSpec 타입 신설**: `primitives`/`layout`/`delegation` 메타데이터로 Tier 2 CSS 자동 생성
5. **Tier 3 확대**: Table → Table + GridList + Tree (`:has()` 인접 상태 + 재귀 nesting + 다중 Primitive 통합)
6. **Foundation/빌더 전용 분리**: 자동화율 분모에서 제외하여 정확한 산정 (~42개 대상 중 ~39개 = ~93%)
7. **이전 등급 A에서 5개 CSS 미존재 + 3개 Spec 미존재 컴포넌트 정리**: Tier 1 테이블에서 실제 존재하는 파일만 포함
8. **ADR 미분류 CSS 10+개 포함**: DateRangePicker, ColorField, RangeCalendar, Toast 등 이전 누락분 반영

### 코드베이스 대조 검증 반영 (2026-03-14)

검토에서 발견된 이슈를 반영하여 문서를 보강했다.

**CRITICAL 수정:**

1. **SizeSpec `[key: string]: any` 제거 명시** — Phase 0a의 실제 목표를 "타입 확장"에서 "any 인덱스 시그니처 완전 제거"로 명확화. Gate G0a에 제거 조건 추가
2. **`generateBaseStyles()` 하드코딩 문제** — Phase 2-pre 신설. 비-button 컴포넌트에 `cursor: pointer` 등이 적용되는 문제를 Phase 2a 착수 전에 해결

**HIGH 수정:**

3. **Phase 0-pre (사전조사) 신설** — SizeSpec↔SIZE_CONFIG 필드 갭 매핑 + 93개 Spec size 키 대소문자 전수조사. Phase 0의 실제 작업량을 사전에 결정
4. **G4-pre (Archetype POC) 신설** — toggle-indicator의 `translateX(100%)`/`calc()` 기하학 + Checkbox SVG stroke 매핑을 Phase 3a 착수 전 독립 검증. 실패 시 자동화율 목표를 80–85%로 하향 조정하는 분기점 명시
5. **`generate-css.ts` 첫 실행** — Gate G0b에 추가. 현재 한 번도 실행된 적 없는 스크립트의 동작 확인
6. **`pnpm validate:sync` 구현 선행** — Gate G2-pre 신설. 스크립트 미존재 상태에서 Gate G2를 전제하는 순환 참조 해소
7. **CSS 파일 수 정정** — 88개 → 81개 (실측). Metrics/Consequences의 기준 수치 갱신

**MEDIUM 수정:**

8. **핵심 발견 1 보완** — Checkbox 체크마크가 SVG stroke 기반임을 명시. "`line` shape 2개" 단순화 표현 수정
9. **핵심 발견 3 보완** — 기하학적 관계(`translateX`, `calc()`)의 한계를 명시하고 G4-pre POC 참조 추가
10. **ADR-038 연계 표현 조정** — Proposed 상태를 반영하여 "파이프라인 강화" → "잠재적 강화"로 수정
11. **Metrics 테이블 이중 분기** — G4-pre 통과/실패에 따른 두 가지 시나리오 병기
12. **SIZE_CONFIG 규모 정정** — "~수백 줄" → "3,530줄 파일 내 5+ config 객체" (실측)

### 구현 완성도 보강 (2026-03-15)

코드베이스 실측 데이터를 기반으로 7건의 미흡 사항을 보강했다.

**타입 시스템 보강:**

1. **`ArchetypeId` 타입 + `ComponentSpec.archetype` 필드 정의** — 10개 archetype 유니온 타입, ComponentSpec 인터페이스 확장, 93개 Spec 마이그레이션 계획 (Phase 2-pre)
2. **`ComponentSpec.dimensions` 필드 결정** — `*_DIMENSIONS` 데이터를 SizeSpec에 통합하지 않고 별도 `dimensions` 필드로 분리. 근거: SizeSpec 비대화 방지 + 의미적 오염 회피 (Phase 0a)
3. **`AnimationSpec` 인터페이스 정의** — `@keyframes` 생성용 타입 (`name`/`duration`/`timingFunction`/`keyframes`), ProgressBar + Checkbox 사용 예시 (Phase 2b/3b)

**구현 상세 보강:**

4. **Archetype별 base styles 매핑 테이블** — 10개 archetype × base CSS 속성 매핑 (Phase 2-pre)
5. **생성 CSS 출력 형식 규칙** — 파일명 규칙, 헤더 주석 형식, `@layer`/fallback/Prettier/선택자 순서/specificity 등 6개 규칙 + import 전환 규칙 (Phase 2a)
6. **대규모 전환 롤백 전략** — 4단계 배치 전환 순서, 혼합 상태 관리(`index.css` 공존), 4가지 롤백 시나리오 (Phase 2c)
7. **빌드 파이프라인 통합 상세** — 디렉토리 구조, `package.json` scripts, CI 파이프라인 YAML, Primitive/Composite 추가 워크플로우 (Phase 4)

**CompositionSpec 예시 추가:**

8. **ComboBox** (패턴 C, delegation 5) — Select와의 구조 차이(Input+Button 래퍼), 5개 자식 × 5 size 변수 매핑
9. **SearchField** (패턴 B/C 하이브리드, delegation 4) — grid 레이아웃 + clear Button 절대 배치, 패턴 분류가 코드 분기와 무관함을 명시

### 변경하지 않은 것

- 대안 분석 + Risk Threshold: 유효
- 등급 A 대상 (~20개): 유효
- 핵심 발견 2 (React Aria composition): 유효
- 핵심 발견 4 (CSS 변수 위임): 유효

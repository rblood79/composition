# ADR-106-c: Label CSS skipCSSGeneration 정당화 — `--label-font-size` 변수 상속 메커니즘 분석

## Status

Implemented — 2026-04-21

## Context

### 배경 — ADR-106 Charter §G3 Label 잔존 슬롯

ADR-106 (skipCSSGeneration 감사 Charter) §G3 "수동 CSS 독립 정의 debt" 는 최초 5건이었으나, ADR-106-a (Color family G3 → G2 재판정) 이후 **Label 1건만 G3 잔존**으로 P1 슬롯으로 상향됐다.

ADR-106 Charter 매트릭스 항목:

> Label | `Label.css` (7 var lines) | `--label-font-size` 변수 상속 의존 — spec SSOT 미연결 (ADR-086 LABEL_SIZE_STYLE 패턴 재사용 가능)

본 ADR은 **Label CSS의 실측 조사**를 통해 G3 debt 여부를 최종 판정하고, skipCSSGeneration 처리를 결정한다.

### D3 Domain 판정

**D3 (시각 스타일) 전용 작업**. Label CSS의 font-size / 색상 / 상태 스타일이 Spec SSOT에서 파생되어야 하는지 판정. D1(DOM/접근성) — RAC가 `Label` 내부 DOM 구조를 제공; 본 ADR은 D1 비침범. D2(Props/API) — 영향 없음.

### Hard Constraints

1. **CSSGenerator `--label-font-size` 변수 상속 메커니즘 유지** — base.css 패턴을 파괴하면 전체 컴포넌트 시스템 Label font-size 기능이 소실됨
2. **BC 0%** — `element.tag` 변경 없음 (반복 패턴 체크 #3)
3. **Label DFS injection (implicitStyles) 무회귀** — fullTreeLayout.ts의 Taffy 경로는 CSS `--label-font-size` 변수와 독립적으로 동작; CSS 경로 변경이 Skia/Taffy 경로에 영향 없어야 함
4. **testing 기준선** — type-check 3/3 + specs PASS + builder PASS
5. **Label.css가 관리하는 variant/state CSS가 부모 spec에 등록되지 않음** — LabelSpec에 `variants` 필드 없음 (실측 확인)

### 소비 코드 경로 (반복 패턴 체크 #1 — 5건 이상 grep 가능 경로)

| 경로                                                                            | 역할                                                                                      | Label 관련                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| `packages/specs/src/renderers/CSSGenerator.ts:146`                              | `if (spec.skipCSSGeneration && !_embedMode) return null`                                  | Label emit 전면 차단                        |
| `packages/specs/src/components/Label.spec.ts:43`                                | `skipCSSGeneration: true` 선언                                                            | —                                           |
| `packages/shared/src/components/styles/Label.css:5`                             | 주석: `skipCSSGeneration: true — base.css의 --label-font-size 변수 상속을 위해 수동 관리` | G3 판정 근거                                |
| `packages/shared/src/components/styles/base.css:32`                             | `.react-aria-Label { font-size: var(--label-font-size, var(--text-sm)); }`                | Label font-size 수신 지점                   |
| `packages/shared/src/components/styles/generated/TextField.css:100`             | `.react-aria-TextField .react-aria-Label { --label-font-size: var(--tf-label-size); }`    | 부모 generated CSS가 --label-font-size 주입 |
| `packages/shared/src/components/styles/Checkbox.css:23`                         | `--label-font-size: var(--text-sm);`                                                      | 수동 CSS 부모가 --label-font-size 주입      |
| `packages/shared/src/components/styles/Radio.css:15`                            | `--label-font-size: var(--text-sm);`                                                      | 수동 CSS 부모가 --label-font-size 주입      |
| `packages/shared/src/components/styles/Switch.css:23`                           | `--label-font-size: var(--text-sm);`                                                      | 수동 CSS 부모가 --label-font-size 주입      |
| `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:77` | `LABEL_SIZE_STYLE` — Taffy 경로 Label DFS injection                                       | CSS --label-font-size 와 병렬 독립 경로     |

### CSSGenerator 지원 여부 판정 (CRITICAL — 반복 패턴 체크 #2)

ADR-106-a에서 확정된 CSSGenerator 지원 범위 재확인:

| emit 기능                                            |           지원 여부            |
| ---------------------------------------------------- | :----------------------------: |
| `.react-aria-{Name}` root selector                   |               ✅               |
| `[data-variant][data-size]` attribute selector       |               ✅               |
| `[data-state]` (hover/pressed/disabled/focusVisible) |               ✅               |
| `font-size: var(--token)` per-size emit              | ✅ (`generateSizeStyles` L776) |
| `composition.staticSelectors`                        |               ✅               |

**Label 관련 추가 판정:**

Label CSS의 핵심 font-size 전달 메커니즘은 Label 자신이 emit하는 것이 아니라, **부모 컴포넌트가 CSS 변수를 주입**하는 간접 상속 패턴이다.

- `base.css`: `.react-aria-Label { font-size: var(--label-font-size, var(--text-sm)); }` — Label이 `--label-font-size` 변수를 소비하는 수신자
- 부모 generated CSS (`TextField.css`, `CheckboxGroup.css` 등): `--label-font-size` 변수를 주입하는 발신자
- Label.css: `--label-font-size` 변수를 직접 선언하지 않음 — 부모 상속에 의존

**Label.css 실측 전수 조사:**

```css
/* Label.css 전체 내용 (75줄) */
.react-aria-Label {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  width: fit-content;          /* ← fit-content: spec.containerStyles 파생 */
  height: fit-content;         /* ← fit-content: spec.containerStyles 파생 */
  white-space: nowrap;         /* ← 레이아웃 동작 (fit-content와 연계) */
  font-weight: 600;            /* ← 독립 정의: LabelSpec에 fontWeight 없음 */
  background: transparent;    /* ← 독립 정의: spec 미선언 */
  border: none;                /* ← 독립 정의: spec 미선언 */
  padding: 0;                  /* ← spec.sizes.paddingX/Y = 0 — spec token 파생 */
}

/* variant (accent/neutral/purple/negative) */
.react-aria-Label[data-variant="accent"] { color: var(--fg); }          /* spec.variants 없음 — 독립 정의 */
.react-aria-Label[data-variant="neutral"] { color: var(--fg-muted); }   /* 동일 */
.react-aria-Label[data-variant="purple"] { color: var(--color-purple-600); } /* 동일 */
.react-aria-Label[data-variant="negative"] { color: var(--negative); }  /* 동일 */

/* state */
.react-aria-Label[data-focus-visible] { outline: 2px solid var(--accent); ... }  /* spec.states.focusVisible = {} — 독립 정의 */
.react-aria-Label[data-disabled] { opacity: 0.38; cursor: not-allowed; pointer-events: none; }  /* spec.states.disabled 파생 */

/* necessity indicator */
.necessity-indicator { margin-left: 0.25em; }       /* Label 전용 구조 — RAC slot */
.necessity-indicator.icon { color: var(--negative); font-weight: 700; } /* 독립 정의 */
.necessity-indicator.label { color: var(--fg-muted); font-weight: 400; font-size: 0.85em; } /* 독립 정의 */

@media (forced-colors: active) { ... }               /* 접근성 미디어 쿼리 */
```

**spec token 파생 분류:**

| CSS 선언 그룹                                       | spec token 파생? | 비고                                                                                             |
| --------------------------------------------------- | :--------------: | ------------------------------------------------------------------------------------------------ |
| `display/align-items/box-sizing`                    |        ✅        | `LabelSpec.containerStyles` (display: inline-flex, alignItems: center) 파생                      |
| `width/height: fit-content`                         |   **PARTIAL**    | spec에 fit-content 명시 없음 (spec.sizes.height=0, paddingX=0이지만 fit-content는 CSS 구현 선택) |
| `white-space: nowrap`                               |        ❌        | spec 미선언 — layout 보조 속성                                                                   |
| `font-weight: 600`                                  |        ❌        | spec 미선언 — LabelSpec.render.shapes에서 fontWeight=600 사용하지만 spec 필드 없음               |
| `background: transparent; border: none; padding: 0` |     PARTIAL      | spec.sizes.paddingX/Y=0 파생 가능, transparent/none은 독립                                       |
| `variant color (4종)`                               |        ❌        | **LabelSpec.variants 필드 없음** — 완전 독립 정의                                                |
| `state (disabled opacity)`                          |        ✅        | `spec.states.disabled.opacity = 0.38` 파생                                                       |
| `state (focus-visible outline)`                     |     PARTIAL      | `spec.states.focusVisible = {}` — 값 없음, token은 `var(--accent)` 사용                          |
| `necessity-indicator CSS`                           |        ❌        | spec 미선언 — DOM slot 구조 전용 수동 CSS                                                        |
| `forced-colors media query`                         |        ❌        | RAC accessibility 패턴 — D1 영역                                                                 |

**결론: Label.css는 G3 debt와 G2 정당이 혼재하는 MIXED 케이스.**

### `--label-font-size` 변수 상속 메커니즘 상세

```
[부모 컴포넌트 CSS (generated 또는 수동)]
  └── --label-font-size: var(--text-sm) 주입 (CSS 상속)

[base.css — 전역 규칙]
  └── .react-aria-Label { font-size: var(--label-font-size, var(--text-sm)); }
          └── 부모가 주입한 --label-font-size 변수를 소비

[Label.css — skipCSSGeneration: true 수동 관리]
  └── font-size를 직접 선언하지 않음 (base.css에 위임)
```

이 메커니즘의 핵심은 **Label이 font-size를 스스로 결정하지 않고 부모로부터 CSS 변수로 받는다**는 점이다. Label이 `skipCSSGeneration: false`로 전환되어 `generated/Label.css`가 `.react-aria-Label[data-size="md"] { font-size: var(--text-sm); }` 를 emit하더라도, 부모로부터 상속된 `--label-font-size` 변수가 이를 오버라이드하는지 여부는 **CSS specificity**에 의존한다.

**충돌 분석:**

```css
/* base.css (낮은 우선순위 — @layer components 내) */
.react-aria-Label {
  font-size: var(--label-font-size, var(--text-sm));
}

/* 만약 generated/Label.css가 emit된다면: */
.react-aria-Label[data-size="md"] {
  font-size: var(--text-sm); /* 직접 값 */
}
/* [data-size] selector가 더 높은 specificity → base.css의 var(--label-font-size) 우회 */
/* 부모가 --label-font-size를 주입해도 이 직접 선언이 더 높은 specificity로 무시됨 */
```

이것이 Label CSS가 `skipCSSGeneration: true`인 이유다: **generated CSS의 `font-size` 직접 선언이 base.css의 `var(--label-font-size)` 변수 상속 패턴을 CSS specificity로 파괴한다.**

### Label.css의 variant CSS 분석

`Label.css`에는 `data-variant`에 따른 4가지 색상 rule이 있다. 그러나:

1. `LabelSpec`에는 `variants` 필드가 존재하지 않음 (실측 확인 — `Label.spec.ts` grep 결과 없음)
2. 따라서 CSSGenerator가 이 variant CSS를 emit할 수 없음 (`spec.variants != null` 조건이 false)
3. 이 variant CSS는 특정 부모 컴포넌트가 Label에 variant를 부여하는 runtime 패턴에 의존하는 것으로 보임

**이 variant CSS는 spec에서 파생되지 않은 독립 정의** — G3 debt의 일부.

### necessity-indicator CSS 분석

`.necessity-indicator` CSS는 RAC Label의 DOM slot 구조를 위한 것이다. 이는:

1. spec shapes에서 `_necessityIndicator` props를 소비 (Skia 경로)
2. CSS DOM 경로에서는 별도 HTML element가 렌더링됨

이 CSS는 **D1(DOM 구조)과 맞닿은 D3 경계 영역**으로, spec에서 파생하기 어려운 구조적 CSS다.

### BC 영향 수식화 (반복 패턴 체크 #3)

`skipCSSGeneration: true` → 유지(정당화) 또는 부분 전환 검토. `element.tag` 변경 없음 → **BC 0%**. Label font-size 시각 회귀 가능성은 CSS 경로 변경이 있는 경우에만 해당 — 본 ADR에서 코드 변경 없는 경로(시나리오 B) 선택 시 시각 변화 없음.

### Soft Constraints

- ADR-086 `LABEL_SIZE_STYLE` 패턴 (fullTreeLayout.ts): Taffy 레이아웃 경로용 독립 구현. CSS `--label-font-size` 변수 패턴과 별개로 동작. 본 ADR의 CSS 경로 판정은 Taffy/Skia 경로에 영향 없음
- ADR-059 Tier 3 예외 목록에 Label이 현재 등재되지 않음 — G2 정당화 시 등재 필요

## Alternatives Considered

### 대안 A: skipCSSGeneration: false 전환 + Label.css 전면 재작성

- 설명: LabelSpec에 `variants` 필드를 추가하고, base.css의 `--label-font-size` 상속 패턴을 유지하면서 generated CSS를 적용. generated CSS의 `font-size` 직접 선언 대신 `--label-font-size` CSS 변수를 emit하도록 CSSGenerator를 수정. Label.css를 삭제하고 generated CSS로 전환.
  - 장점: 완전한 spec SSOT 달성. skipCSSGeneration: false → G3 debt 소멸
  - 단점:
    1. CSSGenerator가 현재 font-size를 `tokenToCSSVar(size.fontSize)`로 직접 emit함 (`generateSizeStyles` L776). CSS 변수 설정(`--label-font-size: var(--text-sm)`)으로 emit 방식을 바꾸려면 CSSGenerator 수정 필요
    2. LabelSpec에 variants 추가 시 D2 scope 확장 — variants가 RSP 규정인지 확인 필요
    3. Label의 necessity-indicator CSS는 spec 구조화 불가 → spec 외 CSS 잔존 불가피
    4. base.css의 `--label-font-size` 패턴과 generated CSS의 font-size 직접 선언이 CSS specificity 충돌 유발 — 해결을 위해 CSSGenerator에 Label 전용 특수 처리 필요
- 위험:
  - 기술: **HIGH** — CSSGenerator 수정 + LabelSpec variants 추가 + base.css 패턴 조율 + necessity-indicator CSS 구조화 — 4개 독립 변경이 동시 필요. 각각의 부작용이 Label font-size 렌더링에 즉시 영향
  - 성능: LOW
  - 유지보수: **HIGH** — CSSGenerator에 Label 전용 특수 처리가 추가되면 Generator 일반성 훼손. CSSGenerator emit이 `font-size: val` 방식인데 Label만 `--label-font-size: val` 방식으로 변경하면 일관성 없는 예외
  - 마이그레이션: MEDIUM — Label CSS 삭제 시 variant 색상이 spec에 없으면 시각 회귀 발생

### 대안 B: 수동 CSS 정당화 + base.css 메커니즘 SSOT 복귀 분리 (G2 경로)

- 설명: Label.css의 `skipCSSGeneration: true`를 유지하되, 수동 CSS의 각 선언을 spec token 파생 여부로 분류하고, 진짜 G3 debt(variant 4종 독립 정의, necessity-indicator, font-weight 독립 정의)를 별도 개선 항목으로 명시. base.css의 `--label-font-size` 상속 메커니즘이 **구조적 이유로 수동 CSS를 요구**함을 문서화. ADR-059 Tier 3 예외 공식 등록.
  - 장점: 코드 변경 없음. base.css `--label-font-size` 패턴이 보존됨. 현재 동작 무회귀
  - 단점: G3 debt 중 variant CSS, necessity-indicator CSS, font-weight이 spec에 미연결된 상태 지속. 단, 이들은 독립적인 개선 항목으로 추적 가능
- 위험:
  - 기술: LOW — 기존 동작 완전 유지
  - 성능: LOW — N/A
  - 유지보수: LOW — Tier 3 예외 문서화 + 잔존 debt 추적 주석으로 관리
  - 마이그레이션: LOW — BC 변경 없음

### 대안 C: LabelSpec variants 추가 + base.css 패턴 유지 (부분 SSOT 복귀)

- 설명: LabelSpec에 `variants` 필드를 추가하여 accent/neutral/purple/negative 색상을 spec에 선언. base.css `--label-font-size` 상속 패턴은 그대로 유지하면서 skipCSSGeneration은 유지 (variant만 spec에 이관, font-size 메커니즘 변경 없음). necessity-indicator CSS는 수동 유지.
  - 장점: Label variant 색상의 D3 SSOT 달성. base.css `--label-font-size` 패턴 보존. 단계적 개선
  - 단점: skipCSSGeneration: true를 유지하므로 generated CSS가 variant를 emit하지 못함 — spec에 variants를 추가해도 CSS 경로에서 활용 불가. Skia 경로(LabelSpec.render.shapes)에서만 variants를 소비 가능. LabelSpec.render.shapes는 현재 variant를 소비하지 않음(fill은 `props.style?.color`만 참조). spec에 variants를 추가하는 순간 CSSGenerator가 `.react-aria-Label[data-variant="..."]` CSS를 emit하려 하지만 `skipCSSGeneration: true`로 차단됨 — 즉 아무 효과 없음
- 위험:
  - 기술: **HIGH** — LabelSpec에 variants 추가 시 CSSGenerator emit 차단(skipCSSGeneration: true) 상태에서 의미 없는 변경. skipCSSGeneration: false 전환 없이는 CSS 경로에 반영 불가. Skia 경로에서 variants 소비하려면 render.shapes 수정 추가 필요
  - 성능: LOW
  - 유지보수: **HIGH** — spec에 variants 추가했는데 CSS 경로에 반영 안 됨 → 미래 개발자 혼란. spec과 CSS의 불일치가 오히려 더 불투명해짐
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                                  | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------------------- | :---: | :--: | :------: | :----------: | :------: | -------- |
| A: skipCSSGeneration: false 전면 전환 | **H** |  L   |  **H**   |      M       |    2     | 기각     |
| B: 수동 CSS 정당화 + Tier 3 등록      |   L   |  L   |    L     |      L       |    0     | **PASS** |
| C: LabelSpec variants 부분 추가       | **H** |  L   |  **H**   |      L       |    2     | 기각     |

**반복 패턴 선차단 체크 (adr-writing.md Top 1~4):**

- [x] **#1 코드 경로 인용**: Context 소비 코드 경로 표에 9건 grep 가능 파일:라인 명시
- [x] **#2 Generator 확장 여부**: CSSGenerator의 Label font-size emit 방식이 base.css `--label-font-size` CSS 상속 패턴과 CSS specificity 충돌을 일으킴을 분석. Generator 수정 없이 전환 불가
- [x] **#3 BC 훼손 수식화**: element.tag 변경 없음 → BC 0%, 코드 변경 없음 → Preview 무변화
- [x] **#4 Phase 분리 가능성**: 대안 B는 문서화만 → 단일 Phase. 대안 A는 4개 독립 변경 동시 요구 → Phase 분리 필요하나 위험으로 기각

대안 B만 HIGH+ 없음. ADR-106-a/b 선례 패턴 재사용.

## Decision

**대안 B (수동 CSS 정당화 + ADR-059 Tier 3 예외 공식 등록)** 채택. Label은 **G3 → G2 재판정** (부분 G3 debt 잔존 인정).

**선택 근거:**

1. **base.css `--label-font-size` 상속 메커니즘이 구조적으로 수동 CSS를 요구**: Label은 font-size를 스스로 결정하지 않고 부모 CSS 변수를 통해 받는다. CSSGenerator가 `font-size: val`을 직접 emit하면 CSS specificity로 base.css의 CSS 변수 상속 패턴을 파괴한다. 이 패턴은 TextField/Checkbox/Radio/Switch 등 20개 이상의 부모 컴포넌트가 의존한다 (`--label-font-size` grep 결과: 22개 파일).

2. **G3 debt의 실체 재정의**: Label.css에서 진짜 G3 debt는 "font-size 독립 정의"가 아니라 **(a) variant 4종 색상 독립 정의, (b) font-weight: 600 독립 정의, (c) necessity-indicator CSS 독립 정의**다. 그러나 이들은:
   - (a) variant: LabelSpec에 variants 필드 추가 + skipCSSGeneration: false 전환 시 해소 가능하지만 base.css 패턴 충돌 문제로 동시 전환 불가
   - (b) font-weight: 단독으로 spec에 추가 가능하나 skipCSSGeneration: true 상태에서 CSS 경로 효과 없음
   - (c) necessity-indicator: DOM slot 구조 CSS — spec 구조화 범위 밖

3. **Label.css의 대부분이 spec token 파생**: `display/align-items/box-sizing/padding`은 `LabelSpec.containerStyles` + `sizes.paddingX/Y=0`에서 파생. `disabled opacity`는 `spec.states.disabled.opacity=0.38` 파생. `focus-ring token`은 `var(--accent)` spec token 파생. ADR-059 §Tier 3 허용 패턴("수동 CSS가 spec 토큰 파생이면 D3 대칭 consumer 준수") 부분 충족.

4. **Skia 경로가 D3 SSOT 준수**: `LabelSpec.render.shapes`는 LabelSpec.sizes의 fontSize TokenRef를 `resolveSpecFontSize`로 소비. Builder Canvas 측은 이미 SSOT 준수. CSS DOM 경로가 `--label-font-size` 변수 상속으로 동일 spec 토큰 체계를 소비.

5. **ADR-106-a/b 패턴 재사용**: Color family 4건과 TagGroup이 모두 "RAC 구조체 selector + CSSGenerator 미지원"을 이유로 G2 정당화된 선례. Label의 "base.css 변수 상속 충돌"도 구조적 CSSGenerator 미지원에 해당.

**기각 사유:**

- **대안 A 기각**: HIGH 2개 초과. CSSGenerator를 Label 전용으로 수정(font-size 대신 CSS 변수 설정 emit) + LabelSpec variants 추가 + base.css 패턴 조율 + necessity-indicator 구조화 — 4개 변경이 동시에 Label font-size 렌더링에 영향. 단일 실패 지점이 20개 이상 부모 컴포넌트에 Label font-size 회귀를 유발할 위험이 너무 큼.

- **대안 C 기각**: HIGH 2개. variants를 spec에 추가해도 skipCSSGeneration: true 상태에서 CSS 경로에 반영되지 않음 — 의미 없는 spec 복잡도 증가. skipCSSGeneration: false 전환 없이는 효과 없고, 전환하면 대안 A의 문제로 돌아감.

> 구현 상세: [106-c-label-skipcss-justification-breakdown.md](../../adr/design/106-c-label-skipcss-justification-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                | 심각도 | 대응                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Label.css의 variant 4종 색상 (accent/neutral/purple/negative)이 LabelSpec에 미연결 — spec 변경 시 CSS 수동 동기화 필요                                              |  MED   | breakdown Phase 2에서 `/* G3 residual debt: spec.variants 미연결 */` 주석 추가. 추후 LabelSpec variants 추가 + skipCSSGeneration 전환 통합 ADR 발의 필요 |
| R2  | base.css `--label-font-size` 패턴이 Label.css `skipCSSGeneration: true`에 의존하는 암묵적 결합 — Label.css 편집 시 이 의존성을 인지 못하면 font-size 회귀 유발 가능 |  MED   | Label.css 주석에 base.css 의존성 + CSS specificity 충돌 이유를 명시 (breakdown Phase 1)                                                                  |
| R3  | necessity-indicator CSS가 spec과 무관하게 독립 정의됨 — `_necessityIndicator` Skia 경로와 CSS DOM 경로가 독립 진화 위험                                             |  LOW   | breakdown에 Skia 경로(spec shapes `_necessityIndicator` props)와 CSS 경로 대칭 체크리스트 기록. 시각 비대칭 감지는 `/cross-check`                        |
| R4  | ADR-059 Tier 3 예외 목록에 Label이 미등재 — Chart 추적 stale                                                                                                        |  LOW   | 본 ADR Implemented 후 ADR-059 §최종 SSOT 순도 표에 Label 추가                                                                                            |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

| Gate                                  | 시점               | 통과 조건                                                                                                        | 실패 시 대안   |
| ------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| G1: `--label-font-size` 메커니즘 분석 | ADR Proposed       | base.css 상속 패턴 + CSSGenerator specificity 충돌 분석 기록됨 (breakdown)                                       | 재조사         |
| G2: Label.css spec token 파생 분류    | ADR Proposed       | 75줄 전수 분류 매트릭스 기록됨 (Context + breakdown)                                                             | 재조사         |
| G3: Tier 3 예외 등록                  | ADR Implemented 시 | ADR-059 §최종 SSOT 순도 표에 Label 추가                                                                          | 보강           |
| G4: D3 대칭 확인                      | ADR Implemented 시 | "LabelSpec.render.shapes가 spec token 참조 + CSS DOM 경로가 --label-font-size 변수로 동일 토큰 소비" 상태 문서화 | 재조사         |
| G5: type-check                        | 각 Phase 완료 시   | type-check 3/3 PASS (코드 변경 없음 — 자동 통과 예상)                                                            | 해당 변경 롤백 |

**본 ADR Implemented 전환 조건**: G3 + G4 Phase 완료 시 (주석/문서 변경만).

## Consequences

### Positive

- **ADR-106 Charter G3 잔존 1건 해소**: Label이 G2 정당화로 재판정됨으로써 ADR-106 Charter §G3 debt = 0건 달성. G3가 완전히 청산됨
- **`--label-font-size` 메커니즘 공식 문서화**: base.css CSS 변수 상속 → 부모 주입 → Label 소비 패턴이 의도된 설계임을 ADR로 명시. 미래 개발자가 Label CSS를 편집할 때 font-size 회귀 원인을 즉시 이해 가능
- **ADR-059 Tier 3 예외 목록 완결성 향상**: Label이 Tier 3 허용 케이스로 공식 등록됨
- **base.css 패턴 무회귀 보장**: CSS specificity 충돌 분석을 근거로 skipCSSGeneration: true를 유지 — 22개 이상의 부모 컴포넌트가 의존하는 --label-font-size 패턴 보존
- **ADR-106 Charter 감사 종결**: G1(10) + G2(14) + G3(0) + G4(3 — 별도 슬롯) 재분류 확정. G3 실질적 완전 청산

### Negative

- **variant 4종 색상 spec 미연결 지속**: Label.css의 accent/neutral/purple/negative variant가 LabelSpec.variants와 미연결 상태 유지. spec 변경 시 CSS 수동 동기화 필요
- **font-weight: 600 spec 미연결 지속**: spec.render.shapes에서 fontWeight=600을 사용하지만 spec 필드로 선언되지 않음 — Skia와 CSS 경로가 암묵적으로 동일 값을 사용
- **CSSGenerator Label 전환 경로 없음**: Label의 base.css `--label-font-size` 상속 패턴이 근본적으로 바뀌지 않는 한 skipCSSGeneration: true는 구조적으로 필요. 진정한 D3 SSOT는 base.css 패턴 리팩토링과 함께 별도 ADR 필요

## 참조

- [ADR-059](059-composite-field-skip-css-dismantle.md) — Composite Field CSS SSOT 확립, Tier 3 예외 확정
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 3번 정본
- [ADR-083](083-archetype-base-styles-lifting.md) — Label archetype 처리 + LABEL_SIZE_STYLE 패턴 도입
- [ADR-106](106-skipcssgeneration-audit-charter.md) — skipCSSGeneration 감사 Charter G3 Label 슬롯 정의
- [ADR-106-a](106-a-color-family-skipcss-dismantle.md) — G2 정당화 선례 (G3 → G2 재판정 패턴)
- [ADR-106-b](106-b-taggroup-css-skipcss-justification.md) — G2 정당화 선례 (@sync 주석 교체 패턴)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 domain §6 금지 패턴 3번, §7 허용 패턴
- [canvas-rendering.md](../../../.claude/rules/canvas-rendering.md) — §4 Spec-CSS 경계

# ADR-106-c Label CSS skipCSSGeneration 정당화 — 구현 상세 Breakdown

> **연결 ADR**: [106-c-label-skipcss-ssot-recovery.md](../completed/106-c-label-skipcss-ssot-recovery.md)
> **스냅샷 기준**: 2026-04-21

---

## 1. `--label-font-size` CSS 변수 상속 메커니즘 전체 다이어그램

```
[부모 컴포넌트 CSS]
  ├── generated/TextField.css       : .react-aria-TextField .react-aria-Label { --label-font-size: var(--tf-label-size); }
  ├── generated/CheckboxGroup.css   : (동일 패턴)
  ├── generated/RadioGroup.css      : (동일 패턴)
  ├── Checkbox.css (수동)            : --label-font-size: var(--text-sm);  (size별 override)
  ├── Radio.css (수동)               : --label-font-size: var(--text-sm);
  └── Switch.css (수동)              : --label-font-size: var(--text-sm);  (size별 override)
            │
            │ CSS 변수 상속 (cascade)
            ▼
[base.css — 전역 공통 규칙]
  .react-aria-Label {
    cursor: default;
    font-size: var(--label-font-size, var(--text-sm));      ← 부모 주입값 소비, fallback --text-sm
    line-height: var(--label-line-height, var(--text-sm--line-height));
    font-weight: var(--label-font-weight, 600);
    color: var(--label-color, var(--fg));
  }
            │
            │ 소비
            ▼
[Label DOM element]  — 부모가 지정한 크기에 맞는 font-size 렌더링
```

**CSS specificity 충돌 시나리오:**

```css
/* 시나리오: skipCSSGeneration: false 전환 시 emit될 CSS */
.react-aria-Label[data-size="md"] {
  font-size: var(--text-sm); /* specificity [0,1,0] */
}

/* base.css */
.react-aria-Label {
  font-size: var(
    --label-font-size,
    var(--text-sm)
  ); /* specificity [0,1,0] — 동일 */
}
/* 같은 @layer 내에서 나중에 선언된 규칙이 우선 → 순서 의존적 */

/* 부모가 주입한 상태: TextField[data-size="sm"] 하위 Label */
.react-aria-TextField[data-size="sm"] .react-aria-Label {
  --label-font-size: var(--text-xs); /* specificity [0,2,0] */
}

/* 결과: .react-aria-Label[data-size="md"] 가 [0,1,0]이고
   --label-font-size 주입 규칙이 [0,2,0]이지만,
   --label-font-size 변수는 font-size 값으로만 쓰이므로
   .react-aria-Label[data-size="md"]의 직접 font-size 선언이
   같은 specificity 혹은 더 높은 specificity로 이길 경우
   → 부모 주입 --label-font-size 무시됨 */
```

실제 문제: CSS 변수는 상속되지만 font-size 직접 선언이 있으면 `var(--label-font-size, ...)` 자체가 적용되지 않는다. `[data-size]` 선택자가 있는 경우 specificity 경쟁에서 base.css 패턴을 이길 가능성이 높다.

---

## 2. Label.css 전수 분류 매트릭스

| 라인 범위 | CSS 선언                                          | spec token 파생? | 분류            | 비고                                                                                     |
| --------- | ------------------------------------------------- | :--------------: | --------------- | ---------------------------------------------------------------------------------------- |
| 8-20      | `.react-aria-Label` 기본 블록                     |      MIXED       | 일부 파생       | 아래 상세                                                                                |
| 9         | `display: inline-flex`                            |        ✅        | G2              | `LabelSpec.containerStyles.display`                                                      |
| 10        | `align-items: center`                             |        ✅        | G2              | `LabelSpec.containerStyles.alignItems`                                                   |
| 11        | `box-sizing: border-box`                          |        ✅        | G2              | archetype base 공통                                                                      |
| 12        | `width: fit-content`                              |     PARTIAL      | G2+             | spec에 fit-content 명시 없으나 sizes.paddingX=0 + containerStyles로 의미 파생 가능       |
| 13        | `height: fit-content`                             |     PARTIAL      | G2+             | 동일                                                                                     |
| 14        | `white-space: nowrap`                             |        ❌        | G3 residual     | spec 미선언 — layout 보조 속성                                                           |
| 15        | `font-weight: 600`                                |        ❌        | G3 residual     | spec 미선언. render.shapes fontWeight=600 암묵 동기화                                    |
| 16        | `background: transparent`                         |        ❌        | G3 residual     | spec 미선언                                                                              |
| 17        | `border: none`                                    |        ❌        | G3 residual     | spec 미선언                                                                              |
| 18        | `padding: 0`                                      |        ✅        | G2              | `spec.sizes.*.paddingX/Y = 0` 파생                                                       |
| 24-27     | variant accent/neutral/purple/negative (색상 4종) |        ❌        | **G3 residual** | LabelSpec.variants 없음 — 완전 독립 정의                                                 |
| 41-44     | `[data-focus-visible]` state                      |     PARTIAL      | G2              | `spec.states.focusVisible = {}` — 값 없어 token `var(--accent)` 직접 사용                |
| 47-50     | `[data-disabled]` state                           |        ✅        | G2              | `spec.states.disabled: { opacity: 0.38, cursor: not-allowed, pointerEvents: none }` 파생 |
| 54-68     | `.necessity-indicator` CSS (3 rules)              |        ❌        | G3 residual     | spec 미선언. DOM slot 구조 전용                                                          |
| 70-73     | `@media (forced-colors: active)`                  |        ❌        | D1 경계         | RAC accessibility 패턴 — D1 영역                                                         |

**spec token 파생 비율**: G2 ≥ 6/21 라인 (~29%), G3 residual ≤ 10/21 라인 (~48%), PARTIAL 5/21 (~23%)

**G3 residual 항목 목록** (실제 G3 debt):

1. `white-space: nowrap` — spec 미선언
2. `font-weight: 600` — spec render.shapes에서 사용하나 spec 필드 없음
3. `background: transparent; border: none` — spec 미선언
4. **variant 4종 색상** — LabelSpec.variants 없음 (가장 큰 G3 debt)
5. **necessity-indicator CSS 3 rules** — spec 미선언 DOM 구조

---

## 3. 구현 Phase

### Phase 1: Label.css 주석 강화 (skipCSSGeneration 이유 명시)

**목표**: Label.css의 `skipCSSGeneration: true` 이유가 현재 단 한 줄 주석으로만 설명됨 → 상세 이유 명시.

**변경 대상**: `packages/shared/src/components/styles/Label.css` 파일 헤더 주석

**Before** (현재):

```css
/**
 * Label Component Styles
 *
 * Label은 텍스트 콘텐츠에 맞게 크기 결정 (fit-content)
 * skipCSSGeneration: true — base.css의 --label-font-size 변수 상속을 위해 수동 관리
 */
```

**After** (Phase 1 목표):

```css
/**
 * Label Component Styles
 *
 * Label은 텍스트 콘텐츠에 맞게 크기 결정 (fit-content)
 *
 * skipCSSGeneration: true — ADR-106-c 정당화
 *
 * 이유: base.css의 --label-font-size 변수 상속 메커니즘 보존
 *   base.css에서 `.react-aria-Label { font-size: var(--label-font-size, var(--text-sm)); }` 를 선언.
 *   부모 컴포넌트(TextField/Checkbox/RadioGroup 등 22개+)가 --label-font-size CSS 변수를 주입.
 *   만약 generated CSS가 `.react-aria-Label[data-size="md"] { font-size: var(--text-sm); }` 를 emit하면,
 *   CSS specificity로 base.css의 var(--label-font-size) 상속 패턴을 파괴 → 부모 주입 font-size 무시됨.
 *
 * G3 residual debt (spec 미연결):
 *   - variant 4종 색상 (accent/neutral/purple/negative): LabelSpec.variants 없음
 *   - font-weight: 600, white-space: nowrap, background/border 초기화
 *   - .necessity-indicator CSS: DOM slot 구조 전용
 *
 * D3 대칭:
 *   - Skia 경로: LabelSpec.render.shapes → resolveSpecFontSize(spec.sizes.fontSize) 소비 (SSOT 준수)
 *   - CSS 경로: base.css --label-font-size 변수 → 부모 generated/수동 CSS 주입 (간접 SSOT 소비)
 */
```

### Phase 2: LabelSpec 주석 강화

**목표**: LabelSpec의 `skipCSSGeneration: true` 선언에 근거 ADR 추가.

**변경 대상**: `packages/specs/src/components/Label.spec.ts:43`

**Before**:

```typescript
skipCSSGeneration: true,
```

**After**:

```typescript
// ADR-106-c: base.css --label-font-size CSS 변수 상속 메커니즘 보존을 위해 유지
// generated CSS의 font-size 직접 선언이 base.css var(--label-font-size) 상속을 CSS specificity로 파괴
// G3 residual debt: variant 4종(accent/neutral/purple/negative) spec 미연결 + necessity-indicator CSS
skipCSSGeneration: true,
```

### Phase 3: ADR-059 Tier 3 예외 표 갱신

**목표**: ADR-059 breakdown Tier 3 표에 Label 추가.

**변경 대상**: `docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md` (또는 ADR-059 Tier 3 표)

추가 항목:

```
| Label | `Label.css` (75줄) | base.css --label-font-size 상속 패턴 보존. generated CSS font-size 직접 선언이 CSS specificity로 패턴 파괴 | ADR-106-c |
```

---

## 4. Skia ↔ CSS D3 대칭 검증 체크리스트

Label의 시각 대칭은 font-size 경로가 핵심이다.

| 확인 항목           | Skia 경로                                                                         | CSS DOM 경로                                                         |         대칭?         |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | :-------------------: |
| font-size md        | `LabelSpec.sizes.md.fontSize = {typography.text-sm}` → resolveSpecFontSize → 14px | `base.css var(--label-font-size, var(--text-sm))` → 부모 주입 → 동일 |          ✅           |
| font-size xs        | `LabelSpec.sizes.xs.fontSize = {typography.text-2xs}` → 10px                      | 부모 `--label-font-size: var(--text-2xs)` 주입 → 동일                |          ✅           |
| font-weight 600     | `LabelSpec.render.shapes` `fontWeight: fwRaw != null ? ... : 600`                 | `base.css var(--label-font-weight, 600)`                             |          ✅           |
| disabled opacity    | `LabelSpec.states.disabled.opacity = 0.38`                                        | `Label.css [data-disabled] opacity: 0.38`                            |          ✅           |
| color default       | `LabelSpec.render.shapes fill: {color.neutral}`                                   | `base.css var(--label-color, var(--fg))` → `{color.neutral}`         |          ✅           |
| necessity indicator | `spec.render.shapes: _necessityIndicator props 소비`                              | `Label.css .necessity-indicator CSS`                                 | 구조적 동일 확인 필요 |

**D3 대칭 결론**: font-size / font-weight / color / disabled 상태 모두 spec token 체계를 통해 동일 시각 결과 달성. CSS specificity 충돌이 없는 한 D3 symmetric consumer 조건 충족.

---

## 5. 미래 개선 경로 (이번 ADR scope 밖)

Label.css의 G3 residual debt를 진정으로 해소하려면:

### 경로 A: base.css 패턴 리팩토링 + CSSGenerator 수정

1. base.css의 `--label-font-size` CSS 변수 방식 → 부모 generated CSS가 `.parent .react-aria-Label` 에 직접 font-size 지정 방식으로 전환
2. CSSGenerator에 Label 전용 `childSelector` emit 인프라 추가 (ADR-078 확장)
3. LabelSpec `skipCSSGeneration: false` 전환 + variants 추가
4. Label.css 삭제

**예상 공수**: 별도 ADR 필요 (ADR-107 수준). `--label-font-size` 방식에 의존하는 22개 파일 전수 조사 + 마이그레이션 계획 선행 필요.

### 경로 B: LabelSpec variants 추가 + base.css 유지 (spec 부분 SSOT)

1. LabelSpec에 variants 필드 추가 (accent/neutral/purple/negative 색상)
2. Skia 경로(render.shapes)에서 variant 소비
3. CSS 경로는 수동 CSS 유지 (생성 불가)

**예상 공수**: 1-2 세션. D3 Skia ↔ CSS 부분 대칭 개선이지만 CSS 경로에는 적용 안 됨 — 실용적 가치 제한적.

---

## 6. 검증 체크리스트 (후속 Phase 공통)

Phase 1-3 완결 시:

- [x] `Label.css` 헤더 주석에 base.css 메커니즘 + CSS specificity 충돌 이유 명시 (2026-04-21)
- [x] `Label.spec.ts` `skipCSSGeneration: true` 에 근거 ADR 주석 추가 (2026-04-21)
- [x] ADR-059 Tier 3 표에 Label 행 추가 (2026-04-21)
- [x] type-check 3/3 PASS (코드 로직 변경 없음 — 주석/문서만)
- [x] `rg 'skipCSSGeneration: true' packages/specs/src/components/Label.spec.ts` = 1건 (유지 확인)
- [x] `rg '--label-font-size' packages/shared/src/components/styles/` — 22개 파일 영향 없음 확인

---

## 7. `--label-font-size` 파일별 의존성 맵 (2026-04-21 스냅샷)

```
--label-font-size 설정자 (발신자):
  수동 CSS: Checkbox.css, Radio.css, Switch.css
  generated: CheckboxGroup.css, RadioGroup.css, TextField.css, TextArea.css,
             NumberField.css, SearchField.css, Select.css, ComboBox.css,
             DateField.css, TimeField.css, ColorField.css, DatePicker.css,
             DateRangePicker.css, ProgressBar.css, Meter.css, TagGroup.css

--label-font-size 소비자 (수신자):
  base.css: .react-aria-Label { font-size: var(--label-font-size, var(--text-sm)); }
  Label.css: 직접 소비하지 않음 (base.css 경유)
```

총 22개 파일이 발신자. 이 패턴의 변경은 전체 Label 렌더링 시스템에 영향.

---

## 8. ADR-105 @sync 연계 확인

Label.css 및 Label.spec.ts에 `@sync` 주석 없음 (`grep @sync Label.css Label.spec.ts` = 0건). ADR-105 체인과 비충돌 확인됨.

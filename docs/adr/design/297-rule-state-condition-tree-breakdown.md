# ADR-297 설계 breakdown — rule 상태 조건 트리 (evaluator · compiler)

> 본문: [../completed/297-rule-state-condition-tree-single-priority.md](../completed/297-rule-state-condition-tree-single-priority.md). 이 문서는 구현 상세 (분리 4 질문 · 인벤토리 · 형식 · Phase · 파일 · 게이트 절차) 만 담는다. `docs/adr/evidence/` 는 gitignore 라 실측 결론은 여기 §6 에 둔다. 조사 원문: [RULE_STATE_CONDITION_TREE_2026-11](../../explanation/research/RULE_STATE_CONDITION_TREE_2026-11.md).

## 1. 분리 4 질문 lock-in (adr-writing.md §Fork)

이 ADR 은 세 이웃과 경계를 맞춘다 — ADR-295 (값 층, Implemented 10-31) · ADR-293 (색 토큰 출력, Implemented 10-30) · 후속 「토큰 모델 A」 (패널 입력기 + 노드 토큰 참조 저장, 시안 `docs/design/styles-token-model/`).

| #   | 질문                           | 답                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용                    | **297 = base** (rule 의 **형식** 과 두 소비자의 판정기). 295 = 값 (트리 leaf 에 들어가는 숫자 · 토큰), 293 = 색 토큰이 CSS 변수로 나가는 출력. 토큰 모델 A = 응용 (사용자 노드가 값을 **이름으로 참조** 하는 저장 · 입력기 — 트리 형식을 쓸 수 있으나 요구하지 않는다). 형식이 값 · 출력에 의존하지 않고 그 역도 아니다.                                                    |
| 2   | schema 직교성                  | 297 은 `ComponentRule` 타입 (코드 상수) 만 바꾸고 **문서 스키마 무변경** (F1 · F2). 295 는 `ThemeSnapshot` 출력 · rule leaf 값, 293 은 `cssVars`. A 는 노드 typed field 에 토큰 참조 축 (문서 스키마). 넷 다 직교 — 어느 쪽도 다른 쪽의 specialization 이 아니다.                                                                                                           |
| 3   | 선행 전제 reverse 검증         | 295 Decision 6 「식은 `resolveThemeSnapshot` 한 곳, 두 leg 는 숫자만」 — 297 은 그 숫자를 트리 leaf 로 받는다 (식을 트리에 넣지 않는다). grep: `resolveThemeSnapshot.ts` 는 rule 을 읽지 않는다 (연구 §1.4) — 297 이 테마 출력을 바꾸지 않으므로 295 · 293 의 전제를 뒤집지 않는다. ADR-142 「D3 SSOT = catalog 표」 — 표의 형식을 바꾸는 것이지 SSOT 자리를 옮기지 않는다. |
| 4   | 판독에 전제 검증을 미루지 않음 | 위 1 ~ 3 은 ADR 작성 시점 (2026-11-01) 에 코드 grep 으로 확인. 사용자 confirm = `/create-adr` 입력 (같은 대화에서 「macro 자체가 아니라 형식」 권고 → 조사 지시 → 문서 정리 후 `/create-adr`).                                                                                                                                                                              |

겹침 표 (295 후속 · 293 과):

| 파일                                                           | 293          | 295                         | 297                                    |
| -------------------------------------------------------------- | ------------ | --------------------------- | -------------------------------------- |
| `packages/shared/src/catalog/generated/componentRulesTable.ts` | —            | 리터럴 참조화 (닫힘)        | **상태 속성 전부 트리로 codemod**      |
| `packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts` | —            | —                           | 삼항 사슬 → evaluator                  |
| `packages/rendering/src/renderers/CSSGenerator.ts`             | —            | 터치 미디어 블록            | 상태 블록 출력 → compiler              |
| `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`  | 색 전체 출력 | typography · size 두 벌     | **무변경**                             |
| `packages/shared/src/types/catalog-style.types.ts`             | —            | 치수 형 (`scaled` · `em` …) | 상태 속성 타입 → `ConditionalValue<T>` |
| `packages/shared/src/components/styles/utilities.css`          | —            | —                           | `.button-base` ramp 흡수 (Phase 3)     |

## 2. 인벤토리 (Phase 0 에서 freeze — 아래는 2026-11-01 조사값, 상한)

### 2a. 상태 표현 5 방식 (연구 §2.1)

| #   | 방식                                           | 건수                                                                                                                                      | 트리로                                                                      |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ①   | `fill.<style>.<state>`                         | hover 89 · pressed 88 · selected 9 · emphasizedSelected 1 · outline.base 3 · subtle.base 2 · quiet 2                                      | `backgroundColor: { fillStyle: { fill: { isHovered … }, outline: { … } } }` |
| ②   | `colors.*Hover` · `selected*` · `outline*`     | textHover 6 · borderHover 4 · selectedText 3 · selectedBorder 5 · outlineText 3 · outlineBorder 2 · subtleText 2 · emphasizedSelected\* 1 | `color` · `borderColor` 트리                                                |
| ③   | `structure.states.*`                           | disabled 63 · focusVisible 44 (+ hover · pressed)                                                                                         | `opacity` · `outline` · `boxShadow` · `transform` 트리                      |
| ④   | `rootSelectors` `&[data-*]` 키                 | 56 키 · 선언 109 (Input 8 · DateInput 8 · ListBox 12 · Radio 4 · Switch 4 · Color\* 7 · Link 2 · DropZone 2 · Toast 2 · Disclosure 1)     | Canvas 가 읽는 quiet · invalid · disabled → 트리 · 나머지 → `domOnly`       |
| ⑤   | variant 이름 `selected` · `selectedEmphasized` | Tag 2                                                                                                                                     | `isSelected` · `isEmphasized` 조건                                          |

### 2b. 판정 코드 (걷어낼 것)

| 소비자             | 파일:라인                                                                                                                                                                                                                                            | 대체                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Canvas             | `resolveCatalogPaint.ts:64-143` (fillStyle · selected · hover · static · outline · subtle 삼항 사슬)                                                                                                                                                 | `evaluate()`                               |
| Canvas             | `rulePaint.ts:155-181` (`interaction()`) · `:264-272` (owner `_isSelected`) · `:290-309` (variant `selected` 교체)                                                                                                                                   | 조건 집합 생성 + `evaluate`                |
| Canvas             | `quietStyles.ts:17-67, 108-117` (축소판 선택자 매처) · `disclosureBorders.ts:41-62` · `colorControlParts.ts:107-135`                                                                                                                                 | `evaluate`                                 |
| Canvas             | `ruleShapes.ts:149-170` (invalidBorder) · `:180-230` (quiet) · `:554-556` (Link quiet)                                                                                                                                                               | `evaluate`                                 |
| Canvas             | `resolveSkiaVisualRule.ts:21-50` (어댑터)                                                                                                                                                                                                            | 삭제                                       |
| DOM                | `CSSGenerator.ts:296-685` (variant · outline · quiet · subtle · states 블록 순서) · `:1298-1404` (`states`) · `:497-540` (quiet) · `:543-568` (subtle)                                                                                               | `compile()`                                |
| DOM                | `generate-css.ts:99-125` (어댑터) · `:265` (`ruleVariantToVariantSpec`)                                                                                                                                                                              | 삭제                                       |
| DOM                | `utilities.css:24-103` (`.button-base` hover · pressed · selected · disabled · outline ramp)                                                                                                                                                         | Phase 3 흡수                               |
| 패널               | `specPresetResolver.ts:551-575` (`interactionState:"default"` 고정)                                                                                                                                                                                  | `evaluate` (조건 집합)                     |
| 투영기             | `codeCatalogLibrary.ts:304-360` · `ruleDefinition.ts:393, 698-714` · `rulePartRules.ts:1970, 1133`                                                                                                                                                   | 트리 읽기 (출력 JSON 동일)                 |
| 토큰 생성원 (유지) | `tintToSkiaColors.ts:304-305` (`accent-hover` · `accent-pressed` = `mixWithBlackSrgb` 85 / 75) · `neutralToSkiaColors.ts:40-63` — `resolveThemeSnapshot.ts:263-278` 이 seed 위에 펼쳐 Canvas 맵 + DOM `--accent-hover` 양쪽에 낸다 (리뷰 round 1 h2) | **걷어내지 않는다** — 트리는 토큰을 참조만 |

### 2c. 타입 · 테스트

- 타입 3 벌 → 1: `catalog-style.types.ts` (`ComponentRuleFillState` :89 · `ComponentRuleFill` :101 · `ComponentRuleVariantColors` :116 · `ComponentRuleStates` :641) 를 `ConditionalValue<T>` 로 · `spec.types.ts` `VariantSpec` (:797) · `FillStateTokens` (:870) · `resolveComponentVisual.ts` `ComponentVisualRule` (:42) 삭제.
- 깨질 테스트 (경로 문자열 oracle): `componentRulesTable.static.test.ts` (:214, :229 …) · `d3S2Alignment.static.test.ts` (rule 접근 37) · `archetypeDefaultCohort.static.test.ts:53-58` · fill/colors/rootSelectors 경로 테스트 25 · `COMPONENT_RULES_TABLE` import 테스트 ~40 · `packages/rendering` `buildCatalogShapes.*.test.ts` · `catalogPaintFixture.ts`. Phase 0 에서 파일명 · oracle 값 표로 freeze (G0 (a)).
- 스크립트: `apps/builder/scripts/adr248-*` · `adr295-rule-literal-inventory.ts` · `s2-variant-removal-live.mjs` — 트리 경로로 갱신.

## 3. 형식 (Decision 1 의 상세)

```ts
// packages/shared/src/types/catalog-style.types.ts
type Condition =
  | "isHovered"
  | "isPressed"
  | "isFocusVisible"
  | "isDisabled"
  | "isSelected"
  | "isEmphasized"
  | "isStaticColor"
  | "isQuiet"
  | "isInvalid"
  | "touch";
/** DOM 만 지원하는 상태 — Canvas 조건 집합에는 절대 들어가지 않는다 (리뷰 round 2 h3). */
type DomCondition =
  | "isFocused" // :is([data-focused], [data-focus-within]) — 마우스 포커스 (Input · DateInput 12 건)
  | "isFocusWithin"
  | "isDropTarget"
  | "isEmpty"
  | "inPopover" // :is(.react-aria-Popover *)
  | "forcedColors"; // @media (forced-colors: active)
type ValueCondition = "variant" | "size" | "fillStyle";
type ConditionalValue<T> =
  | T
  | ({ default?: ConditionalValue<T> } & {
      [K in Condition | DomCondition]?: ConditionalValue<T>;
    } & { [K in ValueCondition]?: Record<string, ConditionalValue<T>> } & {
      /** 다른 대상 (자손 · 형제 · pseudo) 전용 raw 선택자 — `&` 자신의 상태 분기 금지 (G3 (e)). */
      domOnly?: Record<
        string /* raw selector, not targeting & */,
        ConditionalValue<T>
      >;
    });

interface ComponentRulePaint {
  backgroundColor?: ConditionalValue<TokenRef | CssValue>;
  color?: ConditionalValue<TokenRef | CssValue>;
  borderColor?: ConditionalValue<TokenRef | CssValue>;
  borderWidth?: ConditionalValue<Length>;
  opacity?: ConditionalValue<number>;
  outline?: ConditionalValue<CssValue>;
  boxShadow?: ConditionalValue<CssValue>;
  transform?: ConditionalValue<CssValue>;
  backgroundAlpha?: ConditionalValue<number>; // 현행 fill.alpha · staticAlpha
}
```

Button accent 예 (현행 ① ② → 트리):

```ts
backgroundColor: {
  fillStyle: {
    fill: {
      variant: {
        accent: { default: "{color.accent}", isHovered: "{color.accent-hover}", isPressed: "{color.accent-pressed}" },
        primary: { default: "{color.neutral}", isHovered: "{color.neutral-fill-hover}", isPressed: "{color.neutral-fill-pressed}" },
      },
    },
    outline: { default: "{color.transparent}" },
  },
  isStaticColor: { fillStyle: { fill: "static" } },   // evaluator 가 staticHex 로 치환 (현행 rCP:89-104)
},
borderColor: {
  fillStyle: {
    fill: { variant: { accent: { default: "{color.accent}", isHovered: "{color.accent-hover}" } } },
    outline: { default: "{color.border-hover}" },
  },
},
```

순회 규칙 (S2 `style-macro.ts:558` 그대로): 객체를 키 순서대로 돌며 조건이 참인 가지로 내려가고, 같은 깊이에서는 **나중 키가 먼저 것을 덮는다**. `default` 는 조건이 하나도 안 맞을 때. `touch` 는 evaluator 에서 조건 (`deviceUnit` 의 touch 여부, 295 Decision 2), compiler 에서 `@media … , :root[data-catalog-touch]` 래핑. `DomCondition` 키는 보통 조건과 같은 순회 — Canvas 의 조건 집합에 그 키가 없으므로 evaluator 는 거짓 가지로 지나가고, DOM oracle 하니스 (G1 (e)) 는 그 키를 참으로 넣어 평가한다. `domOnly` raw 선택자는 evaluator 가 건너뛰고 compiler 가 트리 블록 뒤에 낸다.

Input border-color 예 (현행 rootSelectors 8 블록 → 트리 하나, round 2 h3):

```ts
borderColor: {
  default: "{color.border}",
  isHovered: "{color.border-hover}",          // 현행 `&[data-hovered]:not([data-focused],…)` — :not 은 순서로 대체
  isFocused: "{color.accent-content}",        // DOM 전용 — Canvas 는 이 가지를 못 본다
  isInvalid: { default: "{color.negative}", isFocused: "{color.negative}" },  // `&[data-invalid]:is([data-focused],…)`
  isQuiet: {
    default: "transparent",                   // quiet 은 border-bottom-color 로 — 별 속성 트리
    isHovered: "transparent", isFocused: "transparent", isInvalid: "transparent",
  },
},
```

compiler 선택자 맵 (한 표): `isHovered` → `[data-hovered]` · `isPressed` → `[data-pressed]` · `isFocusVisible` → `[data-focus-visible]` · `isDisabled` → `[data-disabled]` · `isSelected` → `[data-selected]` · `isEmphasized` → `[data-emphasized]` · `isStaticColor` → `[data-static-color]` · `isQuiet` → `[data-quiet]` · `isInvalid` → `[data-invalid]` · **DOM 전용** `isFocused` → `:is([data-focused],[data-focus-within])` · `isFocusWithin` → `[data-focus-within]` · `isDropTarget` → `[data-drop-target]` · `isEmpty` → `[data-empty]` · `inPopover` → `:is(.react-aria-Popover *)` · `forcedColors` → `@media (forced-colors: active)` 래핑 · `variant` → `[data-variant="x"]` · `size` → `[data-size="x"]` · `fillStyle` → `[data-fill-style="x"]`. 전환 단계 (Phase 1 · 2) 에는 compiler 에 **옛 출력 순서 재배열표** (`legacyOrder`) 가 붙고 Phase 3 에서 지운다.

**specificity 정규화 (Decision 2, 리뷰 round 1 h1)**: compiler 는 조건 선택자 전부를 `:where()` 안에 넣는다 — `.react-aria-Input:where([data-quiet][data-hovered]) { border-color: red }` `.react-aria-Input:where([data-invalid]) { border-color: blue }`. 모든 블록이 0-1-0 이라 cascade 는 source order 로만 갈리고, source order 는 트리 순회 순서 (깊이 우선 · 같은 깊이는 나중 키가 뒤) 다 → evaluator 와 같은 값이 이긴다 (Chromium 반례: raw 는 red, `:where` 는 blue). `touch` 는 `@media` 래핑이라 specificity 에 안 들어간다. 층 순서 — ① 트리 블록 (`@layer components`, 0-1-0) → ② 같은 rule 의 `domOnly` raw 블록 (트리 블록 **뒤**, 선언 specificity 그대로 — 대상이 자손 · 형제 · pseudo 뿐이라 트리와 안 겹친다. `&` 대상 raw 0 — G3 (e)) → ③ 수동 CSS → ④ 작성 stateRules 시트 (`stateStyles.ts`, `!important`). `legacyOrder` 는 전환 단계에 블록 순서만 옛 출력대로 재배열하고 (`:where` 는 Phase 1 부터 — 옛 출력도 variant 블록은 `[data-variant]` 0-2-0 이므로 **diff 0 을 위해 Phase 1 · 2 는 옛 selector 모양을 그대로 내고** Phase 3 에서 `:where` 로 바꾼다 — 그 Δ 는 §6.2 에 기록, G1 (e) 는 Phase 1 부터 **별도 하니스** 가 새 compiler 의 `:where` 출력으로 잰다).

## 4. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                            | Gate         | 커밋 가능 상태                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------- |
| 0     | 인벤토리 freeze (§2 수치 실측 · 깨질 테스트 + oracle 값 표) · 「다름 9」 Compare Mode 실측 (§6.1 표) · 기준선 JSON 3 (생성 CSS 103 해시 · paint 전수 · library) + ratchet 카운트 + 번들 · RED (트리 타입 · `evaluate` · `compile` 테스트)                                                                                                                                                                                                       | G0           | 하니스 + RED 만, 제품 코드 0       |
| 1     | `conditionTree.ts` (`evaluate` · `compile` · `legacyOrder`) · 타입 · **Button 가족** (Button · ToggleButton · ToggleButtonGroup · ButtonGroup · FileTrigger) 만 트리로 · `resolveCatalogPaint` 는 트리가 있는 rule 이면 evaluator, 없으면 옛 사슬 (일시 이중)                                                                                                                                                                                   | G1           | diff 0 · paint 동일                |
| 2     | 표 전수 codemod (스크립트 `adr297-rule-to-tree.ts` — 손 분류 금지, ① ~ ⑤ 를 기계 변환) · 투영기 3 · 소비자 전부 · 타입 통합 · 어댑터 2 삭제 · 옛 사슬 삭제 · `resolveComponentRule` 잠자는 통로 삭제 · 정적 테스트 oracle 경로 갱신 · 패널 미리보기 evaluator                                                                                                                                                                                   | G1 · G2 · G3 | diff 0 · paint 동일 · ratchet 같음 |
| 3     | 우선순위 통일: `legacyOrder` 삭제 (트리 순서 = 두 소비자) · 「다름 9」 건마다 oracle 적용 (S2 소스 / 사용자 결정 2) · `cssEmitMode: "button-base"` 삭제 + Button 류 트리에 hover · pressed · disabled 값 · `.button-base` 자체 color-mix 삭제 (`utilities.css:24-46` — 토큰 생성원 `tintToSkiaColors` 는 유지, h2) · compiler 출력 `:where()` 전환 (h1) · static 수동 CSS 42 → `isStaticColor` 가지 · (사용자 결정 3) selected · focus 수동 CSS | G4           | before/after 표 (§6.2) · CHANGELOG |
| 4     | live (G5) · 문서 (G6) · README · `### Live Exercise` · Implemented                                                                                                                                                                                                                                                                                                                                                                              | G5 · G6      |                                    |

추정 규모: 신규 2 파일 (`conditionTree.ts` + 테스트) · 표 1 (codemod) · 소비자 수정 ~25 파일 · 삭제 4 (어댑터 2 · `resolveComponentVisual.ts` · `VariantSpec` 블록) · 테스트 수정 ~30 · 수동 CSS 6 파일 (Phase 3). ~70 파일. 1.5× 넘으면 Phase 0 인벤토리 보강으로 흡수하고 보고한다 (adr-writing M3).

## 5. 게이트 절차

- **G0 (c) 기준선 JSON**: `apps/builder/scripts/adr297-paint-oracle.ts` — 표 전수 × 조건 조합 (`displayState` 5 × fillStyle 값 × staticColor 3 × isQuiet 2 × isEmphasized 2 × isInvalid 2) 으로 `resolveCatalogPaint` 를 불러 `{ruleId, conditions, backgroundColor, color, borderColor, backgroundAlpha}` 를 JSON 으로. 전환 뒤 evaluator 로 같은 조합 → `cmp`. 생성 CSS 는 `pnpm validate:sync` + `shasum` 103 파일. library 는 `buildCodeCatalogLibrary()` → JSON.stringify → shasum.
- **G1 원복 RED**: `conditionTree.ts` 의 「나중 키가 이긴다」 를 「먼저 키가 이긴다」 로 바꾸면 paint JSON 이 갈려야 한다 (RED). codemod 스크립트의 한 분기 (예: `borderHover` → `isHovered`) 를 끄면 diff ≠ 0 이어야 한다.
- **G1 (e) 겹침 조합 computed 대조** (R9): browser vitest (`parity` project) `adr297ConditionCascade.browser.test.ts` — compiler 의 `:where` 출력을 시트로 싣고 Input (quiet+hover+invalid · quiet+focus+invalid) · ToggleButton (selected+static+hover · quiet+selected · emphasized+selected+disabled) · Button (outline+disabled · fill+static+pressed) 요소에 `data-*` 를 붙여 `getComputedStyle` 의 background · color · border-color 를 evaluator 결과와 비교. 원복 RED: compiler 의 `:where` 래핑을 끄면 quiet+hover+invalid 가 FAIL. G0 (c) 기준선 JSON 은 `resolveCatalogPaint` 만이 아니라 consumer 결과 (`rulePaint` 의 variant 선택 · `ruleShapes` quiet/invalid border · `structure.states` 의 opacity · outline) 를 같이 담는다 (리뷰 round 1 LOW 권고).
- **G4 테마 토큰 무변경** (R10): preset 5 × light/dark × 명시 accent 유무로 `resolveThemeSnapshot` 을 호출해 `colors` · `cssVars` 를 JSON → shasum == G0. 기존 `resolveThemeSnapshot` 스냅샷 테스트 24 PASS 유지.
- **G2 ratchet**: `pnpm gate:perf-ratchet` + `perf:baseline -- --lane frame --fixed-inputs --call-counts --classes paint` 전후. memo 키 = `${ruleId}|${variant}|${size}|${fillStyle}|${conditionBits}`.
- **G3 정적**: `componentRulesTable.static.test.ts` 에 ratchet 추가 — 방식 ② ~ ⑤ 키 0 · 트리 조건 키 ∉ `Condition` ∪ `DomCondition` 0 · `domOnly` raw 선택자 중 `&` 자신 대상 0 (파서: 선택자가 `&` 로 시작하고 결합자 (` ` · `>` · `+` · `~`) · `::` 가 없으면 `&` 대상) · Canvas 조건 빌더 출력에 `DomCondition` 키 0 (unit) · `VariantSpec` import 0.
- **G1 (e) DOM 전용 조건 oracle**: 같은 browser vitest 에 Input `data-focused` (focus-visible 없음) · `data-focused`+`data-invalid` · `data-quiet`+`data-focused` 요소를 두고 computed border-color == `evaluate(tree, { …공통, isFocused: true })`. 원복 RED: 트리에서 `isFocused` 가지를 지우면 focused border 가 `{color.border}` 기본색 (round 2 Chromium 반례 `rgb(0,68,255)` → `rgb(80,80,80)` 재현).
- **G4 (Phase 3)**: §6.2 표 — 건마다 Canvas · DOM 스크린샷 before/after + 값 + oracle 출처. Compare Mode 9 건 Δ 0. 빌더 위젯 (CompactSelect · PropertySelect · Data RowForm) hover 스크린샷 Δ 0 (R7 — 295 `builder-catalog-pins.css` 범위 확인).
- **G5 live**: Chrome MCP · 사용자 5173 서버 건드리지 않음 (하니스 5176). Canvas state-origin (hover · pressed · disabled · selected) 카드와 Preview 같은 컴포넌트 같은 상태의 computed color · border 를 대조. Styles 패널 미리보기 색 포함. 콘솔 0.

## 6. 실측 기록 (Phase 0 ~ 3 에서 채운다)

### 6.1 「다름 9」 Compare Mode 실측 (Phase 0)

| #   | 상태 · 컴포넌트                      | 조사 판정 (추정 여부)            | 실측 Canvas (판정 함수 값)                                          | 실측 DOM (Preview computed)                                                   | 확정 / 기각 · S2 oracle                                                                                                   |
| --- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | hover — Button accent (button-base)  | 다름 (확정 — util:24 vs rCP:84)  | 배경 · 테두리 `accent-hover` (46,82,204)                            | 배경 · 테두리 46,82,204                                                       | **기각** — 값 같음 (`--accent-hover` 가 color-mix 85 % 와 같은 값). S2 `accent-1000`                                     |
| 2   | hover — Button outline               | 다름 (확정 — util:96 vs 없음)    | 배경 투명 · 테두리 `border-hover` (161)                             | 배경 글자색 8 % · 테두리 137                                                  | **확정** — S2 outline hover 배경 `gray-100` (중립 · 글자색 아님) · 테두리 `baseColor(gray-800 / 300)` 의 hover 단         |
| 3   | hover — Input accent (rootSelectors) | 다름 (추정 — 0-4-0 계산)         | 테두리 `border-hover` (161) · 배경 250                              | 테두리 161 · 배경 250                                                         | **기각** — 값 같음                                                                                                        |
| 4   | hover+invalid — Input                | 다름 (추정)                      | 테두리 `negative` (251,44,54) — `ruleShapes` invalidBorder          | 테두리 161 (hover 가 0-4-0 으로 이김)                                         | **확정** — S2 `Field.tsx` borderColor: `isInvalid` 가 `default` (hover 포함) 뒤 → invalid 이김 = Canvas 쪽                 |
| 5   | pressed — Button (그림자 · mix)      | 다름 (확정)                      | 배경 `accent-pressed` (41,72,180) · 테두리 `accent` (54,96,240)     | 배경 · 테두리 41,72,180 · scale 0.95 · inset 그림자 5 %                       | **확정** (테두리 · 그림자) — S2 fill Button 은 테두리 폭 0 · 그림자 없음 · pressed 배경 = hover 와 같은 `accent-1000`      |
| 6   | selected — ToggleButton quiet        | 다름 (추정 — 0-3-0 순서)         | 배경 `neutral` (23) · 글자 `base` (255)                             | 배경 **투명** · 글자 255 (흰 바탕에 흰 글자 — 보이지 않음)                    | **확정** — S2 `ActionButton` isSelected = `baseColor(neutral)` (quiet 무관) = Canvas 쪽. emphasized · 비 quiet 는 같음     |
| 7   | disabled — Button 색 (RAC context)   | 다름 (확정 — util:83 vs opacity) | accent 칠 그대로 + opacity 0.38                                     | 회색 칠 (12 % · 글자 38 %) **+** opacity 0.38 (이중)                          | **확정** — S2 isDisabled = `disabled` 색 (배경 · 글자 · 테두리), opacity 없음                                             |
| 8   | invalid+focus — Input                | 다름 (추정)                      | 테두리 `negative`                                                   | 테두리 negative · outline negative                                            | **기각** — 테두리 같음 (focus 링은 DOM 전용 조건 `isFocused`)                                                             |
| 9   | staticColor hover — Button           | 다름 (확정 — 수동 CSS ramp)      | white: 배경 #fff · 글자 #000 (hover 변화 없음) / black: #000 · #fff | white: 배경 **accent-hover 파랑** · 글자 #000 · 테두리 217 / black: 배경 10 | **확정** — S2 isStaticColor = `transparent-overlay-800` 의 hover 단 (static 이 variant 바깥) — 둘 다 아님, DOM 은 결함 |
| 10  | quiet hover — ToggleButton           | 다름 (추정 — CG:1006 slot)       | 배경 `neutral-subtle` (229) · 테두리 투명                           | 배경 212 · 테두리 검정 15 %                                                   | **확정** — S2 `baseColor(gray-100)` 의 hover 단 (quiet 은 휴지 상태만 투명)                                               |
| 11  | subtle border — InlineAlert          | 다름 (추정)                      | 테두리 `neutral-subdued` (82)                                       | 테두리 투명                                                                   | **확정** — S2 `InlineAlert.tsx` subtleFill borderColor `transparent` = DOM 쪽                                             |

측정 (2026-11-01, `dd7a12602` · 제 서버 5177 · Chrome · light · 기본 테마): DOM 은 Compare Mode Preview iframe 안 실제 Button · ToggleButton 의 사본 (`data-*` 상태만 바꿈) 과 Input · InlineAlert 요소를 같은 부모에 두고 `getComputedStyle`. Canvas 는 Canvas 가 칠할 때 부르는 판정 (`resolveCatalogPaint` · `ruleShapes` invalidBorder · `structure.states`) 의 값 — Canvas 는 페이지 instance 의 hover 를 그리지 않아 픽셀로 잴 수 없다 (상태 원본 카드만). 토큰 → rgb 는 같은 iframe 의 CSS 변수. 결과: 11 건 중 확정 8 · 기각 3, **확정 8 건 모두 S2 설치본에 oracle 이 있다** (S2 에 없는 조합 0). 6 · 9 는 DOM 쪽이 눈에 보이는 결함이다 (흰 글자 · static 위 파랑).

### 6.2 Phase 3 before/after (건마다)

| #   | 건 | before Canvas | before DOM | oracle (S2 소스 / 결정 2) | after (둘 다) |
| --- | --- | --- | --- | --- | --- |
| 2 | Button outline hover · pressed | 바탕 투명 · 테두리 `border-hover` | 3a 뒤 트리 = Canvas | `Button.tsx` outline `isHovered` · `isPressed` `gray-100` · 테두리 `baseColor('gray-800' · 'gray-300')` · 글자 `baseColor('neutral')` | 바탕 `neutral-subtle` · 테두리 primary `neutral` → `neutral-fill-hover`, secondary `border` → `border-hover` · accent · negative outline 글자 `neutral` (accent-content 아님 — 290 분류표 갱신) |
| 4 | Input invalid + hover | (3c 에서 반영) | | `Field.tsx` `isInvalid` 가 hover 뒤 | invalid |
| 5 | Button pressed | 바탕 `accent-pressed` · 테두리 `accent-hover` (링) | 3a 뒤 트리 = Canvas (그림자는 3b 에서 이미 없음) | `baseColor` · `accent-1000` 의 pressed = hover 단, fill 테두리 폭 0 | 바탕 · 테두리 = hover 값 (`accent-hover` · `negative-hover` · `neutral-fill-hover`) |
| 6 | quiet ToggleButton 선택 | `neutral` · 글자 `base` | 3a · 3e 로 트리 = Canvas | `ActionButton.tsx` `isSelected` `baseColor('neutral')` | 변경 없음 (3e 에서 이미 닫힘) |
| 7 | Button disabled | 칠 그대로 + opacity 0.38 | 같음 (3b 뒤) | `isDisabled: 'disabled'` (색) · opacity 없음 | 바탕 · fill 테두리 `{color.disabled}` · 글자 `neutral-subdued` (disabled 글자 토큰 없음 — 가장 가까운 기존 토큰) · outline 테두리 `border-disabled` · opacity 없음 |
| 9 | Button static | 불투명 흰 · 검정 (hover 변화 없음) | 3f 뒤 트리 = Canvas | `isStaticColor` = `transparent-overlay-N` (static 색의 α — `spectrum-theme.mjs`) · accent · negative 는 static 가지 없음 | primary α 0.85 → hover 0.94 · 글자 반대색 · secondary 0.11 → 0.14 · outline hover 0.11 · 테두리 primary 0.85 → 0.94 · secondary 0.17 → 0.21 · disabled 바탕 0.11 · 글자 0.21 · premium · genai 0.11 · accent · negative 는 평소 칠 |
| 10 | quiet ToggleButton hover · pressed | `neutral-subtle` · `neutral-hover` | 트리 = Canvas | `baseColor('gray-100')` 다음 단 (quiet 은 휴지만 투명) | `neutral-hover` · `neutral-pressed` |
| 11 | InlineAlert subtleFill 테두리 | `neutral-subdued` | 투명 (생성 sheet) | `InlineAlert.tsx` `subtleFill: 'transparent'` | 투명 |

### 6.3 기준선 · 측정

정본 = `apps/builder/scripts/adr297-baseline.ts <outDir>` (출력은 `.agent/runs/2026-11-01-adr297-execute/{g0,p1,p2a,p2b,p2c}/` — 로컬 전용). g0 = HEAD (`b140aed14`) 의 표, p1 = Phase 1 뒤, p2c = Phase 2 뒤.

| 항목                                  | before (Phase 0, HEAD 표)                                                                                       | Phase 1 (Button 가족 트리)                                        | Phase 2                              | Phase 3 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------- |
| 생성 CSS 103 해시                     | `0c4b0c8e…`                                                                                                     | 동일 (`pnpm validate:sync` PASS — `--check` 는 한 줄 달라도 실패) | 동일 (`validate:sync`)               | Δ 기록  |
| paint 닿는 입력 (`paint.reach.jsonl`) | 10,044 행 `ed15fc5b…`                                                                                           | 동일                                                              | 동일                                 | Δ 기록  |
| paint 전 입력 (`paint.jsonl`)         | 41,040 행 `5e519fda…`                                                                                           | 1,368 행 다름 — 전부 닿지 않는 입력 (아래)                        | 26,699 행 다름 — 전부 닿지 않는 입력 |         |
| library JSON (정렬 키 · `paint` 제외) | `c1f6485c…`                                                                                                     | `revision` 1 줄만 다름 (표 내용 해시 — 검증은 비어 있지 않음만)   | `revision` 1 줄만 다름               | 동일    |
| ratchet 카운트 (paint 부류)           | 미측정 — dirty 트리는 HEAD worktree 를 잰다 (메모리 `reference-perf-ratchet-dirty-tree-measures-head-worktree`) | 커밋 뒤 G2 와 함께                                                | `dd7a12602` ↔ 직전 `5e4d575cc` 같음 (아래 (e)) |         |
| frame p95 (fixed-inputs)              | 〃                                                                                                              | 〃                                                                |                                      |         |
| Builder initial gz / Preview          | 〃                                                                                                              | 〃                                                                |                                      |         |

paint 전 입력의 1,368 행 차이 (Button 864 · ButtonGroup 144 · FileTrigger 180 · ToggleButton 36 · ToggleButtonGroup 144 행 — `diff g0/paint.jsonl p1/paint.jsonl`) 는 전부 그 컴포넌트가 만들 수 없는 입력이다 — Button 계열의 `isSelected` (선택되지 않는 컴포넌트) · `fillStyle: subtle` (binding 이 `fill` · `outline` 만 받음) · ToggleButton 의 fillStyle (받지 않음). 옛 사슬은 그 입력에서 「선택 · fillStyle 칸만 칠한다 (없으면 값 없음)」 이고, 트리는 닿는 축에만 그 배타 가지 (`null`) 를 둔다 (§6.4 결정 b).

### 6.4 Phase 기록

**Phase 0 (2026-11-01, 닫힘)** — G0 (a) 인벤토리 (스크립트 정본 — 조사값 대비 정정, adr-writing M3): ① `fill.default.base` 190 · hover 183 · pressed 182 · selected 15 · emphasizedSelected 1 · outline.base 36 · subtle.base 30 · quiet.base 2 · alpha 10 / ② outlineText 36 · outlineBorder 31 · subtleText 30 · borderHover 12 · selectedBorder 11 · textHover 7 · selectedText 3 · emphasizedSelected* 1 / ③ disabled 132 · focusVisible 37 · pressed 3 · hover 1 (선언 수) / ④ `&` 자신 대상 38 키 (선언 70) · 다른 대상 42 키 (선언 101) / ⑤ Tag `selected` · `selectedEmphasized` + ColorSwatch `selected` / `button-base` 2 (Button · ToggleButton). 조사 문서의 hover 89 · pressed 88 은 variant 수가 아니라 다른 집계였다 — 스크립트 값이 정본. G0 (c) 기준선 §6.3. G0 (d) RED: `conditionTree.test.ts` 가 모듈 없음으로 FAIL 시작. G0 (b) 「다름 11」 Compare Mode 실측은 Phase 3 착수 전 (§6.1 — Phase 1 · 2 는 출력 무변경이라 그 표의 값이 바뀌지 않는다).

**Phase 1 (2026-11-01, 닫힘)** — 구현:

- `packages/shared/src/catalog/rule/conditionTree.ts` — 조건 어휘 (`CONDITIONS` · `DOM_CONDITIONS` · `VALUE_CONDITIONS`) · `ConditionalValue<T>` · 순회 `walk` 하나 · `evaluateConditionTree` (평가 순서의 마지막 참 leaf — 트리마다 펼친 leaf 목록을 `WeakMap` 에 두고 뒤에서부터 찾는다, R2) · `compileConditionTree` (블록 = leaf, source order = 평가 순서, 조건 선택자 전부 `:where()`, forced-colors · touch 는 `@media`, `domOnly` 는 트리 블록 뒤).
- `rulePaintTree.ts` — `variantPaintTree` (옛 → 트리, codemod 와 같은 변환) · `legacyVariantPaint` (트리 → 옛 `fill` · `colors`, 전환 단계 옛 소비자용) · `paintVariant` (표 helper) · `evaluatePaint`. `paintReach.ts` — `rulePaintReach` (닿는 축: 선택 = binding RAC `data-selected` ∪ `COLLECTION_ITEM_OWNERS` ∪ `selected` variant ∪ Column, fillStyle = binding `accepts.fillStyle` 값).
- 표: Button · ToggleButton · ToggleButtonGroup · ButtonGroup · FileTrigger 의 10 variant 를 `apps/builder/scripts/adr297-rule-to-tree.ts` (codemod — 표 실행 값 → `variantPaintTree` → 소스 위치, 주석 보존) 로 `paintVariant({ paint })` 로. `ComponentRuleVariant.paint` 추가. `resolveCatalogPaint` 는 `paint` 가 있는 variant 를 evaluator 로, 나머지는 옛 사슬 (`legacyStatePaint` — Phase 2 에서 삭제).

결정 (통상 구현 판단 — 사후 보고):

- (a) **트리 뿌리 = variant** — `variants.accent.paint.backgroundColor` 처럼 variant 마다 트리를 둔다 (본문 예시의 `variant: {…}` 값 조건을 가장 바깥에 둔 것과 같은 뜻 — variant 값은 서로 배타). variant 의 다른 키 (`borderStyle` · `textWeight` …) 와 주석을 그 자리에 두고 codemod diff 를 variant 안에 가둔다. `variant` 값 조건은 어휘에 남아 rule 단위 트리 (S2 모양) 로 끌어올릴 수 있다.
- (b) **leaf `null` = 「catalog 값 없음」** — 옛 Canvas 사슬은 선택 · outline · subtle 에서 그 칸만 칠한다 (칸이 비면 값 없음). 트리는 닿는 축에만 그 배타 가지를 `null` 로 둔다 (Card 는 선택되므로 `color.isSelected: null`, Button 은 선택되지 않으므로 없음). compiler 는 `null` 을 그대로 내고 CSS 작성자가 `revert-layer` 로 쓴다 (G1 (e) 하니스 — 조건이 하나도 안 맞는 요소와 같은 값). 「outline 에서 hover 글자를 읽지 않음」 은 칸이 비고 hover 값이 있을 때 트리로 담을 수 없어 codemod 가 멈춘다 (`ADR297_UNREPRESENTABLE_HOVER` — 닿는 축에서 표 0 건).
- (c) **G1 의 비교 영역 = 닿는 입력** — `resolveCatalogPaint.shadow.test.ts` (옛 사슬의 둘째 사본) 도 같은 영역으로 좁혔다 (6,840 → 3,387 행, diffs 0). 빠진 행은 어떤 컴포넌트도 만들지 못하는 입력이다.

G1 결과: 생성 CSS diff 0 (`validate:sync`) · paint 닿는 입력 10,044 행 동일 · library 투영 동일 · **표 전수 동치** (`rulePaintTree.test.ts` — 131 rule 의 모든 variant 를 트리로 옮겨도 닿는 입력 전부에서 옛 사슬과 같음 + 트리 → 옛 모양 왕복 동일 — Phase 2 codemod 의 사전 검증) · **(e) 겹침 조합 computed 대조** (`apps/builder/tests/parity/adr297ConditionCascade.browser.test.ts` — Button 가족 실 트리 + Input 테두리 (DOM 전용 `isFocused`) + round 1 반례 + `null` leaf, 조건 부분집합 전부, Chromium `getComputedStyle` == evaluator) PASS · 원복 RED 2 (평가 순서를 앞에서부터 = 동치 4 FAIL / `:where` 제거 = round 1 h1 반례 `quiet+hover+invalid` FAIL, 둘 다 백업 · trap 복원 · `cmp`). DOM 전용 조건 oracle 중 「`isFocused` 가지 삭제 → 기본색」 RED 는 Input 이 트리로 옮겨지는 Phase 2 에서 실 rule 로.

**Phase 2 (2026-11-01, 상태 칠 ① ② 닫힘)** — 구현:

- 표: 나머지 180 variant 를 codemod 로 (Phase 1 의 10 과 합쳐 190 = 인벤토리 `fill.default.base` 190, 건너뜀 0). 뒤이어 `paintVariant({…}, fsv)` 감싸기를 AST 로 걷어 표는 `{ paint, alpha?, … }` 평범한 객체다 (`paintVariant` 삭제).
- 타입: `ComponentRuleVariant` 의 `fill` · `colors` 삭제 → `paint` (필수) · `alpha`. 공개 타입 `ComponentRuleFill` · `ComponentRuleFillState` · `ComponentRuleVariantColors` 삭제 — 옛 형식은 `rulePaintTree.ts` 의 전환 단계 타입 `LegacyFill` · `LegacyFillState` · `LegacyColors` · `LegacyVariantPaint` (codemod 입력 · 생성기 옛 순서 입력) 로만.
- Canvas: `resolveCatalogPaint` 옛 사슬 (`legacyStatePaint`) 삭제 — 상태 칠 = evaluator. Styles 패널 미리보기 (`specPresetResolver.ts` `resolveStylePanelCatalogPaint`) 도 같은 함수라 따로 바꿀 것 없음 (휴지 상태 고정은 설계 그대로).
- 투영기 · DOM 컴포넌트: `codeCatalogLibrary.ts` · `ruleDefinition.ts` · `manualBoxRules.ts` · `Avatar.tsx` · `StatusLight.tsx` · `ProgressCircle.tsx` 는 `paintAt(tree, …path)` (그 가지에 **적힌** 값 — 평가 아님, 「hover 칸이 따로 있나」 를 가르는 투영기용) 로 읽는다. 출력 JSON 동일.
- Skia: builder `ruleVariantToVisual` 은 비-칠 값만 (`ComponentVisualRule` 의 칠 필드는 선택으로) — primitive 는 이미 해석된 `paint` 만 읽고 있었다 (실측: `visual.fill` · `visual.text` 류 non-comment 읽기는 `CSSGenerator.ts` 뿐).
- 생성 CSS: `generate-css.ts` `legacyPaintOf` — 트리 → 옛 `fill` · `colors` (§3 `legacyOrder`). 출력 동일.
- 테스트 이관: 경로 oracle 테스트 10 파일을 트리 경로로 (`adr290AccentRoles` 분류표 48 행은 기계 재정렬 — rule · variant 별 (토큰 · 역할) 묶음 48 = 48 일치), 전환 동치 테스트 (`rulePaintTree.test.ts`) 는 「생성기의 옛 입력에 옛 Canvas 사슬 == evaluator」 + 「트리 → 옛 입력 → 트리 왕복」 으로.

결정 (통상 구현 판단 — 사후 보고):

- (d) **③ · ④ · ⑤ 와 `VariantSpec` 삭제는 Phase 3 로** — ④ `rootSelectors` 의 `&` 대상 38 키 중 16 이 `:not()` · `:is()` 로 우선순위를 적어 트리 (순서로 대체) 로 옮기면 선택자 텍스트 · specificity 가 바뀌고, 12 키 (`data-field-button` 5 · `data-catalog-id` 6 (ListBox 팝오버) · `data-in-group` · `data-dialog-trigger` · autofill) 는 조건 어휘 밖이라 G3 (e) (`&` 대상 raw 0) 와 충돌한다 — 어휘 확장 여부는 Phase 3 착수 때 묻는다. ③ `structure.states` · ⑤ variant 이름 `selected` 도 생성기 블록 (상태 블록 · variant 블록) 을 바꿔야 해 Phase 3 의 `compile()` 전환과 같은 일이다. `VariantSpec` 은 그때까지 생성기의 옛 순서 입력이다.
- (e) **G2 ratchet 은 커밋 뒤** — dirty 트리에서는 ratchet 하니스가 HEAD worktree 를 잰다. 커밋 `dd7a12602` 뒤 결과: 판정 「측정 불가」 (A 초과 160 · 재실행 값 다름) 이지만 직전 커밋 `5e4d575cc` (ADR-297 코드 이전) 도 같은 게이트에서 A 초과 160 ~ 165 · 「측정 불가」 이고, 초과 경로 값이 같다 (`graph.ts#getEntry` 4067 → 5023 · `600:nested-flex` edit `execVisited` 10645 → 11869 등 — ratchet.json 마지막 갱신 10-28 `4599f7899` 뒤 121 커밋에 쌓인 것). 두 커밋의 결과 파일 지표 7,202 개를 값 범위로 대조하면 겹치지 않는 것은 v8 샘플 합계 (±0.5 %) · 순위 목록 · 소스 위치 · B 등급 (React measure · Layout · RecalcStyle) 뿐이고, 함수 호출 수 (`v8.fn.*`) · `render.*` · `caches.*` 의 차이는 0 — ADR-297 몫의 증가 0. 쌓인 A 초과의 귀속은 이 ADR 범위 밖이다.

G1 결과: 생성 CSS diff 0 · paint 닿는 입력 10,044 행 동일 (p2a codemod 뒤 · p2b 옛 사슬 삭제 뒤 · p2c 칸 삭제 뒤 세 번) · library 동일 (`revision` 만) · cascade parity PASS. G3 (Phase 2 분): `componentRulesTable.static.test.ts` — 옛 `fill` · `colors` 칸 0 · 트리 조건 키 ∈ `CONDITIONS` ∪ `DOM_CONDITIONS` ∪ 값 조건. 원복 RED 2 (Link variant 에 옛 `colors` 칸 하나 → G3 FAIL · Button accent `isHovered` 배경 삭제 → 기준선 4 행 차이 (static 없는 quiet × emphasized), 백업 · trap 복원 · `cmp`). 회귀: shared 2,319 중 실패 1 (Toast 수동 CSS — 이 작업 전부터) · rendering 1,284 PASS · builder unit 실패 4 파일 (history 라벨 · chromeIsland · labelKey · interactionWhenReach — 다른 세션 WIP). live (5177 · 콘솔 0): Badge accent · Checkbox 선택 · Avatar · StatusLight · Button primary · ToggleButton 강조 선택의 Canvas 칠과 Preview 값 (Badge `rgb(54,96,240)` · Checkbox `rgb(23,23,23)` · Avatar `var(--bg-muted)` / `var(--fg)` · StatusLight `var(--positive)` — 트리 값에서 나옴, 대체값 아님).

**Phase 3 (2026-11-01, 진행 중 — 3a · 3e · 3f · 3b · 3c · 3d)** — 사용자 결정 (본문 Status): 결정 2 = 확정 8 건 S2 대로 · 결정 3 = 수동 CSS selected · focus 전부 · `&` 대상 어휘 밖 12 키 = 어휘 확장.

- G4 판정 하니스 `apps/builder/tests/parity/adr297DomPaintParity.browser.test.ts` (표 전수 · 닿는 입력, 결과 `.agent/runs/adr297-dom-parity.json`): Preview 번들 (`styles/index.css`) + 테마 변수를 싣고, rule 마다 catalog 노드 모양 요소 (`data-catalog-id` · `button-base`) 에 RAC 상태 속성을 걸어 computed 배경 · 글자 · 테두리 == Canvas 판정 (`resolveCatalogPaint`). 전용 모듈 (`skiaPrimitive`) 로 그리는 rule 과 toggle-indicator 는 범위 밖. 둘째 테스트는 같은 요소를 Builder 묶음 (`builder-components.css`) · `data-catalog-id` 없이 재서 Builder 위젯 전후 대조 (R7). 하니스 함정: 한 요소를 재사용하면 transition 중간값을 읽는다 (`transition: none` 필수) — live Preview 사본 실측과 맞춘 뒤 썼다.
- 3a compiler 전환: `generate-css.ts` `variantPaintCssFor` 가 variant 트리를 `[data-variant]` 값 조건 아래 `compileConditionTree` 로 (`:where` · 트리 순서 = cascade). `null` leaf = 배경 · 테두리 transparent · 글자 inherit (`revert-layer` 는 같은 layer 의 기본 블록까지 되돌려 선택 ColorSwatch 에 글자색 테두리가 생겼다). alpha 0 = 모든 상태 투명 (전에는 휴지만 투명 · hover 는 칠 — Link hover 흰 바탕). 가려졌던 수동 칠 (Link 글자 · Popover 바탕 · 테두리) 은 `:not([data-catalog-id])` 로 Builder 전용.
- 3e button-base 흡수: Button · ToggleButton `cssEmitMode` → `buttonBase` (클래스 · Skia 자식 색 게이트 유지) + `defaultBorder: "color"` (기본 블록은 테두리 색만 — Button 의 1px solid 는 `Button.css`, ToggleButton 은 폭 0, 상자 크기 그대로). `.button-base` ramp (utilities layer) 는 `:not([data-catalog-id])`. Builder 묶음은 생성 `ToggleButton.css` 를 싣기 때문에 옛 `--button-*` 변수 블록을 `ToggleButton.css` 에 `:where(:not([data-catalog-id]))` (specificity 0 추가) 로 옮겼다.
- 3f static: 어휘에 값 조건 `staticColor` (black · white → `[data-static-color="…"]`). codemod `apps/builder/scripts/adr297-static-to-tree.ts` 가 옛 Canvas static 판정을 leaf 마다 가지로 (배경 = 불투명 칸만 static · 글자 = 그 배경 위 역상 · 테두리 = 폭 채널이 있거나 transparent 아님) — 대상 = staticColor 가 닿는 rule (`rulePaintReach.staticColor` — binding 8 + ProgressBar · Meter 파생 7, 33 variant). `resolveCatalogPaint` 의 static 후처리 삭제 (alpha · track wash 판정만 테마 칠로 남김).
- 측정: 표 전수 DOM ≠ Canvas **557 → 303 행** (2,196 중), Builder 위젯 변화 **0 / 1,287**. Button 계열 남은 것 = genai 그라데이션 (DOM 수동 · 전부터) · ToggleButton 테두리 (Canvas 가 배경과 같은 색으로 그림 — 보이지 않음) · ToggleButtonGroup 글자 (그려지는 글자 없음). Canvas: `resolveCatalogPaint.shadow.test.ts` (옛 static 사본 = oracle) 닿는 입력 2,238 행 diffs 0 · 기준선 `paint.reach.jsonl` 은 static 이 닿는 rule 에서 G0 과 같다 (다른 5,736 행 = staticColor 를 받지 못하는 rule 의 static 입력). live (5177 · 콘솔 0): Preview static white Button 흰 바탕 · 검은 글자 (전: hover 파랑) · 사례 6 quiet 선택 ToggleButton 진한 바탕 · 흰 글자 (전: 흰 바탕 흰 글자).
- 3b 상태 스타일 ③: `structure.states` (상태별 맵) → `structure.stateStyles` (속성마다 조건 트리 — `opacity` · `cursor` · `pointerEvents` · `transform` · `boxShadow` · `focusRing` (ring 토큰 → `outline` + `outline-offset`) · `background`). codemod `apps/builder/scripts/adr297-states-to-tree.ts` (72 교체 · 17 추가) 가 생성기의 **실효값** 을 적는다 — states 가 없거나 비어도 생성 시트를 내는 rule 은 기본 ring · disabled 블록을 받았으므로 그 값을 트리에. 단 그 기본 disabled 블록이 실제로 닿는 rule 만 — DOM 이 `data-disabled` 를 내는 것 (설치 RAC `Link` · `SliderOutput` · `SliderFill`, composition `Card.tsx`). RAC `Form` · `Separator` · `Header` 와 internal renderer 21 종은 내지 않아 그 블록은 죽어 있었고, 트리에 두면 Canvas 가 흐림을 새로 그린다 (Form 은 필드와 이중 — `formContext.test.ts` 가 잡음). Preview 번들 (`index.css`) 이 싣지 않는 생성 시트의 rule 은 적힌 값만 (기록: Avatar · ButtonGroup · MeterTrack · StatusLight … 10 rule 은 전부터 Canvas 0.38 / DOM 1). `generateStateStyles` 삭제 · `stateStylesCssFor` 가 compile. Canvas 흐림 (`disabledStateRules` · SliderTrack) = 같은 트리의 evaluator.
- **specificity (3b 판정)**: 상태 트리 블록은 size 블록 (`.react-aria-X[data-size]`, 0-2-0) 위 층이라 compile 루트를 클래스 두 번 (`.react-aria-X.react-aria-X:where(…)`, 0-2-0) 으로 둔다 — 조건은 전부 `:where` 안 · 트리 블록끼리 같은 높이라 순서 = 트리 순서 (Decision 2 의 뜻) 는 그대로이고, 옛 상태 블록 (`.X[data-disabled]` 0-2-0) 과 같은 높이라 size 블록 · 수동 CSS 와의 관계가 유지된다. 0-1-0 으로 먼저 내 보니 size 블록에 지고 (quiet 모서리 · field 버튼 모서리) 뒤에 오는 수동 0-1-0 이 이겼다 (Card · Tab · GridListItem · ListBoxItem 커서, Link · Popover ring — 그 수동 선언은 트리로 옮기고 Builder 전용 `:where(:not([data-catalog-id]))` 로 좁혔다).
- 3c `&` 대상 rootSelectors ④: 13 rule 42 키 → `stateStyles` (codemod `adr297-root-selectors-to-tree.ts` — 옛 선택자의 cascade 결과를 키 순서로: `:not(…)` 배제 → 나중 키). 어휘 확장 (사용자 결정): 값 조건 `fieldButton` · 공통 조건 `inGroup` (`[data-in-group]:not(:last-child)` — Canvas 도 노드 트리로 안다) · DOM 전용 `isAutofilled` · `isDialogTrigger` · `isCatalogNode` (`[data-catalog-id]` — 계획의 `inBuilderChrome` 은 부정이라 트리에 못 적는다: 가지는 덮기만 한다) · `isLink` (`[href]` — MenuItem · Tab, 승인 목록 밖이라 보고). 자손 · 형제 대상 (`nested` · `&[data-disabled] .react-aria-X`) 은 rootSelectors 에 남는다. Canvas 소비자 4 (`catalogQuietStyles` · `catalogInvalidBorderColor` · `catalogDisclosureBorders` · Color 조작기 disabled) 는 같은 트리의 evaluator — 옛 선택자 문자열 해석기 삭제. G3 (e) 게이트 (`&` 대상 키에 선언 0).
- 3h #6 은 3c 에서 반영: Input · DateInput 테두리 · 밑줄의 invalid 가 hover 를 이긴다 (S2 `field` — 옛 시트는 hover 0-4-0 이 invalid 0-2-0 을 specificity 로 이겼다). Canvas 는 전부터 invalid. Builder 자체 입력칸도 같이 바뀐다 (생성 시트 공유).
- 3d variant 이름 ⑤: Tag `selected` · `selectedEmphasized` · ColorSwatch `selected` → default 트리의 `isSelected` (· `isEmphasized`) 가지. `rulePaint` 의 variant 교체 삭제 · `_emphasized` (TagGroup 강조 파생) → 칠 조건 `isEmphasized`. Tag 앞 아이콘 · X 색 칸은 지웠다 — 글자색과 같은 값이고 primitive 가 `paint.color` 로 떨어진다 (X 색은 Tag 에서 읽는 곳이 없었다). Canvas 칠: 교체 ↔ 트리 24/24 동일. 아바타 대체 칠 (이미지 실패 때) 은 선택 Tag 에서 `layer-1` → `neutral-subtle` (선택 variant 의 값이 없어짐 — 보고).
- 측정 (3b ~ 3d, `adr297DomPaintParity` 기록 4 종): 상태 스타일 (rule × 상태 6) DOM catalog · Builder 위젯 Δ = 죽은 disabled 블록 21 rule 뿐 · Canvas 흐림 +4 rule (Card · Link · SliderFill · SliderOutput — DOM 은 이미 0.38). `&` 상태 조합 (13 rule × 속성 조합 · Popover 안팎) Δ = invalid+hover (#6) + 닿지 않는 disabled+hover (RAC `useHover({ isDisabled })`) 뿐. 칠 대조 303 그대로 · Builder 위젯 칠 변화 0. Canvas 출력 대조 (quiet · invalid · Disclosure 89 입력) Δ 2 = quiet invalid hover 의 밑줄 (옛 Canvas 는 선택자 순서로 읽어 DOM 과 달랐다 → 이제 둘 다 invalid). live (5177 · 콘솔 0): Preview Button · ToggleButton · Checkbox 의 disabled 0.38 · pressed 0.95 · focus ring; dev handle 로 넣은 quiet TextField (Canvas 밑줄만 · Preview 위 선 투명 · 밑줄 1px · 모서리 0) · Select field 버튼 (모서리 8 · 테두리 0) · quiet Disclosure (위아래 0) — 넣은 노드는 삭제 명령으로 정리.
- 3g 수동 selected · focus CSS (사용자 결정 3 「전부」): 인벤토리 = Preview 번들의 수동 sheet 에서 선택자에 `data-selected` · `data-focus-visible` · `data-focused` · `:focus` 가 있는 규칙 157 (선언 324 — ADR 의 74 · 78 은 선택자 줄 수). 형식 확장: rule 최상위 `partStateStyles` — 키 = 루트 기준 선택자 틀 (`&` = 루트 · `%` = 조건이 붙는 자리), 값 = `stateStyles` 와 같은 속성 → 조건 트리. 부품 (Checkbox 상자 · Radio 고리 · Switch track · thumb · 셀 · 항목 · `::before` · `::after`) 의 상태를 그 부품 자신 또는 RAC 가 상태를 싣는 요소 (CheckboxButton) 의 조건으로 적는다. 생성 sheet 가 없는 rule (`structure` 없음 — DOM 은 inline, `domBinding.runtime.ts` `noSheet` 판정이라 `structure` 를 붙이지 않는다: TagGroup · Tree · Table · GridList · ColorSwatchPicker) 과 `skipCSSGeneration` rule (Row) 은 상태 블록만 담은 sheet 를 내고 `index.css` 가 그 수동 sheet 바로 뒤에 싣는다. 어휘 확장 (DOM 전용): `isIndeterminate` · `isToday` · `isSelectionStart` · `isSelectionEnd`.
- 3g 옮긴 방식: 같은 속성에서 selected · focus 와 순서로 얽힌 상태 (pressed · invalid · disabled · hover · drop target · forced-colors) 는 같이 옮겼다 — 하나만 옮기면 트리 블록과 남은 수동 규칙의 specificity 순서가 갈린다 (Checkbox 상자: 0-3-0 selected < invalid < disabled · 0-4-0 pressed · 0-5-0 selected·pressed 를 트리 순서로). 수동 규칙은 `:where(:not([data-catalog-id], [data-catalog-id] *))` (specificity 0 추가 — Builder 위젯의 cascade 그대로) 로 Builder 위젯 전용. 값은 옛 sheet 그대로 (`var(--selected-color)` 등 — emphasized 가 정하는 변수는 수동 sheet 에 남는다).
- 3g oracle: 새 하니스 `apps/builder/tests/parity/adr297ManualStateParity.browser.test.ts` — 팔레트 instance 를 문서에 넣고 product DOM binding (`renderCatalogDom`) 으로 그린 **실제 catalog DOM** (39 owner — context 축 selectionStyle · isEmphasized · size · staticColor · orientation 포함) 에서 상태를 받는 요소에 RAC 상태 속성을 조합 (24 — field ↔ button 복제는 RAC 그대로) 으로 걸고 요소 · 자손 · pseudo · 셀의 td 를 잰다 (9,000+ 행). probe 모드가 수동 규칙을 파일별로 꺼 catalog 에 닿는 규칙을 골랐다. 결과: catalog Δ = Label focus 15 행 (RAC `Label` 은 상태 속성을 내지 않는다 — 도달 불가) 뿐 · Builder 위젯 Δ 0. 원복 RED: 트리 가지 하나 (강조 TagGroup) 제거 → 15 행 검출. 3b 합성 recorder 의 Cell · Column · Row · Tag · Tree focus · Row hover 차이와 칠 대조 303 → 301 은 조상 없이 항목 하나만 세운 합성 요소의 artifact (실제 DOM 에는 Table · Tree 조상이 있다).
- 3g 게이트: `adr297ManualStateRatchet.static.test.ts` — Preview 번들 수동 sheet 의 상태 규칙 중 catalog 노드를 빼지 않는 것 = 사유 목록 18 / 8 파일 (Builder 전용 sheet 6 · portal 팝오버 입력칸 · Builder 색 버튼 · Table drag 손잡이 숨김 · resizer 목록 2 · 앱 토스트 region 5 · ToggleButtonGroup static 비선택 2). 원복 RED (TagGroup 범위 좁힘 하나 되돌림). G3 어휘 게이트에 `partStateStyles` 추가.
- 3g 후속 (사용자 결정 2026-11-01 「RAC 와 동일한 진한 accent」): **ListBoxItem 선택 바탕** — 전에는 DOM (수동) 연한 accent · 글자 `--lb-on-accent-container`, rule 트리 · Canvas accent · 흰 글자 (S2 `ListBox` 는 스타일 없는 RAC 감싸기라 oracle 이 없었다). 수동 `ListBox.css` 의 선택 바탕 · 기본 `color` 를 Builder 위젯 전용으로 좁혀 catalog 항목은 트리 값 (accent · `--fg-on-accent`, label · description 은 상속) 을 받는다. 하니스 Δ = ListBox 항목 선택 조합만 (바탕 `rgb(218,238,255)` → `rgb(54,96,240)` · 글자 흰색) · chrome Δ0 · ratchet 남은 규칙 18 / 8 파일. 항목의 Icon 은 Canvas · DOM 둘 다 자기 색 (상속 대상 아님 — 대칭). 그밖에 기록: Row hover (DOM `--bg-muted` · Canvas 투명) · TreeItem 선택 글자 (`--fg-on-accent` 가 연한 바탕 위) 는 전부터의 차이로 값을 바꾸지 않았다.
- 3g live (5177 · 콘솔 0): dev handle 로 TagGroup (강조) · Checkbox · Tree · Table · Calendar · ColorSwatchPicker 를 넣고 Preview (`/publish`) 에서 클릭 — Tree 항목 선택 · Calendar 날짜 (accent · 흰 글자) · 견본 링 (`::after` 검정 · 흰 outline) · Checkbox (상자 칠 · svg 보임) 가 트리 값, 강조 Tag 선택 = accent 쌍, Table Row 선택 · hover = `--tbl-selected-bg` · `--bg-muted`. 상태 sheet 6 이 실렸다. 넣은 노드는 삭제 명령으로 정리.
- 3h (사용자 결정 2 「8 건 S2 대로」): 위 §6.2 표. Button 칠은 `buttonPaint` helper 하나 (`componentRulesTable.ts` — S2 키 순서 fill → outline → disabled → static) 가 6 variant 를 만든다. 두 소비자 연결: Canvas paint 조건에 `isDisabled` (`resolveCatalogPaint` — record 자기 값 · `catalogRulePaint` 가 owner 파생 `isDisabled` · `_fieldDisabled` 를 OR), Button 라이브러리 정의 (`codeCatalogLibrary.ts`) 는 손으로 옮기던 칠 (static 불투명 흰 · 검정 고정) 을 트리 평가로 — fill style × static × disabled × 상태 조합마다 조건 규칙 (나중이 이김). Button disabled opacity 삭제 (`BUTTON_DISABLED_STATE`). oracle 테스트 `adr297S2Paint.test.ts` (원복 RED 6/7 — DOM sheet 검사 1 은 생성 CSS 를 되돌리지 않아 GREEN). 옛 칠 사슬 등가 테스트 2 (`rulePaintTree` · `resolveCatalogPaint.shadow`) 는 Button · ToggleButton · InlineAlert 를 사유와 함께 뺀다 (`S2_ALIGNED_3H` — 3i 에서 사슬과 함께 삭제, 비교 2,181 → 1,983). 칠 대조 하니스 Δ: 301 → 300, 새 불일치는 genai 행뿐 (수동 `Button.css` 의 gradient 가 DOM 바탕을 덮는 알려진 한계 — 전에도 Button 불일치 30 이 전부 genai). 실제 DOM 하니스 chrome Δ0. Button.css gz 1,950 → 2,945 B. live (5177 · 콘솔 0, Compare Mode Preview + Canvas record): outline hover `#e5e5e5` · 테두리 `#171717` → `#0a0a0a` · disabled `#e5e5e5` / `#525252` opacity 1 · static white α 0.85 → 0.94 · 글자 검정 · accent pressed = hover `#2e52cc` · quiet ToggleButton 휴지 투명 → hover `#d4d4d4` → pressed `#a1a1a1` · InlineAlert subtle 테두리 투명. Canvas record (Button) 같은 값. 넣은 노드는 삭제 명령으로 정리.
- 3i 정리 (2026-11-02 — 동작 변경 0, 기준 = 생성 CSS 109 개 byte 동일 · 109 개 전부 다시 씀): 칠 타입은 트리 하나. 삭제 — `spec.types.ts` `VariantSpec` · `FillTokenSpec` · `FillStateTokens` (생성 sheet 기본 블록의 입력은 `VariantRestPaint` = 트리 `default` 3 개, IndicatorModeSpec 의 fill 은 자기 칸 `{ base, pressed }`), `cssEmitMode` (표 · 타입 · `usesButtonBaseUtility` · 생성기 — 3e 뒤 쓰는 rule 0), CSSGenerator 의 옛 variant 블록 (`_variantSource` 인자 · `generateVariantStyles` · button-base 변수 출력 — `variantPaintCssFor` 가 늘 있어 production 도달 0), generate-css 어댑터 (`ruleVariantToVisual` · `legacyPaintOf` · `variantSourceFor` · `ruleVariantToVariantSpec`), shared `legacyVariantPaint` 와 `Legacy*` 형식, 승인 4 — `fillTokens.ts` · `variantColors.ts` · `stateEffect.ts` · `resolveComponentVisual.ts` 의 test-only 함수 (barrel export `resolveFillTokens` · `resolveIndicatorFill` · `resolveStateColors` · `getVariantColors` · `getSizePreset` 도 — 외부 소비 0), 옛 사슬 등가 테스트 5 파일 (`rulePaintTree.test.ts` · `resolveCatalogPaint.shadow.test.ts` · `fillTokens.seam` · `FillTokenSpec.parity` · `resolveComponentVisual.test` — 사용자 승인 2026-11-02). `ComponentVisualRule` 은 이름을 두고 칠 칸을 뺐다 (비-칠 값 — 글자 굵기 · 글꼴 · 선 모양 · value 채움 색 · 아이콘 · 정렬 — 의 production 계약, 개명은 소비 ~40 파일의 이름 바꾸기뿐이라 하지 않음 — G3 (c) 의 「칠 타입 1 벌」 은 충족). builder `resolveSkiaVisualRule.ts` 도 같은 이유로 남는다 (2h 에서 칠 칸을 이미 뺀 비-칠 어댑터). 옮긴 것: rendering shape 테스트 ~30 의 옛 형식 fixture (`__tests__/fixtureVisual.ts` — 칠 fixture 는 `catalogPaintFixture.ts` 가 `paint` 로 바꾼다), Phase 2 codemod 의 옛 → 트리 변환 (`variantPaintTree` → `apps/builder/scripts/adr297-rule-to-tree.ts`, `--dry` 동작 확인). 규칙 `canvas-rendering.md` §2.5.5 를 트리 계약으로 교체. 검증: rendering 1,271 · shared 2,329 (Toast 1 = 전부터) · builder 영향 영역 5,133 (실패 = flake `phase4eG5LeafScope` · 날짜 의존 `interactionWhenReach` Calendar 4 — 11 월 달력의 마지막 칸이 다음 달 날이라 RAC 가 선택을 막는다, 3i 무관) · `generate:css --check` · `docs:stale-symbols` 0.
- 3 닫힘 판정 (2026-11-02): 합성 하니스 (`adr297DomPaintParity`) 는 rule 마다 조상 · 자식 없는 요소 하나에 상태 속성을 걸고 Canvas 쪽은 칠 입력 (`resolveCatalogPaint`) 만 읽어, Canvas 가 그 상자를 실제로 칠하는지 · DOM 이 부품 · 조상 선택자로 같은 값을 주는지 모른다. 새 하니스 `apps/builder/tests/parity/adr297RealPaintParity.browser.test.ts` — 팔레트 instance 39 (상태 · 변형 prop 포함) 를 문서에 넣고 같은 record 를 Canvas (`bindCatalogCanvas` node data — `box.fillColor` · `strokeColor` × `strokeWidth` · `text.color`) 와 Preview DOM (`renderCatalogDom` + 번들 CSS computed) 으로, 두 쪽 다 프로젝트 테마 (`catalogThemeState`) 로 잰다 (`.agent/runs/adr297-real-paint.json`). 결과: 536 칸 중 36 (합성 300 행의 ToggleButton 테두리 60 · TagGroup · Meter · Toast · ToggleButtonGroup · Group · Skeleton · ListBox · Input 은 실제 트리에서 0). 36 칸은 전부 ADR-297 이전 기록 (`before.json`) 에 있던 type.
  - ① 트리를 두 소비자가 다르게 읽음 8 칸 — 생성 CSS (`CSSGenerator.ts` `compositionOwnsContainerBox`) 는 composition 이 상자를 가진 rule 의 variant 칠을 내지 않는데 Canvas 는 트리의 바탕 · 테두리를 그렸다: CheckboxGroup · RadioGroup · DisclosureGroup · Form 흰 바탕, Pagination · Toolbar 흰 바탕 + Builder 에만 보이는 테두리. **수리** (사용자 결정 2026-11-02 「① 만 수리 후 닫기」 — S2 대로 칠 없음): 6 rule 의 바탕 → `{color.transparent}`, 테두리 칸 삭제 (글자색 유지). 게이트 `packages/shared/src/catalog/__tests__/adr297ContainerPaintGate.test.ts` — composition 이 상자를 가진 rule (containerStyles 색 없음) 의 트리에 보이는 바탕 · 테두리 0, 원복 RED (옛 표 → 6 rule 검출). 생성 CSS 변화 0 (`generate:css --check`). 실제 트리 36 → 28 · 합성 300 → 264. live (5177 · 콘솔 0): dev handle 로 6 컴포넌트를 넣어 Canvas 에서 Toolbar · Pagination 의 테두리 상자가 없음을 확인, 삭제 명령으로 정리.
  - 후속 (트리 계약 밖 — 값 · 구조의 다른 원천, LOW): ② 수동 CSS 만 칠함 8 (GridList 바탕 · 테두리 `GridList.css` · Checkbox · Radio 바탕 · TableHeader · Tree 옅은 회색) · ③ Table 선 10 (Column · Row 테두리 Canvas 만 — DOM 은 칸 (td) 에 그릴 수 있어 화면 대조 필요) · ④ Pagination 쪽 버튼 5 (Canvas 현재 쪽 accent · DOM 전부 회색) · ⑤ 값 3 (Toolbar Separator 212 / 229 · Tabs 글자 82 / 23 · Image 빈 바탕) · ⑥ genai 그라데이션 2 (알려진 한계).
  - 회귀: shared 2,332 (실패 1 = Toast 수동 CSS, 전부터) · rendering 1,271 · builder catalogRuntime · panels · canvas · preview 5,953 (실패 6 = History `toastShape` 라벨 (다른 작업) · flake `phase4eG5LeafScope` · 날짜 의존 Calendar 4).
- 4 (2026-11-02): G5 live — Chrome MCP 5177, 결과는 ADR 본문 `### Live Exercise` (6 경우 PASS · 콘솔 0). 방법: Library 상태 원본 (`origin-component-button--hover` · `--pressed` · `togglebutton--hover`) 의 instance 를 넣어 Canvas 상태 칠을 띄우고 (노드 자기 `displayState` 는 record 에 실리지 않는다 — resolver 는 instance root 층 · patch · template 의 값만 읽는다), Canvas node data 와 Preview computed style (RAC 상태 속성 · Tag 는 실제 클릭) 을 대조. 「Checkbox static white」 는 대상 없음 (Checkbox 는 `staticColor` 를 받지 않는다 — S2 도) → 강조 선택으로 대체. Styles 패널은 트리를 `interactionState: "default"` 로 읽어 hover · pressed 상태 원본에서 휴지 값을 보인다 (297 전부터, 설계). 관찰 LOW: 강조 Tag 선택 + hover 의 Preview 회색 테두리 = 수동 `TagGroup.css` `&[data-hovered]` (후속 ② 부류). G6: `ssot-hierarchy.md` D3 (상태 우선순위 = 트리 순서) · `canvas-rendering.md` §2.5.5 (컨테이너 칠 게이트 · 실제 트리 하니스 · 패널 휴지 평가) · `style-ssot.md` §3 (패널 칠 표시 = 같은 트리).
- 4 후속 수리 (2026-11-02, 사용자 보고 「taggroup remove button」): ① 높이 — Tag part rule (`manualBoxRules.ts`) 이 지우기 Button 의 18 상자에 최소 폭만 풀어 Button rule 의 S2 최소 높이 (295 3a) 가 Tag 를 32 → 46 으로 키움 → `minHeight: 0`. ② 바탕 (297 회귀) — 3e 가 `.button-base` 변수 ramp 를 catalog 노드에서 껐는데 DOM (`domBinding.runtime.ts`) 은 작성 칠을 `--button-color` · `--button-border` · `--button-text` 로 내 Preview 에서 사라졌다 (Tag 지우기 버튼 = variant 검정 바탕 · 흰 X, 일반 Button 의 Styles Fill 도). 작성 칠은 inline 속성으로 — Canvas 처럼 모든 상태에서 작성 값. `TagGroup.css` 의 죽은 `--button-text: currentColor` → `color: inherit`. 회귀 테스트는 변수 문자열을 확인하던 6 곳을 inline 기대로. live 5177: Canvas · Preview 지우기 버튼 투명 (휴지 · hover · pressed) · X = Tag 글자색 (선택 흰 · 비선택 171717) · Button 작성 Fill #ff0000 두 쪽 같음 · 콘솔 0.

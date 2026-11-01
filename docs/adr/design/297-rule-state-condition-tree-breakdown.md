# ADR-297 설계 breakdown — rule 상태 조건 트리 (evaluator · compiler)

> 본문: [../297-rule-state-condition-tree-single-priority.md](../297-rule-state-condition-tree-single-priority.md). 이 문서는 구현 상세 (분리 4 질문 · 인벤토리 · 형식 · Phase · 파일 · 게이트 절차) 만 담는다. `docs/adr/evidence/` 는 gitignore 라 실측 결론은 여기 §6 에 둔다. 조사 원문: [RULE_STATE_CONDITION_TREE_2026-11](../../explanation/research/RULE_STATE_CONDITION_TREE_2026-11.md).

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

| #   | 상태 · 컴포넌트                      | 조사 판정 (추정 여부)            | 실측 (Canvas / DOM) | 확정 / 기각 |
| --- | ------------------------------------ | -------------------------------- | ------------------- | ----------- |
| 1   | hover — Button accent (button-base)  | 다름 (확정 — util:24 vs rCP:84)  |                     |             |
| 2   | hover — Button outline               | 다름 (확정 — util:96 vs 없음)    |                     |             |
| 3   | hover — Input accent (rootSelectors) | 다름 (추정 — 0-4-0 계산)         |                     |             |
| 4   | hover+invalid — Input                | 다름 (추정)                      |                     |             |
| 5   | pressed — Button (그림자 · mix)      | 다름 (확정)                      |                     |             |
| 6   | selected — ToggleButton quiet        | 다름 (추정 — 0-3-0 순서)         |                     |             |
| 7   | disabled — Button 색 (RAC context)   | 다름 (확정 — util:83 vs opacity) |                     |             |
| 8   | invalid+focus — Input                | 다름 (추정)                      |                     |             |
| 9   | staticColor hover — Button           | 다름 (확정 — 수동 CSS ramp)      |                     |             |
| 10  | quiet hover — ToggleButton           | 다름 (추정 — CG:1006 slot)       |                     |             |
| 11  | subtle border — InlineAlert          | 다름 (추정)                      |                     |             |

### 6.2 Phase 3 before/after (건마다)

| #   | 건  | before Canvas | before DOM | oracle (S2 소스 / 결정 2) | after (둘 다) |
| --- | --- | ------------- | ---------- | ------------------------- | ------------- |

### 6.3 기준선 · 측정

정본 = `apps/builder/scripts/adr297-baseline.ts <outDir>` (출력은 `.agent/runs/2026-11-01-adr297-execute/{g0,p1,p2a,p2b,p2c}/` — 로컬 전용). g0 = HEAD (`b140aed14`) 의 표, p1 = Phase 1 뒤, p2c = Phase 2 뒤.

| 항목                                  | before (Phase 0, HEAD 표)                                                                                       | Phase 1 (Button 가족 트리)                                        | Phase 2                              | Phase 3 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------- |
| 생성 CSS 103 해시                     | `0c4b0c8e…`                                                                                                     | 동일 (`pnpm validate:sync` PASS — `--check` 는 한 줄 달라도 실패) | 동일 (`validate:sync`)               | Δ 기록  |
| paint 닿는 입력 (`paint.reach.jsonl`) | 10,044 행 `ed15fc5b…`                                                                                           | 동일                                                              | 동일                                 | Δ 기록  |
| paint 전 입력 (`paint.jsonl`)         | 41,040 행 `5e519fda…`                                                                                           | 1,368 행 다름 — 전부 닿지 않는 입력 (아래)                        | 26,699 행 다름 — 전부 닿지 않는 입력 |         |
| library JSON (정렬 키 · `paint` 제외) | `c1f6485c…`                                                                                                     | `revision` 1 줄만 다름 (표 내용 해시 — 검증은 비어 있지 않음만)   | `revision` 1 줄만 다름               | 동일    |
| ratchet 카운트 (paint 부류)           | 미측정 — dirty 트리는 HEAD worktree 를 잰다 (메모리 `reference-perf-ratchet-dirty-tree-measures-head-worktree`) | 커밋 뒤 G2 와 함께                                                | 커밋 뒤                              |         |
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
- (e) **G2 ratchet 은 커밋 뒤** — dirty 트리에서는 ratchet 하니스가 HEAD worktree 를 잰다.

G1 결과: 생성 CSS diff 0 · paint 닿는 입력 10,044 행 동일 (p2a codemod 뒤 · p2b 옛 사슬 삭제 뒤 · p2c 칸 삭제 뒤 세 번) · library 동일 (`revision` 만) · cascade parity PASS. G3 (Phase 2 분): `componentRulesTable.static.test.ts` — 옛 `fill` · `colors` 칸 0 · 트리 조건 키 ∈ `CONDITIONS` ∪ `DOM_CONDITIONS` ∪ 값 조건. 원복 RED 2 (Link variant 에 옛 `colors` 칸 하나 → G3 FAIL · Button accent `isHovered` 배경 삭제 → 기준선 4 행 차이 (static 없는 quiet × emphasized), 백업 · trap 복원 · `cmp`). 회귀: shared 2,319 중 실패 1 (Toast 수동 CSS — 이 작업 전부터) · rendering 1,284 PASS · builder unit 실패 4 파일 (history 라벨 · chromeIsland · labelKey · interactionWhenReach — 다른 세션 WIP). live (5177 · 콘솔 0): Badge accent · Checkbox 선택 · Avatar · StatusLight · Button primary · ToggleButton 강조 선택의 Canvas 칠과 Preview 값 (Badge `rgb(54,96,240)` · Checkbox `rgb(23,23,23)` · Avatar `var(--bg-muted)` / `var(--fg)` · StatusLight `var(--positive)` — 트리 값에서 나옴, 대체값 아님).

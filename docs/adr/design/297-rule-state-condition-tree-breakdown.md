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

| 항목                         | before (Phase 0) | Phase 2 | Phase 3 |
| ---------------------------- | ---------------- | ------- | ------- |
| 생성 CSS 103 해시            |                  | 동일    | Δ 기록  |
| paint JSON                   |                  | 동일    | Δ 기록  |
| library JSON                 |                  | 동일    | 동일    |
| ratchet 카운트 (paint 부류)  |                  |         |         |
| frame p95 (fixed-inputs)     |                  |         |         |
| Builder initial gz / Preview |                  |         |         |

# ADR-912 follow-up breakdown: catalog SSOT collapse

> 본문: [ADR-912](../912-rac-pencil-rebuild-cutover.md).
> 본 문서는 ADR-912 의 "spec fallback 제거 + registry collapse" 목표를 실제로 끝내기 위한
> 후속 설계서다. 새 ADR 이 아니다. ADR-913 의 값 재구축과도 분리한다.
>
> 상태: 설계 문서. 코드 변경은 별도 phase 로 진행한다.

---

## 0. 결론

ADR-912 는 `TAG_SPEC_MAP`/spec fallback 을 catalog 로 모으기 위해 시작됐지만,
현재 구현에는 전환기 bridge 가 남아 있다. 특히 `STRUCTURE_META` 가 CSS virtual
spec 구조를 소유하고, Skia layout 은 `implicitStyles.ts` field branch 와 local
`LOWERCASE_COMPONENT_RULE_CONTAINER` map 을 소유하며, Style Panel 은
`specPresetResolver.ts` 에서 여전히 `TAG_SPEC_MAP[type]` 을 직접 읽는다.

따라서 "Style Panel 에 `componentRulesTable` fallback 을 추가"는 증상 완화일 뿐
collapse 가 아니다. 최종 목표는 다음 하나다.

> component type 의 D3 값과 구조 메타는 `componentRulesTable` 의 `ComponentRule`
> 한 entry 에서만 선언한다. CSS generator, Skia/layout, Style Panel, test guard 는
> 모두 shared catalog resolver 를 통해 그 entry 를 소비한다.

## 1. 현재 분산 ledger

| Source                                                                     | 현재 역할                                                                                                                                                                                                                                                              | 문제                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`             | variants, sizes, 일부 `containerStyles`, `containerVariants`                                                                                                                                                                                                           | field root layout(`flex-column`)과 CSS emit 구조 메타가 없음                                                                                                                                                                           |
| `packages/specs/scripts/generate-css.ts` `STRUCTURE_META_ENTRIES`          | virtual CSS emit membership, `archetype`, `element`, `composition.layout`, states, `cssEmitMode`, `indicatorMode`                                                                                                                                                      | shared catalog 밖의 두 번째 구조 SSOT                                                                                                                                                                                                  |
| `packages/specs/src/renderers/CSSGenerator.ts` `COMPOSITION_LAYOUT_STYLES` | `flex-column` 등 layout token 을 CSS base style 로 변환                                                                                                                                                                                                                | generator 전용 변환이라 Panel/Skia 가 같은 source 를 직접 못 읽음                                                                                                                                                                      |
| `apps/builder/.../implicitStyles.ts` `LOWERCASE_COMPONENT_RULE_CONTAINER`  | Skia/layout 의 catalog fallback                                                                                                                                                                                                                                        | builder-local map 이라 Style Panel 과 중복될 수밖에 없음                                                                                                                                                                               |
| `apps/builder/.../implicitStyles.ts` field branches                        | TextField/TextArea/DateField/TimeField 등 기본 column + side row 보정                                                                                                                                                                                                  | catalog rule 이 아닌 컴포넌트별 hard branch                                                                                                                                                                                            |
| `apps/builder/.../implicitStyles.ts` 인라인 base-axis fallback (7곳)       | field류 5 (`:1279` searchfield / `:1340` numberfield / `:1487` textfield·textarea / `:1551` datefield·timefield / `:1879` datepicker) + collection-item 2 (`:841` gridlistitem / `:865` listboxitem) 의 `display:flex / flexDirection ?? "column" / gap ?? N` 하드코딩 | §1-1 이 근본 원인이라 지목한 base-axis drift 가 **한 branch 가 아니라 field·collection-item branch 전반에 동형 복제**되어 살아 있음 (`:841`/`:865` 주석이 스스로 "spec body 삭제 대비 분기 자족화" 인정 — Δ4 mirror 와 동형 dual-SSOT) |
| `apps/builder/.../implicitStyles.ts` 숫자 mirror 상수 (`:301-343`)         | `VALUE_FILL_TRACK_HEIGHT` / `INDICATOR_SIZES` / `PROGRESSBAR_ROW_GAP` / `PROGRESSBAR_COL_GAP` / `SLIDER_ROW_GAP`                                                                                                                                                       | ProgressBarTrack/MeterTrack height + Checkbox/Radio gap 의 catalog.sizes 평행 복사본 (주석이 스스로 "rule 이 SSOT" 인정)                                                                                                               |
| `apps/builder/.../specPresetResolver.ts`                                   | Style Panel preset resolver                                                                                                                                                                                                                                            | `TAG_SPEC_MAP` 직독. spec 삭제 type 은 빈 preset 이 되어 hard fallback 표시                                                                                                                                                            |
| `packages/specs/.../CSSGenerator.ts` `COMPOSITION_LAYOUT_STYLES`           | layout token(`flex-column` 등) → CSS base style 변환                                                                                                                                                                                                                   | generator-private 라 Skia/Panel 이 같은 layout token table 을 못 읽음                                                                                                                                                                  |

### 1-1. field류 base layout 의 실제 출처

field류 `display:flex` / `flex-direction:column` 은 `componentRulesTable` 에 없다.
현재 source 는 `generate-css.ts` 의 `STRUCTURE_META_ENTRIES` 안
`composition.layout = "flex-column"` 이고, CSS emit 은 `CSSGenerator.ts`
`COMPOSITION_LAYOUT_STYLES["flex-column"]` 이 만든다.

Skia 는 이 값을 shared catalog 에서 읽지 않고, field 전용 branch 에서
`display:flex` / `flexDirection:column` 을 다시 주입한다. 이 구조가 이번 이슈의
핵심 drift 원인이다.

## 2. Target architecture

### 2-1. ComponentRule 를 catalog 단일 entry 로 확장

`ComponentRule` 에 generator-only 구조 메타를 흡수한다. 기존
`containerStyles` / `containerVariants` 는 유지하되, `STRUCTURE_META` 에만 있던
필드를 `structure` 로 이동한다.

```ts
export interface ComponentRule {
  defaultVariant?: string;
  defaultSize?: string;
  variants: Record<string, ComponentRuleVariant>;
  sizes: Record<string, ComponentRuleSize>;
  textDecoration?: string;
  containerStyles?: Record<string, string>;
  containerVariants?: Record<
    string,
    Record<string, ComponentRuleContainerVariantStyles>
  >;
  structure?: ComponentRuleStructure;
}

export interface ComponentRuleStructure {
  emitCss: true;
  archetype: ComponentRuleArchetype;
  element: string;
  layout?: "flex-column" | "flex-row" | "inline-flex" | "grid";
  composition?: ComponentRuleComposition;
  states?: ComponentRuleStates;
  cssEmitMode?: "direct" | "button-base";
  indicatorMode?: ComponentRuleIndicatorMode;
}
```

`structure.layout` 은 field류 root layout 의 정본이 된다. 예:

```ts
TextField: {
  defaultSize: "md",
  variants: {},
  sizes: { ... },
  containerVariants: {
    "label-position": {
      side: { styles: { "flex-direction": "row", "align-items": "flex-start" } },
    },
  },
  structure: {
    emitCss: true,
    archetype: "default",
    element: "div",
    layout: "flex-column",
    composition: {
      gap: "var(--spacing-xs)",
      containerStyles: { width: "fit-content" },
      // delegation/static selectors/root selectors 는 기존 STRUCTURE_META 내용을 그대로 이동
    },
    states: {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38, cursor: "not-allowed", pointerEvents: "none" },
      focusVisible: { focusRing: "{focus.ring.default}" },
    },
  },
}
```

CSS emit 대상이 아니면 `structure` 를 두지 않는다. 이렇게 해야 "entry 는 있으나
emit 안 됨" 같은 세 번째 상태가 생기지 않는다.

### 2-2. Shared catalog resolver 를 단일 진입점으로 만든다

새 resolver 는 `@composition/shared` 에 둔다. builder-local lowercase map 은
삭제 대상이다.

필수 API:

```ts
resolveCatalogRule(type, doc?)
resolveCatalogStructure(type, doc?)
resolveCatalogContainerBase(type, doc?)
resolveCatalogContainerVariants(type, props, doc?)
resolveCatalogStylePreset(type, props, size, doc?)
resolveCatalogSizeField(type, size, field) // Δ4 — track height / indicator gap 등 size-value 단일 진입
```

역할:

- `resolveCatalogRule`: 기존 `resolveComponentRule` 의 alias 또는 replacement.
- `resolveCatalogStructure`: `rule.structure` 를 반환.
- `resolveCatalogContainerBase`: `structure.layout`,
  `structure.composition?.containerStyles`, `rule.containerStyles` 를 merge.
  layout token 은 shared 의 단일 `CATALOG_LAYOUT_STYLES` 로 변환한다.
  **merge 우선순위 (Δ2 — 단일 거처 확정)**: `structure.layout → CATALOG_LAYOUT_STYLES` (base, 최저)
  ← `structure.composition.containerStyles` (layout 파생) ← top-level `rule.containerStyles`
  (컴포넌트별 override, last-wins). 이 precedence 를 `resolveCatalogContainerBase` 안에
  inline 으로 못박아 generator/Skia/Panel 이 갈라지지 않게 한다. `containerVariants` 는
  top-level 에만 둔다 (`structure` 로 중복 이동 금지).
- `resolveCatalogContainerVariants`: `rule.containerVariants` 를 props 와 매칭한다.
  **이동이 아니라 재작성 (Δ3)**: 기존 `resolveContainerVariants` (`packages/specs/src/renderers/resolveContainerVariants.ts:40-73`)
  는 `spec: ComponentSpec<P>` 를 입력으로 받아 specs 에 결합돼 있다 — 그대로 옮길 수 없다.
  shared 에 plain-data 시그니처 `resolveCatalogContainerVariants(rule, props)` 로 **새로 작성**하고
  (출력 shape 는 기존 `ResolvedContainerVariants` 와 동일), builder 의 임시 adapter
  (`implicitStyles.ts:578-600` 의 `{ composition: { containerVariants } } as ...` cast)는 shared 버전 land 후 삭제한다.
  기존 spec 버전은 generator 의 virtual-spec 경로 전용으로 specs 에 잔존.
- `resolveCatalogStylePreset`: Style Panel 이 쓰는 size/container/layout preset 을
  반환한다. `TAG_SPEC_MAP` 을 보지 않는다.
- `resolveCatalogSizeField` (Δ4): `componentRulesTable.{type}.sizes.{size}.{field}` 단일 진입.
  ProgressBarTrack/MeterTrack `height`, Checkbox/Radio `gap` 등 implicitStyles 가 하드코딩 mirror 로
  들고 있던 size-value 를 catalog 에서 직접 읽게 한다.

**의존 방향 (Δ1 — 정정)**: 현재 실측 의존 방향은 `shared → specs` (shared 가 specs 를 13 파일 import,
package.json `@composition/specs: workspace:*` / 역방향 0). `ComponentRule` 타입은 shared
(`composition-document.types.ts:348-381`) 에 specs import 0 으로 정의돼 있으므로, **새 shared resolver 는
specs 를 import 할 필요가 없다 — `@composition/specs` import 신규 추가 금지** (`grep -c "@composition/specs"`
새 resolver 파일 = 0). 기존 shared 의 13 forward import 는 다른 consumer 용으로 무관하게 잔존. 금지되는
역의존은 `specs 가 shared 를 import` 하는 방향이며, 그 방향은 이미 0 이고 본 작업도 만들지 않는다.
(이전 문구 "`specs <- shared` 역의존을 만들지 않는다" 는 표기상 방향이 모호했음 — 위로 명확화.)

출력은 CSS-style key(kebab-case)와 builder-style key(camelCase)를 둘 다 만들지
않는다. shared resolver 는 CSS-style raw data 를 반환하고, Builder/Panel 쪽에서
기존 normalization helper 로 camelCase 변환한다. 변환 책임까지 resolver 에 넣으면
DOM/Skia/Panel의 출력 요구가 섞인다.

### 2-3. CSS generator 는 catalog entry 를 virtual spec 으로 adapt 한다

`generate-css.ts` 는 `STRUCTURE_META_ENTRIES` 를 삭제한다. `buildVirtualSpecs()` 는
`getComponentRulesTable()` 을 순회하고 `rule.structure` 가 있는 entry 만 virtual
`ComponentSpec` 으로 adapt 한다.

```ts
for (const [name, rule] of Object.entries(getComponentRulesTable())) {
  if (!rule.structure) continue;
  result.push(componentRuleToVirtualSpec(name, rule));
}
```

`componentRuleToVirtualSpec` 만 `packages/specs` 내부 adapter 로 남긴다. adapter 는
legacy spec 을 정본으로 되살리는 것이 아니라, CSSGenerator 가 아직 `ComponentSpec`
shape 를 입력으로 받기 때문에 필요한 build-time shim 이다.

**Δ7 — generator-private layout token table 제거**: `CSSGenerator.ts` 의
`COMPOSITION_LAYOUT_STYLES` (`:656-675`) 를 삭제하고, `generateBaseStyles` 가 shared 의 단일
`CATALOG_LAYOUT_STYLES` 를 소비하도록 재배선한다. 이렇게 해야 §5 kill criteria
"CSS generator 와 Skia/layout 이 서로 다른 layout token table 을 가진다" 가 가정이 아니라
실제로 닫힌다 (generator-private 복사본이 남으면 layout token table 이 둘로 갈라진 채 유지됨).

### 2-4. Skia/layout 은 shared resolver 로만 읽는다

`implicitStyles.ts` 의 local `LOWERCASE_COMPONENT_RULE_CONTAINER` map 을 제거한다.
`resolveContainerStylesFallback` wrapper 와 `resolveActiveContainerVariants` 는 shared
resolver 를 호출한다.

field branch 는 완전히 삭제하지 않는다. 자식 filtering, side label child injection,
DateInput/SelectTrigger 특수 child handling 은 여전히 layout behavior 이다. 단,
base axis(`column`)와 side axis(`row`) 결정은 branch 안 하드코딩이 아니라
`resolveCatalogContainerBase` / `resolveCatalogContainerVariants` 결과로만 결정한다.

**Δ6 — 인라인 base-axis fallback 삭제 (근본 원인, 7곳 전수)**: codex 초안이 지목한
`:1486-1489` 단일 위치는 **부정확** — 실측 결과 textfield/textarea branch 의 fallback 은
`:1487` 이고, 동형 base-axis 하드코딩이 **7곳에 복제**되어 있다. 한 곳만 삭제하면 나머지가
dual-SSOT 로 잔존해 §5 kill criteria 가 닫히지 않는다. 전수 삭제 대상:

- **field류 5**: `:1279` searchfield / `:1340` numberfield / `:1487` textfield·textarea /
  `:1551` datefield·timefield / `:1879` datepicker — 각 branch 의
  `display: specFallback.display ?? "flex", flexDirection: specFallback.flexDirection ?? "column", gap: specFallback.gap ?? 4`
- **collection-item 2**: `:841` gridlistitem / `:865` listboxitem — `flexDirection: (parentStyle.flexDirection as string) ?? "column"`
  (주석이 스스로 "ADR-912 cutover … spec body 삭제 대비 분기 자족화" 인정 = Δ4 mirror 와 동형 dual-SSOT)

base axis 는 오직 `resolveCatalogContainerBase` 에서만 온다. 이 인라인 fallback 군이 §1-1 이
지목한 drift 의 root cause 자체이므로, 한 곳이라도 남겨두면 collapse 후에도 동일 분산이 재현된다.
(주의: `gap ?? N` 의 N 은 branch 별로 다름 — gridlistitem `?? 2` / listboxitem `?? 2` / field류 `?? 4`.
삭제 시 catalog `sizes.gap` 또는 `structure.composition.gap` 으로 치환하되 기존 N 값과 byte-diff 0 확인.)

**Δ4 — 숫자 mirror 상수 제거 (catalog.sizes 단일화)**: `implicitStyles.ts` 의 평행 복사본
`VALUE_FILL_TRACK_HEIGHT` (`:316`), `INDICATOR_SIZES.gap` (`:301`), `PROGRESSBAR_ROW_GAP` /
`PROGRESSBAR_COL_GAP` (`:308-309`), `SLIDER_ROW_GAP` (`:343`) 을 삭제하고, 소비처
(`:1615/1657-1658/1731/1786/1817/1953-1954/1993-1994`) 를 `resolveCatalogSizeField(type, size, field)`
로 교체한다 — `componentRulesTable.{ProgressBarTrack,MeterTrack}.sizes.height` 와
`{Checkbox,Radio}.sizes.gap` 을 직접 읽는다. 이 상수들의 주석 자체가 "rule(componentRulesTable)
이 SSOT" 라고 인정하면서 복사본을 유지하던 것 — 이번 collapse 가 끝내려는 dual-SSOT 의 한 사례.

**Δ5 — `INDICATOR_SIZES.box` 소유권 결정**: `box = {16,20,24}` 는 `componentRulesTable.Checkbox.sizes`
에 없다 (`gap` 만 있음). (a) `boxSize` 를 Checkbox/Radio `sizes` rule entry 로 승격해 단일 선언으로
만든다 — **권장**, 또는 (b) §4 Non-goals 에 "Skia-render 전용 상수" 로 명시한다. 둘 중 하나로
결정하지 않으면 소유처 없는 hidden source 로 남는다.

### 2-5. Style Panel 은 catalog style preset 을 읽는다

`specPresetResolver.ts` 의 `TAG_SPEC_MAP` import 를 제거한다.

Panel fallback 우선순위는 유지한다.

1. inline style
2. computed/inherited style
3. catalog preset
4. global UI fallback

catalog preset 은 다음을 포함해야 한다.

- size: `fontSize`, `borderRadius`, `height`, `gap`, padding 계열 등 기존 rule sizes
- base container: `display`, `flex-direction`, `align-items`, `width`, `gap`
- active container variant: `labelPosition=side` 등 props 기반 row/align override

TextField 기대값:

| props                                 | Layout Panel preset                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `{ labelPosition:"top" }` 또는 미지정 | `display:flex`, `flexDirection:column`, rule size gap                       |
| `{ labelPosition:"side" }`            | `display:flex`, `flexDirection:row`, `alignItems:flex-start`, rule size gap |

이 값이 Style Panel 에 표시되면 TextField high 이슈가 닫힌다.

## 3. Phase plan

### Phase 0 — red tests and guard inventory ✅ Land 완료 (2026-06-19)

수정 전에 실패 테스트를 먼저 고정한다.

- ~~`specPresetResolver.test.ts`~~ → **Phase 4 로 이동** (게이트 위생 결정, 아래 참조)
  - TextField without spec: top/default -> column preset.
  - TextField without spec: side -> row preset.
  - TagGroup: base containerStyles + side variant 모두 catalog resolver 로 표시.
- shared resolver test ✅ — `packages/shared/src/catalog/__tests__/resolveCatalogContainer.test.ts` (14 PASS)
  - `resolveCatalogContainerBase("TextField")` -> flex column. ✅ (Δ2 precedence 검증)
  - `resolveCatalogContainerVariants("TextField", { labelPosition:"side" })` -> row. ✅
  - `resolveCatalogSizeField` -> ProgressBarTrack.height=8 / Checkbox.gap=8 (mirror byte 일치). ✅
  - unknown type -> empty. ✅
- grep guard ✅ — `packages/shared/src/catalog/__tests__/adr912CollapseGrepGate.test.ts` (9 PASS, baseline 단조 감소 방식)
  - 즉시-0: 새 resolver 의 `@composition/specs` **import 문** = 0.
  - baseline 고정(collapse 진행하며 0 으로 낮춤): STRUCTURE_META_ENTRIES(2) / COMPOSITION_LAYOUT_STYLES(2) /
    LOWERCASE_COMPONENT_RULE_CONTAINER(3) / base-axis fallback(7) / VALUE_FILL_TRACK_HEIGHT(8 occurrence) /
    INDICATOR_SIZES(5) / PROGRESSBAR·SLIDER gap(6) / TAG_SPEC_MAP(3). 초과 시 regression 감지.
  - **정밀화 P0-(a)**: §3 원안 `grep -c "@composition/specs" = 0` 은 **주석에 그 문자열을 쓰면 false
    positive** (resolver 가 패키지 경계를 설명하느라 2회 인용 → 가드 자기-위반). 가드를 `from ['"]@composition/specs`
    import 문만 검사하도록 좁힘.
  - **정밀화 P0-(b)**: occurrence 카운트는 `grep -c`(라인 수)가 아니라 JS `match(/g)`(총 등장 수). 같은 라인
    2회 등장(`X[s] ?? X.md`)을 모두 세므로 VALUE_FILL_TRACK_HEIGHT baseline 은 grep 5 가 아니라 occurrence 8.
  - **게이트 위생 결정 (specPresetResolver red 를 Phase 4 로 이동)**: §3 원안은 Phase 0 에서 모든 red 를
    먼저 고정하려 했으나, `specPresetResolver.test.ts` 의 TextField top/side red 는 Panel 이 아직
    `TAG_SPEC_MAP` 직독 상태라 Phase 1~3 내내 **builder 테스트를 red 로 오염**시킨다(type-check/test 게이트
    위반). 따라서 Panel red 는 Phase 4(Panel consumer collapse) 직전에 작성한다. shared resolver red(이미
    green)와 grep gate(baseline)만 Phase 0 에 둔다.

### Phase 1 — schema and resolver ✅ Land 완료 (2026-06-19, kill-gate PASS)

- ✅ `ComponentRuleStructure` / `ComponentRuleComposition` / `ComponentRuleStates` /
  `ComponentRuleLayoutToken` 타입 추가 (`composition-document.types.ts:381~`, shared 내부 — specs
  `ComponentSpec[...]` 인덱스 접근 대신 shared 자체 타입으로 재선언, specs import 0).
- ✅ shared resolver 구현 (`resolveCatalogContainer.ts`): `resolveCatalogStructure` /
  `resolveCatalogContainerBase` (Δ2 merge precedence 내장) / `resolveCatalogContainerVariants` (Δ3
  plain-data) / `resolveCatalogSizeField` (Δ4) + `CATALOG_LAYOUT_STYLES` (Δ7 shared 단일 table).
  `StylePreset` resolver 는 Phase 4(Panel) 에서 추가 — Panel 전환과 함께 작성하는 게 소비처 정합.
- ✅ (Δ1) 새 resolver 파일 `@composition/specs` import 문 = 0 (실제 import, 주석 제외).
- ✅ (Δ3) `resolveCatalogContainerVariants` plain-data 시그니처 재작성 — 출력 shape `{ styles, nested }`
  는 기존 specs `ResolvedContainerVariants` 와 동일.
- ✅ `CATALOG_LAYOUT_STYLES` shared 정의 (kebab-case raw, COMPOSITION_LAYOUT_STYLES 와 시각 동형).
- ✅ resolver 는 raw style data(kebab-case) 반환, camelCase 변환은 consumer 책임 (미구현 — Phase 3/4 소비 시점).

**Phase 1 kill-gate (사용자 §1 지침 — "resolver 가 Δ2 precedence + specs-import-0 으로 깨끗하게 나와야
Phase 2 진입 자격")**:

| 조건                                                                            | 결과               |
| ------------------------------------------------------------------------------- | ------------------ |
| resolver Δ2 merge precedence (layout → composition.containerStyles → top-level) | ✅ 14 test PASS    |
| 새 resolver `@composition/specs` import 문 = 0                                  | ✅ grep gate PASS  |
| shared type-check 회귀 0                                                        | ✅ exit 0          |
| builder type-check 회귀 0 (baseline 71)                                         | ✅ exit 0, error 0 |
| specs type-check + 461 test (CSS snapshot byte-diff 0)                          | ✅ PASS            |
| generated CSS byte-diff 0 (structure 추가 = generator 미반영)                   | ✅ 불변 확인       |

→ **kill-gate PASS. Phase 2(STRUCTURE_META 85 entry 전수 이관 + byte-diff-0) 진입 자격 충족.**

**TextField structure 시범 이관 (kill-gate 데이터 source)**: Phase 2 전수 이관 전, resolver 를 falsifiable
검증하기 위해 `componentRulesTable.TextField` 에만 `structure: { layout: "flex-column", composition: {
gap, containerStyles: { width: "fit-content" } } }` 를 추가했다. generator 는 아직 STRUCTURE_META 만
읽으므로 generated CSS 미영향 — Phase 2 에서 나머지 84 entry 이관 + STRUCTURE_META 삭제 +
buildVirtualSpecs rule-table 순회 전환 시 본 필드가 정본이 된다.

### Phase 2 — STRUCTURE_META migration ✅ Land 완료 (2026-06-19, byte-diff-0 kill-gate PASS)

- ✅ `STRUCTURE_META_ENTRIES` 의 모든 entry(**85** 실측) 를 해당 `componentRulesTable` entry 의
  `structure` 로 이동. `Body`(STRUCTURE_META) → `body`(table lowercase key) 1건만 매핑, 나머지
  84 은 PascalCase key 동일.
- ✅ `buildVirtualSpecs()` 를 `Object.entries(getComponentRulesTable())` 순회 기반으로 변경.
  `const meta = rule.structure` 로 두어 기존 합성 로직(meta.archetype/element/states/composition/...)
  을 한 글자도 안 바꿈 → byte-diff 0 을 자명하게 보장. lowercase key 는 `body→Body` capitalize 복원
  (structure 보유 lowercase = body 하나뿐 실측).
- ✅ **generated CSS byte diff 0 (kill-gate)**. Phase 2 전 baseline 92 파일 스냅샷 ↔ Phase 2 후
  재생성 결과 **0 파일 변경**. generate:css exit 0, 88 파일 정상 생성.
- ✅ migration 완료 후 `STRUCTURE_META`(Map), `StructureMeta`(타입), `STRUCTURE_META_ENTRIES`(배열,
  ~4719 줄) 삭제. grep gate baseline STRUCTURE_META_ENTRIES 2→**0 강제**(재도입 가드).

**Phase 2 kill-gate 검증 결과**:

| 게이트                                            | 결과                         |
| ------------------------------------------------- | ---------------------------- |
| generated CSS byte-diff 0 (baseline 92 파일 ↔ 후) | ✅ 0 변경 (가장 강한 oracle) |
| generate:css 런타임                               | ✅ exit 0, 88 파일           |
| STRUCTURE_META_ENTRIES / StructureMeta 삭제 (T1)  | ✅ 코드 심볼 0               |
| shared type-check                                 | ✅ 0                         |
| builder type-check (structure 타입 전파)          | ✅ 0 신규                    |
| specs type-check (사전 60 baseline)               | ✅ 60→60 불변 (+0 신규)      |
| shared catalog test (resolver 14 + grep gate 9)   | ✅ 210 PASS                  |
| specs vitest (CSS snapshot 포함)                  | ✅ 461 PASS                  |

**P2 진입 중 발견·결정 (breakdown 미명시 → 본문 정정)**:

1. **structure 형태 = STRUCTURE_META 동형 (Phase 1 타입 교정)**: Phase 1 시범 TextField structure 는
   `layout` 을 top-level 에 두고 composition/states 를 누락한 **불완전 형태**였다. byte-diff-0 을 자명하게
   하려면 buildVirtualSpecs 입력이 byte 동형이어야 하므로, `ComponentRuleStructure` 를 STRUCTURE_META
   `StructureMeta`(`{ archetype, element, containerStyles, states?, composition?, cssEmitMode?,
indicatorMode? }`)와 1:1 동형으로 교정했다. `emitCss: true` 강제 제거(STRUCTURE_META 에 없음 — Map/
   structure 멤버십 자체가 emit 플래그), `layout` 을 top-level→`composition.layout` 으로 통일.
   `resolveCatalogContainerBase` / resolver test 도 `structure.composition?.layout` 읽기로 교정.
2. **containerStyles value 타입 = string | number (운반 타입)**: STRUCTURE_META.containerStyles 는
   specs `ContainerStylesSchema`(`borderWidth: number` / display enum / TokenRef)를 따른다. Phase 1 이
   `Record<string, string>` 로 좁힌 게 byte-diff 데이터(collection archetype 의 `borderWidth: 1`)와 충돌.
   specs import 0 을 유지하며 원본 데이터를 운반하려 `Record<string, string | number>` 로 넓힘 — 소비처
   (CSSGenerator)가 `ContainerStylesSchema` 로 캐스팅.
3. **Δ7 (COMPOSITION_LAYOUT_STYLES 삭제) → Phase 3 분리 (사용자 결정 2026-06-19)**: breakdown 원안은
   Δ7 을 Phase 2 에 포함했으나, "CSSGenerator(specs)가 shared `CATALOG_LAYOUT_STYLES` 소비" 는
   **specs→shared 역의존**(순환 유발 — `feedback-specs-shared-layer-not-absorption` 차단 메모리 직접
   적용)이다. layout token 단일화는 의존 방향 설계(token table 을 specs 로 이전 + shared import)가
   필요하므로 Skia/layout consumer collapse(Phase 3)와 함께 한다. Phase 2 는 COMPOSITION_LAYOUT_STYLES
   를 유지 → generated CSS 불변(byte-diff-0 oracle 순수 보존). grep gate COMPOSITION_LAYOUT_STYLES
   baseline=2 유지(killPhase 표기만 Phase 3 으로).
4. **Slot.css 사전 drift (P2 무관)**: main(`8834a9df8` ADR-140)에서 `Slot.css` 가 빈 파일로 커밋된
   사전 drift 발견 — Slot.spec.ts 는 정상이라 generate:css 시 정본 70줄 복원. STRUCTURE_META(85개)와
   무관(Slot 은 spec 파일 생성). P2 byte-diff oracle 은 "현 baseline(Slot 복원 포함) ↔ P2 후" 동일로
   측정 → Slot.css 영향 0. 정본 복원이라 P2 커밋에 포함.

### Phase 3 — Skia/layout consumer collapse

> ⚠️ 원안에서 under-scoped 였던 phase — Δ4/Δ5/Δ6 를 포함해야 dual-SSOT 가 실제로 닫힌다.

- `implicitStyles.ts` local catalog map(`LOWERCASE_COMPONENT_RULE_CONTAINER`) 제거.
- field류 base/side axis 를 shared resolver 결과로 교체.
- (Δ6) 인라인 base-axis fallback `flexDirection ?? "column"` **7곳 전수** 삭제 — field류 5
  (`:1279`/`:1340`/`:1487`/`:1551`/`:1879`) + collection-item 2 (`:841`/`:865`). base axis 는
  `resolveCatalogContainerBase` 에서만 온다. (codex 초안의 `:1486-1489` 는 부정확 — 실제 `:1487`,
  그리고 단일 위치가 아니라 7곳 분산.)
- (Δ4) 숫자 mirror 상수 `VALUE_FILL_TRACK_HEIGHT` / `INDICATOR_SIZES.gap` / `PROGRESSBAR_ROW_GAP` /
  `PROGRESSBAR_COL_GAP` / `SLIDER_ROW_GAP` 삭제 → 소비처를 `resolveCatalogSizeField` 로 교체.
- (Δ5) `INDICATOR_SIZES.box` 는 Checkbox/Radio `sizes` 로 승격(권장) 또는 Non-goal 명시.
- (Δ3) shared `resolveCatalogContainerVariants` land 후 `:578-600` 임시 adapter 삭제.
- (Δ7 — Phase 2 에서 이연, 사용자 결정 2026-06-19) `CSSGenerator.ts` 의 `COMPOSITION_LAYOUT_STYLES`
  (`:656-675`) 삭제 → 단일 layout token table 로 수렴. **의존 방향 제약**: token table 을 shared 에
  두면 specs(CSSGenerator)→shared 역의존(순환)이라 불가. layout token table 을 **specs 로 이전**하고
  shared `resolveCatalogContainer` 가 specs 에서 import(shared→specs 정상 방향) → CSSGenerator(specs
  내부)와 resolver(shared) 가 같은 source 소비. Phase 1 이 shared 에 둔 `CATALOG_LAYOUT_STYLES` 를
  specs 로 이동 + shared re-export. grep gate COMPOSITION_LAYOUT_STYLES baseline 2→0.
- `resolveContainerStylesFallback` wrapper 가 shared resolver 를 사용하도록 변경.
- field branch 는 child filtering/injection 만 남긴다.

### Phase 4 — Style Panel consumer collapse

- `specPresetResolver.ts` 를 shared resolver 기반으로 전환.
- `TAG_SPEC_MAP` import 제거.
- 기존 hard fallback(`block` / `row` / `0px`)은 catalog preset 이 없을 때만 사용한다.
- TextField/TagGroup regression test 를 Phase 0 red tests 로 green 시킨다.

### Phase 5 — gates and documentation

- `pnpm run build:specs` 또는 현재 harness 의 CSS generation gate 실행.
- `pnpm run codex:typecheck`.
- Style Panel focused tests.
- Skia/layout focused tests.
- `/cross-check` 또는 equivalent browser verification: TextField top/side + TagGroup side
  - ProgressBar track / Checkbox indicator 렌더 불변 (T6).
- T1~T6 (§6-1) 동시 PASS 확인.
- Phase 5 완료 커밋에서 ADR-912 본문에 "catalog SSOT collapse — visual/structure/size 축 종결"
  근거를 추가하고, **재승격 note 는 §4-1 대로 축 한정 명시** (propagation·factory·child-filtering 축은
  별도 잔여로 기록, 무조건적 "1 컴포넌트 = 1 등록" 주장 금지 — Δ9). 본 breakdown 은 현재 untracked +
  ADR 본문 미링크 상태이므로 commit + ADR-912 본문에 design 링크 추가도 이 커밋에 포함.

## 4. Non-goals

- ADR-913 의 reference value rebuild 를 하지 않는다. 색상, radius, size scale 품질 재조정은
  이 문서 scope 밖이다.
- reusable document schema, factory creator collapse, rendererMap self-compose 잔여는
  이 문서 scope 밖이다.
- `Group`, `frame`, `Slot`, color scope 제외분을 다시 판단하지 않는다.
- CSSGenerator 의 `ComponentSpec` 입력 형태를 전면 재설계하지 않는다. 이번 목표는
  structure source collapse 이며, generator API rewrite 는 별도 작업이다.

### 4-1. 정직한 scope 선언 — 이 collapse 가 닫는 축 vs 잔여 축 (Δ9)

본 collapse 는 **시각/구조/size SOURCE 축**만 닫는다 — CSS generator / Skia base-layout / Style Panel
preset 세 consumer 가 색상·구조·size 를 `ComponentRule` 한 entry 에서 파생. ADR-912 ② "1 컴포넌트 =
1 등록" 은 이 축에 한해 달성된다.

다음 축은 **여전히 손 등록 surface 로 잔존** — 본 문서 scope 밖이며, 종결 시 "②목표 완전 달성" 으로
주장하면 안 된다 (closure 검증이 refute 한 지점):

- **propagation registry** (`apps/builder/.../propagationRegistry.ts:703-746`, ~30 손작성
  `registerPropagationSpec` + `createPropagationOnlySpec`) — 자식 보유 컴포넌트는 parent→child
  prop rule 을 여기 손등록.
- **factory creator** (`ComponentFactory.ts` 108 `create*` 메서드 — §4 Non-goal) — 자식 element-tree
  생성은 catalog entry 에서 파생 불가, 손작성 definition 필요.
- **implicitStyles child-filtering branch 멤버십** (textfield/datefield/progressbar/slider literal
  dispatch + `SYNTHETIC_LABEL_TAGS` / `NECESSITY_INDICATOR_TAGS` / `POPOVER_CHILDREN_TAGS` tag Set) —
  child filtering/injection 멤버십은 catalog structure 로 파생 안 함, 의도적으로 branch 잔존(§2-4).

→ 종결 시 ADR-912 본문 재승격 note 는 반드시 "visual/structure/size 축 한정" 으로 명시하고,
child-tree·propagation 축은 별도 잔여 작업으로 기록한다. 무조건적 "1 컴포넌트 = 1 등록" 주장 금지.

## 5. Kill criteria

다음 중 하나라도 남으면 collapse 실패다.

- `specPresetResolver.ts` 가 `TAG_SPEC_MAP` 을 import 한다.
- `generate-css.ts` 에 `STRUCTURE_META_ENTRIES` 또는 동형의 generator-local component
  structure table 이 남는다.
- `implicitStyles.ts` 가 `getComponentRulesTable()` 으로 local lowercase structure map 을 만든다.
- TextField base column 이 Style Panel 에서 global fallback 으로 표시된다.
- CSS generator 와 Skia/layout 이 서로 다른 layout token table 을 가진다 (`COMPOSITION_LAYOUT_STYLES`
  와 `CATALOG_LAYOUT_STYLES` 가 둘 다 존재 — Δ7).
- (Δ8) layout/Skia 파일이 `componentRulesTable.sizes` 를 복제하는 local size-value table
  (track height, indicator box/gap, row/column gap) 을 선언한다.
- (Δ6) `implicitStyles.ts` 의 7개 base-axis fallback (field류 5 + collection-item 2) 중 **하나라도**
  인라인 `?? "column"` 으로 남는다 (`grep -c 'flexDirection.*?? "column"'` ≠ 0).
- generated CSS 는 바뀌었는데 Skia/layout 또는 Style Panel focused test 가 없다.

## 6. Done definition

완료는 "Style Panel 표시가 좋아짐"이 아니라 아래 전부다.

| Gate        | 통과 조건                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source      | field base layout, TagGroup base layout, side variants, **그리고 track height / indicator gap·box / field·slider row-col gap (Δ8)** 가 모두 `componentRulesTable` entry 에서 선언, local 숫자 mirror 0 |
| Generator   | virtual CSS emit membership 이 `rule.structure` 로 결정되고 `STRUCTURE_META` 없음, `COMPOSITION_LAYOUT_STYLES` 없음 (Δ7)                                                                               |
| Skia/layout | container base/variant 는 shared resolver 소비, local rule map 없음, 인라인 base-axis fallback 없음 (Δ6)                                                                                               |
| Style Panel | `TAG_SPEC_MAP` 직독 없음, TextField/TagGroup preset 이 shared resolver 기반                                                                                                                            |
| Tests       | shared resolver + Style Panel + Skia/layout focused tests PASS                                                                                                                                         |
| Build       | generated CSS **byte-diff = 0 (enforce, Δ8)** + type-check PASS                                                                                                                                        |
| Browser     | TextField top/side 및 TagGroup side 의 Panel 표시와 Canvas layout 수동 확인 + ProgressBar track / Checkbox indicator 렌더 불변                                                                         |

### 6-1. 종결 조건 — falsifiable test (T1~T6)

②목표 visual/structure/size 축이 닫히고 ADR-912 재승격 가능한 조건 (각각 독립 검증):

- **T1 (grep 0)**: `STRUCTURE_META_ENTRIES`/`StructureMeta` (specs) = 0 / `COMPOSITION_LAYOUT_STYLES`
  (CSSGenerator) = 0 / `LOWERCASE_COMPONENT_RULE_CONTAINER`·`VALUE_FILL_TRACK_HEIGHT`·`INDICATOR_SIZES`·
  `PROGRESSBAR_ROW_GAP`·`PROGRESSBAR_COL_GAP`·`SLIDER_ROW_GAP` (implicitStyles) = 0 / `TAG_SPEC_MAP`
  (specPresetResolver) = 0 / `flexDirection: ... ?? "column"` (implicitStyles) = 0 / 새 resolver 의
  `@composition/specs` import = 0.
- **T2 (단일 consumer 경로)**: CSS gen `buildVirtualSpecs` / Skia `implicitStyles` / Panel
  `specPresetResolver` 가 structure·base-layout·size-value·preset 을 `shared/catalog/resolvers/` 에서만 import.
- **T3 (byte-diff 0)**: 전체 collapse 후 generated CSS `git diff` = empty.
- **T4 (field-preset green)**: `specPresetResolver.test.ts` 51/51 PASS (was 27 red).
- **T5 (size-value 단일 source)**: rule entry 에서 ProgressBarTrack height / Checkbox gap 을 지우면
  Skia 렌더와 Panel preset 둘 다 바뀜 (평행 상수가 흡수하지 않음).
- **T6 (live behavior, CLAUDE.md gate)**: builder 에서 TextField top/side + TagGroup side +
  ProgressBar/Checkbox 렌더 수동 확인.

T1~T6 동시 PASS = visual/structure/size 축 종결. 재승격 note 는 §4-1 대로 "이 축 한정" 명시 필수.

## 7. Implementation notes

- `componentRulesTable.ts` 는 파일명이 generated 이지만 ADR-912 이후 손편집 정본으로 쓰이고
  있다. 이번 작업은 그 정본성을 더 명확히 하는 것이며, generator-local structure table 을
  정본으로 인정하지 않는다.
- `ComponentRule.structure` 를 추가할 때 `containerStyles` / `containerVariants` 를
  중복 이동하지 않는다. runtime base style 은 `structure.layout` 과 기존 top-level
  `containerStyles` 를 resolver 가 합성한다.
- (Δ1) dependency direction 정정: 현재 실측 방향은 `shared → specs` (shared 가 specs 를 13 파일 import,
  package.json 의존 선언 / 역방향 0). `ComponentRule` 타입이 shared 에 specs import 0 으로 정의돼 있으므로
  **새 shared resolver 는 `@composition/specs` 를 추가 import 하지 않고도 작성 가능** — 신규 import 추가가
  금지 대상이다. (이전 문구 "`packages/shared` 가 `@composition/specs` 를 import 하면 새 역의존" 은 표기상
  방향 오해를 부른다 — `shared → specs` 는 이미 성립한 정상 방향이고, 금지는 `specs → shared` 방향. 단 본
  resolver 작업은 그 정상 방향조차 새로 늘리지 않는다.) `resolveContainerVariants` 는 이동이 아니라 plain-data
  재작성(Δ3) — 기존 spec 결합 버전은 generator 경로 전용으로 specs 잔존.
- side-label 자식 보정은 구조 source 가 아니다. field branch 에 남을 수 있지만,
  branch 가 axis 를 결정하면 안 된다.

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

| Source                                                                     | 현재 역할                                                                                                                                                                                                                                                                                                                        | 문제                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`             | variants, sizes, 일부 `containerStyles`, `containerVariants`, **field류 `structure.composition.layout='flex-column'` (Phase 2/3 이관 완료)**                                                                                                                                                                                     | ~~field root layout 없음~~ **정정(§1-1)**: field류 8 type 은 이미 `structure.composition` 보유. GridListItem 만 source 진짜 부재. 문제는 "부재" 가 아니라 active wrapper 가 `structure.composition` 을 미독(3-A-3a)                    |
| `packages/specs/scripts/generate-css.ts` `STRUCTURE_META_ENTRIES`          | virtual CSS emit membership, `archetype`, `element`, `composition.layout`, states, `cssEmitMode`, `indicatorMode`                                                                                                                                                                                                                | shared catalog 밖의 두 번째 구조 SSOT                                                                                                                                                                                                  |
| `packages/specs/src/renderers/CSSGenerator.ts` `COMPOSITION_LAYOUT_STYLES` | `flex-column` 등 layout token 을 CSS base style 로 변환                                                                                                                                                                                                                                                                          | generator 전용 변환이라 Panel/Skia 가 같은 source 를 직접 못 읽음                                                                                                                                                                      |
| `apps/builder/.../implicitStyles.ts` `LOWERCASE_COMPONENT_RULE_CONTAINER`  | Skia/layout 의 catalog fallback                                                                                                                                                                                                                                                                                                  | builder-local map 이라 Style Panel 과 중복될 수밖에 없음                                                                                                                                                                               |
| `apps/builder/.../implicitStyles.ts` field branches                        | TextField/TextArea/DateField/TimeField 등 기본 column + side row 보정                                                                                                                                                                                                                                                            | catalog rule 이 아닌 컴포넌트별 hard branch                                                                                                                                                                                            |
| `apps/builder/.../implicitStyles.ts` 인라인 base-axis fallback (7곳)       | field류 5 (`:1276` searchfield·combobox·select 공통 / `:1336` numberfield / `:1483` textfield·textarea / `:1547` datefield·timefield / `:1890` datepicker) + collection-item 2 (`:837` gridlistitem / `:861` listboxitem) 의 `display:flex / flexDirection ?? "column" / gap ?? N` 하드코딩 (line 은 2026-06-19 Δ10 후 재실측값) | §1-1 이 근본 원인이라 지목한 base-axis drift 가 **한 branch 가 아니라 field·collection-item branch 전반에 동형 복제**되어 살아 있음 (`:837`/`:861` 주석이 스스로 "spec body 삭제 대비 분기 자족화" 인정 — Δ4 mirror 와 동형 dual-SSOT) |
| `apps/builder/.../implicitStyles.ts` 숫자 mirror 상수 (`:301-343`)         | `VALUE_FILL_TRACK_HEIGHT` / `INDICATOR_SIZES` / `PROGRESSBAR_ROW_GAP` / `PROGRESSBAR_COL_GAP` / `SLIDER_ROW_GAP`                                                                                                                                                                                                                 | ProgressBarTrack/MeterTrack height + Checkbox/Radio gap 의 catalog.sizes 평행 복사본 (주석이 스스로 "rule 이 SSOT" 인정)                                                                                                               |
| `apps/builder/.../specPresetResolver.ts`                                   | Style Panel preset resolver                                                                                                                                                                                                                                                                                                      | `TAG_SPEC_MAP` 직독. spec 삭제 type 은 빈 preset 이 되어 hard fallback 표시                                                                                                                                                            |
| `packages/specs/.../CSSGenerator.ts` `COMPOSITION_LAYOUT_STYLES`           | layout token(`flex-column` 등) → CSS base style 변환                                                                                                                                                                                                                                                                             | generator-private 라 Skia/Panel 이 같은 layout token table 을 못 읽음                                                                                                                                                                  |

### 1-1. field류 base layout 의 실제 출처

> **정정 (2026-06-19, Phase 3-A-3 정밀 매핑) — adr-writing.md M3 in-place 흡수, 새 ADR fork 사유 아님.**
> 본 절의 원 서술 _"field류 base layout 은 `componentRulesTable` 에 없다 / source 는 `STRUCTURE_META`"_ 는
> **stale 됐다.** Phase 2/3 structure 이관으로 field류 8 type 전부 catalog 에 base layout 이 land 됐다
> (ground-truth grep, 2026-06-19): ComboBox(`componentRulesTable.ts` structure)·DateField·DatePicker·
> NumberField·SearchField·Select·TextField·TimeField 가 `structure.composition.layout = "flex-column"` +
> `gap = "var(--spacing-xs)"` 를 보유. 즉 catalog 가 이제 base axis 의 정본 source 다.
>
> **단, drift 결론(아래)은 유효** — 원인 서술만 정정한다. catalog 에 값이 land 됐어도 현 active wrapper
> `resolveContainerStylesFallback`(`implicitStyles.ts:216-244`)는 `LOWERCASE_COMPONENT_RULE_CONTAINER`
> (top-level `rule.containerStyles` 만) 를 읽고 **`structure.composition` 을 읽지 않으며**,
> `structure.composition` 을 읽는 정본 resolver `resolveCatalogContainerBase` 는 implicitStyles/builder
> 전역에서 **호출 0건**(grep 실측). 게다가 wrapper 는 `if (!cs) return specOut`(`:231`) early-return 이
> 있어 top-level `containerStyles` 없는 type 은 catalog 보강 자체를 skip 한다. 따라서 catalog 값이 존재해도
> **Skia 까지 미도달** → field branch 의 인라인 하드코딩(`?? "flex" / ?? "column" / ?? 4`)이 실제 active 값.
>
> → 3-A-3a 의 작업 정의는 _"catalog 에 값 추가"_ 가 아니라 **"wrapper 를 `resolveCatalogContainerBase` 로
> 재배선 (early-return 수정 + kebab→camel 변환 + `gap='var(--spacing-xs)'` → 숫자 4 정규화)"** 이다.

field류 `display:flex` / `flex-direction:column` 의 정본 source 는 catalog
`componentRulesTable` 의 `structure.composition.layout = "flex-column"` (Phase 2/3 이관 완료) 이며,
CSS emit 은 `CSSGenerator.ts` `COMPOSITION_LAYOUT_STYLES["flex-column"]` (Δ7 후 specs
`LAYOUT_TOKEN_STYLES`) 이 만든다.

Skia 는 이 catalog 값을 shared resolver 로 읽지 않고(`resolveCatalogContainerBase` 호출 0건),
field 전용 branch 에서 `display:flex` / `flexDirection:column` 을 인라인 하드코딩으로 다시 주입한다.
이 미도달 구조(catalog 에 값은 있으나 active wrapper 가 `structure.composition` 을 미독)가 이번
이슈의 핵심 drift 원인이다.

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
`:1486-1489` 단일 위치는 **부정확** — 동형 base-axis 하드코딩이 **7곳에 복제**되어 있다. 한 곳만
삭제하면 나머지가 dual-SSOT 로 잔존해 §5 kill criteria 가 닫히지 않는다. 전수 삭제 대상 (line 은
2026-06-19 Δ10 후 재실측 + 정밀 매핑 §Phase 3-A-3 분류표 참조):

- **field류 5**: `:1276` searchfield·combobox·select 공통 / `:1336` numberfield / `:1483` textfield·textarea /
  `:1547` datefield·timefield / `:1890` datepicker — 각 branch 의
  `display: specFallback.display ?? "flex", flexDirection: specFallback.flexDirection ?? "column", gap: specFallback.gap ?? 4`
- **collection-item 2**: `:837` gridlistitem / `:861` listboxitem — `flexDirection: (parentStyle.flexDirection as string) ?? "column"`
  (주석이 스스로 "ADR-912 cutover … spec body 삭제 대비 분기 자족화" 인정 = Δ4 mirror 와 동형 dual-SSOT)

> **정밀 매핑 정정 (2026-06-19)**: field류 5 와 collection-item 2 는 **catalog source 보유 여부가 다르다**
> (§1-1 정정 + §Phase 3-A-3 분류표). field 5 는 `structure.composition` 보유(재배선만 필요), collection 2 는
> GridListItem `structure` 부재 / ListBoxItem `composition` 부재 → **별도 처리 필요(3-A-3b)**. 또한
> `resolveCatalogContainerBase` 가 implicitStyles 호출 0건이고 wrapper 가 `structure.composition` 미독 +
> early-return(`:231`) trap 이 있어, 단순 인라인 삭제만으로는 base axis 가 catalog 에서 흐르지 않는다 —
> **wrapper 재배선(3-A-3a)이 인라인 삭제의 prerequisite**.

base axis 는 오직 `resolveCatalogContainerBase` 에서만 온다. 이 인라인 fallback 군이 §1-1 이
지목한 drift 의 root cause 자체이므로, 한 곳이라도 남겨두면 collapse 후에도 동일 분산이 재현된다.
(주의: `gap ?? N` 의 N 은 branch 별로 다름 — gridlistitem `?? 2` / listboxitem `?? 2` / field류 `?? 4`.
삭제 시 catalog `sizes.gap` 또는 `structure.composition.gap` 으로 치환하되 기존 N 값과 byte-diff 0 확인.)

**Δ4 — catalog.sizes 평행 복사본 mirror 제거 (3종 한정)**: `implicitStyles.ts` 의 mirror 상수 중
**catalog `.sizes` 에 size-indexed 숫자 필드로 단일 source 가 존재하는 3종** 만 삭제하고 소비처를
read-through 로 교체한다. (적대 검증 결과 — w6gqcrgh3, 2026-06-19 — mirror 6종이 전부 `.sizes`
평행 복사본이라는 §1 ledger 의 일괄 분류는 부정확. box·column-gap 2종은 `.sizes` 에 source 가
없어 Δ4 로 못 닫음 → Δ5/Δ10 분리. 이 정정은 Phase 0 inventory freeze 부실 보강이며 새 ADR fork
사유 아님 — adr-writing.md M3.):

- `VALUE_FILL_TRACK_HEIGHT` (`:316`, `{sm:4,md:8,lg:12,xl:16}`) → `{ProgressBarTrack,MeterTrack,
SliderTrack}.sizes.height` 와 byte 일치 (세 track 모두 동일값, 실측 `componentRulesTable.ts:7420/
6260/9414`). 소비처 `:1615/1731/1817`.
- `PROGRESSBAR_ROW_GAP` (`:308`, `4`) → `{ProgressBar,Meter}.sizes.gap=4` 와 일치. 소비처 `:1657` (rowGap).
- `SLIDER_ROW_GAP` (`:343`, `4`) → `Slider.sizes.gap=4` (모든 size) 와 일치. 소비처 `:1786` (rowGap).

교체는 builder-local `specSizeField(type, size, field)` 경유 — `specSizeField` 는 `LOWERCASE_TAG_SPEC_MAP`
(spec) 우선, 부재 시 `LOWERCASE_COMPONENT_RULE_SIZES`(`getComponentRulesTable()` 전수 lowercase 인덱싱)
rule fallback 으로 이미 catalog 를 읽는 통합 진입점 (`:156-185`). 이 3 track/component 의 spec 은 cutover
로 삭제되어 rule fallback 경로로만 동작 → 새 shared `resolveCatalogSizeField`(doc 인자 필요) 도입보다
surface 작음. 이 상수들의 주석 자체가 "rule(componentRulesTable) 이 SSOT" 라고 인정하던 dual-SSOT 사례.

**Δ5 — `INDICATOR_SIZES` 처리 (box 소유권 + 객체 분리)**: `INDICATOR_SIZES` (`:301`) 는 `{box, gap}` 을
**한 객체**로 묶는다. 실측 결과:

- `gap = {sm:6,md:8,lg:10}` 은 `{Checkbox,Radio}.sizes.gap` 과 byte 일치 (catalog source 존재).
- `box = {sm:16,md:20,lg:24}` 은 catalog 에 **source 자체가 없다** — `ComponentRuleSize` 인터페이스에
  `box` 키가 없고 (`composition-document.types.ts:215~`), Checkbox/Radio 주석이 "indicator(boxSize/
  boxRadius)는 generated CSS 미emit(수동/React) → rule 불요" 라고 **의도적으로 제외**했다. 즉 box 는
  catalog 가 소유한 적 없는 hidden source — "평행 복사본" 아님.
- 두 소비처 (`:1952`, `:1993`) 는 `phantomConfig?.widths[s] ?? INDICATOR_SIZES.box ?? 20` /
  `phantomConfig?.gaps[s] ?? INDICATOR_SIZES.gap ?? 8`. checkbox/radio/switch 는 `PHANTOM_INDICATOR_CONFIGS`
  (`utils.ts:127~`) 에 box/gap 모두 보유 → 실질 우선값은 phantomConfig. INDICATOR_SIZES 는 **tertiary
  fallback** (phantomConfig 부재 또는 size 가 sm/md/lg 외일 때만 도달, 적대 검증 deadPath="live" but
  PARTIALLY — 정상 경로에선 거의 미도달).

box 는 catalog `.sizes` source 가 없으므로 `specSizeField` 로 못 읽는다. 결정 옵션:

- (a) `ComponentRuleSize` 에 `box?: number` 키 추가 + Checkbox/Radio/Switch `.sizes.box` 승격 → INDICATOR_SIZES
  전체 삭제 가능. 단 catalog rule 데이터 변경이라 generated CSS byte-diff 검증 필요 (box 는 CSS 미emit 이라
  안전 추정, 확인 필수). **권장 — single source 달성**.
- (b) §4 Non-goals 에 "Skia/layout-render 전용 indicator box 상수" 로 명시 + INDICATOR_SIZES.gap 만
  specSizeField 경유로 바꾸되 box 때문에 상수 객체는 잔존. → kill criteria 0 미달, 잔존 명시.

(a)/(b) 중 하나로 결정하지 않으면 box 가 소유처 없는 hidden source 로 남는다. PHANTOM_INDICATOR_CONFIGS
가 이미 box(widths) 단일 source 역할을 하는지(INDICATOR_SIZES.box dead 여부)도 (a) 판정 시 함께 평가.

**Δ10 — `PROGRESSBAR_COL_GAP` 토큰→sizes 마이그레이션 (Δ4 와 별개 성격)**: `PROGRESSBAR_COL_GAP`
(`:309`, `12`) 은 §1 ledger 가 Δ4 mirror 로 묶었으나, 실측 결과 catalog `.sizes` 에 source 가 **없다**
(적대 검증 w6gqcrgh3 — 양쪽 confirmed). 유일한 catalog source 는 `{ProgressBar,Meter}.structure.
composition.containerStyles['column-gap'] = 'var(--spacing-md)'` (`componentRulesTable.ts:7223/6066`)
— **kebab-case CSS 토큰 문자열**이라:

- `specSizeField`/`resolveCatalogSizeField` 로 못 읽는다 (`.sizes` 의 숫자 필드만 수용).
- builder `resolveContainerStylesFallback` 의 `CONTAINER_STYLES_FALLBACK_KEYS` (`:251~`) 는 camelCase
  키 집합 (`rowGap`/`columnGap` 미포함) → catalog containerStyles 의 `column-gap` 을 `parentStyle.columnGap`
  으로 채우지 못함. 그래서 소비처 `:1658` (`columnGap: parentStyle.columnGap ?? PROGRESSBAR_COL_GAP`) 은
  사용자 인라인 편집이 없으면 항상 상수 fallback 도달.
- `resolveToken` 은 `{spacing.md}` 토큰 참조 형식만 파싱 — `var(--spacing-md)` CSS 변수 형식 파싱 불가.

→ Δ4 의 "상수 삭제 후 `.sizes` read-through" 패턴으로 못 닫는다. 별도 마이그레이션 필요:

- (A) `{ProgressBar,Meter}.sizes.{sm,md,lg,xl}.columnGap = 12` 추가 (ComponentRuleSize 에 `columnGap` 키
  이미 존재 — Slider 가 동형 사용) + 소비처를 `specSizeField("progressbar", size, "columnGap")` 로 교체 →
  `PROGRESSBAR_COL_GAP` 삭제 가능. **단 catalog rule 데이터 변경이라 generated CSS byte-diff 검증 필수**
  (ProgressBar 의 column-gap 은 `structure.composition.containerStyles` 에서 CSS emit 되므로, `.sizes.columnGap`
  추가가 generated CSS 에 영향 주는지 확인 — 영향 0 이어야 함, 둘은 별도 경로).
- (B) §4 Non-goals 에 "structure-level CSS 토큰 (size 비종속)" 로 명시 + 상수 잔존. → kill criteria 0 미달.

**Δ10 종결 — 제3 경로 (`.sizes.gap` read-through 통일, Land 완료 2026-06-19, commit `3f4224999`)**: 실행 중
live 실측이 위 (A)/(B) 전제를 정정했다 (Δ5 옵션 c 와 동형). 핵심 발견 — Δ10 은 "조용한 dual-SSOT collapse
(byte-diff 0)" 가 아니라 **CSS↔Skia 렌더 파리티 버그**였다:

- catalog 의 `column-gap: var(--spacing-md)`(12px) 는 generated CSS 에서 **같은 selector 안 나중 선언된
  `gap: 4px` shorthand 에 덮여 effective 4px**(longhand → shorthand cascade override, builder + preview iframe
  computed 양쪽 4px 실측). 모든 data-size selector 도 `gap:4px` 만 보유 → CSS 실효 column-gap = 4px 로 수렴.
- 반면 Skia layout 은 `PROGRESSBAR_COL_GAP=12` → Builder Canvas 만 12px → Preview(4px) ≠ Builder(12px) 렌더 차이.
- 즉 catalog 의 effective 값(4px)과 layout 상수(12px)가 **달랐고** 그 차이가 곧 렌더 버그. "같은 12 두 곳" 전제 오류.
- (Slider 는 ADR-088 에서 `.sizes.columnGap` 으로 이관돼 `gap` shorthand **뒤**에 emit → column-gap 살아남음.
  ProgressBar/Meter 만 미이관 상태로 buried.)

→ 옵션 (A) 는 잘못된 방향이었다: `.sizes.columnGap=12` 추가 시 CSS effective 가 4→12 로 바뀌어 \*\*byte-diff 발생

- 사용자-가시 간격 변화**(= 12px 를 새 정본으로 강제). 사용자 confirm — **CSS effective(4px) 가 사용자-가시 정본**.
  채택 경로: column-gap 도 row-gap 과 동일하게 `.sizes.gap`(=4) read-through (`specSizeField(containerTag, sizeName,
"gap") ?? 4`) 로 통일, `PROGRESSBAR_COL_GAP` 상수 삭제. catalog 의 dead `column-gap: var(--spacing-md)` 선언은
  보존(건드리면 byte-diff). 결과: **generated CSS byte-diff 0\*\* + Skia layout column-gap 12→4 (CSS 정합 복원) +
  하드코딩 상수 0. 검증: byte-diff 0 · type-check baseline 71 불변 · shared 211 PASS · grep gate PROGRESSBAR_COL_GAP
  3→0 (10 PASS) · live ProgressBar(size=md) `applyImplicitStyles` 호출 결과 columnGap=4 확증.

**§1-1 / §1 ledger 정정**: §1 ledger 의 "숫자 mirror 상수 (`:301-343`) ... ProgressBarTrack/MeterTrack
height + Checkbox/Radio gap 의 catalog.sizes 평행 복사본" 서술은 box·column-gap 2종을 과대 포함했다.
실제로는 (i) `.sizes` 평행 복사본 = VALUE_FILL_TRACK_HEIGHT + PROGRESSBAR_ROW_GAP + SLIDER_ROW_GAP +
INDICATOR_SIZES.gap, (ii) catalog source 부재 = INDICATOR_SIZES.box, (iii) structure-level 토큰 =
PROGRESSBAR_COL_GAP 으로 3분류된다.

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
>
> **2 그룹 분리 진행 (사용자 결정 2026-06-19)**: implicitStyles 가 최근 30일 ADR-912 fix 18건의 중심
> 파일(HIGH 위험)이라 한 번에 묶지 않고 의존 방향 재배치(B=Δ7)를 먼저 깨끗이 닫고, Skia/layout
> mirror collapse(A=Δ4/Δ5/Δ6+LOWERCASE)는 깨끗한 기반에서 별도 진행한다.

#### Phase 3-B — Δ7 layout token table 단일화 ✅ Land 완료 (2026-06-19, byte-diff-0 PASS)

- ✅ layout token table 을 **specs 단일 source** `packages/specs/src/renderers/layoutTokens.ts`
  (`LAYOUT_TOKEN_STYLES` 객체 + `layoutTokenToCssLines()` 변환 어댑터) 로 이전.
- ✅ `CSSGenerator.ts` 의 generator-private `COMPOSITION_LAYOUT_STYLES` (`:656-675`) 정의 삭제 →
  `layoutTokenToCssLines(token)` 호출로 교체. 어댑터가 과거 배열과 **byte 동일**(4-space indent + `;`)
  라인 생성 → byte-diff 0 자명 보장.
- ✅ shared `resolveCatalogContainer.ts` 의 shared-local `CATALOG_LAYOUT_STYLES` 정의 삭제 →
  `import { LAYOUT_TOKEN_STYLES } from "@composition/specs"` 후 `CATALOG_LAYOUT_STYLES =
LAYOUT_TOKEN_STYLES` alias re-export(기존 소비처 호환). **의존 방향**: `shared → specs` 정상
  방향(shared package.json 이 specs 를 workspace 의존 선언, specs→shared 역의존 0 — `specs` deps =
  colord 만). layout token 은 CSS vocabulary(D3)라 framework-free 하위 레이어 specs 에 사는 게 정합
  (`feedback-specs-shared-layer-not-absorption` 메모리 정합 — 금지는 specs→shared 방향뿐).
- ✅ grep gate `COMPOSITION_LAYOUT_STYLES` baseline 2→**0**(killPhase "Phase 3 Δ7 ✅"). 주석에서도
  심볼명 직접 사용 안 함(false positive 회피). Δ1 가드를 "방향" 기준으로 갱신 — resolver 의 specs
  import 1건(LAYOUT_TOKEN_STYLES) 한정 + specs→shared 0 검증 2 테스트로 분리.
- ✅ **byte-diff-0 oracle PASS** (92 파일 ↔ 후 0 변경, generate:css + build:specs 양쪽). builder/shared
  type-check 0, specs 60 baseline 불변, shared catalog 211 PASS, specs vitest 461 PASS, 런타임 sanity
  (`layoutTokenToCssLines('flex-column')` = 과거 배열 byte 동일) PASS.

| Δ7 게이트                                              | 결과                            |
| ------------------------------------------------------ | ------------------------------- |
| generated CSS byte-diff 0 (92 파일, generate+build)    | ✅ 0 변경 (가장 강한 oracle)    |
| COMPOSITION_LAYOUT_STYLES 정의 삭제 (kill criteria)    | ✅ 0 (specs single source 수렴) |
| 의존 방향 shared→specs 정상 / specs→shared 0           | ✅ grep gate 2 test PASS        |
| shared / builder type-check                            | ✅ 0 / 0                        |
| specs type-check (baseline 60)                         | ✅ 60→60 불변                   |
| shared catalog (resolver 14 + grep gate 10)            | ✅ 211 PASS                     |
| specs vitest (CSS snapshot byte-diff)                  | ✅ 461 PASS                     |
| 런타임 sanity (specs barrel export + 어댑터 byte 동일) | ✅ PASS                         |

#### Phase 3-A — Skia/layout mirror collapse

> HIGH 위험 (implicitStyles = 최근 30일 ADR-912 18 fix 중심). byte-diff oracle 불가 영역(Skia=layout
> 출력, CSS 와 다름)이라 Skia 렌더 live behavior 게이트 필수.
>
> **적대 검증 후 sub-group 분리 (사용자 결정 2026-06-19, w6gqcrgh3)**: §1 ledger 가 mirror 6종을 일괄
> "catalog.sizes 평행 복사본" 으로 분류했으나 실측 결과 box·column-gap 2종은 catalog source 부재 →
> Δ4 를 3종으로 좁히고 Δ5(box)/Δ10(column-gap) 분리. 아래 sub-group 은 위험·oracle 성격이 달라 한
> 묶음에서 떼어 진행한다.

**Phase 3-A-1 — Δ4 catalog.sizes mirror 3종 (가장 낮은 위험, oracle=T5)**:

- `VALUE_FILL_TRACK_HEIGHT` (`:316`) → `specSizeField(track, size, "height")` (ProgressBarTrack/MeterTrack/
  SliderTrack 모두 `.sizes.height` byte 일치). 소비처 `:1615/1731/1817`.
- `PROGRESSBAR_ROW_GAP` (`:308`) → `specSizeField("progressbar", size, "gap")` (`.sizes.gap=4`). 소비처 `:1657`.
- `SLIDER_ROW_GAP` (`:343`) → `specSizeField("slider", size, "gap")` (`.sizes.gap=4`). 소비처 `:1786`.
- oracle: 상수값 ↔ catalog `.sizes` byte 일치 + T5 (rule 값 지우면 Skia 렌더 변함) + ProgressBar/Slider
  렌더 live 불변. 상수 3개 완전 삭제. (INDICATOR_SIZES.gap 은 box 와 같은 객체라 이 sub-group 에서
  `specSizeField` 경유로 바꾸되 객체 자체는 Δ5 에서 처리 — gap 만 분리 삭제 불가.)

**Phase 3-A-2 — Δ5 INDICATOR_SIZES dead 제거 ✅ Land 완료 (2026-06-19, dead-path 증명 PASS)**:

- ✅ (Δ5) `INDICATOR_SIZES` (box/gap) 상수 + 4개 소비처(`:1953/:1955/:1994/:1995`)의 dead fallback
  피연산자 삭제. **breakdown 원안 (a)schema 추가+promote / (b)Non-goal 두 옵션 밖 제3 경로 (옵션 c —
  dead 제거)** 로 종결. PHANTOM_INDICATOR_CONFIGS 가 이미 box 단일 source 인지 판정 결과 = **box·gap
  모두 dead-path** (사용자 결정 2026-06-19):
  - 두 소비처는 모두 `containerTag ∈ {checkbox,radio,switch}` 분기 안에서만 실행되고, 그 분기에서
    `phantomConfig = PHANTOM_INDICATOR_CONFIGS[containerTag]` 는 3개 태그 모두 sm/md/lg widths·gaps
    보유 → 첫 `??` 피연산자가 항상 값 반환 → INDICATOR_SIZES 미도달.
  - xl 일 땐 PHANTOM 도 상수도 키 부재라 `?? 20`/`?? 8` 하드코딩 도달 → 본 상수 실효 0.
  - catalog `ComponentRuleSize` 에 `box` 키 자체가 없음 (indicator 는 수동/React 렌더, CSS 미emit) →
    옵션 (a) 의 promote 대상이 어디서도 안 읽히는 dead 필드가 될 뿐 → **schema 보강 없이 dead 제거로
    kill criteria INDICATOR_SIZES=0 달성**. dual-SSOT 가 아니라 dead code 였음이 드러남.
  - oracle: **격리 dead-path 증명** (실제 PHANTOM_INDICATOR_CONFIGS 데이터로 12 (태그×size) 조합 전부
    before==after — PROOF_EXIT=0) + generated CSS byte-diff 0 (88 파일, layout-only) + builder
    type-check baseline 71 불변 + shared catalog 364 PASS (grep gate INDICATOR_SIZES baseline 5→0) +
    live (새로고침 후 CheckboxGroup indicator 박스 정상 렌더, console error 0).
- (Δ10) `PROGRESSBAR_COL_GAP` (`:312`, structure.composition 토큰 문자열) — **Δ5 와 분리하여 다음 단계로
  이연 (사용자 결정 2026-06-19)**. catalog `.sizes` 에 진짜 source 부재 → (A) `{ProgressBar,Meter}.sizes.
columnGap=12` 추가 + `specSizeField("progressbar", size, "columnGap")` 교체 (단 catalog rule 데이터
  변경이라 generated CSS byte-diff 검증 필수 — ProgressBar structure column-gap emit 과 별도 경로 확인)
  또는 (B) Non-goal. Δ5 와 달리 schema 값 추가 + CSS byte-diff 재검증 동반이라 위험 성격이 다름.

**Phase 3-A-3 — LOWERCASE map + base-axis + adapter (구조 SSOT, 가장 광범위)**:

- `implicitStyles.ts` local catalog map(`LOWERCASE_COMPONENT_RULE_CONTAINER`) 제거.
- field류 base/side axis 를 shared resolver 결과로 교체.
- (Δ6) 인라인 base-axis fallback `flexDirection ?? "column"` **7곳 전수** 삭제 — field류 5
  (`:1276`/`:1336`/`:1483`/`:1547`/`:1890`, 2026-06-19 Δ10 후 재실측) + collection-item 2
  (`:837`/`:861`). base axis 는 `resolveCatalogContainerBase` 에서만 온다. (codex 초안의
  `:1486-1489` 는 부정확 — 단일 위치가 아니라 7곳 분산.)
- (Δ3) shared `resolveCatalogContainerVariants` land 후 임시 adapter(`resolveActiveContainerVariants`
  내 rule 분기 `:586-593`) 삭제.
- `resolveContainerStylesFallback` wrapper 가 shared resolver 를 사용하도록 변경.
- field branch 는 child filtering/injection 만 남긴다.

#### Phase 3-A-3 정밀 매핑 산출물 (2026-06-19, 코드 변경 0 — 4축 Workflow 검증)

> 매핑 출처: 4개 축(field-catalog-backed / collection-source-gap / dependency-order / wrapper-rewire-impact)
> 병렬 매핑 + 적대 verify(2축 refute → ground-truth 정정) + grep 재실측. 핵심 정정은 §1-1 정정 블록 참조.

**(1) base-axis 7곳 분류표** (active line = 2026-06-19 Δ10 후 실측):

| #   | line  | containerTag                | 분류                            | catalog source                                                                                                                            | 현 fallback (active = 하드코딩)                                                                                                     |
| --- | ----- | --------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | :1276 | searchfield/combobox/select | field catalog-backed            | ✅ `structure.composition.layout='flex-column'`, `gap='var(--spacing-xs)'`                                                                | `display ?? "flex"`, `flexDirection ?? "column"`, `gap ?? 4`                                                                        |
| 2   | :1336 | numberfield                 | field catalog-backed            | ✅ 동일                                                                                                                                   | 동일                                                                                                                                |
| 3   | :1483 | textfield/textarea          | field catalog-backed            | ✅ TextField 확정. **TextArea `composition.gap` 누락 가능** (sizes.md gap 만) — 재배선 시 4 fallback 필요                                 | 동일                                                                                                                                |
| 4   | :1547 | datefield/timefield         | field catalog-backed            | ✅ (TimeField `structure.containerStyles` 도 보유 → merge precedence 검증)                                                                | 동일                                                                                                                                |
| 5   | :1890 | datepicker/daterangepicker  | field catalog-backed            | ✅ 동일                                                                                                                                   | 동일                                                                                                                                |
| 6   | :837  | gridlistitem                | **collection source-gap**       | ❌ `structure` 필드 자체 부재 (`componentRulesTable.ts:4765`) → `resolveCatalogContainerBase`=`{}`                                        | `display ?? "flex"`, `flexDirection ?? "column"`, `minWidth ?? 0`, `gap ?? 2`, padding 4-way(m.card\*), `borderWidth ?? 1` (9 prop) |
| 7   | :861  | listboxitem                 | **collection source-gap(부분)** | △ `structure.containerStyles` 4개(display/flexDirection/alignItems/justifyContent), **`composition` 부재** → gap/padding 은 sizes.md 에만 | `display`, `flexDirection`, `alignItems`, `justifyContent`, `gap ?? 2`, padding(4/12)                                               |

**핵심 ground-truth**: `resolveCatalogContainerBase`(structure.composition 정본 reader)는 implicitStyles/builder
전역 **호출 0건**. active wrapper `resolveContainerStylesFallback`(`:216-244`)는 `LOWERCASE_COMPONENT_RULE_CONTAINER`
(top-level `rule.containerStyles` 만) 를 읽고, `if (!cs) return specOut`(`:231`) early-return 으로 top-level
containerStyles 없는 type 은 catalog 보강 자체를 skip. → catalog 에 값이 land 됐어도 Skia 미도달 → field branch
인라인 하드코딩이 실제 active 값. **3-A-3a 의 본질 = "값 추가" 가 아니라 "wrapper 재배선 + early-return 수정 +
kebab→camel 변환 + gap 문자열 정규화".**

**(2) 의존 순서 DAG + 삭제 순서 제약**:

```
  getComponentRulesTable() [catalog 정본]
        │ (top-level containerStyles/containerVariants 만 추출)
        ▼
  LOWERCASE_COMPONENT_RULE_CONTAINER (implicitStyles.ts:124-154)
        ├─소비─► resolveContainerStylesFallback (:216-244, export, ADR-080 G1 — test 가 signature lock)
        │         └─► CONTAINER_STYLES_FALLBACK_KEYS 15개 cascade (rowGap/columnGap 부재)
        └─소비─► resolveActiveContainerVariants (:574-596, 9 call site)
                  └─► spec-shape adapter → specs.resolveContainerVariants

  ★ 재배선 목표: resolveCatalogContainerBase / resolveCatalogContainerVariants
    (resolveCatalogContainer.ts — structure.composition 까지 읽는 정본, 현재 호출 0건)
```

- map 의 2개 활성 소비처(`resolveContainerStylesFallback`, `resolveActiveContainerVariants`) 가 모두
  shared resolver 로 교체돼야 map 이 dead → 3-A-3c 가 a+b proof **이후** 인 근거.
- 선삭제 시 `.get()` NPE / 미재배선 시 catalog 값 영구 미도달(stale 고착). proof gate 메모리
  (seam 실제 제거 + kill criteria) 정합 — "작동하지만 fallback 유지" = 실패.

**(3) 3-A-3a/b/c split / gate 표**:

| 항목                  | **3-A-3a** field류 base/side axis shared resolver 전환                                                                                                                                                                                                                                          | **3-A-3b** collection-item source-gap 처리 (별도 surface)                                                                                                                                                                                            | **3-A-3c** LOWERCASE map / adapter 삭제                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **scope**             | wrapper catalog 보강부를 `resolveCatalogContainerBase` adapter 로 재배선 (early-return 수정 포함) + `resolveActiveContainerVariants` rule 분기를 `resolveCatalogContainerVariants` 로 교체. field 5 인라인 `?? "flex"/"column"/4` 제거. side-mode(`getSideLabelParentStyle`) 동일 resolver 경유 | GridListItem/ListBoxItem 2곳. **base layout source 부재 여부 먼저 결정**: (옵션 A) catalog GridListItem `structure` 보강 + ListBoxItem `composition.gap` 추가 후 재배선 / (옵션 B) collection 2곳을 별도 Phase 로 분리. **결정 자체가 surface 대상** | `LOWERCASE_COMPONENT_RULE_CONTAINER`(:124-154) + `resolveActiveContainerVariants` rule-adapter 분기(:586-593) 제거. dead code 화 후 삭제 |
| **진입 prerequisite** | (1) kebab→camel 변환 helper (2) `gap='var(--spacing-xs)'` → 숫자 4 정규화 경로 확정 (`isValidTokenRef` 가 `var(--…)` reject → raw 문자열 Taffy 유입 시 number 타입 깨짐) (3) early-return(:231) 수정 — top-level containerStyles 없는 type 도 structure.composition 도달                        | 3-A-3a proof 통과 + GridListItem source 결정(옵션 A/B) **사용자 confirm**                                                                                                                                                                            | **3-A-3a + 3-A-3b 양쪽 proof 통과** (map 2개 소비처 모두 끊김). `grep LOWERCASE_COMPONENT_RULE_CONTAINER` 활성 reference 0               |
| **byte-diff gate**    | field 5 effectiveParent 산출값 재배선 전후 camelCase 동일(display:flex/flexDirection:column/gap:4 number). `tokenConsumerDrift.test.ts` + `resolveContainerStylesFallback.test.ts` snapshot PASS. gap 문자열→4 정규화 검증 필수                                                                 | GridListItem/ListBoxItem effectiveParent 9/7 prop 재배선 전후 byte 동일 (옵션 A 시 catalog 보강값 = 하드코딩값 확인)                                                                                                                                 | 삭제 후 모든 container effectiveParent byte 불변 (dead code 제거이므로 산출값 영향 0)                                                    |
| **Skia gate**         | Chrome MCP live: field 5 + side-mode 1개(TextField labelPosition=side) Skia↔CSS 시각 대칭                                                                                                                                                                                                       | GridList/ListBox 렌더 — 카드 열 정렬/item flex 배치 파괴 0 (옵션 A 시 GridListItem layout 무참 회귀 확인)                                                                                                                                            | 전 container 회귀 sweep — 시각 변화 0                                                                                                    |
| **type-check gate**   | 0 violation                                                                                                                                                                                                                                                                                     | 0 violation (catalog 보강 시 `ComponentRule.structure` 타입 정합)                                                                                                                                                                                    | 0 violation (dead symbol 제거 후 reference 0)                                                                                            |
| **proof (kill)**      | field 5 인라인 base-axis fallback **제거되고도** resolver 단독 작동. "resolver 추가 + 하드코딩 유지" = 실패. `grep -c 'flexDirection.*?? "column"'` field 영역 = 0                                                                                                                              | collection 2곳 catalog source 단일 산출 OR (옵션 B) 명시적 제외 + 별도 Phase 등록. 부재 source 를 보강 없이 재배선 = 실패                                                                                                                            | `grep LOWERCASE_COMPONENT_RULE_CONTAINER` 활성 reference 0 (comment 제외). seam 실제 제거                                                |
| **위험**              | **CRITICAL** gap 문자열 trap(`var(--spacing-xs)`→Taffy string→layout 깨짐). **HIGH** kebab/camel mismatch. **MED** TextArea composition.gap 누락 / side-mode merge 경합 / early-return 수정이 비-field 컨테이너에 미치는 영향                                                                   | **HIGH** GridListItem source 완전 부재 → 재배선 시 `{}` → unstyled flex degrade. **MED** ListBoxItem gap/padding sizes 분산                                                                                                                          | **CRITICAL** a/b 미완 선삭제 시 NPE / catalog fallback 상실 (순서 위반)                                                                  |

**(4) 잔존 불명점** (구현 단계 결정 대상):

- TextArea `structure.composition.gap` 존재 여부 (누락 시 재배선 후 undefined → 4 fallback).
- `gap='var(--spacing-xs)'` 정규화 책임 위치: catalog 를 `{spacing.xs}` TokenRef 로 변경 vs wrapper 에 CSS-var parser 추가 vs resolver 가 정규화 — **셋 다 byte-diff 검증 동반**.
- GridListItem source 부재 해소 방식 (옵션 A 보강 vs 옵션 B 분리) — **3-A-3b 진입 시 사용자 confirm**.
- `rowGap`/`columnGap` 이 `CONTAINER_STYLES_FALLBACK_KEYS` 부재 — 재배선 시 kebab `row-gap`/`column-gap` 필터링 위험.
- `resolveCatalogContainerBase` 출력 snapshot test 부재 → 재배선 후 break 가 회귀인지 format(kebab) 변경인지 판별 불가 → 3-A-3a 진입 전 snapshot test 선작성 권장.

#### Phase 3-A-3a Land 완료 (2026-06-20) — field류 base/variants shared resolver 전환

wrapper `resolveContainerStylesFallback`(`implicitStyles.ts:270`)에 **경로 B** 추가: top-level
`rule.containerStyles` 부재 + `structure.composition` 보유 type(field류)은 `resolveCatalogContainerBase`
경유로 base layout 도달. field 5 분기 인라인 `?? "flex"/"column"` 제거(`gap ?? 4` 는 TextArea
대비 유지). `resolveActiveContainerVariants` rule-adapter 를 `resolveCatalogContainerVariants` 로 교체.

**잔존 불명점 해소 결과**:

- **TextArea gap**: `composition.gap` 부재 확정(snapshot lock). wrapper 출력에 gap 없음 → field 분기 `?? 4` 유지로 회귀 0.
- **gap 정규화 책임 위치 결정**: **wrapper(builder)** — `resolveCatalogLayoutValue` helper(`isValidTokenRef`/`cssVarToTokenRef` → `resolveToken`). catalog 데이터(`var(--spacing-xs)`) 불변(CSS generator byte-diff 0), resolver 불변(변환 책임 미부여 주석 정합). specPresetResolver `resolveToNumber`(:170) 검증된 선례 동형.
- **kebab→camel + casing**: `kebabToCamel` helper + `LOWERCASE_TO_PASCAL_RULE_KEY` 역매핑(`resolveCatalogContainerBase("textfield")`=`{}` 확인 → PascalCase 필수). 경로 B 만 적용(경로 A=top-level containerStyles type 은 기존 camelCase 경로 유지 → byte-lock 보존).
- **`structure.composition` guard**: collection-item(GridListItem/ListBoxItem/TableRow=composition 부재)은 경로 B 미적용 → `{}` 반환 정답(test lock). 3-A-3b 영역 침범 0.
- **snapshot test 선작성**: `resolveCatalogContainerBase.snapshot.test.ts`(field 9 + collection 2 + variants, 21건) land.

**검증**: base-axis grep gate 7→2(collection 2 잔존, 3-A-3b 에서 0) / byte-diff 0(재배선 전후 field 10 type effectiveParent.style 동일, git stash 격리 비교) / variants 교체 13 type 전 props 동등 / type-check 0 신규 위반 / wrapper+snapshot+grep gate 54건 PASS / **live: builder field(TextField) flex-column 정상 렌더 + 콘솔 NaN/Taffy 에러 0(gap 문자열 정규화 확인), 새로고침 후 canonical hydrate 재계산도 정상**. radius drift test 2건 FAIL 은 pre-existing baseline(2xl 토큰 미갱신, 본 변경 무관 — git stash 격리 확인).

**3-A-3a kill criteria 통과**: field 5 인라인 base-axis fallback 제거되고도 resolver 단독 작동("resolver 추가 + 하드코딩 유지" 아님). LOWERCASE map 의 variants 소비처 끊김 → 3-A-3c 의 절반 prerequisite 충족(containerStyles 경로 A 1곳 잔존).

#### Phase 3-A-3b Land 완료 (2026-06-20) — collection-item base-axis catalog 보강 + 재배선 (옵션 A)

사용자 confirm 후 **옵션 A(catalog 보강)** 채택. base-axis grep gate **2→0** (Δ6 collapse kill 완료).

**collection 비대칭 해소 (정밀 매핑 + 적대 검증 ground-truth)**:

- **GridListItem**: catalog `structure` **자체 부재** 였음 → `structure.containerStyles`(display:flex / flexDirection:column / minWidth:0) 신규 추가. **권위 source = starter `GridList.css:112`** (`.react-aria-GridListItem { display:flex; flex-direction:column; min-width:0 }`) — "억지 생성" 아닌 CSS 정본 환원. gap/padding/borderWidth 는 sizes.md + `resolveGridListItemMetric` 경유라 structure 미포함.
- **ListBoxItem**: `structure.containerStyles` 4개(display/flexDirection/alignItems/justifyContent) **기존 보유** → 추가 0.
- **재배선 경로**: collection 분기(`implicitStyles.ts:913/:937`)가 `resolveCatalogCollectionBase`(=`resolveCatalogContainerBase` 직접 호출, casing lowercase→PascalCase) 경유로 base-axis 도달. 인라인 `?? "flex"/"column"` 제거. size-value(gap/padding/borderWidth)는 sizes.md 정합값으로 인라인 유지.
- **guard 완화 회피 (surface-minimization)**: field류 wrapper 경로 B guard 를 `composition OR structure.containerStyles` 로 완화하면 **43 type**(Avatar/Badge/Button/Checkbox 등 leaf 포함) 신규 진입 → 회귀 표면 과다. collection 2곳 **전용 helper 직접 호출**이 최소 표면.

**GridListItem base-axis = Taffy LIVE 확정**: Skia 는 `gridlist_card:"replace"` escape 가 카드 시각 자체 paint 하지만, **Taffy layout(컨테이너/자식 배치)은 effectiveParent.style 의 display/flexDirection 구동** (자식 `injectCollectionItemFontStyles` 로 유지, escape 아님). 단순 제거 = unstyled flex degrade 회귀 → catalog 보강이 prerequisite.

**검증**: base-axis grep gate 2→0(field 5 + collection 2 모두 catalog 경유) / byte-diff 0(재배선 전후 GridListItem·ListBoxItem effectiveParent.style 동일, git stash 격리 — componentRulesTable + implicitStyles 동시 stash) / type-check 0 신규 위반 / wrapper+snapshot+grep gate 54건 PASS / **live: builder ListBox(ListBoxItem) Skia canvas + DOM Preview 양쪽 flex-column 정상(라벨 굵게 위 + 설명 아래 좌측정렬, 시각 대칭) + 콘솔 NaN/Taffy 에러 0**. wrapper collection={} lock 유지(collection 은 경로 B 미진입, 분기 직접 처리).

**3-A-3b kill criteria 통과**: collection 2 인라인 base-axis 제거되고도 catalog source 단독 작동. GridListItem source 부재를 starter CSS 환원으로 해소(억지 생성 아님). **Δ6 base-axis collapse 완결** — field 5 + collection 2 = 7곳 전부 catalog 단일 source. 잔존 = 3-A-3c(LOWERCASE map containerStyles 경로 A 삭제).

#### Phase 3-A-3c Land 완료 (2026-06-20) — builder-local catalog container 조회 map 삭제

`implicitStyles.ts` 의 builder-local catalog container 조회 map(`LOWERCASE_COMPONENT_RULE_CONTAINER`, 정의 31줄) 을 삭제했다. 이 map 은 `getComponentRulesTable()` 에서 top-level `containerStyles`/`containerVariants` 만 추출해 lowercase 키로 캐싱한 **조회 캐시**였다.

**소비처 2곳 모두 dead 화 후 삭제**:

- **variant 어댑터**(`resolveActiveContainerVariants`): 3-A-3a 에서 이미 `resolveCatalogContainerVariants`(catalog 단일 resolver) + `LOWERCASE_TO_PASCAL_RULE_KEY` 역매핑으로 교체됨 → map 의 `.containerVariants` read 0건 (이번 phase 진입 전 이미 dead).
- **containerStyles 보강**(`resolveContainerStylesFallback` 경로 A): map 조회(`.get(type).containerStyles`)를 `LOWERCASE_TO_PASCAL_RULE_KEY` 역매핑 + `resolveComponentRule(pascalKey).containerStyles` 직접 조회로 대체. **경로 A 로직 보존 + map 조회만 교체** (산출값 불변).

**핵심 결정 — 경로 B 흡수 기각 (surface-minimization)**: 경로 A 를 `resolveCatalogContainerBase`(경로 B resolver) 로 흡수하면 `structure.composition.layout` base 가 leaf 44 type(Avatar/Badge/Button/Checkbox/Radio/Switch/Heading/Paragraph 등)에 신규 진입 → 회귀 표면 과다(`feedback-execute-adr-surface-minimization`). 실측으로 확증(통합 전후 전체 118 type byte-diff: guard 제거 시 44 DIFFER). 따라서 흡수 대신 **map 조회만 역매핑 직접 조회로 교체**하여 경로 A 출력을 byte 불변 보존.

**ToggleButtonGroup flexDirection leak 0 (적대 검증 witfvnqp4 핵심 경고 해소)**: ToggleButtonGroup top-level containerStyles 는 `flexDirection` 을 의도적으로 생략(`{display:flex, alignItems:center, width:fit-content}`)하고, `applyImplicitStyles` 분기(:982)가 orientation prop 으로 flexDirection 을 런타임 결정(horizontal→row / vertical→column). 만약 경로 B 흡수로 `structure.composition.layout="flex-row"` 가 `flexDirection:row` 를 주입하면 `parentStyle.flexDirection` 이 항상 "row" 로 고정되어 **vertical orientation 회귀**. map 조회만 교체하는 본 설계는 이 leak 이 0(top-level containerStyles 그대로 유지).

**검증**:

- **byte-diff 0**: 통합 전 `implicitStyles.ts` (git stash 격리) + 통합 후 byte-lock test 29건 = 전부 PASS → 경로 A 7 type(InlineAlert/ListBox/Menu/Slider/TagGroup/ToggleButtonGroup/Tree) wrapper 출력이 `resolveComponentRule` 직접 조회로 byte 불변임을 증명.
- **byte-lock 강화**: ToggleButtonGroup/Slider/InlineAlert/TagGroup 은 기존 byte-lock test 부재(적대 검증이 leak 미감지 경고) → 7 type 전부 `toEqual` lock 추가(특히 ToggleButtonGroup `not.toHaveProperty("flexDirection")`).
- **grep gate**: `LOWERCASE_COMPONENT_RULE_CONTAINER` baseline 3→0 (정의+소비+잔존 주석 심볼명 전수 제거). 주석에서도 심볼명 직접 사용 안 함(false positive 회피).
- **type-check 0 신규 위반**(`ContainerVariantStyles` type import 동반 제거).
- **live (builder 앱 인스턴스 직접 호출)**: 7 type wrapper 출력 = byte-lock 기대값 정확 일치 / ToggleButtonGroup flexDirection leak 0 / `applyImplicitStyles` ToggleButtonGroup orientation 동작 정상(horizontal→row, vertical→column) / ListBox DOM computed style(flex-column/gap 2px/padding 4px/maxHeight 300px) 정합 / 콘솔 NaN·Taffy·에러 0.
- pre-existing FAIL(통합 무관, git stash 격리 확인): `specPresetResolver.test.ts` 27건(spec 삭제 cutover 잔여 부채, Phase 4 영역) / `tokenConsumerDrift` radius 2건(ADR-913 slice 5 snapshot 미갱신) / skia test alias 미해석(`@/adapters/canonical`).

**3-A-3c kill criteria 통과**: `grep LOWERCASE_COMPONENT_RULE_CONTAINER` 활성 reference 0(주석 포함). seam(builder-local 조회 map) 실제 제거 — "map 유지하며 우회" 아님. **Phase 3-A LOWERCASE map collapse 완결** — variant/containerStyles 양 소비처가 catalog 단일 resolver / `resolveComponentRule` 직접 조회로 수렴. 잔존 dispersion = Phase 4 `TAG_SPEC_MAP` 직독(specPresetResolver).

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
  (track height, indicator gap, slider/progressbar row gap) 을 선언한다. **`INDICATOR_SIZES` 는
  적대 검증(w6gqcrgh3) 후 box·gap 모두 dead-path 로 확정 → schema 보강 없이 dead 제거(Δ5 옵션 c)로
  0 달성 ✅ (Phase 3-A-2 Land 완료 2026-06-19)**. **`PROGRESSBAR_COL_GAP` 도 0 달성 ✅ (Δ10 Land 완료
  2026-06-19, commit `3f4224999`)** — live 실측이 옵션 A/B 전제를 정정: catalog 의 `column-gap:
var(--spacing-md)`(12px) 는 generated CSS 에서 `gap:4px` shorthand 에 덮여 effective 4px(dead),
  layout 만 12 를 써서 Builder≠Preview 렌더 버그였다. CSS effective(4px) 정본 채택 → column-gap 도
  row-gap 처럼 `.sizes.gap`(=4) read-through 통일, 상수 삭제. byte-diff 0 + Skia layout 4px 정합.
- (Δ6) `implicitStyles.ts` 의 7개 base-axis fallback (field류 5 + collection-item 2) 중 **하나라도**
  인라인 `?? "column"` 으로 남는다 (`grep -c 'flexDirection.*?? "column"'` ≠ 0).
- generated CSS 는 바뀌었는데 Skia/layout 또는 Style Panel focused test 가 없다.

## 6. Done definition

완료는 "Style Panel 표시가 좋아짐"이 아니라 아래 전부다.

| Gate        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source      | field base layout, TagGroup base layout, side variants, **그리고 track height / indicator gap / slider·progressbar row gap (Δ4, 3종)** 가 `componentRulesTable.sizes` 에서 선언, 해당 mirror 0. **`INDICATOR_SIZES` (Δ5) 는 dead-path 확정 → dead 제거로 0 ✅. `column-gap` (Δ10) 은 live 실측이 CSS↔Skia 렌더 버그로 정정 → CSS effective(4px) 정본 채택, `.sizes.gap` read-through 통일 + 상수 삭제로 0 ✅ (byte-diff 0)** |
| Generator   | virtual CSS emit membership 이 `rule.structure` 로 결정되고 `STRUCTURE_META` 없음, `COMPOSITION_LAYOUT_STYLES` 없음 (Δ7)                                                                                                                                                                                                                                                                                                     |
| Skia/layout | container base/variant 는 shared resolver 소비, local rule map 없음, 인라인 base-axis fallback 없음 (Δ6)                                                                                                                                                                                                                                                                                                                     |
| Style Panel | `TAG_SPEC_MAP` 직독 없음, TextField/TagGroup preset 이 shared resolver 기반                                                                                                                                                                                                                                                                                                                                                  |
| Tests       | shared resolver + Style Panel + Skia/layout focused tests PASS                                                                                                                                                                                                                                                                                                                                                               |
| Build       | generated CSS **byte-diff = 0 (enforce, Δ8)** + type-check PASS                                                                                                                                                                                                                                                                                                                                                              |
| Browser     | TextField top/side 및 TagGroup side 의 Panel 표시와 Canvas layout 수동 확인 + ProgressBar track / Checkbox indicator 렌더 불변                                                                                                                                                                                                                                                                                               |

### 6-1. 종결 조건 — falsifiable test (T1~T6)

②목표 visual/structure/size 축이 닫히고 ADR-912 재승격 가능한 조건 (각각 독립 검증):

- **T1 (grep 0)**: `STRUCTURE_META_ENTRIES`/`StructureMeta` (specs) = 0 / `COMPOSITION_LAYOUT_STYLES`
  (CSSGenerator) = 0 / `LOWERCASE_COMPONENT_RULE_CONTAINER`·`VALUE_FILL_TRACK_HEIGHT`·`PROGRESSBAR_ROW_GAP`·
  `PROGRESSBAR_COL_GAP`·`SLIDER_ROW_GAP` (implicitStyles, Δ4 3종 + Δ10) = 0 / `TAG_SPEC_MAP`
  (specPresetResolver) = 0 / `flexDirection: ... ?? "column"` (implicitStyles) = 0 / 새 resolver 의
  `@composition/specs` import = 0.
  - **`INDICATOR_SIZES` = 0 ✅ 달성 (Phase 3-A-2)**: 적대 검증(w6gqcrgh3) 후 box·gap 모두 dead-path 로
    확정 → dead 제거(Δ5 옵션 c)로 schema 보강 없이 0.
  - **`PROGRESSBAR_COL_GAP` = 0 ✅ 달성 (Δ10, commit `3f4224999`)**: live 실측이 옵션 A/B 전제를 정정 —
    catalog 의 `column-gap: var(--spacing-md)`(12px) 는 generated CSS 에서 `gap:4px` shorthand 에 덮여
    effective 4px(dead), layout 만 12 를 써서 Builder(12px)≠Preview(4px) 렌더 버그였다. 옵션 A
    (`.sizes.columnGap=12`) 는 CSS effective 를 4→12 로 바꿔 byte-diff + 사용자-가시 간격 변화라 기각.
    CSS effective(4px) 정본 채택 → column-gap 도 row-gap 처럼 `.sizes.gap`(=4) read-through 통일,
    상수 삭제. byte-diff 0 + Skia layout 4px (CSS 정합 복원). Δ5 옵션 c 와 동형(lock-in 옵션 밖 제3 경로).
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

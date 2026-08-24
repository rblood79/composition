# ADR-912 후속 — 선택 요소 Resolved Visual Style Read Model

## 문서 상태와 상위 결정

- 상태: Draft — 2026-08-25
- 상위 결정: [ADR-912](../completed/912-rac-pencil-rebuild-cutover.md)
- 관련 결정:
  - [ADR-142](../completed/142-starter-spec-component-system-cutover.md) — catalog + theme/tokens D3 SSOT
  - [ADR-187](../completed/187-editor-presentation-transaction-and-typed-invalidation.md) — 연속 편집 presentation/canonical 분리

이 문서는 새 ADR이 아니다. ADR-912 Hard Constraint 1~3의 “같은 노드 + 같은 theme
rule”, “패널은 단일 공급원의 view”, “base ⊕ override” 결정을 색상 채널까지 완결하는
구현 breakdown이다. ADR-912의 Status와 `docs/adr/README.md` 항목은 변경하지 않는다.

ADR fork 규칙의 전제·관점 4문항은 다음과 같이 고정한다.

1. **base / 응용 분류**: ADR-912가 base 아키텍처이고 본 문서는 Style Panel 색상 read model이라는
   구체 응용이자 미완결 구현 범위다. 본 문서가 ADR-912의 선행 조건이 아니다.
2. **schema 직교성**: 새 canonical/catalog schema를 만들지 않는다. 기존
   `ComponentRuleVariant`, `ComponentRuleFill`, `props.style`의 해석 경로만 단일화한다.
3. **선행 전제 reverse 검증**: `resolveMergedStyle`이 size 채널만 포함하고 색상 상태 선택은
   `buildCatalogShapes`에 남아 있는 현재 코드를 재확인했다. 따라서 ADR-912의 의존 방향을
   뒤집지 않고 잔여 color seam을 닫는다.
4. **작성 시점 확정**: 사용자가 2026-08-25 “ADR-912 후속 설계 시작해”라고 명시했다.
   새 ADR 분리 없이 ADR-912 범위 안에서 진행한다.

## 1. 문제 정의와 실측 기준선

### 1-1. 사용자 관점 계약

```text
Canvas 안의 요소 선택
  → 선택 요소의 현재 authored visual state 해석
  → Style Panel background / color / borderColor에 즉시 표시
```

여기서 “현재”는 저장된 선언형 상태(`variant`, `fillStyle`, `isQuiet`, `isSelected`,
`isEmphasized`, `staticColor`)와 inline/responsive/ref override, theme, 상속 accent를 뜻한다.
pointer hover/pressed/focus 같은 일시 interaction state는 Style Panel의 편집 baseline이 아니다.

Canvas framebuffer/Skia shape를 역으로 읽는 것은 이 계약에 포함하지 않는다. Canvas와 Style
Panel은 catalog D3 SSOT의 대등한 consumer이며 Canvas가 새 SSOT가 되지 않는다.

### 1-2. 현재 read 경로

| 축                 | 현재 경로                                                                 | 현재 범위                                                             | 확인된 결손                                              |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Skia               | `resolveSkiaVisualRule` → `buildCatalogShapes`                            | fillStyle, quiet, selected/emphasized, staticColor, interaction state | 상태 선택 로직이 renderer 내부에 묶임                    |
| Style Panel        | `useElementStyleContext` → `specPresetResolver.resolveCatalogColorPreset` | variant, fillStyle, isQuiet                                           | staticColor, selected/emphasized, inherited accent 누락  |
| 공통 base/override | `resolveMergedStyle` → `toSkiaStyle`                                      | size base + `props.style` override                                    | variant/state 색상은 명시적으로 scope 밖                 |
| ColorPicker 입력   | `resolveStylePanelColor` / `safeParseColor`                               | 전역 theme token 또는 CSS color                                       | 요소별 accent와 Modified Styles의 CSS variable 처리 누락 |

`specPresetResolver`의 appearance/typography cache key도
`type:size:variant:fillStyle:isQuiet`까지만 포함한다. 누락된 state를 cache key에 계속 추가하는
방식은 같은 오류를 반복하므로, 동적 색상 채널은 수동 문자열 cache에서 분리한다.

### 1-3. 재현이 고정돼야 하는 결손

| ID  | 조건                                                 | Canvas/DOM 기대                      | 현재 Style Panel                    |
| --- | ---------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| D1  | Badge `fillStyle=bold/subtle/outline`                | 각 fillStyle별 배경/텍스트/테두리    | catalog 데이터 부재로 bold fallback |
| D2  | Button/Link/ToggleButton `staticColor=black/white`   | 고정 흑백 및 opaque fill의 역상 text | variant 색상 유지                   |
| D3  | Card/ToggleButton `isSelected`, `isEmphasized`       | selected/emphasized paint            | base paint 유지                     |
| D4  | 선택 요소 또는 조상의 `accentColor`                  | 해당 accent token으로 paint          | 전역 project tint로 표시            |
| D5  | Modified Styles 값이 `var(--accent)` 등 CSS variable | 실제 token color                     | 검정 fallback                       |

기존 `useColorStyleValues.test.tsx`는 Button의 일반 fill/outline/premium과 inline override만
검증한다. 위 D1~D5를 RED fixture로 먼저 추가한다.

### 1-4. HIGH 위험 코드 근거와 generator 판정

HIGH 위험은 다음 production 경로에 걸친다.

- `packages/shared/src/catalog/resolvers/resolveMergedStyle.ts::resolveMergedStyle`
- `apps/builder/src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts::resolveSkiaVisualRule`
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts::buildCatalogShapesOrPrimitive`
- `packages/specs/src/renderers/buildCatalogShapes.ts::buildCatalogShapes`
- `packages/specs/src/renderers/skiaPrimitives.ts`
- `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts::resolveCatalogColorPreset`
- `apps/builder/src/builder/panels/styles/hooks/useElementStyleContext.ts::useElementStyleContext`
- `apps/builder/src/utils/theme/tintToSkiaColors.ts::withAccentOverride`

**Generator 판정**: 새 catalog schema나 selector 언어를 추가하지 않는다. Button이 이미 사용하는
`fill.default/outline`, `colors.outlineText/outlineBorder` emit capability를 Badge 데이터에도 적용한다.
Badge `subtle` selector emit이 현 generator에서 지원되는지는 Phase 0 fixture로 먼저 확증한다.
지원되지 않으면 수동 CSS를 병행하지 않고 generator capability를 같은 Phase 4 안에서 보강한 뒤
단일 source 조건을 다시 통과해야 한다.

**BC 판정**: canonical/catalog 저장 schema와 persisted node props를 바꾸지 않으므로 기존 프로젝트
재직렬화 대상은 0개다. migration script와 DB write는 범위 밖이다.

## 2. 범위

### 포함

- catalog component root의 편집 가능한 paint 3채널:
  `backgroundColor`, `color`, `borderColor`.
- 선언형 props에 따른 authored state:
  `variant`, `fillStyle`, `isQuiet`, `isSelected`, `isEmphasized`, `staticColor`.
- `props.style`/responsive/ref-origin에서 온 명시 override 우선순위.
- 현재 light/dark theme, project tint, 선택 요소/조상의 `accentColor`.
- catalog rule이 제공하는 background alpha와 static track wash 같은 paint 메타.
- Badge fillStyle의 catalog SSOT 누락과 수동 CSS 중복 해소.
- Style Panel color hooks와 Modified Styles의 parseable picker seed.
- generic box+text Skia 경로 및 동일 paint 계약을 쓰는 primitive의 회귀 검증.

### 제외

- hover/pressed/focusVisible 상태를 Style Panel baseline으로 표시하는 기능.
- ProgressBar/Meter/Slider의 track/value/indicator처럼 root 3채널로 환원할 수 없는 subpart
  editor UI. 공통 resolver는 Canvas paint에 필요한 메타를 보존하지만 패널 필드 신규 노출은 하지 않는다.
- gradient/image/mesh fill의 Style Panel 모델 변경.
- canonical document 또는 catalog schema의 신규 저장 필드.
- Property/Style Panel의 write/dirty/reset 의미 변경.
- ADR-187 presentation scheduler, transaction lifecycle, invalidation lane 확대.
- Canvas framebuffer, Skia node, Preview `getComputedStyle`을 새 권위로 사용하는 readback.

## 3. 제약과 불변식

| ID  | 불변식                                | 측정 가능한 조건                                                                                       |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| H1  | D3 SSOT 유지                          | paint token source는 `COMPONENT_RULES_TABLE` + theme/tokens 한 곳. 컴포넌트별 panel 색상 table 0건     |
| H2  | Canvas 비권위                         | Style Panel production path에서 Skia shape/framebuffer read 0건                                        |
| H3  | authored state와 transient state 분리 | Panel은 `interactionState="default"`; `isSelected/isEmphasized`는 props에서 반영                       |
| H4  | override 우선순위                     | `effectiveStyle channel > staticColor > selected/fillStyle/variant`를 Canvas/Panel이 공유              |
| H5  | read-only 계산                        | 선택/표시 시 canonical/history/DB mutation 및 RAF scheduling 0건                                       |
| H6  | hot-path 비용 불변                    | Canvas element당 기존 색상 분기 1회를 공통 resolver 1회로 대체; 중복 2회 계산 금지, Big-O 불변         |
| H7  | 구독 최소화                           | Panel은 선택 요소 context와 theme/breakpoint 관련 version만 구독; 전체 Canvas scene 구독 신규 추가 0건 |
| H8  | ref/responsive 정합                   | `useElementStyleContext`의 origin merge와 breakpoint 해석 이후 effective props/style을 resolver에 전달 |
| H9  | presentation 격리                     | ColorArea raw input 동안 canonical write 0, terminal 1회 계약 유지                                     |
| H10 | generic data branch                   | 새 `if (type === "Button")`류 component 식별 분기 0건                                                  |

### 성능 판정

- 공통 resolver는 동기 O(1) property lookup이며 global store를 읽지 않는 pure function이어야 한다.
- Style Panel 동적 색상 결과에는 수동 문자열 cache를 두지 않는다. React `useMemo`는 이미 구독한
  immutable input identity에만 사용한다.
- Canvas에서 기존 `buildCatalogShapes` 내부 색상 분기와 새 resolver가 동시에 실행되는 과도기를
  최종 상태로 허용하지 않는다.
- ADR-187 진단 기준으로 color drag 중 action/control RAF `0/0`, legacy/canonical drag write `0`,
  terminal canonical commit `1`을 유지한다.

## 4. 목표 구조

```text
Canonical selected node
  └─ useElementStyleContext
       ├─ ref origin + instance merge
       ├─ active breakpoint merge
       └─ fills → effective style adapter
                │
ComponentRule + semantic props + effective style + authored state
                │
                ▼
      resolveCatalogPaint()              @composition/shared, pure/O(1)
        ├─ symbolic background token
        ├─ symbolic text token
        ├─ symbolic border token
        ├─ alpha/static wash metadata
        └─ opaque/background capability
            │                         │
            │                         └─ Skia adapter
            │                              ├─ actual interactionState 전달
            │                              └─ withAccentOverride + shape 변환
            ▼
      Style Panel adapter
        ├─ interactionState="default"
        ├─ inherited accent + theme token 해소
        └─ PropertyColor가 읽는 concrete CSS color

DOM/Preview/Publish
  └─ 같은 ComponentRule에서 generated CSS/data-* 파생
     (공통 runtime resolver의 output을 DOM inline style로 주입하지 않음)
```

DOM은 generated CSS를 계속 사용한다. 동일한 runtime object를 세 backend에 강제로 주입하는 것이
목표가 아니라, 같은 catalog rule과 동일한 state precedence가 동일한 시각 결과를 내는 것이 목표다.

### 패키지 경계

- 상태 선택 코어는 `packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts`에 둔다.
  입력은 shared의 `ComponentRuleVariant`/`ComponentRuleSize`와 plain props/style뿐이다.
- `packages/specs`는 `@composition/shared`를 import하지 않는다. Builder가 shared resolver 결과를
  Skia renderer의 작은 paint input으로 adapt해 주입한다.
- adapter는 필드 이름 변환만 하며 fillStyle/static/selected 우선순위를 다시 계산하지 않는다.
- element/ancestor accent 탐색은 canonical tree context가 있는 Builder read boundary에 남긴다.
  shared resolver는 TokenRef를 concrete hex로 해소하지 않는다.

## 5. 데이터 계약

### 5-1. Symbolic paint resolver

```ts
export type CatalogInteractionState = "default" | "hover" | "pressed";

export interface ResolveCatalogPaintInput {
  variant: ComponentRuleVariant | undefined;
  size: ComponentRuleSize | undefined;
  props: Readonly<Record<string, unknown>>;
  style: Readonly<Record<string, unknown>> | undefined;
  interactionState: CatalogInteractionState;
}

export interface ResolvedCatalogPaint {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  backgroundAlpha: number;
  staticTrackWash: boolean;
  hasVisibleBoxPaint: boolean;
  hasOpaqueCatalogBackground: boolean;
}
```

이 타입은 초기 설계 shape다. Phase 0에서 primitive 소비처 전수 inventory 후 필요한 최소 필드만
확정한다. renderer geometry, shape, CanvasKit 객체를 포함하면 실패다.

두 boolean은 합치지 않는다.

- `hasVisibleBoxPaint`: inline background override를 포함해 실제 background/border shape를 그릴지 판정.
- `hasOpaqueCatalogBackground`: catalog variant의 opaque background 또는 border를 가진 box archetype인지
  판정. 사용자 inline background만 추가된 Text/Label을 center/middle 정렬로 바꾸지 않는다.

### 5-2. 우선순위

1. `style.backgroundColor` / `style.color` / `style.borderColor` 명시 override
2. `staticColor` 규칙
3. `isSelected` + `isEmphasized`
4. `isQuiet`
5. `fillStyle=outline/subtle/default`
6. `interactionState=hover/pressed/default`
7. variant base

단, 2~6은 서로 단순 last-wins가 아니다. 현재 `buildCatalogShapes`의 데이터 기반 조건을 보존한다.

- selected background는 `fill.default.selected/emphasizedSelected`를 사용한다.
- quiet은 해당 variant에 `fill.quiet`가 있을 때만 활성화한다.
- staticColor는 opaque fill일 때 background/static + inverse text를 사용한다.
- outline/subtle/text-only/value-fill track은 static text/border와 wash 규칙을 유지한다.
- border 채널이 없으면 staticColor가 새 border를 만들어서는 안 된다.
- inline background는 `hasVisibleBoxPaint`에는 포함하지만 `hasOpaqueCatalogBackground`에는 포함하지 않는다.
- `_isShowAll` 같은 catalog data signal은 type 분기 없이 기존 시각을 보존한다.

### 5-3. Style Panel concrete color adapter

Panel adapter는 symbolic color별로 다음을 반환한다.

```ts
interface ResolvedEditorColor {
  raw: string; // TokenRef/CSS variable/inline CSS color
  concrete: string; // React Aria ColorPicker가 parse 가능한 CSS color
}
```

- `raw`는 source 추적과 reset/dirty 의미를 보존한다.
- `concrete`는 현재 theme와 inherited accent를 적용한다.
- parse 불가 값을 무조건 검정으로 바꾸지 않는다. 알려진 token/CSS variable을 먼저 해소하고,
  실제 invalid CSS만 기존 fail-safe를 사용한다.
- dirty/reset 판정은 계속 raw canonical override를 읽는다. resolved/merged 결과로 override 존재를
  재판정하지 않는다.

### 5-4. Cache 계약

- size/layout preset의 정적 cache는 유지할 수 있다.
- paint 결과는 `props` 상태와 element/ancestor accent에 의존하므로 기존
  `type:size:variant:fillStyle:isQuiet` cache에서 분리한다.
- 동적 paint cache를 새로 만들 경우 manual key 문자열은 금지한다. 하지만 resolver가 O(1)이므로
  Phase 1 기본 선택은 **cache 없음**이다.

## 6. 구현 Phase

### Phase 0 — Inventory freeze와 RED fixture

목표: 공통 resolver가 대체해야 할 현재 동작과 scope 밖 동작을 코드로 동결한다.

작업:

- `buildCatalogShapes`와 `skiaPrimitives`의 variant/fill/text/border/static/selected 직접 접근 전수 inventory.
- `staticColor`, `isSelected`, `isEmphasized`, `isQuiet`, `fillStyle`, `accentColor` binding 전수 매트릭스.
- D1~D5 RED fixture 추가.
- Badge binding option과 `ComponentRuleVariant.fill` coverage 불일치 fixture 추가.
- ref-origin + responsive + inline override precedence fixture 추가.

Gate P0:

- inventory에 production consumer 파일/함수/채널이 모두 기록돼야 한다.
- RED는 현재 결손 때문에 실패하고, 기존 Button color tests는 계속 통과해야 한다.
- 추정 대비 consumer 수가 1.5배 이상이면 새 ADR로 분리하지 않고 Phase 0 inventory를 재freeze한다.

### Phase 1 — Shared symbolic paint resolver

대상:

- `packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts` 신규
- `packages/shared/src/catalog/index.ts` export
- 인접 단위 테스트 신규

작업:

- `buildCatalogShapes`의 fillStyle/quiet/selected/static/text/border precedence를 pure resolver로 이동.
- type 식별 없이 data channel 존재 여부로 판정.
- default/hover/pressed Canvas parity fixture를 resolver fixture로 고정.
- style override와 border eligibility/alpha/static wash를 포함한다.

Gate P1:

- 기존 Skia 결과와 새 resolver를 병렬 비교하는 shadow fixture가 전체 matrix에서 동등해야 한다.
- resolver 파일의 Canvas/DOM/Zustand/React import는 0건이어야 한다.
- component type literal 분기 0건이어야 한다.

### Phase 2 — Skia 단일 소비 전환

대상:

- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`
- `packages/specs/src/renderers/buildCatalogShapes.ts`
- paint를 직접 선택하는 `packages/specs/src/renderers/skiaPrimitives.ts`의 Phase 0 확정 소비처

작업:

- Builder가 rule/props/style/state로 `resolveCatalogPaint`를 1회 호출한다.
- generic shape와 primitive에 symbolic paint를 adapter로 주입한다.
- `buildCatalogShapes` 내부의 fillStyle/selected/staticColor 상태 선택 분기를 삭제한다.
- renderer는 주입된 paint를 shape로 변환하는 책임만 가진다.

Gate P2:

- 기존 Skia snapshot/shape tests byte 또는 semantic parity PASS.
- 색상 상태 선택 로직 production owner는 shared resolver 1곳이어야 한다.
- element당 resolver 호출이 1회를 초과하지 않아야 한다.

### Phase 3 — 선택 요소 Style Panel read model 전환

대상:

- `useElementStyleContext.ts`
- `useAppearanceValues.ts`
- `useTypographyValues.ts`
- `specPresetResolver.ts`
- `styleValueHelpers.ts`
- `ModifiedStylesSection.tsx`

작업:

- element/ancestor `accentColor`를 canonical panel read boundary에서 해석한다.
- effective props/style과 `interactionState="default"`로 공통 paint resolver를 호출한다.
- Appearance/Typography가 각각 같은 resolved paint snapshot의 background/border/text를 소비한다.
- 동적 color를 appearance/typography preset cache에서 분리한다.
- CSS variable을 theme/accent-aware concrete color로 해소해 ColorPicker에 전달한다.
- write/dirty/reset 및 ADR-187 presentation action은 변경하지 않는다.

Gate P3:

- D2~D5 RED fixture GREEN.
- 선택 전환 시 이전 요소의 resolved color가 남는 stale cache 재현 0.
- panel read로 canonical/history/DB mutation 및 RAF scheduling 0.

### Phase 4 — Badge catalog SSOT 완결

대상:

- `packages/shared/src/catalog/generated/componentRulesTable.ts`
- `packages/shared/src/components/styles/Badge.css`
- generated CSS와 binding/catalog contract tests

작업:

- Badge variant별 bold/subtle/outline fill/text/border를 catalog에 표현한다.
- catalog가 emit 가능한 규칙은 수동 CSS에서 제거해 dual source를 남기지 않는다.
- binding의 fillStyle option이 rule channel 또는 명시적 allowed fallback을 가진다는 전수 fixture를 추가한다.

Gate P4:

- D1 RED fixture GREEN.
- Badge bold/subtle/outline CSS↔Skia↔Style Panel concrete color 일치.
- 동일 selector가 manual/generated CSS 양쪽에 중복 정의되지 않아야 한다.

### Phase 5 — 성능 및 실제 Builder 수렴

자동 검증:

- shared resolver/panel hook/specs shape focused tests.
- `pnpm run codex:typecheck`.
- `pnpm run codex:preflight`.
- `git diff --check`.

실제 Builder 검증:

- 기준 URL: `http://localhost:5173/builder/97517aae-a9e5-4b7c-9d21-7c0ea0029908`.
- Canvas 요소 선택 → Properties prop 확인 → Style Panel color 3채널 확인.
- Compare Mode에서 Skia Canvas, Preview DOM/CSS, Style Panel 3축 대조.
- foreground tab에서 color drag diagnostics와 terminal commit 확인.

Gate P5:

- 아래 §9 매트릭스 전 항목 PASS.
- ADR-187 raw/terminal 계약과 scheduling 지표 회귀 0.
- console error/warning 0/0.

## 7. 위험

| ID  | 위험                                                                                       | 심각도 | 대응                                                                                             |
| --- | ------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------ |
| R1  | 공통 resolver 한 오류가 catalog 컴포넌트 전체 색상을 동시에 회귀                           |  HIGH  | P1 shadow parity + P2 Canvas cutover gate; Button/Badge/Card/ToggleButton/Link 적대 fixture      |
| R2  | `buildCatalogShapes`만 이전하고 primitive가 구 visual 상태를 계속 해석해 owner가 둘로 남음 |  HIGH  | P0 consumer inventory, paint field direct-read grep gate, P2 owner 1곳 조건                      |
| R3  | element accent 해소가 global theme mutation을 React render 중 재사용해 다른 요소 색을 오염 |  HIGH  | Panel용 pure accent token adapter; `withAccentOverride`를 Panel render에서 직접 호출하지 않음    |
| R4  | Badge manual CSS를 남긴 채 catalog 규칙을 추가해 CSS cascade source가 이중화               |  HIGH  | P4 manual/generated selector 중복 0 + Preview computed style cross-check                         |
| R5  | dynamic paint를 기존 partial cache에 넣어 selection/state 전환 후 stale 값 유지            |  MED   | paint cache 제거; identity 기반 memo만 허용, 선택 왕복 fixture                                   |
| R6  | complex component subpart 색을 root 3채널로 잘못 표시                                      |  MED   | scope를 root paint capability로 제한, subpart editor는 후속 범위로 명시                          |
| R7  | Style Panel read 단순화가 ADR-187 write/presentation path까지 건드려 drag 성능 회귀        |  HIGH  | P3 write path 변경 금지, P5 action/control RAF와 canonical-write diagnostics gate                |
| R8  | inline/fills/ref/responsive merge 순서가 Canvas와 달라짐                                   |  HIGH  | `useElementStyleContext`/`adaptStyleWithFills` 이후 effective style 입력, ref+breakpoint fixture |

잔존 HIGH 위험 R1/R2/R3/R4/R7/R8은 §8 Gate와 1:1로 연결한다.

HIGH 위험을 별도 ADR로 분리하지 않는 이유는 모두 ADR-912 HC#1~#3의 같은 color consumer seam을
닫는 데서 발생하기 때문이다. Skia owner collapse만 분리하면 Style Panel 중복 owner가 남고, Panel만
분리하면 renderer precedence가 계속 별도 정본으로 남는다. 단 Phase 4 Badge data migration은 독립
커밋으로 분리할 수 있으며 G4 실패 시 Phase 1~3과 섞지 않고 보류한다.

## 8. Gate

| Gate                 | 대응 위험 | 시점      | 통과 조건                                                               | 실패 시 대안                                          |
| -------------------- | --------- | --------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| G0 Inventory         | R2, R8    | Phase 0   | paint production consumer와 merge 경계 전수 목록 확정                   | Phase 1 착수 중단, inventory 재freeze                 |
| G1 Shadow parity     | R1        | Phase 1   | 기존 Skia state matrix와 새 symbolic resolver semantic diff 0           | resolver 입력/출력 축소 후 재설계                     |
| G2 Owner collapse    | R1, R2    | Phase 2   | 색상 상태 선택 production owner 1곳, 컴포넌트 식별 분기 0               | Skia cutover 롤백, shadow 경로 유지                   |
| G3 Accent isolation  | R3        | Phase 3   | sibling/ancestor accent 교차오염 0, light/dark 모두 concrete color 일치 | pure accent adapter만 분리 보강                       |
| G4 Catalog/CSS       | R4        | Phase 4   | Badge manual/generated 중복 0, 3축 시각 일치                            | catalog data 또는 generator capability 보강 후 재검증 |
| G5 Presentation perf | R7        | Phase 5   | drag RAF 0/0, drag canonical write 0, terminal commit 1                 | Panel read cutover와 presentation 변경 분리/후자 롤백 |
| G6 Merge parity      | R8        | Phase 3~5 | inline/ref/responsive/fills 우선순위 Canvas=Panel                       | `useElementStyleContext` input boundary 재검토        |

공통 resolver가 component type별 예외, renderer shape, canonical tree traversal 중 하나를 요구하면
G1 실패로 판정한다. 그런 기능은 paint resolution이 아니라 capability/subpart projection 문제이므로
본 resolver에 흡수하지 않는다.

## 9. 검증 매트릭스

| 컴포넌트/경로   | Props/state                                                               | Catalog | Skia | Preview CSS | Style Panel |
| --------------- | ------------------------------------------------------------------------- | :-----: | :--: | :---------: | :---------: |
| Button          | primary/accent/premium × fill/outline                                     |    ✓    |  ✓   |      ✓      |      ✓      |
| Button          | staticColor auto/black/white                                              |    ✓    |  ✓   |      ✓      |      ✓      |
| Badge           | accent/informative/neutral/positive/notice/negative × bold/subtle/outline |    ✓    |  ✓   |      ✓      |      ✓      |
| ToggleButton    | default/quiet/selected/emphasizedSelected/staticColor                     |    ✓    |  ✓   |      ✓      |      ✓      |
| Card            | unselected/selected + own/ancestor accentColor                            |    ✓    |  ✓   |      ✓      |      ✓      |
| Link            | staticColor auto/black/white, text-only                                   |    ✓    |  ✓   |      ✓      |      ✓      |
| Inline override | background/color/borderColor가 catalog/state보다 우선                     |    ✓    |  ✓   |      ✓      |      ✓      |
| Ref instance    | origin props/style + instance override                                    |    ✓    |  ✓   |      ✓      |      ✓      |
| Responsive      | desktop/tablet/mobile override 왕복                                       |    ✓    |  ✓   |      ✓      |      ✓      |
| Modified Styles | hex/rgb/transparent/`var(--token)` picker seed                            |   N/A   | N/A  |      ✓      |      ✓      |
| Theme           | light/dark + project tint + own/ancestor accent                           |    ✓    |  ✓   |      ✓      |      ✓      |

각 행은 최소한 symbolic resolver 단위 test와 Style Panel hook test를 갖는다. 대표 Button/Badge/
ToggleButton/Card는 실제 Builder 3축 검증까지 수행한다.

## 10. 종료 조건과 잔여 범위

### 완료 조건

- D1~D5 재현 fixture가 모두 GREEN.
- Canvas/Style Panel 색상 상태 선택 production owner가 공통 resolver 1곳.
- `specPresetResolver.resolveCatalogColorPreset`의 partial state 해석 제거.
- Badge fillStyle rule이 catalog SSOT에 있고 manual CSS dual source가 없음.
- 선택 요소/props/theme/accent/breakpoint 변경 후 stale panel color 재현 0.
- ADR-187 presentation/terminal 성능 계약 회귀 0.
- CSS↔Skia↔Style Panel cross-check PASS.

### 명시적 잔여 범위

- progress/meter/slider subpart color editor UX.
- transient hover/pressed/focus state inspector.
- gradient/image/mesh의 resolved visual read model.
- renderer capability가 필요한 multi-child inherited paint projection.

잔여 범위는 본 Phase 실행 중 자동 확장하지 않는다. 사용자 요청이나 독립 재현이 생기면 먼저
현재 resolver의 root paint capability로 표현 가능한지 판정하고, 불가능할 때만 별도 설계 여부를
검토한다.

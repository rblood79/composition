# ADR-168 구현 상세 — Frame Preset 반응형 재구성

> 본 문서는 [ADR-168](../168-frame-preset-responsive-restructure.md) 의 구현 상세다. 결정·위험·Gate 는 ADR 본문에 있고, 여기에는 Phase 분해 / 파일 경계 / 계약 정의만 둔다.

## 1. Fork checkpoint lock-in (adr-writing.md 4질문)

사용자 confirm: 2026-07-26 (AskUserQuestion — "단일 ADR" + "패널 전면 재설계 5건" 선택).

| #   | 질문                       | lock-in                                                                                                                                                                                                            |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | base / 응용 분류           | ADR-154(반응형 인프라, Implemented) = base, 본 ADR = 응용. **단 순수 응용이 아니라 base 의 eligibility 모델 개정을 포함하는 혼합형** — ADR 본문 §Context 에 명시                                                   |
| 2   | schema 직교성              | 직교 아님. `RESPONSIVE_ELIGIBLE_STYLE_PROPS` 확장은 ADR-154 schema 의 specialization → 본 ADR 이 ADR-154 의 후속                                                                                                   |
| 3   | 선행 ADR 전제 reverse      | **전제 무효 확정.** ADR-154 개정 1 의 "eligible ≡ Style 패널 편집 키" 는 _write 주체가 Style 패널 단일_ 이라는 조건부 전제였다. 프리셋이 두 번째 write 주체가 되면 "편집 UI 유무" 와 "BP 별 가변 필요" 가 분리된다 |
| 4   | codex 3차까지 미루지 말 것 | fork 시점(2026-07-26)에 1–3 통과 후 착수                                                                                                                                                                           |

차단 카테고리 확인: `no-derived-adr-mid-execution` 해당 없음 (진행 중 ADR 실행 없음 + 사용자 제안). `adr-consolidation-burden-not-essence` 에 따라 ADR 사유를 "변경량" 이 아니라 **전제 개정 + shared SSOT 변경** 으로 고정.

## 2. Phase 0 — 실측 inventory (freeze)

착수 전 아래를 문서화해 추정 vs 실측 gap 을 선차단한다 (adr-writing.md M3).

### 2-1. 현행 9 프리셋 × 3 BP 계산 결과

컨테이너 정의값 기준 산출. mobile 390 / tablet 768.

| 프리셋            | 컨테이너 정의     | tablet 768 콘텐츠 | mobile 390 결과     | 판정 |
| ----------------- | ----------------- | ----------------- | ------------------- | ---- |
| fullscreen        | `flex`            | 가변              | 가변                | 정상 |
| vertical-2        | `flex column`     | 가변              | 가변                | 정상 |
| vertical-3        | `flex column`     | 가변              | 가변                | 정상 |
| sidebar-left      | `row` + 250px     | 518               | 콘텐츠 140          | 결함 |
| sidebar-right     | `row` + 250px     | 518               | 콘텐츠 140          | 결함 |
| holy-grail        | `200px 1fr 200px` | 368               | 고정폭 합 400 > 390 | 결함 |
| complex-3col      | `1fr 2fr 1fr`     | 384               | 좌우 97             | 결함 |
| dashboard         | `240px 1fr`       | 528               | 콘텐츠 150          | 결함 |
| dashboard-widgets | `200px 1fr 280px` | 288               | 고정폭 합 480 > 390 | 결함 |

**9개 중 6개 결함, 1개(dashboard-widgets) tablet 도 압박.**

### 2-2. 패널 결함 인벤토리

| ID  | 위치                                          | 내용                                                                                             | 유형      |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------- |
| P-1 | `presetDefinitions.ts` `previewAreas`         | 썸네일 좌표가 실제 레이아웃과 별개 소스 (9벌 손좌표, BP 도입 시 27벌)                            | 구조      |
| P-2 | `PresetPreview.tsx` 10곳                      | 원시 토큰 직접 사용 (`--color-primary-*`/`--color-gray-*`/`--color-white`) → **다크모드 미추종** | 결함      |
| P-3 | `styles.css` 5곳                              | 원시 토큰 직접 사용 (`--color-warning-*`)                                                        | 규칙 위반 |
| P-4 | `index.tsx:65`                                | `groups` 카테고리 4개 하드코딩 → 신규 카테고리 시 `groups[category].push` undefined 접근         | 크래시원  |
| P-5 | `PRESET_CATEGORIES[].icon` ↔ `CATEGORY_ICONS` | 아이콘 2곳 중복 정의, 문자열 필드는 소비자 0 (dead)                                              | 중복      |
| P-6 | `styles.css:12`                               | `.layout-preset-selector` 조상이 DOM 부재 → dead 블록 (내용이 base 와 동일해 **시각 영향 0**)    | 정리      |
| P-7 | 패널 전반                                     | 적용 전 BP 별 결과 확인 UI 부재                                                                  | 신규      |

### 2-3. 인프라 실측 (착수 근거)

| 확인 항목                                      | 위치                                | 결과                                                       |
| ---------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `responsive` 가 canonical 1차 필드             | `composition-document.types.ts:658` | ✅ `CanonicalNode.responsive`                              |
| element → canonical 변환이 `responsive` 보존   | `canonicalMutations.ts:723-731`     | ✅ 신규 슬롯 노드에 실어 보내면 통과                       |
| BP 전환이 레이아웃 캐시 miss 유발              | `useLayoutPublisher.ts:140-151`     | ✅ resolved 노드로 시그니처 계산                           |
| `display` 변경 → 엔진 full rebuild             | `fullTreeLayout.ts:2429`            | ✅ `prevParsed.display !== curDisplay`                     |
| publish CSS 가 responsive → `@media` 생성      | `responsiveCss.ts:101-121`          | ✅ 단 `isResponsiveEligibleStyleProp` 필터 통과 키만       |
| ResponsiveSection picker 가 eligible 전수 순회 | `ResponsiveSection.tsx:43-46`       | ✅ **순회 안 함** (자체 목록) → grid 키 추가해도 UI 미노출 |
| grid 키 eligibility                            | `responsive.types.ts:128-163`       | ❌ 7키 전부 미등재 — Phase 1 대상                          |
| body top-level 필드 write 경로                 | `elements.ts:194`                   | ✅ `updateElement(id, Partial<Element>)`                   |

## 3. Phase 1 — 반응형 eligibility 확장 + guard 2분할 ✅ Implemented 2026-07-26

**대상**: `packages/shared/src/types/responsive.types.ts`, `apps/builder/.../responsiveEligible.static.test.ts`, `apps/builder/src/builder/stores/responsiveWriteRouting.test.ts`, `layoutCache.ts`

### 3-1. 집합 2분할

```ts
/** Style 패널 Layout·Transform 섹션이 편집하는 키 (사용자 직접 편집 축) */
const SECTION_EDITABLE_RESPONSIVE_PROPS = [...기존 32개];

/**
 * 프리셋만 authoring 하는 키 — 편집 UI 없음, 프리셋 정의가 유일 write 주체.
 * ADR-154 개정 1 은 "eligible ≡ 섹션 편집 키" 였으나, 이는 write 주체가 Style 패널
 * 단일이라는 조건부 전제였다. 프리셋이 두 번째 write 주체가 되면서 "편집 UI 유무" 와
 * "breakpoint 별 가변 필요" 가 분리된다 (ADR-168).
 */
export const PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS: ReadonlySet<string> = new Set([
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
]);

export const RESPONSIVE_ELIGIBLE_STYLE_PROPS: ReadonlySet<string> = new Set([
  ...SECTION_EDITABLE_RESPONSIVE_PROPS,
  ...PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS,
]);
```

`gridArea`(shorthand)는 집합에서 **제외**한다 — 리뷰 round 1 M3. `responsiveCss.ts:106` 은 `Object.keys` 순서로 emit 하고 모든 선언이 `!important` 동일 특정도라 **source order 가 승자를 정하므로**, 같은 BP 에서 shorthand 와 longhand 를 함께 override 하면 뒤에 온 shorthand 가 longhand 를 리셋한다. 초안은 “대칭·future-proofing” 사유로 포함했으나 그건 도달 가능한 결함 경로만 여는 선택이라 YAGNI 로 배제한다. shorthand override 가 필요해지면 그때 순서 계약과 함께 도입한다.

### 3-2. Guard 재구성 (보호 범위 불변)

`responsiveEligible.static.test.ts` 를 단언 2개로 분리한다. 기존 단일 단언의 보호 강도를 유지하면서 차집합의 근거를 명시하는 형태:

| 단언                                                | 의미                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `LAYOUT_PROPS ∪ TRANSFORM_PROPS ≡ SECTION_EDITABLE` | 기존 정확 일치 — 섹션 편집 필드 추가 시 조용한 전역 write 차단 |
| `ELIGIBLE ∖ SECTION_EDITABLE ≡ PRESET_AUTHORED`     | 차집합이 명시 선언과 정확히 일치 — 임의 키 추가 차단           |

두 단언의 논리곱은 원래 단언보다 약하지 않다: 어떤 키도 명시 선언 없이 eligible 이 될 수 없다.

### 3-3. seed 테스트 대상 축소

`responsiveWriteRouting.test.ts:107` 이 `RESPONSIVE_ELIGIBLE_STYLE_PROPS` 전수에 non-empty seed 를 요구한다. seed 는 ResponsiveSection 의 "Add override" 토글 전용이므로, 순회 대상을 `SECTION_EDITABLE_RESPONSIVE_PROPS` 로 좁힌다. **보호 축소가 아니라 원래 목적과의 정렬** — preset-authored 키는 토글 대상이 아니라 seed 가 성립하지 않는다.

### 3-4. `LAYOUT_STYLE_KEYS` 보강

`layoutCache.ts` 에 3키 추가: `gridColumnEnd`, `gridRowEnd`, `gridTemplateAreas`.

현행은 Start 계열과 cols/rows 템플릿만 등재돼, tablet override 가 End 만 바꾸는 경우 시그니처 불변 → 캐시 히트로 흡수된다 (ADR-156 R6 과 동형 결함).

### 3-5. `UNITLESS_PROPS` 에 grid line longhand 4키 추가 (R7 — 리뷰 round 1 M1)

`packages/shared/src/utils/responsiveCss.ts:45-56` 의 `UNITLESS_PROPS` 는 `gridColumn`/`gridRow` **shorthand** 만 담고 있다. `formatCssValue`(`:67-71`)가 숫자 값에 `px` 를 부착하므로 `gridColumnStart: 1` 같은 숫자 authoring 이 `grid-column-start:1px !important` 로 emit 되어 **선언이 무효화**된다 → DOM 은 auto-placement / Skia 는 numeric line 으로 정상 배치 → **배포 산출물에서 DOM↔Skia 발산**.

`gridColumnStart` / `gridColumnEnd` / `gridRowStart` / `gridRowEnd` 4키를 `UNITLESS_PROPS` 에 추가한다. `gridSlot()` 이 `String(...)` 으로 문자열화해 현행 authoring 은 우연히 안전하지만, `CSSProperties` 가 `string | number` 를 허용하고 **base inline(React auto-unit)은 숫자도 정상 처리**하므로 base↔override 비대칭을 남기면 안 된다. `overflow`/`overflowX`(ADR-156 R6)와 동형 결함.

### 3-6. 실행 중 확인된 사항 (Phase 1 실측)

| 발견                                                                                                                                                                                                                                 | 대응                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearNonEligibleResponsiveOverrides`(`stores/utils/globalStyleProps.ts:31`)가 **non-eligible 키를 responsive override 에서 삭제**한다. eligibility 확장 전이었다면 프리셋이 쓴 grid override 가 이후 스타일 편집 때 조용히 지워졌다 | 확장이 필수 전제임이 확증됨 — 대안 C(프리셋 밖 별도 반응형 시스템)가 이 경로와 충돌한다는 추가 근거                                                |
| `ResponsiveStyles` 인터페이스에 grid 7키 미선언 → 저장 형태 리터럴이 TS 거부                                                                                                                                                         | 인터페이스에 `gridTemplateAreas`/`gridColumnStart`/`End`/`gridRowStart`/`End` 선언 추가 (`gridArea` 는 의도적 미선언 — M3)                         |
| **`@composition/shared#test` 가 실행 불가** — 해당 패키지에 vitest 미설치로 `turbo run test` 에서 MODULE_NOT_FOUND. `packages/shared/src/**` 의 테스트가 전부 미실행                                                                 | R7 가드가 죽지 않도록 builder 스위트에 동등 계약 파일 신설(`responsiveEmit.contract.test.ts`). shared 러너 복구는 ADR-168 범위 밖 — 별도 판단 대상 |
| `__tests__/responsiveCss.test.ts` 의 "unitless (order)" 테스트가 **선행 실패** (HEAD 에서도 동일). ADR-154 개정 1 이 `order` 를 eligible 에서 제외했으나 테스트가 남음                                                               | ADR-168 이 유발한 회귀 아님(`git show HEAD` 로 확증). ADR-154 debt 이라 본 ADR 에서 손대지 않음 — §9 의 `order` 이연 항목과 같은 사유              |

## 4. Phase 2 — 프리셋 정의 구조 전환 ✅ Implemented 2026-07-26

**대상**: `LayoutPresetSelector/types.ts`, `presetDefinitions.ts`, `presetStyle.ts`, `usePresetApply.ts` (+ 신규 `presetResponsive.ts`, `derivePreviewAreas.ts`)

### 4-1. 타입 확장

```ts
/** desktop 은 base(defaultStyle/containerStyle)가 담당 — 여기엔 override 만 */
export type ResponsiveStyleSet = {
  tablet?: CSSProperties;
  mobile?: CSSProperties;
};

export interface SlotDefinition {
  name: string;
  required: boolean;
  description?: string;
  defaultStyle?: CSSProperties;
  responsiveStyle?: ResponsiveStyleSet; // 신규
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory; // 신규 union (하드코딩 제거)
  slots: SlotDefinition[];
  containerStyle?: CSSProperties;
  responsiveContainerStyle?: ResponsiveStyleSet; // 신규
  // previewAreas 제거 — Phase 4 에서 파생으로 대체
}
```

### 4-2. 전치 helper (신규 `presetResponsive.ts`)

프리셋 정의는 **BP → 스타일** 형태(작성 편의), 저장 형식은 **키 → BP** 형태(`ResponsiveValue<T>`)다. 순수 함수로 전치한다.

```
{ tablet: { width: 200 }, mobile: { width: "100%" } }
  → { width: { tablet: 200, mobile: "100%" } }
```

`toResponsiveConfig(set: ResponsiveStyleSet): ElementResponsiveConfig | undefined`
— 빈 결과는 `undefined` 반환 (canonical 이 빈 config 를 생략 취급하므로 동형).

### 4-3. 프리셋 소유 키 정리 확장 (R1 대응)

`stripPresetContainerStyle` 은 base 만 정리한다. 프리셋 교체 시 이전 프리셋의 **responsive override 가 남으면 비멱등**이 되므로 같은 키 집합으로 responsive 도 정리한다.

```ts
/** base 와 responsive 양쪽에서 프리셋 소유 키를 걷어낸다 */
export function stripPresetResponsive(
  responsive: ElementResponsiveConfig | undefined,
): ElementResponsiveConfig | undefined;
```

정리 대상 키 = `PRESET_OWNED_CONTAINER_KEYS` ∪ `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS`. **base 와 responsive 의 정리 대상이 같은 상수에서 파생**되어야 한다 — 갈리면 한쪽만 남는 잔존이 재발한다.

### 4-4. `usePresetApply` write 경로

Step 4(body) / Step 5(slot) 를 아래로 바꾼다.

| 대상 | 현행                                               | 변경                                                                          |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| body | `updateElementProps(id, { style, appliedPreset })` | `updateElement(id, { props: {...}, responsive })` — top-level 필드 동반 write |
| slot | 노드에 `props.style` 만                            | 노드에 `responsive` 필드 동반 (canonicalMutations 가 보존 — Phase 0 확인)     |

`PresetSlotElement` 타입에 `responsive?: ElementResponsiveConfig` 추가.

### 4-5. 실행 중 확정된 사항 (Phase 2 실측)

| 항목                                                                                                                                                                                                      | 결정                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| body write 를 `updateElement` **단일 호출**로 통합하려 했으나, `updateElement` 는 props 를 **전체 교체**한다 (`elementUpdate.ts:547-548` 주석 명시)                                                       | props 는 `updateElementProps`(merge + history) 유지, `responsive` 만 `updateElement` 로 분리 송신. 두 호출은 순차 await (memory: `feedback-canonical-multi-mutation-await-sequential`)                                        |
| `PRESET_RESPONSIVE_OWNED_KEYS` 에 base 컨테이너 키를 그대로 합치면 `gridAutoFlow`/`gridAutoColumns`/`gridAutoRows` 가 포함되는데 **셋 다 eligible 이 아니다**                                             | base 키를 `isResponsiveEligibleStyleProp` 로 걸러 합집합. eligible 이 아니면 responsive 에 저장될 수 없으니 정리 대상도 아니다 — 테스트가 이 불일치를 잡았다                                                                  |
| **residual — undo 비대칭**: `updateElement` 는 `sanitizedUpdates.props` 가 있을 때만 history 를 기록한다(`elementUpdate.ts:542-543`). 최상위 `responsive` 만 보내는 호출은 history entry 를 남기지 않는다 | 프리셋 적용은 이미 다중 entry(슬롯 batch + props)라 undo 가 단일 원자가 아니다. props undo 후 responsive 가 남는 경우가 생기는데, Phase 5 에서 실측 후 필요하면 `recordUpdateHistoryEntry` 확장 여부를 판정한다 (본 ADR 범위) |

Phase 2 live 실측 (localhost:5173, Frame 1): `vertical-2` → `holy-grail` → `vertical-2` 왕복 후 body `props.style` 의 grid 키 **잔존 0**, `responsive` 는 시종 `null`(반응형 정의가 아직 없으므로 정상 — 빈 config 를 싣지 않는다), 슬롯 2↔5 정상 교체, 콘솔 오류 0.

## 5. Phase 3 — 카탈로그 재구성

**대상**: `presetDefinitions.ts`, `presetDefinitions.static.test.ts`

### 5-1. 카테고리 재편

| 카테고리   | 라벨       | 프리셋                               |
| ---------- | ---------- | ------------------------------------ |
| basic      | 기본       | fullscreen / vertical-2 / vertical-3 |
| navigation | 네비게이션 | sidebar-left / sidebar-right         |
| list       | 목록-상세  | **list-detail** (신규)               |
| feed       | 피드       | **feed** (신규)                      |
| complex    | 복합       | holy-grail (complex-3col **삭제**)   |
| dashboard  | 대시보드   | dashboard / dashboard-widgets        |

기존 `sidebar` → `navigation` 리네임. 총 9 → 10.

### 5-2. 프리셋별 3-BP 계약

`—` = 상위 BP 상속(cascade). 모든 그리드 슬롯은 base 에 `minHeight: 60` 과 (content 계열은) `flex: 1` 을 **병기**한다 — grid 모드에서 `flex` 는 무시되고 flex 모드에서 grid line 이 무시되므로, mobile override 가 컨테이너 한 줄로 끝난다.

| 프리셋            | desktop (base)                                                             | tablet override                                                         | mobile override                                         |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| fullscreen        | `flex`                                                                     | —                                                                       | —                                                       |
| vertical-2 / -3   | `flex column`                                                              | —                                                                       | —                                                       |
| sidebar-left      | `flex row` / sidebar `250px` shrink0 minH60 / content `flex:1` minH60      | sidebar `width:200px`                                                   | container `flexDirection:column` + sidebar `width:100%` |
| sidebar-right     | 동일 (DOM 순서 content→sidebar)                                            | sidebar `width:200px`                                                   | 동일                                                    |
| list-detail       | `flex row` / list `320px` shrink0 minH120 / detail `flex:1` minH60         | list `width:260px`                                                      | container `column` + list `width:100%`                  |
| feed              | `flex column` / header band60 / feed grid `1fr 1fr 1fr 1fr` gap16 `flex:1` | feed `gridTemplateColumns:"1fr 1fr"`                                    | feed `gridTemplateColumns:"1fr"`                        |
| holy-grail        | grid `200px 1fr 200px` / `auto 1fr auto`                                   | cols `160px 1fr 160px`                                                  | container `display:flex` + `column`                     |
| dashboard         | grid `240px 1fr` / `auto 1fr`                                              | cols `200px 1fr`                                                        | container `display:flex` + `column`                     |
| dashboard-widgets | grid `200px 1fr 280px` / `auto 1fr`                                        | cols `200px 1fr`, rows `auto 1fr auto`, areas 재정의, widgets 하단 전폭 | container `display:flex` + `column`                     |

검산 (tablet 768 / mobile 390):

| 프리셋            | tablet 콘텐츠 | mobile |
| ----------------- | ------------- | ------ |
| sidebar-\*        | 568           | 390    |
| list-detail       | 508           | 390    |
| holy-grail        | 448           | 390    |
| dashboard         | 568           | 390    |
| dashboard-widgets | 568           | 390    |

**고정폭 합이 BP 폭을 넘는 조합 0건.**

#### 계약 — item placement override 는 컨테이너 템플릿 override 를 동반한다 (R8, 리뷰 round 1 M2)

`GRID_REBUILD_TRIGGER_KEYS`(`fullTreeLayout.ts:503-524`)는 grid **컨테이너** 키 20개만 담고 있고, 그 검사 자체가 `isGridDisplay(curDisplay)` 게이트(`:2437`) 안에 있다. 따라서 grid **item** 의 `gridColumnStart/End`·`gridRowStart/End` 만 바뀌면 item 은 grid 컨테이너가 아니라 게이트를 통과하지 못하고 `updateStyleRaw` 증분으로 처리된다 — 바로 위 주석(`:2433-2436`)이 `updateStyleRaw` 의 grid placement 캐시 무효화 실패를 명시한다. 즉 **조용히 무반영**된다.

현재 item placement 를 바꾸는 유일한 프리셋(`dashboard-widgets` tablet)은 컨테이너 템플릿도 함께 바꿔서 full rebuild 가 걸린다 — **우연한 결합**이다. 이를 계약으로 고정한다:

> 어떤 프리셋의 어떤 BP override 가 슬롯의 grid placement 키를 포함하면, 같은 BP 의 `responsiveContainerStyle` 이 `gridTemplateColumns` / `gridTemplateRows` / `gridTemplateAreas` 중 최소 1개를 포함해야 한다.

`presetDefinitions.static.test.ts` 가 이를 단언한다(G8). 계약이 부담이 되면 대안은 `GRID_REBUILD_TRIGGER_KEYS` 검사를 item 축까지 확장하는 것이며, 그때는 엔진 rebuild 빈도 증가를 함께 측정한다.

### 5-3. grid 함수 표현 회피 (R4)

`repeat()` / `minmax()` **미사용**. 2026-07-25 실측에서 `minmax(60px, auto)` 가 슬롯 폭 1920 / header 570 같은 비정상값을 냈다. 트랙을 명시 나열한다 (`"1fr 1fr 1fr 1fr"`).

### 5-4. complex-3col 삭제 영향

기존 프레임의 body `props.style` 에는 grid 정의가 이미 저장돼 있어 **레이아웃은 그대로 유지**된다. `LAYOUT_PRESETS["complex-3col"]` 부재 → `currentPresetKey` 가 `null` → "적용됨" 배지만 사라진다. 파괴적 변경 아님. dev 단계라 BC migration 미수행 (memory: `feedback-dev-stage-no-bc-migration`).

## 6. Phase 4 — 패널 재설계

**대상**: `PresetPreview.tsx`, `index.tsx`, `styles.css` (+ 신규 `derivePreviewAreas.ts`, `BreakpointPreviewTabs.tsx`)

### 6-1. 썸네일 파생 (P-1)

`derivePreviewAreas(preset, breakpoint): PreviewArea[]` 순수 함수 신설. `previewAreas` 수동 배열은 **폐지**.

기준 폭 상수:

```ts
/** px 트랙을 % 로 환산할 때 쓰는 BP 별 기준 폭. BREAKPOINTS.minWidth 는 mobile 이 0 이라 직접 못 씀 */
const PREVIEW_REFERENCE_WIDTH = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
} as const;
```

파생 규칙:

| 컨테이너    | 산출                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| grid        | 트랙 목록을 파싱해 px 는 리터럴, `fr` 은 잔여 비례 배분 → 누적합으로 각 슬롯의 `gridColumnStart/End`·`gridRowStart/End` 를 % 사각형으로 환산 |
| flex row    | 고정폭(`width`) 슬롯은 리터럴, `flex` 슬롯이 잔여 분배. 교차축 100%                                                                          |
| flex column | 밴드(`minHeight`)는 리터럴, `flex` 슬롯이 잔여 분배. 교차축 100%                                                                             |

이 함수는 **레이아웃 계약의 두 번째 소비자**가 되므로 Phase 5 live 실측과 대조 가능하다 (썸네일 ↔ 실제 렌더 비율 일치).

### 6-2. 토큰 시맨틱 전환 (P-2 / P-3)

| 현행                                       | 전환                                 |
| ------------------------------------------ | ------------------------------------ |
| `--color-primary-200` (선택 슬롯 배경)     | `--accent-subtle`                    |
| `--color-primary-100` (required 슬롯 배경) | `--accent-subtle`                    |
| `--color-primary-500/600` (선택 테두리/\*) | `--accent`                           |
| `--color-gray-100/50` (일반 슬롯 배경)     | `--bg-muted` / `--bg-inset`          |
| `--color-gray-300/200` (테두리)            | `--border`                           |
| `--color-gray-600` (슬롯 이름)             | `--fg-muted`                         |
| `--color-white` (SVG 배경)                 | `--bg-overlay`                       |
| `--color-warning-*` (styles.css)           | `--notice-subtle` / `--fg-on-notice` |

**다크모드 결함 해소가 목적**이므로 light/dark 양쪽 실측이 Gate.

### 6-3. 카테고리 하드코딩·중복 제거 (P-4 / P-5)

- `presetsByCategory` 초기값을 `Object.keys(PRESET_CATEGORIES)` 에서 생성 → 신규 카테고리 자동 반영, undefined 접근 소멸
- 아이콘 SSOT 를 `PRESET_CATEGORIES[x].icon`(문자열) 로 단일화하고 `index.tsx CATEGORY_ICONS` 는 문자열 → 컴포넌트 조회 맵으로 축소. 카테고리 추가 시 수정 지점 1곳

### 6-4. breakpoint 미리보기 UI (P-7, 신규)

프리셋 카드 상단에 `desktop / tablet / mobile` 세그먼트를 두고, 선택된 BP 기준으로 `derivePreviewAreas` 결과를 그린다. 적용 전에 3 BP 결과를 볼 수 있게 한다.

구조는 `panel-structure.md` 표준 준수: `.section-content` 는 1열 세로 스택 유지, 세그먼트는 고유 클래스(`preset-breakpoint-tabs`). **`tab-*` 예약 prefix 사용 금지** — 탭 UI 가 아니라 미리보기 전환 세그먼트다.

### 6-5. dead CSS 정리 (P-6)

`styles.css:12-14` 의 `.layout-preset-selector .list-group` 제거. 내용이 `list-group.css:15` 기본값과 동일해 시각 영향 0 — 회귀 위험 없음.

## 7. Phase 5 — live 검증

| 항목                                                            | 방법                                              |
| --------------------------------------------------------------- | ------------------------------------------------- |
| 10 프리셋 × 3 BP = **30 조합** 실측                             | Chrome MCP — 슬롯 bounds 수집 후 계약 대조        |
| 고정폭 합 > 뷰포트 0건 / 콘텐츠 슬롯 폭·높이 0 없음             | 30 조합 전수                                      |
| 프리셋 A→B→A 교체 후 `style`+`responsive` 가 A 최초 상태와 동일 | 멱등 실측 (R1)                                    |
| 썸네일 비율 ↔ 실제 렌더 비율 일치                               | `derivePreviewAreas` 결과 vs 실측 bounds          |
| 다크모드 썸네일                                                 | light/dark 양쪽 스크린샷                          |
| publish CSS `@media` 생성                                       | export 산출물 grep                                |
| grid line 을 숫자로 authoring 해도 유효 CSS (`1px` 아님, R7)    | 정의를 숫자로 임시 치환 후 export CSS 검사        |
| 해당 BP 의 DOM 배치 ↔ Skia 배치 일치 (R7)                       | tablet 슬롯 bounds 를 Preview DOM·Skia 대조       |
| item placement override ⊆ 컨테이너 템플릿 동반 (R8)             | `presetDefinitions.static.test.ts` 정적 단언 (G8) |

## 8. 파일 변경 인벤토리

| Phase | 파일                                                                 | 변경 |
| ----- | -------------------------------------------------------------------- | ---- |
| 1     | `packages/shared/src/types/responsive.types.ts`                      | 수정 |
| 1     | `apps/builder/.../styles/sections/responsiveEligible.static.test.ts` | 수정 |
| 1     | `apps/builder/src/builder/stores/responsiveWriteRouting.test.ts`     | 수정 |
| 1     | `apps/builder/.../canvas/scene/layoutCache.ts`                       | 수정 |
| 1     | `packages/shared/src/utils/responsiveCss.ts` (R7 — UNITLESS_PROPS)   | 수정 |
| 1     | `apps/builder/.../styles/sections/responsiveEmit.contract.test.ts`   | 신규 |
| 2     | `.../LayoutPresetSelector/types.ts`                                  | 수정 |
| 2     | `.../LayoutPresetSelector/presetResponsive.ts`                       | 신규 |
| 2     | `.../LayoutPresetSelector/presetStyle.ts`                            | 수정 |
| 2     | `.../LayoutPresetSelector/usePresetApply.ts`                         | 수정 |
| 3     | `.../LayoutPresetSelector/presetDefinitions.ts`                      | 수정 |
| 3     | `.../LayoutPresetSelector/presetDefinitions.static.test.ts`          | 수정 |
| 4     | `.../LayoutPresetSelector/derivePreviewAreas.ts`                     | 신규 |
| 4     | `.../LayoutPresetSelector/PresetPreview.tsx`                         | 수정 |
| 4     | `.../LayoutPresetSelector/BreakpointPreviewTabs.tsx`                 | 신규 |
| 4     | `.../LayoutPresetSelector/index.tsx`                                 | 수정 |
| 4     | `.../LayoutPresetSelector/styles.css`                                | 수정 |
| 5     | `docs/CHANGELOG.md`, ADR 본문 / 본 문서                              | 수정 |

**추정 18 파일** (신규 4 / 수정 14 — 리뷰 round 1 에서 `responsiveCss.ts`, Phase 1 실행에서 `responsiveEmit.contract.test.ts` 추가). Phase 실행 중 1.5배(24 파일) 초과 시 Phase 0 inventory 보강 커밋으로 흡수 — 새 ADR fork 사유 아님 (adr-writing.md M3).

## 9. 미지원 / 이연 경계

착수 시점에 **의도적으로 하지 않는 것**을 명시한다. 재개 조건이 없으면 다시 논의 대상이 아니다.

| 항목                             | 사유                                                                                                                               | 재개 조건                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Style 패널 grid 편집 UI          | 본 ADR 은 프리셋 authoring 축만 연다. grid 편집 UI 는 독립 기능이며 eligibility 확장과 결합 불필요                                 | 사용자가 grid 직접 편집 요구                                                  |
| list-detail 의 "한 번에 한 pane" | M3 는 compact 에서 pane 전환(런타임 상태)을 쓰지만 정적 레이아웃 빌더의 등가물은 세로 스택. 런타임 상태 도입은 별도 영역           | Interactions(ADR-158) 로 pane 전환 표현 가능 시                               |
| `repeat()` / `minmax()` 트랙     | 엔진 신뢰도 미확인 (2026-07-25 실측 비정상)                                                                                        | 엔진 grid 함수 표현 fixture 통과                                              |
| breakpoint 정의 자체 변경        | 3단계(desktop/tablet/mobile)는 ADR-154 확정. M3 5단계 도입은 본 ADR 범위 밖                                                        | 사용자 요구 또는 ADR-154 개정                                                 |
| `order` eligibility              | 현행 프리셋 전부 DOM 순서 스택으로 충분 (사이드바 위/콘텐츠 아래 = 웹 관례)                                                        | 역순 스택이 필요한 프리셋 등장                                                |
| `gridArea` shorthand eligibility | shorthand ↔ longhand 가 같은 BP 에서 override 되면 `!important` 동일 특정도라 emit source order 가 승자를 정한다 (리뷰 round 1 M3) | shorthand override 실사용 필요 + 전치 helper 에 shorthand-먼저 순서 계약 도입 |

## 10. 참조

- [ADR-168 본문](../168-frame-preset-responsive-restructure.md)
- [ADR-154](../completed/154-responsive-breakpoint-authoring.md) — 반응형 인프라 (base, 본 ADR 이 개정)
- [ADR-156](../completed/156-engine-css-parity-alignment-margin.md) — `LAYOUT_STYLE_KEYS` 미등재 결함 선례 (R6)
- [ADR-163](../completed/163-builder-panel-structure-standardization.md) — 빌더 패널 표준 구조
- `.claude/rules/layout-engine.md` §"5-심볼 2계층 체인", §"Grid area 이름 해석"
- `.claude/rules/css-tokens.md` §"시맨틱 변수 네이밍 규칙"
- `.claude/rules/panel-structure.md` §"클래스 네이밍 규칙"

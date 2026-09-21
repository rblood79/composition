# ADR-230 설계 breakdown — 기본 요소의 상태별 origin 분해

> 본문: [230](../230-base-element-state-variant-origins.md). 구현 상세 (Phase · 파일 변경표 · 게이트 실행 기록) 는 이 파일에만 둔다.

## 1. 전제 lock-in (fork 4 질문)

사용자 확정 기록: AskUserQuestion 2026-09-21 (ADR-229 Phase 3 뒤) — "229 종결 후 새 ADR" · "상태별 별도 origin (Tag/Selected 패턴)". ADR-229 Consequences "후속 후보" 1번 + 메모리 `project-components-page-state-variant-origins-2026-09`. 전제 확정 종결 계약 성립 — 재질문 금지 (재개 조건 = 사용자 재제기 · scope 변경 · 의존 반전 코드 증거).

1. **base / 응용**: ADR-228 (origin 전집) · 229 (조합 = origin instance) 가 base, 이 ADR 은 그 위의 **상태 축 응용** — 둘 다 Implemented 라 prerequisite 충족.
2. **schema 직교성**: canonical 스키마 변경 0 — `metadata.variant` (기존) + `metadata.variantOf` (metadata 자유 필드) 만. 227 (테마 토큰 세트) 과 직교 (origin style 은 토큰 참조값을 담는다).
3. **선행 전제 reverse 검증**: 229 의 "조합은 ref 로 상속" 이 이 ADR 의 근거 (상태 origin 은 leaf 에만) — 방향 그대로. ADR-150 A1 철회 (캔버스 interaction 재현 금지) 도 그대로 승계 (Phase 2 는 Preview 만).
4. **codex 1차 진입**: 본문 작성 완료 후 `/review-adr 230`.

## 2. 코드 사실 inventory (2026-09-21, main `f54a857d1` — Phase 0 에서 경로:라인으로 freeze)

| ID  | 사실                                                                                                                                                                                                                                                                    | 경로                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| F1  | 상태 스타일 정본 = catalog rule `variants[v].fill.default.{base,hover,pressed,selected}` (hover 270 · pressed 256 · selected 16) + `states.disabled.opacity` (107)                                                                                                      | `packages/shared/src/catalog/generated/componentRulesTable.ts`                                  |
| F2  | DOM 소비 = 생성 CSS `&[data-hovered]` / `[data-pressed]` / `[data-selected]` / `[data-emphasized][data-selected]` · quiet 변형 · `[data-focus-visible]`                                                                                                                 | `packages/specs/src/renderers/CSSGenerator.ts:345 · 359 · 370 · 424 · 515 · 1223 · 1266 · 1283` |
| F3  | Skia 소비 = 선언적 상태만 — `isSelected` (`buildCatalogShapes.ts:147 · 174`) · `isDisabled` (`skiaPrimitives.ts:812 · 957 · 967`, `buildSpecNodeData.ts:1805-1810` — Breadcrumb 마지막 항목은 disabled 평탄화 예외 `:1797`)                                             | 좌동                                                                                            |
| F4  | 캔버스 hover/pressed 재현은 ADR-150 A1 (2026-07-20) 철회 — D1 소관, 커밋 4건 revert `5e635ebbc`; 선언적 상태 (selected/disabled) 시각은 보존                                                                                                                            | `docs/adr/150-*.md` · README                                                                    |
| F5  | 변형 origin 선례: `metadata.variant === "selected"` → host `slot[1]` (`resolveListBoxSelectedOriginId` · `resolveTagTemplateOriginIds`) · selected origin `props.style`·`fills` 를 default 위 overlay (Skia 행/chip) · DOM `chipStyle(isSelected)` / `listBoxRowStyles` | `canvasSceneNode.ts:606-697 · 965-990` · `preview/App.tsx:341 · 412` · `TagGroup.tsx:117-133`   |
| F6  | instance 해소 = ref 1 → master 1 (`resolveCanonicalRefElement` `mergePropsWithStyleDeep`) — 두 번째 origin 조회 없음. `lookupMaster` 는 id map O(1) + memo                                                                                                              | `adapters/canonical/canonicalRefResolution.ts:175-246 · 918-982`                                |
| F7  | 상태 prop 계약: `isDisabled` 45 binding · `isSelected` 5 (Card · Checkbox · Radio · Switch · ToggleButton)                                                                                                                                                              | `packages/shared/src/catalog/bindings/*.binding.ts`                                             |
| F8  | 팔레트 reusable 57 = `PALETTE_REUSABLE_ORIGIN_TYPES` 52 + 손 seed 5 · Components body flex-wrap grid gap 24                                                                                                                                                             | `componentCatalog.ts:1227-1296` · `systemComponentsPage.ts:49-52`                               |
| F9  | RAC 내부 sub-part = parent delegation (`DELEGATED_SUBPART_CHILD_TOKENS` FieldError/Label/Input/DateInput · `SELF_COMPOSED_LABEL_PARENTS`) — DOM 이 canonical 자식을 읽지 않는다                                                                                         | `catalog/resolvers/resolveDelegatedChildFontSize.ts:115-154 · 204-213`                          |
| F10 | slot host policy: 변형 판정 `metadata.variant === "selected"` 또는 표준 id (`isTagItemSelectedVariant`) · Slot 절 "+" 의 뜻은 host 별 (`resolveSlotInsertAction`)                                                                                                       | `components/slotHostPolicy.ts:130-200`                                                          |
| F11 | Preview 문서별 CSS 주입 채널 — **Phase 0 확정 항목** (현재 알려진 것: Preview `index.css` 정적 · 컴포넌트 CSS 번들 한 채널, `<style>` 동적 주입 지점은 미확인)                                                                                                          | `apps/builder/src/preview/App.tsx` · `preview.html`                                             |
| F12 | 229 의 `diffSubtree` 규칙 (자식 수/type 일치 · 예약 키 · path 별 patch) — 변형 origin subtree 검증에 재사용                                                                                                                                                             | `components/originChildRefs.ts`                                                                 |

Phase 0 추가 확정: 기본 요소 집합 (후보 Button · ToggleButton · Link · Checkbox · Radio · Switch · Tab · MenuItem · GridListItem + ListBoxItem/Tag `--disabled`) · 예상 Δnode/Δbyte (228 실측 205 B/노드) · 두 leg 상태 조합 매트릭스 (selected×disabled · selected×hover/pressed · disabled×hover · 조상 selected · instance 명시 override) · Breadcrumb 류 예외 표.

### 리뷰 반증 (h1/m2/m3) — Phase 0 재현 (2026-09-21, HEAD `2645fc86e`)

- F13 (h1 재현): `buildSpecNodeData.ts:2033-2042` 가 `style.opacity` 를 `source:"style"` effect 로, `:2048-2070` 이 catalog `structure.states.disabled.opacity` 를 `source:"state"` effect 로 **각각** push 하고 `effects.ts:62-67` 이 opacity effect 마다 `saveLayer` 를 연다. Button `isDisabled` + `style.opacity 0.5` → effect 2개 `[0.5 style, 0.38 state]` (Phase 0 probe 재현). DOM 은 `CSSGenerator.ts:1300-1302` `[data-disabled]{opacity:0.38}` (non-important) 이라 inline 0.5 가 이긴다 → **plain 노드에서도 이미 Skia 0.19 ≠ DOM 0.5**. 230 의 opacity 단일화는 "명시 opacity (상태 origin · instance · plain inline) 가 catalog disabled opacity 를 대체" 한 규칙으로 두 leg 를 같이 맞춘다 (plain 도 같은 규칙 — DOM cascade 가 이미 그렇다).
- F14 (m2): `LayoutRenderers.tsx:529-580` `renderButton` · `CollectionRenderers.tsx:722-790` `renderToggleButton` 이 `style={element.props.style}` 를 RAC 요소 inline 으로 싣고 같은 요소에 `data-element-id` 가 붙는다 (RAC 가 `data-hovered/pressed/selected/disabled/focus-visible` 도 같은 요소에 emit). inline 은 non-important stylesheet 를 항상 이긴다 → 상태 selector 규칙이 매칭돼도 inline 색이 남는다 (Codex Chromium fixture).
- F15 (m3): Canvas 유효 상태는 self props 뒤에 투영된다 — `resolveRadioGroupSelection` (`buildSpecNodeData.ts:1148-1170`, 호출 `:1713-1720`) · `resolveTabsAncestorProjection` (`:1703-1710`, `_isSelected`) · `isNodeDisabled = breadcrumbCtx._isLast ? false : isDisabled || disabled || _parentIsDisabled` (`:1805-1810`). DOM 은 RAC 내부 상태 (`renderToggleButton` — 그룹 안은 `defaultSelectedKeys` + groupState, 단독은 `defaultSelected` uncontrolled + key remount `:745-760`; RadioGroup `defaultValue`).

### Phase 0 확정 inventory (G0, 2026-09-21)

| ID  | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 경로                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| F16 | root paint 의 단일 owner = `resolveCatalogPaint` (shared, pure): `backgroundColor = style.backgroundColor ?? staticHex ?? stateBackground` · `stateBackground = isSelected ? fill.default.(emphasized)selected : hover/pressed 는 interactionState` — Skia 는 `toCatalogInteractionState(state)` 로 항상 default 를 넘긴다. **origin/instance 의 명시 style 이 selected 토큰까지 가린다** (두 leg 동일 cascade) → 상태 origin 이 "상태별로 다른 style 세트" 를 주는 것이 유일한 해법 | `packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts:58-104` · `resolveSkiaVisualRule.ts:134-140` |
| F17 | 두 leg 의 origin 출처 표식: Skia resolved element 는 `ref` (origin id) 를 보존하고 instance 명시 override 는 ref 노드 자신의 `props` (`getRefOverrideProps`) 로 판독 가능 · Preview `ResolvedNode` 는 `_resolvedFrom` + `_overrides` (`descendants.*` 키만 — root props override 는 미기록)                                                                                                                                                                                          | `adapters/canonical/canonicalRefResolution.ts:175-246` · `resolvers/canonical/index.ts:212-224 · 716-719`  |
| F18 | Preview 문서별 CSS 주입 채널 **있음** — ADR-154 `collectResponsiveCss(pageNodes)` → `<style data-adr154-responsive>` 를 React 트리 안에 (page 노드 변경마다 재계산, `[data-element-id="…"]` selector + `escapeAttrValue`). 154 는 inline 을 이기려고 `!important` 를 쓴다 — 230 은 관리 키를 var() 로 옮겨 `!important` 없이 간다                                                                                                                                                    | `preview/App.tsx:1311-1320` · `packages/shared/src/utils/responsiveCss.ts:87-149`                          |
| F19 | DOM inline 은 `adaptElementStyle(previewEl)` (fills + style → props.style) 한 자리에서 만들어지고 marker (`data-canonical-id` · `data-element-id`) 가 같은 자리에서 붙는다 — 관리 키의 var() 치환 지점                                                                                                                                                                                                                                                                               | `preview/components/CanonicalNodeRenderer.tsx:422-445`                                                     |
| F20 | seed 채널: `ensureReusableCompositeOrigins` = ensurer 순회 → `convertNewOriginChildrenToRefs` (229) → 상태 변형 post-pass 는 그 **뒤** 한 줄. `ensureTemplateOrigins(document, ids, repair)` 가 부재 origin 을 Components body 끝에 append (배치는 G4)                                                                                                                                                                                                                               | `components/reusableCompositeOrigins.ts:114-131` · `ensureTemplateOrigins.ts`                              |
| F21 | 기본 요소 origin 5 의 seed 모양: Button (321 B, 자식 0, `isDisabled:false`) · ToggleButton (325 B, 자식 0, `isSelected/isDisabled:false`) · Link (259 B, 자식 0) · Checkbox (437 B, 자식 Label 1) · Switch (351 B, 자식 Label 1) — **inline style 없음** (`style:{}` 또는 부재) → 오늘은 catalog 상태 토큰이 그대로 보인다                                                                                                                                                           | Phase 0 probe (`buildCatalogOrigin`)                                                                       |

**기본 요소 집합 (Phase 1)** — 팔레트 reusable 이면서 상태 prop 계약이 있는 leaf. 상태 열은 타입별 계약 (F7):

| origin                   | selected | disabled | hover · pressed · focus-visible (Phase 2 — 시드 완료) | 자식    |
| ------------------------ | :------: | :------: | :---------------------------------------: | ------- |
| `component-button`       |    —     |    ✓     |                     ✓                     | 0       |
| `component-togglebutton` |    ✓     |    ✓     |                     ✓                     | 0       |
| `component-link`         |    —     |    ✓     |                     ✓                     | 0       |
| `component-checkbox`     |    ✓     |    ✓     |                     ✓                     | Label 1 |
| `component-switch`       |    ✓     |    ✓     |                     ✓                     | Label 1 |

- Phase 1 변형 origin = 8 (root) + 자식 4 = **Δnode 12 · Δbyte ≈ 3.3 KB** (origin 바이트 + `metadata.variant/variantOf` + name ≈ +60 B/노드). 후보 중 제외 — **Radio · Tab**: 팔레트 reusable 이 아니라 base origin 이 없다 (RadioGroup/Tabs origin 의 plain 자식) — 변형을 걸 origin 이 없으므로 범위 밖 (재개 = base origin 신설, ADR-228 축 후속). **MenuItem · GridListItem · ListBoxItem · Tag**: item template origin (`*-item-default`) — `--disabled` 추가는 Phase 1 범위 밖으로 미루고 (host `slot` 규약과 `variantOf` 규약이 겹친다 — 229 slot 정렬 뒤 G4 에서 배치와 같이 판정) 후속 후보에 둔다. 집합 5 ≤ 15 → 축소 불요.
- 시드 값: 변형 origin 의 style/fills 는 **비워서** 시드한다 (부재 키 = catalog 폴백이라 시각 Δ0 · 재hydration Δ0 · R5 토큰 참조 문제 없음). Components 페이지의 변형 노드는 해소기가 `metadata.variant` 를 유효 상태로 가정해 catalog 상태 시각 (selected 토큰 · disabled 0.38) 을 그린다. 사용자가 편집하면 그 키만 상태 origin 소유가 된다.
- Preview 채널 설계 (m2): default origin/instance 가 관리 키 (`backgroundColor` (fills) · `color` · `borderColor` · `opacity`) 를 inline 으로 소유하면 inline 을 `var(--co-<key>-<id>, <baseline>)` 로 바꾸고 상태 규칙은 변수만 세팅; 소유하지 않으면 inline 무변경 + 상태 규칙이 속성을 직접 세팅 (`[data-element-id="X"][data-element-id][data-selected]` — 생성 CSS `.react-aria-*[data-selected]` (0,2,0) 보다 높은 (0,3,0)). disabled 규칙은 마지막에 emit (같은 specificity → 후순 우선). `!important` 0.
- 두 leg 유효 상태 입력 (m3): Skia = `buildSpecNodeData` 의 RadioGroup/Tabs 투영 + `isNodeDisabled` 뒤 (한 지점, `:1810` 직후) · DOM = RAC data 속성 (CSS selector 가 곧 유효 상태) — 정적 해소는 Skia 만 하고 DOM 은 상태별 규칙 전부를 싣는다.
- Breadcrumb 예외: 집합 밖 (composite) — `_isLast` 평탄화는 그대로.

## 3. Phase

### Phase 0 — inventory freeze (G0)

- §2 F1~F15 경로:라인 확정 + 기본 요소 집합 + Preview 주입 채널 유무 (F11) + Δ 예상 + 예외 표. 공통 채널 실패면 Phase 1도 보류, interaction 전용 실패만 Phase 2 보류로 기록한다.
- proposed fixture: `component-togglebutton--selected` / `component-button--disabled` 를 손으로 둔 문서에서 `isSelected`/`isDisabled` instance 가 두 leg 에서 overlay 를 읽는지 (해소기 미구현 상태의 RED).

### Phase 1 — 선언적 상태 origin (selected · disabled) (G1 · G2)

- seed: `components/stateVariantOrigins.ts` (신설) — 기본 요소 origin 마다 `<origin>--<state>` (`metadata.variant` · `variantOf` · 이름 `Button/Selected`), subtree = default origin 의 자식 복제 (id `<variant>__n`), style = 토큰 참조 (rule fill `selected` / `states.disabled`) 로 굽는다. 2단 seed (229) 뒤에 post-pass — 기존 origin 불변, 부재 변형만 보충, 재hydration Δ0.
- 공용 해소 입력: origin index, 유효 상태, baseline, **명시 instance override**, child path를 분리한다. 출력은 최종 style/fills/childPatches와 상태 origin이 소유한 키/fallback 정보를 함께 가진 render-only 결과다. 본문 키별 우선순위를 양 consumer가 공유한다.
- Canvas: ref 해소 직후 self props에 덮지 않고 조상/collection 선택·disabled 투영 후 유효 상태를 전달한다. geometry 변경은 layout 입력에도 같은 결과를 사용한다. buildSpecNodeData의 CSS effects/Disabled opacity 분기는 state-owned opacity를 한 번만 emit하며 catalog opacity는 해당 키의 fallback이다. effects.ts의 곱셈 자체는 임의 변경하지 않는다.
- Preview: Phase 1부터 문서별 CSS 1장에 상태 selector를 싣고 baseline/상태값/명시 instance값을 별도 custom property로 전달한다. 관리 속성의 inline 값은 저장 문서를 바꾸지 않고 렌더에서 출처별 변수로 옮긴다. 생성 CSS 뒤의 명시된 layer/specificity로 우선하고 !important는 쓰지 않는다. origin 표식은 RAC 상태 속성과 같은 요소에 전달하며 child path→실제 요소 대응도 G0에서 확정한다.
- state-owned opacity는 origin값 또는 우선하는 instance값 하나만 적용한다. 비소유 키/상태 origin 부재/plain은 종전 경로를 보존한다. 출처 판독이 불가능하면 소비를 활성화하지 않는다.
- 편집: Components 페이지에서 변형 origin 선택 = plain 편집 (기존 origin 경로) · Properties 에 `Selected/Disabled` 읽기 전용 배지 · `variantOf` 삭제 가드 (systemOwned 와 같은 규칙).
- unit (원복 RED): seed 멱등/묶음 · opacity 효과 [0.5]/명시 override [0.8] (0.38 중복 없음) · RadioGroup.value/Tab 유효 상태 · 출처별 우선순위 · subtree 불일치 진단 · 기존 불변. live: `adr230-state-origins-live.mjs` — 상태 열은 타입별 계약 (F7: Button 은 disabled 만, ToggleButton/Checkbox/Radio/Switch 는 selected+disabled — 집합 표에 상태 열) · ToggleButton/Selected 배경 → `isSelected` instance 두 leg · Button/Disabled → `isDisabled` Button instance 두 leg 픽셀/computed · Form 안 Button 상속 · 조합 매트릭스.

### Phase 2 — interaction 상태 origin (hover · pressed · focus-visible) (G2 · G3)

- Phase 1 CSS/변수 채널에 hover/pressed/focus-visible 규칙을 추가한다. selected→hover→pressed와 disabled interaction 차단, instance 명시값 우선을 같은 정책으로 컴파일한다. 값은 CSS 값 화이트리스트, 토큰은 안전한 CSS 값으로 해소하고 식별자는 escape한다. 재주입은 편집당 최대 1회다.
- 캔버스: 변형 origin 노드는 Components 페이지에 정적 표시만 (ADR-150 경계). instance 캔버스 무변화.
- live: selected ToggleButton 빨강→hover 파랑→pressed 지정색→해제 후 selected 복귀, 명시 instance 배경 우선, disabled hover 차단. RadioGroup 선택 변경과 ToggleButton 직접 클릭은 canonical props 재주입 없이 RAC 실제 상태에 반응해야 한다. Preview iframe 에 실제 pointer hover (`page.mouse.move`) → computed background 가 origin 값 (함정: 헤더 pointer 가로챔 — 메모리 `reference-preview-iframe-hover-keyboard-harness-traps`).
- G3: `perf-baseline` `button-refs` 계열에 상태 50% fixture (`isDisabled` 절반) · Preview `<style>` 크기.

### Phase 3 — BC · 배치 · 문서 · 종결 (G4)

- 229 `adr229BackwardCompat.test.ts` 패턴: 229 모양 문서 + 사용자 저작 → 230 hydration → 기존 불변 · Δnode/Δbyte = 예상 · 재hydration Δ0 · seed 원복 롤백.
- Components body 배치: 변형은 default 오른쪽 같은 행 (`variantOf` 정렬, 기존 순서 보존 규칙은 228 h2) · Navigator 그룹 접기 · 사용자 confirm 1회.
- README/CHANGELOG · `### Live Exercise` · reviews/230.md · Implemented → completed/.

## 4. 파일 변경표 (추정 — G0 inventory 로 확정)

| 영역      | 파일                                                                                                                                                  | 변경                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| seed      | `components/stateVariantOrigins.ts` (신설) · `reusableCompositeOrigins.ts` (post-pass 1줄) · `slotHostPolicy.ts` (variantOf 판정)                     | 변형 origin 시드 · 묶음     |
| 해소      | `components/stateVariantResolution.ts` (신설) · `canvasSceneNode.ts` + 기존 상태 projection/layout 소비 · `preview/App.tsx` + `CanonicalNodeRenderer` | 유효 상태·출처별 공용 해소  |
| Skia 상태 | `workspace/canvas/skia/buildSpecNodeData.ts` · `effects.ts` 인접 테스트 · 조상/collection 투영 및 layout 입력                                         | 유효 상태·opacity 단일 효과 |
| 편집      | `panels/properties/ComponentSemanticsSection.tsx` (배지) · `stores/utils/elementRemoval.ts` (가드)                                                    | 읽기 전용 배지 · 삭제 가드  |
| DOM 상태  | `preview/App.tsx` (Phase 1부터 CSS 변수/상태 selector) · `packages/shared/src/renderers/*` (wrapper `data-origin`)                                    | 문서별 CSS                  |
| 테스트    | 위 모듈 옆 `*.test.ts` · `adr230BackwardCompat.test.ts` · `scripts/adr230-state-origins-live.mjs` · `perf-baseline.mjs` fixture                       | RED→GREEN · live · A/B      |

추정 파일 15~20 (효과·유효 상태/layout 소비 경계 포함, G0 확정). 실측이 1.5× 를 넘으면 Phase 0 inventory 보강 커밋으로 흡수 (M3 — fork 사유 아님).

## 5. 축소안

- 공통 유효 상태/CSS 채널 또는 opacity 단일화가 실패하면 Phase 1도 보류한다. 선언적 상태 G1/G2/G3/G4가 통과하고 interaction 전용 배선만 실패한 경우에 한해 Phase 2를 보류하고 Phase 1 범위로 종결한다. 보류 상태와 재개 조건을 명시한다.
- 기본 요소 집합이 15 를 넘으면 Phase 1 을 Button 가족 (Button · ToggleButton · Link) + Checkbox/Radio/Switch 로 축소하고 나머지는 후속 후보로.

## 6. 함정 (선행 ADR 에서 승계)

- origin 편집은 영향 대화상자 (`EditingSemanticsImpactDialogHost`) 를 지나야 store 에 실린다 — 하니스는 Continue 를 누른다 (229).
- Compare Mode 는 캔버스를 반폭으로 — Skia 픽셀은 그 전에 (229 · 메모리 `feedback-compare-mode-halves-canvas-hides-area-delta`).
- system origin root 는 `removeElement` 가 막는다 — pre-230 문서 재작성은 `db.documents.put` 경로 (229 G4).
- Preview iframe hover 는 헤더가 pointer 를 가로챈다 · focus 는 실제 요소로 (메모리 `reference-preview-iframe-hover-keyboard-harness-traps`).
- `size` 는 ButtonGroup/Toolbar 가 자식에 전파하는 축이라 origin 값이 가려진다 — live 는 전파 밖 축 (`style.width` · 배경) 으로 (229 C-d).
- legacy merge 는 root `Tag` element 를 items 로 흡수한다 — unit fixture 는 canonical 직접 시드 (229 F30 테스트).

## 7. Phase 기록

### Phase 0 — G0 PASS (2026-09-21, `2645fc86e` 기준)

- 상태 Proposed → **Accepted** (사용자 `/execute-adr 230` = 승인 기록, reviews/230.md round 2 이슈 0 · 전제 확정).
- inventory §2 F13~F21 freeze · 기본 요소 집합 5 (상태 열 표) · Δnode 12 / Δbyte ≈ 3.3 KB · Preview 채널 = ADR-154 `<style>` 패턴 재사용 (F18) · 유효 상태 입력 지점 (Skia `:1810` 직후 · DOM = RAC data 속성).
- 리뷰 반증 3건을 현재 코드에서 재현 (F13 probe: opacity effect `[0.5 style, 0.38 state]` — DOM 은 0.5 라 plain 도 이미 발산). Phase 1 unit 이 이 세 사실을 원복 RED 로 고정한다.
- 판정: 공통 채널 (CSS 주입 · 유효 상태 · opacity 단일화) 모두 구현 가능 — Phase 1 보류 사유 없음. Radio/Tab (base origin 부재) · item template `--disabled` 는 후속 후보.

### Phase 1 — G1 · G2 PASS (2026-09-22)

- seed: `components/stateVariantOrigins.ts` — `STATE_VARIANT_BASE_TYPES` (Button/Link: disabled · ToggleButton/Checkbox/Switch: selected+disabled) · `ensureStateVariantOrigins` (default 바로 오른쪽 삽입 · 기존 변형/편집 보존 · 무변경 시 같은 객체) · `buildStateVariantOrigin` (id `<origin>--<state>` · `metadata.variant/variantOf` · 이름 `Button/Selected` · style/fills 비움 · 자식 `<variant>__n` 동형) · post-pass 자리 = `ensureReusableCompositeOrigins` 의 `convertNewOriginChildrenToRefs` 뒤 (F20).
- 공용 해소: `components/stateVariantResolution.ts` — 관리 키 4 (backgroundColor(fills) · color · borderColor · opacity, 비기하) · `buildStateVariantProjection(master, rawRef, lookup)` → `props._stateVariants` {sets · defaultOwned · instanceOwned} (render-only) · `resolveStateVariantOverlay(projection, {selected, disabled})` (instance 명시 > disabled > selected) · `collectStateVariantCss(doc)` (origin 당 상태 규칙, selector (0,3,0) 2형 — RAC 요소 자체 / display:contents wrapper 직계 · default 소유 키는 `--co-<key>` 변수, 아니면 속성 직접 · disabled 마지막 · `!important` 0) · `toStateVariantInlineStyle` (`var(--co-<key>, <baseline>)`).
- Skia: `resolveCanonicalRefTree` 최상위 + `materializeSyntheticDescendants` nested (Form 안 Button) 가 `withStateVariantProjection` 로 같은 projection 을 싣는다 (instance 소유 키는 `sourceNode` = raw ref 로 판정 — scene merge 가 origin props 를 깐 뒤라 merged props 로 판정하면 오판). `buildSpecNodeData` — RadioGroup/Tabs 투영 + `isNodeDisabled` 뒤 overlay (fills → hex6 + `_fillBgAlpha`, `effectiveFills` 로 gradient 블록까지 치환) · 변형 origin 자신은 `metadata.variant` 를 상태로 가정 · **Disabled opacity 분기: 명시 `style.opacity` 가 있으면 catalog 0.38 을 emit 하지 않는다** (h1 — plain 도 같은 규칙, DOM cascade 와 대칭).
- DOM: `resolvers/canonical/index.ts` `_resolveRefNodeUncached` 가 같은 projection 을 실음 · `CanonicalNodeRenderer` 가 `data-state-origin` 표식 + var() inline + 변형 origin 자신의 render-only `isSelected/isDisabled` · `preview/App.tsx` `<style data-adr230-states>` (canonicalDocument 의존 memo).
- unit (원복 RED): `stateVariantOrigins.test.ts` 5 · `stateVariantResolution.test.ts` 6 · `buildSpecNodeData.test.ts` +6 (h1 `[0.5 style]` 1개 · overlay 빨강 · 명시 override · plain F13 · m3 RadioGroup.value Radio dot 빨강 · 변형 origin 자신 0.38) · `adr230StateVariantRefProjection.test.ts` 3 (최상위 · nested · 무변형) · `adr230StateVariantProjection.test.ts` 3 (Preview resolver) · `adr229BackwardCompat.test.ts` 는 pre 문서에 230 변형을 미리 실어 229 Δ 만 잰다. builder 870 files 6929 PASS · shared 1376 PASS · type-check PASS.
- live `adr230-state-origins-live.mjs` **8/8** (headed): L1 변형 8 root 가 default 바로 오른쪽 · L2-0 편집 전 disabled 픽셀 = 0.38 합성 `[167]` · L2-1 `ToggleButton/Selected` fills 빨강 → `isSelected` instance Skia `[255,0,0]` · 미선택 불변 · `Button/Disabled` opacity 0.5 → 픽셀 `[139]` = 0.5·23 + 0.5·255 (0.19 이면 `[211]`) · L3 Preview A `rgb(255,0,0)` data-selected · C opacity 0.5 · **Form 안 Save (229 ref + descendants isDisabled) opacity 0.5** · L5 instance 명시 0.8 > 0.5 (Skia `[69]` · Preview 0.8) · L6 Preview 클릭으로 RAC 상태만 바뀌어 빨강 ↔ 복귀 (canonical 불변, m3 DOM 축) · L7 reload 보존 · Components body Δnode 0 · Δbyte 0 (fill id · 편집 metadata mirror 제외) · page error 0.
- 잡은 것: F13 (plain 도 Skia 0.19 ≠ DOM 0.5) 수리 · 하니스 함정 3 — `descendants` mode A 는 flat props (`{path: {isDisabled: true}}`) · ToggleButton/Checkbox/Switch 는 rendererMap 위임이라 표식이 wrapper 에 (selector 2형) · **Components 페이지는 프레임 안 스크롤 + Preview 는 system 페이지를 안 그린다** → 변형 origin 자신의 캔버스 시각은 unit (`buildSpecNodeData.test.ts` "변형 origin 자신") 로 고정, 하니스 밖.
- 미완 (Phase 3 로): Properties 읽기 전용 배지 (이름 `ToggleButton/Selected` 가 Navigator/Properties 헤더에 이미 실린다) · `variantOf` 삭제 가드는 `systemOwned` 가드 (ADR-228) 가 그대로 막는다 (별도 코드 0).

### Phase 2 — G2 (interaction) · G3 PASS (2026-09-22)

- seed: `INTERACTION_STATE_VARIANTS` (hover · pressed · focus-visible) 를 5 타입 전부에 추가 — 변형 origin 15 root + 자식 6 (Checkbox/Switch Label) = **Δnode 21 · Δbyte ≈ 5.8 KB**. `ensureStateVariantOrigins` 는 부재 변형을 **기존 변형 run 의 끝** 에 넣는다 (Phase 1 문서에 보충해도 `--selected`/`--disabled` 자리 보존 · 재hydration Δ0). 이름 `ToggleButton/Hover` · `/Pressed` · `/Focus`.
- projection: `buildStateVariantProjection` 이 `ALL_STATE_VARIANTS` 를 읽어 `sets.hover/pressed/focus-visible` 까지 싣는다 — **Skia overlay (`resolveStateVariantOverlay`) 는 선언적 두 상태만 읽는다** (ADR-150 경계 · instance 캔버스 무변화, unit 고정).
- Preview CSS (`collectStateVariantCss`): 방출 순서 `STATE_VARIANT_CSS_ORDER` = selected → focus-visible → hover → pressed → disabled (같은 specificity 후순 우선). interaction 규칙은 `:not([data-disabled])` 를 붙여 (0,4,0) — selected 를 이기고 disabled 에는 안 붙는다 (RAC 가 disabled 에 hover/pressed 를 안 붙이지만 stylesheet 가 자기 정책을 갖는다). instance 명시 키는 inline 리터럴이라 그대로 우선 (Phase 1 과 같은 규칙). `!important` 0.
- 캔버스: 변형 origin **자신** (`Button/Hover` · `/Pressed`) 은 `racStateAttrs({isHovered, isPressed})` 로 catalog hover/pressed 토큰을 **정적 표시** (pointer 추적 0 — ADR-912 단계 3 의 "hover/pressed 입력은 항상 false" 는 origin 자신에 한해 열린다). `/Focus` 는 catalog paint 에 focusVisible 분기가 없어 default 와 같다.
- unit (원복 RED): `stateVariantOrigins.test.ts` 6 (+1 Phase 1 문서 보충 순서) · `stateVariantResolution.test.ts` 7 (+1 interaction 규칙 순서·차단·두 selector 형) · `buildSpecNodeData.test.ts` +1 (hover/pressed origin 자신 ≠ base · instance 는 hover set 있어도 default) — builder 58 files 306 PASS (관련 스위트) · type-check PASS.
- **G3** (`pnpm perf:baseline -- --lane frame --seed-count 600 --headed --classes edit`, fixture `button-refs` (상태 0%) vs 신설 `button-refs-stateful` (홀수 instance `isDisabled:true` = 50%), 같은 세션 3회씩 · run 당 표본 10 이라 p95 ≈ max): `scene.build` p95 **10.1 / 7.6 / 9.1 (median 9.1) → 7.7 / 7.1 / 8.5 (median 7.7), Δ −1.4 ≤ +1 PASS** · p50 4.9 → 4.6 · render.frame p95 5.6 → 6.3 (+0.7, 표본 편차 안). Preview `<style data-adr230-states>`: 변형 6 편집 뒤 1,221 B (규칙 6) ≤ 8 KB · 편집 1회당 텍스트 교체 1 (MutationObserver — Phase 2 하니스 P2-3, Compare Mode 보류 전 1회 실측).
- live: **Compare Mode/Preview iframe 검증은 사용자 판정으로 보류 (2026-09-22, 메모리 `feedback-no-compare-mode-preview-checks-now`)** — 보류 전 1회 실측에서 P2-1 (interaction 변형 15 root 가 선언적 run 뒤 · style 비움) · P2-2 (Tab 키 `data-focus-visible` → `ToggleButton/Focus` color 마젠타 — interaction 규칙이 RAC data 속성으로 붙는 증명) · P2-3 (G3 `<style>`) PASS. pointer hover/pressed 항목은 하니스에서 제거 — 규칙 내용·순서·disabled 차단은 unit 고정, 실제 hover 시각은 **사용자 확인 대상** (Preview 에서 `ToggleButton/Hover` 배경을 바꾸고 instance 에 마우스를 올린다). 재개 조건 = 사용자가 Preview 검증을 다시 요청할 때.

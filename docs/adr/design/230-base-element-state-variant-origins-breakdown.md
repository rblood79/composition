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

### 리뷰 반증 (h1/m2/m3)

- F13: buildSpecNodeData.ts:2033/2048은 style opacity와 catalog disabled opacity를 별도 emit하고 effects.ts:62가 각각 saveLayer를 연다. 진단 결과 [0.5, 0.38].
- F14: inline selected 색과 hover stylesheet가 겹치면 selector가 매칭돼도 inline이 이긴다 (Chromium 최소 fixture 빨강 유지).
- F15: buildSpecNodeData.ts:1148/1703의 RadioGroup/Tab 투영 및 CollectionRenderers.tsx:733의 RAC 내부/group 상태는 self props와 다르다.

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

(착수 시 기록)

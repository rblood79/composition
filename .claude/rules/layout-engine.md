---
description: 레이아웃 엔진 관련 파일 작업 시 적용 — catalog runtime 의 레이아웃 재계산 경로 · 엔진↔TS 경계 · 배치 직렬화 계약 · 엔진 CSS 정합 불변식 (한 줄씩). Why · 실측 수치 · 금지 패턴 전문은 skill reference (정합 원장)
paths:
  - "packages/engine/**"
  - "apps/builder/src/builder/workspace/canvas/layout/**"
  - "apps/builder/src/builder/catalogRuntime/compositionRoot.ts"
  - "apps/builder/src/builder/catalogRuntime/canvasBinding.ts"
  - "packages/shared/src/catalog/runtime/compositionRoot.ts"
  - "packages/shared/src/catalog/runtime/boxModel.ts"
  - "packages/shared/src/catalog/runtime/layout*.ts"
  - "packages/shared/src/catalog/runtime/*Layout.ts"
  - "packages/shared/src/catalog/runtime/presence.ts"
  - "packages/shared/src/catalog/transactions/transaction.ts"
  - "apps/builder/tests/parity/**"
---

# 레이아웃 엔진 규칙

> **이 파일은 불변식만 담는다.** 각 줄의 Why · 실측 수치 · fixture 민감도 전문은 [정합 원장](../skills/composition-patterns/reference/layout-css-parity-ledger.md) — 엔진 배치 알고리즘이나 아래 줄이 다루는 경로를 바꾸기 전에 해당 절 (머리말 · position · 색인 행 원문은 원장 §부록 2026-11-15) 을 읽는다. 새 실측 기록은 원장에 쓰고 여기에는 한 줄만 더한다 (크기 상한: `pnpm docs:rule-size`).

- **page body 는 엔진 노드 둘** — 화면 상자 (body record: 프레임 크기 · 배치 · overflow, `display: block`) 와 내용 상자 (`::part:page-content`: display · gap · padding · line box, 자식이 사는 곳 — `pageBodySplit` · `wrapperPartOf`). body 에 페이지 높이를 `height` 로 넣지 않는다 (세로 flex 가 넘치는 자식을 압축한다). Height 미저작 · `auto` · `fit-content` → 프레임 `height: fit-content` (키워드여야 한다 — `auto` 는 page 격자 행으로 늘어난다) + 내용 상자 `min-height` = Min H (`catalogPageContentMinHeight`). Height 저작 → 프레임 = 그 높이 (`catalogPageFrameHeight`) · 내용 상자 `height: 100%`. 내용 상자를 바꾸는 값 (gap · display …) 은 그 part 의 style 이다 — 미리보기 (`previewRecord`) · 형제 판정 (`blockFlowSiblingsFixed`) 도 part 를 읽는다.
- 측정 leaf 의 세로 flex 최소 높이는 min(내용, 직렬화된 px 높이) 를 `contentMinHeight` 로 넘긴다 — 높이가 글리프 · ColorWheel 지름에서 온 경우도 (`styleOf` 의 `out.height`).
- flex 주축에 직접 넣은 크기 (`sizing` px · 직접 쓴 `%` · `vh`) 는 `flex-shrink: 0` — 해석 단계 `catalogFixedMainShrink` (`fillLayout.ts`) 가 record 에 싣고 Canvas · DOM 이 같이 읽는다. 크기를 쓸 때 shrink 를 함께 저장하지 않는다. rule 기본 길이 · 직접 넣은 Shrink 는 제외.
- Ratio 잠금은 따라가는 축을 `fit-content` 로 문서에 쓴다 (`catalogRatioCommand`). 계산은 엔진 · 브라우저의 CSS 규칙 그대로 — TS 에서 규칙 기본 크기를 몰래 빼지 않는다.
- 세로 flex 안 `align-self` 가 stretch 가 아닌 auto 폭 자식은 fit-content — max-content 가 사용 가능한 폭을 넘을 때만 fit 폭으로 **한 번** 배치한다 (`column_item_overflow_fit`). 먼저 indefinite 로 재고 다시 배치하지 않는다 (이중 solve · 증분 skip 어긋남).
- intrinsic 폭 컨테이너의 preferred aspect ratio 는 최소 높이를 인라인 최소 기여로 전송한다 — 확정 폭 유지 · max-width 로 제한 · 커진 used 폭에서 자식 재배치.
- `display: contents` 의 보고용 경계에 `position: fixed` 자식의 중간 상자를 합치지 않는다.
- flex item 재배치의 used 크기는 백분율 min/max 의 새 containing block 이 아니다 — 원래 부모 문맥에서 해소한 제약을 임시 적용하고 저작 값을 복원한다. 미해소 `%` 를 px 로 치환한 반환도 content 슬롯으로 되돌릴 때 padding 을 뺀다.
- 숨김 처리로 서브트리 layout 을 0 으로 덮어쓸 때 (`zero_subtree_layout`) 기존 solve 결과 · available 키 · 최종 fixed 크기 캐시도 함께 무효화한다 — 재표시 첫 solve 는 다시 실행돼야 한다.
- fixed 배치는 viewport 단계에서 수행하고 부모 기준 임시 배치로 최종 제약 캐시를 덮어쓰지 않는다. 크기 재사용은 subtree/environment 세대와 containing block 제약이 같을 때만.

> 아키텍처/WASM 경계: [layout-engine.md](../skills/composition-patterns/reference/layout-engine.md) · **엔진 CSS 정합 실측 기록 23절 전문**: [layout-css-parity-ledger.md](../skills/composition-patterns/reference/layout-css-parity-ledger.md)

## 레이아웃 재계산 경로 (catalog runtime — 2026-10-04 개정)

> ADR-248 Phase 4 (2026-10-03) 뒤 production 레이아웃은 **`catalogRuntime/compositionRoot.ts`** 가 `PersistentLayoutTree` 를 직접 몬다. 옛 `layoutVersion` 카운터 · `fullTreeLayoutMap` useMemo · 5-심볼 2계층 체인 (`LAYOUT_AFFECTING_PROP_KEYS` · `NON_LAYOUT_PROPS_UPDATE` · `INHERITED_LAYOUT_PROPS_UPDATE` · `LAYOUT_STYLE_KEYS` · `LAYOUT_PROP_KEYS`) 은 대상 파일 (`stores/utils/layoutInvalidation.ts` · `elementUpdate.ts` · `scene/layoutCache.ts` · `BuilderCanvas.tsx`) 과 함께 삭제됐다. 같은 이름의 상수는 `presentation/invalidation/editorMutationEffectRegistry.ts` 에 테스트용 파생 view 로만 남아 production 판정에 쓰이지 않는다 — 여기에 키를 넣어도 화면은 바뀌지 않는다.

편집 한 번이 레이아웃까지 가는 길 (순서대로):

| #   | 단계                       | 위치                                                                                                            | 판정                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | transaction 의 layout 영향 | `operationAffectsLayout` · `PAINT_ONLY_VISUAL_KEYS` (`packages/shared/src/catalog/transactions/transaction.ts`) | **제외 방식** — 구조 변경과 모든 op 가 layout 영향이고, `patchNodeVisual` (· visual scope 의 `patchDefinitionOverride`) 중 키가 paint-only 목록 (color · backgroundColor · borderColor · fill · opacity · radius* · boxShadow · filter · transform · zIndex · backgroundImage · backgroundSize · textDecoration …) 에 있을 때만 아니다. `setNodeField` 는 `fillSizing` · `visibility` 만 |
| 2   | 재계산 여부                | `CatalogCompositionRoot.plan` (`compositionRoot.ts`)                                                            | 값 변경 step: `computeLayout = 대상 root 있음 && (impact.layout \|\| layoutPlanChanged)` — paint-only 표시가 실제 상자 변화를 가리지 못한다. 구조 변경: 영향 root 가 있으면. 소유 노드 삭제 · 순서 변경: 항상                                                                                                                                                                            |
| 3   | 노드 style 변경 판정       | `planRecord` → `styleChanged = !old \|\| frameChanged \|\| !sameFields(styleFor(old), style)`                   | **키 목록이 없다** — `styleOf` 가 만든 엔진 입력 (`NodeStyle`) 전체를 비교한다                                                                                                                                                                                                                                                                                                           |
| 4   | 엔진에 반영                | `applyRecord` → `PersistentLayoutTree.addNode` / `updateNodeStyle`                                              | `updateNodeStyle` 은 직렬화 JSON 이 같으면 WASM 호출을 건너뛰고 (`_lastJsonMap`), 다르면 `updateStyleRaw` → 엔진 `update_style` 이 조상까지 dirty 전파                                                                                                                                                                                                                                   |
| 5   | 계산 · 줄바꿈 재측정       | `apply()` → `layout.computeLayout` → `rewrap`                                                                   | `rewrap` = height-for-width 1회 재측정 (텍스트 leaf 를 확정 폭으로 다시 재 `wrapHeights` → `updateNodeStyle` → `computeLayout` 한 번 더). 옛 Step 4.5 와 같은 축소 계약                                                                                                                                                                                                                  |
| 6   | Canvas 반영                | `canvasBinding.ts` — `root.subscribeCanvas` dirty → `root.getGeometry` rect diff                                | 바뀐 rect 의 subtree 명령만 다시 만들어 끼운다 (`presentationRevision` 로컬 증가). 전역 카운터 없음                                                                                                                                                                                                                                                                                      |

- `buildFull` 은 bind 때 (`buildLayout`) 와 실패 롤백 (`restore`) 에서만 쓴다. 편집은 전부 증분 (`addNode` · `updateStyleRaw`) 이다.
- Grid auto 행 기여는 auto 뿐 아니라 min/max/fit-content 높이 자식도 padding · border 를 포함한다 (solve 반환이 content-box).
- **엔진 입력의 유일한 직렬화기는 `styleOf`** (`compositionRoot.ts`). 길이는 `px()` 로 `"Npx"` 문자열, grid track 은 `containerTracks` 가 `parseGridTemplate` 로 배열, 텍스트 측정 스칼라 (`contentMinWidth` · `contentMaxWidth` · `contentHeight`) 는 TS 측정값, 상속 줄 높이는 `inheritedLineHeight`.

### 새 레이아웃 키를 추가할 때 (체크리스트)

1. **`styleOf` 가 그 키를 엔진 입력으로 내보내는가** — 내보내지 않으면 엔진에 닿지 않는다 (3단계의 비교 대상에도 없다). 엔진 `NodeStyle` 에 필드가 없으면 엔진부터.
2. **paint-only 목록에 넣지 않는다** — 상자 크기 · 위치를 바꿀 수 있는 키를 `PAINT_ONLY_VISUAL_KEYS` 에 넣으면 1단계가 재계산을 건너뛴다 (2단계의 `layoutPlanChanged` 가 `styleFor` 변화로 다시 잡지만, 그 판정에 의지하지 않는다). 반대로 정말 칠만 바꾸는 키는 넣어야 불필요한 재계산이 없다.
3. 길이는 문자열, track 은 배열, 스칼라는 숫자 — 아래 §배치 직렬화 계약.
4. live 로 확인 — 값을 바꾼 직후 (새로고침 없이) Canvas 상자가 따라오는가. 새로고침 뒤에만 맞으면 증분 경로 (4단계) 를 의심한다.

### 재확인 필요 — 옛 경로가 full rebuild 로 피하던 증상

옛 `fullTreeLayout` 은 엔진 `updateStyleRaw` 가 grid track · placement 캐시를 못 무효화한다는 실측 (2026-06-16: 기존 grid 컨테이너의 padding · gap · gridTemplate · width/height/min·max 변경 → 1줄로 무너짐, 새로고침 뒤 정상) 과, 새 grid 컨테이너 · 자식을 가진 새 컨테이너를 `addNode` 로 넣으면 자식 배치가 비는 실측 때문에 그 경우들을 full rebuild 했다 (아래 parity 절 §PersistentLayoutTree). **catalog 경로에는 이 가드가 없다** — 위 증상이 재현되면 엔진 `update_style` 의 grid 캐시 무효화 · `add_node` 증분부터 본다 (TS 에 rebuild 가드를 되살리는 것은 엔진 수정이 막혔을 때만).

## 엔진 선택

- production 은 `PersistentLayoutTree` 와 `gridStyleAdapter.parseGridTemplate` 만 쓴다 (`compositionRoot.ts`). 계산은 단일 자체 Rust WASM (`packages/engine`, ADR-916 Implemented 2026-07-06) 이 하고, TS 는 `styleOf` 로 입력을 직렬화할 뿐이다. 옛 style 어댑터 (`displayAdapter` · `flexStyleAdapter` · `blockStyleAdapter`) 는 2026-10-05 옛 파이프라인과 함께 삭제됐다. JS 심볼의 `Taffy*` 접두는 ADR-923 Phase 6 (2026-09-03) 에서 `Engine*` 로 개명했다 — 옛 이름은 ADR·evidence 이력 문서에만 남는다

## display: contents — 엔진 소속 (ADR-256 Phase 6g, 2026-10-08)

- 요소가 없는 RAC 부품 (Autocomplete) 은 rule 의 `display: contents` 로 엔진에 간다. 엔진이 CSS-DISPLAY-3 §2.5 를 구현한다 — `solve_node` 가 자식 목록을 펼치고 (`box_children`), 펼친 자식의 부모 판정 (blockify · block 부모 · flex/grid item) 은 상자가 있는 조상을 본다 (`layout_parent`). 배치 뒤 contents 노드는 자손 합집합 상자를 보고하고 자식 좌표는 그 상자 기준이다 (`settle_contents_children`) — 소비자 (`getGeometry` · Canvas) 가 부모 좌표를 더하는 계약 그대로.
- TS 에서 contents 를 흉내 내지 않는다 (부모 흐름 값을 복사한 상자 · 자식 재부모화 금지). 시험: `tree.rs` `contents_*` 3 · `adr256AutocompleteNodeTree` (gap 가로 frame) · live `adr256-p6g-live.mjs` L-5 (Chrome oracle).

## position:absolute / fixed — 엔진 소속 + 의도적 미지원 경계 (ADR-164 Phase 2, 2026-07-25)

- out-of-flow 배치는 **엔진 구현** (`tree.rs::place_absolute_children` + `resolve_abs_axis`). TS 에서 absolute 배치 보정 재도입 금지.
- 양측 inset 으로 늘어난 auto 크기 absolute 상자는 **늘어난 상자로** 자기 absolute 자식을 다시 놓는다 (CSS 2 §10.1).
- **양쪽 inset + 자기 정렬 (ADR-275)**: `justify-self` · `align-self` 가 stretch · normal · auto 가 아니면 auto 크기는 fit-content 로 두고 inset 영역 안에 정렬한다. `unsafe` 만 넘칠 때 그대로, 접두 없음 · `safe` 는 containing block 안으로 당긴다. 늘이기 제외 판정 (`size_fixed_*`) 과 padding · border 가산 판정 (`has_*`) 을 합치지 않는다.
- **containing block 조상 체인**: 부모가 `position: static` 을 **명시**할 때만 가장 가까운 positioned 조상의 padding box 기준 (`place_static_descendant_absolutes`). `static` 은 catalog 가 positioned 부품 상자 안의 layout frame 에만 싣는다 (`catalogStaticPartFrame`) — 위치 미지정 부모는 직계 부모 기준.
- **`position: fixed` (ADR-275 Phase 7)**: viewport = page root 의 border-box 원점 + `set_viewport` 크기. 엔진은 정상 배치 뒤 `place_fixed_boxes` 가 다시 놓고, Canvas 는 page 층 (`FixedLayer`) 에서 그린다 — 부분 재기록 거부 → 다시 묶음. 미지원: transform · filter 조상.
- **`position: sticky` (ADR-267 · ADR-275 Phase 6)**: in-flow 그대로 배치 + 엔진 constraints (`getStickyConstraints`, owner = 가장 가까운 `is_scroll_container`) + Canvas `resolveStickyOffset`. TS 에서 sticky 위치를 재계산하지 않는다. 그리기 층 (z-index · sticky) 이 바뀐 record 는 장면을 다시 묶는다 (`canvasBinding.ts` `paint-order`).
- 전문 (실측 · oracle · Rust 시험 이름): [정합 원장](../skills/composition-patterns/reference/layout-css-parity-ledger.md) §부록 C.
- 남은 미지원 축 (fixed 의 transform · filter 조상 등) 은 실사용이 생기면 ADR-164 §4 조건부 규칙에 따라 해당 축만 엔진 구현 + fixture (새 ADR 불요)

## 옛 TS 레이아웃 파이프라인 — 삭제됨 (2026-10-05)

`fullTreeLayout.ts` (`calculateFullTreeLayout`) 와 그것만 쓰던 TS 전처리 — DFS enrichment (`enrichWithIntrinsicSize` · `calculateContentWidth/Height`) · `applyImplicitStyles` 컴포넌트 주입 · `propagationRegistry` · display/flex/block 어댑터 · 2-pass · grid full rebuild 판정 · parity 하니스의 pipeline leg — 는 production 에서 닿지 않아 삭제했다 (사용자 판정 2026-10-05). production 은 §레이아웃 재계산 경로 하나다. 옛 계약 · 실측 이력은 git 기록과 [정합 원장](../skills/composition-patterns/reference/layout-css-parity-ledger.md) 이 보존한다.

- parity 하니스는 DOM leg ↔ engine leg (엔진 CSS 정합) 와 `adr248Catalog*` (catalog root ↔ catalog DOM) 만 남았다. 옛 파이프라인이 덮던 텍스트 leaf 스칼라 축은 `adr248CatalogTextLeafScalar` 가 catalog 경로로 잰다.
- 남은 TS 엔진 보조 모듈 (`layout/engines/`): 텍스트 측정 (`utils.ts` — `measureTextWidth` · `calculateMin/MaxContentWidth` 등, `catalogTextMeasure` 의 Canvas 2D 폴백) · 기본 display (`defaultDisplay.ts`) · `PersistentLayoutTree` · grid track 파서 (`gridStyleAdapter.ts` `parseGridTemplate`) · CSS 값 파서 (`cssValueParser.ts` · `cssResolver.ts`) · overflow/shadow 해석 (`implicitStyles.ts` 잔여).

## 엔진 CSS 정합 규칙 색인 (2026-07-25 ~ 07-28 실측 — 전문은 reference)

엔진 (`packages/engine/**`) 의 배치 알고리즘을 바꾸기 전에 [정합 원장](../skills/composition-patterns/reference/layout-css-parity-ledger.md) 의 해당 절 — 규칙 · 거처 (함수) · Chrome 실측 표 · fixture 민감도 · **금지 패턴** — 을 읽는다. 아래는 절당 한 줄이다 (거처 · 세부 조건 · 날짜별 추가분을 담은 행 원문은 원장 §부록 D).

- **§1** 컨테이너 used size 는 min/max clamp **뒤** 값 — flex main·cross / grid block / 인라인 네 축 모두 clamp 값으로 재분배. aspect-ratio 는 clamp 뒤 파생 — fixture: bodyViewportBox · basicAxisContainerSize
- **§2** body 는 뷰포트가 아니다 — 상자는 둘 (머리말 첫 줄) — fixture: bodyViewportBox · pageSlotStyle
- **§3** 늘어날 available 이 없으면 기여는 **content** — auto 폭은 fit-content — fixture: containerAlign
- **§4** shrink-to-fit 은 크기 확정 **뒤** 한 번 더 — 컨테이너 상자는 1차 값 유지 — fixture: shrinkToFitInline
- **§5** automatic minimum size §4.5 는 엔진 소속 — 텍스트 leaf 는 스칼라 2종 (`contentMinWidth` · `contentMaxWidth`), 구 Step 5.7 재도입 금지 — fixture: autoMin · intrinsicSizing
- **§6** 컨테이너 intrinsic 은 측정 모드 센티넬 재실행 — 캐시 키는 `mutation_gen` (dirty 아님), 자기 폭 제외 슬롯은 `max(subtree_gen, viewport_gen)` (ADR-268) — fixture: containerIntrinsic
- **§7** 증분 skip 키는 dirty **와** `last_avail` 둘, 반환은 `last_solved` — `last_compute` 는 root handle 자신을 지울 때만 비운다 — fixture: tree.rs `reparent_*` · `incremental_skip_*`
- **§8** 컨테이너 `width: min/max/fit-content` 는 엔진이 측정으로 해소 (clamp 앞) — TS 선해석 금지 (합성 leaf 만 예외) — fixture: basicAxisContainerSize
- **§9** 그리드 자신의 min/max-content 는 `inline_intrinsic` 한 곳 — `%` = `auto`, min-content 에서 `fr` 안 폄 — fixture: gridContainerIntrinsic
- **§10** 그리드 블록 크기 = **행 트랙 extent** (셀 bbox 아님), 반환은 content-box — fixture: gridContainerBlockSize
- **§11** 교차축 라인 cross 는 컨테이너 cross **대입** (`max` 아님) — fixture: flexSweep
- **§12** 넘칠 때의 정렬 — 위치 정렬은 음수 offset, 분배 정렬은 `.max(0)` 유지 — fixture: crossAxisOverflow · gridAlignContent
- **§13** 백분율 — 인라인 축은 상속 available 로 확정, 블록 축은 `explicit_h>0` 만 (부모 배치가 확정한 used 값도 온다, ADR-206) — fixture: percentSize
- **§14** flex item 재-solve 는 **자기가 푼 available** 기준 — fixture: basicAxisContainerSize
- **§15** `margin:auto` 는 커널이 **라인 단위**로 흡수 — tree.rs 후처리 재도입 금지 — fixture: autoMargin
- **§16** `*-reverse` 는 위치만 반사 — 물리 margin 쌍 + auto 마스크를 스왑해 커널에 정방향 전달 — fixture: reverseMargin
- **§17** 그리드 영역은 containing block — `place_grid_axis` 단일 함수, 넘침은 자르지 않음 — fixture: gridItemBox
- **§18** `auto` 트랙 §12.8 stretch — 측정 후 판정, `normal`/`stretch` 게이트 — fixture: gridAutoTrackStretch
- **§19** `minmax()` §12.6 는 상한까지 — fixture: gridMinmaxTracks
- **§20** 트랙 크기는 자식 **content 기여** §12.5 — clamp 는 아이템 단위 — fixture: gridTrackContribution
- **§21** 단독 `fr` = `minmax(auto, fr)` — 기여는 margin-box — fixture: basicAxisContainerSize/ChildSize
- **§23** grid item 의 크기 키워드도 stretch 를 이김 — fixture: gridTrackContribution I
- **§24** absolute used size 는 min/max clamp **뒤** 값 · 빈 block 상자도 stretch 폭에서 aspect 높이 전송 — fixture: absClampAspectLeaf
- **§25** grid 암묵 트랙은 **배치 결과**에서 — 크기는 `grid-auto-*` 순환, 셀 폴백 100 없음 (ADR-206) — fixture: gridImplicitTracks
- **§26** auto 축 solve 반환은 **content-box** (layout 은 border-box 별도) — grid 기여/배치는 auto 축 자식에 pad/border 가산 — fixture: paddedLeafIntrinsic
- **§28** BFC 원인 넷 — scroll container · flex/grid item · flow-root/inline-block · abs-pos · block `align-content` 는 in-flow 묶음을 정렬 — fixture: blockFlowRootAlignContent
- **§29** grid `[name]` 은 트랙이 아니다 · auto-repeat 는 반복 밖 트랙 + gutter 를 먼저 뺀다 · auto-fit 빈 트랙은 gutter 까지 삭제 — fixture: gridLineNamesAutoRepeat
- **§30** flex `baseline` 정렬은 **그룹** · `safe` 는 넘칠 때만 start · `self-start`/`self-end` = start/end — fixture: flexBaselineSafeAlign
- **§31** intrinsic 키워드 폭의 보고는 auto 와 같은 **content-box** — 컨테이너 · leaf · grid · flex 3.5 — fixture: catalogComponentBox Tooltip
- **§32** flex item 의 preferred aspect ratio 는 커널 슬롯 22 (`aspect_main_per_cross`) — leaf 는 전송으로 굳힌 축을 content-box 로 보고 (ADR-224) — fixture: (현재 fixture 없음)
- **§33** absolute 자식의 auto 축 — 컨테이너는 content-box + pad/border, **leaf 는 자기 layout (border-box)** · auto 폭 컨테이너는 shrink-to-fit — fixture: —
- **§35** `%` padding / margin 은 **엔진이 containing block 폭으로 푼다** — TS px 선해석 금지 · grid 행은 열 확정 뒤 area 폭으로 · auto 크기는 자식 margin-box extent — fixture: percentPaddingMargin · marginBoxContributionAxes
- **기타** border 폭 = device pixel snap — 엔진은 `resolve_border`, Canvas 는 `snapBorderWidth`. 새 border 소비자는 둘 중 하나를 거친다 — fixture: borderWidthSnap

삭제된 TS 전처리 규칙 (기록만 — production 코드 없음, 부활 금지): grid 자식 스칼라 게이트 `isGridChild` · `coerceGridTrack` · `enrichAvailWidth` (옛 행 22) · `needsWidth` TEXT_LEAF_TAGS 절 (옛 행 27) · root containing block 되돌림 `resolveRootContainingBlock` · `calculateFullTreeLayout` DFS (옛 행 34). 같은 원칙 (텍스트 leaf 스칼라는 부모 display 와 무관 · root 폭은 containing block) 은 `styleOf` 가 엔진에 넘기는 입력으로 유지된다 — 전문은 [layout-css-parity-ledger.md](../skills/composition-patterns/reference/layout-css-parity-ledger.md).

## 배치 직렬화 계약 — 숫자 하나가 페이지 레이아웃을 끈다

엔진 `NodeStyle` 의 길이 필드는 전부 `Option<String>` 이라 숫자가 들어오면 엔진이 **배치 전체**를 거부한다 (`invalid type: integer, expected a string`) → **그 페이지 레이아웃이 통째로 사라진다**. 요소 하나의 값 하나가 페이지 전체를 끄는 구조다.

- production 직렬화기는 `styleOf` (`compositionRoot.ts`) 하나다. 길이는 지역 `px()` 가 숫자를 `"Npx"` 문자열로 바꾼다 (width · height · gap · padding · inset). 새 길이 필드도 `px()` 를 거쳐야 한다.
- 타입별 계약: 길이 = 문자열 / `flexGrow`·`flexShrink`·`aspectRatio`·측정 스칼라 = 숫자(f32) / grid track = 배열 (`containerTracks` → `parseGridTemplate`). `order` 는 `NodeStyle` 미선언이라 무시된다 — 순서는 `NodeEntry.children` 배열이 정본이다.
- **전례 2건** (옛 파이프라인 시절): `rowGap: 4` + `display:grid` (2026-07-06, ProgressBar/Meter/Slider) · `flexBasis:"0px"` block 자식 (2026-07-27). 둘 다 정규화를 우회한 덧쓰기 경로였다.
- 감시: `flexItemDimContract.browser.test.ts` (engine leg 에 문자열 길이를 싣는 계약 fixture).

### 금지 패턴

- ❌ `styleOf` 밖에서 엔진 입력을 덧쓰기 → 정규화를 우회한다 (§금지 패턴)
- ❌ 엔진에 길이를 숫자로 전달 (`flexBasis: 0`) — 숫자→문자열 변환은 직렬화기 책임

## 기본 축은 격자가 잠갔다 — 그 격자가 **못 여는 축** (ADR-170, 2026-07-28)

`basicAxis{ContainerSize,ChildSize,Nesting}.browser.test.ts` 가 display × width × height × min/max × leaf 종류 × 부모 컨텍스트를 **직교**로 훑는다 — 2,702 조합, 도입 시점 727 발산이 wave 1~7 로 **0**. 기본 축의 "미지 규모" 는 여기서 닫혔고, 반응형 발견 사이클은 이 축에 한해 종료다.

닫힌 것은 **열거한 축뿐**이다. 아래는 격자가 못 여는 축이고, 여기서 나온 발산에 격자 green 을 반증으로 들이대면 안 된다:

| 사각                                                 | 담당 / 사유                                                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 텍스트 실측정 sub-pixel                              | 격자는 스칼라 leaf 로 대체 — CanvasKit↔DOM 폰트 차이는 렌더 층 교정 경로. 실텍스트는 `adr248CatalogTextLeafScalar` (catalog 경로)               |
| `position:absolute` 조상 체인 / `fixed`              | 기본형은 `phase4_5` E11. ADR-164 Phase 0 의 **의도적 미지원 2건** 만 사각 — 재개 조건 기정의 (§position:absolute)                               |
| overflow / scroll 상호작용                           | 렌더·히트 축 (canvas-rendering.md §8) — 레이아웃 격자 대상 아님                                                                                 |
| flex wrap 다중 라인                                  | `flexSweep` (WRAPS × LINE_COUNTS) — 격자는 nowrap 고정                                                                                          |
| 정렬 속성 (`justify-*`/`align-*`)                    | `flexSweep` + `crossAxisOverflow` + `gridAlignContent` — 격자는 부모 컨텍스트 신호로만 사용                                                     |
| 중첩 2단 이상                                        | 격자 3 은 1단 전파만 — 조합 폭발. 1단 정합이면 귀납 가정                                                                                        |
| `writing-mode` / `direction` / `float` / inline flow | 일반 IFC는 미지원. 직계 inline text와 atomic inline 조립은 `inline.rs`·`s2InlineLabel.browser.test.ts`로 검증                                   |
| grid `auto-flow: column` 의 행 extent                | ADR-206 Phase 2 (2026-09-07) 로 해소 — 암묵 행이 flow 와 무관하게 선다 (`shrinkToFitInline` 구 `[잔존]` 단언 → 20). 격자는 여전히 row-flow 고정 |
| `gap` / `padding` / `border` 조합                    | 기본 축 밖 — 격자는 0 리셋 고정 (`gridTrackContribution`/`gridMinmaxTracks` 가 부분 커버)                                                       |
| 내용 leaf 의 `height:auto`                           | **오라클 쪽 사각** — engine leg 에 높이 스칼라 채널이 없다 (아래)                                                                               |

- **격자 green ≠ 종결** 의 실증: `flexSweep` 1152 조합은 컨테이너 main 을 항상 확정으로 줘서 미결정 main 센티넬 결함을 **전부 green 으로 통과**시켰다 — 유일 감시자가 `crossAxisOverflow` 의 `INDEFINITE_MAIN_CASES` 였다.
- **사각은 오라클 쪽에도 생긴다**: ADR-165 스칼라 계약이 폭만이라 engine leg 은 내용을 가진 leaf 의 `height:auto` 를 잴 수 없다(DOM 은 원자 높이, 엔진은 0). 격자 2 초안 발산 165건 중 **135건이 이 산출물**이었고, 확정 폭 대조군이 없었으면 엔진 결함으로 **잘못 귀속**될 뻔했다. 높이 축은 production 경로 (catalog root ↔ catalog DOM — `adr248Catalog*` parity) 가 잰다 (옛 `pipelineLeg` 은 2026-10-05 삭제).
- 신규 발산을 만나면 이 표부터 본다 — 표 안이면 담당 fixture 로, 표 밖이면 격자 축에 편입한다.

## TS 잔존 계약 (ADR-164 Phase 3 — 엔진↔TS 경계 규칙, CRITICAL)

다음은 **의도적으로 TS 에 남는** 것들이다. 엔진 gap 처럼 보여도 아래 사유가 유효한 한 엔진 이관·중복 구현 양쪽 모두 금지 — 변경은 해당 사유를 뒤집는 ADR 로만:

| 잔존                                                                                                                                           | 사유                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 텍스트 leaf 측정 스칼라 공급 (`contentMinWidth` · `contentMaxWidth` · `contentHeight` — `compositionRoot.ts` `styleOf` + `catalogTextMeasure`) | 폰트 측정 = CanvasKit paragraph (준비 전 Canvas 2D) 가 oracle. 엔진 자체 텍스트 측정 도입 금지. **경계 = 폰트 측정은 TS / 구조 집계는 엔진** (ADR-169) — 컨테이너 intrinsic 은 자식 값의 집계라 TS 가 공급하면 레이아웃 재구현이 된다 |
| 비텍스트 합성 leaf 측정값 (glyph · drop zone 등, `styleOf`)                                                                                    | 그리는 쪽이 정한 크기 — 엔진이 알 수 없는 콘텐츠 크기만 스칼라로 넘긴다                                                                                                                                                               |
| `rewrap` — **height-for-width 1회 재측정** (`compositionRoot.ts`, 옛 Step 4.5 와 같은 축소 계약, ADR-165 Phase 2)                              | 폭 확정 후 높이 재줄바꿈 재측정만 담당 — 폭 재보정 확장 금지 (폭 축은 엔진 소유)                                                                                                                                                      |
| f32 `Math.ceil` 보정 (`catalogTextMeasure` 의 정수 스칼라)                                                                                     | 엔진 f32 ↔ JS f64 정밀도 경계 — 흡수 대상 아님                                                                                                                                                                                        |
| 레이아웃 재계산 판정 (transaction `impact.layout` + `planRecord` 엔진 입력 diff)                                                               | 문서 transaction 이 판정 정본 — 마샬링 비용 > 계산 비용. 측정 스칼라는 문서 키가 아닌 `styleOf` 파생값이라 diff 가 그대로 잡는다 (§레이아웃 재계산 경로)                                                                              |

역방향(재침식)도 같은 강도로 금지: **CSS 표준 의미론의 새 gap 을 발견하면 TS 보정이 아니라 엔진 구현이 기본 경로** (ADR-164 Decision — Step 5.7 형 coarse 근사 재생산 금지).

**2026-07-28 제거 (ADR-170)**: 컨테이너의 **intrinsic 키워드** 선해석은 잔존 목록에서 빠졌다 — 엔진이 측정으로 정확값을 소유한다 (§컨테이너의 `width: min/max/fit-content`). 컴포넌트별 TS 주입 (`implicitStyles`) 은 2026-10-05 옛 파이프라인과 함께 삭제 — 컴포넌트 구조값은 catalog rule (containerStyles · part rules) 이 공급한다.

## 기타 규칙

- Block-child normalization (구 fullTreeLayout §5.5 width:100% 보정) 은 ADR-923 Phase 5 에서 삭제 — block 컨테이너 안 block 자식의 auto→stretch 는 엔진 block.rs
- 요소 순서: `NodeEntry.children` · `PageEntry.children` 배열 순서가 정본 (ADR-118) — `order_num` 은 없다
- **waterfall = `grid-template-rows: masonry`**: CardView · GridList `layout: waterfall` 이면 `styleOf` 가 이 키워드를 보내고 엔진 `solve_grid_masonry` 가 놓는다. DOM 은 같은 규칙을 `runtime/waterfall.ts` `catalogWaterfallPlace` 가 한다 — lane 규칙을 바꾸면 Rust `masonry_lanes` 와 TS `catalogWaterfallLanes` 를 같이.
- 중첩 flex 의 min-content 측정은 자식 컨테이너의 min-content 를 사용하고, flex 재배치 후에는 원래 main basis 를 보존한다.

## 금지 패턴

- **상자를 바꿀 수 있는 키를 `PAINT_ONLY_VISUAL_KEYS` 에 넣기 금지** → transaction 이 재계산을 건너뛴다 (§레이아웃 재계산 경로 1단계)
- **`styleOf` 를 거치지 않고 엔진 입력을 만들거나 덧쓰기 금지** → 직렬화 계약 (문자열 길이 · track 배열) 이 한 곳에 있어야 한다
- **`editorMutationEffectRegistry.ts` 의 `LAYOUT_*` 상수에 키를 넣어 레이아웃 반영을 고치려 하기 금지** → 테스트용 파생 view 라 production 판정에 쓰이지 않는다
- **TS IFC 시뮬레이션 재도입 금지** (ADR-923 Phase 5, 2026-09-02) → block 부모 + inline-level 자식을 flex row wrap 으로 합성 / inline-block 을 크기 고정 block leaf 로 / block 형제 width:100% 보정 / TS blockify / vertical-align→alignItems 근사 — 전부 삭제됐고 엔진 `display.rs` (outer/inner) + `block.rs` (line box) + `tree.rs` (blockify) 가 맡는다. 기본 display 는 `resolveDefaultDisplay` (catalog 파생 → `INLINE_BLOCK_TAG_CLASSIFICATION` hand → block) 단일 원천
- 텍스트 leaf 에 width/minWidth 주입 재도입 금지 → 측정 스칼라 계약 (`contentMinWidth`/`contentMaxWidth`) 이 대체 (ADR-165 — 재도입 시 스칼라와 이중 적용). 비텍스트 leaf (INTRINSIC_MEASURE/CIRCLE) 의 width 주입 시 minWidth 동시 주입은 잔존 계약 유지
- 자식 보유 컨테이너의 intrinsic 키워드(`min/max/fit-content`) 를 TS 에서 선해석해 주입 금지 → 엔진 소유 (ADR-170 — `measure_intrinsic_width` + `solve_node` 키워드 해소). 자식 없는 합성 leaf 만 예외
- used size clamp 를 부모 intake 에만 걸기 금지 → 인라인 축도 `solve_node` 가 dispatch 전에 clamp (ADR-170 — 상자만 clamp 되고 자식은 clamp 이전 폭으로 배치됨)
- `rewrap` 을 폭 재보정 용도로 확장 금지 → height-for-width 1회 재측정 계약 (ADR-165 Phase 2 — 폭 축은 엔진 소유)
- overflow 기준 flexShrink 주입 보정 (구 Step 5.7) 재도입 금지 → automatic minimum size 는 엔진 소속 (`flex.rs` §4.5, ADR-164 + ADR-165 정확 min-content)
- grid track 문자열 (`gridTemplateColumns: "1fr auto"`) 을 WASM 에 그대로 전달 금지 → `parseGridTemplate` 로 track array 정규화 (`styleOf` 의 `containerTracks` 한 곳)
- `display` 는 **CSS 값 그대로** 엔진 경계로 운반 (`normalizeCssDisplay` — 손실 없는 정규화, 미인식만 `block`) — inline-flex/inline-grid/inline-block 의 outer 를 TS 에서 지우는 정규화 (구 `toBatchDisplay` · `flexStyleAdapter` inline-flex→flex · `toEngineDisplay` inner-only) 재도입 금지. outer(line item)/inner(solver)/flex·grid 자식 blockify 는 엔진 `display.rs`·`tree.rs` 소유 (ADR-923 Phase 5, 2026-09-02)
- 옛 TS 파이프라인 (`fullTreeLayout` · `enrichWithIntrinsicSize` · `applyImplicitStyles` · `propagationRegistry`) 부활 금지 — 엔진 입력은 `styleOf` 하나 (2026-10-05 삭제)

## paths 관리

`paths` 는 production 레이아웃 경로만 — 패널 `builder/layout` · `styles/layout` 은 매칭하지 않는다 (매칭하면 패널 작업에 본 규칙 전량이 실린다). 새 레이아웃 파이프라인 경로가 생기면 frontmatter 에 등재.

## 실제 inline 자식의 측정과 배치 (2026-11-06)

`styleOf`는 `display:inline` 텍스트 leaf의 glyph cluster(UTF-16 범위·advance·높이·baseline)를
`NodeStyle.inlineText`로 전달한다. TS의 `.inline` provider는 글꼴만 측정하고 줄을 배치하지 않는다.
Rust `inline.rs`는 UAX14와 NBSP glue를 자식 경계에 걸쳐 처리하며 line/fragment를 결정한다.
현재 지원 경계는 직계 pure inline text와 atomic inline 자식만 있는 flow다. 중첩 inline 컨테이너,
block 혼합, 전체 bidi/vertical writing 지원으로 확대하지 않는다.

`getLayoutsBatch`의 5-float stride는 유지하고 `getInlineFragmentsBatch`가 sparse fragment를 전달한다.
Canvas의 원본 Text는 편집용 union box를 보존하고 paint 자식만 fragment별로 그린다. fragment를
기존 rule-text 중앙 정렬로 다시 늘리지 않는다. grid intrinsic 측정 snapshot에도 fragment를 보존하고,
inline solve 완료 때 dirty 플래그를 해제하여 다음 편집이 조상까지 전파되게 한다.

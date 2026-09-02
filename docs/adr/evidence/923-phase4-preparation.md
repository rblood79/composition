# ADR-923 Phase 4 — 준비 (패널 · `INTRINSIC_MEASURE_TAGS` 분리 · `resolveDefaultDisplay` · HC1 · DC-6 인벤토리) 실측 기록

> 2026-09-02 · 실행 Claude · 판독 Codex (round 29 대기). 사용자 착수 승인 2026-09-02 (Codex round 28 "Phase 3 닫힘 · Phase 4 진입 가" 근거).
> **동작 무변경 Phase** — 프로덕션 변경은 (a) `needsWidth` 가 읽는 Set 의 이름 (멤버십 동일) 과 (b) 패널 Direction·Alignment 의 flex 판정에 `inline-flex` 포함, 두 가지뿐. catalog · `getElementDisplay` · `INLINE_BLOCK_TAGS` 소비처 나머지 · DC-6 코드는 그대로다.
> base `ee4bd0b9d`. 게이트: G4 전반 · G5.

## 0. 요약

| 항목                          | 결과                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G5 분류표                     | `INLINE_BLOCK_TAG_CLASSIFICATION` 24 = Phase 0 §B 집계 그대로 (role AB 11 · B 6 · ? 7 / display 원천 catalog 17 · hand 7). measure 는 24 전부 true                                                                                                                                                                                         |
| G5 분리 전후 diff             | **0** — 분리 전 커밋 (`ee4bd0b9d`) 에서 같은 fixture 로 캡처한 baseline JSON (31 tag × width 4 변형 = 124 entries) 과 현재 `enrichWithIntrinsicSize` 출력 전부 일치                                                                                                                                                                        |
| G4 전반 (패널)                | `useFlexDirectionKeys` / `useFlexAlignmentKeys` 가 `flex \| inline-flex` 를 flex 로 판정. 테스트 +4 (양성 2 · 음성 2). live: `inline-flex` div → Direction column · Alignment centerTop / `inline-block` → block · []                                                                                                                      |
| `resolveDefaultDisplay(type)` | 신설 · **미배선**. production precedence 소유자 `resolveContainerStylesFallback` 그대로 → hand 7 → `block`. 잔존 spec 3종은 spec 에 `containerStyles` 자체가 없어 `block` (= 현 `getElementDisplay`)                                                                                                                                       |
| HC1                           | browser 게이트 신설: 부모 `childDisplays[i]` (toTaffyDisplay mock 캡처) ↔ 자식 `buildTreeBatch` 도달 display. Button = **inline-block ↔ flex** 로 갈림 → `it.fails` 고정. 대조군 (명시 block 자식) PASS                                                                                                                                    |
| DC-6 overflow cap 인벤토리    | **round 29 수리 후**: 입력 = 팔레트 65 × creation facet (ref 5 · complex 41 · none 19 — production 진입점) + sub-part standalone 21 + 사용자 inline 5 → wasm 경계 캡처: overflow 도달 노드 **19**, cap 실동작 **8** (SelectValue 4 + ListBox/GridList 2 — ref 해석 후 처음 드러남 + inline Button 2). ratchet 고정, Phase 5 제거 목록 등재 |
| 검증                          | layout **474** (+9) · builder 10 영역 1814 · scene+styles 589 · shared 967 · specs 875 · 차등 97/97 · full parity **1049** (기존 2 실패 · expected fail 2 · skipped 2) · type-check PASS                                                                                                                                                   |
| 원복 RED                      | Phase 4 6 조합 (a~~f) + round 29 5 조합 (g~~k) 전부 RED, 복구 md5 일치                                                                                                                                                                                                                                                                     |

## 1. G5 — `INLINE_BLOCK_TAGS` 분류표 + `INTRINSIC_MEASURE_TAGS` 분리

- **분류표**: `utils.ts` `INLINE_BLOCK_TAG_CLASSIFICATION` — 항목마다 `measure: true` · `role` (Phase 0 §B 의 AB / B / ?) · `display` 원천 (`catalog` 파생 가능 / `hand` 손 목록) · `handDisplay` (hand 만, **현재 동작 값**) · `reason`. hand 7 = rule 없음 5 (submitbutton · fancybutton · type · chip · linkbutton) + calendargrid + dateinput — **`handDisplay` 는 현재 값 (전부 `inline-block`) 하나만** 뜻하고, DOM 정합 후보는 `domDisplay` (calendargrid `block` — §9 Q4 · dateinput `inline-block`) + `domEvidence` 로 분리했다 (round 29 r29m2: 종전 calendargrid `handDisplay: "block"` 은 "현재 호환값" 과 "후보값" 두 뜻을 한 필드에 실어 Phase 5 배선 즉시 동작이 바뀔 자리였다). Menu 는 role ? (B7 의도된 차이) 이지만 top-level `inline-flex` 가 파생 가능해 `catalog`.
- **`INTRINSIC_MEASURE_TAGS`** = 분류표에서 `measure` 인 항목 (24 전부) — 명시 목록. `needsWidth` (`utils.ts` `const needsWidth =`) 만 이 Set 을 읽는다. `INLINE_BLOCK_TAGS` 의 다른 소비처 4 (contentHeight 0 early-return 예외 · 높이 계산 시 자기 폭 · `calculateContentWidth` 게이트 · `getElementDisplay`) 는 Phase 5 까지 유지 (reviews/923 r3 과제 2 판정 그대로).
- **분리 전후 diff 0 측정 방법**: 코드 변경 **전** (`ee4bd0b9d`) 에서 임시 테스트가 `enrichWithIntrinsicSize(node, 400, 0, undefined, [], () => [])` 를 24 항목 + 대조군 7 (div · text · label · avatar · breadcrumbs · taglist · tagview) × width 변형 4 (부재 / `auto` / `fit-content` / 120) 에 돌려 style 출력을 `__fixtures__/adr923IntrinsicMeasureBaseline.json` 으로 저장 → 코드 변경 후 `adr923IntrinsicMeasureSplit.test.ts` 가 같은 fixture 로 재계산해 전 entry 동치 대조. fixture props 는 팔레트 기본값 (`getDefaultProps`), rule 없는 5 종은 텍스트만.
- **게이트 9** (`adr923IntrinsicMeasureSplit.test.ts`): ① 24 전부 분류 + role 집계 [11,6,7] + hand 목록 고정 ② `INTRINSIC_MEASURE_TAGS` 멤버십 == `INLINE_BLOCK_TAGS` (Phase 4 불변식 — Phase 5 가 후자를 지우면 이 줄이 빠진다) ③ baseline diff 0 ④ 정적: `needsWidth` 블록이 `INTRINSIC_MEASURE_TAGS.has(type)` 을 읽고 `INLINE_BLOCK_TAGS.has(type)` 을 읽지 않는다 (멤버십이 같아 **기능 게이트로는 원복을 구분할 수 없다** — 정적 게이트가 유일한 결선 잠금) ⑤ 기능: 24 중 23 은 width 부재에서 숫자 width 주입, togglebuttongroup 은 빈 fixture 에서 콘텐츠 폭 0 이라 미주입 (baseline 이 그 사실을 들고 있다), div 는 미주입 ⑥⑦ `resolveDefaultDisplay` (§3) ⑧ hand 항목: `resolveDefaultDisplay` = 현재 값 `inline-block` 전부, 전환 후보 목록 (`domDisplay ≠ handDisplay`) = calendargrid 하나로 고정 + Q4 근거 파일 참조 (r29m2) ⑨ 미배선 잠금 + 의도된 diff 목록 = catalog 17 전부 · hand 0 (r29m2, 종전 "갈리는 항목 > 0" 을 목록으로 고정).

## 2. G4 전반 — 패널 Direction · Alignment 의 flex 판정

- `useLayoutAuxiliary.ts` `isFlexDisplay(display)` = trim·소문자 후 `flex | inline-flex`. `useFlexDirectionKeys` (`display !== "flex" → ["block"]`) 와 `useFlexAlignmentKeys` (`→ []`) 두 곳이 이 술어를 쓴다 (reviews/923 r2 l3). `useLayoutValues.ts:52` 의 `display` 는 값을 그대로 넘기는 읽기라 변경 없음; `TransformSection.tsx:493` 은 이미 `flex || inline-flex` 였다.
- 테스트 +4 (`useLayoutAuxiliary.test.tsx`): inline-flex → `["row"]` / column → `["column"]` · inline-flex row + center/flex-start → `["leftCenter"]` (양성) · inline-block/inline-grid → `["block"]` · inline-block + alignItems → `[]` (음성).
- catalog 가 아직 `flex` 라 Button 등 catalog 컴포넌트의 표시는 무변경 — 사용자가 지정한 `inline-flex` 만 바로잡힌다 (breakdown 서술 그대로).

## 3. `resolveDefaultDisplay(type)` — 신설, 미배선

- 모듈 `engines/defaultDisplay.ts` (breakdown §4 파일표는 `utils.ts` 였으나 `utils.ts ← implicitStyles.ts` 의존 방향 때문에 utils 안에 두면 순환 import — 별도 모듈로 대체, 파일표 갱신).
- 원천 순서: ① `resolveContainerStylesFallback(lower, {}).display` — production 과 같은 단일 precedence 소유자 (top-level `rule.containerStyles` 는 **대체**, 없으면 catalog 4층 merge, 잔존 spec 3종은 spec) ② 분류표 hand 값 ③ `block`.
- **사실 정정 (breakdown "미등록 native 3종은 spec")**: Frame / Group / Slot spec 은 `containerStyles` 를 갖지 않는다 (`Group.spec.ts:111` · `Frame.spec.ts:200` 의 `display: "flex"` 는 Skia shape layout) → spec 경로 `{}` → `block`. 현 `getElementDisplay` 도 세 타입을 `block` 으로 보므로 동일. 테스트가 세 값을 함께 고정.
- 현 값 (Phase 5 의도된 diff 의 근거): AB 11 은 catalog structure `inline-flex` (button · togglebutton 은 top-level `flex` — Phase 5 에서 `inline-flex` 전환), B 5 는 `flex`/`grid`, menu `inline-flex`, **hand 7 은 전부 `inline-block` (현재 값)**. `getElementDisplay` 는 24 전부 `inline-block` → 의도된 diff 목록 = **catalog 17 전부 · hand 0** 을 테스트가 고정하고, `taffyDisplayAdapter.ts` 소스에 `resolveDefaultDisplay` 참조가 없음을 정적으로 잠근다. calendargrid 의 DOM 정합 후보 `block` 은 `domDisplay` 로 분리 — 배선만으로는 바뀌지 않고 Phase 5 Q4 분류에서 전환을 결정한다 (§9 · round 29 r29m2).

## 4. HC1 게이트 (`tests/parity/adr923Hc1ChildDisplay.browser.test.ts`)

- 캡처: production 진입점 `calculateFullTreeLayout` (harness `pipelineLeg`) 을 그대로 돌리며 (a) 부모 시각 = `toTaffyDisplay(display, childDisplays, …)` 의 `childDisplays` — `vi.mock` 으로 adapter 모듈을 감싸 기록 (b) 자식 시각 = `buildTreeBatch` JSON 의 자식 노드 `style.display` (wasm 경계 실제 도달값).
- 현재 사실: block 부모 + style 없는 catalog Button 2 → 부모 `["inline-block","inline-block"]` / 자식 `["flex","flex"]` → `it.fails` 고정 + 사실 자체를 일반 `it` 로 고정 (Phase 5 가 두 값을 `inline-flex` 로 맞추면 `it.fails` → `it`, 사실 고정 테스트는 기대값 갱신). 대조군: 명시 `display:block` 자식 2 → 두 시각 `["block","block"]` 동치 PASS (캡처가 살아 있음의 증거).

## 5. DC-6 overflow cap 인벤토리 (`tests/parity/adr923Dc6OverflowCapInventory.browser.test.ts`)

- **왜 wasm 경계인가**: 노드 측 walker 로 `applyImplicitStyles` → `enrichWithIntrinsicSize` 를 흉내내면 순서가 틀린다 — 부모가 주입한 자식 style (`filteredChildren`) 은 `processedElementsMap` 에 **자식 재귀 뒤** 저장되므로 1-pass 의 자식 enrich 는 raw 를 보고 2-pass 재-enrich 만 주입본을 본다 (`fullTreeLayout.ts` 1945 재귀 → 2039~2059 저장 → 2831 2-pass). 그래서 breakdown 요구대로 production 을 돌리고 `PersistentTaffyTree.prototype.buildFull(batch)` 를 spy 한다 — `buildTreeBatch` JSON 은 이 배열의 `{style, children}` 사영이라 elementId 를 잃는다. batch 치수는 `"21px"` 문자열 (`taffyStyleToRecord`).
- **입력 (round 29 r29m1 수리 — production 생성 SSOT 파생)**: 종전에는 수동 creator 목록 44 + "creator 도 복합 태그도 아닌" catalog leaf 78 을 조합했다. 그 조합은 production 이 만드는 형태를 두 방향으로 놓쳤다 — ToggleButtonGroup · Table · TableView · Calendar · RangeCalendar 는 수동 목록에 없고 `COMPLEX_COMPONENT_TAGS` 라 leaf 에도 못 들어갔고, Card · InlineAlert · Form · Toolbar (· IconButton) 는 production 이 `type:"ref"` instance 를 만드는데 테스트는 leaf 로 만들었다. 수리: `tests/parity/adr923ProductionTrees.ts` 가 **팔레트 (`getPaletteItems`) × creation facet (`resolveComponentEntryRuntime(type).creation.mode`)** — `useElementCreator` 가 소비하는 두 SSOT 그대로 — 에서 트리를 만든다. `reusableOrigin` 5 는 `useElementCreator` 와 같은 형태의 ref instance, `complex` 41 은 production 진입점 `ComponentFactory.createComplexComponent` (store 기록 `addElementsToStore` 만 `vi.mock` no-op — 트리 형태 무변경), `none` 19 는 `getDefaultProps`. 세 arm 전부 production hydration 과 같은 origin seed (`normalizeMainDocument`: ListBox · GridList · Menu 템플릿 origin + reusable 5) 위에서 `resolveCanonicalRefTree` (canonicalSceneModel `resolveSceneGraph` 와 같은 호출) 로 ref 를 해석한다 — ListBox/GridList factory 의 parent 도 `type:"ref"` 라 해석 전에는 production 형태가 아니다. facet 집합 (65 = ref 5 · complex 41 · none 19) 자체를 `EXPECTED_FACETS` 로 고정해 팔레트/facet 변경 시 RED. 보조 arm: 팔레트도 아니고 팔레트 트리 안에도 없는 catalog rule type 21 을 sub-part standalone leaf 로 (열린 writer 만 도달하는 형태 — `subpart` 접두사) + 사용자 inline 5 (div overflow hidden/clip/auto + 긴 Text 자식 · Button overflow hidden/clip + 긴 라벨). run 3: (availW 400, availH 8) · (8, 100000) · (400, 100000).
- **결과 19 행** (ratchet 키 = `${arm} ${type} > ${node} overflow:${v} H… W…` — arm 이 바뀌면 키가 바뀐다, 치수는 로그):

| 트리 > 노드                                                                 | overflow | 높이 cap | 폭 cap  | low (w@availW8, h@availH8) → high     |
| --------------------------------------------------------------------------- | -------- | -------- | ------- | ------------------------------------- |
| palette:ref Card > CardPreview / Card                                       | hidden   | =        | =       | 100%, null (origin 트리, auto-height) |
| palette:complex DisclosureGroup > DisclosureGroup                           | hidden   | =        | =       | null, null                            |
| palette:complex CardView > Card ×3                                          | hidden   | =        | =       | 200px, 160px (명시)                   |
| palette:complex NumberField / SearchField / Select / ComboBox > SelectValue | hidden   | **cap**  | =       | h 8px → 21px                          |
| palette:complex ListBox > ListBox                                           | auto     | **cap**  | =       | h 8px → 164px (sample 행 높이 주입)   |
| palette:complex GridList > GridList                                         | hidden   | **cap**  | =       | h 8px → 164px (sample 카드 높이 주입) |
| palette:complex Tree > Tree                                                 | auto     | =        | =       | 100%, null                            |
| palette:complex Dialog > Dialog                                             | auto     | =        | =       | 400px, null                           |
| inline div hidden / clip / auto                                             | 각각     | =        | =       | 200px, null (auto-height 컨테이너)    |
| inline Button hidden / clip                                                 | 각각     | **cap**  | **cap** | 8px,8px → 390px,30px                  |

- **판정**: production 에서 cap 이 실제로 걸리는 것은 **SelectValue 4** (Select · ComboBox · NumberField · SearchField 의 trigger 값 텍스트 — `implicitStyles.ts` 가 `overflow: hidden` 을 주입하고 height 미지정 → 높이 cap), **ListBox · GridList 2** (production 형태 = origin 에 해석된 컨테이너: overflow auto/hidden + height 미지정 + 정적 items 의 sample 행/카드 높이 164 주입 → 높이 cap. 종전 수동 목록은 ref 를 해석하지 않아 `ListBox > ref H=` 로 봤다 — round 29 판독이 연 발견), 그리고 **사용자가 INTRINSIC leaf 에 inline overflow 를 준 경우** (Inspector Appearance > Overflow 가 `style.overflow` 를 쓴다 — 높이 + 폭 cap). 나머지 11 은 height 명시 (CardView 의 Card 160) 이거나 auto-height 컨테이너라 주입 높이가 엔진 결과로 대체돼 cap 이 살아남지 않는다. 종전에 빠졌던 형태 (complex 5 · ref 4) 는 overflow 도달 노드 0. catalog 에만 overflow 를 둔 타입은 `enrichWithIntrinsicSize` 가 raw `style.overflow` 만 보므로 (`isOverflowClipped`) DC-6 에 닿지 않는다 — `effectiveElement` 는 display 만 merge 하고, `effectiveParent` 는 24 `withParentStyle` 분기에서만 catalog fallback 을 싣는다.
- **Phase 5 등재**: DC-6 제거는 Phase 5 cutover 목록 (TS 시뮬레이션 제거). 제거 게이트 Chrome 케이스 = SelectValue 4 (flex 문맥 — 엔진 §4.5 가 담당해야 함) + ListBox/GridList 2 (production 형태의 컨테이너 — 엔진 scroll-container 술어) + inline Button hidden/clip (block 문맥 auto-height + overflow hidden/clip 은 cap 되지 않는다). clip 만 빼는 부분 수정 금지 (증상 수정).

## 6. 검증 (2026-09-02)

layout 55 files/**474** (465 + G5 9) · builder 10 영역 **1814** · scene + panels/styles **589** (styles +4) · shared **967** · specs **875** · 차등 **97/97** · browser 신규 (HC1 2 + expected fail 1 · DC-6 2 · CalendarGrid Q4 3) · full parity **1049** (기존 GridListItem/Tooltip 2 · expected fail 2 · skipped 2) · `pnpm type-check` PASS. (round 29 수리 전 수치: layout 473 (G5 8) · parity 1045 — r29l1 이 지적한 472/7 은 정적 결선 게이트 추가 뒤 집계를 갱신하지 않은 stale 값이었다.)

**원복 RED** (백업 교체 → 게이트 → 복구, md5 대조):

| 조합                                                               | RED                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| (a) 분류표에서 badge 제거                                          | 4 fail (분류 24 · 멤버십 · baseline diff · 기능)                         |
| (b) `needsWidth` 를 `INLINE_BLOCK_TAGS` 로 원복                    | 1 fail (정적 결선 게이트 — 기능 게이트는 전부 PASS = 멤버십 동일의 증거) |
| (c) 패널 `isFlexDisplay` 원복 (`display !== "flex"`)               | 2 fail                                                                   |
| (d) calendargrid `handDisplay` 제거                                | 2 fail                                                                   |
| (e) `getElementDisplay` 가 button 을 `flex` 로 (Phase 5 흉내)      | HC1 2 fail (`it.fails` 가 통과로 뒤집힘 + 사실 고정)                     |
| (f) `implicitStyles` SelectValue `overflow: hidden` 주입 제거      | DC-6 ratchet 1 fail (SelectValue 4 행 소실)                              |
| (g) round 29: ref arm 을 leaf 로 (구 형태)                         | DC-6 2 fail (facet 집합 검사 + ratchet — Card origin 행 소실)            |
| (h) round 29: complex arm ref 미해석                               | DC-6 ratchet 1 fail (ListBox/GridList 행이 `> ref H=` 로 되돌아감)       |
| (i) round 29: `PALETTE_ORDER` 에서 Table 제거                      | DC-6 facet 집합 1 fail                                                   |
| (j) round 29: calendargrid `handDisplay` → `block` (round 28 상태) | G5 3 fail (현재 값 검사 · hand 후보 목록 · 의도된 diff) + Q4 1 fail      |
| (k) round 29: calendargrid `domDisplay`/`domEvidence` 제거         | G5 1 fail (후보 목록)                                                    |

## 7. Live Exercise (Chrome MCP, 2026-09-02, localhost:5173 · A2 프로젝트 Home)

- 스토어로 `div {display: inline-flex, flexDirection: column, alignItems: center, justifyContent: flex-start, 200×80}` 추가·선택 → Styles 패널 Layout: **Direction = column (3번째 토글) · Alignment = centerTop** (종전에는 block · []). `display` 를 `inline-block` 으로 바꾸면 **Direction = block · Alignment 없음** (음성). Skia 배지 200×80.
- 동작 무변경: 같은 페이지 catalog Button 선택 배지 **69×30** (텍스트 "Button"), 캔버스 렌더 정상. 콘솔 에러 0. 테스트 div 삭제.
- 재현 중 dev 서버가 한 번 전체 재로드됐고 (readiness 게이트 "Preparing the canvas… 100%" 를 지나 정상 복귀), 테스트 div 가 DB 에 저장돼 재로드 뒤 남아 있어 삭제했다.

## 8. breakdown 편차

- `resolveDefaultDisplay` 위치: `utils.ts` → `engines/defaultDisplay.ts` (순환 import 회피). `index.ts` barrel 에서 export.
- "미등록 native 3종은 spec" — spec 에 `containerStyles` 가 없어 실제 값은 `block` (§3).
- DC-6 캡처 지점: `buildTreeBatch` JSON → `PersistentTaffyTree.buildFull(batch)` (같은 데이터, elementId 보존).

## 9. CalendarGrid Q4 (round 29 r29m2 — `tests/parity/adr923CalendarGridQ4.browser.test.ts`)

`calendargrid` 는 rule 은 있으나 catalog display 가 없어 hand 항목이다. 판독 (r29m2) 은 `handDisplay: "block"` 이 현재 값 (`getElementDisplay` → `inline-block`) 이 아니라 Phase 5 후보값이라 배선 즉시 동작이 바뀔 자리인데 production box 측정 (Q4) 이 없다고 지적했다. 측정 3 (전부 통과):

| 측정                                                    | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production 트리 (팔레트 Calendar → factory) 엔진 경로   | 부모 Calendar batch `flex` column (catalog top-level) · CalendarGrid 는 부모 시각 (`getElementDisplay`) `inline-block` = `handDisplay`, **wasm 경계 도달값은 `block`** (flex 자식 → TS `blockifyDisplay`, `fullTreeLayout.ts` `buildNodeStyle`). Calendar 400×272 · CalendarGrid 238×200 @(9,45) · header 238×30 @(9,9)                                                                                                                                                                                                                         |
| mutation (inert 확인)                                   | CalendarGrid 에 `display:block` / `inline-block` 명시 → **layout map 전체 동일** (모든 노드 x/y/w/h). flex 부모 아래에서 outer display 는 inert — Phase 5 가 어느 값을 배선해도 production 트리 결과는 같다                                                                                                                                                                                                                                                                                                                                     |
| 대조군 — 자유 배치 (block 부모 > CalendarGrid + Button) | (a) 엔진 직결 (`harness.engineLeg`, Phase 1 outer/inner 배선 = Phase 5 이후 의미): `inline-block` 이면 Button 같은 줄 @(238,170), `block` 이면 아래 줄 @(0,200) — 축이 살아 있는 유일한 형태. (b) 현 어댑터 경로: 두 값 모두 Button @(238,85) 로 **같다** — IFC 시뮬레이션이 inline-level 형제 때문에 부모를 flex wrap 으로 바꾸고 폭이 주입된 block 형제를 같은 줄에 둔다 (ADR-198 explicit-width-block-sibling 과 같은 원인, Phase 5 제거 대상). DOM 은 이 형태를 Preview `resolveHtmlTag` 로 `<div>` (block) 에 그린다 (`App.tsx` 정적 고정) |
| DOM leg (실 번들 CSS 로 shared `Calendar` 렌더)         | RAC CalendarGrid = `<table>` (computed `table`, outer block-level) · 부모 `.calendar-grids` `flex` · `.react-aria-Calendar` `flex`. Calendar 270×262 · `.calendar-grids` 252×208 @(9,45) · table 238×208 @(9,45) · header 252×30 @(9,9) — grid 폭 238 은 엔진과 일치, 높이 200 vs 208 과 Calendar 폭 400 vs 270 (`width: fit-content`) 은 별개 발산으로 기록만                                                                                                                                                                                  |

**확정**: `handDisplay` = 현재 값 `inline-block` (Phase 5 가 `resolveDefaultDisplay` 를 배선해도 hand 7 동작 무변경 — 의도된 diff 는 catalog 17 뿐), `domDisplay` = `block` (DOM 정합 후보 — production 트리에서는 inert 하고 자유 배치 형태에서는 DOM `<div>` 와 정합). 전환 여부는 Phase 5 Q4 분류 목록에서 결정한다 (breakdown Phase 5 항목 신설). 분류표 계약: hand 항목의 `handDisplay` 는 `getElementDisplay` 의 오늘 값과 같아야 하고 (G5 ① 검사), 후보를 적으면 `domEvidence` 가 따라야 한다.

## 10. Codex round 29 판독 처리 (2026-09-02)

- r29m1 MEDIUM generator-extension-gap — DC-6 입력이 수동 creator 44 + catalog leaf 조합이라 production 생성 형태 (ToggleButtonGroup · Table · TableView · Calendar · RangeCalendar complex 5 는 어느 arm 에도 없고, Card · InlineAlert · Form · Toolbar 는 ref 인데 leaf) 를 못 덮고 facet 집합을 단언하지 않았다 → **수리 76** (§5): 팔레트 × creation facet 파생 + production origin seed/ref 해석 + facet 집합 고정. 새 발견: ListBox · GridList 가 production 형태에서 높이 cap (cap 6 → 8).
- r29m2 MEDIUM evidence-missing — calendargrid `handDisplay: "block"` 이 현재값이 아니라 후보값 → **수리 77** (§3 · §9): `handDisplay` 현재 값 / `domDisplay` DOM 후보 분리 + Q4 browser 게이트 3 + G5 검사 (hand = `getElementDisplay` 오늘 값 · 후보 목록 고정 · 의도된 diff 목록 고정).
- r29l1 LOW — 문서 472/7 → 실제 473/8 (정적 결선 게이트 추가 뒤 미갱신) → **fixed** (§0 · §1 · §6, 현재 474/9).
- r29l2 LOW phasing — Phase 4 CHANGELOG 엔트리가 대상 커밋이 아니라 다른 세션의 workspace 커밋 `a996ccb67` 에 포함됐다 (그 세션이 `git add -A` 로 작업 트리 전체를 담음). **기록**: 이력은 push 돼 재작성하지 않는다; 엔트리 내용은 온전하다. 같은 일이 이번 라운드에도 났다 — 본 수리의 코드 6 파일이 다른 세션 커밋 `5b229437c` (`style(panel): add gradient overlay …`) 에 휩쓸렸고, 본 라운드 커밋은 남은 포맷 정리 + 문서다. 절차: 이 저장소에서 동시 세션이 있는 동안 CHANGELOG/코드 편집은 커밋 직전에 하고, 커밋 메시지에 휩쓸린 커밋을 명시한다.
- r29l3 LOW adr-structure-violation — README 923 행이 "Phase 4 완료" 와 "Phase 4 는 사용자 승인 후" 를 같이 적었고, 문서 diff 에 금지 어휘 1 (911 행의 옛 영어 은어 1건이 Prettier 표 재정렬로 diff 에 재진입) → **fixed** (행 꼬리 제거 · 옛 영어 은어를 `반영` 으로 교체). 표 전체 포맷 변경은 Prettier PostToolUse hook 의 재정렬이라 셀 길이가 바뀌면 불가피 (CLAUDE.md §마크다운 표 편집).
- 동작 변경 0 (분류표 필드 추가 + 테스트/문서) — live exercise 대상 없음. CHANGELOG 면제 (테스트·내부).

# ADR-923 Phase 4 — 준비 (패널 · `INTRINSIC_MEASURE_TAGS` 분리 · `resolveDefaultDisplay` · HC1 · DC-6 인벤토리) 실측 기록

> 2026-09-02 · 실행 Claude · 판독 Codex (round 29 대기). 사용자 착수 승인 2026-09-02 (Codex round 28 "Phase 3 닫힘 · Phase 4 진입 가" 근거).
> **동작 무변경 Phase** — 프로덕션 변경은 (a) `needsWidth` 가 읽는 Set 의 이름 (멤버십 동일) 과 (b) 패널 Direction·Alignment 의 flex 판정에 `inline-flex` 포함, 두 가지뿐. catalog · `getElementDisplay` · `INLINE_BLOCK_TAGS` 소비처 나머지 · DC-6 코드는 그대로다.
> base `ee4bd0b9d`. 게이트: G4 전반 · G5.

## 0. 요약

| 항목                          | 결과                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G5 분류표                     | `INLINE_BLOCK_TAG_CLASSIFICATION` 24 = Phase 0 §B 집계 그대로 (role AB 11 · B 6 · ? 7 / display 원천 catalog 17 · hand 7). measure 는 24 전부 true                                                                            |
| G5 분리 전후 diff             | **0** — 분리 전 커밋 (`ee4bd0b9d`) 에서 같은 fixture 로 캡처한 baseline JSON (31 tag × width 4 변형 = 124 entries) 과 현재 `enrichWithIntrinsicSize` 출력 전부 일치                                                           |
| G4 전반 (패널)                | `useFlexDirectionKeys` / `useFlexAlignmentKeys` 가 `flex \| inline-flex` 를 flex 로 판정. 테스트 +4 (양성 2 · 음성 2). live: `inline-flex` div → Direction column · Alignment centerTop / `inline-block` → block · []         |
| `resolveDefaultDisplay(type)` | 신설 · **미배선**. production precedence 소유자 `resolveContainerStylesFallback` 그대로 → hand 7 → `block`. 잔존 spec 3종은 spec 에 `containerStyles` 자체가 없어 `block` (= 현 `getElementDisplay`)                          |
| HC1                           | browser 게이트 신설: 부모 `childDisplays[i]` (toTaffyDisplay mock 캡처) ↔ 자식 `buildTreeBatch` 도달 display. Button = **inline-block ↔ flex** 로 갈림 → `it.fails` 고정. 대조군 (명시 block 자식) PASS                       |
| DC-6 overflow cap 인벤토리    | 팔레트 트리 44 + leaf 78 + inline 5 를 production 경로로 돌려 wasm 경계 캡처 — overflow 도달 노드 **18**, cap 이 실제로 걸리는 노드 **6** (SelectValue 4 + 사용자 inline Button 2). ratchet 으로 고정, Phase 5 제거 목록 등재 |
| 검증                          | layout **472** (+7) · builder 10 영역 1814 · scene+styles 589 · shared 967 · specs 875 · 차등 97/97 · full parity **1045** (기존 2 실패 · expected fail 2 · skipped 2) · type-check PASS                                      |
| 원복 RED                      | 노드 4 조합 (a 4 · b 1 · c 2 · d 2) + browser 2 조합 (e 2 · f 1) 전부 RED, 복구 md5 일치                                                                                                                                      |

## 1. G5 — `INLINE_BLOCK_TAGS` 분류표 + `INTRINSIC_MEASURE_TAGS` 분리

- **분류표**: `utils.ts` `INLINE_BLOCK_TAG_CLASSIFICATION` — 항목마다 `measure: true` · `role` (Phase 0 §B 의 AB / B / ?) · `display` 원천 (`catalog` 파생 가능 / `hand` 손 목록) · `handDisplay` (hand 만, **현재 동작 값**) · `reason`. hand 7 = rule 없음 5 (submitbutton · fancybutton · type · chip · linkbutton → `inline-block`) + calendargrid (rule 은 있으나 display 없음, DOM UA table → `block`) + dateinput (display 없음, DOM 문맥 inline-flex → `inline-block`). Menu 는 role ? (B7 의도된 차이) 이지만 top-level `inline-flex` 가 파생 가능해 `catalog`.
- **`INTRINSIC_MEASURE_TAGS`** = 분류표에서 `measure` 인 항목 (24 전부) — 명시 목록. `needsWidth` (`utils.ts` `const needsWidth =`) 만 이 Set 을 읽는다. `INLINE_BLOCK_TAGS` 의 다른 소비처 4 (contentHeight 0 early-return 예외 · 높이 계산 시 자기 폭 · `calculateContentWidth` 게이트 · `getElementDisplay`) 는 Phase 5 까지 유지 (reviews/923 r3 과제 2 판정 그대로).
- **분리 전후 diff 0 측정 방법**: 코드 변경 **전** (`ee4bd0b9d`) 에서 임시 테스트가 `enrichWithIntrinsicSize(node, 400, 0, undefined, [], () => [])` 를 24 항목 + 대조군 7 (div · text · label · avatar · breadcrumbs · taglist · tagview) × width 변형 4 (부재 / `auto` / `fit-content` / 120) 에 돌려 style 출력을 `__fixtures__/adr923IntrinsicMeasureBaseline.json` 으로 저장 → 코드 변경 후 `adr923IntrinsicMeasureSplit.test.ts` 가 같은 fixture 로 재계산해 전 entry 동치 대조. fixture props 는 팔레트 기본값 (`getDefaultProps`), rule 없는 5 종은 텍스트만.
- **게이트 7** (`adr923IntrinsicMeasureSplit.test.ts`): ① 24 전부 분류 + role 집계 [11,6,7] + hand 목록 고정 ② `INTRINSIC_MEASURE_TAGS` 멤버십 == `INLINE_BLOCK_TAGS` (Phase 4 불변식 — Phase 5 가 후자를 지우면 이 줄이 빠진다) ③ baseline diff 0 ④ 정적: `needsWidth` 블록이 `INTRINSIC_MEASURE_TAGS.has(type)` 을 읽고 `INLINE_BLOCK_TAGS.has(type)` 을 읽지 않는다 (멤버십이 같아 **기능 게이트로는 원복을 구분할 수 없다** — 정적 게이트가 유일한 결선 잠금) ⑤ 기능: 24 중 23 은 width 부재에서 숫자 width 주입, togglebuttongroup 은 빈 fixture 에서 콘텐츠 폭 0 이라 미주입 (baseline 이 그 사실을 들고 있다), div 는 미주입 ⑥⑦ `resolveDefaultDisplay` (§3).

## 2. G4 전반 — 패널 Direction · Alignment 의 flex 판정

- `useLayoutAuxiliary.ts` `isFlexDisplay(display)` = trim·소문자 후 `flex | inline-flex`. `useFlexDirectionKeys` (`display !== "flex" → ["block"]`) 와 `useFlexAlignmentKeys` (`→ []`) 두 곳이 이 술어를 쓴다 (reviews/923 r2 l3). `useLayoutValues.ts:52` 의 `display` 는 값을 그대로 넘기는 읽기라 변경 없음; `TransformSection.tsx:493` 은 이미 `flex || inline-flex` 였다.
- 테스트 +4 (`useLayoutAuxiliary.test.tsx`): inline-flex → `["row"]` / column → `["column"]` · inline-flex row + center/flex-start → `["leftCenter"]` (양성) · inline-block/inline-grid → `["block"]` · inline-block + alignItems → `[]` (음성).
- catalog 가 아직 `flex` 라 Button 등 catalog 컴포넌트의 표시는 무변경 — 사용자가 지정한 `inline-flex` 만 바로잡힌다 (breakdown 서술 그대로).

## 3. `resolveDefaultDisplay(type)` — 신설, 미배선

- 모듈 `engines/defaultDisplay.ts` (breakdown §4 파일표는 `utils.ts` 였으나 `utils.ts ← implicitStyles.ts` 의존 방향 때문에 utils 안에 두면 순환 import — 별도 모듈로 대체, 파일표 갱신).
- 원천 순서: ① `resolveContainerStylesFallback(lower, {}).display` — production 과 같은 단일 precedence 소유자 (top-level `rule.containerStyles` 는 **대체**, 없으면 catalog 4층 merge, 잔존 spec 3종은 spec) ② 분류표 hand 값 ③ `block`.
- **사실 정정 (breakdown "미등록 native 3종은 spec")**: Frame / Group / Slot spec 은 `containerStyles` 를 갖지 않는다 (`Group.spec.ts:111` · `Frame.spec.ts:200` 의 `display: "flex"` 는 Skia shape layout) → spec 경로 `{}` → `block`. 현 `getElementDisplay` 도 세 타입을 `block` 으로 보므로 동일. 테스트가 세 값을 함께 고정.
- 현 값 (Phase 5 의도된 diff 의 근거): AB 11 은 catalog structure `inline-flex` (button · togglebutton 은 top-level `flex` — Phase 5 에서 `inline-flex` 전환), B 5 는 `flex`/`grid`, calendargrid `block`, menu `inline-flex`, hand 6 `inline-block`. `getElementDisplay` 는 24 전부 `inline-block` → 갈리는 항목 > 0 을 테스트가 고정하고, `taffyDisplayAdapter.ts` 소스에 `resolveDefaultDisplay` 참조가 없음을 정적으로 잠근다 (Phase 5 가 둘 다 뒤집는다).

## 4. HC1 게이트 (`tests/parity/adr923Hc1ChildDisplay.browser.test.ts`)

- 캡처: production 진입점 `calculateFullTreeLayout` (harness `pipelineLeg`) 을 그대로 돌리며 (a) 부모 시각 = `toTaffyDisplay(display, childDisplays, …)` 의 `childDisplays` — `vi.mock` 으로 adapter 모듈을 감싸 기록 (b) 자식 시각 = `buildTreeBatch` JSON 의 자식 노드 `style.display` (wasm 경계 실제 도달값).
- 현재 사실: block 부모 + style 없는 catalog Button 2 → 부모 `["inline-block","inline-block"]` / 자식 `["flex","flex"]` → `it.fails` 고정 + 사실 자체를 일반 `it` 로 고정 (Phase 5 가 두 값을 `inline-flex` 로 맞추면 `it.fails` → `it`, 사실 고정 테스트는 기대값 갱신). 대조군: 명시 `display:block` 자식 2 → 두 시각 `["block","block"]` 동치 PASS (캡처가 살아 있음의 증거).

## 5. DC-6 overflow cap 인벤토리 (`tests/parity/adr923Dc6OverflowCapInventory.browser.test.ts`)

- **왜 wasm 경계인가**: 노드 측 walker 로 `applyImplicitStyles` → `enrichWithIntrinsicSize` 를 흉내내면 순서가 틀린다 — 부모가 주입한 자식 style (`filteredChildren`) 은 `processedElementsMap` 에 **자식 재귀 뒤** 저장되므로 1-pass 의 자식 enrich 는 raw 를 보고 2-pass 재-enrich 만 주입본을 본다 (`fullTreeLayout.ts` 1945 재귀 → 2039~2059 저장 → 2831 2-pass). 그래서 breakdown 요구대로 production 을 돌리고 `PersistentTaffyTree.prototype.buildFull(batch)` 를 spy 한다 — `buildTreeBatch` JSON 은 이 배열의 `{style, children}` 사영이라 elementId 를 잃으므로 한 단계 앞.
- **입력**: factory definition 44 (`createXxxDefinition` + `createElementsFromDefinition`, `factoryDirtyBaseline.audit` 과 같은 목록) + catalog rule 중 creator 도 복합 태그도 아닌 leaf 78 (`getDefaultProps`) + 사용자 inline 5 (div overflow hidden/clip/auto + 긴 Text 자식 · Button overflow hidden/clip + 긴 라벨). run 3: (availW 400, availH 8) · (8, 100000) · (400, 100000). cap 은 `injectHeight > availableHeight` 일 때만 걸리므로 leaf 높이 (21) 보다 작은 8 이 필요했다 (첫 시도 24 는 아무것도 못 잡았다).
- **결과 18 행** (ratchet 키 = 도달·cap 여부, 치수는 로그):

| 트리 > 노드                       | overflow | 높이 cap | 폭 cap  | low (w@availW8, h@availH8) → high  |
| --------------------------------- | -------- | -------- | ------- | ---------------------------------- |
| Tree > Tree                       | auto     | =        | =       | 100%, null                         |
| NumberField > SelectValue         | hidden   | **cap**  | =       | h 8px → 21px                       |
| SearchField > SelectValue         | hidden   | **cap**  | =       | h 8px → 21px                       |
| CardView > Card ×3                | hidden   | =        | =       | 200px, 160px (명시)                |
| Select > SelectValue              | hidden   | **cap**  | =       | h 8px → 21px                       |
| ComboBox > SelectValue            | hidden   | **cap**  | =       | h 8px → 21px                       |
| ListBox > ref                     | auto     | =        | =       | 100%, null                         |
| Dialog > Dialog                   | auto     | =        | =       | 400px, null                        |
| DisclosureGroup > DisclosureGroup | hidden   | =        | =       | null, null                         |
| Card > Card                       | hidden   | =        | =       | 100%, 45px                         |
| CardPreview > CardPreview         | hidden   | =        | =       | 100%, null                         |
| div (inline) hidden / clip / auto | 각각     | =        | =       | 200px, null (auto-height 컨테이너) |
| Button (inline) hidden / clip     | 각각     | **cap**  | **cap** | 8px,8px → 390px,30px               |

- **판정**: production 에서 cap 이 실제로 걸리는 것은 **SelectValue 4** (Select · ComboBox · NumberField · SearchField 의 trigger 값 텍스트 — `implicitStyles.ts` 가 `overflow: hidden` 을 주입하고 height 미지정 → 높이 cap) 과 **사용자가 INTRINSIC leaf 에 inline overflow 를 준 경우** (Inspector Appearance > Overflow 가 `style.overflow` 를 쓴다 — 높이 + 폭 cap). 나머지 12 는 height 명시 (Card) 이거나 auto-height 컨테이너라 주입 높이가 엔진 결과로 대체돼 cap 이 살아남지 않는다. catalog 에만 overflow 를 둔 컴포넌트 (ListBox/Menu/Tree 의 auto 등) 는 `resolveEffectiveOverflow` 소비자 (스크롤·클립) 에는 닿지만 enrich 의 raw `style.overflow` 에는 **닿지 않는다** — DC-6 의 실효 범위는 raw/implicit 주입뿐.
- **Phase 5 등재**: DC-6 제거는 Phase 5 cutover 목록 (TS 시뮬레이션 제거). 제거 게이트 Chrome 케이스 = SelectValue 4 (flex 문맥 — 엔진 §4.5 가 담당해야 함) + inline Button hidden/clip (block 문맥 auto-height + overflow hidden/clip 은 cap 되지 않는다). clip 만 빼는 부분 수정 금지 (증상 수정).

## 6. 검증 (2026-09-02)

layout 55 files/**472** (465 + G5 7) · builder 10 영역 **1814** · scene + panels/styles **589** (styles +4) · shared **967** · specs **875** · 차등 **97/97** · browser 신규 (HC1 2 + expected fail 1 · DC-6 1) · full parity **1045** (기존 GridListItem/Tooltip 2 · expected fail 2 · skipped 2) · `pnpm type-check` PASS.

**원복 RED** (백업 교체 → 게이트 → 복구, md5 대조):

| 조합                                                          | RED                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| (a) 분류표에서 badge 제거                                     | 4 fail (분류 24 · 멤버십 · baseline diff · 기능)                         |
| (b) `needsWidth` 를 `INLINE_BLOCK_TAGS` 로 원복               | 1 fail (정적 결선 게이트 — 기능 게이트는 전부 PASS = 멤버십 동일의 증거) |
| (c) 패널 `isFlexDisplay` 원복 (`display !== "flex"`)          | 2 fail                                                                   |
| (d) calendargrid `handDisplay` 제거                           | 2 fail                                                                   |
| (e) `getElementDisplay` 가 button 을 `flex` 로 (Phase 5 흉내) | HC1 2 fail (`it.fails` 가 통과로 뒤집힘 + 사실 고정)                     |
| (f) `implicitStyles` SelectValue `overflow: hidden` 주입 제거 | DC-6 ratchet 1 fail (SelectValue 4 행 소실)                              |

## 7. Live Exercise (Chrome MCP, 2026-09-02, localhost:5173 · A2 프로젝트 Home)

- 스토어로 `div {display: inline-flex, flexDirection: column, alignItems: center, justifyContent: flex-start, 200×80}` 추가·선택 → Styles 패널 Layout: **Direction = column (3번째 토글) · Alignment = centerTop** (종전에는 block · []). `display` 를 `inline-block` 으로 바꾸면 **Direction = block · Alignment 없음** (음성). Skia 배지 200×80.
- 동작 무변경: 같은 페이지 catalog Button 선택 배지 **69×30** (텍스트 "Button"), 캔버스 렌더 정상. 콘솔 에러 0. 테스트 div 삭제.
- 재현 중 dev 서버가 한 번 전체 재로드됐고 (readiness 게이트 "Preparing the canvas… 100%" 를 지나 정상 복귀), 테스트 div 가 DB 에 저장돼 재로드 뒤 남아 있어 삭제했다.

## 8. breakdown 편차

- `resolveDefaultDisplay` 위치: `utils.ts` → `engines/defaultDisplay.ts` (순환 import 회피). `index.ts` barrel 에서 export.
- "미등록 native 3종은 spec" — spec 에 `containerStyles` 가 없어 실제 값은 `block` (§3).
- DC-6 캡처 지점: `buildTreeBatch` JSON → `PersistentTaffyTree.buildFull(batch)` (같은 데이터, elementId 보존).

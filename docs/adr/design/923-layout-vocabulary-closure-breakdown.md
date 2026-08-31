# ADR-923 Implementation Breakdown: display 이원 계약 — TS IFC 시뮬레이션 제거·엔진 outer/inner 직결 (C′)

> 본 문서는 ADR-923 의 구현 상세 정본이다. ADR 본문은 결정·위험·게이트만 담고, Phase / 파일 경계 / 체크리스트 / 측정 절차는 여기에만 둔다. **r1 개정 2026-08-31** — Codex 설계 리뷰(reviews/923.md) 반영: r0 의 "단일 display 문자열 직결" 을 outer/inner 이원 계약으로, baseline 을 입력에서 출력 계약으로, B 갈래(S4/S7/S8·persisted migration) 는 §8 로 분리. **r2 개정 2026-08-31** — Claude 리뷰 round 2 반영: TS flex/grid 분기 3 사이트(S9) 를 Phase 5 제거 목록에 추가, Phase 4 는 동작 무변경 준비로 축소하고 catalog 전환·`getElementDisplay` catalog 파생은 Phase 5 단일 commit 으로 이동, 패널 `useFlexAlignmentKeys`, 순수 inline code 0 명세, 라인 drift 갱신. **r3 개정 2026-08-31** — Codex round 3: S9 에 TS 운반 타입 union 확장(`layoutTypes.ts:11` / `taffyDisplayAdapter.ts:124`) 추가, G0 캡처 지점을 `buildTreeBatch` 인자 spy 로 고정, Phase 1 은 `classify_child_display` 가 아니라 `parse_display` 직접 사용.

## 1. 문제 정의와 범위

### 1.1 결정 경계

ADR-923 은 **display 의 이중 표현**과 **어댑터가 문서에 없는 의미를 만들어내는 자리**를 없앤다.

- 엔진 경계의 display 는 CSS 값 1개. 엔진이 `display.rs` 로 outer(부모 flow 참여) / inner(자기 solver) 를 해석한다.
- catalog 의 Canvas 전용 display override(DOM `inline-flex` ↔ Canvas `flex`) 를 제거하고 패널을 고친다.
- `INLINE_BLOCK_TAGS` 를 default-display resolver 와 intrinsic-measurement capability 로 분리한다.
- baseline 을 `NodeLayout` 출력으로 상향 전파한다.
- 그 뒤 TS IFC 시뮬레이션 층을 제거한다.

바꾸지 않는 것: canonical 스키마, persisted 문서(migration 없음), catalog 의 시각 값(색·크기·폰트), Preview/publish CSS 생성, D1 DOM/ARIA, D2 props. **B 갈래(S4/S7/S8 ingress 정규화·persisted migration) 는 §8 로 분리 — 본 ADR 은 capability matrix seed 선언까지.**

### 1.2 Domain

| Domain         | ADR-923 영향                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 DOM/접근성  | 없음. Preview 는 기존 runtime 그대로.                                                                                                              |
| D2 Props/API   | 없음. 새 prop 없음.                                                                                                                                |
| D3 시각 스타일 | **layout flow 는 D3**. catalog `containerStyles.display` 의 Canvas 전용 override 제거 = 두 consumer 가 같은 display 값을 받도록 하는 D3 대칭 복구. |

### 1.3 No-fork lock-in (adr-writing.md 4 질문)

1. **base/응용 분류**: ADR-923 은 ADR-916(자체 엔진, Implemented) 과 ADR-198(픽셀 게이트, Accepted) 의 소비자. 둘의 선행 ADR 이 아니다. ADR-198 Phase 6 은 본 ADR 의 차등 케이스를 입력으로 쓰지만 본 ADR 을 기다리지 않는다.
2. **스키마 직교성**: 지속 스키마·persisted 문서 변경 0. wasm 경계 계약(`NodeLayout.baseline` 출력 + `vertical-align`/`line-height` 입력) 은 런타임 계약이지 문서 스키마가 아니다.
3. **의존 방향 반전 점검**: "TS 어댑터가 엔진 제약을 보완한다" 는 ADR-009 시절(Taffy) 전제였고 ADR-916 endgame(`dd5a6e403`) 으로 소멸. r1 에서 하나 더 — "패널 결함을 catalog override 로 보완한다"(2026-06-27) 도 같은 종류의 역방향 보완이며 본 ADR 이 되돌린다.
4. **조기 관점 점검**: scope 는 §1.1 로 동결. B 갈래는 사용자 결정(2026-08-31) 으로 분리. 완전한 IFC(대안 D) 는 기각.

## 2. 실측 인벤토리 (2026-08-31, r0 + r1, 코드 0 변경)

### 2.1 display 가 갈라지는 자리 (r1 핵심)

| 소비자                     | Button 이 받는 display                     | 출처                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM (Preview/publish)      | `inline-flex`                              | `packages/shared/src/components/styles/Button.css:14`                                                                                                                                                 |
| 부모의 자식 분류 (TS)      | `inline-block`                             | `fullTreeLayout.ts:1797 getElementDisplay` → `utils.ts:4400 INLINE_BLOCK_TAGS`                                                                                                                        |
| 자식 자신의 style (TS)     | `flex`                                     | `fullTreeLayout.ts:1031 resolveContainerStylesFallback` ← `componentRulesTable.ts:927` (ToggleButton `:13108` 동일)                                                                                   |
| 자식 style → 엔진 (TS, r2) | `inline-flex` 라도 `"flex"`                | `fullTreeLayout.ts:1057-1060` flex 분기 → `TaffyFlexEngine.ts:111-112` 정규화 (`toTaffyDisplay` 우회); inline-grid 는 `:1077-1084` `{display:"grid"}`; `taffyDisplayAdapter.ts:510-512` inner 만 반환 |
| 엔진 line item 판정        | `"inline-block"` 문자열 일치만 code 1      | `tree.rs:4609`                                                                                                                                                                                        |
| 엔진 solver 선택           | `"flex"/"inline-flex"` → Flex, 그 외 Block | `tree.rs:3598 classify_container_display` (`:1185/:1373/:2552` 호출)                                                                                                                                  |
| `display.rs` outer/inner   | (미배선)                                   | `display.rs:20-45,134-170` — tree.rs 참조 0                                                                                                                                                           |

### 2.2 치환·근사가 일어나는 자리 (capability matrix seed)

| #   | 자리                                                                                                                          | 내용                                                                           | 엔진                                            | 본 ADR 처치                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| S1  | `taffyDisplayAdapter.ts:526-536 toTaffyDisplay`                                                                               | block 부모 + inline-level 자식 → flex row wrap                                 | block.rs line box 구현                          | Phase 5 제거                                              |
| S2  | `taffyDisplayAdapter.ts:436-440 needsBlockChildFullWidth` + `fullTreeLayout.ts:2386` §5.5                                     | S1 안 block 형제 width:100% 보정 (명시 폭이면 미보정 → ADR-198 발산)           | block.rs auto→stretch                           | Phase 5 제거                                              |
| S3  | `taffyDisplayAdapter.ts:244-248 INLINE_BLOCK_LEAF_CONFIG`                                                                     | inline-block 자신 → block leaf + grow/shrink 0                                 | outer=inline 이 line item                       | Phase 5 제거                                              |
| S9  | (r2) `fullTreeLayout.ts:1060-1061,1077-1084` flex/grid 분기 + `TaffyFlexEngine.ts:110-117` + `taffyDisplayAdapter.ts:510-512` | inline-flex/inline-grid 의 outer 를 지우고 inner(`flex`/`grid`) 만 엔진에 전달 | display.rs outer 해석 (Phase 1 배선)            | Phase 5 제거 (CSS 값 통과 — 운반 타입 union 2곳 포함, r3) |
| S6  | `taffyDisplayAdapter.ts:202 resolveInlineBlockAlignItems`                                                                     | vertical-align → flex alignItems 근사                                          | block.rs `vertical_align` 필드 (tree.rs 미소비) | Phase 2 배선 후 Phase 5 제거                              |
| S5  | `utils.ts:4570 needsWidth` (`INLINE_BLOCK_TAGS`)                                                                              | intrinsic width/height 측정 활성화                                             | 측정은 TS 소관(텍스트·self-render leaf)         | Phase 4 **분리 유지** (capability 목록)                   |
| S4  | `taffyDisplayAdapter.ts:521-523`                                                                                              | 순수 `display:inline` 요소 → block 격상                                        | inline box 없음 (code 0/1/2)                    | §8 (B 갈래) — seed 만                                     |
| S7  | float / clear / writing-mode / 다단                                                                                           | 속성 무시 (class 변경 아님)                                                    | 미구현 (ADR-916 1-C)                            | §8 — seed 만                                              |
| S8  | grid subgrid / intrinsic track / dense / baseline                                                                             | 속성 무시 / 폴백                                                               | 미구현 (ADR-916 1-B)                            | §8 — seed 만                                              |

### 2.3 baseline 현황 (r1)

- `tree.rs:4672-4674` — `vertical_align/baseline/line_height` 를 0 / 0 / AUTO 로 고정 전달 ("미소비" 주석 `:4590-4592`).
- `block.rs:370-390 flush_line_box` — `item.baseline` 으로 `line_baseline` 을 잡고 `VALIGN_BASELINE` 항목을 `start_y + line_baseline - item.baseline` 에 둔다 → 입력이 0 이라 전부 top 정렬로 퇴화.
- `NodeLayout` (`tree.rs:296`) = `{x, y, width, height}` — baseline 출력 없음.
- TS `calculateBaseline` (`utils.ts:5121`) — production caller 0 (re-export 만). 자체 폰트 근사라 중첩 inline-flex 의 마지막 in-flow baseline 을 표현 못 함.

### 2.4 `INLINE_BLOCK_TAGS` 24 항목 (r1 — 두 개념 분류는 Phase 0)

`button submitbutton fancybutton togglebutton badge progresscircle type chip checkbox radio switch togglebuttongroup toolbar statuslight link linkbutton breadcrumb icon menu tab disclosureheader …` (`utils.ts:4400-4432`). 두 역할: (a) 기본 display 가 inline-level 인 타입, (b) self-render/텍스트 leaf 라 intrinsic 측정을 켜야 하는 타입. catalog inline-\* display 선언 30건과는 다른 집합.

### 2.5 ingress / live mutation (r1 — B 갈래 분리 근거)

| 경로               | 실측                                                                                                                                                                                                                                                                                           | hydration chain 경유 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------: |
| Style 패널         | `useStyleActions.ts:51 updateSelectedStyle` → store 직접                                                                                                                                                                                                                                       |          ✗           |
| AI assistant       | `services/ai/tools/updateElement.ts:98 updateElementProps` → store 직접                                                                                                                                                                                                                        |          ✗           |
| 팔레트 factory     | `factories/definitions/{DateColor,Form,Overlay}Components.ts` `display:"block"` 11곳                                                                                                                                                                                                           |          ✗           |
| 프로젝트 hydration | `usePageManager.ts:385` migration chain → **IndexedDB persist-back (원값 소실)**                                                                                                                                                                                                               |          ✓           |
| pencil import      | Phase 0 실측 — `collectPencilProps`(`pencil-adapter.types.ts:258-268`) 가 pen 키를 props 로 그대로 복사, display 파생·정규화 0. production 경로는 `importPayloadAdapter.ts:32` ← `importRegistry.ts:144` fetch → 레지스트리 캐시(비영속, ref 해석 전용) — store 도 chain 도 아님 (evidence §E) | ✗ (레지스트리 캐시)  |

### 2.6 낡은 명명

비테스트 파일의 Taffy 식별자 — 코드 라인 기준 7 파일 (`engines/{TaffyFlexEngine,TaffyBlockEngine,persistentTaffyTree,taffyDisplayAdapter,fullTreeLayout,utils}.ts`, `wasm-bindings/layoutTypes.ts`), 파일명 기준 5 (`TaffyGridEngine.ts` 포함) — 합집합 8 (r2 재집계; r1 의 14 는 재현 안 됨). 헤더 `:20 "=== Taffy 시뮬레이션 규칙 ==="`, `:521`.

## 3. Phase 분해

각 Phase 는 독립 commit 가능 상태로 끝난다. HIGH 위험 귀속 Phase 는 **5 (cutover)** 하나. Rust 변경(1·2) 은 seam 미배선 상태에서 cargo test 로 먼저 닫고, TS 배선은 별도 commit. **동작을 바꾸는 TS 변경(catalog 전환 · `getElementDisplay` catalog 파생 · 시뮬레이션 제거 · flex/grid 분기 정규화 제거) 은 전부 Phase 5 단일 commit** — Phase 4 는 동작 무변경 준비만 (r2 m2: 분리 commit 의 중간 상태는 IFC 시뮬레이션이 꺼진 채 flex 분기가 `flex` 를 넘겨 Button 이 세로로 쌓인다).

### Phase 0 — 선행 검사 + inventory freeze + baseline (G0)

- [x] **선행 검사 1케이스** — 완료 2026-08-31 `07c724a37`, 결과 §6 (`apps/builder/tests/parity/displayContract.browser.test.ts` 신규): style 없는 catalog Button 을 block 부모 아래 두고 (a) wasm 경계에 도달한 display 문자열 — `build_tree_batch` 입력을 그대로 캡처 — 이 `inline-flex` 인가, (b) block 부모의 `solve_block` 에서 line item 인가, (c) Button subtree 가 flex solver 를 탔는가 (`__layoutExplain` / trace) 를 단언. **(a) 캡처 지점 (r3l1)**: `pipelineLeg`(`tests/parity/harness.ts:223-270`, 실 진입점 `calculateFullTreeLayout`) 실행 중 `CompositionEngineLayout.prototype.buildTreeBatch`(`wasm-bindings/compositionEngine.ts:167-170`) 를 `vi.spyOn` 해 JSON 인자(`persistentTaffyTree.ts:183-188` 가 직렬화한 batch) 를 받아 Button 노드의 `style.display` 를 읽는다. `engineLeg`(`harness.ts:114-135`) 는 fixture style 로 batch 를 직접 만들어 프로덕션 변환을 우회하므로 (a) 에 쓸 수 없다. binary protocol 은 비활성(`wasm.rs:87-90`) 이라 JSON 경로만 본다. **현재 (a) 는 `flex`, (b) 는 부모 자체가 flex 로 바뀜, (c) 만 참** 임을 실패 테스트(`it.fails`) 로 고정 → 전제 확증. (a) 의 출처는 catalog `:927` 를 거친 `fullTreeLayout.ts:1057-1060` flex 분기 → `TaffyFlexEngine.ts:112` 이지 `toTaffyDisplay` 가 아니다 — catalog 를 `inline-flex` 로 바꿔도 같은 분기가 `flex` 로 정규화하므로 S9 제거 없이는 (a) 가 통과할 수 없다 (r2 m1).
- [x] **완료 2026-08-31 `e6d08237d`** — evidence §A: top-level display 16/123 rule, (i) Button·ToggleButton, (iii) Menu(B7), DOM 미선언 3, (ii-b) Label·Slot; structure 층이 공급하는 17 은 이미 정합. Canvas 전용 display override 전수 (Button `:927`·ToggleButton `:13108` 확인됨): `componentRulesTable.ts` 의 top-level `containerStyles.display` 와 `packages/shared/src/components/styles/*.css` 의 display 를 rule 별로 대조한 표 → §6.
- [x] **완료 2026-08-31** — evidence §B: 24 = B 6 (progresscircle·togglebuttongroup·toolbar·disclosureheader·calendarheader·calendargrid — display 역할이 틀림) · AB 11 · ? 7 (rule 없는 5 + menu(B7) + dateinput). `INLINE_BLOCK_TAGS` 24 항목 분류표: 항목마다 `defaultDisplay(catalog)` / `intrinsicMeasure(이유: 텍스트 leaf | self-render leaf | 합성 leaf)` / `둘 다` → §6. 분류 불가 항목은 사유 기록.
- [x] **완료 2026-08-31** — evidence §C: factory 11곳 전부 leaf → 조합 0 (51 정의 전수도 0), fixture smoke 0, **실 문서 미측정 (사용자 export 필요)**. BC 정량 — (a) factory 11곳의 block 컨테이너가 inline-level 자식을 갖는지 정적 집계, (b) 로컬 프로젝트 스캔(`scripts/adr-923/scan-block-inline.mjs`): "block 컨테이너 + outer=inline 자식" 컨테이너 수 / 전체 컨테이너 수 = 영향 %, 영향 문서 수 / 전체 문서 수 → §6 ("평균 재직렬화 파일 수" 는 C′ 에서 persisted 변경 0 이라 무의미 — 대체).
- [x] **완료 2026-08-31** — evidence §D: arm F p50 21.0 / p95 23.9 ms (5,193) · arm B p50 90.2 / p95 97.2 ms (5,001), `adr923LayoutBaseline.browser.test.ts` (기본 skip, `VITE_ADR923_BASELINE=1`). 성능 baseline — 5k fixture `computeLayout` p50/p95 + block 컨테이너 비율 높은 arm 별도 → §6.
- [x] **완료 2026-08-31** — evidence §E: display 파생·정규화 0, 레지스트리 캐시 경로(비영속), block + inline-level 조합 유입 가능. pencil import 경로가 display 를 어떻게 넣는지 실측 (§2.5 채움 — B 갈래 입력).
- [x] ADR-156 차등 하니스에 "어댑터 우회 + 엔진 직접 호출" 진입점 존재 확인 (r3) — `tests/parity/harness.ts:114-135 engineLeg`(엔진 직접) / `:223-310 pipelineLeg`(프로덕션).

### Phase 1 — `display.rs` 배선: outer → line item, inner → solver (Rust, seam 무변경)

- [ ] 사용 함수는 `display::parse_display` **직접** — `classify_child_display`(`display.rs:138-149`) 는 inline-flex/inline-grid 를 Block 으로 분류하므로 line item 판정에 쓰지 않는다 (r3 과제 3). 해당 함수는 주석 갱신 또는 삭제. `block.rs:144-170` 은 code==1 만 line item 조건, `:211-218` 이 code 2 (empty block).
- [ ] `tree.rs:3598 classify_container_display` → `display::parse_display(d).inner` 로: `Flex`→Flex, `Grid`→Grid, `Flow|FlowRoot`→Block. `:1185/:1373/:2552` 호출부 무변경.
- [ ] `tree.rs:4609 write_block_item` display code → `parse_display(child).outer == Inline` **이고 inner ∈ {flow-root, flex, grid}** 면 1 (inline-block·inline-flex·inline-grid 전부 line item); 순수 `inline`(inner=flow) 은 현행대로 0 (S4 — B 갈래까지 block 격상 유지, r2 l4); 그 외 0. empty-block(2) 판정 유지.
- [ ] blockification: flex/grid 컨테이너의 자식은 solver 진입 시 `display::blockify_display` 로 outer=block (CSS Display 3 §2.7). 현재 TS 가 하던 `blockifyDisplay` (`fullTreeLayout.ts:1796`) 의 Rust 대응.
- [ ] cargo test: Button(`inline-flex`) 이 block 부모에서 line item + 자기 자식은 flex 로 배치되는 케이스, inline-grid 동형, 순수 inline(outer=inline, inner=flow) 은 **현행대로 block 격상(code 0)** 을 명시 테스트로 고정 (S4 — 본 ADR 밖, 동작 무변경 확인용).
- [ ] `display.rs` 의 `taffyDisplayAdapter.ts:NNN` 참조 주석 → 배선 사실로 갱신.

### Phase 2 — baseline 출력 계약 + 입력 2종 (Rust + wasm 경계)

- [ ] `NodeLayout` 에 `baseline: f32` 추가 (`tree.rs:296`). 의미: 노드 top 기준 첫(또는 CSS 규칙상 해당) in-flow baseline. 없으면 `height` (bottom 폴백 — CSS 2.1 §10.8.1 inline-block 의 in-flow line box 없음 규칙).
- [ ] leaf: 텍스트 측정값(첫 줄 ascent + line-height 보정) 을 TS→엔진 **입력**(`NodeStyle.leafBaseline: Option<f32>`) 으로 전달 — leaf 의 baseline 은 텍스트 측정 결과라 입력이 맞다. `calculateBaseline` 은 폐기하고 Skia Paragraph 측정값을 쓴다.
- [ ] container: `solve_block` 은 마지막 line box 의 baseline, `solve_flex` 는 첫 flex line 의 첫 baseline-참여 item baseline (CSS Flexbox §8.5), `solve_grid` 는 첫 row 의 첫 item — 각 solver 가 자식 `NodeLayout.baseline` 을 읽어 자기 baseline 을 **출력**.
- [ ] `write_block_item` 이 자식 `NodeLayout.baseline` 과 style 의 `vertical_align`/`line_height` 를 실제로 넣도록 (`tree.rs:4672-4674` "미소비" 해소). `NodeStyle` 에 `vertical_align: Option<u8>`, `line_height: Option<f32>` 추가 (cascade.rs/style.rs).
- [ ] wasm 경계: `build_tree_batch` 입력에 `leafBaseline`/`verticalAlign`/`lineHeight`, 출력에 `baseline` 추가. TS `TaffyBlockEngine.ts`(개명 전) 에서 통과.
- [ ] cargo test + golden: golden 갱신은 **Chrome 값으로만** (Phase 3 케이스에서 얻은 값).

### Phase 3 — Chrome 차등 증명 (G1 전반)

- [ ] 차등 케이스 ≥ 12 (ADR-156 하니스, 실 Chrome `getBoundingClientRect`): inline-block 2개 한 줄 / wrap / **명시 폭 block 형제**(ADR-198 재현) / auto 폭 block 형제 / vertical-align top·middle·bottom·baseline / line-height 명시 / 자식 margin / empty block 형제 / 부모 padding / **inline-flex 컨테이너(Button) + 텍스트 leaf baseline** / inline-grid.
- [ ] **어댑터 우회**로 엔진 outer/inner 경로에 직접 넣어 실행(테스트 전용 진입점). (전) 현 어댑터 경로 결과도 같은 표에 나란히 기록 (대조군).
- [ ] 통과: 위치·크기 ≤ 1px. 실패 케이스 = 엔진 결함 → Phase 1·2 수리 → 재실행. **강등 없음.**

### Phase 4 — 준비: 패널 · `INTRINSIC_MEASURE_TAGS` 분리 · HC1 테스트 (G4 전반 · G5) — **동작 무변경**

- [ ] 패널: `useLayoutAuxiliary.ts:71 useFlexDirectionKeys` + `:99 useFlexAlignmentKeys` — `display` 가 `flex | inline-flex` 면 flex (r2 l3). `useLayoutValues.ts:52` specPreset.display 소비처 동형. Direction·Alignment 가 `display:inline-flex` 요소를 flex-row 로 표시하는 테스트 (2026-06-27 회귀 방지). catalog 가 아직 `flex` 라 Button 표시 무변경 — 사용자 지정 `inline-flex` 만 바로잡힌다.
- [ ] `INTRINSIC_MEASURE_TAGS` (Phase 0 분류표의 intrinsicMeasure 항목, **명시 목록 유지**) 신설 → `needsWidth` (`utils.ts:4570`) 만 이 목록을 소비. G5 diff: 분리 전후 `enrichWithIntrinsicSize` 출력이 대표 fixture 에서 diff 0.
- [ ] `resolveDefaultDisplay(type)` (catalog `containerStyles.display` 파생, 미등록 native 3종은 spec) 함수 + 단위 테스트 추가. **`getElementDisplay` 배선은 Phase 5** — 지금 배선하면 catalog `flex` 가 부모 판정으로 새어 `classifyChildDisplay`(`taffyDisplayAdapter.ts:334-347`) 가 block 으로 분류 → IFC 시뮬레이션 해제 → Button 세로 적층 (r2 m2). `INLINE_BLOCK_TAGS` 는 Phase 5 까지 유지.
- [ ] HC1 테스트: `fullTreeLayout` 단위 테스트에서 `childDisplays[i]` == 자식 노드에 전달된 `display` 단언 — 현재 Button 은 `inline-block` vs `flex` 로 **실패**(`it.fails` 고정) → Phase 5 에서 통과로 전환.
- [ ] catalog 는 이 Phase 에서 **건드리지 않는다** (r1 의 "같은 commit" 은 Phase 5 로 이동).

### Phase 5 — cutover: TS IFC 시뮬레이션 제거 (G1 후반 · G2 · G3) — **HIGH 귀속, 단일 commit**

- [ ] catalog: `componentRulesTable.ts:927` Button · `:13108` ToggleButton · Phase 0 표의 다른 override → `containerStyles.display` 를 DOM 과 같은 값(`inline-flex`) 으로. `componentRulesTable.ts` 는 직접 편집 정본(헤더 `:1-9`, 생성기 없음).
- [ ] `getElementDisplay` → `resolveDefaultDisplay` 배선, `INLINE_BLOCK_TAGS` 삭제. `getElementDisplay` 출력이 Button 류에서 `inline-block`→`inline-flex` 로 바뀌는 것이 **의도된 diff** — 목록으로 고정.
- [ ] S9 (r2 m1): `fullTreeLayout.ts:1060-1061` flex 분기와 `:1077-1084` grid 분기가 record 의 `display` 를 CSS 값 그대로(`inline-flex`/`inline-grid` 보존) 넣도록; `TaffyFlexEngine.ts:110-117` 의 `inline-flex → "flex"` 정규화 삭제 (flex 컨텍스트 기본값 `flex` 는 유지); `taffyDisplayAdapter.ts:510-512` inner-only 반환 삭제. outer/inner 해석은 Phase 1 의 `display.rs` 가 맡는다. **운반 타입 (r3m1)**: `wasm-bindings/layoutTypes.ts:11 TaffyDisplay` 를 CSS display union(`block | inline-block | flex | inline-flex | grid | inline-grid | inline | none`) 으로, `taffyDisplayAdapter.ts:124 TaffyDisplayConfig.taffyDisplay` 를 같은 union 으로 확장 (CSS 값 통과 계약). `TaffyBlockEngine.ts:117-118` 대입은 그대로. focused type-check 1건 포함.
- [ ] `toTaffyDisplay`: block 부모는 자식과 무관하게 `{ taffyDisplay: "block" }`. `INLINE_BLOCK_PARENT_CONFIG`, `INLINE_BLOCK_LEAF_CONFIG`, `resolveInlineBlockAlignItems`, `isInlineBlockSimulationParent`, `needsBlockChildFullWidth` 삭제. 자식 display 는 CSS 값 그대로 전달.
- [ ] `fullTreeLayout.ts` §5.5 width:100% 보정 삭제, `:1154-1156` 주석 재작성, TS `blockifyDisplay` 호출(`:1796`) 은 Phase 1 의 Rust blockify 로 대체돼 삭제.
- [ ] Phase 3 케이스를 **프로덕션 경로**로 재실행 → 통과 (G1 후반). HC1 테스트 `it.fails` → pass 전환. G0 선행 검사 (a)(b)(c) pass 전환.
- [ ] G4 후반: override 전수 표가 0 · 패널 테스트 재통과 · `blockInlineProbe` 로 block 부모 + Button 2 가 한 줄.
- [ ] ADR-198: `crossLeg.browser.test.ts` `KNOWN_LAYERS["catalog-state-paint"]` 를 **결과로만** 갱신, `blockInlineProbe` 4 변형 두 leg 일치. 예산 무변경.
- [ ] 성능: Phase 0 baseline 대비 p95 ≤ +5% (block arm 포함) (G3).
- [ ] 회귀: builder/shared/specs vitest + cargo test + `pnpm gate:visual-parity` full.
- [ ] 런타임 플래그 금지. 실패 시 이 commit 만 revert.

### Phase 6 — 명명 정리 + capability matrix seed + 문서

- [ ] Taffy 식별자 8 파일(코드 7 + 파일명 5 합집합) 개명 (`taffyDisplayAdapter.ts → displayAdapter.ts`, `TaffyBlockEngine.ts → blockStyleAdapter.ts`, `TaffyStyle → EngineStyle`, `toTaffyDisplay → toEngineDisplay` …). 동작 무변경 commit.
- [ ] 헤더 재작성: "시뮬레이션 규칙" 절 삭제 → "번역 규칙 + display 이원 계약(`display.rs`) 참조".
- [ ] capability matrix **seed** (`apps/builder/src/builder/workspace/canvas/layout/engines/layoutCapabilityMatrix.ts`): 행 = `{ property, value, engineSupport: "native"|"partial"|"none", policy: "pass"|"declared-substitution"|"ignored", oracle?: string }`. §2.2 의 S4/S7/S8 을 `ignored`/`declared-substitution` 으로 **선언만**, 각 항목의 현재 Chrome 격차 수치를 1 케이스씩 기록. 집행(게이트 테스트·정규화) 은 §8.
- [ ] `docs/CHANGELOG.md` (사용자-가시: block 컨테이너 안 inline-level 배치가 Chrome 과 일치, Button Direction 표시 정정), ADR-198 breakdown catalog 발산 종결 표기, ADR-916 완료 문서에 "명명 잔재 ADR-923 정리" 각주.
- [ ] `### Live Exercise` → Implemented 승격.

## 4. 파일 변경표

| 파일                                                                                   | Phase | 변경                                                                                                                       |
| -------------------------------------------------------------------------------------- | :---: | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/tests/parity/displayContract.browser.test.ts` (신규)                     | 0·3·5 | 선행 검사 1케이스(it.fails → pass), 차등 케이스 ≥12                                                                        |
| `scripts/adr-923/scan-block-inline.mjs` (신규)                                         |   0   | BC 정량                                                                                                                    |
| `packages/composition-engine/src/tree.rs`                                              |  1·2  | `display.rs` 배선(4곳), blockify, `NodeLayout.baseline`, 입력 2종                                                          |
| `packages/composition-engine/src/display.rs`                                           |   1   | 주석 갱신 (배선 사실)                                                                                                      |
| `packages/composition-engine/src/block.rs`                                             |   2   | 자식 baseline 소비, 마지막 line box baseline 출력                                                                          |
| `packages/composition-engine/src/{flex,grid}.rs`                                       |   2   | 컨테이너 baseline 출력                                                                                                     |
| `packages/composition-engine/src/{cascade,style,wasm}.rs`                              |   2   | `leafBaseline`/`verticalAlign`/`lineHeight` 입력, `baseline` 출력                                                          |
| `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyBlockEngine.ts`         | 2·5·6 | 입력 통과; leaf config 제거; 개명                                                                                          |
| `packages/shared/src/catalog/generated/componentRulesTable.ts` (직접 편집 정본)        |   5   | Button `:927`·ToggleButton `:13108` 등 Canvas 전용 display override 제거 (DOM 값) — cutover 와 같은 commit                 |
| `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyFlexEngine.ts`          |  5·6  | `:110-117` inline-flex 정규화 삭제 (S9); 개명                                                                              |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutTypes.ts`               |  5·6  | `:11 TaffyDisplay` union → CSS display 값 (S9, r3m1); 개명                                                                 |
| `apps/builder/src/builder/panels/styles/hooks/{useLayoutAuxiliary,useLayoutValues}.ts` |   4   | `:71`·`:99` inline-flex 를 flex 로 판정 (동작 무변경 — catalog 는 Phase 5)                                                 |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`                    |  4·5  | 4: `INTRINSIC_MEASURE_TAGS` + `resolveDefaultDisplay` 추가(미배선) · 5: `getElementDisplay` 배선, `INLINE_BLOCK_TAGS` 삭제 |
| `…/engines/fullTreeLayout.ts`                                                          |  4·5  | 4: HC1 테스트 대상 · 5: `:1060,1084` 분기 CSS 값 보존, §5.5·blockify 호출 삭제                                             |
| `…/engines/taffyDisplayAdapter.ts`                                                     |  5·6  | IFC 시뮬레이션 제거 + `:510-512` inner-only 반환 삭제, `:124` union 확장 → 번역만; 개명                                    |
| `…/engines/layoutCapabilityMatrix.ts` (신규)                                           |   6   | seed 선언                                                                                                                  |
| `apps/builder/tests/visual-parity/compare/{crossLeg,blockInlineProbe}.browser.test.ts` |   5   | ratchet 결과 갱신                                                                                                          |
| `docs/CHANGELOG.md`, ADR-198 breakdown, ADR-916 완료 문서                              |   6   | 문서                                                                                                                       |

## 5. 검증 계획

| 검증                    | 도구                                                     | 기준                                                                      |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| 전제 (G0)               | 선행 검사 1케이스, wasm 경계 캡처                        | 현재 실패 확증 → Phase 5 후 통과                                          |
| 엔진 기하 ≡ Chrome (G1) | ADR-156 하니스, `@vitest/browser` Chromium               | ≥12 + baseline 케이스, ≤1px, 허용치 무변경, (전)/(후) 나란히              |
| 두 leg 픽셀 (G2)        | `pnpm gate:visual-parity` full                           | catalog-state-paint L1 pass, 예산 무변경                                  |
| 성능 (G3)               | Phase 0 스크립트                                         | p95 ≤ +5%, block arm 포함                                                 |
| catalog·패널 (G4)       | 패널 단위 테스트 + override 전수 표 + `blockInlineProbe` | (4) Direction·Alignment inline-flex 표시 · (5) override 0, Button 2 한 줄 |
| 분리 (G5)               | `enrichWithIntrinsicSize` diff, 분류표                   | diff 0, 24 항목 전부 분류                                                 |
| display 단일 표현 (HC1) | `fullTreeLayout` 단위 테스트                             | `childDisplays[i]` == 전달 display                                        |
| 회귀                    | builder/shared/specs vitest + cargo                      | 전량 PASS, fixture 변경 금지                                              |
| live (G6)               | 실제 빌더 Chrome MCP                                     | block 컨테이너 + Button 2 + 폭 명시 div: Canvas·Preview·패널 일치         |

## 6. Phase 0 측정 결과 (착수 시 채움)

- 선행 검사 (a)/(b)/(c) 현재 값 (2026-08-31, 실행 Codex gpt-5.6-sol `07c724a37`, 독립 재실행·raw 판독 Claude): `buildTreeBatch` JSON 1회 호출, 노드 3. **(a) Button display = `"flex"`** (기대 `inline-flex` — 실패, 사실 4·10 확증) · **(b) parent display = `"flex"`** + `flexWrap:"wrap"` + `alignContent:"flex-start"` (= `INLINE_BLOCK_PARENT_CONFIG` 서명, 기대 `block` — 실패, 사실 3 확증) · **(c) Button inner=flex = true**. `it.fails` 로 고정, Phase 5 후 `it` 전환. raw: `apps/builder/tests/parity/.artifacts/adr-923-g0-capture.json` (untracked). Button 경계 style 에 `width:36px height:30px minWidth:68px padding 4/12 border 1 gap 8` — catalog 값이 도달함(경로 자체는 살아 있음, display 만 정규화됨).
- Canvas 전용 display override 표 (2026-08-31, Claude, `e6d08237d`): [evidence/923-phase0-inventory.md](../evidence/923-phase0-inventory.md) §A — rule **123** (ADR "121" 정정) 중 top-level display 16. 일치 10 · **(i) 2** Button `:927`·ToggleButton `:13108` (flex vs DOM inline-flex) · **(iii) 1** Menu `:6775` (inline-flex vs DOM flex — ADR-151 B7 의도된 D1 차이, HC2 예외 판정 필요) · DOM 선언 없음 3 TableHeader·TableBody·Tree · (ii-a) 17 (top 없음, `structure.containerStyles` 가 inline-\* 공급 — Canvas 는 ADR-171 Phase 3 이후 structure 층을 읽으므로 이미 정합, override 아님) · **(ii-b) 2** Label·Slot (DOM inline-flex, Canvas block 기본). Phase 5 전환 후보 = 2+1+3+2 = 8. catalog inline-\* 선언 29 (ADR "30" 정정). 관찰: generated CSS 27 파일 미import, 수동↔generated display 충돌 4건 (Checkbox·Radio·Breadcrumbs·MenuItem) — live DOM 으로만 확정.
- `INLINE_BLOCK_TAGS` 24 분류표: [evidence/923-phase0-inventory.md](../evidence/923-phase0-inventory.md) §B — 실제 24 (ADR 일치). **A 0 · B 6** (progresscircle·togglebuttongroup·toolbar·disclosureheader·calendarheader·calendargrid — DOM/catalog 가 block-level 인데 부모가 inline-block 으로 봄, 측정 목록에만 남겨야 함) · **AB 11** (button·togglebutton·badge·checkbox·radio·switch·statuslight·link·breadcrumb·icon·tab) · **? 7** (submitbutton·fancybutton·type·chip·linkbutton — catalog rule 없음·생성 참조 0 / menu — B7 / dateinput — catalog display 없음). R5 선례 = `073751610` (2026-06-08) needsWidth 게이트 `utils.ts:4570-4572` → `calculateContentWidth` 미호출 → width 0. G5: ? 5건은 손 목록 유지 + 사유 기록.
- 영향 % / 영향 문서 수 / factory 11곳 자식 분류: [evidence/923-phase0-inventory.md](../evidence/923-phase0-inventory.md) §C — factory 11곳 전부 leaf(자식 0) → "block 컨테이너 + inline-level 자식" 조합 **0**; 51 정의 전수 instantiate 도 0 (현행·C′ 규칙). 스캐너 `scripts/adr-923/scan-block-inline.mjs` (상수 추출 123/123 일치) fixture smoke: 2 노드 · block 컨테이너 1 · 영향 0. **실 문서 분포 미측정** — `apps/builder/tests/parity/.artifacts/projects/*.json` 사용자 export 후 같은 명령으로 채움. "평균 재직렬화 파일 수" 는 persisted 변경 0 (HC7) 이라 무의미 → 영향 컨테이너 %·영향 문서 수로 대체. 실제 조합은 factory 가 아니라 사용자가 body/frame 에 Button 류를 놓을 때 생긴다 (G0 케이스).
- p50/p95 baseline (flex 위주 / block arm): [evidence/923-phase0-inventory.md](../evidence/923-phase0-inventory.md) §D — `adr923LayoutBaseline.browser.test.ts` (기본 skip, `VITE_ADR923_BASELINE=1 pnpm --filter @composition/builder exec vitest run --config vitest.browser.config.ts tests/parity/adr923LayoutBaseline.browser.test.ts`). **arm F** (root flex-column → 8 row(wrap) → 8 column → 8 row(wrap) → 9 box 40×20, 5,193 노드) **p50 21.0 / p95 23.9 ms** · **arm B** (root block → 100 block → 49 catalog Button, 5,001 노드) **p50 90.2 / p95 97.2 ms**. HeadlessChrome 151 · Apple M4 Pro · DPR 1 · `resetPersistentTree` 후 full build, warm-up 5 + 30. G3 = 같은 규칙 재측정 p95 ≤ +5% (F 25.1 / B 102.1 ms). raw `.artifacts/adr-923-layout-baseline.json` (untracked).
- pencil import display 경로: [evidence/923-phase0-inventory.md](../evidence/923-phase0-inventory.md) §E — (1) `pencil-adapter.types.ts:258-268 collectPencilProps` 가 pen 키를 props 로 그대로 복사, `.pen` 속성 → `style.display` 파생 규칙 0 (pen 에 `style.display` 가 있으면 검증 없이 통과). (2) `importPencilDocument` production caller 0; 실경로 `importPayloadAdapter.ts:32` ← `importRegistry.ts:144` fetch → `loaded` 캐시(`:99`, 비영속) → `storeBridge.ts:108` ref 해석 — hydration chain ✗, store ✗. builder 에 `.pen` 열기 UI 없음. (3) frame(catalog display 없음 → block) + `icon_font`→Icon / `metadata.compositionType` Button → 조합 유입 가능, 단 read-only ref 해석용.

## 7. 롤백

- Phase 5 단일 commit revert. Phase 1·2 는 seam 무변경(1) / 계약 추가(2) 라 revert 시 TS 통과 코드만 동반 revert. Phase 4 는 동작 무변경(패널 허용·목록 분리·미배선 함수·테스트) 이라 단독 revert 가능. catalog 전환·`getElementDisplay` 배선·S9 는 Phase 5 commit 안에 있어 함께 revert.
- persisted 문서 변경 0 → 데이터 롤백 불필요.

## 8. 별도 결정으로 넘기는 것 (B 갈래 — 사용자 결정 2026-08-31)

본 ADR 에서 제외. 후속 결정이 갖춰야 할 요건을 r1 실측으로 기록한다:

- **S4 순수 `display:inline` 요소** — 정규화하려면 (a) store 쓰기 경로(`updateSelectedStyle`/`updateElementProps`) 를 chokepoint 로 삼아 세션 중 유입을 막고, (b) hydration persist-back 은 **원값 보존**(예: `style.__authoredDisplay`) 없이는 금지, (c) 패널 `DISPLAY_OPTIONS` 노출 조정을 같이. 그 전까지는 capability matrix 에 `ignored` (block 격상) 로 선언.
- **S7 float/clear/writing-mode/다단** — 패널 노출 없음 확인, import strip 여부 결정. `ignored` 선언 + Chrome 격차 1 케이스.
- **S8 grid 미구현 4종** — `declared-substitution` + 차등 케이스로 수치 고정. 구현은 별도 ADR.
- **capability matrix 집행** — matrix 밖 property 무시가 발생하면 게이트 실패로 만드는 테스트. seed 는 본 ADR Phase 6.
- 완전한 IFC(대안 D), ADR-198 Phase 6 매트릭스 — 각각 별도.

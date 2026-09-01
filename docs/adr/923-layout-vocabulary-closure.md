# ADR-923: display 이원 계약 — TS IFC 시뮬레이션 제거·엔진 outer/inner 직결 (C′)

## Status

Accepted — 2026-09-01 (Phase 1 착수 승인 — 사용자 2026-09-01, 실행 Claude · 판독 Codex; Proposed 2026-08-31, 리뷰 5 round 전부 fixed 로 전제 확정) · **r1 개정 2026-08-31** (Codex 설계 리뷰 5건 전부 성립 → 선택안 C 를 C′ 로 개정, B 갈래(ingress 정규화·persisted migration) 는 별도 결정으로 분리 — 사용자 결정 2026-08-31. 리뷰 기록: [reviews/923.md](reviews/923.md)) · **r2 개정 2026-08-31** (Claude 리뷰 round 2 반영 — m1 TS flex/grid 분기 3 사이트가 inline-\* 의 outer 를 지움 → Phase 5 제거 목록에 추가, m2 Phase 4 단독 commit 중간 상태 회귀 → 동작 변경은 전부 Phase 5 단일 commit, l3 `useFlexAlignmentKeys`, l4 순수 inline code 명세, 라인 drift 5 갱신) · **r3 개정 2026-08-31** (Codex 리뷰 round 3 — r3m1 TS 운반 타입 union 이 block-level 4 값만 허용 → Phase 5 S9 에 union 확장, r3l1 G0 캡처 지점을 `buildTreeBatch` 인자 spy 로 명시; Decision 재개 조건 미충족 확인) · **Phase 0 (b) inventory 완료 2026-08-31 `e6d08237d`** (실행 Claude — 사용자 지시로 Codex 대체; [evidence/923-phase0-inventory.md](evidence/923-phase0-inventory.md): override 전수 rule 123 — 정확값 불일치 13 ((i) 2 · (iii) 1 · structure≠DOM 2 · catalog 없음 8; outer 차이 6) · DOM 충돌 3 · 미선언 17 / `INLINE_BLOCK_TAGS` 24 = B 6 · AB 11 · ? 7 / factory 조합 0 · 실 문서 미측정 / baseline arm F p95 23.9 ms · arm B p95 97.2 ms / pencil import 는 display 정규화 0 · 레지스트리 캐시 경로. G0 = (a)+(b) 완료 — Phase 1 진입은 사용자 승인 후) · **Codex 판독 round 4 (evidence-verification) 2026-08-31** — MEDIUM 1 (r4m1 정확값 재집계) · LOW 4 전부 fixed ([reviews/923.md](reviews/923.md)) · **r4 개정 2026-08-31** (Codex 판정 3건, reviews round 5 — ① HC2 는 정확값 유지·outer 기준 기각, 비교 대상 = 같은 역할의 실제 렌더 box 의 production 소비 경로 exact display, evidence 13 은 Phase 5 전환 목록이 아니라 Q4 판정 후보 (확정 전환 Button·ToggleButton 2) ② Menu 는 값 예외가 아니라 비교 대상 DOM box 지정 (`MenuTrigger > Button` inline-flex, popover 제외) ③ G3 단일 run 폐기 → 고정 N=3 before/after 교대 paired ratio 중앙값 ≤ 1.05) · **Phase 1 완료 2026-09-01 `5822f2496`** (display.rs 배선 — 실행 Claude · Codex 판독 대기: `classify_container_display`/`node_establishes_bfc` → `parse_display(d).inner`, `write_block_item` display code → `is_atomic_inline_level` (inline-block·inline-flex·inline-grid = line item, 순수 inline 은 S4 까지 0), `solve_node` → `effective_display` blockify (부모 flex/grid); `classify_child_display` 삭제. cargo RED 3/6 → GREEN 333/333 (+8) · golden 전량 · wasm 재빌드 후 builder parity 930 pass 회귀 0 (`displayContract` it.fails 유지) · 프로덕션 동작 무변경 — r6h1 수리 후 TS 경계가 inline-flex/grid 를 보내지 않는다) · **Codex 판독 round 6 2026-09-01** — HIGH 1 (r6h1: post-order implicit patch 가 raw inline-\* 를 경계에 전달해 Label 등에서 line item 조기 활성화 → `toBatchDisplay` 운반 union 강제 + `seamDisplayInvariant` 테스트, S9 4번째 사이트) · LOW 2 (테스트 수 · 문서 정합) 전부 fixed ([reviews/923.md](reviews/923.md)); 관찰: inline-level 컨테이너 shrink-to-fit (wrap · percentage) 은 Phase 3 차등 대상 · **Phase 2 완료 2026-09-01** (baseline 출력 계약 + 입력 3종 — 실행 Claude · Codex 판독 대기: `NodeLayout.baseline`(내부 센티널 `BASELINE_NONE`, 경계 출력은 height 폴백 해소 — CSS 2.1 §10.8.1) · leaf `leafBaseline` 입력(+pad/border-top) · 컨테이너 전파 (flex/grid 첫 원천 item, block 마지막 line box — `block_layout` trailing meta 3번째 `lastLineBaseline`) · `write_block_item` 슬롯 16/17/18 "미소비" 해소 (`vertical_align`(키워드→u8)/`baseline`/`line_height` px) · wasm 경계: `get_layouts_batch` stride 4→5 + `getLayout` JSON `baseline` + `NodeStyle` 3필드(54, 가드 갱신) · TS: `applyCommonTaffyStyle`/`taffyStyleToRecord` 통과 + `enrichWithIntrinsicSize` 가 텍스트 leaf 첫 줄 baseline(half-leading + ascent, `measureFontMetrics` 체인) 주입, dead `calculateBaseline` 폐기. cargo 340(+7)·golden 15·tree_golden 11 전량, parity 934 pass (기존 2 실패만). **r6h1 동일 기전 재발 수리**: 2-pass 재-enrich 의 `patchBatchStyleFromImplicit` 가 CSS-형 `lineHeight("20px")` 를 raw 복사 → `updateStyleRaw` serde 폭발로 WASM 경로 전면 null (parity 12건 연쇄, RED 재현) → patch 루프 lineHeight px coerce 분기 + `seamBaselineContract.browser.test.ts` (buildTreeBatch+updateStyleRaw **두 writer** 캡처, R8-d 형 2-pass 강제) 가드. Phase 3 진입은 사용자 승인 후) · **Codex 판독 round 7 2026-09-01 → Phase 2 닫힘 (`9a51479a5`)** — MEDIUM 2 수리: r7m1 grid 컨테이너 baseline 을 children source 순서가 아니라 **placement row-major(셀 y,x) 첫 원천**으로 (명시 `gridRowStart` 역순 RED 42→기대 4; flex 는 document order 가 CSS 계약이라 유지) · r7m2 unitless lineHeight 환산 기준 = inline fontSize → **상속 computed fontSize** (기본 16 폴백 제거 — `applyCommonTaffyStyle` `computedFontSize` param, `elementToTaffyStyle` `_computedStyle` 실사용, block/grid 분기 + `patchBatchStyleFromImplicit` 2 call site 배선). LOW: r7l1 seam `createNodeRaw` 3번째 writer spy · r7l3 NodeStyle 주석 49→54 4곳 · r7l2 는 실측 기각 (slot16 단독 원복 = FAIL 로 판별 성립; 관찰 PASS 는 슬롯 16+17 동시 원복의 slot17 마스킹, 그때도 suite RED 유지). 관찰 4건(margin-edge 폴백 · block 자식 미주입 · top/bottom-only line box · column flex 근사)은 Phase 3 케이스로 ([reviews/923.md](reviews/923.md)). cargo 341(+1) · parity 934 (기존 2) · layout unit 401(+2) · type-check 0. Phase 3 진입은 사용자 승인 후) · **Phase 3 완료 2026-09-01** (Chrome 차등 증명 G1 전반 — 사용자 승인 착수, 실행 Claude: `adr923ChromeDifferential.browser.test.ts` 23 케이스, domLeg(실 Chrome rect) ↔ engineLeg(어댑터 우회 직결) ≤1px + pipelineLeg 대조군 발산 기록 (종전 16/23 표기는 r8m1 오집계 — 실측 15/23, r8 케이스 27 확장 후 18/9). 1차 9 fail → 엔진 결함 5건 수리: valign-bottom baseline 밀림(§10.8.1) · atomic line-height 불관여(§10.8 — Phase 2 슬롯 18 의미론 반전, S4 예약) · 컨테이너 strut(`block_layout_with_strut`, lh/2 half-split) · 폴백 baseline margin edge + overflow≠visible 강제(r7 관찰 확정) · atomic inline shrink-to-fit(§10.3.9 + wrap min-content 최대 item §9.9). 프로덕션 실효 변화 = wrap flex min-content 측정 정정뿐 (parity 957 회귀 0, 나머지 휴면 — Phase 5 활성화). cargo 346 · 차등 23/23 · parity 957 · layout unit 401 · type-check 0. Live: 실 빌더 wrap 카드 정상·콘솔 0. 상세: [evidence/923-phase3-differential.md](evidence/923-phase3-differential.md). Phase 4 진입은 사용자 승인 후) · **Codex 판독 round 8 2026-09-01 → Phase 3 재닫힘 (`efb56a888`)** — HIGH 2 수리: r8h1 vertical-align:middle 을 line 중앙 배치에서 **baseline 앵커**(margin box 중심 = baseline + x-height/2 — fontSize 0 채널 0, 실폰트 S4)로: middle 이 asc/desc 를 mbox/2 씩 밀어 baseline 이동 (valign-middle-tall a.y 10) · r8h2 마지막 line box flush 높이 → trailing meta 4번째 **inFlowBottom** + 컨테이너 auto-height 를 자식 bbox 와의 max 로 (strut-last-line root 40 — 기존 케이스는 전부 tail 보유라 관측 밖). MEDIUM 2: r8m1 대조군 오집계 (실측 15/23 — 수리 후 27 케이스 18/9 일괄 정정) · r8m2 overflow:clip 을 `overflow_creates_bfc` 에서 제외 (css-overflow-3) — **baseline 억제 쪽도 오라클 케이스(ib-overflow-clip-baseline: dom a.y 20 = last line box 유지)가 Codex "clip 포함 타당" 판정을 반증**해 양쪽 제외. LOW 2: r8l1 slot 17 margin edge/slot 18 S4 예약 주석 6곳 · r8l2 프로덕션 wrap intrinsic-min pipelineLeg 게이트 (첫 실행 GREEN — 수리 5 프로덕션 반영 실증). cargo 352 · 차등 27/27 · parity 962 (기존 2) · layout unit 401 · type-check 0 ([reviews/923.md](reviews/923.md)). Phase 4 진입은 사용자 승인 후) · **Codex 판독 round 9 2026-09-01 → Phase 3 재닫힘** — HIGH 1 수리: r9h1 flex item overflow:clip 이 §4.5 content floor 를 잃음 (Chrome 80 / pipeline 60) → overflow 판정 3곳을 단일 scroll-container 술어(scroll/auto/hidden 만 — css-flexbox-1 §4.5 non-scrollable, css-overflow-3 §3.1)로 통합 + 양축 판정 + 프로덕션 shorthand clip 게이트. MEDIUM 2: r9m2 block auto-height 꼬리 margin 반례 (empty 관통 30→10 · padding 포함 11→31) — root cause 2겹: self-collapsing box 의 intake 미분류(`DISPLAY_EMPTY_BLOCK` 발행 주체 부재) + 꼬리 chain 포함/탈출 미구분 → §8.3.1 분류 발행 + inFlowBottom 단독 소비; 같은 모델의 인접 발산 5 (BFC 자식의 자기 margin 합산·차단 제거, line box 는 margin 비참여) 함께 수리 · r9m1 "clip 실효 0" 공시 정정 (Style Panel Clip 직접 노출 — 실효 = 수리 5·9·10~12). LOW 2: r9l1 clip baseline 규범 귀속 (css-align-3 §9.1 block-axis scroll container) · r9l2 slot 18 요약 주석. 차등 **39 케이스 + 게이트 2 = 41/41** · cargo 362 · parity 975 (기존 2) · layout unit 401 · type-check 0 ([reviews/923.md](reviews/923.md)). 후속 ① `height:0` self-collapsing 재귀 플래그 수리 (차등 42 케이스 + 게이트 2 = 44/44 · cargo 363 · parity 978) · 후속 ② DC-6 overflow cap 은 Phase 4 인벤토리 → Phase 5 제거 목록. Phase 4 진입은 사용자 승인 후)

> 번호: 사용자 요청 922 는 `922-photoshop-style-panel-layout-coordinator` 가 사용 중 → 900 밴드 최대 + 1 = 923. 파일명은 r0 제목(`layout-vocabulary-closure`) 그대로 둔다 — 링크 안정성. 어휘 닫기(B 갈래) 자체는 §Decision 의 분리 사유대로 후속 결정 대상.

## Context

**Domain: D3 시각 스타일** (layout flow 는 D3 — `.claude/rules/ssot-hierarchy.md` §3). D1/D2 변경 없음. Spec/Generator 확장 ADR 아님 — catalog CSS 생성기는 손대지 않는다. 단, catalog 의 **Canvas 전용 display override** (DOM `inline-flex` ↔ Canvas `flex`) 를 걷어내는 것은 D3 대칭 복구다.

### 발견 경위

ADR-198 (D3 픽셀 패리티 게이트) 가 두 프로덕션 leg 을 처음 맞댄 결과 catalog 파일럿에서 배치 발산이 났다 (`0aa52b68a`): block 부모 안의 **명시 폭 block 형제**가 Chrome 에서는 제 줄을 차지하는데 Skia 에서는 inline-block 형제와 같은 줄에 남는다. 원인을 추적하니 어댑터가 아니라 **어댑터의 전제**가 문제였고 (r0), r0 의 수리안은 다시 **catalog 컴포넌트의 display 이중 표현**에 걸려 무효였다 (r1 리뷰).

### 실측 사실 (2026-08-31, r0 + r1)

1. **전제가 낡았다.** `taffyDisplayAdapter.ts:20` "=== Taffy 시뮬레이션 규칙 ===", `:521` "Taffy는 inline formatting context를 지원하지 않으므로". Taffy 는 ADR-916 endgame 7/7 (`dd5a6e403`, 2026-07-06) 로 완전 제거됐고 (`composition-engine/Cargo.toml:5`), 비테스트 7 파일이 코드 식별자로 Taffy 를 아직 쓴다 (파일명 기준 5, 합집합 8 — r2 재집계).
2. **엔진은 line box 를 갖고 있다.** `packages/composition-engine/src/block.rs:141-215` 가 inline-block 자식의 line box 를 구현한다 — wrap, `flush_line_box`, `vertical_align`/`baseline`/`line_height` (`:370-390` baseline 정렬).
3. **TS 치환이 그 경로를 가린다.** `fullTreeLayout.ts:1156 toTaffyDisplay` → block 부모에 inline-level 자식이 있으면 `INLINE_BLOCK_PARENT_CONFIG` (flex row wrap) → `TaffyBlockEngine.ts:118 display="flex"` → `tree.rs:1185/3598 classify_container_display("flex") → Flex`. `solve_block` 의 inline 경로는 live 에서 도달 불가.
4. **(r1) display 가 이중 표현이다 — 핵심.** DOM Button 은 `inline-flex` (`packages/shared/src/components/styles/Button.css:14`); catalog 의 Canvas fallback 은 `flex` (`componentRulesTable.ts:927`, rule 헤더 `:915`, 사유 주석 `:918-925`; ToggleButton `:13108` 도 동일 override — r2 확인. 주석: "inline-flex 면 패널 Direction 이 block 으로 표시돼서" — 2026-06-27 사용자 지적으로 flex 선택). 부모는 자식을 `getElementDisplay` (`fullTreeLayout.ts:1797`, 손 목록 `INLINE_BLOCK_TAGS` → `"inline-block"`) 로 보고, 자식 자신은 `resolveContainerStylesFallback` (`:1031`) 로 `flex` 를 받는다. 같은 Button 이 부모 판정과 자기 style 에서 **다른 display** 를 갖는다.
5. **(r1) 엔진은 문자열 하나만 본다.** `tree.rs:4609` 는 자식 display 가 정확히 `"inline-block"` 일 때만 line item(code 1). `display.rs` 의 CSS Display Level 3 `{outer, inner}` 모델 (`parse_display/classify_child_display/blockify_display`) 은 **tree.rs 어디에서도 호출되지 않는다** (참조 0 — 인프라 존재 ≠ 가동 경로). 따라서 r0 의 "TS 치환만 걷어내고 직결" 은 catalog Button 을 **block item** 으로 만들어 한 줄을 통째로 차지시킨다 — 지금보다 나쁘다.
6. **(r1) baseline 이 역방향이다.** `tree.rs:4672-4674` 가 `vertical_align/baseline/line_height` 를 0/AUTO 로 넣고 ("미소비" 주석 `:4590-4592`), `block.rs:370-390` 이 그 baseline 으로 줄 위치를 잡는다. TS `calculateBaseline` (`utils.ts:5121`) 은 re-export 만 있고 production caller 0. baseline 은 자식 레이아웃·텍스트 측정이 끝난 뒤 나오는 **출력**이지 style 입력이 아니다.
7. **(r1) `INLINE_BLOCK_TAGS` 는 두 개념의 겸용이다.** 기본 display 목록이자 intrinsic width/height 측정을 켜는 escape 목록 (`utils.ts:4570-4572 needsWidth`). ProgressCircle/CalendarGrid/DateInput 같은 self-render leaf 가 들어 있는 이유. 손 목록 24 vs catalog inline-\* 선언 30건 — "catalog 파생 == 손 목록" 은 다른 개념의 비교다.
8. **(r1) hydration migration 은 단일 ingress 가 아니고 비가역이다.** 패널 `updateSelectedStyle` (`useStyleActions.ts:51`), AI `updateElementProps` (`services/ai/tools/updateElement.ts:98`) 가 store 를 직접 쓴다. migration chain 은 `usePageManager.ts:385` persist-back 에서만 돌고 IndexedDB 를 덮어써 원값이 사라진다. r0 의 B 갈래(S4 정규화) 는 세션 중 유입을 못 막고 롤백도 불가.
9. **패널.** `useLayoutAuxiliary.ts:71 useFlexDirectionKeys` 는 `display !== "flex"` 면 block, `:99 useFlexAlignmentKeys` 도 같은 판정으로 Alignment 9-grid 를 비운다 (r2) — `inline-flex` 를 flex 로 읽지 못한다. 이것이 사실 4 의 Canvas 전용 `flex` override 를 만든 원인이다. (`TransformSection.tsx:475` 는 이미 `flex || inline-flex`.)
10. **(r2) Button 은 `toTaffyDisplay` 를 타지 않는다 — outer 를 지우는 TS 분기가 3곳 더 있다.** 자식 자신의 style 은 `fullTreeLayout.ts:1057-1060` 이 `getElementDisplay(enriched)` 가 flex/inline-flex 면 먼저 잡아 `TaffyFlexEngine.ts:111-112` 가 `inline-flex → "flex"` 로 정규화하고, inline-grid 는 `:1077-1084` 가 `{display:"grid"}` 를 주입하며, `taffyDisplayAdapter.ts:510-512` 도 inner 만 돌려준다. 따라서 catalog 를 `inline-flex` 로 바꾸고 IFC 시뮬레이션만 걷어내면 엔진은 여전히 `"flex"` 를 받아 Phase 1 규칙에서 block item 이 된다 — r1 의 제거 목록만으로는 HC1 이 성립하지 않는다 (reviews/923.md round 2 m1).
11. **(r3) TS 운반 타입이 block-level 값만 허용한다.** `wasm-bindings/layoutTypes.ts:11 TaffyDisplay = "flex" | "grid" | "block" | "none"` (`:91 TaffyStyle.display`), `taffyDisplayAdapter.ts:124 TaffyDisplayConfig.taffyDisplay` 동일 4 값. 실행 분기(S9) 를 고쳐도 이 union 이 `inline-flex` 를 막는다 — CSS 값 통과 계약은 타입까지 포함해야 한다 (reviews/923.md round 3 r3m1). 엔진 쪽은 `tree.rs:185 Option<String>` 이라 제약 없음. 또한 `display.rs:138-149 classify_child_display` 는 inline-flex/inline-grid 를 Block 으로 분류하므로 Phase 1 은 `parse_display` 를 직접 쓴다.

### 문제 정의

정합의 근본 구조는 두 가지뿐이다. (A) Chrome 을 진실로 두고 캔버스가 흉내낸다 — 무한. (B) 문서 모델을 진실로 두고 캔버스와 Chrome 이 **같은 문서를 같은 의미로** 소비한다 — "어휘 × 소비자 정확성" 으로 유한. 이 저장소는 뼈대가 (B) 다 (canonical ADR-142, catalog D3 SSOT, ADR-916 자체 엔진, ADR-156 Chrome 차등 oracle). 남은 (A) 의 잔재가 둘이다: 어댑터의 시뮬레이션 층, 그리고 **display 를 "부모가 보는 값 / 자식이 받는 값 / DOM 이 받는 값" 세 가지로 갈라 놓은 표현**.

CSS Display Level 3 는 이 문제를 이미 풀었다 — display 는 `outer`(부모 flow 참여) 와 `inner`(자기 자식 solver) 의 쌍이다:

| CSS 값         | outer  | inner     |
| -------------- | ------ | --------- |
| `block`        | block  | flow      |
| `inline-block` | inline | flow-root |
| `inline-flex`  | inline | flex      |
| `inline-grid`  | inline | grid      |

Button = `inline-flex` = **line box 에 참여하면서 내부는 flex**. 이 한 값이 부모·자식·DOM 세 소비자에 같은 의미를 주면 이중 표현이 사라진다. 엔진에는 이 모델이 `display.rs` 로 이미 있다 — 배선만 없다.

**Hard Constraints**:

1. **display 단일 표현**: 엔진 경계의 display 는 CSS 값 1개이며, 엔진이 `display.rs` 로 outer/inner 를 해석한다. TS 가 부모 판정용과 자식 style 용으로 **다른 display** 를 만드는 경우 0 (측정: `childDisplays[i]` == 자식 노드에 전달된 `display`).
2. **Canvas 전용 display override 0** (r4 정의 — Codex 판정 2026-08-31, reviews round 5): **같은 의미의 실제 렌더 box** 에 대해 **production 소비 경로**(factory style → `applyImplicitStyles` → 엔진 도달값, `fullTreeLayout.ts:1658` · `implicitStyles.ts:335`) 의 **exact display**(outer·inner 둘 다 — inner 가 solver 를 고르므로 outer 만 비교 금지) 가 DOM computed display 와 일치한다. 투영 구조가 다른 box 는 대응 DOM box 를 명시한다 (Menu → `MenuTrigger > Button` inline-flex, popover `.react-aria-Menu` 는 비교 제외 — ADR-151 B7). **미판정 항목 0** — catalog fallback 기준 불일치 13 (Phase 0 §A) 은 전환 목록이 아니라 Q4 판정 후보이고, DOM 충돌 3·미선언 17 도 판정 전에는 통과로 세지 않는다. 확정 전환은 Button·ToggleButton 2.
3. **Chrome 차등 증명 선행**: live 로 돈 적 없는 엔진 block/inline 경로를 켜기 전 ADR-156 방식 차등 케이스 ≥ 12 가 위치·크기 ≤ 1px 로 통과. 허용치 확대 금지. **실패 = cutover 차단** (강등 분기 없음).
4. **baseline 출력 계약**: baseline 은 `NodeLayout` 출력 필드로 자식 → 부모 상향 전파. style 입력은 `vertical-align`/`line-height` 만.
5. **ADR-198 규율 승계**: 예산·fixture 무변경. ratchet 은 수리 결과로만 갱신.
6. **성능** (r4 — 단일 run 폐기): 같은 기기·Chromium 에서 baseline commit 과 candidate commit 을 교대로 fresh-browser **N=3 쌍** 측정, arm F/B 각각 `median(after_p95ᵢ / before_p95ᵢ) ≤ 1.05`. 같은 코드의 run-to-run p95 편차 (+5.9% / +7.7%, Phase 0 §D) 가 +5% 보다 커 단일 run 은 같은 코드에도 실패한다. N 은 결과 확인 전에 고정 — 결과 확인 후 run 추가 금지.
7. **D1/D2·스키마 무변경**: DOM/ARIA·props·canonical 스키마·persisted 문서 변경 0. (persisted migration 은 본 ADR 밖.)

**Soft Constraints**:

- block.rs line box 는 cargo test 로만 검증됐다 — live 동작 미지.
- 2026-06-27 사용자 지적(패널 Direction 이 inline-flex 를 block 으로 표시) 을 재발시키면 안 된다 — catalog override 제거는 패널 수정 뒤, cutover 와 같은 commit — 단독 commit 은 중간 상태에서 IFC 시뮬레이션이 꺼지고 flex 분기가 `flex` 를 넘겨 Button 이 세로로 쌓인다 (r2 m2).
- ADR-198 Phase 6(대표 매트릭스) 미착수 — 본 ADR 의 차등 케이스가 그 입력.
- 단일 개발자 리뷰 용량 — Rust 변경(tree.rs/block.rs) 은 commit 단위로 잘게.

## Alternatives Considered

### 대안 A: TS 시뮬레이션 정교화 (line-break 삽입 또는 익명 블록 그룹화)

- 설명: flex-row-wrap 시뮬레이션을 유지하고 발견된 결함만 고친다.
- 근거: CSS 2.1 §9.2.1.1 익명 블록 박스 — Dropflow `classifyChild` 와 같은 접근. 그러나 엔진 안의 일이지 엔진 앞단 JS 의 일이 아니다.
- 위험:
  - 기술: MEDIUM — flex 근사의 한계(strut, baseline, 줄 간 margin) 잔존.
  - 성능: LOW.
  - 유지보수: **HIGH** — 같은 의미를 JS 와 Rust 두 곳이 구현. ADR-916 이 없앤 이중화를 되살린다.
  - 마이그레이션: LOW.

### 대안 B: 어휘에서 제거 + ingress 전면 정규화 (block+inline-level → 문서에 flex 기록)

- 설명: block 컨테이너에 inline-level 자식이 오면 입력 시점에 flex-wrap 으로 문서에 기록.
- 근거: Figma auto-layout / Framer / pen.dev — 닫힌 어휘를 CSS 로 내보낸다.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: MEDIUM — CSS 와 다른 빌더 의미를 영구화.
  - 마이그레이션: **HIGH** — 기존 문서 전부 재직렬화 + (r1) hydration 이 단일 ingress 가 아니라 세션 중 유입을 못 막고, persist-back 이 원값을 지워 롤백 불가.

### 대안 C (r0 선택 — r1 리뷰로 기각): 갈래 분리 — 단일 display 문자열 그대로 직결(A) + 미구현분 정규화(B)

- 설명: TS 치환만 걷어내고 자식 display 를 엔진에 그대로 넘긴다; 미구현 의미는 ingress 정규화.
- 근거: r0 에서 "엔진이 이미 구현했다" 는 사실에 근거. 그러나 **엔진이 문자열 하나만 보고, catalog 가 Button 에 `flex` 를 준다**는 두 사실을 놓쳤다.
- 위험:
  - 기술: **HIGH** — catalog Button 이 block item 이 되어 발산이 악화된다 (사실 4·5). load-bearing 전제 실패.
  - 성능: MEDIUM.
  - 유지보수: MEDIUM — `INLINE_BLOCK_TAGS` 를 catalog display 로 대체하는 G4 가 다른 개념을 비교 (사실 7).
  - 마이그레이션: **HIGH** — B 갈래의 persisted migration 이 비가역 (사실 8).

### 대안 C′: display 이원 계약 — 엔진이 outer/inner 를 해석, TS 는 CSS 값 1개만 전달

- 설명: (1) `tree.rs` 가 `display.rs` 를 배선한다 — 부모 `solve_block` 은 자식의 **outer** 로 line item 여부를, 자식 자신은 **inner** 로 block/flex/grid solver 를 고른다; flex/grid 부모 아래에서는 엔진이 blockify. (2) catalog 의 Canvas 전용 `flex` override 를 제거해 DOM 과 같은 `inline-flex` 로 두고, 패널 Direction·Alignment 판정이 `inline-flex` 를 flex 로 읽게 고친다 — 패널은 먼저, catalog 전환은 (5) 와 같은 commit. (3) `INLINE_BLOCK_TAGS` 를 **default-display resolver**(catalog 파생) 와 **intrinsic-measurement capability**(self-render leaf 명시 목록) 로 분리한다. (4) baseline 을 `NodeLayout` 출력으로 상향 전파하고 `vertical-align`/`line-height` 만 입력으로 배선한다. (5) 그 뒤 TS IFC 시뮬레이션·width:100% 보정·leaf 고정·alignItems 근사, 그리고 flex/grid 분기의 inline-\* 정규화 3 사이트(사실 10) 를 catalog 전환·`getElementDisplay` catalog 파생과 함께 단일 commit 으로 제거한다. 순수 `inline`(inner=flow) 은 S4 대로 block 격상(code 0) 을 유지한다. (6) 치환·무시 감시는 display class 가 아니라 **property × value × engineSupport × policy × oracle** capability matrix 로 선언한다 — 본 ADR 은 seed 만, 집행은 B 갈래 후속 결정.
- 근거: CSS Display Level 3 §2 (outer/inner) — Blink LayoutNG·Servo 가 정확히 이 모델로 inline-flex 를 line box item + flex container 로 배치한다. Dropflow 의 `Style.blockify()`/`classifyChild` 가 이미 `display.rs` 에 이식돼 있다 (ADR-916 2-A). Taffy·Yoga 가 inline 을 범위 밖에 둔 제약은 ADR-916 으로 소멸. ADR-156 의 실 Chrome 차등 oracle 이 "켜기 전 증명" 수단.
- 위험:
  - 기술: MEDIUM — block.rs line box live 미검증 + inline-flex 컨테이너의 baseline 산출(첫 in-flow 텍스트) 신규. 차등 케이스로 선행 증명 (HC3).
  - 성능: MEDIUM — block 경로 비용 미측정. baseline arm 게이트 (HC6).
  - 유지보수: LOW — 의미 해석이 `display.rs` 한 곳, display 값이 catalog 한 곳(DOM 과 동일), 측정 capability 가 명시 목록 한 곳.
  - 마이그레이션: MEDIUM — 스키마·persisted 문서 변경 0. block+inline-level 문서의 배치가 Chrome 쪽으로 1회 이동. catalog Button display 값 변경(flex → inline-flex) 은 inner 가 같아 subtree 결과 무변.

### 대안 D: 엔진에 완전한 IFC (순수 inline box · 텍스트 run 혼합 · float)

- 설명: Dropflow 전체 이식.
- 근거: Dropflow / Servo Layout 2020.
- 위험: 기술 **HIGH** / 성능 MEDIUM / 유지보수 **HIGH** / 마이그레이션 LOW — 텍스트 shaping 을 엔진이 떠안음, 리뷰 용량 초과.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ----- | ---- | -------- | ------------ | :--------: |
| A    | M     | L    | **H**    | L            |     1      |
| B    | L     | L    | M        | **H**        |     1      |
| C    | **H** | M    | M        | **H**        |     2      |
| C′   | M     | M    | L        | M            |     0      |
| D    | **H** | M    | **H**    | L            |     2      |

루프 판정: r0 에서 HIGH 0 이던 C 가 r1 실측(사실 4·5·8) 으로 HIGH 2 가 됐다 → 위험을 회피하는 새 대안 C′ 추가 (루프 1회). C′ HIGH 0. CRITICAL 없음.

## Decision

**대안 C′: display 이원 계약** 을 선택한다.

선택 근거:

1. C′ 만 4축 HIGH 0. 잔존 MEDIUM(live 미검증 경로 / block 경로 비용 / 배치 이동) 은 전부 켜기 전 측정으로 관리된다 — ADR-156 차등 oracle + ADR-198 픽셀 게이트가 이미 있다.
2. 새 모델이 아니라 **있는 모델의 배선**이다. `display.rs` 가 outer/inner 를 이미 구현하고, `block.rs` 가 line box 를 이미 구현한다. 비용은 tree.rs 의 문자열 매칭 4곳(`:1185/:1373/:2552/:4609`) 을 `display.rs` 호출로 바꾸는 것, baseline 출력 필드 하나, 그리고 (r2) TS 가 outer 를 지우는 4 사이트(`TaffyFlexEngine.ts:110-117` / `fullTreeLayout.ts:1060,1084` / `taffyDisplayAdapter.ts:510-512` / (r6) `fullTreeLayout.ts` `toBatchDisplay` post-order patch) 를 CSS 값 통과로 바꾸는 것이다.
3. 이중 표현의 근원(catalog Canvas 전용 `flex`) 을 제거하면 D3 대칭이 값 수준에서 복구된다 — Canvas 와 DOM 이 같은 display 를 받는다. 2026-06-27 의 우회는 패널 결함을 catalog 로 덮은 것이었고, 패널을 고치는 것이 맞다.
4. B 갈래를 분리하는 이유: catalog 발산 수리와 무관하고, 사실 8 때문에 **비파괴 설계**(store 쓰기 경로 정규화 + 원값 보존 + 패널/AI 경로 포함) 가 따로 필요하다. 그 설계 없이 본 ADR 에 두면 마이그레이션 HIGH 가 되돌아온다.

기각 사유:

- **대안 A 기각**: 엔진이 가진 line box 를 JS 로 또 만든다. 이번 발산의 원인이 그 JS 재구현이었다.
- **대안 B 기각**: 구현된 기능을 버리고 문서 의미를 CSS 에서 멀어지게 바꾼다. 게다가 (r1) ingress 가 단일이 아니고 migration 이 비가역이라 마이그레이션 HIGH.
- **대안 C 기각 (r0 선택 철회)**: 단일 display 문자열 직결은 catalog Button 을 block item 으로 만든다 — 발산을 못 고치고 악화시킨다. `INLINE_BLOCK_TAGS`↔catalog diff 게이트는 다른 개념의 비교. baseline 을 입력으로 넣는 설계는 역방향. 세 결함 모두 Codex r1 리뷰 (reviews/923.md h1·h2·h3).
- **대안 D 기각**: 텍스트 흐름은 Skia Paragraph 소관, 요소 단위 inline 혼합은 제품 요구 아님. 범위 초과.

**분리 결정 (사용자 2026-08-31)**: r0 의 B 갈래 — S4 순수 `display:inline` 요소 정규화 / S7 float·writing-mode·다단 노출 차단 / S8 grid 미구현 4종 선언 / persisted migration — 는 본 ADR 에서 제외한다. 요건은 breakdown §8 에 기록하고 별도 결정으로 넘긴다. 본 ADR 은 capability matrix 의 **seed 선언**까지만 한다.

> 구현 상세: [923-layout-vocabulary-closure-breakdown.md](design/923-layout-vocabulary-closure-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                          |  심각도  | 대응                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | block.rs line box + inline-flex baseline 산출이 live 로 돈 적 없다. 경로: `block.rs:141-215,370-390` / `tree.rs:1185,4609,4672` / `fullTreeLayout.ts:1060,1156,1797` / `TaffyBlockEngine.ts:118` / `TaffyFlexEngine.ts:112`                                                                                                                                                                                                   | **HIGH** | G0 선행 검사 1케이스로 현재 실패를 확증 → G1 차등 ≥12 + baseline 케이스 통과 전 cutover 금지. 실패 = 차단(강등 없음). cutover 단일 commit                                                 |
| R2  | 기존 문서 배치 이동 — block 컨테이너 + inline-level 자식. 경로: `factories/definitions/{DateColor,Form,Overlay}Components.ts` `display:"block"` 11곳 / `styleOptions.ts:68` / import·AI 유입                                                                                                                                                                                                                                  | **HIGH** | G2: Phase 0 에서 "영향 % / 평균 재직렬화 파일 수" 수식화, ADR-198 L1 pass 로 방향이 Chrome 쪽임을 증명, CHANGELOG 사용자-가시 엔트리                                                      |
| R3  | block 경로 프레임당 비용 미측정                                                                                                                                                                                                                                                                                                                                                                                               |   MED    | G3: baseline 대비 +5%, block 비율 높은 arm 별도. 초과 시 block.rs 프로파일, 예산 완화 금지                                                                                                |
| R4  | catalog `flex` override 제거가 패널 Direction 회귀 재발 (2026-06-27 사용자 지적). 경로: `useLayoutAuxiliary.ts:71,:99` / `useLayoutValues:52` / `componentRulesTable.ts:927,:13108`                                                                                                                                                                                                                                           |   MED    | G4: 패널 수정(Phase 4, 동작 무변경) 이 catalog 전환(Phase 5) 에 선행. Direction·Alignment 가 inline-flex 를 flex 로 표시하는 테스트                                                       |
| R5  | `INLINE_BLOCK_TAGS` 분리 시 intrinsic 측정 capability 누락 → width 0 회귀 (DisclosureHeader "0×24" 선례). 경로: `utils.ts:4400,4570`                                                                                                                                                                                                                                                                                          |   MED    | G5: 24 항목을 두 개념으로 분류한 표를 Phase 0 에 고정, capability 목록은 명시 유지(파생 아님), 분리 전후 `enrichWithIntrinsicSize` 출력 diff 0                                            |
| R6  | baseline 출력 계약이 flex/grid solver 에도 필요 — inline-flex Button 의 baseline = 첫 in-flow 텍스트 baseline. 미구현이면 `vertical-align: baseline` 이 bottom 으로 폴백                                                                                                                                                                                                                                                      |   MED    | G1 에 "inline-flex 컨테이너 + 텍스트 leaf" baseline 케이스 포함. leaf baseline 은 텍스트 측정값을 TS→엔진 입력으로, 컨테이너는 출력으로                                                   |
| R7  | display 단일 표현(HC1) 을 깨는 새 코드 유입 — `getElementDisplay` 와 style merge 가 다시 갈라짐                                                                                                                                                                                                                                                                                                                               |   MED    | HC1 측정 테스트(`childDisplays[i] == 자식 전달 display`) 를 fullTreeLayout 단위 테스트로 상시화                                                                                           |
| R11 | (r2) TS flex/grid 분기가 inline-\* 의 outer 를 지운다 — `fullTreeLayout.ts:1060,1084` / `TaffyFlexEngine.ts:110-117` / `taffyDisplayAdapter.ts:510-512` / (r6) `fullTreeLayout.ts patchBatchStyleFromImplicit` post-order patch (raw 복사가 정규화를 덮어 inline-\* 가 경계 도달 → `toBatchDisplay` union 강제, Phase 1~4 seam 불변식 테스트). 제거 목록에서 빠지면 cutover 후에도 엔진이 `flex` 를 받아 Button 이 block item |   MED    | Phase 5 제거 목록에 3 사이트 + 운반 타입 union 2곳(`layoutTypes.ts:11` / `taffyDisplayAdapter.ts:124`) 확장 포함 (r3). G0 (a) 가 wasm 경계에서 검출, HC1 테스트가 Button 경로를 상시 대조 |
| R8  | capability matrix 가 seed 로만 남아 S4/S7/S8 의 silent ignore 가 계속됨                                                                                                                                                                                                                                                                                                                                                       |   LOW    | 본 ADR 밖 — breakdown §8 요건 + B 갈래 후속 결정. seed 에 현재 격차 수치 기록                                                                                                             |
| R9  | ADR-198 ratchet 을 수리 전에 손대면 게이트 vacuous                                                                                                                                                                                                                                                                                                                                                                            |   LOW    | HC5                                                                                                                                                                                       |
| R10 | Taffy 명명 잔재 (본 세션에서 실제로 분석을 잘못 이끔)                                                                                                                                                                                                                                                                                                                                                                         |   LOW    | Phase 6 개명, 동작 무변경 commit 분리                                                                                                                                                     |

## Gates

| Gate | 시점                        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 실패 시 대안                                                                       |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| G0   | Phase 0 종료                | **선행 검사 1케이스** — style 없는 catalog Button 이 (a) 엔진에 CSS 값 1개(`inline-flex`) 로 도달하고 (b) block 부모에서 line item 이며 (c) 자기 subtree 는 flex solver 를 타는가: **현재 실패**를 확증(전제 검증). (a) 의 캡처는 `:1060` flex 분기를 지난 값 — `toTaffyDisplay` 출력이 아니다. 캡처 지점: `pipelineLeg`(`tests/parity/harness.ts:223`) 실행 중 `CompositionEngineLayout.prototype.buildTreeBatch`(`wasm-bindings/compositionEngine.ts:167`) 의 JSON 인자를 spy — `engineLeg`(`harness.ts:114-135`) 는 fixture style 로 batch 를 직접 만들어 프로덕션 변환을 우회하므로 부적합 (r3l1). + 인벤토리: Canvas 전용 display override 전수(Button·ToggleButton 확인됨) / `INLINE_BLOCK_TAGS` 24 → 두 개념 분류표 / BC 정량 / p50·p95 baseline(block arm 포함) | 선행 검사가 "현재 통과" 면 사실 4·5 가 틀린 것 — Phase 1 진입 금지, Context 재실측 |
| G1   | Phase 3 종료 · Phase 5 종료 | (전반) 어댑터 우회로 엔진 outer/inner 경로에 Chrome 차등 ≥12 + baseline 케이스, 위치·크기 ≤1px, 허용치 무변경. (후반) cutover 후 프로덕션 경로로 재통과 + ADR-198 `blockInlineProbe` 4 변형 두 leg 일치                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **cutover 차단**. 실패 케이스는 엔진 결함으로 기록 → 수리 → 재실행. 강등 분기 없음 |
| G2   | Phase 5 종료                | ADR-198 catalog-state-paint L1 pass(예산 무변경) · CHANGELOG · 영향 % 가 breakdown §6 에 기록                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | cutover commit revert, 원인 규명 후 재시도                                         |
| G3   | Phase 5 종료                | 5k fixture — baseline commit 과 candidate commit 을 같은 기기·Chromium 에서 교대로 fresh-browser N=3 쌍 측정 (run 마다 현 하니스 warm-up 5 + measured 30 의 p95), arm F/B 각각 median(after_p95ᵢ / before_p95ᵢ) ≤ 1.05. raw 는 run 마다 고유 파일 보존, 결과 확인 후 run 추가 금지 (r4 — 단일 run 편차 > 5%)                                                                                                                                                                                                                                                                                                                                                                                                                                                            | block.rs 프로파일 → 수리. 예산 완화 금지                                           |
| G4   | Phase 4 종료 · Phase 5 종료 | (전반) 패널 Direction·Alignment 가 `inline-flex` 를 flex 로 표시하는 테스트 통과, catalog 무변경. (후반) HC2 (r4 정의 — production 소비 경로 exact display = DOM computed display, 대응 box 명시, 미판정 0) 이 cutover 와 **같은 commit** 에서 성립 — 전환 Button·ToggleButton + Q4 판정으로 확정된 항목, Menu 는 `MenuTrigger > Button` 대조 + `blockInlineProbe` 로 block 부모 + Button 2 가 한 줄                                                                                                                                                                                                                                                                                                                                                                    | 패널 테스트 실패 시 catalog 변경 보류(둘 다 revert)                                |
| G5   | Phase 4 종료                | `INLINE_BLOCK_TAGS` 24 항목이 default-display(catalog 파생) / intrinsic capability(명시 목록) 로 전부 분류되고, `INTRINSIC_MEASURE_TAGS` 분리 전후 `enrichWithIntrinsicSize` 출력 diff 0. `getElementDisplay` 의 catalog 파생 배선은 Phase 5 (단독 배선 시 catalog `flex` 가 부모 판정으로 새어 IFC 시뮬레이션 해제 — r2 m2)                                                                                                                                                                                                                                                                                                                                                                                                                                            | 분류 불가 항목이 있으면 손 목록 유지 + 사유 기록, 삭제 보류                        |
| G6   | Implemented 승격            | `### Live Exercise` — 실제 빌더에서 block 컨테이너 + Button 2개 + 폭 명시 div: Canvas·Preview·패널 값 일치 (Chrome MCP 또는 사용자 confirm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 승격 보류                                                                          |

**측정 조건 (measurement-validity.md §1)**:

- Q1 출처: G1 케이스는 손으로 쓴 CSS 케이스 — 계약이 갈리는 입력 차원(명시 폭 block 형제 / wrap / vertical-align 4종 / line-height / margin / empty block / 부모 padding / **inline-flex 컨테이너 baseline**) 을 직접 쓴다. G3 의 5k fixture 는 규모 전용.
- Q2 불리 케이스: G1 에 ADR-198 catalog 발산 재현 필수. G3 는 block 컨테이너 비율 높은 문서를 별도 arm.
- Q3 대조군: G1 은 같은 케이스를 (전) 현 어댑터 경로 / (후) 엔진 직결 경로로 두 번 재서 Chrome 대비 오차를 나란히 기록. G3 는 baseline commit 과 candidate commit 의 교대 paired 측정 (r4) — Phase 0 §D 의 단일 값은 fixture·하니스 확정용 참고치이며 공식 baseline 이 아니다 (3 run 단순 중앙값 F 24.9 / B 98.0 ms 는 실행 조건이 섞여 채택하지 않음).
- Q4 소비 경로: G0 선행 검사가 "엔진에 무엇이 도달하는가" 를 wasm 경계에서 직접 읽는다 — TS 쪽 추정 금지. HC1 테스트는 실제 `fullTreeLayout` 출력을 대조. (r4) HC2 의 Phase 5 전환 목록도 Q4 로 확정한다 — catalog fallback 기준 후보 13 중 factory style (ColorPicker `DateColorComponents.ts:587` `display:"flex"`) · `applyImplicitStyles` 우선 (`implicitStyles.ts:335`) · 투영 owner (GridList `componentRulesTable.ts:5557` 의도된 flex-column, TagList transparent shell ↔ DOM `contents`) 를 지나 엔진에 도달한 값으로 전환 / 투영 예외 (대응 DOM box) 를 분류한다.
- Q5 oracle 독립성: 기준값은 실 Chrome `getBoundingClientRect` (ADR-156) — cargo golden 은 통과 판정에 쓰지 않는다. 조건 고정: `@vitest/browser` Chromium, viewport 1280×720, DPR 1, visible 탭 (ADR-198 R14 승계).

### Live Exercise

(Implemented 승격 시 기재 — 시나리오 · 결과 · 날짜 · Chrome MCP/사용자 confirm 구분)

## Consequences

### Positive

- display 가 부모·자식·DOM 세 소비자에 한 값이 된다. `display.rs` 가 실제로 가동 경로에 들어가고, `block.rs` line box 가 처음으로 live 를 탄다.
- catalog 의 Canvas 전용 `flex` override 가 사라져 D3 대칭이 값 수준에서 복구된다. 2026-06-27 우회의 원인(패널) 이 고쳐진다.
- ADR-198 catalog 발산이 예산 변경 없이 닫힌다 (`KNOWN_LAYERS["catalog-state-paint"]` L1 pass).
- `INLINE_BLOCK_TAGS` 의 두 역할이 이름을 얻는다 — 어느 컴포넌트가 왜 목록에 있는지 설명 가능해진다.
- capability matrix seed 가 B 갈래 후속 결정의 입력이 된다.

### Negative

- block 컨테이너 + inline-level 자식 문서의 배치가 1회 바뀐다 (Chrome 쪽). 영향 % 는 Phase 0, CHANGELOG 기록.
- `tree.rs`/`block.rs` 에 `NodeLayout.baseline` 출력과 style 입력 2종이 늘어 wasm 경계 계약이 바뀐다 — golden 은 Chrome 값으로만 갱신. TS 쪽 `TaffyDisplay` union 도 CSS display 값으로 넓어진다 (r3).
- 순수 `display:inline` 요소·float·grid 4종의 silent ignore 는 본 ADR 로 해소되지 않는다 — seed 선언만. 후속 결정 필요.
- 개명 commit 이 8 파일(코드 식별자 7 + 파일명 5 합집합) import 를 건드린다 (동작 무변경 commit 으로 격리).

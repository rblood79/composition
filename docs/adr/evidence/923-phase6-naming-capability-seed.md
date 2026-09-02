# ADR-923 Phase 6 — 명명 정리 · capability matrix seed 실측 기록

> 2026-09-03 · 실행 Claude · 사용자 착수 승인 2026-09-03 (Codex round 32 "Phase 5 닫힘 · Phase 6 진입 가" 근거) · 판독 Codex round 33 대기. 동작 무변경 phase (6a 개명 · 6b 선언) — 6d (`### Live Exercise` → Implemented 승격 + closure) 는 round 33 통과 후.

## 0. 요약

| 항목                                    | 결과                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6a 개명 (`7f1cf963d`, 41 파일)          | 파일 5 (+ test 1) · 심볼 30종 (`layoutTypes` `Taffy*` 타입 17 포함) · 지역 변수·private 필드 · 개명 파일 머리말 재작성 ("style 어댑터 — 값 변환만, 계산은 Rust 엔진"; `blockStyleAdapter` 머리말의 종전 IFC 시뮬레이션 서술 삭제) · 규칙 `layout-engine.md` "JS 어댑터 심볼명은 Taffy\* 유지" 조항 → 개명 명시 · stale 심볼 `gridStyleAdapter.elementToTaffyGridStyle` 정정. 실행 코드 변경 = 이름뿐 |
| 6b capability matrix seed (`b48978fc1`) | `layoutCapabilityMatrix.ts` 3 행 (S4 · S7 · S8) 선언 + `adr923CapabilityMatrixSeed.browser.test.ts` 가 Chrome 격차 1 케이스씩 실측·고정 (표 수치 = 실측, 격차 > 0). **round 33 정정 (§6)**: S8 oracle 2 (subgrid · dense — production 운반 longhand 로 격리, dense 는 미구현 확정) · S4 policy declared-substitution · policy 경계 대조 it                                                           |
| 검증 (6a)                               | type-check PASS · layout 469 · builder (workspace·stores·panels·factories·utils·components·hooks·preview·types·ai) 3772 · focused browser 8 파일 122 · cargo 371+15+10+11+1                                                                                                                                                                                                                          |
| 검증 (6b)                               | seed 3/3 (round 33 뒤) · 원복 RED (h)~(l) 5 · type-check PASS                                                                                                                                                                                                                                                                                                                                        |

## 1. 개명 지도 (옛 이름 → 새 이름 — ADR·evidence·reviews 이력 문서는 옛 이름 그대로)

| 종류   | 옛                                                                                       | 새                                                                |
| ------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 파일   | `engines/taffyDisplayAdapter.ts`                                                         | `engines/displayAdapter.ts`                                       |
| 파일   | `engines/TaffyFlexEngine.ts`                                                             | `engines/flexStyleAdapter.ts`                                     |
| 파일   | `engines/TaffyBlockEngine.ts`                                                            | `engines/blockStyleAdapter.ts`                                    |
| 파일   | `engines/TaffyGridEngine.ts`                                                             | `engines/gridStyleAdapter.ts`                                     |
| 파일   | `engines/persistentTaffyTree.ts` (+ `.test.ts`)                                          | `engines/persistentLayoutTree.ts` (+ `.test.ts`)                  |
| 타입   | `TaffyStyle` · `TaffyDisplay` · `TaffyNodeHandle` 등 17 (`wasm-bindings/layoutTypes.ts`) | `EngineStyle` · `EngineDisplay` · `EngineNodeHandle` 등 `Engine*` |
| 타입   | `TaffyDisplayConfig` (`.taffyDisplay`)                                                   | `EngineDisplayConfig` (`.engineDisplay`)                          |
| 클래스 | `PersistentTaffyTree` (private `taffy`)                                                  | `PersistentLayoutTree` (private `engine`)                         |
| 함수   | `toTaffyDisplay`                                                                         | `toEngineDisplay`                                                 |
| 함수   | `elementToTaffyStyle` · `elementToTaffyBlockStyle`                                       | `elementToEngineStyle` · `elementToEngineBlockStyle`              |
| 함수   | `applyCommonTaffyStyle` (`utils.ts`)                                                     | `applyCommonEngineStyle`                                          |
| 함수   | `taffyStyleToRecord` (`fullTreeLayout.ts`)                                               | `engineStyleToRecord`                                             |
| 지역   | `taffyStyle` · `taffyConfig` · `hasTaffyChildren`                                        | `engineStyle` · `engineConfig` · `hasEngineChildren`              |

round 33 r33l1 — 남아 있던 현행 설명 4곳 정정: `binaryProtocol.ts:340` ("taffyStyleToRecord 에서 String()" → `engineStyleToRecord` · grid 분기 · `utils.ts`) · skills reference `layout-engine.md` "Taffy 네이밍 보존 규약" 절 → "어댑터 명명 (Phase 6 개명)" · `layout-details.md` "JS 어댑터 심볼명은 보존" → 개명 · `fullTreeLayout.static.test.ts` 테스트 이름 "persistent Taffy trees" → "persistent layout trees". 남긴 4곳 (`gridStyleAdapter`/`blockStyleAdapter`/`flexStyleAdapter`/`persistentLayoutTree` 머리말 "구 `TaffyXxx.ts`") 은 개명 이력 표기.

범위: builder src/tests 31 파일 · `scripts/adr-923/scan-block-inline.mjs` · Rust doc 주석 4 (`display.rs` · `lib.rs` · `grid.rs` · `tree.rs`) · `.claude` 활성 문서 5 (`rules/layout-engine.md` · `rules/style-ssot.md` · skills reference `layout-engine.md` · `component-registry.md` · `layout-details.md`). 남긴 "Taffy": 크레이트 이력 (ADR-916 "Taffy 완전 제거" · "Taffy 0.9 계보" 스키마 표기 · `@since … → Taffy 전환` 이력) 과 `wasm-bindings/{featureFlags,init,layoutBridge,binaryProtocol,compositionEngine*,spatialIndex}.ts` 의 이력 주석 (인벤토리 밖).

## 2. capability matrix seed — 실측 (2026-09-03, `@vitest/browser` Chromium, DOM leg ↔ `calculateFullTreeLayout` — Codex round 33 정정 반영)

| 행  | property · value                 | policy                              | 케이스 (`caseId`)                                                               | 노드 | Chrome            | 파이프라인     | gap {dx, dy, dw, dh} |
| --- | -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ---- | ----------------- | -------------- | -------------------- |
| S4  | `display: inline`                | declared-substitution (block 격상)  | `S4-inline-text-pair` — block(300, 16px/20px) > inline 텍스트 "AAAA" · "BBBB"   | b    | (41.9, 1) 40.8×18 | (0, 20) 300×20 | {41.9, 19, 259.2, 2} |
| S7  | `float: left`                    | ignored                             | `S7-float-left` — block(300) > float:left 60×20 + block 100×30                  | b    | (0, 0) 100×30     | (0, 20) 100×30 | {0, 20, 0, 0}        |
| S8  | `grid-template-columns: subgrid` | declared-substitution (독립 grid)   | `S8-grid-subgrid` — grid 2열(100·100) > col 1/3 subgrid 자식 > 아이템 20 높이 2 | s2   | (100, 0) 100×20   | (0, 20) 200×20 | {100, 20, 100, 0}    |
| S8  | `grid-auto-flow: row dense`      | declared-substitution (sparse 커서) | `S8-grid-dense` — grid 2열(100·100), row dense > col 1/3 · 1 · col 1/3 · 1      | d    | (100, 20) 100×20  | (0, 60) 100×20 | {100, 40, 0, 0}      |

- **round 33 r33m1 정정 — 6b 첫 판정 "dense Δ0 = 구현" 은 틀렸다.** 첫 fixture 가 `gridColumn: "span 2"` shorthand 를 썼는데 production 은 `gridColumnStart`/`gridColumnEnd` longhand 만 운반한다 (`fullTreeLayout.ts` grid 분기 :1137 · `engineStyleToRecord` :962 · `utils.ts` :5862) → DOM 은 span 을 적용하고 파이프라인은 버려서, 두 leg 이 서로 다른 배치 (DOM: span2·1·span2·1 dense 역채움 / 파이프라인: 전부 1열 아이템의 sparse 순서) 로 **우연히 같은 (100, 20)** 에 놓였다. longhand 로 격리하면 dense 는 {100, 40} — 엔진 `grid.rs` Phase 1 auto-placement 는 sparse 커서만 전진하고 (`auto_flow.contains("column")` 만 읽는다) 빈칸 역채움이 없다. ADR-916 1-B "dense 역채움 미구현" 과 breakdown §2.2 S8 "미구현" 은 지금도 맞다. subgrid 도 같은 혼합이었다 — 종전 {100, 20, 0, 0} 은 span 누락 (sub 폭 100) 이 섞인 수치, 격리 후 {100, 20, 100, 0} (sub 가 col 1/3 폭 200 의 단일 auto 트랙이라 s2 폭 200).
- **round 33 r33m2 정정 — S4 policy 는 `ignored` 가 아니라 `declared-substitution`.** `inline` 은 `normalizeCssDisplay` 를 그대로 통과해 경계 record 에 실리고 (`display: "inline"`), 엔진 `parse_display` 가 읽은 뒤 `is_atomic_inline_level` 이 inner=flow 를 제외해 block-level 로 치환한다 (`tree.rs write_block_item` code 0). 범주 정의를 **경계 기준** 으로 다시 썼다 — `ignored` = 키가 `EngineStyle`/Rust `StyleInput` 에 없어 어댑터가 싣지 않음 (float) · `declared-substitution` = 값은 실리지만 엔진이 다른 의미로 치환. 테스트는 행별 정확값 (`EXPECTED` 맵 — enum 집합 검사 폐기) + 같은 실행의 `buildTreeBatch` JSON 인자에서 대상 노드의 키 존재·값을 잡아 policy 를 기계 대조한다 (S4 `display:"inline"` 실림 · S7 `float` 키 없음 · S8 `gridTemplateColumns:["subgrid"]` · `gridAutoFlow:"row dense"` 실림 — 케이스 index → batch index 는 root 에서 children 순서로 내려가 대응).
- 단언 = "표 수치 == 실측" + "격차 > 0" + policy 경계 대조. 엔진이 구현하면 RED → 표를 수리 결과로만 갱신 (유리하게 바꿔 격차를 줄이는 방향 금지). 케이스는 **production 운반 키만** (shorthand 금지 — matrix 머리말·테스트 머리말에 명시).
- 원복 RED 5 (2026-09-03, 복원 md5 일치): (h) 표 S7 `dy 20 → 0` → 격차 it 1 FAIL · (i) 케이스 `float: "left"` 제거 → 1 FAIL (실측 {dy 0} ≠ 표) · (j) dense 케이스에서 `gridAutoFlow` 제거 → 2 FAIL (경계에 키 없음 → policy 대조 + Δ0 → 격차 0·표 불일치) · (k) 표 S4 policy → `ignored` → 2 FAIL (`EXPECTED` "expected 'ignored' to be 'declared-substitution'" + 경계 대조) · (l) subgrid 케이스를 `gridColumn: "span 2"` shorthand 로 되돌림 (r33m1 재현) → 1 FAIL (실측 {100, 20, 0, 0} ≠ 표 {100, 20, 100, 0}).

## 3. 헤더 재작성 (Phase 6 ②)

- `displayAdapter.ts` 머리말: round 31 (`91c2c25e6`) 에서 "시뮬레이션 단일 소스" → "엔진 경계 운반 레이어 + 번역 규칙 3" 으로 이미 재작성. 6a 에서 "Taffy 변환 결과 타입/상수" 절 제목 → "엔진 경계 운반 타입/상수".
- 개명 파일 4 (`flex`/`block`/`grid` StyleAdapter · `persistentLayoutTree`) 머리말: "Taffy 기반 … 엔진" → "style 어댑터 — 값 변환·정규화만, 계산은 Rust 엔진 (`flex.rs`/`block.rs`/`grid.rs`)" + 이력 1줄 (구 파일명 · ADR-916 · ADR-923 Phase 5/6). `blockStyleAdapter` 의 "inline-block 자식을 가진 부모는 flex row wrap 으로 자동 변환하여 inline flow 를 시뮬레이션합니다" 삭제 (Phase 5 이후 거짓).
- round 33 r33l2 — 세 머리말 (`displayAdapter.ts` 번역 규칙 · `blockStyleAdapter.ts` · `layoutTypes.ts` `EngineDisplay` doc) 이 "outer=inline → line item" 으로 일반화하고 있었다 → line item 은 **atomic inline-level** (outer=inline ∧ inner∈{flow-root, flex, grid} — inline-block · inline-flex · inline-grid) 만이고 순수 `inline` 은 S4 까지 block-level 격상 (`display.rs is_atomic_inline_level` :171) 으로 한정.
- `layoutTypes.ts` 머리말: "Taffy 접두 네이밍은 스키마 계보 표기로 유지" → "Phase 6 에서 `Engine*` 로 개명, 스키마는 Rust `StyleInput` (Taffy 0.9 계보) 과 1:1".

## 4. 문서 (Phase 6 ④)

- `docs/CHANGELOG.md`: 사용자-가시 2건 (block 컨테이너 안 inline-level 배치 Chrome 일치 · Button Direction 표시 정정) 은 Phase 5 엔트리 (`75d134e1f`, 2026-09-02) 에 이미 있다. Phase 6 은 동작 무변경 — 면제. Implemented 승격 (6d) 때 그 엔트리에 승격 사실을 덧붙인다.
- ADR-198 breakdown: `catalog-state-paint` L1 geometry 절에 종결 표기 (ADR-923 Phase 5 — 위치 발산 0, 잔여 Button 폭 Δ2.66 은 텍스트 측정).
- ADR-916 완료 문서: "명명 잔재 ADR-923 Phase 6 정리" 각주. round 33 r33l3 — 6c 커밋이 건드린 인접 줄 (Prettier 가 `N1~N5` 를 `N1~~N5` 취소선으로 바꾼 tree_golden 로그 줄) 의 금지 어휘 1건 교체 + `N1–N5` 로 되돌림. 파일의 다른 이력 줄은 손대지 않음 (완료 ADR 의 과거 기록).

## 5. 잔여 (6d — Codex round 33 통과 후)

- 실제 빌더에서 G6 시나리오 (block 컨테이너 + Button 2 + 폭 명시 frame) 를 개명 후 main 으로 1회 재실행 (Chrome MCP) → ADR 본문 `### Live Exercise` 기재 → Status `Implemented` + closure 5단계 (Status · 진행 로그 · README 카운트/행 · `docs/adr/completed/` 이동 + 경로 정합 · CHANGELOG).

## 6. Codex round 33 정정 (2026-09-03 — MEDIUM 2 · LOW 3 전부 fixed, 동작 변경 0)

| id    | 판정 | 수리                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| r33m1 | 확증 | S8 fixture 를 production 운반 longhand (`gridColumnStart/End`) 로 격리 → subgrid {100, 20, 100, 0} · dense 미구현 확정 (oracle `S8-grid-dense` {100, 40, 0, 0}). matrix `oracle` → `oracles[]` (값별 1 케이스, `caseId`) · S8 `behavior` 의 "dense 구현" 서술 삭제 · 머리말에 "운반 키만" 계약 명시. 종전 Δ0 의 원인 (shorthand 미운반 → 두 leg 이 다른 이유로 일치) 을 §2 에 기록. |
| r33m2 | 확증 | S4 policy `declared-substitution` · 범주 정의 경계 기준 재작성 · 테스트 `EXPECTED` 행별 정확값 + `buildTreeBatch` JSON 인자 경계 대조 it (S4 실림 · S7 키 없음 · S8 subgrid·dense 실림).                                                                                                                                                                                            |
| r33l1 | 확증 | `binaryProtocol.ts:340` · skills `layout-engine.md` 절 · `layout-details.md` · `fullTreeLayout.static.test.ts` 이름 (§1).                                                                                                                                                                                                                                                           |
| r33l2 | 확증 | `displayAdapter.ts` · `blockStyleAdapter.ts` · `layoutTypes.ts` 머리말 — atomic inline-level 한정 (§3).                                                                                                                                                                                                                                                                             |
| r33l3 | 확증 | ADR-916 건드린 줄 어휘 교체 + Prettier `~~` 되돌림 (§4).                                                                                                                                                                                                                                                                                                                            |

검증: 원복 RED (h)~(l) 5/5 · focused browser 9 파일 **125** (124 + policy 경계 대조 it 1) · full parity **1068** PASS (기존 GridListItem/Tooltip 2 FAIL · skipped 2) · layout unit 469 · type-check PASS. Rust 무변경 (cargo 371+15+10+11+1 은 round 33 판독 수치 그대로). 동작 변경 0 — live 대상 없음, CHANGELOG 면제.

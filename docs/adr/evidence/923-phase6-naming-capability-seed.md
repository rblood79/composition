# ADR-923 Phase 6 — 명명 정리 · capability matrix seed 실측 기록

> 2026-09-03 · 실행 Claude · 사용자 착수 승인 2026-09-03 (Codex round 32 "Phase 5 닫힘 · Phase 6 진입 가" 근거) · 판독 Codex round 33 대기. 동작 무변경 phase (6a 개명 · 6b 선언) — 6d (`### Live Exercise` → Implemented 승격 + closure) 는 round 33 통과 후.

## 0. 요약

| 항목                                    | 결과                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6a 개명 (`7f1cf963d`, 41 파일)          | 파일 5 (+ test 1) · 심볼 30종 (`layoutTypes` `Taffy*` 타입 17 포함) · 지역 변수·private 필드 · 개명 파일 머리말 재작성 ("style 어댑터 — 값 변환만, 계산은 Rust 엔진"; `blockStyleAdapter` 머리말의 종전 IFC 시뮬레이션 서술 삭제) · 규칙 `layout-engine.md` "JS 어댑터 심볼명은 Taffy\* 유지" 조항 → 개명 명시 · stale 심볼 `gridStyleAdapter.elementToTaffyGridStyle` 정정. 실행 코드 변경 = 이름뿐 |
| 6b capability matrix seed (`b48978fc1`) | `layoutCapabilityMatrix.ts` 3 행 (S4 · S7 · S8) 선언 + `adr923CapabilityMatrixSeed.browser.test.ts` 가 Chrome 격차 1 케이스씩 실측·고정 (표 수치 = 실측, 격차 > 0). `grid-auto-flow: dense` 는 실측 Δ0 — 구현돼 있어 matrix 밖                                                                                                                                                                       |
| 검증 (6a)                               | type-check PASS · layout 469 · builder (workspace·stores·panels·factories·utils·components·hooks·preview·types·ai) 3772 · focused browser 8 파일 122 · cargo 371+15+10+11+1                                                                                                                                                                                                                          |
| 검증 (6b)                               | seed 2/2 · 원복 RED (h) 1 · (i) 1 · type-check PASS                                                                                                                                                                                                                                                                                                                                                  |

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

범위: builder src/tests 31 파일 · `scripts/adr-923/scan-block-inline.mjs` · Rust doc 주석 4 (`display.rs` · `lib.rs` · `grid.rs` · `tree.rs`) · `.claude` 활성 문서 5 (`rules/layout-engine.md` · `rules/style-ssot.md` · skills reference `layout-engine.md` · `component-registry.md` · `layout-details.md`). 남긴 "Taffy": 크레이트 이력 (ADR-916 "Taffy 완전 제거" · "Taffy 0.9 계보" 스키마 표기 · `@since … → Taffy 전환` 이력) 과 `wasm-bindings/{featureFlags,init,layoutBridge,binaryProtocol,compositionEngine*,spatialIndex}.ts` 의 이력 주석 (인벤토리 밖).

## 2. capability matrix seed — 실측 (2026-09-03, `@vitest/browser` Chromium, DOM leg ↔ `calculateFullTreeLayout`)

| 행  | property · value                 | policy                | 케이스                                                    | 노드 | Chrome            | 파이프라인     | gap {dx, dy, dw, dh} |
| --- | -------------------------------- | --------------------- | --------------------------------------------------------- | ---- | ----------------- | -------------- | -------------------- |
| S4  | `display: inline`                | ignored (block 격상)  | block(300, 16px/20px) > inline 텍스트 "AAAA" · "BBBB"     | b    | (41.9, 1) 40.8×18 | (0, 20) 300×20 | {41.9, 19, 259.2, 2} |
| S7  | `float: left`                    | ignored               | block(300) > float:left 60×20 + block 100×30              | b    | (0, 0) 100×30     | (0, 20) 100×30 | {0, 20, 0, 0}        |
| S8  | `grid-template-columns: subgrid` | declared-substitution | grid 2열(100·100) > span2 subgrid 자식 > 아이템 20 높이 2 | s2   | (100, 0) 100×20   | (0, 20) 100×20 | {100, 20, 0, 0}      |

- S8 첫 후보 `grid-auto-flow: row dense` (2열, span2 · 1 · span2 · 1 — dense 면 4번째가 2행 2열) 는 파이프라인도 (100, 20) → **Δ0** — 엔진이 dense 를 구현하고 있다 (breakdown §2.2 S8 의 "dense 미구현" 은 낡음 — ADR-916 1-B 목록 작성 뒤 구현됨). seed 는 격차가 있어야 뜻이 있으므로 subgrid 로 교체하고, 표 `behavior` 에 dense Δ0 사실을 기록.
- 단언 = "표 수치 == 실측" + "격차 > 0". 엔진이 구현하면 RED → 표를 수리 결과로만 갱신 (유리하게 바꿔 격차를 줄이는 방향 금지).
- 원복 RED: (h) 표 S7 `dy 20 → 0` → 1 FAIL (`expected {dx 0, dy 20} to equal {dy 0}`) · (i) 케이스에서 `float: "left"` 제거 (DOM 도 쌓임) → 1 FAIL (실측 {dy 0} ≠ 표 {dy 20}). 복원 md5 일치.

## 3. 헤더 재작성 (Phase 6 ②)

- `displayAdapter.ts` 머리말: round 31 (`91c2c25e6`) 에서 "시뮬레이션 단일 소스" → "엔진 경계 운반 레이어 + 번역 규칙 3" 으로 이미 재작성. 6a 에서 "Taffy 변환 결과 타입/상수" 절 제목 → "엔진 경계 운반 타입/상수".
- 개명 파일 4 (`flex`/`block`/`grid` StyleAdapter · `persistentLayoutTree`) 머리말: "Taffy 기반 … 엔진" → "style 어댑터 — 값 변환·정규화만, 계산은 Rust 엔진 (`flex.rs`/`block.rs`/`grid.rs`)" + 이력 1줄 (구 파일명 · ADR-916 · ADR-923 Phase 5/6). `blockStyleAdapter` 의 "inline-block 자식을 가진 부모는 flex row wrap 으로 자동 변환하여 inline flow 를 시뮬레이션합니다" 삭제 (Phase 5 이후 거짓).
- `layoutTypes.ts` 머리말: "Taffy 접두 네이밍은 스키마 계보 표기로 유지" → "Phase 6 에서 `Engine*` 로 개명, 스키마는 Rust `StyleInput` (Taffy 0.9 계보) 과 1:1".

## 4. 문서 (Phase 6 ④)

- `docs/CHANGELOG.md`: 사용자-가시 2건 (block 컨테이너 안 inline-level 배치 Chrome 일치 · Button Direction 표시 정정) 은 Phase 5 엔트리 (`75d134e1f`, 2026-09-02) 에 이미 있다. Phase 6 은 동작 무변경 — 면제. Implemented 승격 (6d) 때 그 엔트리에 승격 사실을 덧붙인다.
- ADR-198 breakdown: `catalog-state-paint` L1 geometry 절에 종결 표기 (ADR-923 Phase 5 — 위치 발산 0, 잔여 Button 폭 Δ2.66 은 텍스트 측정).
- ADR-916 완료 문서: "명명 잔재 ADR-923 Phase 6 정리" 각주.

## 5. 잔여 (6d — Codex round 33 통과 후)

- 실제 빌더에서 G6 시나리오 (block 컨테이너 + Button 2 + 폭 명시 frame) 를 개명 후 main 으로 1회 재실행 (Chrome MCP) → ADR 본문 `### Live Exercise` 기재 → Status `Implemented` + closure 5단계 (Status · 진행 로그 · README 카운트/행 · `docs/adr/completed/` 이동 + 경로 정합 · CHANGELOG).

# ADR-204 design breakdown — 가상화 collection 의 min-content floor

> 본 문서가 구현 상세의 정본. ADR 본문은 결정과 위험만 보유한다.

## 1. Fork checkpoint 4 질문 lock-in (adr-writing.md §ADR Fork / 분리 결정)

사용자 confirm 기록: 2026-09-04 세션 — ADR-923 Phase 5 후속 잔여 판정에서 "7. 가상화 collection floor — 별도 ADR 필요 (사용자 /create-adr)" 로 분리를 지정했고, 같은 세션에서 `/create-adr 가상화 collection floor` 를 직접 입력했다. 종결 계약 성립 (재질문 금지).

1. **base / 응용 분류**: 본 ADR 은 **base** (레이아웃 엔진의 §4.5 자동 최소 크기 입력 계약). ADR-150 A2 (collection 가상화 투영) 와 ADR-162 (GridList 템플릿 자식 실체화) 는 이 계약의 **응용** — 투영 정밀도를 올리는 쪽이고, 본 ADR 은 투영이 무엇을 레이아웃 입력으로 공급해야 하는지를 정한다. 따라서 본 ADR 이 두 응용의 선행이 아니라 **직교** — 응용이 행 높이를 더 정확히 산출하면 본 ADR 이 공급하는 스칼라의 정확도가 같이 오른다.
2. **schema 직교성**: 직교. 본 ADR 은 canonical schema 를 바꾸지 않는다 — 변경 범위는 wasm 경계 입력 배열 슬롯과 그 read-time 산출뿐이다. ADR-150/162 는 canonical 의 dataBinding/템플릿 축.
3. **선행 ADR 전제 reverse 검증**: ADR-164 (TS 보정 흡수 — §4.5 조건 단일화) 와 ADR-165 (intrinsic 측정 계약 — `content_min_width` 스칼라) 의 의존 방향을 그대로 승계한다. 근거 grep: `resolve_auto_min_main` 정의·소비 2곳 (`flex.rs:300`, `tree.rs:2205`), `content_min_width` 정의·소비 (`tree.rs:260`, `tree.rs:3859`). 본 ADR 은 그 두 계약의 **가로축 → 세로축 확장**이므로 방향 반전 없음.
4. **codex 3차 미루기 회피**: Phase 0 종료 시점에 판독 1회 진입 (본문 정합이 아니라 §3 first-nail 의 판정을 대상으로).

## 2. 코드 사실 표 (착수 전 실측 — 사실 1줄 + 경로:라인 + 확인 명령)

| 사실                                                                                                                                                          | 경로:라인                                                                       | 확인 명령                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| §4.5 자동 최소 크기는 **주축 크기가 auto 일 때만** content 기반 — definite 이면 `min_main`(AUTO) 을 그대로 반환                                               | `packages/composition-engine/src/flex.rs:332`                                   | `sed -n '326,345p' packages/composition-engine/src/flex.rs`                                      |
| 조건 정의는 단일 함수 소유 (커널 + explain 트레이스가 같은 함수)                                                                                              | `flex.rs:300` (`resolve_auto_min_main`) · `tree.rs:2205`                        | `grep -rn "resolve_auto_min_main" packages/composition-engine/src`                               |
| 슬롯 18 = **item 자신**의 scroll container 여부. clip/visible = 0 → content floor 유지                                                                        | `packages/composition-engine/src/tree.rs:4786-4788`                             | `sed -n '4783,4790p' packages/composition-engine/src/tree.rs`                                    |
| 정확 min-content 스칼라 (슬롯 19) 는 **row 축에서만** 존재. column 은 0 → `content_main` fallback                                                             | `tree.rs:4790-4800`                                                             | `sed -n '4789,4800p' packages/composition-engine/src/tree.rs`                                    |
| 슬롯 19 는 **논리 main** 이고 `main_size == AUTO` 일 때만 읽힌다 — definite 주축이면 미소비                                                                   | `flex.rs:75` (필드 계약) · `flex.rs:301-310` (`main_size` = `data[off+1]`)      | `sed -n '48,80p' packages/composition-engine/src/flex.rs`                                        |
| 측정 케이스의 collection 은 주입 높이 164 가 **definite 논리 main 으로 경계에 닿는다**                                                                        | `apps/builder/tests/parity/adr923Dc6ChromeGate.browser.test.ts:147`             | `sed -n '147p' apps/builder/tests/parity/adr923Dc6ChromeGate.browser.test.ts`                    |
| 기본 상태 non-scrollable 이 둘 — `Table` (catalog overflow 선언 없음 + `heightMode:"fixed"` height 400) · stack 배치 `GridList` (else 분기가 overflow 미설정) | `implicitStyles.ts:1350-1380` · `:1600-1605`                                    | `sed -n '1592,1606p' apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts` |
| column 축을 비운 사유는 선언된 제약이다 — "column 의 main=height 는 height-for-width 재줄바꿈 영역 → 2-pass 잔존 계약"                                        | `tree.rs:4789-4790`                                                             | `sed -n '4789,4800p' packages/composition-engine/src/tree.rs`                                    |
| TS 공급 측정 스칼라의 세로축 대응이 없다 (`content_min_width` / `content_max_width` 만)                                                                       | `tree.rs:260` · `tree.rs:3843-3860`                                             | `grep -n "content_min_width\|content_max_width" packages/composition-engine/src/tree.rs`         |
| 측정 스칼라의 실제 경로는 JSON — binary protocol 은 미가동이고 가로축 스칼라도 비등재다 (실구현 시 f32 범위 편입 요구가 주석으로만 남아 있다)                 | `apps/builder/.../wasm-bindings/binaryProtocol.ts:81-85` · `layoutTypes.ts:181` | `sed -n '80,86p' apps/builder/src/builder/workspace/canvas/wasm-bindings/binaryProtocol.ts`      |
| 가상화 대상 collection owner 3종 — 자식 0 이면 GAP 4 를 skip 한다                                                                                             | `apps/builder/.../layout/engines/fullTreeLayout.ts:139` · `:3322-3335`          | `sed -n '134,141p' apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`   |
| 행은 scene graph 투영이 그린다 — layout 트리 자식이 아니다 (window 해석은 canonical 1회 walk)                                                                 | `apps/builder/.../scene/collectionVirtualization.ts:1-35`                       | `sed -n '1,20p' apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts`     |
| 행 높이 산출은 layout `calculateContentHeight` 와 **같은 심볼** (`resolveListBoxItemRowHeightFromStyle`)                                                      | `collectionVirtualization.ts:9-13` · `layout/engines/utils.ts:2502-2570`        | `grep -n "resolveListBoxItemRowHeightFromStyle" -r apps/builder/src`                             |
| 도달 실측: 제약 flex column 80 안에서 production ListBox/GridList 는 visible/clip 에서도 **80** — DOM 아날로그는 **164**                                      | `apps/builder/tests/parity/adr923Dc6ChromeGate.browser.test.ts:147-213`         | `sed -n '145,215p' apps/builder/tests/parity/adr923Dc6ChromeGate.browser.test.ts`                |
| 관찰 기록 원천 (수리 금지 · 범위 밖 항목으로 남긴 지점)                                                                                                       | `docs/adr/evidence/923-phase5-cutover.md:78` · `:166`                           | `grep -n "가상화 collection" docs/adr/evidence/923-phase5-cutover.md`                            |

## 3. Phase 0 — 사실 고정 + first-nail (착수 승인 단위 · 인벤토리와 별도)

**first-nail (원인 가설 반증 1 케이스)**: production ListBox 를 `height` 없이 (주축 AUTO) 제약 flex column 안에 두고 `overflow:visible` 로 1회 측정한다.

- AUTO 에서 격차가 **사라지면** → 원인은 definite 가드 (`flex.rs:332`) + content 공급 0 두 겹이 맞고, A + C 결합이 필요조건으로 고정된다.
- AUTO 에서도 격차가 **남으면** → 원인 가설이 틀렸다 (공급 경로가 다른 곳에서 끊긴다). Decision 재작성 후 재리뷰.
- 비용은 기존 browser 게이트 케이스 1줄이고, 프로그램 (Phase 1~4 + 커널 조건 확장) 보다 훨씬 싸다.

참고: ADR-923 evidence 의 서술 ("automatic minimum = min(specified 164, content 0) = 0") 은 스펙 수준 재진술이고 `flex.rs:332` 의 코드 형태 (definite 이면 아예 미소비) 와 다르다 — 본 ADR 은 코드 형태를 정본으로 쓴다.

**인벤토리 (별도 단위)**:

1. 투영으로만 행을 그리는 collection type 전수 — `A2_WINDOWED_COLLECTION_TAGS` 3종 외에 Table 투영 (`getTableProjectionRows`) · TableView · Tree · Menu 목록이 같은 성질인지 각각 production 트리로 확인 (자식 수 0 여부).
2. 도달 조건 매트릭스 — {type} × {overflow: visible / clip / hidden / auto} × {부모: 제약 flex column / 무제약}. 기대: scrollable (hidden/auto) 은 양쪽 0 으로 **정합**, 격차는 visible/clip 에만.
3. BC 수식화 — 로컬 검증 프로젝트와 fixture 전수에서 "collection + non-scrollable + 제약 flex 주축 item" 형태의 실제 출현 수를 센다. **기본 상태 둘 (`Table` · stack `GridList`) 이 이미 non-scrollable** 이므로 authored overflow 만 세면 과소 계수다. 재직렬화는 0 (read-time 파생, canonical 미변경) 임을 같이 기록.
4. 대안 C 회귀 표면 — collection 밖 "definite 높이 + min auto + non-scrollable" flex item 의 출현 수 (R1 HIGH 의 크기).

## 4. Phase 1 — 엔진 (Rust)

- 세로축 content-min 필드 추가 (`content_min_height`) — Rust `NodeStyle` + TS `layoutTypes.ts` (활성 경로는 JSON). 커널 쪽은 슬롯 19 (`content_min_main`, 이미 논리 main) 를 `is_row` 에 따라 둘 중 하나로 채운다 — **`FLEX_FIELD_COUNT` 불변**.
- 채우는 대상을 **가상화 collection type 으로 한정**한다 (R5) — `tree.rs:4789-4790` 이 column 축을 비운 사유는 height-for-width 재줄바꿈 2-pass 계약이고, 텍스트 노드로 일반화하면 그 계약과 충돌한다.
- **대안 C — §4.5 specified size suggestion 절**: `auto_min_main_from_parts` 의 `main_size == AUTO` 가드를 `min(specified, content)` 로 대체. 이것이 없으면 위 공급이 측정 케이스에서 읽히지 않는다. 조건 소유는 계속 이 함수 하나 (ADR-183 R2 — 조건을 호출부에 복제하면 explain 이 옛 조건을 보고한다).
- `binaryProtocol.ts` 의 비등재 주석에 세로축 스칼라를 같이 적는다 — binary protocol 실구현 시 누락되면 silent drop 이고 그 주석이 유일한 경고다 (R3).
- cargo 테스트: 기존 스위트 PASS 유지 + 신규 커널 케이스 (definite × scrollable × content 유무).

## 5. Phase 2 — TS 공급 (Canvas)

- 가상화 collection owner 의 세로축 content-min = `행 수 × stride + padding/border` 를 read-time 산출해 measure 계약으로 넘긴다. **행 높이 심볼은 신설하지 않는다** — `resolveListBoxItemRowHeightFromStyle` / `getTableProjectionRows` 를 그대로 쓴다 (scene 투영과 같은 값이어야 스크롤 총량과 floor 가 갈리지 않는다).
- 빈 collection (행 원천 전부 없음) 은 0 — ADR-923 r21m1 의 `data-empty` 계약과 같은 판정.
- 주의: 이 값은 **floor 입력**이지 주입 높이가 아니다. 기존 주입 높이 (implicitStyles) 경로는 건드리지 않는다.

## 6. Phase 3 — 게이트

| Gate | 내용                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 first-nail 1 케이스 (주축 AUTO ListBox) — 원인 가설 확정 후 Phase 1 진입                                                  |
| G1   | 도달 매트릭스 Chrome 차등 — 격차 행 전부 ≤1px · scrollable 행 값 불변 · **collection 밖 대조군** (definite 높이 일반 div) 회귀 0  |
| G2   | 원복 RED — (a) 세로축 스칼라 공급 제거 → 격차 행 RED, (b) specified 절 원복 → 격차 행 RED (두 겹 각각이 필요조건임을 실증)        |
| G3   | 프레임 예산 — `pnpm perf:baseline -- --lane frame` 600 요소 p50 회귀 ≤ +1%, 레이아웃 노드 수 증가 0                               |
| G4   | live exercise — 빌더에서 collection 에 overflow visible 을 주고 제약 flex 안에 둔 뒤 Skia rect 와 publish DOM 을 같은 상태로 대조 |

## 7. Phase 4 — 종결

evidence (`docs/adr/evidence/204-*.md`) · CHANGELOG · README 카운트 · ADR 본문 `### Live Exercise` 절.

## 8. 하지 않는 것

- 투영 행을 layout 트리에 실체화하지 않는다 (ADR 본문 대안 B 기각).
- collection 의 주입 높이 계약 (implicitStyles) 변경 없음.
- ADR-150 A2 window 해석 · ADR-162 템플릿 자식 실체화 범위 미진입.

## 9. 반복 패턴 선차단 자가 점검 (adr-writing.md)

- HIGH 위험 2건의 코드 경로 3곳 이상 인용 — R1 (C 의 커널 회귀 표면): `flex.rs:332` · `flex.rs:301-310` · `tree.rs:4793`. R3 (스칼라 경로 이중화): `layoutTypes.ts:181` · `tree.rs:260` · `binaryProtocol.ts:81-85`.
- Generator 확장 아님을 ADR 본문 Context 에 선언 (D3 시각 토큰·생성 CSS 불변).
- BC 수식화: 재직렬화 0 파일 · 팔레트 기본 상태 영향 0% · 실제 출현 수는 Phase 0 §3 인벤토리 3 에서 계수.
- HIGH 잔존 시 별도 ADR 분리 가능한가: R3 는 구현 내부의 배선 위험이라 분리 대상이 아니다. R1 (대안 C 의 커널 회귀 표면) 은 분리 후보로 검토했으나 **분리 불가** — C 없이는 A 가 측정 케이스에서 읽히지 않아 (`flex.rs:332`) 두 조각 중 어느 쪽도 단독으로 사용자-가시 변화를 내지 못한다. 분리하면 검증 불가능한 phase 가 하나 생긴다.
- 추정 vs 실측 gap: Phase 0 인벤토리 보강으로 흡수, 새 ADR 분리 사유로 쓰지 않는다 (M3).

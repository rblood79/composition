# ADR-204 Phase 1 — §4.5 specified size suggestion (대안 C) + column definite 컨테이너 스칼라 (2026-09-04)

> 커널 절 1 + writer 1. cargo 376 lib + golden 15 PASS · browser parity **1105 PASS** (실패 2 = 기존 GridListItem·Tooltip, 이동 0) · G0 column definite **164 = 164**.

## 1. 설계가 두 번 좁아졌다 — 둘 다 실측이 강제했다

### 1-1. content_main 은 definite item 의 content 제안이 아니다

최초 구현은 definite 주축에서 `min(specified, content_main)` 을 썼다. 즉시 두 곳이 깨졌다:

- golden `flex_column_shrink` — height 100 두 개가 120 안에서 60/60 이어야 하는데 100/100.
- 기존 계약 `width_definite_item_keeps_free_shrink`.

원인: `content_main` (슬롯 13) 은 `child_sizes` = `solve_node` 결과, 즉 definite item 에서는 **자기 solved 크기**다 (`tree.rs` 1) 단계 → `write_flex_item`). 그걸 제안으로 쓰면 floor = specified 로 굳어 definite item 이 영영 shrink 하지 못한다. Chrome 의 content size suggestion 은 **내용**의 min-content 라 다르다.

**결정**: definite 주축의 절은 **정확 스칼라 (슬롯 19) 가 있을 때만** 동작한다. 스칼라 공급은 writer 책임. 이 형태는 지금 존재하는 어떤 값도 잘못 읽지 않는다 — 실제로 커널 절만 넣은 상태의 parity 전량이 기준선 이동 0 이었다.

### 1-2. row definite 컨테이너의 스칼라 공급은 perf 기준선과 충돌한다 — 이연

row 축은 `measure_intrinsic_width` (가상 solve 2회) 가 auto 폭 컨테이너에만 열려 있다. definite 폭 컨테이너로 넓히려면 자기 폭을 잠시 auto 로 두고 재야 하고 (`intrinsic_w` 캐시는 "자기 폭 포함" 의미라 `col_contribution` 과 충돌 → 앞뒤로 비워야 함), shrink 행에서만 열도록 pre-scan 을 넣어도 **ADR-188 G0 방문 수 기준선이 2N → 4N** (N=50: 198 vs 100) 으로 깨진다. 그 fixture 는 실제로 shrink 하는 행이라 gate 가 정당하게 열린 것이고, 비용은 진짜다.

**결정**: 보호된 perf 기준선을 실행자 판단으로 바꾸지 않는다. row definite 컨테이너 경로는 되돌리고 (`tree.rs` 2-b 의 `continue` 에 사유 주석), 별도 perf 판정으로 넘긴다. G0 의 row/definite 행은 그때까지 80 으로 남는다 (기록).

## 2. 반영한 것

| 층      | 변경                                                                                                                                                                                                                        | 파일                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 커널    | `auto_min_main_from_parts` — definite 주축 + min auto + non-scrollable + **스칼라 있음** → floor = `min(specified, 스칼라)`, max clamp. 새 `FloorSource::SpecifiedSizeMin`                                                  | `flex.rs` · `trace.rs`                      |
| writer  | **2-c column**: definite 높이 컨테이너 (자식 있음 · min auto · non-scrollable · 슬롯 19 비어 있음) 에 **자식 layout 의 max bottom + pad_border** 를 슬롯 19 로 공급 — 1) 단계가 이미 자식을 배치해 뒀으므로 가상 solve 0 회 | `tree.rs`                                   |
| explain | `SpecifiedSizeMin` 문구                                                                                                                                                                                                     | `compositionEngine.ts` · `layoutExplain.ts` |

column 을 자식 extent 로 읽을 수 있는 근거: block 축 min-content 는 **그 폭에서의 내용 높이**라 재줄바꿈이 없다 — row 의 2-pass 계약 (R5, `tree.rs` 2-b 주석) 과 다른 축이다. 하한 근사 1건: 자식 bottom margin 은 더하지 않는다 (floor 가 조금 낮은 쪽 = 보수적).

## 3. 게이트

| 게이트                                | 결과                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| cargo                                 | 376 lib (신규 5: definite+스칼라 → min · 스칼라 > specified → specified · 스칼라 없음 → 종전 · scroll → 0 · column 대칭) + golden 15 PASS |
| G0 (`adr204MinContentFloorFirstNail`) | **column definite 164 = 164** (착수 전 80) · row definite 80 (writer 이연) · 대조군 4행 불변                                              |
| DC-6 (`adr923Dc6ChromeGate`)          | 11 PASS 불변 — ListBox/GridList 는 자식 0 이라 extent 0 → 스칼라 없음 → 종전 (Phase 2 / A 의 몫)                                          |
| browser parity 전량                   | **1105 PASS** · 실패 2 = 기존 (GridListItem·Tooltip) · **이동 0** — R1 이 걱정한 기준선 이동이 이 범위에서는 없었다                       |
| type-check                            | PASS                                                                                                                                      |

## 4. 원복 RED

| 원복                                          | 결과                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| (a) 커널 절 제거 (definite → 즉시 `min_main`) | cargo **3 FAIL** (definite+스칼라 · 상한 clamp · column 대칭) — "스칼라 없음 → 종전" · "scroll → 0" 은 설계상 불변 |
| (b) column writer 제거                        | G0 column definite **80** (writer 추가 전 실측이 그 값) — 같은 게이트의 전후 두 실행이 이 원복이다                 |

md5 복원 일치.

## 5. Live Exercise (Chrome MCP, 2026-09-04 — localhost:5173 · 프로젝트 QWE · Home 390×844)

- 팔레트 `frame` 3회 클릭 (선택이 부모가 되는 production 생성 경로) → F1 > F2 > F3. Inspector writer (`updateElementProps`) 로 F1 `display:flex · column · width 200 · height 80 · overflow visible`, F2 `width 100 · height 164 · overflow visible`, F3 `width 50 · height 164`.
- **Skia** (`__composition_LAYOUT_DEBUG__.getSharedLayoutMap()`): F1 200×**80** · F2 100×**164** · F3 50×164 — definite 높이 F2 가 제약 80 의 column 안에서 content floor 164 를 지킨다 (G0 column definite 와 같은 값; 착수 전 80). 캔버스 선택 배지 `50 × 164`.
- **대조군**: F2 `overflow:auto` → **80** (scroll container 는 §4.5 floor 0 — Chrome 과 같다).
- 원복: `removeElement(F1)` (자손 포함) — 요소 수 93 복원, 테스트 frame 0. (Cmd+Z 7회는 팔레트 검색 입력에 포커스가 남아 적용되지 않았다 — 기록.)

## 6. 남은 것 (Phase 2 진입 조건)

- **row definite 컨테이너 스칼라** — 2N→4N perf 판정 (사용자). 판정 전까지 row 축 definite 컨테이너는 종전 floor 0.
- **Table 의 DOM leg** — RAC `TableVirtualizer` 창 렌더라 Chrome 값 미측정. G1 매트릭스에 Table 을 넣으려면 DOM leg 을 rendererMap 으로 마운트해 재야 한다.
- **Phase 2 / A** — ListBox·GridList (자식 0) 의 세로축 스칼라 = 행 수 × stride (투영과 같은 심볼). 이제 커널·writer 경로가 있으므로 `contentMinHeight` 필드 1개 + `implicitStyles` 공급 1곳.

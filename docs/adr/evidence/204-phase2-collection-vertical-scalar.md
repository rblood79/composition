# ADR-204 Phase 2 — 가상화 collection 의 세로축 스칼라 (대안 A) (2026-09-04)

> TS 필드 1 + 공급 1곳 + writer 분기 1. DC-6 게이트의 "visible/clip 도 80" 사실 고정이 **164** 로 이동 — ADR-204 의 목표 그 자체. browser parity **1105 PASS** (실패 2 = 기존, 그 외 이동 0).

## 1. 반영한 것

| 층   | 변경                                                                                                                                                                                                                                               | 파일                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 경계 | `contentMinHeight?: number` (content-box px) — JSON 활성 경로. `binaryProtocol.ts` 비등재 주석에 같이 명기 (R3 — 실구현 시 f32 편입 누락이면 silent drop, 그 주석이 유일한 경고)                                                                   | `layoutTypes.ts` · `fullTreeLayout.ts` · `utils.ts` (pass-through) · `binaryProtocol.ts` · `layoutExplain.ts` |
| 엔진 | `NodeStyle.content_min_height` — `write_flex_item` 이 column 컨테이너의 item 일 때 슬롯 19 로 싣는다 (`+ pad_border_main`, row 의 `content_min_width` 와 같은 규약). 커널 슬롯 신설 없음                                                           | `tree.rs`                                                                                                     |
| 공급 | `enrichWithIntrinsicSize` — `listbox` / `gridlist` owner 에 한해 (R5: type 한정) 주입 높이의 원천 (§1.55b/§1.55c = 행 수 × stride, 투영 window resolver 와 같은 심볼) 에서 padding·border 를 뺀 content-box 값을 `contentMinHeight` 로 같이 싣는다 | `utils.ts` (`injectedStyle.height` 직후)                                                                      |

기본 상태 (ListBox `auto` · GridList `hidden`) 는 scroll container 라 엔진이 §4.5 절을 건너뛴다 — 값이 실려도 무변화. 격차는 `visible`/`clip` 을 저작했을 때만 있었고 그때만 닫힌다.

## 2. 게이트

| 게이트                            | 결과                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DC-6 (`adr923Dc6ChromeGate`)      | "ListBox/GridList 80 visible/clip" 4행 **80 → 164** (DOM 아날로그 164 와 일치). raw (scroll container) 4행 80 불변 — 절이 non-scrollable 안에서만 동작하는 대조군 |
| G0 · 도달 인벤토리                | 11 PASS 불변 (column definite 164 · row definite 80 이연 · 대조군 4행)                                                                                            |
| cargo                             | 376 lib + golden 15 PASS                                                                                                                                          |
| builder unit (`workspace/canvas`) | 1580 PASS                                                                                                                                                         |
| browser parity 전량               | **1105 PASS** · 실패 2 기존 (GridListItem·Tooltip) · DC-6 갱신분 외 이동 0                                                                                        |
| type-check                        | PASS                                                                                                                                                              |

DC-6 기준선 이동의 판정 (R1 절차): 종전 값 80 은 evidence 가 "DOM 아날로그 164 와 갈린다" 고 기록해 둔 관찰이었다 → **잘못된 값에 고정된 기준선** → 갱신. 갱신 근거를 게이트 주석에 남겼다.

## 3. 원복 RED

| 원복                                                                           | 결과                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| enrich 의 `contentMinHeight` 공급 제거                                         | DC-6 `ListBox 80 visible: expected 80 to be close to 164` — 1 FAIL |
| (Phase 1 의 커널 절 제거는 같은 행을 80 으로 되돌린다 — 두 겹이 각각 필요조건) |

md5 복원 일치.

## 4. Live Exercise (Chrome MCP, 2026-09-04 — localhost:5173 · 프로젝트 QWE · Home 390×844)

- 팔레트 `frame` → F1 (선택 부모 = body), 팔레트 `list box` → F1 안에 ListBox **ref 인스턴스** (items 3, production 생성 경로). Inspector writer (`updateElementProps`) 로 F1 `display:flex · column · width 300 · height 80 · overflow visible`, ListBox `overflow: visible`.
- **Skia** (`__composition_LAYOUT_DEBUG__.getSharedLayoutMap()`): F1 300×**80** · ListBox 300×**164** — 자식 0 인 가상화 collection 이 제약 80 의 column 안에서 행 수 × stride 의 floor 를 지킨다 (DC-6 게이트 "ListBox 80 visible" 164 와 같은 값; 착수 전 80). ref 인스턴스도 같은 enrich 경로를 탄다 (componentName 해석).
- **대조군**: ListBox `overflow:auto` → **80** (scroll container — §4.5 floor 0, Chrome 과 같다).
- 원복: `removeElement(F1)` — 요소 수 93, 잔여 0.
- DOM 대조는 DC-6 게이트의 아날로그 (flex column 80 > div visible/clip > 164) 164 가 oracle — 같은 문서를 publish 로 렌더한 RAC ListBox 실측은 G1 매트릭스 (Phase 3) 의 몫으로 남긴다.

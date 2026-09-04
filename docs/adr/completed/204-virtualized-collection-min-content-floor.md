# ADR-204: 가상화 collection 의 min-content floor — 투영 행이 §4.5 자동 최소 크기에 도달하는 경로

## Status

Implemented — 2026-09-04 (Phase 0~~3 · G0~~G4 통과. Accepted 2026-09-04 — 리뷰 round 1 종결)

진행 로그:

- **Phase 0 Implemented 2026-09-04** — G0 first-nail 통과 + 도달 인벤토리. 설계 교체 1건 (collection 을 쓰지 않는 형태로) · ADR 전제 정정 2건. [evidence](../evidence/204-phase0-first-nail-and-reach.md)
- **Phase 1 Implemented 2026-09-04** — 대안 C 커널 절 (정확 스칼라 보유 definite item 만 — `content_main` 은 definite item 의 자기 solved 크기라 제안이 아님을 golden 이 즉시 드러냈다) + column definite 컨테이너 스칼라 writer (자식 extent, 가상 solve 0). G0 column definite **164 = 164** · parity 1105 PASS 이동 0 · live F2 164 / auto 80. **row definite 컨테이너 writer 는 이연** — ADR-188 G0 방문 수 2N→4N 과 충돌 (사용자 perf 판정). [evidence](../evidence/204-phase1-specified-size-suggestion.md)
- **Phase 4 종결 2026-09-04** — Implemented 승격 · README 이동 · CHANGELOG · archive. **이연 확정 1**: row definite 컨테이너 스칼라 writer (ADR-188 G0 방문 수 2N→4N) 는 채택하지 않았다 — row 축은 텍스트 leaf 스칼라 (`contentMinWidth`) 까지만이고 row 컨테이너 definite item 은 G0 row definite 행 (DOM 164 vs production 80) 그대로 남는다. 재개 조건 = ADR-188 기준선 갱신을 사용자가 승인할 때 (Phase 1 evidence §3).
- **Phase 3 Implemented 2026-09-04** — G1·G3 통과. G1 은 DOM leg 를 `rendererMap` 실렌더로 바꿔 24 행 Chrome 대조 (≤1px). 착수 시 RED 2 행의 원인은 커널·스칼라가 아니라 **Canvas 만의 implicit 주입** — Table `minHeight: 402` (DOM 외곽은 catalog min-height 40 → 제약 flex 에서 같이 줄어든다) · GridList `overflow: hidden` (GridList.css 에 overflow 없음 → non-scrollable, Chrome 164). 둘 다 주입 제거, 기준선 갱신 (DC-6 GridList raw 80→164 · ratchet 19→18 · Table minHeight 402→40px). **Phase 0 전제 재정정 3번째** — 기본 상태 격차는 Table + GridList (GridList 를 scrollable 로 센 것은 주입을 production 사실로 읽은 오류). G3 노드 210 불변 · frame p50 회귀 신호 없음. live: GridList 기본 80→164 · Table 402→80. [evidence](../evidence/204-phase3-gates.md)
- **Phase 2 Implemented 2026-09-04** — 대안 A. `contentMinHeight` (JSON 경계 + `binaryProtocol.ts` 비등재 주석 동시 — R3) · `NodeStyle.content_min_height` → column 슬롯 19 · enrich 가 listbox/gridlist owner 에 주입 높이 원천 (행 수 × stride) 의 content-box 값을 공급. DC-6 "visible/clip 80" 사실 고정 → **164** (DOM 아날로그와 일치, 기준선 갱신 근거 기록) · parity 1105 PASS 그 외 이동 0 · 원복 RED 공급 제거 → 80 · live ListBox ref visible 164 / auto 80. [evidence](../evidence/204-phase2-collection-vertical-scalar.md)

## Context

Canvas 의 **ListBox · GridList** 는 행을 **scene graph 투영**으로 그린다 — 행이 레이아웃 트리의 자식이 아니라 실측 자식 수가 0 이다 (`collectionVirtualization.ts`, `fullTreeLayout.ts:139` `A2_WINDOWED_COLLECTION_TAGS`, 자식 0 이면 GAP 4 skip `:3322-3335`; Phase 0 인벤토리 실측). 같은 투영 목록의 **Table 은 레이아웃 자식이 2** 라 이 형태가 아니다 — 투영 대상인 것과 자식이 0 인 것은 다른 사실이었다. 그래서 이 collection 이 flex item 이 될 때 엔진이 보는 **content 크기 제안이 0** 이다. DOM 은 ListBox / GridList 에서 RAC 가 행을 실제 자식으로 렌더하므로 같은 문서에서 min-content 가 행 수 × stride 다 (실측 범위도 이 둘뿐 — Table 은 DOM 쪽도 RAC `TableVirtualizer` 가 창 렌더라 양쪽 leg 모두 미측정이다, Phase 0 확인 대상).

실측 (ADR-923 Phase 5, `adr923Dc6ChromeGate.browser.test.ts:147-213`): 제약 `flex column 80` 안의 production ListBox(auto) / GridList(hidden) 는 주입 높이 164 를 갖고도 80 으로 줄어든다. `overflow` 를 `visible` / `clip` 으로 바꿔도 **여전히 80** 이고, 같은 의미의 DOM 아날로그는 **164** 다. scroll container 는 §4.5 가 floor 0 을 주도록 정한 대로라 양쪽이 같지만, **non-scrollable 인 visible / clip 에서 D3 대칭이 갈린다**. ADR-923 은 이 지점을 범위 밖 관찰로 기록만 했다 (`evidence/923-phase5-cutover.md:78` · `:166`).

엔진 쪽 코드 사실은 두 가지다. ① §4.5 자동 최소 크기는 **주축 크기가 auto 일 때만** content 기반이다 (`flex.rs:332` — definite 이면 `min_main`(AUTO) 을 그대로 반환). ② TS 가 공급하는 정확 min-content 스칼라는 **가로축에만** 있다 (`tree.rs:260` `content_min_width` · `layoutTypes.ts:181`, 커널 슬롯 19 는 `is_row` 에서만 실린다 — `tree.rs:4790-4800`). 즉 세로축에는 "이 노드의 콘텐츠가 최소 이만큼" 을 말할 채널 자체가 없다. 이 스칼라가 실제로 다니는 길은 JSON 이고 binary protocol 은 아직 미가동이다 (`binaryProtocol.ts:81-85` — 가로축 스칼라도 비등재). ③ 커널 슬롯 19 자체는 이미 **논리 main** 이다 (`flex.rs:75` `content_min_main`) — 세로축을 위해 새 슬롯을 만들 필요가 없고, 비어 있는 것은 `tree.rs:4793` 의 `is_row` writer 가드다.

**두 사실이 곱해진다**: ①의 가드 때문에 슬롯 19 는 **주축 크기가 AUTO 일 때만 읽힌다** (`flex.rs:301-310` — `main_size` = `data[off+1]`, 필드 계약상 논리 main). 그런데 측정 케이스의 collection 은 주입 높이 164 가 **definite 한 논리 main 으로 경계에 닿는다** (`adr923Dc6ChromeGate.browser.test.ts:147`). 따라서 세로축 값을 공급해도 그 경로에서는 읽히지 않는다 — ②만 닫는 것으로는 부족하고 ①도 같이 닫아야 한다.

**Phase 0 실측 (G0)**: ①은 collection 과 무관하게 성립한다 — 자식이 실재하는 일반 상자에서도 주축이 definite 이면 Chrome 164 vs production 80 으로 갈리고, 대조군인 주축 AUTO (164=164) 와 scroll container (80=80) 는 정합이다 (양 축 동일). 즉 ①은 **§4.5 specified size suggestion 절의 부재**이고 그 자체로 이미 발산 중이다.

본 ADR 은 **base** — 레이아웃 엔진의 자동 최소 크기 **입력 계약**을 정한다. ADR-150 A2(투영 window)·ADR-162(템플릿 자식 실체화)는 투영 정밀도의 응용 축이고 canonical schema 와 직교다 (분류 근거: design breakdown §1).

**Generator 선언 (adr-writing.md 반복 패턴 #2)**: 본 ADR 은 spec / CSS Generator 확장이 **아니다**. D3 시각 토큰과 생성 CSS 는 불변이고, 변경 채널은 layout 입력 하나다 — 활성 경로는 JSON (`layoutTypes.ts` ↔ Rust `NodeStyle`) 이고 커널 배열은 기존 슬롯 19 를 축에 따라 채우는 것뿐이다.

**Hard Constraints**:

1. 격차 행의 Canvas 높이가 Chrome 실측과 **≤ 1px** (ADR-198 픽셀 정합과 같은 판정 축).
2. scrollable (`hidden` / `auto`) 행은 **값 불변** — 현행 정합 상태 회귀 0.
3. 프레임 예산: `pnpm perf:baseline -- --lane frame` 600 요소 p50 회귀 **≤ +1%**, 레이아웃 **노드 수 증가 0**.
4. 하위 호환: canonical 재직렬화 **0 파일** (read-time 파생만). 도달 범위는 **기본 상태를 포함한다** (Phase 0 실측): 팔레트 기본 상태에서 격차 조건 (non-scrollable + 주축 definite) 을 만족하는 collection 은 **`Table` 하나**다 — overflow 선언이 없고 (`componentRulesTable.ts` `Table` rule · implicitStyles 도 주지 않는다) `heightMode:"fixed"` 기본으로 height 400 이 definite 이다 (`implicitStyles.ts:1350-1380`). ListBox `auto` · (grid 배치) GridList `hidden` 은 scrollable 이라 기본 상태가 정합이고, `visible`/`clip` 을 저작했을 때만 격차가 난다. collection 밖까지 세면 후보가 **세로축 128 · 가로축 58 노드** (팔레트 64 트리 210 노드) 다.
5. cargo 기존 스위트 + browser parity 전량 PASS 유지 — 대안 C 가 커널 조건을 넓히므로 collection 밖 회귀를 이 전량이 잡는다.

**Soft Constraints**:

- 도달 조건은 좁지 않을 수 있다 (Hard Constraint 4) — 그러나 실제 문서에서 collection 이 **제약된 flex 주축의 item** 인 형태가 얼마나 되는지는 미측정이다. 우선순위는 Phase 0 의 계수 결과에 따른다.
- 엔진 변경은 Rust + wasm-pack 빌드를 요구한다 (`pnpm wasm:build:engine`).

## Alternatives Considered

### 대안 A: 측정 계약을 세로축으로 확장 — 투영 행 수 × stride 를 content-min 스칼라로 공급

- 설명: 커널 슬롯 19 (`content_min_main`, 이미 논리 main) 의 `is_row` writer 가드를 축별로 풀고 (`tree.rs:4793`), 가상화 collection owner 가 **scene 투영과 같은 심볼** (`resolveListBoxItemRowHeightFromStyle` / `getTableProjectionRows`) 로 산출한 행 높이 총합을 TS 필드 (`contentMinHeight`) 로 공급한다. 신규 커널 슬롯 없음, 레이아웃 트리 형태 그대로.
- 근거: 브라우저 엔진이 replaced / 대체 콘텐츠에 intrinsic 크기를 공급하는 형태와 같고, Taffy 의 measure function · Yoga 의 measure 콜백도 "자식 없이 콘텐츠 크기를 알리는" 같은 계약이다. 이 저장소에는 이미 가로축 선례가 있다 (ADR-165).
- 위험:
  - 기술: MEDIUM — TS/Rust 경계 필드 1개 추가 (JSON 경로). 커널 슬롯 수는 불변이고 가로축 선례가 형태를 고정해 준다.
  - 성능: LOW — 노드 수 불변, 항목당 f32 1개. 산출값은 투영이 이미 계산하는 값의 재사용.
  - 유지보수: MEDIUM — "투영 행 높이와 floor 는 같은 심볼을 쓴다" 는 계약이 하나 는다.
  - 마이그레이션: LOW — canonical 미변경, 재직렬화 0, 롤백은 공급 제거 1곳.
- 한계: **단독으로는 측정 케이스를 못 닫는다** — 슬롯 19 는 주축 크기가 AUTO 일 때만 읽히는데 (`flex.rs:332`) 측정 케이스는 definite 다. 대안 C 와 함께여야 닫힌다.

### 대안 B: 투영 행을 레이아웃 트리에 실체화

- 설명: window 만큼의 행을 실제 자식 노드로 만들어 DOM 과 같은 구조를 갖는다. content 크기 제안이 자연히 생긴다.
- 근거: RAC `Virtualizer` · TanStack Virtual 도 window 만 DOM 에 둔다 — 구조를 맞추는 정공법.
- 위험:
  - 기술: MEDIUM — 투영 경로와 레이아웃 트리가 이중화된다.
  - 성능: HIGH — collection 당 수십 노드가 늘고 스크롤마다 트리가 재구성된다. 문서 규모에 비례하는 편집 비용이 이미 실측돼 있다 (5,069 요소 편집 1회 205ms).
  - 유지보수: HIGH — ADR-150 A2 의 "draw/hit 이 같은 window 를 공유한다" 는 단일 소스 계약이 깨진다.
  - 마이그레이션: MEDIUM — 스크롤·히트 경로가 함께 바뀌어 롤백 단위가 크다.

### 대안 C: 엔진의 §4.5 specified size suggestion 절만 구현

- 설명: `main_size == AUTO` 가드를 걷고 definite 주축 크기일 때 `min(specified, content)` 를 쓴다.
- 근거: css-flexbox-1 §4.5 의 미구현 절 — 스펙 정합 자체가 근거.
- 위험:
  - 기술: LOW — 함수 1개의 조건 확장 (조건 소유는 계속 단일 함수).
  - 성능: LOW — 커널 분기 1개.
  - 유지보수: LOW.
  - 마이그레이션: MEDIUM — 도달 범위가 collection 이 아니라 **definite 높이 flex item 전반**이라 회귀 표면이 넓다.
- 한계: **단독으로는 본 문제를 못 닫는다** — 절을 구현해도 collection 의 content 제안이 0 이라 `min(164, 0) = 0` 이다. 대안 A 와 대칭으로 서로가 서로의 전제다.

### 대안 D: 현행 유지 + 관찰 문서화

- 설명: 도달이 좁으므로 격차를 기록만 하고 닫지 않는다.
- 근거: 사용자가 명시로 `visible`/`clip` 을 준 경우만이라면 비용 대비 효용이 낮다 — 단 Hard Constraint 4 가 이 전제를 무너뜨린다 (기본 상태 둘이 이미 non-scrollable).
- 위험:
  - 기술: LOW / 성능: LOW / 마이그레이션: LOW
  - 유지보수: MEDIUM — D3 대칭이 갈린 채 남아 판독마다 같은 항목이 다시 올라온다 (ADR-923 에서 이미 1회 발생).

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | MED  | LOW  | MED      | LOW          |     0      |
| B    | MED  | HIGH | HIGH     | MED          |     2      |
| C    | LOW  | LOW  | LOW      | MED          |     0      |
| D    | LOW  | LOW  | MED      | LOW          |     0      |

루프 판정: CRITICAL 0, HIGH 는 대안 B 에만 몰려 있고 HIGH 0 인 대안이 3개 — 새 대안 추가 없이 종료.

단, 채택은 **A + C 결합**이고 (Decision) 결합은 C 의 마이그레이션 MED (definite 높이 flex item 전반 회귀 표면) 를 그대로 물려받는다 — 이 잔존 위험을 R1 에 HIGH 로 올려 Gate 로 관리한다.

## Decision

**대안 A + 대안 C 를 하나의 결정으로 함께 채택**한다 (별도 ADR 분리 금지 — adr-writing.md M3).

**순서는 C → A** (Phase 0 실측으로 확정). C 가 주 경로다 — 기본 상태 격차 (`Table`, 자식 2 라 공급이 이미 있다) 를 단독으로 닫고, collection 밖 일반 상자의 발산도 같이 닫는다. A 는 부 경로다 — ListBox/GridList 는 기본이 scrollable 이라 정합이고, `visible`/`clip` 을 저작한 경우에만 필요하며 그때는 C 와 함께여야 한다 (공급 0 + 가드 두 겹).

착수 전 안은 A 를 주 경로로, C 를 "Chrome 측정에 따른 조건부 흡수" 로 뒀다. 리뷰 round 1 이 조건부를 필수로 정정했고, Phase 0 이 우선순위까지 뒤집었다.

선택 근거:

1. 격차의 원인이 **소비 가드 (C) 와 입력 공급 부재 (A) 두 겹**이고, 둘 다 레이아웃 트리 형태를 바꾸지 않고 닫힌다 — 최소 표면이다.
2. 산출값의 원천이 이미 있다 — 투영이 스크롤 총량을 내려고 계산하는 행 높이를 그대로 쓴다. 새 심볼을 만들면 스크롤 총량과 floor 가 갈릴 수 있고, 같은 심볼을 쓰면 그 갈림이 구조적으로 불가능하다.
3. 커널에 새 슬롯이 필요 없다 — 슬롯 19 는 이미 논리 main 이고 비어 있는 것은 writer 의 축 가드뿐이다 (`tree.rs:4793`). 경계 변경은 TS 필드 1개로 끝난다.

기각 사유:

- **대안 B 기각**: 프레임 예산 (Hard Constraint 3, 노드 수 증가 0) 과 정면 충돌하고, ADR-150 A2 의 단일 window 계약을 깬다. 얻는 것은 A 와 같은 값 하나이며, 기본 상태 격차 (Table) 는 B 로도 안 닫힌다 — Table 은 이미 자식이 있고 원인이 가드이기 때문이다.
- **대안 C 단독 기각**: collection 의 content 가 0 이므로 이 절만으로는 격차가 그대로다 — 그래서 기각이 아니라 **A 와의 결합**으로 둔다. C 는 collection 밖 definite 높이 flex item 전반에도 닿으므로 회귀 표면이 이 결정의 가장 큰 비용이고, G1/G3 이 그 비용을 잰다.
- **대안 D 기각**: 기본 상태 둘 (`Table` · stack 배치 `GridList`) 이 이미 도달 조건을 만족한다 (Hard Constraint 4) — "사용자가 명시로 준 경우만" 이라는 D 의 전제가 성립하지 않는다.

> 구현 상세: [204-virtualized-collection-min-content-floor-breakdown.md](../design/204-virtualized-collection-min-content-floor-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 대안 C 의 커널 조건 확장이 **collection 밖 definite 주축 flex item 전반**에 닿는다 — Phase 0 실측 후보 세로축 128 · 가로축 58 노드 (팔레트 64 트리 210 노드). 성격은 '새 회귀' 가 아니라 **기존 발산을 닫는 것** (G0 의 definite 행이 이미 Chrome 과 갈려 있다) 이라, 실제 위험은 **잘못된 값에 고정된 기존 게이트 기준선이 RED 로 뜨는 것**                                                                      |  HIGH  | Phase 1 에서 전량 게이트를 돌려 움직이는 기준선을 전부 조사하고 각각 '종전 값이 Chrome 과 갈려 있었나' 로 판정 — 갈려 있었으면 기준선 갱신, 아니면 결함. G1 에 collection 밖 대조군 필수 |
| R2  | 투영 행 높이의 정밀도 한계 (템플릿 style·description 밖 임의 자식 콘텐츠 미반영 — `collectionVirtualization.ts` 주석) 가 floor 에 그대로 전이                                                                                                                                                                                                                                                                     |  MED   | 스크롤 총량과 **같은 심볼**을 공유하므로 두 값이 갈리지 않는다. 정밀화는 ADR-162/157 트랙                                                                                                |
| R3  | 신규 스칼라가 **한 경로에만 실려 조용히 사라진다**. 현행 활성 경로는 JSON (`layoutTypes.ts:181` `contentMinWidth` · Rust `tree.rs:260`) 이고 binary protocol 은 미가동이다 (`binaryProtocol.ts:81-85` — ADR-165 가로축 스칼라가 이미 비등재, 실구현 시 f32 범위 편입이 주석으로만 남아 있다). 세로축 스칼라를 JSON 에만 넣고 그 주석을 갱신하지 않으면 binary protocol 실구현 시점에 intrinsic sizing 이 회귀한다 |  HIGH  | JSON 경로 배선 + `binaryProtocol.ts` 비등재 목록에 세로축 스칼라 같이 명기 (silent drop 을 그 주석이 유일하게 경고한다). G2 원복 RED 로 배선 고정, G3 로 cargo·parity 전량               |
| R4  | 도달 범위가 Hard Constraint 4 로 넓어졌지만 **실제 문서 출현 수는 여전히 미측정**이다 — 넓다고 가정하고 넓게 고치는 것도 leakage 다                                                                                                                                                                                                                                                                               |  MED   | Phase 0 에서 실 문서·fixture 계수. 0 이면 그 사실을 기록하되 "미관측" 을 dead 로 읽지 않는다 (ADR-923 착수 9 규율, `measurement-validity.md` Q1)                                         |
| R5  | 세로축 content-min 을 채우는 것이 `tree.rs:4789-4790` 이 명시한 **2-pass 잔존 계약** ("column 의 main=height 는 height-for-width 재줄바꿈 영역") 과 충돌할 수 있다 — 그 가드는 실수가 아니라 선언된 제약이다                                                                                                                                                                                                      |  MED   | Phase 1 에서 collection 은 텍스트 재줄바꿈 대상이 아님을 근거로 좁게 채운다 (type 한정). 텍스트 노드로 일반화 금지 — 일반화 시 별도 판정                                                 |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                                                  |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G0   | Phase 0 종료        | **통과 (2026-09-04)** — collection 을 쓰지 않는 일반 상자로 가드만 분리: definite 주축에서 DOM 164 vs production 80 (양 축), 대조군 auto·scroll 정합. [evidence](../evidence/204-phase0-first-nail-and-reach.md)                                                                                                                                                       | (해당 없음 — 통과)                                            |
| G1   | Phase 3             | **통과 (2026-09-04)** — production ListBox/GridList/Table × overflow 4 × 부모 400/80 을 `rendererMap` 실렌더 DOM 과 대조, 24 행 전부 ≤1px · scrollable 행 80 불변 · collection 밖 대조군 회귀 0. 착수 시 RED 2 (Table `minHeight:402` · GridList `overflow:hidden` — 둘 다 Canvas 만의 implicit 주입) 은 주입 제거로 수리. [evidence](../evidence/204-phase3-gates.md) | (해당 없음 — 통과)                                            |
| G2   | Phase 3             | 원복 RED — (a) 세로축 스칼라 공급 제거 → 격차 행 RED, (b) 해당 시 specified 절 원복 → 일반 케이스 RED                                                                                                                                                                                                                                                                  | 게이트가 변경을 감지하지 못하는 것이므로 게이트를 먼저 고친다 |
| G3   | Phase 3             | **통과 (2026-09-04)** — parity 1110 PASS (기존 실패 2) · engines unit 482 · 노드 210 불변 · frame p50 A/B (엔진만 교체, arm 당 2회): idle +0.3% · edit −0.3% · select −1.2% — 회귀 신호 없음 (run 간 편차가 arm 차보다 커 1% 자체는 하니스 해상도 밖). [evidence](../evidence/204-phase3-gates.md)                                                                     | (해당 없음 — 통과)                                            |
| G4   | Implemented 승격 전 | **통과 (2026-09-04)** — 아래 `### Live Exercise`. DOM 대조는 G1 의 preview 경로 (`rendererMap` 실렌더) 가 담당했다 — publish 는 preview 와 같은 renderer 를 쓰고 이 저장소 방침상 (기능 링크만) 별도 oracle 로 두지 않는다.                                                                                                                                            | (해당 없음 — 통과)                                            |

### Live Exercise

Chrome MCP · 빌더 Home 페이지 · 2026-09-04 (사용자 Chrome throttle 미적용 세션).

| Phase | 시나리오 (팔레트로 frame 을 body 에 넣고 style 을 `updateElementProps` 로 준 뒤 그 안에 collection 추가, `__composition_LAYOUT_DEBUG__.getSharedLayoutMap()` rect) | 결과 (착수 전 → 후)                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1     | frame `column · height 80` > 자식 실재 일반 상자 (definite 164, overflow visible)                                                                                  | 80 → **164**, auto 80 대조군 불변                  |
| 2     | frame `column · height 80` > ListBox ref 인스턴스 `overflow: visible` / `auto`                                                                                     | visible 80 → **164** · auto **80** 불변            |
| 3     | frame `column · 300×80` > GridList 기본 상태 (overflow 미지정)                                                                                                     | 80 → **164** (카드가 frame 밖으로 넘쳐 보임 = DOM) |
| 3     | 같은 frame > Table 단독 / GridList + Table                                                                                                                         | 402 → **80** / 164 + **40** (각자 min 에 고정)     |

각 phase 끝에 frame 을 `removeElement` 로 제거해 원복했다 (Cmd+Z 는 포커스 문제로 동작하지 않아 store 액션 사용). DOM 쪽 값은 G1 (`adr204ReachMatrix.browser.test.ts`, rendererMap 실렌더 + 실 번들 CSS) 의 같은 상태 24 행이 정본이다. 상세: [Phase 1](../evidence/204-phase1-specified-size-suggestion.md) · [Phase 2](../evidence/204-phase2-collection-vertical-scalar.md) · [Phase 3](../evidence/204-phase3-gates.md).

## Consequences

### Positive

- `overflow: visible` / `clip` 을 준 collection 이 제약 flex 안에서 Builder 와 Preview/Publish 가 같은 높이를 낸다 — D3 대칭 격차 1건 종결.
- 세로축 content-min 채널이 생겨, 이후 "자식 없이 콘텐츠 크기를 아는" 다른 노드 (향후 차트 등) 가 같은 계약을 쓸 수 있다.
- §4.5 의 미구현 절이 닫혀 definite 높이 flex item 전반의 CSS 정합이 올라간다 (대안 C).
- ADR-923 이 범위 밖으로 남긴 관찰이 닫혀 판독 재출현이 멈춘다.

### Negative

- 엔진 경계에 필드가 하나 늘어 TS/Rust 양쪽 갱신 계약이 는다 (`layoutTypes.ts` · `tree.rs` · 미가동 `binaryProtocol.ts` 의 비등재 목록).
- 투영 행 높이의 정밀도 한계가 이제 배치에도 영향을 준다 — 종전에는 스크롤 총량에만 영향이 있었다.
- 대안 C 가 커널 공통 경로를 바꾸므로 collection 밖 회귀 표면이 넓다 — 이 결정의 최대 비용 (R1).
- 실사용 관측치가 0 일 수 있어 게이트 다수가 합성 케이스로 남는다.

# ADR-204: 가상화 collection 의 min-content floor — 투영 행이 §4.5 자동 최소 크기에 도달하는 경로

## Status

Proposed — 2026-09-04

## Context

Canvas 의 ListBox / GridList / Table 은 행을 **scene graph 투영**으로 그린다 — 행은 레이아웃 트리의 자식이 아니다 (`collectionVirtualization.ts`, `fullTreeLayout.ts:139` `A2_WINDOWED_COLLECTION_TAGS`, 자식 0 이면 GAP 4 skip `:3322-3335`). 그래서 이 collection 이 flex item 이 될 때 엔진이 보는 **content 크기 제안이 0** 이다. DOM 은 ListBox / GridList 에서 RAC 가 행을 실제 자식으로 렌더하므로 같은 문서에서 min-content 가 행 수 × stride 다 (실측 범위도 이 둘뿐 — Table 은 DOM 쪽도 RAC `TableVirtualizer` 가 창 렌더라 양쪽 leg 모두 미측정이다, Phase 0 확인 대상).

실측 (ADR-923 Phase 5, `adr923Dc6ChromeGate.browser.test.ts:147-213`): 제약 `flex column 80` 안의 production ListBox(auto) / GridList(hidden) 는 주입 높이 164 를 갖고도 80 으로 줄어든다. `overflow` 를 `visible` / `clip` 으로 바꿔도 **여전히 80** 이고, 같은 의미의 DOM 아날로그는 **164** 다. scroll container 는 §4.5 가 floor 0 을 주도록 정한 대로라 양쪽이 같지만, **non-scrollable 인 visible / clip 에서 D3 대칭이 갈린다**. ADR-923 은 이 지점을 범위 밖 관찰로 기록만 했다 (`evidence/923-phase5-cutover.md:78` · `:166`).

엔진 쪽 코드 사실은 두 가지다. ① §4.5 자동 최소 크기는 **주축 크기가 auto 일 때만** content 기반이다 (`flex.rs:332` — definite 이면 `min_main`(AUTO) 을 그대로 반환). ② TS 가 공급하는 정확 min-content 스칼라는 **가로축에만** 있다 (`tree.rs:260` `content_min_width` · `layoutTypes.ts:181`, 커널 슬롯 19 는 `is_row` 에서만 실린다 — `tree.rs:4790-4800`). 즉 세로축에는 "이 노드의 콘텐츠가 최소 이만큼" 을 말할 채널 자체가 없다. 이 스칼라가 실제로 다니는 길은 JSON 이고 binary protocol 은 아직 미가동이다 (`binaryProtocol.ts:81-85` — 가로축 스칼라도 비등재). ③ 커널 슬롯 19 자체는 이미 **논리 main** 이다 (`flex.rs:75` `content_min_main`) — 세로축을 위해 새 슬롯을 만들 필요가 없고, 비어 있는 것은 `tree.rs:4793` 의 `is_row` writer 가드다.

**두 사실이 곱해진다**: ①의 가드 때문에 슬롯 19 는 **주축 크기가 AUTO 일 때만 읽힌다** (`flex.rs:301-310` — `main_size` = `data[off+1]`, 필드 계약상 논리 main). 그런데 측정 케이스의 collection 은 주입 높이 164 가 **definite 한 논리 main 으로 경계에 닿는다** (`adr923Dc6ChromeGate.browser.test.ts:147` 케이스 제목). 따라서 세로축 값을 공급해도 그 경로에서는 읽히지 않는다 — ②만 닫는 것으로는 부족하고 ①도 같이 닫아야 한다.

본 ADR 은 **base** — 레이아웃 엔진의 자동 최소 크기 **입력 계약**을 정한다. ADR-150 A2(투영 window)·ADR-162(템플릿 자식 실체화)는 투영 정밀도의 응용 축이고 canonical schema 와 직교다 (분류 근거: design breakdown §1).

**Generator 선언 (adr-writing.md 반복 패턴 #2)**: 본 ADR 은 spec / CSS Generator 확장이 **아니다**. D3 시각 토큰과 생성 CSS 는 불변이고, 변경 채널은 layout 입력 하나다 — 활성 경로는 JSON (`layoutTypes.ts` ↔ Rust `NodeStyle`) 이고 커널 배열은 기존 슬롯 19 를 축에 따라 채우는 것뿐이다.

**Hard Constraints**:

1. 격차 행의 Canvas 높이가 Chrome 실측과 **≤ 1px** (ADR-198 픽셀 정합과 같은 판정 축).
2. scrollable (`hidden` / `auto`) 행은 **값 불변** — 현행 정합 상태 회귀 0.
3. 프레임 예산: `pnpm perf:baseline -- --lane frame` 600 요소 p50 회귀 **≤ +1%**, 레이아웃 **노드 수 증가 0**.
4. 하위 호환: canonical 재직렬화 **0 파일** (read-time 파생만). 도달 범위는 **기본 상태를 포함한다** — 코드상 non-scrollable 인 기본값이 둘 있다: `Table` 은 catalog 에 overflow 선언이 없고 (`componentRulesTable.ts` `Table` rule) implicitStyles 도 주지 않으면서 `heightMode:"fixed"` 기본으로 height 400 이 definite 이며 (`implicitStyles.ts:1350-1380`), **stack 배치 GridList** 도 else 분기가 overflow 를 두지 않는다 (`implicitStyles.ts:1600-1605` — grid 배치만 `?? "hidden"`). scrollable 기본값은 ListBox `auto` (catalog) 와 grid 배치 GridList `hidden` 뿐이다. 영향 문서 수는 Phase 0 에서 센다 (0 이 아닐 수 있다).
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

둘 중 하나만으로는 측정 케이스가 닫히지 않는다. A 가 공급하는 세로축 content-min 은 주축 크기가 AUTO 일 때만 읽히고 (`flex.rs:332`), 측정 케이스의 collection 은 주입 높이가 definite 한 논리 main 으로 경계에 닿는다. 거꾸로 C 만 구현하면 `min(specified, content)` 의 content 가 0 이라 floor 도 0 이다. **서로가 서로의 전제**이므로 조건부가 아니라 결합이 결정이다.

선택 근거:

1. 격차의 원인이 **입력 공급 부재 (A) 와 소비 가드 (C) 두 겹**이고, 둘 다 레이아웃 트리 형태를 바꾸지 않고 닫힌다 — 최소 표면이다.
2. 산출값의 원천이 이미 있다 — 투영이 스크롤 총량을 내려고 계산하는 행 높이를 그대로 쓴다. 새 심볼을 만들면 스크롤 총량과 floor 가 갈릴 수 있고, 같은 심볼을 쓰면 그 갈림이 구조적으로 불가능하다.
3. 커널에 새 슬롯이 필요 없다 — 슬롯 19 는 이미 논리 main 이고 비어 있는 것은 writer 의 축 가드뿐이다 (`tree.rs:4793`). 경계 변경은 TS 필드 1개로 끝난다.

기각 사유:

- **대안 B 기각**: 프레임 예산 (Hard Constraint 3, 노드 수 증가 0) 과 정면 충돌하고, ADR-150 A2 의 단일 window 계약을 깬다. 얻는 것은 A 와 같은 값 하나다.
- **대안 C 단독 기각**: collection 의 content 가 0 이므로 이 절만으로는 격차가 그대로다 — 그래서 기각이 아니라 **A 와의 결합**으로 둔다. C 는 collection 밖 definite 높이 flex item 전반에도 닿으므로 회귀 표면이 이 결정의 가장 큰 비용이고, G1/G3 이 그 비용을 잰다.
- **대안 D 기각**: 기본 상태 둘 (`Table` · stack 배치 `GridList`) 이 이미 도달 조건을 만족한다 (Hard Constraint 4) — "사용자가 명시로 준 경우만" 이라는 D 의 전제가 성립하지 않는다.

> 구현 상세: [204-virtualized-collection-min-content-floor-breakdown.md](design/204-virtualized-collection-min-content-floor-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 대안 C 의 커널 조건 확장이 **collection 밖 definite 높이 flex item 전반**에 닿는다 — 회귀 표면이 본 결정의 최대 비용이다 (`flex.rs:332` 는 전 항목 공통 커널)                                                                                                                                                                                                                                                     |  HIGH  | G1 (도달 매트릭스 + scrollable 불변) · G3 (cargo 전량 + browser parity 전량). 매트릭스에 collection 밖 대조군 (definite 높이 일반 div) 을 필수로 포함                      |
| R2  | 투영 행 높이의 정밀도 한계 (템플릿 style·description 밖 임의 자식 콘텐츠 미반영 — `collectionVirtualization.ts` 주석) 가 floor 에 그대로 전이                                                                                                                                                                                                                                                                     |  MED   | 스크롤 총량과 **같은 심볼**을 공유하므로 두 값이 갈리지 않는다. 정밀화는 ADR-162/157 트랙                                                                                  |
| R3  | 신규 스칼라가 **한 경로에만 실려 조용히 사라진다**. 현행 활성 경로는 JSON (`layoutTypes.ts:181` `contentMinWidth` · Rust `tree.rs:260`) 이고 binary protocol 은 미가동이다 (`binaryProtocol.ts:81-85` — ADR-165 가로축 스칼라가 이미 비등재, 실구현 시 f32 범위 편입이 주석으로만 남아 있다). 세로축 스칼라를 JSON 에만 넣고 그 주석을 갱신하지 않으면 binary protocol 실구현 시점에 intrinsic sizing 이 회귀한다 |  HIGH  | JSON 경로 배선 + `binaryProtocol.ts` 비등재 목록에 세로축 스칼라 같이 명기 (silent drop 을 그 주석이 유일하게 경고한다). G2 원복 RED 로 배선 고정, G3 로 cargo·parity 전량 |
| R4  | 도달 범위가 Hard Constraint 4 로 넓어졌지만 **실제 문서 출현 수는 여전히 미측정**이다 — 넓다고 가정하고 넓게 고치는 것도 leakage 다                                                                                                                                                                                                                                                                               |  MED   | Phase 0 에서 실 문서·fixture 계수. 0 이면 그 사실을 기록하되 "미관측" 을 dead 로 읽지 않는다 (ADR-923 착수 9 규율, `measurement-validity.md` Q1)                           |
| R5  | 세로축 content-min 을 채우는 것이 `tree.rs:4789-4790` 이 명시한 **2-pass 잔존 계약** ("column 의 main=height 는 height-for-width 재줄바꿈 영역") 과 충돌할 수 있다 — 그 가드는 실수가 아니라 선언된 제약이다                                                                                                                                                                                                      |  MED   | Phase 1 에서 collection 은 텍스트 재줄바꿈 대상이 아님을 근거로 좁게 채운다 (type 한정). 텍스트 노드로 일반화 금지 — 일반화 시 별도 판정                                   |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                     | 실패 시 대안                                                              |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| G0   | Phase 0 종료        | first-nail — production ListBox 를 `height` 없이 (주축 AUTO) 제약 flex 안에 두고 `overflow:visible` 로 1회 측정. AUTO 에서 격차가 사라지면 definite 가드가 원인임이 확정되고 A+C 결합이 필요조건으로 고정된다 | 격차가 AUTO 에서도 남으면 원인 가설이 틀린 것 — Decision 재작성 후 재리뷰 |
| G1   | Phase 3             | 도달 매트릭스의 격차 행 전부 Chrome 과 ≤1px, scrollable 행 값 불변                                                                                                                                            | 대안 C 흡수 여부 재판정 → 그래도 미달이면 대안 B 재평가                   |
| G2   | Phase 3             | 원복 RED — (a) 세로축 스칼라 공급 제거 → 격차 행 RED, (b) 해당 시 specified 절 원복 → 일반 케이스 RED                                                                                                         | 게이트가 변경을 감지하지 못하는 것이므로 게이트를 먼저 고친다             |
| G3   | Phase 3             | cargo 기존 스위트 + browser parity 전량 PASS · frame p50 회귀 ≤ +1% · 레이아웃 노드 수 증가 0                                                                                                                 | 공급 대상을 도달 매트릭스의 격차 행 type 으로 좁혀 재측정                 |
| G4   | Implemented 승격 전 | live exercise — 빌더에서 collection 에 `overflow:visible` 을 주고 제약 flex 안에 둔 뒤 Skia rect 와 publish DOM 대조                                                                                          | 승격 보류                                                                 |

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

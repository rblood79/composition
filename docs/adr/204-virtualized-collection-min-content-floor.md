# ADR-204: 가상화 collection 의 min-content floor — 투영 행이 §4.5 자동 최소 크기에 도달하는 경로

## Status

Proposed — 2026-09-04

## Context

Canvas 의 ListBox / GridList / Table 은 행을 **scene graph 투영**으로 그린다 — 행은 레이아웃 트리의 자식이 아니다 (`collectionVirtualization.ts`, `fullTreeLayout.ts:139` `A2_WINDOWED_COLLECTION_TAGS`, 자식 0 이면 GAP 4 skip `:3322-3335`). 그래서 이 collection 이 flex item 이 될 때 엔진이 보는 **content 크기 제안이 0** 이다. DOM 은 RAC 가 행을 실제 자식으로 렌더하므로 같은 문서에서 min-content 가 행 수 × stride 다.

실측 (ADR-923 Phase 5, `adr923Dc6ChromeGate.browser.test.ts:147-213`): 제약 `flex column 80` 안의 production ListBox(auto) / GridList(hidden) 는 주입 높이 164 를 갖고도 80 으로 줄어든다. `overflow` 를 `visible` / `clip` 으로 바꿔도 **여전히 80** 이고, 같은 의미의 DOM 아날로그는 **164** 다. scroll container 는 §4.5 가 floor 0 을 주도록 정한 대로라 양쪽이 같지만, **non-scrollable 인 visible / clip 에서 D3 대칭이 갈린다**. ADR-923 은 이 지점을 범위 밖 관찰로 기록만 했다 (`evidence/923-phase5-cutover.md:78` · `:166`).

엔진 쪽 코드 사실은 두 가지다. ① §4.5 자동 최소 크기는 **주축 크기가 auto 일 때만** content 기반이다 (`flex.rs:332` — definite 이면 `min_main`(AUTO) 을 그대로 반환). ② TS 가 공급하는 정확 min-content 스칼라는 **가로축에만** 있다 (`tree.rs:260` `content_min_width` · `layoutTypes.ts:181`, 커널 슬롯 19 는 `is_row` 에서만 실린다 — `tree.rs:4790-4800`). 즉 세로축에는 "이 노드의 콘텐츠가 최소 이만큼" 을 말할 채널 자체가 없다. 이 스칼라가 실제로 다니는 길은 JSON 이고 binary protocol 은 아직 미가동이다 (`binaryProtocol.ts:81-85` — 가로축 스칼라도 비등재).

본 ADR 은 **base** — 레이아웃 엔진의 자동 최소 크기 **입력 계약**을 정한다. ADR-150 A2(투영 window)·ADR-162(템플릿 자식 실체화)는 투영 정밀도의 응용 축이고 canonical schema 와 직교다 (분류 근거: design breakdown §1).

**Generator 선언 (adr-writing.md 반복 패턴 #2)**: 본 ADR 은 spec / CSS Generator 확장이 **아니다**. D3 시각 토큰과 생성 CSS 는 불변이고, 변경 채널은 layout 입력 (wasm 경계 배열) 하나다.

**Hard Constraints**:

1. 격차 행의 Canvas 높이가 Chrome 실측과 **≤ 1px** (ADR-198 픽셀 정합과 같은 판정 축).
2. scrollable (`hidden` / `auto`) 행은 **값 불변** — 현행 정합 상태 회귀 0.
3. 프레임 예산: `pnpm perf:baseline -- --lane frame` 600 요소 p50 회귀 **≤ +1%**, 레이아웃 **노드 수 증가 0**.
4. 하위 호환: canonical 재직렬화 **0 파일** (read-time 파생만). 팔레트 기본 overflow 는 ListBox `auto` · GridList `hidden` · Table `auto` 로 전부 scrollable 이라 **기본 상태 문서 영향 0%** — 영향은 사용자가 `visible` / `clip` 을 준 collection 이 제약 flex item 일 때뿐이고, 그 실제 출현 수는 Phase 0 에서 센다.
5. cargo 기존 스위트 + browser parity 전량 PASS 유지 (경계 배열 슬롯 수 변경 동반 시 필수).

**Soft Constraints**:

- 도달 조건이 좁아 (기본값이 전부 scrollable) 사용자 체감 우선순위는 낮다 — 근거 없는 조기 확장을 막는 제약이기도 하다.
- 엔진 변경은 Rust + wasm-pack 빌드를 요구한다 (`pnpm wasm:build:engine`).

## Alternatives Considered

### 대안 A: 측정 계약을 세로축으로 확장 — 투영 행 수 × stride 를 content-min 스칼라로 공급

- 설명: `content_min_width` 의 세로축 대응 슬롯을 추가하고, 가상화 collection owner 가 **scene 투영과 같은 심볼** (`resolveListBoxItemRowHeightFromStyle` / `getTableProjectionRows`) 로 산출한 행 높이 총합을 read-time 에 공급한다. 레이아웃 트리 형태는 그대로.
- 근거: 브라우저 엔진이 replaced / 대체 콘텐츠에 intrinsic 크기를 공급하는 형태와 같고, Taffy 의 measure function · Yoga 의 measure 콜백도 "자식 없이 콘텐츠 크기를 알리는" 같은 계약이다. 이 저장소에는 이미 가로축 선례가 있다 (ADR-165).
- 위험:
  - 기술: MEDIUM — wasm 경계 배열 슬롯 수 변경 (TS/Rust 동시 갱신). 가로축 선례가 형태를 고정해 준다.
  - 성능: LOW — 노드 수 불변, 항목당 f32 1개. 산출값은 투영이 이미 계산하는 값의 재사용.
  - 유지보수: MEDIUM — "투영 행 높이와 floor 는 같은 심볼을 쓴다" 는 계약이 하나 는다.
  - 마이그레이션: LOW — canonical 미변경, 재직렬화 0, 롤백은 공급 제거 1곳.

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
- 한계: **단독으로는 본 문제를 못 닫는다** — collection 의 content 가 0 이라 `min(164, 0) = 0` 이다.

### 대안 D: 현행 유지 + 관찰 문서화

- 설명: 도달이 좁으므로 격차를 기록만 하고 닫지 않는다.
- 근거: 기본 상태 영향 0% — 비용 대비 효용이 낮다는 판단.
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

## Decision

**대안 A (측정 계약의 세로축 확장)** 를 선택한다. 대안 C 는 **본 ADR 안에서 조건부로 함께 닫는다** — Phase 0 의 first-nail 이 "definite 높이 항목의 floor 가 Chrome 에서 content 기반인가" 를 판정하고, 그렇다면 C 를 같은 ADR 의 Phase 1 에 흡수한다 (별도 ADR 분리 금지 — 추정과 실측의 gap 은 Phase 0 인벤토리로 흡수한다, adr-writing.md M3).

선택 근거:

1. 격차의 직접 원인이 **입력 공급 부재**다. 레이아웃 트리 형태를 바꾸지 않고 없는 입력을 채우는 것이 최소 표면이다.
2. 산출값의 원천이 이미 있다 — 투영이 스크롤 총량을 내려고 계산하는 행 높이를 그대로 쓴다. 새 심볼을 만들면 스크롤 총량과 floor 가 갈릴 수 있고, 같은 심볼을 쓰면 그 갈림이 구조적으로 불가능하다.
3. 잔존 위험 (경계 슬롯 오정렬, R3) 은 조용히 지나갈 수 없다 — 오프셋이 밀리면 전 항목이 잘못된 값을 읽어 전량 게이트가 즉시 RED 다.

기각 사유:

- **대안 B 기각**: 프레임 예산 (Hard Constraint 3, 노드 수 증가 0) 과 정면 충돌하고, ADR-150 A2 의 단일 window 계약을 깬다. 얻는 것은 A 와 같은 값 하나다.
- **대안 C 단독 기각**: collection 의 content 가 0 이므로 이 절만으로는 격차가 그대로다. 스펙 정합 가치는 인정하되 본 문제의 해가 아니다 — 그래서 기각이 아니라 **조건부 흡수**로 둔다.
- **대안 D 기각**: 같은 항목이 판독에 재출현하는 비용이 이미 관측됐고, 닫는 비용 (슬롯 1개 + 공급 1곳) 이 그보다 작다.

> 구현 상세: [204-virtualized-collection-min-content-floor-breakdown.md](design/204-virtualized-collection-min-content-floor-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Phase 0 판정이 "Chrome 이 specified 절을 적용" 으로 나오면 scope 가 collection 밖 **definite 높이 flex item 전반**으로 넓어진다                                                                                                                                                                                                                                                                                   |  MED   | G0 판정 후 도달 매트릭스로 범위를 확정. 확장분이 본 ADR 규모를 넘으면 결정 지점 ④ (승인 scope 변경) 로 사용자에게 질문                                                     |
| R2  | 투영 행 높이의 정밀도 한계 (템플릿 style·description 밖 임의 자식 콘텐츠 미반영 — `collectionVirtualization.ts` 주석) 가 floor 에 그대로 전이                                                                                                                                                                                                                                                                     |  MED   | 스크롤 총량과 **같은 심볼**을 공유하므로 두 값이 갈리지 않는다. 정밀화는 ADR-162/157 트랙                                                                                  |
| R3  | 신규 스칼라가 **한 경로에만 실려 조용히 사라진다**. 현행 활성 경로는 JSON (`layoutTypes.ts:181` `contentMinWidth` · Rust `tree.rs:260`) 이고 binary protocol 은 미가동이다 (`binaryProtocol.ts:81-85` — ADR-165 가로축 스칼라가 이미 비등재, 실구현 시 f32 범위 편입이 주석으로만 남아 있다). 세로축 스칼라를 JSON 에만 넣고 그 주석을 갱신하지 않으면 binary protocol 실구현 시점에 intrinsic sizing 이 회귀한다 |  HIGH  | JSON 경로 배선 + `binaryProtocol.ts` 비등재 목록에 세로축 스칼라 같이 명기 (silent drop 을 그 주석이 유일하게 경고한다). G2 원복 RED 로 배선 고정, G3 로 cargo·parity 전량 |
| R4  | 도달이 좁아 게이트가 실사용을 못 보는 상태로 남는다 (기본값이 전부 scrollable)                                                                                                                                                                                                                                                                                                                                    |  MED   | Phase 0 에서 실제 출현 수를 세고, 0 이면 그 사실을 결정 근거에 기록 — 게이트는 합성 케이스로 유지하되 "미관측" 을 dead 로 읽지 않는다 (ADR-923 착수 9 와 같은 규율)        |

## Gates

| Gate | 시점                | 통과 조건                                                                                                            | 실패 시 대안                                                             |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | Phase 0 종료        | first-nail 1 케이스 (Chrome vs production) 판정 기록 — Phase 1 형태가 둘 중 하나로 확정                              | 판정 불가면 착수 중단 후 사용자 보고 (전제 미확정 상태로 구현 진입 금지) |
| G1   | Phase 3             | 도달 매트릭스의 격차 행 전부 Chrome 과 ≤1px, scrollable 행 값 불변                                                   | 대안 C 흡수 여부 재판정 → 그래도 미달이면 대안 B 재평가                  |
| G2   | Phase 3             | 원복 RED — (a) 세로축 스칼라 공급 제거 → 격차 행 RED, (b) 해당 시 specified 절 원복 → 일반 케이스 RED                | 게이트가 변경을 감지하지 못하는 것이므로 게이트를 먼저 고친다            |
| G3   | Phase 3             | cargo 기존 스위트 + browser parity 전량 PASS · frame p50 회귀 ≤ +1% · 레이아웃 노드 수 증가 0                        | 공급 대상을 도달 매트릭스의 격차 행 type 으로 좁혀 재측정                |
| G4   | Implemented 승격 전 | live exercise — 빌더에서 collection 에 `overflow:visible` 을 주고 제약 flex 안에 둔 뒤 Skia rect 와 publish DOM 대조 | 승격 보류                                                                |

## Consequences

### Positive

- `overflow: visible` / `clip` 을 준 collection 이 제약 flex 안에서 Builder 와 Preview/Publish 가 같은 높이를 낸다 — D3 대칭 격차 1건 종결.
- 세로축 content-min 채널이 생겨, 이후 "자식 없이 콘텐츠 크기를 아는" 다른 노드 (투영 Table 행 · 향후 차트 등) 가 같은 계약을 쓸 수 있다.
- ADR-923 이 범위 밖으로 남긴 관찰이 닫혀 판독 재출현이 멈춘다.

### Negative

- 엔진 경계에 필드가 하나 늘어 TS/Rust 양쪽 갱신 계약이 는다 (`layoutTypes.ts` · `tree.rs` · 미가동 `binaryProtocol.ts` 의 비등재 목록).
- 투영 행 높이의 정밀도 한계가 이제 배치에도 영향을 준다 — 종전에는 스크롤 총량에만 영향이 있었다.
- 도달이 좁아 게이트 대부분이 합성 케이스로 남는다 (실사용 관측치가 0 일 수 있음).

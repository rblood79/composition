# ADR-204 Phase 0 — G0 first-nail + 도달 인벤토리 (2026-09-04)

> 산출물 2개: `apps/builder/tests/parity/adr204MinContentFloorFirstNail.browser.test.ts` (7 PASS) · `adr204FloorReachInventory.browser.test.ts` (4 PASS). artifact 는 `tests/parity/.artifacts/adr204-*.json`.

## 1. first-nail 설계를 교체했다 (착수 첫 작업)

ADR 최초안의 G0 은 "production ListBox 를 `height` 없이 (주축 AUTO) 두고 재라" 였다. **이 설계로는 아무것도 판정되지 않는다** — collection 의 주축을 AUTO 로 바꾸면 가드(①)만 풀리는 것이 아니라 content 공급(②)도 그대로 0 이라, 두 겹이 같이 움직여 원인이 갈리지 않는다.

교체안: **collection 을 쓰지 않는다.** 자식이 실재하는 일반 상자로 ①만 분리한다 — 콘텐츠 164 를 실제 자식으로 가진 item 을 제약 80 의 flex 컨테이너에 두고 **주축 크기만** definite ↔ auto 로 바꾼다. 대조군 2개(auto·scroll)가 정합인데 definite 행만 갈리면 원인이 가드 하나로 확정된다.

## 2. G0 결과 — 가드가 원인이다 (양 축 동일)

| 축     | arm             | item 주축 | overflow | DOM (Chrome) | production pipeline | 판정     |
| ------ | --------------- | --------- | -------- | ------------ | ------------------- | -------- |
| row    | **definite**    | 164px     | visible  | **164**      | **80**              | **발산** |
| row    | auto (대조군)   | auto      | visible  | 164          | 164                 | 정합     |
| row    | scroll (대조군) | 164px     | auto     | 80           | 80                  | 정합     |
| column | **definite**    | 164px     | visible  | **164**      | **80**              | **발산** |
| column | auto (대조군)   | auto      | visible  | 164          | 164                 | 정합     |
| column | scroll (대조군) | 164px     | auto     | 80           | 80                  | 정합     |

Chrome 은 definite 주축에서도 `min(specified 164, content 164) = 164` 를 floor 로 쓴다 (css-flexbox-1 §4.5 의 specified size suggestion 절). 엔진은 `flex.rs:332` 의 `main_size == AUTO` 가드 때문에 floor 를 0 으로 둔다.

**따라서 대안 C 는 조건부가 아니라 필수다** — 리뷰 round 1 의 판정이 실측으로 확증됐다. 그리고 이 발산은 **collection 과 무관하게 일반 상자에서 이미 난다**.

## 3. 도달 인벤토리 — ADR 의 전제 2개가 더 바뀌었다

팔레트 전수 64 트리 / 210 노드를 production 진입점으로 돌려 wasm 경계 값을 셌다.

### 3-1. Table 은 레이아웃 자식이 0 이 아니다

| collection root | 레이아웃 자식 | 경계 overflow | 높이 definite | 기본 상태 판정                   |
| --------------- | ------------- | ------------- | ------------- | -------------------------------- |
| **Table**       | **2**         | **없음**      | **예** (400)  | **격차** — 원인은 가드 하나      |
| ListBox         | 0             | `auto`        | 예            | 정합 (scrollable → 양쪽 floor 0) |
| GridList        | 0             | `hidden`      | 예            | 정합 (scrollable → 양쪽 floor 0) |
| Tree            | 2             | `auto`        | 아니오        | 해당 없음                        |
| TableView       | 2             | 없음          | 아니오        | 해당 없음 (주축 definite 아님)   |

ADR 본문의 "ListBox / GridList / Table 은 행을 투영으로 그려 자식이 없다" 는 **Table 에서 거짓**이다 (`A2_WINDOWED_COLLECTION_TAGS` 멤버인 것과 레이아웃 자식이 0 인 것은 다른 사실이었다). Table 은 공급이 0 이 아니므로 **대안 C 단독으로 닫힌다**.

### 3-2. 기본 상태 격차는 Table 하나 — 그리고 원인이 뒤바뀐다

리뷰 round 1 은 "Table 과 stack GridList 가 기본 non-scrollable" 로 정정했다. 실측은 그중 Table 만 남긴다 — 팔레트 GridList 기본 layout 은 `grid` 라 `implicitStyles` 가 `hidden` 을 준다 (stack 은 사용자가 지정해야 도달).

결과적으로 **A 와 C 의 우선순위가 뒤집힌다**:

- **C (가드)** — 기본 상태 격차 (Table) 를 단독으로 닫고, collection 밖 일반 상자의 발산도 닫는다. **주 경로.**
- **A (세로축 공급)** — ListBox/GridList 는 기본이 scrollable 이라 정합이고, 사용자가 `visible`/`clip` 을 준 경우에만 필요하다. 그때는 C 와 함께여야 한다. **부 경로.**

### 3-3. C 의 표면 크기 (R1)

경계 값 기준 "non-scrollable + 주축 definite" 후보: **세로축 128 노드 · 가로축 58 노드** (64 트리 210 노드 중). 실제로 값이 바뀌는 것은 그중 _제약된 flex 주축의 item_ 인 노드뿐이지만, 자릿수가 "collection 한 줌" 이 아님은 확정이다.

성격도 바뀐다 — C 는 **기존 발산을 닫는 변경**이지 새 회귀를 만드는 변경이 아니다 (G0 의 definite 행이 이미 Chrome 과 갈려 있다). 따라서 R1 의 실제 위험은 "회귀" 가 아니라 **기존 게이트 기준선이 움직이는 것**이다 — 지금 통과 중인 케이스 중 잘못된 값에 고정된 것이 있으면 RED 로 뜬다.

## 4. Phase 1 형태 확정 (G0 통과 조건)

1. **대안 C 먼저** — `auto_min_main_from_parts` 의 `main_size == AUTO` 가드를 `min(specified, content)` 로 대체. 조건 소유는 계속 이 함수 하나 (ADR-183 R2).
2. 전량 게이트를 돌려 움직이는 기준선을 전부 조사한다 (R1) — 각각 "종전 값이 Chrome 과 갈려 있었나" 로 판정. 갈려 있었으면 기준선 갱신, 아니면 결함.
3. **그 다음 대안 A** — 슬롯 19 의 `is_row` writer 가드를 축별로 풀고 collection type 한정으로 세로축 값을 공급 (R5 — 텍스트 노드 일반화 금지).

## 5. 검증

- 신규 게이트 2 파일 **11 PASS** · `pnpm type-check` PASS
- artifact: `adr204-min-content-floor-first-nail.json` · `adr204-floor-reach-inventory.json`

# ADR-204 Phase 3 — 게이트 G1 · G3 (2026-09-04)

> 산출물: `apps/builder/tests/parity/adr204ReachMatrix.browser.test.ts` (5 PASS, artifact `tests/parity/.artifacts/adr204-reach-matrix.json`) · implicitStyles 주입 2건 제거 · 기준선 갱신 3건. G2 는 Phase 1·2 evidence 의 원복 RED 로 이미 닫혔다.

## 1. G1 — 도달 매트릭스 Chrome 차등

DOM leg 는 DC-6 게이트의 아날로그 상자가 아니라 **preview 와 같은 `rendererMap` 실렌더** (실 번들 CSS + Preview 전역 reset, `adr923PreviewLeg.mountProductionRoot`) 다. RAC collection 은 `<template>` (collection portal) 과 focus-scope span 을 먼저 그리고 행은 한 틱 뒤에 붙으므로 root 는 `data-element-id` 로 찾고 행이 붙을 때까지 기다린 뒤 잰다 (첫 마운트에서 행 0 → 10px 를 관찰).

production ListBox / GridList / Table 팔레트 트리를 flex column (400 / **80**) 의 item 으로 두고 overflow 를 raw / visible / clip / auto 로 바꿨다. DOM collection 은 height 를 지정하지 않는다 (Canvas 의 164 는 read-time 주입, preview 는 행을 실제로 그린다) — 400 행이 두 leg 의 **콘텐츠 높이 자체**가 같은지의 대조군이고 80 행이 floor 판정이다.

### 1-1. 최종 표 (전부 ≤1px)

| type     | 부모 | overflow (경계 도달값) | scrollable | DOM (Chrome) | production |
| -------- | ---- | ---------------------- | ---------- | ------------ | ---------- |
| ListBox  | 400  | raw (auto)             | 예         | 164          | 164        |
| ListBox  | 400  | visible / clip         | 아니오     | 164          | 164        |
| ListBox  | 400  | auto                   | 예         | 164          | 164        |
| ListBox  | 80   | raw (auto)             | 예         | 80           | 80         |
| ListBox  | 80   | **visible / clip**     | 아니오     | **164**      | **164**    |
| ListBox  | 80   | auto                   | 예         | 80           | 80         |
| GridList | 400  | raw (없음)             | 아니오     | 164          | 164        |
| GridList | 400  | visible / clip / auto  | —          | 164          | 164        |
| GridList | 80   | **raw (없음)**         | 아니오     | **164**      | **164**    |
| GridList | 80   | **visible / clip**     | 아니오     | **164**      | **164**    |
| GridList | 80   | auto                   | 예         | 80           | 80         |
| Table    | 400  | raw / visible / clip   | 아니오     | 400          | 400        |
| Table    | 400  | auto                   | 예         | 400          | 400        |
| Table    | 80   | raw / visible / clip   | 아니오     | 80           | 80         |
| Table    | 80   | auto                   | 예         | 80           | 80         |

collection 밖 대조군 (G0 column definite 일반 상자): visible 164/164 · auto 80/80 — 회귀 0.

### 1-2. 착수 시 RED 2건 — 원인은 둘 다 **Canvas 만의 implicit 주입**이었다

Phase 0 인벤토리는 wasm 경계 값 (overflow / definite) 만 셌고 DOM 을 재지 않았다. Chrome 을 실제로 대조하자 커널·스칼라와 무관한 발산이 두 행에서 나왔다.

| 행                  | 착수 시 (DOM vs production) | 원인                                                                                                                                                                                                                                                                                                                                                                                                         | 수리                                                                                              |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Table 80 (전부)** | 80 vs **402**               | `implicitStyles` Table fixed 분기가 `height: 402` 와 함께 **`minHeight: 402`** 를 주입 (ADR-151 B8, 2026-07-16). DOM 외곽 `.react-aria-Table` 의 min-height 는 catalog `containerStyles.minHeight: 40px` (Table.css 도 40) 이고 height 는 안쪽 virtualizer 에만 있어 제약 flex 에서 40 까지 줄어든다. min 이 명시라 §4.5 절은 애초에 관여하지 않는다 — Phase 0 의 "Table 은 가드 하나가 원인" 은 **틀렸다**. | minHeight 주입 제거 — catalog 40 이 parentStyle 채널로 그대로 실린다 (batch `minHeight: "40px"`). |
| **GridList 80 raw** | **164** vs 80               | gridlist grid 분기가 `overflow: parentStyle.overflow ?? "hidden"` 을 주입 (03-23 `a87d4d898`, 사유 기록 없음). DOM `.react-aria-GridList` (GridList.css) 와 catalog GridList rule 모두 overflow 선언이 없어 **non-scrollable** — Chrome 은 floor 164. Canvas 만 scroll container 라 floor 0 → 80. Phase 0 이 "GridList 기본은 scrollable 이라 정합" 으로 센 것은 이 주입을 production 사실로 읽은 결과다.    | `overflow: hidden` 주입 제거 — 기본 상태 GridList 도 A (스칼라) + C (specified 절) 로 닫힌다.     |

Table 400 행의 "DOM 400 vs production 402" 처럼 보이는 값은 발산이 아니다 — 부모가 400 이라 DOM (min 40, overflow hidden) 이 400 으로 줄어든 것이고, 수리 후 production 도 400 이다. 제약 없는 부모에서의 외곽 border-box 402 (ADR-151 B8) 는 그대로다.

### 1-3. 움직인 기준선 3건 (R1 — "종전 값이 Chrome 과 갈려 있었나" 로 판정)

| 게이트                                                                                 | 종전 고정                                     | 갱신                                     | 근거                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| `adr923Dc6ChromeGate` GridList 400 raw `reached`                                       | `"hidden"`                                    | `"undefined"` (경계에 overflow 없음)     | DOM GridList.css 에 overflow 없음                 |
| `adr923Dc6ChromeGate` GridList 80 raw 높이                                             | 80                                            | **164**                                  | 위 표 GridList 80 raw — Chrome 164                |
| `adr923Dc6OverflowCapInventory` ratchet                                                | 19 행 (`GridList > GridList overflow:hidden`) | 18 행                                    | 주입 제거로 도달 집합에서 빠짐 (감소 = 수리 결과) |
| `tableFixedHeightBorderImplicitStyles` · `adr923DefaultContractParity` Table minHeight | 402                                           | `"40px"`                                 | catalog containerStyles.minHeight = DOM 40        |
| `adr204FloorReachInventory` "기본 상태 격차는 Table 하나"                              | GridList scrollable                           | Table + GridList (ListBox 만 scrollable) | GridList 주입 제거                                |

## 2. G3 — 프레임 예산 · 레이아웃 노드 수

- **레이아웃 노드 수 증가 0**: 팔레트 전수 64 트리 / **210 노드** — Phase 0 artifact 와 같다 (`adr204-floor-reach-inventory.json` nodeCount). 투영 행은 여전히 실체화되지 않는다.
- **프레임 p50**: `pnpm perf:baseline -- --lane frame --seed-count 600 --classes idle,select,edit` 를 같은 dev 서버에서 **엔진만 바꿔** A/B (base = Phase 1 이전 `744acf2bc` 엔진 src → wasm 재빌드, cur = HEAD). 각 arm 2회.

| arm  | run | class  | gap p50 | gap p95 | drop% | render.frame p50 / p95 | longtask ms |
| ---- | --- | ------ | ------- | ------- | ----- | ---------------------- | ----------- |
| base | 1   | idle   | 16.7    | 17.4    | 0     | 0.2 / 0.5              | 0           |
| base | 1   | select | 247.2   | 369.6   | 100   | 0.7 / 1.2              | 3180        |
| base | 1   | edit   | 16.6    | 593.8   | 10.5  | 0.1 / 1.1              | 2884        |
| base | 2   | idle   | 16.6    | 17.6    | 0     | 0.3 / 0.7              | 0           |
| base | 2   | select | 221.8   | 306.9   | 92.3  | 0.7 / 1.1              | 3092        |
| base | 2   | edit   | 16.7    | 509.4   | 8.7   | 0.1 / 1.0              | 3133        |
| cur  | 1   | idle   | 16.7    | 17.7    | 0     | 0.5 / 0.7              | 0           |
| cur  | 1   | select | 231.7   | 291.1   | 92.3  | 0.8 / 3.6              | 3243        |
| cur  | 1   | edit   | 16.6    | 495.6   | 8.6   | 0.1 / 1.0              | 3130        |
| cur  | 2   | idle   | 16.7    | 17.2    | 0     | 0.5 / 0.7              | 0           |
| cur  | 2   | select | 231.6   | 344.2   | 100   | 0.7 / 2.9              | 3357        |
| cur  | 2   | edit   | 16.6    | 550.2   | 8.8   | 0.1 / 1.0              | 3235        |

gap p50 median (base → cur): idle 16.65 → 16.7 (**+0.3%**) · edit 16.65 → 16.6 (−0.3%) · select 234.5 → 231.6 (−1.2%). **G3 통과 (≤ +1%)**. select 의 run 간 편차 (base 247 vs 222) 가 arm 간 차이보다 크다 — 이 하니스로는 1% 를 가를 수 없고 "회귀 신호 없음" 까지가 판정이다. render.frame p50 은 idle 에서 0.25 → 0.5 ms 로 보이지만 절대값 0.25 ms 차이고 base 두 run 도 0.2 / 0.3 으로 갈린다 (기록만, gate 항목 아님 — 레이아웃이 아니라 Skia 렌더 측정치). JSON: `/private/tmp/perf-baseline/frame-1788485802547 · 851036 (base) · 905379 · 954695 (cur)`.

## 3. 검증

- browser parity 전량 **1110 PASS** (실패 2 기존: `catalogComponentBox` GridListItem · Tooltip) · layout engines unit 482 PASS · `pnpm type-check` PASS.
- 원복 RED (G1 게이트가 두 주입을 감지하는지, 최종 단정으로 재실행): (a) Table `minHeight: 402` 복원 → `Table 80 raw: expected 402 to be close to 80` + `Table 400 raw: expected 2 to be ≤ 1` (제약 400 에서도 402 로 넘친다) · (b) GridList `overflow: hidden` 복원 → 격차 행 5 → 4 / scrollable 행 3 → 4 (`expected 4 to be 5` · `expected 4 to be 3`). 복원 후 5 PASS.

## 4. Live

Chrome MCP, 빌더 Home 페이지 (throttle 없음). 팔레트로 frame 을 body 에 넣고 `display:flex · column · 300×80` 으로 둔 뒤 팔레트로 collection 을 그 안에 추가, `__composition_LAYOUT_DEBUG__.getSharedLayoutMap()` 의 rect 를 읽었다.

| 시나리오                                              | Skia rect (착수 전 → 후)                              |
| ----------------------------------------------------- | ----------------------------------------------------- |
| GridList 기본 상태 (ref 인스턴스, overflow 미지정)    | h **80 → 164** (`[0,0,300,164]`, 카드가 frame 밖으로 넘쳐 보인다 — DOM 과 같은 visible overflow) |
| GridList + Table 같이 (column 80 안 두 item)          | GridList 164 · Table **40** (`[0,164,300,40]` — 둘 다 min 에 고정: GridList 는 §4.5 floor 164, Table 은 catalog min-height 40; 착수 전 Table 402) |
| Table 단독                                            | h **402 → 80** (`[0,0,300,80]`, 캔버스 표시 300×80)    |

이후 frame 을 `removeElement` 로 제거 (원복 확인 — frameGone true · 페이지 Table 0).

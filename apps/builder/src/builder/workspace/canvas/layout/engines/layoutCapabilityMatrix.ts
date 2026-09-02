/**
 * 레이아웃 capability matrix — **seed** (ADR-923 Phase 6, 2026-09-03 · Codex round 33 정정).
 *
 * 엔진 (`packages/composition-engine`) 이 CSS 의미를 **그대로 구현하지 않는** 자리를 property × value
 * 단위로 선언한다. 이 파일은 선언만이다 — 집행 (matrix 밖 property 무시가 생기면 게이트 실패, ingress
 * 정규화, persisted migration) 은 ADR-923 breakdown §8 (B 갈래) 의 별도 결정이다.
 *
 * 행마다 값별로 **Chrome 격차 케이스 1개** 를 실측해 `oracles` 에 고정한다 — 실측·고정은
 * `tests/parity/adr923CapabilityMatrixSeed.browser.test.ts` (DOM leg `getBoundingClientRect` ↔ production
 * 파이프라인 `calculateFullTreeLayout`). 케이스는 **production 이 엔진 경계까지 운반하는 키만** 쓴다 —
 * 운반되지 않는 shorthand (`gridColumn` 등) 를 넣으면 DOM 은 그것을 적용하고 파이프라인은 버려서 두 leg 이
 * 서로 다른 이유로 우연히 같아질 수 있고, 그 Δ0 이 "구현됨" 으로 잘못 읽힌다 (round 33 r33m1 — dense 를
 * 구현됐다고 잘못 판정한 원인). 수치가 바뀌면 (엔진이 구현했거나 치환이 달라졌거나) 테스트가 RED 로
 * 알리고, 이 표를 고쳐야 한다 — 표를 유리하게 바꿔 격차를 줄이는 방향은 금지 (수리 결과로만 갱신).
 *
 * 범주 (round 33 r33m2 — **엔진 경계 기준** 으로 정의):
 * - `engineSupport`: 엔진이 그 CSS 의미를 얼마나 구현하는가 — `native` (그대로) · `partial` (일부 값만) ·
 *   `none` (미구현)
 * - `policy`: 값이 엔진 경계 (`buildTreeBatch` 의 `EngineStyle` 레코드) 에서 어떻게 되는가 —
 *   `pass` (값 그대로 실리고 엔진이 그 의미로 구현) · `declared-substitution` (값이 경계에 **실리지만** 엔진이
 *   다른 의미로 치환 — 치환 내용을 `behavior` 에 명시) · `ignored` (속성이 `EngineStyle`/Rust `StyleInput`
 *   에 없어 어댑터가 **싣지 않음** — 엔진은 읽을 기회조차 없다).
 *   → `display: inline` 은 경계에 실려 엔진 `parse_display` 가 읽은 뒤 block-level 로 치환되므로
 *   `declared-substitution` 이다 (`ignored` 아님). `float` 는 필드 자체가 없어 `ignored`. seed 테스트가
 *   경계 record 를 잡아 "실렸는가" 로 policy 를 기계 대조한다.
 *
 * S1·S2·S3·S6·S9 (종전 TS IFC 시뮬레이션) 는 Phase 5 에서 엔진 구현으로 대체돼 여기 없다 — 그것들은
 * `pass` 다. S5 (intrinsic 측정 목록 `INTRINSIC_MEASURE_TAGS`) 는 display 가 아니라 측정 capability 라
 * `utils.ts` 가 소유한다.
 */

export type EngineSupport = "native" | "partial" | "none";
export type CapabilityPolicy = "pass" | "declared-substitution" | "ignored";

export interface CapabilityOracle {
  /** seed 테스트 `CASES[].caseId` 와 1:1 */
  caseId: string;
  /** 케이스 설명 */
  case: string;
  /** 격차를 재는 노드 (케이스 안 label) */
  node: string;
  /** Chrome 대비 |Δx|, |Δy|, |Δw|, |Δh| (px, 실측 고정) */
  gap: { dx: number; dy: number; dw: number; dh: number };
  measuredAt: string;
}

export interface LayoutCapabilityRow {
  /** breakdown §2.2 의 자리 번호 (S4 · S7 · S8) */
  id: "S4" | "S7" | "S8";
  property: string;
  value: string;
  engineSupport: EngineSupport;
  policy: CapabilityPolicy;
  /** 엔진이 실제로 하는 일 */
  behavior: string;
  /** Chrome 격차 케이스 — 값마다 1개, seed 테스트가 수치를 고정 (1개 이상) */
  oracles: readonly CapabilityOracle[];
  /** 후속 결정 (breakdown §8) */
  followUp: string;
}

export const LAYOUT_CAPABILITY_MATRIX: readonly LayoutCapabilityRow[] = [
  {
    id: "S4",
    property: "display",
    value: "inline",
    engineSupport: "none",
    policy: "declared-substitution",
    behavior:
      "`inline` 은 경계에 그대로 실리고 (`normalizeCssDisplay` 인식 8 값) 엔진 `parse_display` 가 {outer inline, inner flow} 로 읽지만, block 부모의 line item 판정 `is_atomic_inline_level` 이 inner=flow 를 제외해 block-level box 로 치환된다 (`tree.rs write_block_item` code 0). 순수 inline box (텍스트 run 과 섞이는 IFC) 는 없다. inline-block · inline-flex · inline-grid 는 line item (pass).",
    oracles: [
      {
        caseId: "S4-inline-text-pair",
        case: "block(300) > inline 텍스트 2개 (16px/20px)",
        node: "b",
        // Chrome: b 가 a 옆 같은 줄 (x 41.9 · 텍스트 폭 40.8 · 글자 상자 y 1 h 18). 파이프라인: block 격상 —
        //   아래 줄 (y 20) · 부모 폭 stretch (300) · 줄 높이 20.
        gap: { dx: 41.9, dy: 19, dw: 259.2, dh: 2 },
        measuredAt: "2026-09-03",
      },
    ],
    followUp:
      "breakdown §8 S4 — store 쓰기 chokepoint + hydration 원값 보존 + 패널 DISPLAY_OPTIONS 조정 후 정규화 (persisted migration 동반). 그 전까지 declared-substitution (block 격상).",
  },
  {
    id: "S7",
    property: "float",
    value: "left | right (clear · writing-mode · column-* 동류)",
    engineSupport: "none",
    policy: "ignored",
    behavior:
      "`EngineStyle` (layoutTypes.ts) · 엔진 `StyleInput` 에 float/clear/writing-mode/column 필드가 없어 어댑터 (`flexStyleAdapter` · `blockStyleAdapter`) 가 싣지 않는다 — 경계 record 에 키가 없고, 요소는 normal flow block 으로 쌓인다 (ADR-916 1-C 미구현).",
    oracles: [
      {
        caseId: "S7-float-left",
        case: "block(300) > float:left 60×20 + block 100×30",
        node: "b",
        // Chrome: float 는 flow 밖 — b 는 (0,0). 파이프라인: a 를 normal flow block 으로 쌓아 b 가 y 20.
        gap: { dx: 0, dy: 20, dw: 0, dh: 0 },
        measuredAt: "2026-09-03",
      },
    ],
    followUp:
      "breakdown §8 S7 — 패널 노출 없음 확인, import strip 여부 결정. ignored 선언 유지.",
  },
  {
    id: "S8",
    property: "grid-template-columns | grid-auto-flow",
    value: "subgrid | … dense (baseline 정렬 · intrinsic track 일부 동류)",
    engineSupport: "partial",
    policy: "declared-substitution",
    behavior:
      '`subgrid` 는 부모 트랙을 상속하지 않고 독립 grid 로 치환된다 (`parseGridTemplate` 이 토큰 `subgrid` 를 그대로 넘기고 엔진 `parse_single_track_value` 가 미인식 → auto 폴백, `grid.rs`). `grid-auto-flow: … dense` 는 값이 실리지만 (`EngineGridAutoFlow` · binary `GRID_AUTO_FLOW_MAP`) 엔진 auto-placement 가 `contains("column")` 만 읽어 **sparse 커서** 로만 놓는다 — 빈칸 역채움 없음 (`grid.rs` Phase 1 auto-placement, ADR-916 1-B 미구현 목록 그대로; round 33 이전의 "dense Δ0 = 구현" 판정은 운반되지 않는 `gridColumn` shorthand 가 만든 우연이었다). baseline 정렬은 start 로 치환.',
    oracles: [
      {
        caseId: "S8-grid-subgrid",
        case: "2열(100·100) grid > col 1/3 subgrid 자식 > 아이템 2 (Chrome 은 부모 트랙에 놓는다)",
        node: "s2",
        // Chrome: subgrid 자식 s2 가 부모 2열째 (x 100, y 0) 100×20. 파이프라인: sub 는 col 1/3 (폭 200) 의
        //   독립 grid 의 단일 auto 트랙 (폭 200) 에 세로로 쌓여 (0, 20) 200×20.
        gap: { dx: 100, dy: 20, dw: 100, dh: 0 },
        measuredAt: "2026-09-03",
      },
      {
        caseId: "S8-grid-dense",
        case: "2열(100·100) grid, row dense > col 1/3 · 1 · col 1/3 · 1 (Chrome 은 4번째를 2행 2열 빈칸에 역채움)",
        node: "d",
        // Chrome dense: d 가 (100, 20). 파이프라인 sparse: 커서가 앞으로만 가 4행 (0, 60) (root 높이 60 vs 80).
        gap: { dx: 100, dy: 40, dw: 0, dh: 0 },
        measuredAt: "2026-09-03",
      },
    ],
    followUp:
      "breakdown §8 S8 — declared-substitution 유지, 구현은 별도 ADR (차등 케이스로 수치 고정).",
  },
];

export function capabilityRow(
  id: LayoutCapabilityRow["id"],
): LayoutCapabilityRow {
  const row = LAYOUT_CAPABILITY_MATRIX.find((r) => r.id === id);
  if (!row) throw new Error(`capability matrix: ${id} 행 없음`);
  return row;
}

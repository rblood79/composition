/**
 * 레이아웃 capability matrix — **seed** (ADR-923 Phase 6, 2026-09-03).
 *
 * 엔진 (`packages/composition-engine`) 이 CSS 의미를 **그대로 구현하지 않는** 자리를 property × value
 * 단위로 선언한다. 이 파일은 선언만이다 — 집행 (matrix 밖 property 무시가 생기면 게이트 실패, ingress
 * 정규화, persisted migration) 은 ADR-923 breakdown §8 (B 갈래) 의 별도 결정이다.
 *
 * 행마다 **Chrome 격차 1 케이스** 를 실측해 `oracle` 에 고정한다 — 실측·고정은
 * `tests/parity/adr923CapabilityMatrixSeed.browser.test.ts` (DOM leg `getBoundingClientRect` ↔ production
 * 파이프라인 `calculateFullTreeLayout`). 수치가 바뀌면 (엔진이 구현했거나 치환이 달라졌거나) 테스트가
 * RED 로 알리고, 이 표를 고쳐야 한다 — 표를 유리하게 바꿔 격차를 줄이는 방향은 금지 (수리 결과로만 갱신).
 *
 * 범주:
 * - `engineSupport`: `native` (CSS 그대로) · `partial` (일부 값만) · `none` (미구현)
 * - `policy`: `pass` (값 그대로 전달) · `declared-substitution` (엔진이 다른 값으로 치환 — 치환 내용을
 *   `behavior` 에 명시) · `ignored` (엔진이 속성/값을 읽지 않음)
 *
 * S1·S2·S3·S6·S9 (종전 TS IFC 시뮬레이션) 는 Phase 5 에서 엔진 구현으로 대체돼 여기 없다 — 그것들은
 * `pass` 다. S5 (intrinsic 측정 목록 `INTRINSIC_MEASURE_TAGS`) 는 display 가 아니라 측정 capability 라
 * `utils.ts` 가 소유한다.
 */

export type EngineSupport = "native" | "partial" | "none";
export type CapabilityPolicy = "pass" | "declared-substitution" | "ignored";

export interface CapabilityOracle {
  /** seed 테스트의 케이스 이름 */
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
  /** Chrome 격차 1 케이스 — seed 테스트가 값을 고정 */
  oracle: CapabilityOracle;
  /** 후속 결정 (breakdown §8) */
  followUp: string;
}

export const LAYOUT_CAPABILITY_MATRIX: readonly LayoutCapabilityRow[] = [
  {
    id: "S4",
    property: "display",
    value: "inline",
    engineSupport: "none",
    policy: "ignored",
    behavior:
      "순수 inline box (inner=flow) 없음 — outer=inline 이지만 line item 판정에서 제외돼 block 으로 격상된다 (`display.rs is_atomic_inline_level` false, `tree.rs write_block_item` code 0). inline-block · inline-flex · inline-grid 는 line item (pass).",
    oracle: {
      case: "S4-inline-text-pair — block(300) > inline 텍스트 2개 (16px/20px)",
      node: "b",
      // Chrome: b 가 a 옆 같은 줄 (x 41.9 · 텍스트 폭 40.8 · 글자 상자 y 1 h 18). 파이프라인: block 격상 —
      //   아래 줄 (y 20) · 부모 폭 stretch (300) · 줄 높이 20.
      gap: { dx: 41.9, dy: 19, dw: 259.2, dh: 2 },
      measuredAt: "2026-09-03",
    },
    followUp:
      "breakdown §8 S4 — store 쓰기 chokepoint + hydration 원값 보존 + 패널 DISPLAY_OPTIONS 조정 후 정규화 (persisted migration 동반). 그 전까지 ignored (block 격상).",
  },
  {
    id: "S7",
    property: "float",
    value: "left | right (clear · writing-mode · column-* 동류)",
    engineSupport: "none",
    policy: "ignored",
    behavior:
      "엔진 `StyleInput` 에 float/clear/writing-mode/column 필드가 없어 어댑터 (`flexStyleAdapter` · `blockStyleAdapter`) 가 싣지 않는다 — 요소는 normal flow block 으로 쌓인다 (ADR-916 1-C 미구현).",
    oracle: {
      case: "S7-float-left — block(300) > float:left 60×20 + block 100×30",
      node: "b",
      // Chrome: float 는 flow 밖 — b 는 (0,0). 파이프라인: a 를 normal flow block 으로 쌓아 b 가 y 20.
      gap: { dx: 0, dy: 20, dw: 0, dh: 0 },
      measuredAt: "2026-09-03",
    },
    followUp:
      "breakdown §8 S7 — 패널 노출 없음 확인, import strip 여부 결정. ignored 선언 유지.",
  },
  {
    id: "S8",
    property: "grid-template-columns",
    value: "subgrid (baseline 정렬 · intrinsic track 일부 동류)",
    engineSupport: "partial",
    policy: "declared-substitution",
    behavior:
      "`subgrid` 는 부모 트랙을 상속하지 않고 독립 grid 로 치환된다 (`parseGridTemplate` 이 토큰 `subgrid` 를 그대로 넘기고 엔진은 미인식 트랙 → auto 폴백, `grid.rs`); baseline 정렬은 start 로 치환 (ADR-916 1-B 미구현). `grid-auto-flow: dense` 는 2026-09-03 실측 Δ0 — 구현돼 있어 matrix 밖 (pass).",
    oracle: {
      case: "S8-grid-subgrid — 2열(100·100) grid > span2 subgrid 자식 > 아이템 2 (Chrome 은 부모 트랙에 놓는다)",
      node: "s2",
      // Chrome: subgrid 자식 s2 가 부모 2열째 (x 100, y 0). 파이프라인: 독립 grid 의 단일 auto 트랙 (폭 100)
      //   에 세로로 쌓여 (0, 20).
      gap: { dx: 100, dy: 20, dw: 0, dh: 0 },
      measuredAt: "2026-09-03",
    },
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

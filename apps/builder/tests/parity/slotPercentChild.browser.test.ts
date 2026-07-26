import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { type ParityCase, runParityCase } from "./harness";

/**
 * 백분율 폭의 containing block = **부모의 사용 폭** (CSS-SIZING-3 §5.1).
 *
 * 프레임을 페이지에 적용한 뒤 content 슬롯에 요소를 넣으면 요소 폭이 슬롯 폭을 넘는다는
 * 보고(2026-07-27)의 최소 재현. 슬롯은 `240px 1fr` grid 의 두 번째 칸이라 사용 폭이 트랙에서
 * 나오고 자기 `width` 선언이 없다 — 실측은 sidebar 240 이 빠지지 않은 컨테이너 폭이었다.
 *
 * 원인은 grid 의 **intrinsic 측정 pass ↔ 증분 캐시** 상호작용이다: 측정이 자식 서브트리를
 * 컨테이너 크기로 solve 하며 `dirty=false` 를 찍어 놓아, 이어지는 셀 크기 solve 가 증분 skip
 * 으로 stale 캐시를 돌려줬다 (`tree.rs::solve_grid`). 셀 자신은 bounds 로 덮어써지므로
 * **자손만** 어긋나 눈에 잘 안 띈다.
 *
 * 부모 폭이 **선언이 아니라 배치로** 정해지는 형태를 함께 건다 — 어디까지 성립하는지 경계를
 * 고정하기 위해서다.
 *
 * ## 범위 밖 발산 2건 (본 파일에서 단언하지 않음 — 실측만 기록)
 *
 * - **grid item 의 명시 width 가 stretch 에 먹힌다**: `240px 1fr` 의 두 번째 칸에 `width:700px`
 *   item → DOM 700 / 엔진 1680. ADR-156 옵션 3-b 의 **문서화된 residual** (justify 축은
 *   stretch 유지 — JS DFS 가 grid 자식 폭을 트랙 폭으로 강제하는 것과의 이중 적용 회피).
 *   자식의 `100%` 는 양쪽 다 700 이라 이 케이스에서 자식은 일치한다.
 * - **flex 컨테이너에 "자식을 가진 flex item" 이 섞이면 형제가 붕괴한다**: row 1920 에
 *   `[width:240px, {flexGrow:1, 자식 width:100%}]` → DOM `240 / 1680` vs 엔진 `0 / 1920`.
 *   자식이 없으면(F1/F2 형태) 동일 구조가 정상이라, flex 의 `used_main` 재-solve 뒤 두 번째
 *   `flex_layout` 입력이 형제 쪽에서 어긋나는 것으로 보인다. 별도 조사 대상.
 */
const ROOT_W = 1920;

const CASES: ParityCase[] = [
  {
    // 기준선 — 부모 폭이 명시 px 인 평범한 경우
    name: "A. block(px) > width:100% 자식",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "a-child", style: { width: "100%", height: "40px" } },
      {
        label: "a-root",
        style: { display: "block", width: "1920px", height: "auto" },
        children: [0],
      },
    ],
  },
  {
    // 부모 폭이 백분율 — 사용 폭 960 이 containing block
    name: "B. block(50%) > width:100% 자식",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "b-child", style: { width: "100%", height: "40px" } },
      {
        label: "b-mid",
        style: { display: "block", width: "50%", height: "auto" },
        children: [0],
      },
      {
        label: "b-root",
        style: { display: "block", width: "1920px", height: "auto" },
        children: [1],
      },
    ],
  },
  {
    // 보고된 형태 — grid item 이 폭을 선언하지 않고 트랙에서 받는다.
    // `gridTemplateRows` 미명시 = implicit auto row → 측정 pass 가 돈다.
    name: "C. grid item(auto) > width:100% 자식",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "c-child", style: { width: "100%", height: "40px" } },
      {
        label: "c-slot",
        style: { gridColumnStart: "2", gridColumnEnd: "3", height: "200px" },
        children: [0],
      },
      {
        label: "c-sidebar",
        style: { gridColumnStart: "1", gridColumnEnd: "2", height: "200px" },
      },
      {
        label: "c-root",
        style: {
          display: "grid",
          gridTemplateColumns: ["240px", "1fr"],
          width: "1920px",
          height: "auto",
        },
        children: [1, 2],
      },
    ],
  },
  {
    // 명시 `auto` row — 측정 pass 의 다른 분기(B)를 태운다
    name: "D. grid(명시 auto row) item > width:100% 자식",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "d-child", style: { width: "100%", height: "40px" } },
      {
        label: "d-slot",
        style: {
          gridColumnStart: "2",
          gridColumnEnd: "3",
          gridRowStart: "1",
          height: "200px",
        },
        children: [0],
      },
      {
        label: "d-sidebar",
        style: {
          gridColumnStart: "1",
          gridColumnEnd: "2",
          gridRowStart: "1",
          height: "200px",
        },
      },
      {
        label: "d-root",
        style: {
          display: "grid",
          gridTemplateColumns: ["240px", "1fr"],
          gridTemplateRows: ["auto"],
          width: "1920px",
          height: "auto",
        },
        children: [1, 2],
      },
    ],
  },
  {
    // 두 단계 중첩 — 셀 → 컨테이너 → 자식까지 전파되는지
    name: "E. grid item > block > width:100% 손자",
    availW: ROOT_W,
    availH: -1,
    nodes: [
      { label: "e-grandchild", style: { width: "100%", height: "40px" } },
      {
        label: "e-inner",
        style: { display: "block", height: "auto" },
        children: [0],
      },
      {
        label: "e-slot",
        style: { gridColumnStart: "2", gridColumnEnd: "3", height: "200px" },
        children: [1],
      },
      {
        label: "e-sidebar",
        style: { gridColumnStart: "1", gridColumnEnd: "2", height: "200px" },
      },
      {
        label: "e-root",
        style: {
          display: "grid",
          gridTemplateColumns: ["240px", "1fr"],
          width: "1920px",
          height: "auto",
        },
        children: [2, 3],
      },
    ],
  },
];

describe("백분율 폭의 containing block ↔ CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  for (const c of CASES) {
    it(c.name, () => {
      expect(runParityCase(c)).toEqual([]);
    });
  }
});

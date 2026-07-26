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
 * - **컨테이너 flex item 의 intrinsic 부재** (2026-07-27 조사 완료 — ADR-165 후속 대상):
 *   `solve_flex` 1단계는 각 item 을 **컨테이너 available 로 solve** 해 그 결과를
 *   `content_main`(off 13) 에 넣는다. 그래서 *스스로 폭을 갖지 않고 늘어나기만 하는* 내용
 *   (auto/`%` 폭 자식) 이 고유 폭으로 오인된다. 그 값이 ① flex base size ② §4.5 floor 의
 *   `content_min_main` absent fallback **양쪽**에 들어가, **상한 근사가 하한으로 쓰인다**.
 *   leaf 는 ADR-165 스칼라로 이미 정확 — **컨테이너만** 비어 있다.
 *
 *   실측 (row 1920, sidebar 250px + content flexGrow:1, DOM/engine/pipeline 3-leg):
 *   | 형태                                   | DOM         | 엔진·파이프라인 |
 *   | -------------------------------------- | ----------- | --------------- |
 *   | content 자식 auto·`%` + sidebar shrink:0 | 250 / 1670  | 250 / **1920**  ← 프리셋 실형태, 우측 250 초과
 *   | 〃 sidebar shrink 기본                   | 250 / 1670  | **0** / 1920    |
 *   | content 자식 고정 3000px                 | 0 / 3000    | 0 / 3000 ✅     ← 진짜 과폭은 정상
 *   | 텍스트 leaf 가 **item 자신**             | 205.7/1714.3| 동일 ✅          |
 *   | 텍스트 leaf 가 **컨테이너 item 안**      | 205.7/1714.3| **0** / 1920    |
 *
 *   `sidebar-left` / `sidebar-right` / `list-detail` 프리셋이 이 형태다 (`flexShrink:0` 이
 *   붙어 있어 붕괴 대신 **초과**로 나타난다). 부분 수정은 금지 — max-content 만 고치면
 *   floor 가 함께 커져 긴 텍스트가 더 크게 넘친다. min/max-content 를 leaf→컨테이너로
 *   **bottom-up 전파**(O(n), 추가 solve 없음)해 off 13/19 을 동시에 채우는 것이 정본 방향.
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

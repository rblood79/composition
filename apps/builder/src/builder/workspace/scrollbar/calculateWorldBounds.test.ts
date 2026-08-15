import { describe, expect, it } from "vitest";
import { calculateWorldBounds, type ContentRect } from "./calculateWorldBounds";

/**
 * 스크롤바 world 범위 계약.
 *
 * **Why (2026-08-15 실측)**: 구 구현은 content 기준을 `canvasSize` 하나로 잡았는데 그 값은
 * **페이지 1장 크기**다. 문서 전체를 덮으라고 있던 "모든 요소 bounds 합집합" 단계는
 * `elementRegistry` 가 ADR-900 PixiJS 제거 이후 비어 있어 no-op 이었다. 결과적으로
 * 25페이지(x 0→11670) 문서에서 world 가 2903 까지만 잡혀 가로 스크롤바를 끝까지 끌어도
 * 7페이지 너머로 갈 수 없었다 (thumb 은 트랙의 66%를 차지한 채 이미 오른쪽 끝).
 */

const PAGE_WIDTH = 390;
const PAGE_HEIGHT = 844;
const PAGE_GAP = 80;
const PADDING = 200;

function makePages(count: number): ContentRect[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i * (PAGE_WIDTH + PAGE_GAP),
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  }));
}

/** 원점 부근의 작은 뷰포트 — world 확장 단계가 결과를 가리지 않도록 */
const SMALL_VIEWPORT = { x: 0, y: 0, width: 100, height: 100 };

describe("calculateWorldBounds", () => {
  it("아트보드 rect 합집합을 content 범위로 삼는다", () => {
    const world = calculateWorldBounds(makePages(2), SMALL_VIEWPORT, PADDING);

    // 마지막 페이지 오른쪽 끝 = 470 + 390 = 860
    expect(world.maxX).toBe(860 + PADDING);
    expect(world.minX).toBe(0 - PADDING);
    expect(world.maxY).toBe(PAGE_HEIGHT + PADDING);
  });

  it("페이지 1장 크기로 잘리지 않는다 — 25페이지 문서 전체를 덮는다", () => {
    const pages = makePages(25);
    const world = calculateWorldBounds(pages, SMALL_VIEWPORT, PADDING);

    const documentRight = 24 * (PAGE_WIDTH + PAGE_GAP) + PAGE_WIDTH;
    expect(documentRight).toBe(11670);
    expect(world.maxX).toBe(documentRight + PADDING);
    // 구 동작(canvasSize 단일 페이지 기준)이면 여기서 590 이 나온다
    expect(world.width).toBeGreaterThan(documentRight);
  });

  it("viewport 가 content+padding 을 넘으면 world 를 확장한다", () => {
    const world = calculateWorldBounds(
      makePages(1),
      { x: -1000, y: -500, width: 5000, height: 3000 },
      PADDING,
    );

    expect(world.minX).toBe(-1000);
    expect(world.minY).toBe(-500);
    expect(world.maxX).toBe(4000);
    expect(world.maxY).toBe(2500);
  });

  it("크기 0 인 아트보드는 무시한다", () => {
    const world = calculateWorldBounds(
      [
        { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
        { x: 99999, y: 0, width: 0, height: 0 },
      ],
      SMALL_VIEWPORT,
      PADDING,
    );

    expect(world.maxX).toBe(PAGE_WIDTH + PADDING);
  });

  it("아트보드가 없으면 원점을 content 로 본다", () => {
    const world = calculateWorldBounds([], SMALL_VIEWPORT, PADDING);

    expect(world.minX).toBe(-PADDING);
    expect(world.minY).toBe(-PADDING);
    expect(world.maxX).toBe(PADDING);
    expect(world.maxY).toBe(PADDING);
    expect(Number.isFinite(world.width)).toBe(true);
  });
});

/**
 * content 밖 overscroll.
 *
 * **Why (2026-08-15 실측)**: viewport 확장이 무제한이면 content 밖에서 pan 할 때 world 가
 * 같은 양만큼 커져 `viewportStart / scrollableWorld` 가 1 에 고정된다 — thumb 은 트랙 끝에
 * 붙어 움직이지 않고 크기만 계속 줄어든다 (뷰포트 x 12,000→20,000 에서 thumb 190→120,
 * 위치 1514→1584). 한 화면 분량으로 제한해 크기를 고정한다.
 */
describe("calculateWorldBounds — content 밖 overscroll", () => {
  // 한 페이지(패딩 포함 [-200, 590])보다 좁은 뷰포트 — 확장 여부를 뷰포트 위치로만 가른다
  const VIEW_W = 300;
  const CONTENT_RIGHT = PAGE_WIDTH + PADDING; // 590

  function worldAt(viewX: number) {
    return calculateWorldBounds(
      makePages(1),
      { x: viewX, y: 0, width: VIEW_W, height: 100 },
      PADDING,
    );
  }

  it("content 안이면 확장하지 않는다", () => {
    expect(worldAt(0).maxX).toBe(CONTENT_RIGHT);
    expect(worldAt(0).minX).toBe(-PADDING);
  });

  it("경계를 살짝 넘으면 뷰포트를 그대로 포함한다", () => {
    expect(worldAt(500).maxX).toBe(500 + VIEW_W);
  });

  it("멀리 나가면 content + 한 화면에서 멈춘다", () => {
    expect(worldAt(20000).maxX).toBe(CONTENT_RIGHT + VIEW_W);
  });

  it("더 멀리 나가도 world 크기가 자라지 않는다 — thumb 크기 고정", () => {
    expect(worldAt(50000).width).toBe(worldAt(20000).width);
  });
});

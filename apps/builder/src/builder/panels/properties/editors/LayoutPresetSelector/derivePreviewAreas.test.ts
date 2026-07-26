/**
 * 썸네일 파생 계약 (ADR-168 P-1 / R4).
 *
 * R4 는 "썸네일 파생 함수가 실제 레이아웃과 어긋남 — 이중 진실을 옮기기만 한 결과" 다.
 * 그래서 여기서 확인하는 건 "함수가 뭔가 반환한다" 가 아니라 **선언한 트랙에서 나오는
 * 산술이 맞는가** 다. 기준 폭이 캔버스 프레임(1920/768/390)이라는 점도 못 박는다 —
 * 미디어 쿼리 경계(1280)를 쓰면 desktop 썸네일이 실제 렌더와 어긋난다.
 */

import { describe, expect, it } from "vitest";

import type { BreakpointName } from "@composition/shared";

import { CANVAS_VIEWPORT } from "../../../../workspace/canvasBreakpoints";
import { derivePreviewAreas } from "./derivePreviewAreas";
import { LAYOUT_PRESETS, PRESET_ORDER } from "./presetDefinitions";
import type { PreviewArea } from "./types";

const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];

function slotAreas(areas: PreviewArea[]): PreviewArea[] {
  return areas.filter((area) => area.isSlot);
}

function byName(areas: PreviewArea[], name: string): PreviewArea {
  const found = areas.find((area) => area.name === name);
  if (!found) throw new Error(`area "${name}" 없음`);
  return found;
}

/** 트랙 px → % (기준 = 해당 breakpoint 캔버스 폭). */
function pctOfWidth(px: number, breakpoint: BreakpointName): number {
  return (px / CANVAS_VIEWPORT[breakpoint].width) * 100;
}

describe("derivePreviewAreas — 기준 크기", () => {
  it("캔버스 프레임 크기를 기준으로 쓴다 (미디어 쿼리 경계 아님)", () => {
    // 이 값이 1280 으로 바뀌면 desktop 썸네일 비율이 실제 렌더와 어긋난다 (R4)
    expect(CANVAS_VIEWPORT.desktop.width).toBe(1920);
    expect(CANVAS_VIEWPORT.tablet.width).toBe(768);
    expect(CANVAS_VIEWPORT.mobile.width).toBe(390);
  });
});

describe("derivePreviewAreas — flex row (list-detail)", () => {
  const preset = LAYOUT_PRESETS["list-detail"];

  it("desktop: 고정폭 list 는 리터럴, detail 이 잔여를 받는다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "desktop"));
    const list = byName(areas, "list");
    const detail = byName(areas, "detail");

    // 320px / 1920 = 16.67%
    expect(list.x).toBe(0);
    expect(list.width).toBeCloseTo(pctOfWidth(320, "desktop"), 4);
    expect(detail.x).toBeCloseTo(list.width, 4);
    expect(list.width + detail.width).toBeCloseTo(100, 4);
    // 행 배치라 교차축은 전체
    expect(list.height).toBe(100);
    expect(detail.height).toBe(100);
  });

  it("tablet: list 가 260px 로 좁아진다 — 기준 폭도 768 로 바뀐다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "tablet"));
    // 260 / 768 = 33.9% — desktop(16.7%)보다 **넓어** 보이는 게 맞다.
    // 폭이 절반 이하로 줄었는데 사이드바만 조금 줄었으니 비중은 커진다.
    expect(byName(areas, "list").width).toBeCloseTo(
      pctOfWidth(260, "tablet"),
      4,
    );
  });

  it("mobile: 세로 스택 — 두 pane 이 전폭으로 쌓인다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "mobile"));
    const list = byName(areas, "list");
    const detail = byName(areas, "detail");

    expect(list.x).toBe(0);
    expect(list.width).toBe(100);
    expect(detail.x).toBe(0);
    expect(detail.width).toBe(100);
    // 위아래로 분리
    expect(detail.y).toBeGreaterThan(list.y);
    expect(list.y).toBe(0);
  });
});

describe("derivePreviewAreas — grid (holy-grail)", () => {
  const preset = LAYOUT_PRESETS["holy-grail"];

  it("desktop: 200px 1fr 200px 트랙이 line 범위대로 환산된다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "desktop"));
    const sidebar = byName(areas, "sidebar");
    const content = byName(areas, "content");
    const aside = byName(areas, "aside");
    const header = byName(areas, "header");

    expect(sidebar.width).toBeCloseTo(pctOfWidth(200, "desktop"), 4);
    expect(aside.width).toBeCloseTo(pctOfWidth(200, "desktop"), 4);
    // 1fr = 1920 - 400 = 1520
    expect(content.width).toBeCloseTo(pctOfWidth(1520, "desktop"), 4);
    expect(content.x).toBeCloseTo(sidebar.width, 4);
    // header 는 1~4 line = 전폭
    expect(header.x).toBe(0);
    expect(header.width).toBeCloseTo(100, 4);
  });

  it("tablet: 컬럼 트랙만 160px 로 좁아진다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "tablet"));
    expect(byName(areas, "sidebar").width).toBeCloseTo(
      pctOfWidth(160, "tablet"),
      4,
    );
    // 1fr = 768 - 320 = 448
    expect(byName(areas, "content").width).toBeCloseTo(
      pctOfWidth(448, "tablet"),
      4,
    );
  });

  it("mobile: flex column 전환으로 grid line 이 무시되고 전폭 스택된다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "mobile"));
    expect(areas).toHaveLength(5);
    for (const area of areas) {
      expect(area.x).toBe(0);
      expect(area.width).toBe(100);
    }
    // 정의 순서대로 위에서 아래로
    const ys = areas.map((a) => a.y);
    expect([...ys]).toEqual([...ys].sort((a, b) => a - b));
  });
});

describe("derivePreviewAreas — grid item 재배치 (dashboard-widgets)", () => {
  const preset = LAYOUT_PRESETS["dashboard-widgets"];

  it("desktop: widgets 가 우측 280px 열", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "desktop"));
    const widgets = byName(areas, "widgets");
    const content = byName(areas, "content");

    expect(widgets.width).toBeCloseTo(pctOfWidth(280, "desktop"), 4);
    expect(widgets.x).toBeGreaterThan(content.x);
    // 같은 행
    expect(widgets.y).toBeCloseTo(content.y, 4);
  });

  it("tablet: widgets 가 하단 전폭 행으로 내려간다", () => {
    const areas = slotAreas(derivePreviewAreas(preset, "tablet"));
    const widgets = byName(areas, "widgets");
    const content = byName(areas, "content");

    expect(widgets.x).toBe(0);
    expect(widgets.width).toBeCloseTo(100, 4);
    // content 보다 아래
    expect(widgets.y).toBeGreaterThan(content.y);
  });
});

describe("derivePreviewAreas — 격자 슬롯 내부 셀 (feed)", () => {
  const preset = LAYOUT_PRESETS.feed;

  it("열 수 변화가 셀 개수로 드러난다 (4 → 2 → 1)", () => {
    const cellCount = (breakpoint: BreakpointName) =>
      derivePreviewAreas(preset, breakpoint).filter(
        (area) => !area.isSlot && area.name.startsWith("feed#"),
      ).length;

    // rows = min(2, floor(8 / columns)) → desktop 4열×2행, tablet 2열×2행, mobile 1열×2행
    expect(cellCount("desktop")).toBe(8);
    expect(cellCount("tablet")).toBe(4);
    expect(cellCount("mobile")).toBe(2);
  });

  it("셀은 슬롯 사각형 안에 들어간다", () => {
    const areas = derivePreviewAreas(preset, "desktop");
    const feed = byName(slotAreas(areas), "feed");
    const cells = areas.filter((a) => !a.isSlot);

    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(feed.x);
      expect(cell.y).toBeGreaterThanOrEqual(feed.y);
      expect(cell.x + cell.width).toBeLessThanOrEqual(
        feed.x + feed.width + 1e-6,
      );
      expect(cell.y + cell.height).toBeLessThanOrEqual(
        feed.y + feed.height + 1e-6,
      );
    }
  });

  it("셀은 슬롯이 아니다 — 이름표 대상에서 제외된다", () => {
    const cells = derivePreviewAreas(preset, "desktop").filter((a) =>
      a.name.startsWith("feed#"),
    );
    for (const cell of cells) {
      expect(cell.isSlot).toBe(false);
      expect(cell.required).toBeUndefined();
    }
  });
});

describe("derivePreviewAreas — 전 프리셋 × 전 breakpoint 불변식", () => {
  for (const key of PRESET_ORDER) {
    const preset = LAYOUT_PRESETS[key];

    for (const breakpoint of BREAKPOINTS) {
      it(`${key} / ${breakpoint}: 모든 슬롯이 화면 안에 정확히 1개씩`, () => {
        const areas = derivePreviewAreas(preset, breakpoint);
        const slots = slotAreas(areas);

        // 슬롯이 조용히 사라지지 않는다
        expect(slots.map((a) => a.name).sort()).toEqual(
          preset.slots.map((s) => s.name).sort(),
        );

        for (const area of areas) {
          expect(area.x).toBeGreaterThanOrEqual(0);
          expect(area.y).toBeGreaterThanOrEqual(0);
          expect(area.width).toBeGreaterThan(0);
          expect(area.height).toBeGreaterThan(0);
          expect(area.x + area.width).toBeLessThanOrEqual(100 + 1e-6);
          expect(area.y + area.height).toBeLessThanOrEqual(100 + 1e-6);
        }
      });

      it(`${key} / ${breakpoint}: required 표시가 정의와 일치`, () => {
        const slots = slotAreas(derivePreviewAreas(preset, breakpoint));
        for (const slot of preset.slots) {
          expect(byName(slots, slot.name).required).toBe(slot.required);
        }
      });
    }
  }

  it("React key 로 쓰이므로 area 이름은 유일하다", () => {
    for (const key of PRESET_ORDER) {
      for (const breakpoint of BREAKPOINTS) {
        const names = derivePreviewAreas(LAYOUT_PRESETS[key], breakpoint).map(
          (a) => a.name,
        );
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });
});

/**
 * 썸네일 정규화 계약 (2026-07-26).
 *
 * 정규화가 지켜야 하는 것은 **위상**이고, 바꾸는 것은 **비율**뿐이다. 여기서는 그 두 축을 각각
 * 고정한다 — 위상이 깨지면 썸네일이 실제 레이아웃과 다른 구조를 보여주게 되고(ADR-168 R4),
 * 비율이 안 바뀌면 애초에 식별이 안 된다.
 */

import { describe, expect, it } from "vitest";

import type { BreakpointName } from "@composition/shared";

import { derivePreviewAreas } from "./derivePreviewAreas";
import {
  MIN_BAND_PX,
  normalizeThumbnailAreas,
} from "./normalizeThumbnailAreas";
import { LAYOUT_PRESETS, PRESET_ORDER } from "./presetDefinitions";
import type { PreviewArea } from "./types";

/** 패널이 실제로 쓰는 렌더 크기 (index.tsx). */
const RENDER = { width: 80, height: 60 } as const;

const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];

function normalizedAreas(
  presetKey: string,
  breakpoint: BreakpointName,
): PreviewArea[] {
  return normalizeThumbnailAreas(
    derivePreviewAreas(LAYOUT_PRESETS[presetKey], breakpoint),
    RENDER,
  );
}

function byName(areas: readonly PreviewArea[], name: string): PreviewArea {
  const found = areas.find((area) => area.name === name);
  if (!found) throw new Error(`area not found: ${name}`);
  return found;
}

/** % → 실제 렌더 px. 가독성 판정은 px 로 해야 의미가 있다. */
function heightPx(area: PreviewArea): number {
  return (area.height * RENDER.height) / 100;
}

function widthPx(area: PreviewArea): number {
  return (area.width * RENDER.width) / 100;
}

describe("가독성 — 밴드가 실제 렌더에서 보인다", () => {
  it("desktop 밴드 슬롯이 3.3px → 최소 두께 이상으로 올라온다", () => {
    // 정규화 전: 60px / 1080 = 5.6% → 60px 높이 썸네일에서 3.3px (테두리 빼면 1~2px)
    const raw = derivePreviewAreas(LAYOUT_PRESETS["vertical-3"], "desktop");
    expect(heightPx(byName(raw, "header"))).toBeLessThan(4);

    const areas = normalizedAreas("vertical-3", "desktop");
    expect(heightPx(byName(areas, "header"))).toBeGreaterThanOrEqual(
      MIN_BAND_PX - 0.01,
    );
    expect(heightPx(byName(areas, "footer"))).toBeGreaterThanOrEqual(
      MIN_BAND_PX - 0.01,
    );
  });

  it("고정폭 사이드바도 최소 두께 이상이 된다", () => {
    const areas = normalizedAreas("sidebar-left", "desktop");
    expect(widthPx(byName(areas, "sidebar"))).toBeGreaterThanOrEqual(
      MIN_BAND_PX - 0.01,
    );
  });

  it("모든 프리셋 × 모든 breakpoint 의 슬롯이 2px 이상으로 그려진다", () => {
    for (const breakpoint of BREAKPOINTS) {
      for (const key of PRESET_ORDER) {
        for (const area of normalizedAreas(key, breakpoint)) {
          if (!area.isSlot) continue;
          // 구간이 많으면 최소치가 `100 / 구간 수` 로 낮아진다 — 그래도 선 한 줄(1~2px)은
          // 확실히 벗어나야 한다
          expect(
            Math.min(widthPx(area), heightPx(area)),
            `${key}/${breakpoint}/${area.name}`,
          ).toBeGreaterThan(2);
        }
      }
    }
  });

  it("mobile 에서 전체화면 / 수직 2단 / 수직 3단이 서로 구별된다", () => {
    // 정규화 전 세 프리셋의 밴드는 4.3px 로 사실상 동일한 회색 사각형이었다
    const bandCount = (key: string) =>
      normalizedAreas(key, "mobile").filter(
        (area) => area.isSlot && heightPx(area) < RENDER.height * 0.5,
      ).length;

    expect(bandCount("fullscreen")).toBe(0);
    expect(bandCount("vertical-2")).toBe(1);
    expect(bandCount("vertical-3")).toBe(2);
  });
});

describe("위상 보존 — 구조는 파생 결과와 같다", () => {
  it("슬롯 개수와 이름이 그대로다", () => {
    for (const breakpoint of BREAKPOINTS) {
      for (const key of PRESET_ORDER) {
        const raw = derivePreviewAreas(LAYOUT_PRESETS[key], breakpoint);
        const normalized = normalizeThumbnailAreas(raw, RENDER);
        expect(normalized.map((a) => a.name)).toEqual(raw.map((a) => a.name));
      }
    }
  });

  it("두 축 모두 0~100 을 그대로 덮는다", () => {
    for (const breakpoint of BREAKPOINTS) {
      for (const key of PRESET_ORDER) {
        const slots = normalizedAreas(key, breakpoint).filter((a) => a.isSlot);
        const label = `${key}/${breakpoint}`;

        expect(Math.min(...slots.map((a) => a.x)), label).toBeCloseTo(0, 6);
        expect(Math.min(...slots.map((a) => a.y)), label).toBeCloseTo(0, 6);
        expect(Math.max(...slots.map((a) => a.x + a.width)), label).toBeCloseTo(
          100,
          6,
        );
        expect(
          Math.max(...slots.map((a) => a.y + a.height)),
          label,
        ).toBeCloseTo(100, 6);
      }
    }
  });

  it("슬롯 간 순서가 뒤집히지 않는다", () => {
    for (const breakpoint of BREAKPOINTS) {
      for (const key of PRESET_ORDER) {
        const raw = derivePreviewAreas(LAYOUT_PRESETS[key], breakpoint).filter(
          (a) => a.isSlot,
        );
        const normalized = normalizeThumbnailAreas(raw, RENDER);

        for (let i = 0; i < raw.length; i += 1) {
          for (let j = 0; j < raw.length; j += 1) {
            const label = `${key}/${breakpoint} ${raw[i].name}→${raw[j].name}`;
            if (raw[i].x < raw[j].x) {
              expect(normalized[i].x, label).toBeLessThan(normalized[j].x);
            }
            if (raw[i].y < raw[j].y) {
              expect(normalized[i].y, label).toBeLessThan(normalized[j].y);
            }
          }
        }
      }
    }
  });

  it("격자 셀은 부모 슬롯 안에 남는다 (feed 4→2→1 열)", () => {
    for (const breakpoint of BREAKPOINTS) {
      const areas = normalizedAreas("feed", breakpoint);
      const feed = byName(areas, "feed");
      const cells = areas.filter((area) => !area.isSlot);

      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        const label = `${breakpoint}/${cell.name}`;
        expect(cell.x, label).toBeGreaterThanOrEqual(feed.x - 1e-6);
        expect(cell.y, label).toBeGreaterThanOrEqual(feed.y - 1e-6);
        expect(cell.x + cell.width, label).toBeLessThanOrEqual(
          feed.x + feed.width + 1e-6,
        );
        expect(cell.y + cell.height, label).toBeLessThanOrEqual(
          feed.y + feed.height + 1e-6,
        );
      }
    }
  });

  it("단조성 — 원래 큰 슬롯이 정규화 후에도 작아지지 않는다 (위계 보존)", () => {
    for (const breakpoint of BREAKPOINTS) {
      for (const key of PRESET_ORDER) {
        const raw = derivePreviewAreas(LAYOUT_PRESETS[key], breakpoint).filter(
          (a) => a.isSlot,
        );
        const normalized = normalizeThumbnailAreas(raw, RENDER);

        // 부동소수 noise (동일 트랙이 1e-15 차이로 갈리는 경우) 는 판정 대상이 아니다 —
        // 위계는 눈에 보이는 차이에 대한 주장이다
        const MEANINGFUL = 0.01;
        // 최소 두께가 렌더 크기를 다 쓰면 구간이 정확히 같아진다 (mobile holy-grail 5×12px
        // = 60px). 그 등호가 경계 누적 산술에서 1e-5 수준으로 흔들리는 것은 허용한다 —
        // 60px 기준 1e-4% 는 6e-5px 다.
        const EPS = 1e-4;

        for (let i = 0; i < raw.length; i += 1) {
          for (let j = 0; j < raw.length; j += 1) {
            const label = `${key}/${breakpoint} ${raw[i].name}↔${raw[j].name}`;
            if (raw[i].width > raw[j].width + MEANINGFUL) {
              expect(normalized[i].width, label).toBeGreaterThanOrEqual(
                normalized[j].width - EPS,
              );
            }
            if (raw[i].height > raw[j].height + MEANINGFUL) {
              expect(normalized[i].height, label).toBeGreaterThanOrEqual(
                normalized[j].height - EPS,
              );
            }
          }
        }
      }
    }
  });
});

describe("경계 조건", () => {
  it("슬롯이 하나면 항등 — 부풀릴 구간이 없다", () => {
    const areas = normalizedAreas("fullscreen", "desktop");
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("빈 입력은 빈 출력", () => {
    expect(normalizeThumbnailAreas([], RENDER)).toEqual([]);
  });

  it("렌더 크기가 0 이면 최소 두께가 0 — 원래 비율을 유지한다", () => {
    const raw = derivePreviewAreas(LAYOUT_PRESETS["vertical-3"], "desktop");
    const normalized = normalizeThumbnailAreas(raw, { width: 0, height: 0 });
    normalized.forEach((area, index) => {
      // 경계 왕복에서 오는 부동소수 오차만 허용
      expect(area.height).toBeCloseTo(raw[index].height, 9);
    });
  });
});

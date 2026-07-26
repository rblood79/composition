/**
 * PresetPreview 렌더 계약 (2026-07-26).
 *
 * 이 컴포넌트의 결함은 매번 **조용했다** — 그려지긴 하는데 아무 정보도 전달하지 않는 형태였다.
 * 그래서 "무엇이 어떤 시각 채널을 담당하는가" 를 렌더 결과로 고정한다:
 *
 * - 표현 = **선화**. 컴포넌트 패널 `.list-item-icon` 과 같은 색 패턴이다 (inset 표면 +
 *   `--fg-muted` 선). 채우기로 강조하려던 시도는 `--accent-subtle` 이 회색 wash 라 실패했다.
 * - required 강조 = **선 색** (`--accent`), 위계 = **선 두께** (슬롯 1.5 / 셀 1).
 * - 이름표 = **없음**. 12px 밴드에 들어가는 폰트가 없다. 슬롯 구성은 `<title>` 이 담당한다.
 * - 좌표계 = **px**. `viewBox` 정사각 + `preserveAspectRatio="none"` 조합은 선·모서리·글리프를
 *   비균등 왜곡시킨다.
 */

import { render } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { derivePreviewAreas } from "./derivePreviewAreas";
import { LAYOUT_PRESETS } from "./presetDefinitions";
import { PresetPreview } from "./PresetPreview";

const WIDTH = 80;
const HEIGHT = 60;

/** {@link RECT_INSET} 과 같은 값 — 선 두께(1.5)를 넘어야 마주보는 두 선이 붙지 않는다. */
const INSET = 1.5;

function renderPreset(presetKey: string, breakpoint = "desktop" as const) {
  const areas = derivePreviewAreas(LAYOUT_PRESETS[presetKey], breakpoint);
  const { container } = render(
    <PresetPreview areas={areas} width={WIDTH} height={HEIGHT} />,
  );

  const svg = container.querySelector("svg");
  if (!svg) throw new Error("svg not rendered");

  return { areas, svg, rects: [...svg.querySelectorAll("rect")] };
}

describe("선화 — 컴포넌트 패널 아이콘과 같은 색 패턴", () => {
  it("도형에 채우기가 없다", () => {
    for (const key of ["vertical-3", "feed", "holy-grail", "list-detail"]) {
      const { rects } = renderPreset(key);
      for (const rect of rects) {
        expect(rect.getAttribute("fill"), key).toBe("none");
      }
    }
  });

  it("기본 선 색은 currentColor — CSS 의 color 를 따른다", () => {
    const { rects, areas } = renderPreset("vertical-3");
    const notRequired = rects.filter((_, index) => !areas[index].required);

    expect(notRequired).toHaveLength(2); // header / footer
    for (const rect of notRequired) {
      expect(rect.getAttribute("stroke")).toBe("currentColor");
    }
  });

  it("CSS 가 inset 표면 + --fg-muted 선 색을 준다 (color 직접 선언 필수)", async () => {
    const css = await readFile(resolve(__dirname, "./styles.css"), "utf-8");
    const block = css.slice(css.indexOf(".preset-preview-svg {"));

    expect(block).toMatch(/background:\s*var\(--bg-inset\)/);
    // 상속에 맡기면 .list-item.applied 의 --fg-on-accent 가 흘러들어와 선이 사라진다
    expect(block).toMatch(/color:\s*var\(--fg-muted\)/);
  });
});

describe("required 강조는 선 색이 담당한다", () => {
  it("required 슬롯만 --accent (나머지 currentColor)", () => {
    const { areas, rects } = renderPreset("vertical-3");

    // header(false) / content(true) / footer(false) — 파생 순서 그대로
    expect(areas.map((area) => area.required)).toEqual([false, true, false]);
    expect(rects.map((rect) => rect.getAttribute("stroke"))).toEqual([
      "currentColor",
      "var(--accent)",
      "currentColor",
    ]);
  });

  it("required 슬롯이 여러 개면 모두 강조된다 (목록-상세)", () => {
    const { areas, rects } = renderPreset("list-detail");

    expect(areas.every((area) => area.required)).toBe(true);
    for (const rect of rects) {
      expect(rect.getAttribute("stroke")).toBe("var(--accent)");
    }
  });

  it("격자 셀은 강조 대상이 아니다 — 얇은 선 + 기본 색 (feed)", () => {
    const { areas, rects } = renderPreset("feed");
    const cellIndexes = areas
      .map((area, index) => (area.isSlot ? -1 : index))
      .filter((index) => index >= 0);

    expect(cellIndexes).toHaveLength(8); // desktop 4열 × 2행
    for (const index of cellIndexes) {
      expect(rects[index].getAttribute("stroke")).toBe("currentColor");
      expect(rects[index].getAttribute("stroke-width")).toBe("1");
    }
  });

  it("위계는 선 두께 — 슬롯 1.5 / 셀 1 (채우기가 없으므로)", () => {
    const { areas, rects } = renderPreset("feed");
    rects.forEach((rect, index) => {
      expect(rect.getAttribute("stroke-width")).toBe(
        areas[index].isSlot ? "1.5" : "1",
      );
    });
  });
});

describe("이름표 대신 title", () => {
  it("SVG 텍스트 요소가 없다", () => {
    for (const key of ["fullscreen", "feed", "holy-grail"]) {
      const { svg } = renderPreset(key);
      expect(svg.querySelectorAll("text"), key).toHaveLength(0);
    }
  });

  it("title 은 슬롯만 나열한다 — 셀 내부 id 는 새지 않는다", () => {
    const { svg } = renderPreset("feed");
    expect(svg.querySelector("title")?.textContent).toBe("header · feed");
  });

  it("role=img — 카드 접근 이름에 슬롯 구성이 실린다", () => {
    const { svg } = renderPreset("vertical-3");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.querySelector("title")?.textContent).toBe(
      "header · content · footer",
    );
  });
});

describe("px 좌표계 + 블록 분리", () => {
  it("viewBox 가 렌더 크기와 같고 preserveAspectRatio 왜곡이 없다", () => {
    const { svg } = renderPreset("holy-grail");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${WIDTH} ${HEIGHT}`);
    expect(svg.getAttribute("preserveAspectRatio")).toBeNull();
  });

  it("모든 사각형이 inset 만큼 물러나 뷰포트 안에 들어간다", () => {
    for (const key of [
      "vertical-3",
      "feed",
      "holy-grail",
      "dashboard-widgets",
    ]) {
      const { rects } = renderPreset(key);
      for (const rect of rects) {
        const x = Number(rect.getAttribute("x"));
        const y = Number(rect.getAttribute("y"));
        const w = Number(rect.getAttribute("width"));
        const h = Number(rect.getAttribute("height"));

        // 선이 경로 중심에 그려지므로 경계에 붙으면 절반이 잘린다
        expect(x, key).toBeGreaterThanOrEqual(INSET);
        expect(y, key).toBeGreaterThanOrEqual(INSET);
        expect(x + w, key).toBeLessThanOrEqual(WIDTH - INSET + 1e-6);
        expect(y + h, key).toBeLessThanOrEqual(HEIGHT - INSET + 1e-6);
      }
    }
  });
});

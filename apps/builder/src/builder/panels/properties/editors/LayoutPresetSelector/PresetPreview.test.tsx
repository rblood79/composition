/**
 * PresetPreview 렌더 계약 (2026-07-26).
 *
 * 이 컴포넌트의 결함은 두 번 모두 **조용했다** — 그려지긴 하는데 아무 정보도 전달하지 않는
 * 형태였다. 그래서 "무엇이 어떤 시각 채널을 담당하는가" 를 렌더 결과로 고정한다:
 *
 * - required 강조 = **테두리** (`--accent`). 배경 wash 단독으로 두면 builder 테마의
 *   `--accent-subtle` 이 `--bg-muted` 보다 밝아서 강조가 뒤집힌다.
 * - 이름표 = **없음**. 12px 밴드에 들어가는 폰트가 없다. 슬롯 구성은 `<title>` 이 담당한다.
 * - 좌표계 = **px**. `viewBox` 정사각 + `preserveAspectRatio="none"` 조합은 stroke·rx·글리프를
 *   비균등 왜곡시킨다.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { derivePreviewAreas } from "./derivePreviewAreas";
import { LAYOUT_PRESETS } from "./presetDefinitions";
import { PresetPreview } from "./PresetPreview";

const WIDTH = 80;
const HEIGHT = 60;

function renderPreset(presetKey: string, breakpoint = "desktop" as const) {
  const areas = derivePreviewAreas(LAYOUT_PRESETS[presetKey], breakpoint);
  const { container } = render(
    <PresetPreview areas={areas} width={WIDTH} height={HEIGHT} />,
  );

  const svg = container.querySelector("svg");
  if (!svg) throw new Error("svg not rendered");

  return { areas, svg, rects: [...svg.querySelectorAll("rect")] };
}

describe("required 강조는 테두리가 담당한다", () => {
  it("required 슬롯 테두리 --accent / 나머지 --border", () => {
    const { areas, rects } = renderPreset("vertical-3");

    // header(false) / content(true) / footer(false) — 파생 순서 그대로
    expect(areas.map((area) => area.required)).toEqual([false, true, false]);
    expect(rects.map((rect) => rect.getAttribute("stroke"))).toEqual([
      "var(--border)",
      "var(--accent)",
      "var(--border)",
    ]);
  });

  it("required 슬롯이 여러 개면 모두 강조된다 (목록-상세)", () => {
    const { areas, rects } = renderPreset("list-detail");

    expect(areas.every((area) => area.required)).toBe(true);
    for (const rect of rects) {
      expect(rect.getAttribute("stroke")).toBe("var(--accent)");
    }
  });

  it("강조가 배경 단독으로 표현되지 않는다 — accent 배경에는 accent 테두리가 붙는다", () => {
    for (const key of ["vertical-3", "feed", "holy-grail", "dashboard"]) {
      const { rects } = renderPreset(key);
      for (const rect of rects) {
        if (rect.getAttribute("fill") !== "var(--accent-subtle)") continue;
        expect(rect.getAttribute("stroke"), key).toBe("var(--accent)");
      }
    }
  });

  it("격자 셀은 강조 대상이 아니다 — 진한 표면 + 기본 테두리 (feed)", () => {
    const { areas, rects } = renderPreset("feed");
    const cellIndexes = areas
      .map((area, index) => (area.isSlot ? -1 : index))
      .filter((index) => index >= 0);

    expect(cellIndexes).toHaveLength(8); // desktop 4열 × 2행
    for (const index of cellIndexes) {
      expect(rects[index].getAttribute("fill")).toBe("var(--bg-emphasis)");
      expect(rects[index].getAttribute("stroke")).toBe("var(--border)");
    }
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

        // 테두리가 경로 중심에 그려지므로 경계에 붙으면 절반이 잘린다
        expect(x, key).toBeGreaterThanOrEqual(1);
        expect(y, key).toBeGreaterThanOrEqual(1);
        expect(x + w, key).toBeLessThanOrEqual(WIDTH - 1 + 1e-6);
        expect(y + h, key).toBeLessThanOrEqual(HEIGHT - 1 + 1e-6);
      }
    }
  });
});

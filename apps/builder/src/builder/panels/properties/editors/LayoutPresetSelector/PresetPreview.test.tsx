/**
 * PresetPreview 렌더 계약 (2026-07-27).
 *
 * 이 컴포넌트의 결함은 매번 **조용했다** — 그려지긴 하는데 아무 정보도 전달하지 않는 형태였다.
 * 그래서 "무엇이 어떤 시각 채널을 담당하는가" 를 렌더 결과로 고정한다:
 *
 * - 슬롯 = **면** (`--bg-muted`), 격자 셀 = **선** (`currentColor`). 슬롯은 배치를 읽는 단위,
 *   셀은 그 안에 놓일 자리다.
 * - required 강조 = **면 색 한 단계** (`--bg-emphasis`). 표면 대비가 커지는 방향으로만 준다 —
 *   `--accent-subtle` 은 `--bg-muted` 보다 밝아 강조가 뒤집혔던 전례가 있다.
 * - 표면·색은 컴포넌트 패널 `.list-item-icon` 패턴 (`--bg-inset` + `color: --fg-muted`,
 *   바깥 테두리 없음).
 * - 이름표 = **없음**. 12px 밴드에 들어가는 폰트가 없다. 슬롯 구성은 `<title>` 이 담당한다.
 * - 좌표계 = **px**. `viewBox` 정사각 + `preserveAspectRatio="none"` 조합은 도형·글리프를
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

/** {@link RECT_INSET} 과 같은 값 — 마주보는 두 변이 각자 물러나 실제 틈은 2배다. */
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

/** `.preset-preview-svg` 규칙 본문만 잘라낸다 — 파일 끝까지 slice 하면 뒤 규칙이 섞인다. */
async function readPreviewRule(): Promise<string> {
  const css = await readFile(resolve(__dirname, "./styles.css"), "utf-8");
  const start = css.indexOf(".preset-preview-svg {");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("슬롯은 면, 격자 셀은 선", () => {
  it("슬롯은 채움 + 테두리 없음", () => {
    for (const key of ["vertical-3", "holy-grail", "list-detail"]) {
      const { areas, rects } = renderPreset(key);
      rects.forEach((rect, index) => {
        if (!areas[index].isSlot) return;
        expect(rect.getAttribute("fill"), key).toMatch(/^var\(--bg-/);
        expect(rect.getAttribute("stroke"), key).toBe("transparent");
      });
    }
  });

  it("격자 셀은 채움 없음 + currentColor 윤곽 (feed 4열 × 2행)", () => {
    const { areas, rects } = renderPreset("feed");
    const cellIndexes = areas
      .map((area, index) => (area.isSlot ? -1 : index))
      .filter((index) => index >= 0);

    expect(cellIndexes).toHaveLength(8);
    for (const index of cellIndexes) {
      expect(rects[index].getAttribute("fill")).toBe("none");
      // 색은 CSS 의 color 를 따른다 — 아이콘이 컨테이너 color 를 받는 방식과 동일
      expect(rects[index].getAttribute("stroke")).toBe("currentColor");
    }
  });

  it("CSS 가 inset 표면 + --fg-muted 선 색을 준다 (color 직접 선언 필수)", async () => {
    const block = await readPreviewRule();

    expect(block).toMatch(/background:\s*var\(--bg-inset\)/);
    // 상속에 맡기면 .list-item.applied 의 --fg-on-accent 가 흘러들어와 셀 윤곽이 사라진다
    expect(block).toMatch(/color:\s*var\(--fg-muted\)/);
  });

  it("바깥 테두리는 없다 — 슬롯 면과 이중선이 되고 뷰포트를 78×58 로 줄인다", async () => {
    const block = await readPreviewRule();

    // `border-radius` 는 남긴다 (표면 모서리) — shorthand `border` 만 금지
    expect(block).not.toMatch(/^\s*border:/m);
    expect(block).toMatch(/border-radius:\s*var\(--radius-sm\)/);
  });
});

describe("required 강조는 면 색이 담당한다", () => {
  it("required 슬롯만 --bg-emphasis (나머지 --bg-muted)", () => {
    const { areas, rects } = renderPreset("vertical-3");

    // header(false) / content(true) / footer(false) — 파생 순서 그대로
    expect(areas.map((area) => area.required)).toEqual([false, true, false]);
    expect(rects.map((rect) => rect.getAttribute("fill"))).toEqual([
      "var(--bg-muted)",
      "var(--bg-emphasis)",
      "var(--bg-muted)",
    ]);
  });

  it("required 슬롯이 여러 개면 모두 강조된다 (목록-상세)", () => {
    const { areas, rects } = renderPreset("list-detail");

    expect(areas.every((area) => area.required)).toBe(true);
    for (const rect of rects) {
      expect(rect.getAttribute("fill")).toBe("var(--bg-emphasis)");
    }
  });

  it("강조는 표면 대비가 커지는 방향 — --accent-subtle 재도입 금지", () => {
    // `--accent-subtle` 은 builder 에서 회색 wash 라 `--bg-muted` 보다 밝다 → 강조가 뒤집힌다
    for (const key of ["vertical-3", "feed", "holy-grail", "dashboard"]) {
      const { rects } = renderPreset(key);
      for (const rect of rects) {
        expect(rect.getAttribute("fill"), key).not.toBe("var(--accent-subtle)");
      }
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

        expect(x, key).toBeGreaterThanOrEqual(INSET);
        expect(y, key).toBeGreaterThanOrEqual(INSET);
        expect(x + w, key).toBeLessThanOrEqual(WIDTH - INSET + 1e-6);
        expect(y + h, key).toBeLessThanOrEqual(HEIGHT - INSET + 1e-6);
      }
    }
  });
});

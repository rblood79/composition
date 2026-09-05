/**
 * ADR-205 Phase 2 — 텍스트 시각 축 대칭 게이트 (G4).
 *
 * 두 축을 같이 본다.
 *
 * ① **집합 대조** — 격차표(`docs/adr/evidence/205-text-axis-gap-matrix.md`)가 코드와 어긋나면
 *    RED. 속성 집합의 출처는 손 목록이 아니라 코드 2곳의 합집합이다 (ADR-205 R4).
 * ② **도달 검사** — seam 이 선언한 축마다, 그 값이 두 소비자(layout wrap leg · Skia 텍스트
 *    노드)에 **실제로 실리는지** 를 값 수준에서 확인한다. 필드는 있는데 표면에 안 닿는
 *    형태(F15)를 집합 대조만으로는 못 잡기 때문이다.
 *
 * 축을 늘리면 `AXIS_REACH_CASES` 에 케이스를 넣어야 통과한다 — 그것이 이 게이트의 forcing
 * function 이다. "결선했다" 를 배선 방식으로 재면 배선을 바꾸는 순간 가짜 결손이 나므로
 * (Phase 1 실측, evidence §5), 여기서는 **값이 실렸는지**만 본다.
 */

import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ComputedLayout } from "../../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "../../skia/nodeRendererTypes";
import { buildSpecNodeData } from "../../skia/buildSpecNodeData";
import {
  getTextMeasurer,
  measureWrappedTextHeight,
  setTextMeasurer,
  type TextMeasureStyle,
} from "../textMeasure";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const GENERATOR = join(ROOT, "scripts/generate-text-axis-matrix.mjs");

/**
 * 축마다의 도달 케이스. **키 집합이 seam 축 집합과 같아야 한다** — 축을 늘리면서
 * 여기를 비우면 RED 다.
 */
const AXIS_REACH_CASES: Record<
  string,
  {
    /** 인라인 style 로 주는 값 */
    inline: unknown;
    /** 두 소비자에 실려야 하는 해소값 */
    expected: number;
    /** Skia 텍스트 노드의 대응 필드 */
    skiaField: keyof NonNullable<SkiaNodeData["text"]>;
    /**
     * 그 축의 값을 wrap leg 진입점에 싣는 호출. 축마다 인자 자리가 달라
     * (fontSize 는 2번째, letterSpacing 은 9번째) 호출 자체를 케이스가 들고 있다.
     */
    callWrapLeg: (value: number) => void;
  }
> = {
  letterSpacing: {
    inline: "3px",
    expected: 3,
    skiaField: "letterSpacing",
    callWrapLeg: (v) =>
      measureWrappedTextHeight(
        "ab cd",
        16,
        400,
        "Pretendard",
        100,
        24,
        undefined,
        undefined,
        v,
      ),
  },
  fontSize: {
    inline: "23px",
    expected: 23,
    skiaField: "fontSize",
    callWrapLeg: (v) =>
      measureWrappedTextHeight("ab cd", v, 400, "Pretendard", 100, 24),
  },
};

function makeTextElement(style: Record<string, unknown>): CanvasSceneNode {
  return {
    id: "axis-gate-label",
    type: "Label",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: { children: "Hello", style },
  } as unknown as CanvasSceneNode;
}

function firstText(
  node: SkiaNodeData | null | undefined,
): SkiaNodeData["text"] | undefined {
  if (!node) return undefined;
  if (node.type === "text" && node.text) return node.text;
  for (const child of node.children ?? []) {
    const found = firstText(child);
    if (found) return found;
  }
  return undefined;
}

describe("ADR-205 G4 — 텍스트 시각 축 대칭 게이트", () => {
  const original = getTextMeasurer();
  afterEach(() => setTextMeasurer(original));

  it("① 격차표가 코드와 어긋나지 않는다", () => {
    // 실패하면 `node scripts/generate-text-axis-matrix.mjs` 후 커밋.
    expect(() =>
      execFileSync("node", [GENERATOR, "--check"], { cwd: ROOT }),
    ).not.toThrow();
  });

  it("② seam 축마다 도달 케이스가 있다 — 축을 늘리면 여기가 먼저 RED", async () => {
    const { seamAxes, readSeamSource } = await import(
      pathToFileURL(GENERATOR).href
    );
    const axes = [...seamAxes(readSeamSource())].sort();
    expect(Object.keys(AXIS_REACH_CASES).sort()).toEqual(axes);
  });

  for (const [axis, spec] of Object.entries(AXIS_REACH_CASES)) {
    it(`② ${axis} — layout wrap leg 이 값을 받는다`, () => {
      let seen: TextMeasureStyle | undefined;
      setTextMeasurer({
        measureWidth: () => 0,
        measureWrapped: (_t, style) => {
          seen = style;
          return { width: 0, height: 0 };
        },
      });
      spec.callWrapLeg(spec.expected);
      expect(seen?.[axis as keyof TextMeasureStyle]).toBe(spec.expected);
    });

    it(`② ${axis} — Skia 텍스트 노드가 인라인 값을 받는다`, () => {
      const element = makeTextElement({ [axis]: spec.inline });
      const text = firstText(
        buildSpecNodeData({
          element,
          layout: { x: 0, y: 0, width: 200, height: 24 } as ComputedLayout,
          theme: "light",
          elementsMap: new Map([[element.id, element]]),
        }),
      );
      expect(text?.[spec.skiaField]).toBe(spec.expected);
    });
  }
});

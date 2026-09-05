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
import { readFileSync } from "node:fs";
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

  /**
   * ③ 상속 채널 (Phase 5) — scene build 는 `ComputedStyle` 을 쥔 적이 없어서(F20)
   * 상속분을 `layout.textAxes` 로 받는다. 조상이 **선언한** 축만 실린다는 계약이라
   * 두 방향을 같이 본다: 선언이 있으면 실리고, 없으면 catalog 기본을 덮지 않는다.
   */
  describe("③ 상속 채널 — layout.textAxes", () => {
    const build = (
      style: Record<string, unknown>,
      textAxes?: { letterSpacing?: number },
    ) => {
      const element = makeTextElement(style);
      return firstText(
        buildSpecNodeData({
          element,
          layout: {
            x: 0,
            y: 0,
            width: 200,
            height: 24,
            ...(textAxes ? { textAxes } : {}),
          } as ComputedLayout,
          theme: "light",
          elementsMap: new Map([[element.id, element]]),
        }),
      );
    };

    it("조상이 선언한 letterSpacing 이 Skia 텍스트 노드에 실린다", () => {
      expect(build({}, { letterSpacing: 4 })?.letterSpacing).toBe(4);
    });

    it("인라인이 상속을 이긴다 (CSS 와 같은 순서)", () => {
      expect(
        build({ letterSpacing: "7px" }, { letterSpacing: 4 })?.letterSpacing,
      ).toBe(7);
    });

    it("아무도 선언하지 않으면 축을 쓰지 않는다 — catalog 기본 보존 (R6)", () => {
      expect(build({})?.letterSpacing).toBeUndefined();
    });
  });

  /**
   * ④ **상속이 catalog 기본을 이겨도 되는 축인지** — Phase 5 의 전제를 지킨다.
   *
   * Preview 에서 상속은 **가장 약한 채널**이다. 컴포넌트 CSS 가 그 속성을 선언하면
   * 선언이 상속을 이긴다 (측정 2026-09-05, 부모 `font-size:23px` 아래에서
   * `.react-aria-Text` 16px · `.react-aria-Label` 14px · `.react-aria-Button` 14px,
   * 클래스 없는 요소만 23px). 그래서 `fontSize` 는 상속 운반 대상이 **아니다** —
   * 운반하면 catalog 선언을 상속이 덮어 Preview 와 갈린다.
   *
   * `letterSpacing` 을 운반해도 되는 근거는 **어떤 컴포넌트 CSS 도 letter-spacing 을
   * 선언하지 않는다**는 사실 하나다 (토큰 정의만 있다). 그 사실이 바뀌면 이 게이트가
   * 먼저 깨진다 — 그때는 운반 대상에서 빼거나 우선순위를 다시 정해야 한다.
   */
  it("④ 상속 운반 축을 선언하는 컴포넌트 CSS 가 없다 (Phase 5 전제)", () => {
    const carried = readCarriedInheritedAxes();
    expect(carried.length).toBeGreaterThan(0);

    const cssDir = join(ROOT, "packages/shared/src/components/styles");
    const files = execFileSync("bash", ["-c", `find ${cssDir} -name '*.css'`], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    // 선언 탐지는 JS 로 한다 — shell 정규식의 줄머리 앵커에 의존하면 한 줄로 쓴
    // 규칙(`.x { letter-spacing: 1px }`)을 놓쳐 게이트가 조용히 vacuous 해진다
    // (실측: 그 형태로 원복 RED 를 넣었더니 통과했다).
    const declared: string[] = [];
    for (const axis of carried) {
      const prop = cssProp(axis);
      // `--letter-spacing-*` 같은 **토큰 정의**는 선언이 아니다 — 앞에 `-` 가 붙는다.
      const re = new RegExp(`(^|[^-\\w])${prop}\\s*:`, "g");
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        if (re.test(text)) declared.push(`${prop} @ ${file.replace(ROOT, "")}`);
        re.lastIndex = 0;
      }
    }

    expect(declared).toEqual([]);
  });
});

/** camelCase 축 → CSS 속성명. */
function cssProp(axis: string): string {
  return axis.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * 레이아웃이 `ComputedLayout.textAxes` 로 **실어 보내는** 축. 타입에 선언된 것이 아니라
 * 실제로 누적하는 축만 센다 — 타입은 두 축을 담을 수 있지만 Phase 5 는 하나만 싣는다.
 */
function readCarriedInheritedAxes(): string[] {
  const src = readFileSync(
    join(
      ROOT,
      "apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts",
    ),
    "utf8",
  );
  const region = src.slice(
    src.indexOf("const ownTextAxes = resolveTextRenderStyle"),
  );
  const block = region.slice(
    0,
    region.indexOf("inheritedTextAxes.set(elementId"),
  );
  return [...block.matchAll(/\{ \.\.\.parentTextAxes, ([A-Za-z][\w]*):/g)].map(
    (m) => m[1],
  );
}

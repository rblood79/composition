/**
 * Spectrum guideline 수치 채택 (design-data 감사 §1-4, 2026-08-21) —
 * catalog sizes.minWidth/maxWidth → implicitStyles 주입 → 엔진 min/max_width clamp 계약.
 *
 * 대상:
 *   - SearchField: minWidth = 3×height (sm 66 / md 90 / lg 126 / xl 162)
 *   - ProgressBar: minWidth 48 / maxWidth 768 (전 size 동일)
 *
 * DOM 대응물은 generated CSS `min-width`/`max-width` (같은 catalog 값) — D3 symmetric.
 * 사용자 명시값(0 포함, `??` 판정) 우선. catalog 미정의 tag 는 미주입.
 */

import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

function makeChild(
  id: string,
  type: string,
  style?: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props: { style: style ?? {} },
    childrenIds: [],
  } as Element;
}

function apply(
  container: Element,
  children: Element[],
): ReturnType<typeof applyImplicitStyles> {
  const byId = new Map<string, Element>([
    [container.id, container],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(
    container,
    children,
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((cid: string) => byId.get(cid)!) ?? [],
    byId,
  );
}

function rootStyle(
  r: ReturnType<typeof applyImplicitStyles>,
): Record<string, unknown> {
  return (r.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("SearchField minWidth — Spectrum 3×height (2026-08-21)", () => {
  const label = makeChild("lbl", "Label");
  const trigger = makeChild("trg", "SelectTrigger");

  function makeSearchField(props: Record<string, unknown>): Element {
    return {
      id: "sf-1",
      type: "SearchField",
      props: { label: "Search", ...props },
      childrenIds: [label.id, trigger.id],
    } as Element;
  }

  it("md (기본) → catalog sizes.md.minWidth=90 주입", () => {
    const ps = rootStyle(apply(makeSearchField({}), [label, trigger]));
    expect(ps.minWidth).toBe(90);
  });

  it("size 축 스케일 — sm=66 / xl=162", () => {
    expect(
      rootStyle(apply(makeSearchField({ size: "sm" }), [label, trigger]))
        .minWidth,
    ).toBe(66);
    expect(
      rootStyle(apply(makeSearchField({ size: "xl" }), [label, trigger]))
        .minWidth,
    ).toBe(162);
  });

  it("사용자 명시 minWidth(0 포함) 우선", () => {
    const ps = rootStyle(
      apply(makeSearchField({ style: { minWidth: 0 } }), [label, trigger]),
    );
    expect(ps.minWidth).toBe(0);
  });

  it("같은 분기의 ComboBox 는 catalog minWidth 미정의 → 미주입", () => {
    const cb: Element = {
      id: "cb-1",
      type: "ComboBox",
      props: { label: "Pick" },
      childrenIds: [label.id, trigger.id],
    } as Element;
    const ps = rootStyle(apply(cb, [label, trigger]));
    expect(ps.minWidth).toBeUndefined();
  });
});

describe("ProgressBar min/maxWidth — Spectrum 48~768 (2026-08-21)", () => {
  const label = makeChild("plbl", "Label");
  const value = makeChild("pval", "ProgressBarValue");
  const track = makeChild("ptrk", "ProgressBarTrack");

  function makeProgressBar(props: Record<string, unknown>): Element {
    return {
      id: "pb-1",
      type: "ProgressBar",
      props: { label: "Loading", value: 30, ...props },
      childrenIds: [label.id, value.id, track.id],
    } as Element;
  }

  it("md (기본) → minWidth 48 + maxWidth 768 주입", () => {
    const ps = rootStyle(apply(makeProgressBar({}), [label, value, track]));
    expect(ps.minWidth).toBe(48);
    expect(ps.maxWidth).toBe(768);
  });

  it("전 size 동일값 — sm/xl 도 48~768", () => {
    for (const size of ["sm", "xl"]) {
      const ps = rootStyle(
        apply(makeProgressBar({ size }), [label, value, track]),
      );
      expect(ps.minWidth).toBe(48);
      expect(ps.maxWidth).toBe(768);
    }
  });

  it("사용자 명시 maxWidth 우선 — 주입이 덮지 않음", () => {
    const ps = rootStyle(
      apply(makeProgressBar({ style: { maxWidth: 200 } }), [
        label,
        value,
        track,
      ]),
    );
    expect(ps.maxWidth).toBe(200);
    expect(ps.minWidth).toBe(48);
  });

  it("catalog 미등록 alias tag(gauge) → min/max 미주입 (기존 gap 경로만)", () => {
    const g: Element = {
      id: "g-1",
      type: "Gauge",
      props: { label: "G", value: 10 },
      childrenIds: [label.id, value.id, track.id],
    } as Element;
    const ps = rootStyle(apply(g, [label, value, track]));
    expect(ps.minWidth).toBeUndefined();
    expect(ps.maxWidth).toBeUndefined();
  });
});

describe("Tooltip maxWidth — Spectrum 스키마 160 (2026-08-21)", () => {
  const desc = makeChild("tdesc", "Description");

  function makeTooltip(props: Record<string, unknown>): Element {
    return {
      id: "tt-1",
      type: "Tooltip",
      props: { children: "hint", ...props },
      childrenIds: [desc.id],
    } as Element;
  }

  it("md (기본) → maxWidth 160 + width fit-content 주입 (DOM inline-flex shrink-wrap 대칭)", () => {
    const ps = rootStyle(apply(makeTooltip({}), [desc]));
    expect(ps.maxWidth).toBe(160);
    expect(ps.width).toBe("fit-content");
  });

  it("사용자 명시 width/maxWidth 우선", () => {
    const ps = rootStyle(
      apply(makeTooltip({ style: { width: 200, maxWidth: 300 } }), [desc]),
    );
    expect(ps.width).toBe(200);
    expect(ps.maxWidth).toBe(300);
  });
});

describe("Separator 두께 축 — Spectrum divider S1/M2/L4 (2026-08-21)", () => {
  function makeSeparator(props: Record<string, unknown>): Element {
    return {
      id: "sep-1",
      type: "Separator",
      props,
      childrenIds: [],
    } as Element;
  }

  it("catalog sizes.height 가 두께 단계 — sm1/md2/lg4 (엔진 L3 size 축 주입 + Skia divider 두께 공용)", () => {
    for (const [size, h] of [
      ["sm", 1],
      ["md", 2],
      ["lg", 4],
    ] as const) {
      const ps = rootStyle(apply(makeSeparator({ size }), []));
      expect(ps.height).toBe(h);
    }
  });
});

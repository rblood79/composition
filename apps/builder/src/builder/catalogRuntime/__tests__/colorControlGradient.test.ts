import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ColorArea,
  ColorSlider,
  ColorThumb,
  SliderTrack,
  parseColor,
} from "react-aria-components";
import { describe, expect, it } from "vitest";
import {
  catalogColorControlProps,
  catalogColorControlPropsError,
  catalogColorKey,
  isRacColorString,
  normalizeColorControlPatch,
  colorAreaGradient,
  colorAreaGradientCss,
  colorControlThumb,
  colorGradientLayerCss,
  colorSliderGradient,
  colorSliderText,
  colorWheelGradientCss,
} from "../../../../../../packages/shared/src/catalog/runtime/colorControlGradient";
import oracleJson from "../../../../tests/fixtures/adr258-rac-gradient.json";

/**
 * ADR-258 G1 — the shared function against the installed RAC's own output. The oracle file is
 * written by `scripts/adr258-rac-gradient-oracle.mjs` from RAC's `renderToStaticMarkup` (never
 * from this function). Every row: the inline `background` (whitespace-normalized), the thumb's
 * `left` / `top` / `background-color`, and the ColorSlider Label · SliderOutput text RAC writes.
 */
type Row = {
  props: Record<string, unknown>;
  error?: string;
  background?: string | null;
  backgroundBlendMode?: string | null;
  thumb?: { left?: string; top?: string; backgroundColor?: string };
  text?: Record<string, { label: string | null; output: string | null }>;
  track?: { background: string | null; width: string; height: string };
};
const oracle = oracleJson as unknown as {
  versions: Record<string, string>;
  area: Row[];
  slider: Row[];
  wheel: Row[];
};

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim();
const pct = (f: number | undefined) =>
  f === undefined ? undefined : `${f * 100}%`;

describe("ADR-258 G1 — colorControlGradient = installed RAC", () => {
  it("is pinned to the RAC the oracle was taken from", () => {
    expect(oracle.versions["react-aria-components"]).toBe("1.21.0");
    expect(oracle.area.length).toBeGreaterThan(150);
    expect(oracle.slider.length).toBeGreaterThan(200);
  });

  it("ColorArea: background · blend · thumb, every row", () => {
    const misses: unknown[] = [];
    for (const row of oracle.area) {
      const css = colorAreaGradientCss(colorAreaGradient(row.props));
      const thumb = colorControlThumb("ColorArea", row.props);
      const got = {
        background: norm(css.background),
        blend: css.backgroundBlendMode ?? null,
        left: thumb.kind === "fraction" ? pct(thumb.x) : undefined,
        top: thumb.kind === "fraction" ? pct(thumb.y) : undefined,
        color: thumb.color,
      };
      const want = {
        background: norm(row.background),
        blend: row.backgroundBlendMode ?? null,
        left: row.thumb?.left,
        top: row.thumb?.top,
        color: row.thumb?.backgroundColor,
      };
      if (JSON.stringify(got) !== JSON.stringify(want))
        misses.push({ props: row.props, got, want });
    }
    expect(misses).toEqual([]);
  });

  it("ColorSlider: track background · thumb · Label · SliderOutput text (en-US · ko-KR), every row", () => {
    const misses: unknown[] = [];
    for (const row of oracle.slider) {
      if (row.error) continue;
      const thumb = colorControlThumb("ColorSlider", row.props);
      const got = {
        background: norm(colorGradientLayerCss(colorSliderGradient(row.props))),
        left: thumb.kind === "fraction" ? pct(thumb.x) : undefined,
        top: thumb.kind === "fraction" ? pct(thumb.y) : undefined,
        color: thumb.color,
        text: Object.fromEntries(
          ["en-US", "ko-KR"].map((locale) => [
            locale,
            colorSliderText(row.props, locale),
          ]),
        ),
      };
      const want = {
        background: norm(row.background),
        left: row.thumb?.left,
        top: row.thumb?.top,
        color: row.thumb?.backgroundColor,
        text: Object.fromEntries(
          ["en-US", "ko-KR"].map((locale) => [
            locale,
            {
              label: row.text?.[locale]?.label,
              output: row.text?.[locale]?.output,
            },
          ]),
        ),
      };
      if (JSON.stringify(got) !== JSON.stringify(want))
        misses.push({ props: row.props, got, want });
    }
    expect(misses).toEqual([]);
  });

  it("ColorSlider without a value: RAC throws — the binding default gives one", () => {
    const row = oracle.slider.find((r) => r.error);
    expect(row?.error).toMatch(/requires a value or defaultValue/);
    expect(catalogColorControlProps("ColorSlider", {})).toEqual({
      defaultValue: "hsl(0, 100%, 50%)",
      channel: "hue",
    });
  });

  it("ColorWheel: track conic gradient · thumb px · color, every row", () => {
    const misses: unknown[] = [];
    for (const row of oracle.wheel) {
      const radii = {
        outerRadius: row.props.outerRadius as number,
        innerRadius: row.props.innerRadius as number,
      };
      const thumb = colorControlThumb("ColorWheel", row.props, radii);
      const got = {
        background: norm(colorWheelGradientCss()),
        left: thumb.kind === "px" ? `${thumb.x.toFixed(3)}px` : undefined,
        top: thumb.kind === "px" ? `${thumb.y.toFixed(3)}px` : undefined,
        color: thumb.color,
      };
      const want = {
        background: norm(row.track?.background),
        left: row.thumb?.left,
        top: row.thumb?.top,
        color: row.thumb?.backgroundColor,
      };
      if (JSON.stringify(got) !== JSON.stringify(want))
        misses.push({ props: row.props, got, want });
    }
    expect(misses).toEqual([]);
  });
});

describe("ADR-258 G1 — racColor syntax = installed parseColor", () => {
  const ACCEPT = [
    "#f00",
    "#f008",
    "#ff0000",
    "#ff000080",
    "rgb(255, 0, 0)",
    "rgba(255, 0, 0, 0.5)",
    "hsl(120, 50%, 40%)",
    "hsla(120, 50%, 40%, 0.5)",
    "hsb(300, 100%, 100%)",
    "hsba(300, 100%, 100%, 0.2)",
  ];
  const REFUSE = [
    "red",
    "rgb(255 0 0)",
    "oklch(0.6 0.1 30)",
    "#ff",
    "rgb()",
    "hsl(12",
    "",
    " ",
    "transparent",
  ];
  it("accepts exactly what parseColor parses", () => {
    const rows = [...ACCEPT, ...REFUSE].map((value) => {
      let parses = true;
      try {
        parseColor(value);
      } catch {
        parses = false;
      }
      return { value, parses, judged: isRacColorString(value) };
    });
    expect(rows.filter((r) => r.parses !== r.judged)).toEqual([]);
    expect(rows.filter((r) => r.judged).map((r) => r.value)).toEqual(ACCEPT);
    expect(isRacColorString(12)).toBe(false);
    expect(isRacColorString(undefined)).toBe(false);
  });
});

describe("ADR-258 G1 — normalizeColorControlPatch: every result renders in RAC", () => {
  const SPACES = [undefined, "rgb", "hsl", "hsb"] as const;
  const CHANNELS = [
    "hue",
    "saturation",
    "brightness",
    "lightness",
    "red",
    "green",
    "blue",
    "alpha",
  ] as const;
  const VALUES = ["#8040c0", "hsl(0, 100%, 50%)", "hsb(200, 50%, 50%)"];
  const sliderRenders = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(
        ColorSlider,
        catalogColorControlProps("ColorSlider", props) as {
          defaultValue: string;
          channel: "hue";
        },
        createElement(SliderTrack, null, createElement(ColorThumb)),
      ),
    );
  const areaRenders = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(
        ColorArea,
        { ...(props as object) },
        createElement(ColorThumb),
      ),
    );

  it("ColorSlider: (start valid combination) × (patch colorSpace | channel | defaultValue) → valid · RAC renders", () => {
    const failures: unknown[] = [];
    for (const defaultValue of VALUES) {
      for (const colorSpace of SPACES) {
        for (const channel of CHANNELS) {
          const start = { defaultValue, colorSpace, channel };
          if (catalogColorControlPropsError("ColorSlider", start)) continue;
          const patches: Record<string, unknown>[] = [
            ...SPACES.map((s) => ({ colorSpace: s })),
            ...CHANNELS.map((c) => ({ channel: c })),
            ...VALUES.map((v) => ({ defaultValue: v })),
          ];
          for (const patch of patches) {
            const out = normalizeColorControlPatch("ColorSlider", start, patch);
            const next = { ...start, ...out };
            const error = catalogColorControlPropsError("ColorSlider", next);
            let threw: string | null = null;
            try {
              // The raw stored props (no fallback) go to RAC.
              renderToStaticMarkup(
                createElement(
                  ColorSlider,
                  {
                    defaultValue: next.defaultValue as string,
                    ...(next.colorSpace
                      ? { colorSpace: next.colorSpace as never }
                      : {}),
                    channel: (next.channel ?? "hue") as never,
                  },
                  createElement(SliderTrack, null, createElement(ColorThumb)),
                ),
              );
            } catch (e) {
              threw = String(e);
            }
            if (error || threw)
              failures.push({ start, patch, out, error, threw });
            // A picked channel is kept (the space follows it).
            if ("channel" in patch && out.channel !== patch.channel)
              failures.push({ start, patch, out, lost: "channel" });
          }
          void sliderRenders(start);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("ColorArea: axes × spaces → valid · RAC renders; a picked axis is kept", () => {
    const failures: unknown[] = [];
    const AXES = [undefined, ...CHANNELS.filter((c) => c !== "alpha")];
    for (const defaultValue of VALUES) {
      for (const colorSpace of SPACES) {
        for (const xChannel of AXES) {
          for (const yChannel of AXES) {
            const start = { defaultValue, colorSpace, xChannel, yChannel };
            if (catalogColorControlPropsError("ColorArea", start)) continue;
            const patches: Record<string, unknown>[] = [
              ...SPACES.map((s) => ({ colorSpace: s })),
              ...AXES.map((c) => ({ xChannel: c })),
              ...AXES.map((c) => ({ yChannel: c })),
              ...VALUES.map((v) => ({ defaultValue: v })),
            ];
            for (const patch of patches) {
              const out = normalizeColorControlPatch("ColorArea", start, patch);
              const next = Object.fromEntries(
                Object.entries({ ...start, ...out }).filter(
                  ([, v]) => v !== undefined,
                ),
              );
              const error = catalogColorControlPropsError("ColorArea", next);
              let threw: string | null = null;
              try {
                areaRenders(next);
              } catch (e) {
                threw = String(e);
              }
              if (error || threw)
                failures.push({ start, patch, out, error, threw });
              for (const axis of ["xChannel", "yChannel"] as const)
                if (
                  axis in patch &&
                  patch[axis] !== undefined &&
                  out[axis] !== patch[axis]
                )
                  failures.push({ start, patch, out, lost: axis });
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("hsl · hue ColorSlider → channel red: colorSpace rgb in the same patch (R4)", () => {
    expect(
      normalizeColorControlPatch(
        "ColorSlider",
        { defaultValue: "hsl(0, 100%, 50%)", channel: "hue" },
        { channel: "red" },
      ),
    ).toEqual({ channel: "red", colorSpace: "rgb" });
  });

  it("a defaultValue that moves the space keeps the previous one", () => {
    expect(
      normalizeColorControlPatch(
        "ColorSlider",
        { defaultValue: "hsl(0, 100%, 50%)", channel: "lightness" },
        { defaultValue: "#ff0000" },
      ),
    ).toEqual({ defaultValue: "#ff0000", colorSpace: "hsl" });
  });
});

describe("ADR-258 G1 — catalogColorKey keeps the channels (Decision 7)", () => {
  const key = (v: string) => catalogColorKey("ColorSlider", v);
  it("achromatic hue · fraction · alpha · space differences are different keys", () => {
    expect(key("hsl(0, 0%, 50%)")).not.toBe(key("hsl(120, 0%, 50%)"));
    expect(key("hsl(10, 50%, 50%)")).not.toBe(key("hsl(10.5, 50%, 50%)"));
    expect(key("hsla(10, 50%, 50%, 1)")).not.toBe(
      key("hsla(10, 50%, 50%, 0.5)"),
    );
    expect(key("#ff0000")).not.toBe(key("hsl(0, 100%, 50%)"));
    expect(key("hsl(0, 100%, 50%)")).not.toBe(key("hsb(0, 100%, 100%)"));
  });
  it("two spellings of the same numbers share a key", () => {
    expect(key("#f00")).toBe(key("#ff0000"));
    expect(key("rgb(255, 0, 0)")).toBe(key("#ff0000"));
    expect(key("hsl(120, 0%, 50%)")).toBe(key("hsla(120, 0%, 50%, 1)"));
  });
  it("empty or unparsable = the binding default", () => {
    expect(key("")).toBe(key("hsl(0, 100%, 50%)"));
    expect(catalogColorKey("ColorSlider", "red")).toBe(
      key("hsl(0, 100%, 50%)"),
    );
  });
});

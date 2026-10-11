// ADR-258 G0 (c) — the installed RAC's own output for the Color controls, fixed as the G1 oracle.
//
// Mounts react-aria-components ColorArea · ColorSlider · ColorWheel with `renderToStaticMarkup` over
// an input matrix and records the inline `background` (+ blend) RAC writes, the thumb's
// `left` / `top` / `background-color`, and (ColorSlider) the Label · SliderOutput text RAC writes
// when the author gives none. Our shared function is the side compared against this file — never
// regenerate it from our own function.
//
//   node apps/builder/scripts/adr258-rac-gradient-oracle.mjs   (writes tests/fixtures/adr258-rac-gradient.json)
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ColorArea,
  ColorSlider,
  ColorThumb,
  ColorWheel,
  ColorWheelTrack,
  I18nProvider,
  Label,
  SliderOutput,
  SliderTrack,
} from "react-aria-components";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const OUT = join(here, "../tests/fixtures/adr258-rac-gradient.json");

/** The `style="…"` of the first element carrying `className`, as a declaration map. */
function styleOf(html, className) {
  const tag = new RegExp(
    `<[a-z]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`,
  ).exec(html)?.[0];
  if (!tag) return null;
  const raw = /style="([^"]*)"/.exec(tag)?.[1] ?? "";
  const decoded = raw
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
  const out = {};
  // Split on `;` outside parentheses (gradients hold commas and the clip path holds quotes).
  let depth = 0;
  let start = 0;
  const parts = [];
  for (let i = 0; i < decoded.length; i += 1) {
    const ch = decoded[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === ";" && depth === 0) {
      parts.push(decoded.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(decoded.slice(start));
  for (const part of parts) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

const textOf = (html, className) => {
  const m = new RegExp(
    `<[a-z]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([^<]*)<`,
  ).exec(html);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'") : null;
};

const render = (element, locale = "en-US") => {
  try {
    return { html: renderToStaticMarkup(h(I18nProvider, { locale }, element)) };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
};

const SPACES = {
  rgb: ["red", "green", "blue"],
  hsl: ["hue", "saturation", "lightness"],
  hsb: ["hue", "saturation", "brightness"],
};

// Values spread across spaces · an achromatic hue · alpha · the z extremes.
const VALUES = [
  "#8040c0",
  "#ff000080",
  "hsl(0, 0%, 50%)",
  "hsl(120, 0%, 50%)",
  "hsla(210, 60%, 40%, 0.5)",
  "hsb(300, 100%, 100%)",
  "rgb(0, 0, 0)",
  "rgb(255, 255, 255)",
];

const area = [];
for (const colorSpace of [undefined, "rgb", "hsl", "hsb"]) {
  const axisSets = [{}];
  if (colorSpace) {
    for (const x of SPACES[colorSpace])
      for (const y of SPACES[colorSpace])
        if (x !== y) axisSets.push({ xChannel: x, yChannel: y });
  }
  for (const axes of axisSets) {
    for (const defaultValue of VALUES) {
      const props = {
        defaultValue,
        ...(colorSpace ? { colorSpace } : {}),
        ...axes,
      };
      const r = render(h(ColorArea, props, h(ColorThumb)));
      if (r.error) {
        area.push({ props, error: r.error });
        continue;
      }
      const root = styleOf(r.html, "react-aria-ColorArea");
      const thumb = styleOf(r.html, "react-aria-ColorThumb");
      area.push({
        props,
        background: root?.background ?? null,
        backgroundBlendMode: root?.["background-blend-mode"] ?? null,
        thumb: {
          left: thumb?.left,
          top: thumb?.top,
          backgroundColor: thumb?.["background-color"],
        },
      });
    }
  }
}
// Default props (no value at all) — RAC's own default `#ffffff`.
{
  const r = render(h(ColorArea, {}, h(ColorThumb)));
  const root = styleOf(r.html, "react-aria-ColorArea");
  const thumb = styleOf(r.html, "react-aria-ColorThumb");
  area.push({
    props: {},
    background: root?.background ?? null,
    backgroundBlendMode: root?.["background-blend-mode"] ?? null,
    thumb: {
      left: thumb?.left,
      top: thumb?.top,
      backgroundColor: thumb?.["background-color"],
    },
  });
}

const slider = [];
for (const colorSpace of [undefined, "rgb", "hsl", "hsb"]) {
  const channels = colorSpace ? [...SPACES[colorSpace], "alpha"] : null;
  for (const defaultValue of VALUES) {
    // Without a colorSpace, the channels are the value's own space's.
    const own = channels ?? null;
    const list =
      own ??
      (defaultValue.startsWith("hsl")
        ? [...SPACES.hsl, "alpha"]
        : defaultValue.startsWith("hsb")
          ? [...SPACES.hsb, "alpha"]
          : [...SPACES.rgb, "alpha"]);
    for (const channel of list) {
      for (const orientation of ["horizontal", "vertical"]) {
        const props = {
          channel,
          defaultValue,
          orientation,
          ...(colorSpace ? { colorSpace } : {}),
        };
        const row = { props };
        for (const locale of ["en-US", "ko-KR"]) {
          const r = render(
            h(
              ColorSlider,
              props,
              h(Label),
              h(SliderOutput),
              h(SliderTrack, null, h(ColorThumb)),
            ),
            locale,
          );
          if (r.error) {
            row.error = r.error;
            break;
          }
          if (locale === "en-US") {
            const track = styleOf(r.html, "react-aria-SliderTrack");
            const thumb = styleOf(r.html, "react-aria-ColorThumb");
            row.background = track?.background ?? null;
            row.thumb = {
              left: thumb?.left,
              top: thumb?.top,
              backgroundColor: thumb?.["background-color"],
            };
          }
          row.text ??= {};
          row.text[locale] = {
            label: textOf(r.html, "react-aria-Label"),
            output: textOf(r.html, "react-aria-SliderOutput"),
          };
        }
        slider.push(row);
      }
    }
  }
}
// No value — RAC throws (F4); recorded so the binding default is a deliberate choice.
slider.push({
  props: { channel: "hue" },
  error:
    render(
      h(ColorSlider, { channel: "hue" }, h(SliderTrack, null, h(ColorThumb))),
    ).error ?? null,
});

const TRACK = 26; // CATALOG_COLOR_WHEEL_TRACK
const wheel = [];
for (const diameter of [180, 240]) {
  for (const defaultValue of [
    undefined,
    "hsl(0, 100%, 50%)",
    "hsl(90, 100%, 50%)",
    "hsl(225, 50%, 30%)",
    "#00ff0080",
  ]) {
    const props = {
      outerRadius: diameter / 2,
      innerRadius: diameter / 2 - TRACK,
      ...(defaultValue ? { defaultValue } : {}),
    };
    const r = render(h(ColorWheel, props, h(ColorWheelTrack), h(ColorThumb)));
    if (r.error) {
      wheel.push({ props, error: r.error });
      continue;
    }
    const track = styleOf(r.html, "react-aria-ColorWheelTrack");
    const thumb = styleOf(r.html, "react-aria-ColorThumb");
    wheel.push({
      props,
      track: {
        width: track?.width,
        height: track?.height,
        background: track?.background?.replace(/\s+/g, " ").trim() ?? null,
        clipPath: track?.["clip-path"] ?? null,
      },
      thumb: {
        left: thumb?.left,
        top: thumb?.top,
        backgroundColor: thumb?.["background-color"],
      },
    });
  }
}

const versions = Object.fromEntries(
  ["react-aria-components", "react-aria", "react-stately"].map((name) => {
    const pkg = require.resolve(`${name}/package.json`);
    return [name, JSON.parse(readFileSync(pkg, "utf8")).version];
  }),
);
const out = { versions, area, slider, wheel };
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
const errs = (rows) => rows.filter((r) => r.error).length;
console.log(
  `wrote ${OUT}\n  versions ${JSON.stringify(versions)}\n  area ${area.length} (errors ${errs(area)}) · slider ${slider.length} (errors ${errs(slider)}) · wheel ${wheel.length} (errors ${errs(wheel)})`,
);

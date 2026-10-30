/**
 * ADR-295 Phase 0 (G0) — S2 1.8.1 설치본에서 D3 값을 뽑는다. oracle = 설치본, 손 표 금지.
 *
 * 1) 토큰 (node): 설치본 `style/dist/spectrum-theme.cjs` 의 style macro 를 가짜 MacroContext 로 실행해
 *    radius · border · relative spacing (`text-to-visual` 등) 의 CSS 를 받고, `fontSize` 단계 · 행간 식 ·
 *    spacing 표 (`spectrum-theme.ts` `generateSpacing([...])`) · scale (`dist/private/Provider.css`) 를 읽는다.
 *    글자 · 행간은 그 식으로 desktop (base 14) · touch (base 17) 숫자를 계산한다.
 * 2) 브라우저 (Playwright): `adr295-s2-probe/` 를 vite 로 빌드해 S2 컴포넌트를 size 마다 그리고
 *    desktop · touch (pointer: coarse · hover: none 에뮬레이션) 두 조건에서 computed 치수를 읽는다.
 *    글자 단계별 computed font-size · line-height 도 같은 페이지에서 읽어 1) 의 계산과 대조한다.
 *
 *   node apps/builder/scripts/adr295-s2-token-extract.mjs <outDir>
 *   → <outDir>/s2-values.json (원자료) · adr295-s2-oracle.json (게이트용 — catalogRuntime/__tests__/fixtures/ 에 복사)
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const builderDir = resolve(here, "..");
const require = createRequire(join(builderDir, "package.json"));
const s2Dir = dirname(require.resolve("@react-spectrum/s2/package.json"));
const s2Version = JSON.parse(readFileSync(join(s2Dir, "package.json"), "utf8")).version;
const outDir = resolve(process.argv[2] ?? ".agent/runs/adr295");
mkdirSync(outDir, { recursive: true });

// ── 1) 토큰 ──────────────────────────────────────────────────────────────
// CJS 빌드의 style macro 는 동작하고 (MJS 빌드는 properties import 누락으로 throw), 글자 단계 표는 MJS 만 export 한다.
const theme = require(join(s2Dir, "style/dist/spectrum-theme.cjs"));
const themeData = await import(join(s2Dir, "style/dist/spectrum-theme.mjs"));
const themeSrc = readFileSync(join(s2Dir, "style/spectrum-theme.ts"), "utf8");
const providerCss = readFileSync(join(s2Dir, "dist/private/Provider.css"), "utf8");

/** style macro 를 실행해 생성 CSS 의 선언만 모은다 (`@media` 조건 포함). */
function macroCss(styleObj) {
  const assets = [];
  theme.style.call({ addAsset: (a) => assets.push(a) }, styleObj);
  return assets.map((a) => a.content).join("\n");
}
function declValues(css, prop) {
  const re = new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`, "g");
  return [...css.matchAll(re)].map((m) => m[1].trim());
}
const remPx = (v) => {
  const m = /^(-?[\d.]+)rem$/.exec(v);
  if (m) return Number(m[1]) * 16;
  const p = /^(-?[\d.]+)px$/.exec(v);
  return p ? Number(p[1]) : v;
};

const spacingList = (() => {
  const m = /generateSpacing\(\[([\s\S]*?)\]\s*as const\)/.exec(themeSrc);
  return m[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim().replace(/,$/, ""))
    .filter((l) => /^-?\d+$/.test(l))
    .map(Number);
})();

const radius = {};
for (const k of ["none", "sm", "default", "lg", "xl", "full", "pill"]) {
  const v = declValues(macroCss({ borderRadius: k }), "border-start-start-radius")[0];
  radius[k] = remPx(v);
}
const borderWidth = {};
for (const k of [0, 1, 2, 4]) {
  borderWidth[k] = remPx(declValues(macroCss({ borderWidth: k }), "border-top-width")[0]);
}

const relativeSpacing = {};
for (const k of ["text-to-control", "text-to-visual", "edge-to-text", "pill"]) {
  const css = macroCss({ columnGap: k });
  relativeSpacing[k] = {
    css: declValues(css, "column-gap"),
    touchMedia: /@media[^{]*pointer/.test(css),
  };
}
const sizeFn = { "size(32)": theme.size(32), "fontRelative(6)": theme.fontRelative(6), "fontRelative(8,17)": theme.fontRelative(8, 17) };

// 행간 식 상수 — 설치본 문자열에서 읽는다.
const lhExpr = declValues(macroCss({ fontSize: "ui", lineHeight: "ui" }), "line-height")[0];
if (lhExpr !== themeData.lineHeight.ui.default) throw new Error("line-height expr: macro CSS ≠ MJS export");
const lhNums = /\(([\d.]+) \+ \(1 - \(\(min\((\d+), .*?\) - (\d+)\)\) \/ (\d+)\) \* ([\d.]+)\), (\d+)px\)/.exec(lhExpr);
const LH = {
  min: Number(lhNums[1]),
  maxFs: Number(lhNums[2]),
  minFs: Number(lhNums[3]),
  span: Number(lhNums[4]),
  delta: Number(lhNums[5]),
  roundTo: Number(lhNums[6]),
};
// 글자 식 — `round(var(--s2-font-size-base, 14) * var(--fs) / 16 * 1rem, 1px)` · `--fs: pow(1.125, 단계)`.
const fsCss = macroCss({ fontSize: "ui" });
const fsDecl = declValues(fsCss, "font-size")[0];
const fsRatio = Number(/pow\(([\d.]+),/.exec(declValues(fsCss, "--fs")[0])[1]);

const scale = {
  desktop: {
    scale: Number(/--s2-scale:\s*([\d.]+)/.exec(providerCss)[1]),
    fontBase: Number(/--s2-font-size-base:\s*([\d.]+)/.exec(providerCss)[1]),
  },
  touch: (() => {
    const block = /@media not \(\(hover: hover\) and \(pointer: fine\)\)\s*\{([^}]*)\}/.exec(providerCss)[1];
    return {
      scale: Number(/--s2-scale:\s*([\d.]+)/.exec(block)[1]),
      fontBase: Number(/--s2-font-size-base:\s*([\d.]+)/.exec(block)[1]),
    };
  })(),
  media: "not ((hover: hover) and (pointer: fine))",
};

// CSS round() 은 nearest (반이면 +∞ 쪽) — 양수에서 Math.round 와 같다.
const roundTo = (x, step) => Math.round(x / step) * step;
const fontPx = (base, step) => roundTo(base * fsRatio ** step, 1);
const lineHeightPx = (fs) =>
  roundTo(fs * (LH.min + (1 - (Math.min(LH.maxFs, fs) - LH.minFs) / LH.span) * LH.delta), LH.roundTo);

const fontSteps = themeData.fontSize;
const fontTable = {};
for (const [name, step] of Object.entries(fontSteps)) {
  const row = { step };
  for (const dev of ["desktop", "touch"]) {
    const fs = fontPx(scale[dev].fontBase, step);
    row[dev] = { fontSize: fs, lineHeight: lineHeightPx(fs) };
  }
  fontTable[name] = row;
}

// control 치수 · 모서리 — `src/style-utils.ts` `controlSize` · `controlBorderRadius` (size 단계 배율).
const styleUtilsSrc = readFileSync(join(s2Dir, "src/style-utils.ts"), "utf8");
function parseControlSize(name) {
  const m = new RegExp(`const ${name} = \\{\\s*default: (\\d+),\\s*size: \\{([^}]*)\\}`).exec(styleUtilsSrc);
  const sizes = Object.fromEntries([...m[2].matchAll(/(\w+): (\d+)/g)].map((x) => [x[1], Number(x[2])]));
  return { M: Number(m[1]), ...sizes };
}
const controlSize = { md: parseControlSize("controlSizeM"), sm: parseControlSize("controlSizeS") };
const radiusSteps = (() => {
  const m = /controlBorderRadius[\s\S]*?size: \{([\s\S]*?)\}/.exec(styleUtilsSrc);
  const steps = Object.fromEntries([...m[1].matchAll(/(\w+): Math\.pow\(([\d.]+), (-?\d+)\)/g)].map((x) => [x[1], Number(x[3])]));
  return { M: 0, ...steps, ratio: Number(/Math\.pow\(([\d.]+),/.exec(m[1])[1]) };
})();
const controlRadius = {};
for (const [variant, base] of [["default", radius.default], ["sm", radius.sm]]) {
  controlRadius[variant] = Object.fromEntries(
    ["XS", "S", "M", "L", "XL"].map((sz) => [sz, roundTo(base * radiusSteps.ratio ** radiusSteps[sz], 1)]),
  );
}

const tokens = {
  s2Version,
  spacing: spacingList,
  radius,
  borderWidth,
  relativeSpacing,
  sizeFn,
  font: { decl: fsDecl, ratio: fsRatio, steps: fontSteps },
  lineHeight: { expr: lhExpr, constants: LH },
  scale,
  fontTable,
  controlSize,
  controlRadius: { steps: radiusSteps, ...controlRadius },
};

// ── 2) 브라우저 ──────────────────────────────────────────────────────────
const { build } = await import(require.resolve("vite"));
const react = (await import(require.resolve("@vitejs/plugin-react"))).default;
const probeOut = join(outDir, "s2-probe-dist");
await build({
  root: join(here, "adr295-s2-probe"),
  configFile: false,
  logLevel: "warn",
  plugins: [react()],
  base: "./",
  build: { outDir: probeOut, emptyOutDir: true, minify: false },
});

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const p = join(probeOut, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  try {
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(readFileSync(p));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = require("playwright");
const browser = await chromium.launch();

// 글자 단계 probe — 설치본 macro 가 낸 클래스 CSS 를 그대로 싣는다 (식은 브라우저가 평가).
const fontProbeCss = [];
const fontProbeClass = {};
for (const name of Object.keys(fontSteps)) {
  const assets = [];
  const cls = theme.style.call({ addAsset: (a) => assets.push(a) }, { fontSize: name, lineHeight: "ui" });
  fontProbeClass[name] = String(cls).trim();
  fontProbeCss.push(...assets.map((a) => a.content));
}

async function measure(device) {
  // touch = Chromium touch 에뮬레이션 (`hasTouch`) — `(pointer: coarse)` · `(hover: none)` 이 맞는다.
  // CDP `setEmulatedMedia` 의 pointer · hover feature 는 Chromium 이 무시한다 (2026-10-30 실측).
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: device === "touch",
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector("[data-probe]");
  await page.waitForTimeout(300);
  await page.addStyleTag({ content: fontProbeCss.join("\n") });
  return page.evaluate(
    ({ fontProbeClass }) => {
      const root = getComputedStyle(document.documentElement);
      const probeVars = {
        mediaFine: matchMedia("(hover: hover) and (pointer: fine)").matches,
        s2Scale: root.getPropertyValue("--s2-scale").trim(),
        s2FontBase: root.getPropertyValue("--s2-font-size-base").trim(),
      };
      const PROPS = [
        "fontSize",
        "lineHeight",
        "paddingInlineStart",
        "paddingInlineEnd",
        "paddingBlockStart",
        "columnGap",
        "minHeight",
        "borderTopLeftRadius",
        "borderTopWidth",
      ];
      const components = [];
      for (const host of document.querySelectorAll("[data-probe]")) {
        const nodes = [];
        const visit = (el, depth) => {
          if (depth > 7 || nodes.length >= 24) return;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && el !== host) {
            const cs = getComputedStyle(el);
            const row = {
              d: depth,
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute("role") ?? undefined,
              slot: el.getAttribute("slot") ?? undefined,
              w: Math.round(r.width * 100) / 100,
              h: Math.round(r.height * 100) / 100,
            };
            for (const p of PROPS) row[p] = cs[p];
            nodes.push(row);
          }
          for (const c of el.children) visit(c, depth + 1);
        };
        visit(host, 0);
        components.push({ family: host.dataset.probe, size: host.dataset.size, nodes });
      }
      const fonts = {};
      for (const [name, cls] of Object.entries(fontProbeClass)) {
        const el = document.createElement("span");
        el.className = cls;
        el.textContent = "Ag";
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        fonts[name] = { fontSize: parseFloat(cs.fontSize), lineHeight: parseFloat(cs.lineHeight) };
        el.remove();
      }
      return { probeVars, components, fonts };
    },
    { fontProbeClass },
  );
}

const computed = { desktop: await measure("desktop"), touch: await measure("touch") };
await browser.close();
server.close();

// 식 계산 ↔ 브라우저 computed 대조
const fontMismatch = [];
for (const dev of ["desktop", "touch"]) {
  for (const [name, row] of Object.entries(fontTable)) {
    const got = computed[dev].fonts[name];
    if (got.fontSize !== row[dev].fontSize || got.lineHeight !== row[dev].lineHeight) {
      fontMismatch.push({ dev, name, formula: row[dev], browser: got });
    }
  }
}

// 가족별 「대표 상자」 — probe 덤프에서 S2 컴포넌트의 치수를 내는 요소를 고른다 (2026-10-30 덤프로 확인한 구조).
const px = (v) => (typeof v === "string" && v.endsWith("px") ? Math.round(parseFloat(v) * 100) / 100 : v);
const bordered = (n) => n.borderTopWidth !== "0px";
const PICK = {
  TextField: (ns) => ns.find((n) => n.role === "presentation"),
  TextArea: (ns) => ns.find((n) => n.tag === "textarea"),
  ComboBox: (ns) => ns.find((n) => n.role === "presentation"),
  DateField: (ns) => ns.find((n) => n.role === "presentation"),
  NumberField: (ns) => ns.find((n) => n.role === "group" && n.d === 2),
  SearchField: (ns) => ns.find((n) => n.role === "group" && n.d === 2),
  Picker: (ns) => ns.find((n) => n.tag === "button"),
  Button: (ns) => ns[0],
  ButtonIcon: (ns) => ns[0],
  ActionButton: (ns) => ns[0],
  ActionButtonIcon: (ns) => ns[0],
  ToggleButton: (ns) => ns[0],
  Checkbox: (ns) => ns.find((n) => n.tag === "div" && bordered(n)),
  Switch: (ns) => ns.find((n) => n.tag === "div" && bordered(n)),
  RadioGroup: (ns) => ns.find((n) => n.tag === "div" && bordered(n) && n.w === n.h),
  TagGroup: (ns) => ns.find((n) => n.role === "row"),
  Badge: (ns) => ns[0],
  Slider: (ns) => ns.find((n) => n.h <= 20 && n.w >= 200 && n.tag === "div" && n.d === 4),
  Meter: (ns) => ns.find((n) => n.d === 2 && n.tag === "div" && n.h < 20),
  ProgressBar: (ns) => ns.find((n) => n.d === 2 && n.tag === "div" && n.h < 20),
  SegmentedControl: (ns) => ns[0],
  Tabs: (ns) => ns.find((n) => n.role === "tab"),
};
const componentTable = {};
for (const dev of ["desktop", "touch"]) {
  for (const { family, size, nodes } of computed[dev].components) {
    const box = PICK[family]?.(nodes);
    const root = nodes[0];
    if (!box) continue;
    ((componentTable[family] ??= {})[size] ??= {})[dev] = {
      height: box.h,
      width: box.w,
      minHeight: px(box.minHeight),
      paddingInline: px(box.paddingInlineStart),
      paddingInlineEnd: px(box.paddingInlineEnd),
      radius: px(box.borderTopLeftRadius),
      borderWidth: px(box.borderTopWidth),
      gap: px(box.columnGap),
      rootGap: px(root.columnGap),
      fontSize: px(box.fontSize),
      lineHeight: px(box.lineHeight),
    };
  }
}

writeFileSync(join(outDir, "s2-values.json"), JSON.stringify({ tokens, componentTable, fontMismatch, computed }, null, 2));
// 게이트가 읽는 얇은 사본 (probe 원자료 제외) — G4 (a) · (c) 의 oracle. 저장소 fixture 로 복사한다.
writeFileSync(
  join(outDir, "adr295-s2-oracle.json"),
  JSON.stringify({ note: "ADR-295 G0 — S2 설치본 추출 (adr295-s2-token-extract.mjs). 손 편집 금지", tokens, componentTable }, null, 2),
);
console.log("S2", s2Version, "→", join(outDir, "s2-values.json"));
console.log("probe vars", computed.desktop.probeVars, computed.touch.probeVars);
console.log("radius", radius, "border", borderWidth);
console.log("spacing", spacingList.join(" "));
console.log("controlSize", JSON.stringify(controlSize), "controlRadius", JSON.stringify(controlRadius));
console.log("relative", JSON.stringify(relativeSpacing));
console.log("font formula vs browser mismatches:", fontMismatch.length);
for (const m of fontMismatch.slice(0, 10)) console.log(" ", JSON.stringify(m));
for (const [family, sizes] of Object.entries(componentTable)) {
  const cells = Object.entries(sizes).map(
    ([sz, v]) => `${sz} ${v.desktop?.height}/${v.touch?.height}`,
  );
  console.log(family.padEnd(18), cells.join(" · "));
}

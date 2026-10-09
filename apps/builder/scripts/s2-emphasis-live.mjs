// S2 list D live (사용자 2026-10-10 「목록 D 의 남은 시각 축 이어서 착수해」): real Builder (headed
// Chrome, Compare Mode). Slider Emphasized → the fill and thumb turn from neutral to accent on the
// Canvas and the Preview; TagGroup Emphasized → a selected Tag turns from neutral to accent on both;
// Avatar Over Background → a 1px background outline on both; the palette AvatarGroup's avatars have
// it; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-emphasis-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const select = (type, index = 0) =>
  page.evaluate(
    ([type, index]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const node = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === type,
      )[index];
      ws.selectRecords([node.id]);
    },
    [type, index],
  );
const toggle = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await field(label).isVisible().catch(() => false)) break;
    const byText = page
      .locator(".panel-wrapper[data-panel='properties']")
      .getByText(label, { exact: true });
    if (await byText.first().isVisible().catch(() => false)) break;
    await page.getByRole("button", { name: "Design", exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  await page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first()
    .click();
  await page.waitForTimeout(1500);
};
/** Canvas paint (Skia debug nodes) and Preview computed colors of the parts. */
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const skia = (id) => window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const rgb = (c) =>
      c ? [0, 1, 2].map((i) => Math.round(c[i] * 255)) : null;
    const all = [...root.canvasInputs.values()];
    const of = (type) => all.filter((r) => root.typeOf(r) === type);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const toRgb = (color) => {
      if (!color) return null;
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const css = (id, key) => {
      const el = doc.querySelector(`[data-catalog-id="${id}"]`);
      return el ? getComputedStyle(el)[key] : null;
    };
    const fill = of("SliderFill")[0];
    const thumb = of("SliderThumb")[0];
    const thumbNode = thumb && skia(thumb.id);
    const tag = of("Tag")[0];
    const tagNode = tag && skia(tag.id);
    const avatars = of("Avatar").map((avatar) => {
      const node = skia(avatar.id);
      const ring = (node?.children ?? []).find((c) => (c.box?.strokeWidth ?? 0) > 0);
      return {
        canvasRing: ring
          ? { width: ring.box.strokeWidth, color: rgb(ring.box.strokeColor) }
          : null,
        previewOutline: css(avatar.id, "outlineWidth") + " " + css(avatar.id, "outlineStyle"),
        previewOutlineColor: toRgb(css(avatar.id, "outlineColor")),
      };
    });
    return {
      slider: fill
        ? {
            canvasFill: rgb(skia(fill.id)?.box?.fillColor),
            canvasThumb: rgb(thumbNode?.children?.[0]?.box?.fillColor),
            previewFill: toRgb(css(fill.id, "backgroundColor")),
            previewThumb: toRgb(css(thumb.id, "backgroundColor")),
          }
        : null,
      tag: tag
        ? {
            selected: tag.derivedProps?._isSelected ?? null,
            canvasFill: rgb(tagNode?.box?.fillColor),
            previewFill: toRgb(css(tag.id, "backgroundColor")),
          }
        : null,
      avatars,
    };
  });
const near = (a, b, tol = 3) =>
  !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const neutral = (c) => !!c && Math.max(...c) - Math.min(...c) <= 8;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 emphasis axes");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── Slider ──
await addFromPalette("slider");
await page.waitForTimeout(1500);
await select("Slider");
await page.waitForTimeout(800);
const slider0 = (await read()).slider;
await toggle("Emphasized");
const slider1 = (await read()).slider;
record(
  "Slider default: neutral fill and thumb, Canvas = Preview",
  neutral(slider0.canvasFill) &&
    near(slider0.canvasFill, slider0.previewFill) &&
    near(slider0.canvasThumb, slider0.previewThumb),
  slider0,
);
record(
  "Slider Emphasized: accent fill and thumb, Canvas = Preview",
  !neutral(slider1.canvasFill) &&
    near(slider1.canvasFill, slider1.previewFill) &&
    near(slider1.canvasThumb, slider1.previewThumb) &&
    near(slider1.canvasFill, slider1.canvasThumb),
  slider1,
);

// ── TagGroup ──
await addFromPalette("tag group");
await page.waitForTimeout(1500);
await select("Tag", 0);
await page.waitForTimeout(800);
await toggle("Selected");
const tag0 = (await read()).tag;
await select("TagGroup");
await page.waitForTimeout(800);
await toggle("Emphasized");
const tag1 = (await read()).tag;
record(
  "TagGroup default: a selected Tag is neutral, Canvas = Preview",
  tag0.selected === true &&
    neutral(tag0.canvasFill) &&
    near(tag0.canvasFill, tag0.previewFill),
  tag0,
);
record(
  "TagGroup Emphasized: the selected Tag is accent, Canvas = Preview",
  !neutral(tag1.canvasFill) && near(tag1.canvasFill, tag1.previewFill),
  tag1,
);

// ── Avatar ──
await addFromPalette("avatar");
await page.waitForTimeout(1500);
await select("Avatar");
await page.waitForTimeout(800);
const avatar0 = (await read()).avatars[0];
await toggle("Over Background");
const avatar1 = (await read()).avatars[0];
record(
  "Avatar Over Background: 1px background outline, Canvas = Preview (none before)",
  avatar0.canvasRing === null &&
    /^0px|none/.test(avatar0.previewOutline) &&
    avatar1.canvasRing?.width === 1 &&
    avatar1.previewOutline === "1px solid" &&
    near(avatar1.canvasRing.color, avatar1.previewOutlineColor),
  { avatar0, avatar1 },
);
await addFromPalette("avatar group");
await page.waitForTimeout(1500);
const group = (await read()).avatars.slice(1);
const canvasBox = await page.locator("canvas").first().boundingBox();
await page.screenshot({ path: `${OUT}/canvas.png`, clip: canvasBox ?? undefined });
await page.screenshot({ path: `${OUT}/page.png` });
record(
  "AvatarGroup: its 3 avatars have the outline on both",
  group.length === 3 &&
    group.every(
      (a) => a.canvasRing?.width === 1 && a.previewOutline === "1px solid",
    ),
  group,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

// ADR-256 Phase 10a live — the S2 Card (사용자 결정 2026-10-11 「S2 그대로」 · 「범용 Content · Footer」)
// in the real Builder (headed Chrome, Compare Mode opens the Preview): L-1 palette tree · L-2 Canvas =
// Preview text · L-3 Properties without Title / Description · L-4 Content takes a Button · L-5 title
// inline edit · L-6 size L · L-7 InlineAlert = Heading + Content · L-8 reopened · L-9 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p10a-live.mjs <out>
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
const errorsAt = [];
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: match }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};

const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

const slotsModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/slots.ts`;
const textModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/canvasText.ts`;
const near = (a, b, tol = 1) =>
  !!a &&
  !!b &&
  a.length === b.length &&
  a.every((v, i) => Math.abs(v - b[i]) <= tol);

/** The Card's Canvas tree and boxes (relative to the Card) — title · description · content. */
const cardCanvas = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const card = all.find((r) => root.typeOf(r) === "Card");
    if (!card) return null;
    const kids = (r) => r.children.map((id) => root.canvasInputs.get(id));
    const content = kids(card).find((r) => root.typeOf(r) === "Content");
    const g = root.getGeometry(all.map((r) => r.id));
    const abs = (r) => {
      let x = 0;
      let y = 0;
      for (
        let c = r;
        c && c.id !== card.id;
        c = root.canvasInputs.get(c.parentId)
      ) {
        const b = g.get(c.id);
        if (!b) return null;
        x += b.x;
        y += b.y;
      }
      const b = g.get(r.id);
      return [x, y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
    };
    const text = (slot) =>
      kids(content).find(
        (r) => root.typeOf(r) === "Text" && r.props.slot === slot,
      );
    return {
      id: card.id,
      contentId: content?.id,
      types: kids(card).map((r) => root.typeOf(r)),
      contentTypes: content ? kids(content).map((r) => root.typeOf(r)) : null,
      title: text("title") && {
        text: text("title").props.children,
        font: [
          text("title").visual.fontSize,
          Number(text("title").visual.fontWeight),
        ],
        box: abs(text("title")),
        id: text("title").id,
      },
      description: text("description") && {
        text: text("description").props.children,
        font: [text("description").visual.fontSize],
        box: abs(text("description")),
      },
      content: content && abs(content),
    };
  });
/** The Preview's Card: its element tree and boxes relative to the Card element. */
const cardDom = () =>
  preview((doc) => {
    const card = doc.querySelector(".react-aria-Card");
    if (!card) return null;
    const shape = (el) => {
      const cls = [...el.classList]
        .filter((n) => n.startsWith("react-aria-"))
        .join(".");
      const slot = el.getAttribute("slot");
      const own = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${slot ? `[slot=${slot}]` : ""}`;
      const kids = [...el.children].map(shape);
      return kids.length ? `${own}(${kids.join(" + ")})` : own;
    };
    const base = card.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.left - base.left, r.top - base.top, r.width, r.height].map(
        (v) => Math.round(v * 10) / 10,
      );
    };
    const title = card.querySelector('[slot="title"]');
    const description = card.querySelector('[slot="description"]');
    const cs = (el) => el && getComputedStyle(el);
    return {
      shape: shape(card),
      title: title && {
        text: title.textContent,
        font: [parseFloat(cs(title).fontSize), Number(cs(title).fontWeight)],
        box: box(title),
      },
      description: description && {
        text: description.textContent,
        font: [parseFloat(cs(description).fontSize)],
        box: box(description),
      },
      content: box(card.querySelector(".react-aria-Content")),
    };
  });

await newProject(`adr256-p10a-${Date.now()}`);
await compareOn();
await addFromPalette("Card");
await page.waitForTimeout(1500);

// L-1: the palette Card is the S2 tree on both consumers.
const c1 = await cardCanvas();
const d1 = await cardDom();
record(
  "L-1 palette Card = CardPreview + Content (Text[title] + Text[description]) + Footer — Canvas tree · Preview DOM",
  JSON.stringify(c1?.types) === '["CardPreview","Content","Footer"]' &&
    JSON.stringify(c1?.contentTypes) === '["Text","Text"]' &&
    d1?.shape?.includes(
      "div.react-aria-Content(span.react-aria-Text[slot=title] + span.react-aria-Text[slot=description])",
    ) &&
    /div\.react-aria-Footer\)$/.test(d1?.shape ?? ""),
  {
    canvas: c1 && { types: c1.types, content: c1.contentTypes },
    dom: d1?.shape,
  },
);
errorsAt.push(["L-1", errors.length]);

// L-2: Canvas = Preview — title 14/700 · description 12 (S2 M), their boxes in the Card.
record(
  "L-2 Canvas = Preview: title · description font and boxes (M — S2 title-sm 14 bold · body-xs 12)",
  JSON.stringify(c1?.title?.font) === "[14,700]" &&
    JSON.stringify(d1?.title?.font) === "[14,700]" &&
    c1?.description?.font[0] === 12 &&
    d1?.description?.font[0] === 12 &&
    near(c1?.title?.box, d1?.title?.box) &&
    near(c1?.description?.box, d1?.description?.box) &&
    near(c1?.content, d1?.content),
  {
    canvas: {
      title: c1?.title,
      description: c1?.description,
      content: c1?.content,
    },
    dom: {
      title: d1?.title,
      description: d1?.description,
      content: d1?.content,
    },
  },
);
errorsAt.push(["L-2", errors.length]);

// L-3: the Design panel's Properties has no Title · Description field (S2 Card has none) — Variant is there.
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  c1.id,
);
await page.waitForTimeout(600);
await page
  .getByRole("button", { name: /^(Design|디자인)$/ })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(800);
await page
  .getByRole("tab", { name: /^(Property|속성)$/ })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(800);
const panel = await page.evaluate(() => {
  const labels = [
    ...document.querySelectorAll(
      "input[aria-label], [role=textbox][aria-label], label, legend, .property-label, .field-label",
    ),
  ]
    .map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim())
    .filter(Boolean);
  return labels;
});
const has = (re) => panel.some((t) => re.test(t));
record(
  "L-3 Properties of the Card: no Title · Description field, Variant field present",
  !has(/^(Title|제목)$/) &&
    !has(/^(Description|설명)$/) &&
    has(/^(Variant|변형)$/),
  { sample: panel.slice(0, 40) },
);
errorsAt.push(["L-3", errors.length]);
await page.keyboard.press("Escape");

// L-4: the Content takes free content from the instance — a Button goes in after the texts (both consumers).
const r4 = await page.evaluate(
  async ({ slotsModule, contentId }) => {
    const { catalogSlotCommands, catalogSlotInsertOptions } = await import(
      slotsModule
    );
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const target = ws.positionOfRecord(contentId).target;
    const options = catalogSlotInsertOptions(ws.runtime.graph, target);
    const button = options.find((o) => o.label === "Button");
    if (!button) return { ok: false, options: options.map((o) => o.label) };
    try {
      ws.execute(
        catalogSlotCommands.fill(target, button.definitionId, ws.newId),
      );
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true, count: options.length };
    } catch (error) {
      return { ok: false, code: String(error) };
    }
  },
  { slotsModule, contentId: c1.contentId },
);
await page.waitForTimeout(1000);
const c4 = await cardCanvas();
const d4 = await cardDom();
record(
  "L-4 Content slot: the insert list offers Button · it goes in after the title · description (Canvas · Preview)",
  r4.ok &&
    JSON.stringify(c4?.contentTypes) === '["Text","Text","Button"]' &&
    d4?.shape?.includes(
      "div.react-aria-Content(span.react-aria-Text[slot=title] + span.react-aria-Text[slot=description] + button.react-aria-Button)",
    ) &&
    c4?.title?.text === "Card Title",
  { r4, canvas: c4?.contentTypes, dom: d4?.shape },
);
errorsAt.push(["L-4", errors.length]);

// L-5: the title is its own Text's text — an inline edit writes it (no Card prop).
const r5 = await page.evaluate(
  async ({ textModule, titleId }) => {
    const { catalogTextCommand } = await import(textModule);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const fresh = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Text" && r.props.slot === "title",
    );
    try {
      ws.execute(
        catalogTextCommand(
          ws.itemOfRecord(fresh.id),
          "children",
          "Card Title",
          "Command + R",
        ),
      );
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: String(error) };
    }
  },
  { textModule, titleId: c4?.title?.id },
);
await page.waitForTimeout(800);
const c5 = await cardCanvas();
const d5 = await cardDom();
record(
  "L-5 inline text edit of the title: Canvas · Preview show 「Command + R」",
  r5.ok &&
    c5?.title?.text === "Command + R" &&
    d5?.title?.text === "Command + R",
  { r5, canvas: c5?.title?.text, dom: d5?.title?.text },
);
errorsAt.push(["L-5", errors.length]);

// L-6: size L — title 16 · description 14 (S2 title · body-sm) on both, boxes match.
const r6 = await exec(
  (c, ws, id) =>
    c.setFields({
      targets: [ws.positionOfRecord(id).target],
      props: { size: { kind: "set", value: "L" } },
    }),
  c1.id,
);
await page.waitForTimeout(1200);
const c6 = await cardCanvas();
const d6 = await cardDom();
record(
  "L-6 size L: title 16 · description 14, Canvas = Preview boxes",
  r6.ok &&
    c6?.title?.font[0] === 16 &&
    d6?.title?.font[0] === 16 &&
    c6?.description?.font[0] === 14 &&
    d6?.description?.font[0] === 14 &&
    near(c6?.title?.box, d6?.title?.box) &&
    near(c6?.description?.box, d6?.description?.box),
  {
    r6,
    canvas: { title: c6?.title, description: c6?.description },
    dom: { title: d6?.title, description: d6?.description },
  },
);
errorsAt.push(["L-6", errors.length]);

// L-7: an InlineAlert = Heading + Content > Description (S2), the description box Canvas = Preview.
await addFromPalette("Inline Alert", /^Inline ?Alert$/i);
await page.waitForTimeout(1500);
const c7 = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const alert = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "InlineAlert",
  );
  const kids = (r) => r.children.map((id) => root.canvasInputs.get(id));
  const content = kids(alert).find((r) => root.typeOf(r) === "Content");
  const description = content && kids(content)[0];
  const g = root.getGeometry(
    [alert.id, content?.id, description?.id].filter(Boolean),
  );
  return {
    types: kids(alert).map((r) => root.typeOf(r)),
    content: content && kids(content).map((r) => root.typeOf(r)),
    description: description && {
      size: description.props.size,
      font: description.visual.fontSize,
      height: Math.round(g.get(description.id).height * 10) / 10,
    },
  };
});
const d7 = await preview((doc) => {
  const alert = doc.querySelector(".react-aria-InlineAlert");
  if (!alert) return null;
  const d = alert.querySelector(".react-aria-Content > .react-aria-Text");
  return {
    children: [...alert.children].map((c) => c.className),
    description: d && {
      font: parseFloat(getComputedStyle(d).fontSize),
      height: Math.round(d.getBoundingClientRect().height * 10) / 10,
    },
  };
});
record(
  "L-7 palette InlineAlert = Heading + Content > Description (Canvas · Preview), description 14px · same height",
  JSON.stringify(c7?.types) === '["Heading","Content"]' &&
    JSON.stringify(c7?.content) === '["Description"]' &&
    d7?.children?.[1]?.includes("react-aria-Content") &&
    c7?.description?.font === d7?.description?.font &&
    Math.abs(
      (c7?.description?.height ?? 0) - (d7?.description?.height ?? -9),
    ) <= 1,
  { canvas: c7, dom: d7 },
);
errorsAt.push(["L-7", errors.length]);

// L-8: saved and reopened the same (title text, the Button in the Content, size L).
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
const c8 = await cardCanvas();
record(
  "L-8 saved and reopened: title 「Command + R」 · Content [Text, Text, Button] · size L",
  page.url() === projectUrl &&
    c8?.title?.text === "Command + R" &&
    JSON.stringify(c8?.contentTypes) === '["Text","Text","Button"]' &&
    c8?.title?.font[0] === 16,
  c8 && { title: c8.title.text, content: c8.contentTypes, font: c8.title.font },
);
record("L-9 no page errors", errors.length === 0, {
  errorsAt,
  errors: errors.slice(0, 3),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

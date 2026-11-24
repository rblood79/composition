#!/usr/bin/env node
// frame HTML 태그 · Layers 이름 · 그룹 이름 live (사용자 결정 2026-11-24):
//   1. Components 패널 「frame」 → Layers 행 이름 「Frame」
//   2a. Design 패널 「HTML tag」 칸에서 section 을 직접 고른다 — 고르기 실패는 그대로 FAIL (명령으로 대신 쓰지 않는다)
//   2b. Layers 행 이름 · 패널 제목 「section」
//   3. 그 frame 안에 Heading (level 1) — Canvas 글자 크기 = Publish h1 글자 크기 (section 안 h1 의 UA 축소 없음)
//   4. frame 둘 선택 → 액션 바 「Group」 → Layers 행 이름 「Group」 (문서 노드는 frame, 이름 Group)
//   5. Publish: 그 frame 이 <section>, 나머지는 <div>, role 없음
//   6. page error 0
//   7. 팔레트에 section 항목 없음 (Section 컴포넌트 삭제) · nav · frame 은 있음
//   8. 인스턴스 (Calendar) 안 frame 을 패널에서 header 로 → Layers 행 · 패널 제목 「header」 · Publish <header>
//   9. 여덟 태그 (div · main · section · header · footer · nav · article · aside) 의 상자 — Canvas 끼리 · Publish 끼리 같고 높이는 Canvas = Publish
//   10. slot frame (Popover content) 을 header 로 → Layers 행 · 패널 제목 둘 다 slot 이름 「content」
//   11. 페이지의 main — main frame 이 있으면 본문 div · main 1 개, 없으면 본문이 main (Publish)
//   12. 그룹 frame 을 패널에서 nav 로 → Layers 행 · 패널 제목 「nav」, div 로 되돌리면 「Group」
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/frame-element-type-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/frame-element-type-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};

/** Click a palette item; `keepSelection` puts it inside the selected node. */
const place = async (label, keepSelection = false) => {
  await openRail("components");
  if (!keepSelection)
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

const openDesign = async () => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(600);
  }
  await openRail("properties");
  await page.waitForTimeout(800);
};

/** The frames under the page body, in order: record id · node id · name · elementType. */
const frames = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const graph = ws.runtime.graph;
    return [...r.canvasInputs.values()]
      .filter((x) => r.typeOf(x) === "frame")
      .map((x) => {
        const entry = graph.getEntry(x.sourceId);
        return {
          record: x.id,
          node: x.sourceId,
          name: entry?.name,
          elementType: x.props.elementType,
          children: x.children.length,
        };
      });
  });

const selectRecords = (ids) =>
  page.evaluate((ids) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems(ids.map((id) => ws.itemOfRecord(id)));
  }, ids);

/** The Layers rows' names (Navigator). */
const layerNames = async () => {
  await openRail("navigator");
  const tree = page.getByRole("treegrid", { name: "Layers", exact: true });
  await tree.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);
  return tree
    .getByRole("row")
    .evaluateAll((rows) =>
      rows.map((row) => (row.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
};

const panel = page.locator(".panel-wrapper[data-panel='properties']");

/** Pick `value` in the Design panel's HTML tag field — the panel operation, nothing else. */
const pickTag = async (value) => {
  try {
    const field = panel
      .locator("fieldset", {
        has: page.locator("legend", { hasText: /HTML tag|HTML 태그/ }),
      })
      .first();
    await field.locator("button").first().click({ timeout: 5000 });
    await page
      .getByRole("option", { name: value, exact: true })
      .click({ timeout: 5000 });
    return { ok: true };
  } catch (error) {
    await page.keyboard.press("Escape").catch(() => {});
    return { ok: false, error: String(error).slice(0, 300) };
  }
};

/**
 * The selected Layers row's text. The tree is virtualized — a row below the fold is not in the DOM,
 * so the list is scrolled through until the selected row is drawn.
 */
const selectedLayerRow = async () => {
  await openRail("navigator");
  const tree = page.getByRole("treegrid", { name: "Layers", exact: true });
  await tree.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);
  for (let step = 0; step < 40; step += 1) {
    const selected = tree.locator('[role="row"][aria-selected="true"]').first();
    if ((await selected.count()) > 0)
      return (await selected.innerText()).replace(/\s+/g, " ").trim();
    const moved = await tree.evaluate((el, first) => {
      let box = el;
      while (box && box.scrollHeight <= box.clientHeight + 1)
        box = box.parentElement;
      if (!box) return false;
      const before = box.scrollTop;
      box.scrollTop = first ? 0 : before + box.clientHeight * 0.8;
      return first || box.scrollTop !== before;
    }, step === 0);
    await page.waitForTimeout(250);
    if (!moved) break;
  }
  return "";
};

/** Set-up only: write a record's `elementType` by command (never counted as the panel's pick). */
const writeTag = (recordId, value) =>
  page.evaluate(
    ({ recordId, value }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: { elementType: { kind: "set", value } },
        }),
      );
    },
    { recordId, value },
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("frame element live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Two frames; their rows are 「Frame」.
  await place(/^frame$/i);
  await place(/^frame$/i);
  const placed = await frames();
  const names1 = await layerNames();
  await page.screenshot({ path: `${OUT}/1-layers-frame.png` });
  record(
    "1 frame 둘 → Layers 행 이름 「Frame」 둘 (소문자 frame 없음)",
    placed.length === 2 &&
      names1.filter((name) => name === "Frame").length === 2 &&
      !names1.includes("frame"),
    { names: names1, placed: placed.length },
  );

  // 7. The palette has no Section item (deleted 2026-11-24 — a frame's HTML tag instead); Nav stays.
  await openRail("components");
  const paletteItem = (label) =>
    page.locator("button.list-item").filter({ hasText: label }).count();
  record(
    "7 팔레트에 section 항목 없음 · navigation (Nav) · frame 은 있음",
    (await paletteItem(/^section$/i)) === 0 &&
      (await paletteItem(/^navigation$/i)) > 0 &&
      (await paletteItem(/^frame$/i)) > 0,
    {
      section: await paletteItem(/^section$/i),
      nav: await paletteItem(/^navigation$/i),
      frame: await paletteItem(/^frame$/i),
    },
  );

  // 2. The Design panel's HTML tag field; pick section.
  await selectRecords([placed[0].record]);
  await openDesign();
  const panelText = await panel.innerText();
  const hasField = /HTML tag|HTML 태그/.test(panelText);
  // 2a. The pick itself is the check (리뷰 round 1 m2): a failed pick fails here. The write below
  //     only sets the later checks up — they judge their own consumers.
  const picked = await pickTag("section");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/2-design-html-tag.png` });
  const afterPick = await frames();
  record(
    "2a Design 패널 「HTML tag」 칸에서 section 을 직접 고른다 (패널 조작)",
    hasField && picked.ok && afterPick[0].elementType === "section",
    { hasField, picked, elementType: afterPick[0].elementType },
  );
  if (afterPick[0].elementType !== "section")
    await writeTag(placed[0].record, "section");
  await openDesign();
  const headerTitle = (
    await panel.locator(".panel-title").first().innerText()
  ).trim();
  const names2 = await layerNames();
  await page.screenshot({ path: `${OUT}/2-layers-section.png` });
  record(
    "2b section frame → Layers 행 「section」 + 「Frame」 · 패널 제목 「section」",
    names2.includes("section") &&
      names2.filter((name) => name === "Frame").length === 1 &&
      headerTitle === "section",
    { names: names2, headerTitle },
  );

  // 3. A Heading (level 1) inside the section frame: the Canvas size is what Publish draws.
  // (Heading is not a palette item: a command puts an h1 — and its Text — inside the frame.)
  const heading = await page.evaluate((frameNode) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const set = (value) => ({ kind: "set", value });
    const node = (id, def, children, props = {}) => ({
      kind: "node",
      id,
      definitionId: def,
      children,
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: frameNode },
        entries: [
          node(
            "project:node:live-h1",
            "lib:definition:heading",
            ["project:node:live-h1-t"],
            { level: set(1) },
          ),
          node("project:node:live-h1-t", "lib:definition:text", [], {
            children: set("Section title"),
          }),
        ],
        rootIds: ["project:node:live-h1"],
        newId: ws.newId,
      }),
    );
    const now = [...r.canvasInputs.values()].find(
      (x) => x.sourceId === "project:node:live-h1",
    );
    if (!now) return null;
    const parent = r.canvasInputs.get(now.parentId);
    return {
      id: now.id,
      parentType: parent && r.typeOf(parent),
      parentElement: parent?.props.elementType,
      fontSize: Number(now.derivedProps?.fontSize ?? now.visual.fontSize),
      fontWeight: Number(now.derivedProps?.fontWeight ?? now.visual.fontWeight),
    };
  }, placed[0].node);
  await page.waitForTimeout(600);

  // 4. Group the two frames (⌘G): a frame named 「Group」.
  const before = await frames();
  await selectRecords(
    before
      .filter((f) => placed.some((p) => p.node === f.node))
      .map((f) => f.record),
  );
  await page.waitForTimeout(800);
  // (The Contextual Action Bar's Group — the same command ⌘G runs; its name is the unified one.)
  const groupButton = page
    .getByRole("button", { name: /^(Group|그룹화)$/ })
    .first();
  const groupLabel = await groupButton
    .getAttribute("aria-label", { timeout: 10000 })
    .catch(() => null);
  await groupButton.click({ timeout: 10000 });
  await page.waitForTimeout(1000);
  const grouped = await frames();
  const group = grouped.find((f) => !before.some((b) => b.node === f.node));
  const names4 = await layerNames();
  await page.screenshot({ path: `${OUT}/4-layers-group.png` });
  record(
    "4 frame 둘 → 액션 바 Group → 새 frame 의 이름 「Group」 · Layers 행 「Group」",
    !!group &&
      group.name === "Group" &&
      group.children === 2 &&
      names4.includes("Group"),
    { group, names: names4, groupLabel },
  );

  // 12. The group set to an element (사용자 보고 2026-11-24 「group화 후 tag를 nav로 변경시 nav로
  //     나타나지않고 group로 유지된다」): the tag picked in the panel names the Layers row and the
  //     panel title; back to a div it reads 「Group」 again (the later Publish checks need a div).
  let groupNav = { picked: { ok: false }, row: "", title: "" };
  let groupDiv = { picked: { ok: false }, row: "", title: "" };
  if (group) {
    const readGroup = async (value) => {
      await selectRecords([
        (await frames()).find((f) => f.node === group.node).record,
      ]);
      await page.waitForTimeout(600);
      await openDesign();
      const picked = await pickTag(value);
      await page.waitForTimeout(800);
      const title = (
        await panel.locator(".panel-title").first().innerText()
      ).trim();
      const row = await selectedLayerRow();
      return { picked, row, title };
    };
    groupNav = await readGroup("nav");
    await page.screenshot({ path: `${OUT}/12-group-nav.png` });
    groupDiv = await readGroup("div");
  }
  record(
    "12 그룹 frame 을 패널에서 nav 로 → Layers 행 · 패널 제목 「nav」, div 로 되돌리면 「Group」",
    groupNav.picked.ok &&
      groupNav.row.split(" ")[0] === "nav" &&
      groupNav.title === "nav" &&
      groupDiv.picked.ok &&
      groupDiv.row.split(" ")[0] === "Group" &&
      groupDiv.title === "Group",
    { groupNav, groupDiv },
  );

  // 8. A frame inside an instance (리뷰 round 1 m1): a Calendar's inner frame, its tag picked in the
  //    panel — the Layers row and the panel title follow the instance's value.
  await place(/^calendar$/i);
  const innerFrame = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const inCalendar = (record) => {
      for (
        let at = r.canvasInputs.get(record.parentId);
        at;
        at = r.canvasInputs.get(at.parentId)
      )
        if (r.typeOf(at) === "Calendar") return true;
      return false;
    };
    const record = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "frame" && inCalendar(x),
    );
    if (!record) return null;
    const item = ws.itemOfRecord(record.id);
    ws.selectItems([item]);
    return { record: record.id, targetKind: item.target.kind };
  });
  let innerPicked = { ok: false, error: "no frame inside the Calendar" };
  let innerTitle = "";
  let innerRow = "";
  let innerElement;
  if (innerFrame) {
    await openDesign();
    innerPicked = await pickTag("header");
    await page.waitForTimeout(800);
    innerElement = await page.evaluate(
      (id) =>
        window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
          ?.props.elementType,
      innerFrame.record,
    );
    await openDesign();
    innerTitle = (
      await panel.locator(".panel-title").first().innerText()
    ).trim();
    innerRow = await selectedLayerRow();
    await page.screenshot({ path: `${OUT}/8-instance-frame.png` });
  }
  record(
    "8 인스턴스 (Calendar) 안 frame — 패널에서 header 선택 → Layers 행 · 패널 제목 「header」",
    !!innerFrame &&
      innerFrame.targetKind === "descendant" &&
      innerPicked.ok &&
      innerElement === "header" &&
      innerTitle === "header" &&
      innerRow === "header",
    { innerFrame, innerPicked, innerElement, innerTitle, innerRow },
  );

  // 10. A slot frame (리뷰 round 2 m3): a Popover's `content` frame, its tag picked in the panel —
  //     the Layers row and the panel title both keep the slot's name; the element still changes.
  await place(/^popover$/i);
  const slotFrame = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const templates = ws.runtime.graph.library.templates;
    for (const record of r.canvasInputs.values()) {
      if (r.typeOf(record) !== "frame") continue;
      const item = ws.itemOfRecord(record.id);
      if (item?.target.kind !== "descendant") continue;
      const slot = templates.get(item.target.address.templatePath.at(-1))?.slot
        ?.name;
      if (slot !== "content") continue;
      ws.selectItems([item]);
      return { record: record.id, slot };
    }
    return null;
  });
  let slotPicked = { ok: false, error: "no content slot frame in the Popover" };
  let slotTitle = "";
  let slotRow = "";
  let slotElement;
  if (slotFrame) {
    await openDesign();
    slotPicked = await pickTag("header");
    await page.waitForTimeout(800);
    slotElement = await page.evaluate(
      (id) =>
        window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
          ?.props.elementType,
      slotFrame.record,
    );
    await openDesign();
    slotTitle = (
      await panel.locator(".panel-title").first().innerText()
    ).trim();
    slotRow = await selectedLayerRow();
    await page.screenshot({ path: `${OUT}/10-slot-frame.png` });
  }
  record(
    "10 slot frame (Popover content) — 패널에서 header 선택 → 값은 header, Layers 행 · 패널 제목은 둘 다 「content」",
    !!slotFrame &&
      slotPicked.ok &&
      slotElement === "header" &&
      slotTitle === "content" &&
      // (The row writes its name and its slot badge — both the slot's name, never the element.)
      slotRow.length > 0 &&
      slotRow.split(" ").every((word) => word === "content"),
    { slotFrame, slotPicked, slotElement, slotTitle, slotRow },
  );

  // 9. The eight elements draw the same box (HC2): one frame per tag with the same content — the
  //    Canvas boxes are equal to each other, the Publish boxes are equal to each other, and the
  //    height is the same on both. (Set-up by command — the check is the two consumers' boxes.)
  const TAGS = [
    "div",
    "main",
    "section",
    "header",
    "footer",
    "nav",
    "article",
    "aside",
  ];
  const canvasBoxes = await page.evaluate((tags) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const set = (value) => ({ kind: "set", value });
    const node = (id, def, children, props = {}, visual = {}) => ({
      kind: "node",
      id,
      definitionId: def,
      children,
      props,
      visual,
      sizing: {},
      descendantOverrides: [],
    });
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: tags.flatMap((tag) => [
          node(
            `project:node:box-${tag}`,
            "lib:definition:type-frame",
            [`project:node:box-${tag}-t`],
            { elementType: set(tag) },
            {
              paddingTop: set(12),
              paddingBottom: set(12),
              paddingLeft: set(16),
              paddingRight: set(16),
            },
          ),
          node(`project:node:box-${tag}-t`, "lib:definition:text", [], {
            children: set("Same box"),
          }),
        ]),
        rootIds: tags.map((tag) => `project:node:box-${tag}`),
        newId: ws.newId,
      }),
    );
    return tags.map((tag) => {
      const record = [...r.canvasInputs.values()].find(
        (x) => x.sourceId === `project:node:box-${tag}`,
      );
      const box = record && r.getGeometry([record.id]).get(record.id);
      return { tag, width: box?.width, height: box?.height };
    });
  }, TAGS);
  await page.waitForTimeout(800);

  // 5. Publish: the tags.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector("section[data-catalog-id]", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const dom = await pub.evaluate(
    ({ ids, headingId }) => {
      const of = (id) =>
        document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      // (Grouping moved the Heading under the group: its record id changed, its node id did not.)
      const drawn = document.querySelector(
        `[data-catalog-id$="::${CSS.escape(headingId)}"]`,
      );
      const h = drawn?.matches("h1,h2,h3,h4,h5,h6")
        ? drawn
        : drawn?.querySelector("h1,h2,h3,h4,h5,h6");
      const cs = h && getComputedStyle(h);
      return {
        frames: ids.map((id) => ({
          tag: of(id)?.tagName.toLowerCase(),
          role: of(id)?.getAttribute("role"),
          attr: of(id)?.hasAttribute("elementtype"),
        })),
        heading: h && {
          tag: h.tagName.toLowerCase(),
          inSection: !!h.closest("section"),
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight),
          marginTop: cs.marginTop,
        },
      };
    },
    { ids: grouped.map((f) => f.record), headingId: "project:node:live-h1" },
  );
  await pub.screenshot({ path: `${OUT}/5-publish.png` });
  const byNode = grouped.map((f, index) => ({ ...f, ...dom.frames[index] }));
  record(
    "5 Publish: section frame = <section>, 나머지 frame = <div>, role · elementType 속성 없음",
    byNode.every(
      (f) =>
        f.tag === (f.elementType === "section" ? "section" : "div") &&
        f.role === null &&
        f.attr === false,
    ) && byNode.some((f) => f.tag === "section"),
    byNode.map(({ name, elementType, tag, role }) => ({
      name,
      elementType,
      tag,
      role,
    })),
  );
  record(
    "3 section 안 Heading level 1 — Canvas 글자 = Publish h1 (크기 · 굵기)",
    !!heading &&
      !!dom.heading &&
      dom.heading.tag === "h1" &&
      dom.heading.inSection &&
      Math.abs(dom.heading.fontSize - heading.fontSize) <= 0.05 &&
      dom.heading.fontWeight === heading.fontWeight,
    { canvas: heading, publish: dom.heading },
  );
  const publishExtra = await pub.evaluate(
    ({ tags, innerId }) => ({
      inner: innerId
        ? document
            .querySelector(`[data-catalog-id="${CSS.escape(innerId)}"]`)
            ?.tagName.toLowerCase()
        : null,
      boxes: tags.map((tag) => {
        const el = document.querySelector(
          `[data-catalog-id$="::project:node:box-${tag}"]`,
        );
        const rect = el?.getBoundingClientRect();
        return {
          tag,
          element: el?.tagName.toLowerCase(),
          width: rect?.width,
          height: rect?.height,
        };
      }),
    }),
    { tags: TAGS, innerId: innerFrame?.record ?? null },
  );
  record(
    "8b Publish: 그 인스턴스 안 frame 이 <header>",
    publishExtra.inner === "header",
    { element: publishExtra.inner },
  );
  const same = (values) => values.every((v) => Math.abs(v - values[0]) <= 0.5);
  record(
    "9 여덟 태그의 상자 — Canvas 끼리 같고 · Publish 끼리 같고 · 높이는 Canvas = Publish",
    canvasBoxes.every((b) => b.width > 0 && b.height > 0) &&
      publishExtra.boxes.every((b) => b.element === b.tag && b.height > 0) &&
      same(canvasBoxes.map((b) => b.width)) &&
      same(canvasBoxes.map((b) => b.height)) &&
      same(publishExtra.boxes.map((b) => b.width)) &&
      same(publishExtra.boxes.map((b) => b.height)) &&
      Math.abs(canvasBoxes[0].height - publishExtra.boxes[0].height) <= 0.5,
    { canvas: canvasBoxes, publish: publishExtra.boxes },
  );
  // 11. The page's main (사용자 결정 「페이지 본문 = main」): with a frame set as `main` the body is a
  //     `div` and there is one `<main>`; without one (the frame back to a `div`, Publish read again)
  //     the body itself is the `<main>`.
  const mainState = (target = pub) =>
    target.evaluate(() => ({
      body: document.querySelector(".react-aria-Body")?.tagName.toLowerCase(),
      mains: document.querySelectorAll("main").length,
      nested: document.querySelectorAll("main main").length,
    }));
  const withFrame = await mainState();
  await page.evaluate(() => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: "project:node:box-main" }],
        props: { elementType: { kind: "set", value: "div" } },
      }),
    );
  });
  await page.waitForTimeout(2500); // autosave
  // (A Publish window shows the document as it was opened — it is opened again.)
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub2 = await popup2;
  pub2.on("pageerror", (e) => errors.push(`publish 2: ${e.message}`));
  await pub2.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub2.waitForSelector(".react-aria-Body", { timeout: 60000 });
  await pub2.waitForTimeout(1500);
  const withoutFrame = await mainState(pub2);
  await pub2.screenshot({ path: `${OUT}/11-publish-main.png` });
  record(
    "11 페이지의 main — main frame 이 있으면 본문 div · main 1 개, 없으면 본문이 main (중첩 0)",
    withFrame.body === "div" &&
      withFrame.mains === 1 &&
      withFrame.nested === 0 &&
      withoutFrame.body === "main" &&
      withoutFrame.mains === 1 &&
      withoutFrame.nested === 0,
    { withFrame, withoutFrame },
  );
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("6 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);

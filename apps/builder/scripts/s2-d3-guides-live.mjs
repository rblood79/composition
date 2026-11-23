#!/usr/bin/env node
// S2 체크리스트 부록 D.3 1단계 live (2026-11-23 — 구현은 있고 브라우저 장면 확인이 없던 것):
//   1. forms: Form 의 Name 에 minLength 3 — 「ab」 로 submit 은 막히고 (invalid), 「abc」 로 고쳐 칸을 떠나면 (Tab) onSubmit 실행
//   2. dnd: 연결된 ListBox — 키보드 끌기 (Enter → ArrowDown → Enter) 가 onReorder 를 실행
//   3. dnd: DropZone 에 파일을 놓으면 onDrop 실행
//   4. overlay: DialogTrigger — Escape 로 닫으면 focus 가 trigger 로 돌아온다
//   5. overlay: Dialog 안 Select — Escape 하나는 Select 만 닫고 Dialog 는 남는다, 둘째 Escape 가 Dialog 를 닫는다
//   6. motion: reduced-motion 에서 Menu Popover 의 등장 animation 이 없다 (0s)
//   7. Popover containerPadding 40 — 화면 밖으로 밀린 Popover 는 가장자리에서 40 (RAC calculatePosition)
//   8. Canvas = Publish — 상자 크기 (Form · 연결 ListBox · DropZone · 160px Select 긴 placeholder) · 긴 글자는 한 줄 말줄임
//   9. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-d3-guides-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-d3-guides-live";
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
  viewport: { width: 1600, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const toasts = (pub) =>
  pub.evaluate(() =>
    [...document.querySelectorAll("[role=alertdialog], [role=alert], .react-aria-Toast")]
      .map((t) => t.textContent ?? "")
      .join(" | "),
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("d3 guides live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const placed = await page.evaluate(async () => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const { useDataStore } = await import("/src/builder/stores/data.ts");
    const ix = await import("/src/builder/catalogRuntime/interactions.ts");
    await useDataStore.getState().applyDataChange(
      {
        origin: "user",
        ops: [
          {
            op: "create_collection",
            id: "people",
            name: "People",
            schema: [
              { id: "p-id", key: "id", type: "string" },
              { id: "p-name", key: "name", type: "string" },
            ],
          },
          {
            op: "insert_rows",
            collectionId: "people",
            rows: [
              { id: "a", name: "Alpha" },
              { id: "b", name: "Bravo" },
              { id: "c", name: "Charlie" },
            ],
          },
        ],
      },
      { projectId: location.pathname.split("/").at(-1) },
    );
    const ctx = (selection) => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    const add = (type, selection = []) => {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx(selection), type).command);
      return [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      );
    };
    const fresh = (type, since) =>
      [...r.canvasInputs.values()].filter(
        (x) => r.typeOf(x) === type && !since.has(x.id),
      );
    const rule = (source, trigger, message) => {
      const owner = { ownerId: source };
      ws.execute(
        ix.catalogInteractionsCommand(
          owner,
          [ix.catalogNewInteraction(owner, trigger, { opcode: "toast", message }, ws.newId)],
          "Rules",
        ),
      );
    };
    const set = (source, props) =>
      ws.execute(
        h.commands.setFields({
          targets: [{ kind: "node", id: source }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );

    // 1. Form — the Name field gets minLength 3
    const before = new Set(r.canvasInputs.keys());
    const form = add("Form");
    const name = fresh("TextField", before)[0];
    set(name.sourceId, { minLength: 3 });
    rule(form.sourceId, "onSubmit", "form submitted");
    // 2. a bound ListBox with an onReorder rule
    const list = add("ListBox");
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: list.sourceId }],
        h.binding.catalogBindingRef({ source: "dataTable", collectionId: "people", name: "People" }),
      ),
    );
    rule(list.sourceId, "onReorder", "list reordered");
    // 3. a DropZone with an onDrop rule
    const zone = add("DropZone");
    rule(zone.sourceId, "onDrop", "zone dropped");
    // 4 · 5. a DialogTrigger, a Select inside its Dialog's content
    const sinceDialog = new Set(r.canvasInputs.keys());
    add("Dialog");
    const contentText = fresh("Text", sinceDialog).find((x) => {
      let at = x;
      while (at?.parentId) {
        at = r.canvasInputs.get(at.parentId);
        if (at && r.typeOf(at) === "Dialog") return true;
      }
      return false;
    });
    const select = contentText ? add("Select", [ws.itemOfRecord(contentText.id)]) : undefined;
    // 6. a Menu
    add("Menu");
    // 7. a Popover with containerPadding 40, pushed past the left edge by crossOffset −600
    const sincePopover = new Set(r.canvasInputs.keys());
    add("Popover");
    const popover = fresh("Popover", sincePopover)[0];
    // (a Popover inside the origin is a template place — the Properties panel's patch command)
    const edit = await import("/src/builder/catalogRuntime/editContract.ts");
    ws.execute(
      edit.catalogPropertiesPatchCommand(
        ws.runtime.graph,
        [ws.itemOfRecord(popover.id).target],
        { containerPadding: 40, placement: "bottom", crossOffset: -600 },
        () => undefined,
        new Set(),
      ),
    );
    // 8. long text: a 160px Select with a long placeholder
    const styles = await import("/src/builder/catalogRuntime/styleFields.ts");
    const longSelect = add("Select");
    set(longSelect.sourceId, {
      placeholder: "Choose one of the very long option names that cannot fit",
    });
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: longSelect.sourceId }],
        ...styles.catalogStyleWrites("width", "160px"),
      }),
    );
    ws.selectRecords([]);
    const roots = { Form: form, ListBox: list, DropZone: zone, LongSelect: longSelect };
    return {
      name: name.sourceId,
      select: !!select,
      roots: Object.fromEntries(Object.entries(roots).map(([k, v]) => [k, v.sourceId])),
    };
  });
  record("0. fixture", placed.select, placed);
  await page.waitForTimeout(1200);
  const canvasSizes = await page.evaluate((roots) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const out = {};
    for (const [key, source] of Object.entries(roots)) {
      const id = r.recordsOfSource(source)[0];
      const g = id && r.getGeometry([id]).get(id);
      out[key] = g && { width: Math.round(g.width), height: Math.round(g.height) };
    }
    return out;
  }, placed.roots);

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Form", { timeout: 60000 });
  await pub.waitForTimeout(2000);

  // 1. Form minLength
  const form = pub.locator(".react-aria-Form").first();
  const nameInput = form.locator("input").nth(0);
  const emailInput = form.locator("input").nth(1);
  await nameInput.fill("ab");
  await emailInput.fill("a@b.co");
  await form.locator("button[type=submit]").click();
  await pub.waitForTimeout(400);
  const blocked = {
    invalid: await nameInput.getAttribute("aria-invalid"),
    toast: await toasts(pub),
  };
  await pub.evaluate(() => {
    window.__d3Submits = [];
    document.addEventListener("submit", (e) => window.__d3Submits.push(e.defaultPrevented), true);
  });
  await nameInput.fill("abc");
  // (RAC commits a text field's validation on its `change` — the blur — and S2 the same: the error
  //  stays while typing and leaves on the blur, moving the button up; a click that starts the blur
  //  ends off the button. The user leaves the field first.)
  await nameInput.press("Tab");
  await form.locator("button[type=submit]").click();
  await pub.waitForTimeout(600);
  const passed = {
    invalid: await nameInput.getAttribute("aria-invalid"),
    toast: await toasts(pub),
    submits: await pub.evaluate(() => window.__d3Submits),
    validity: await pub.evaluate(() =>
      [...document.querySelectorAll(".react-aria-Form input")].map((i) => [i.name, i.value, i.validity.valid, i.validationMessage]),
    ),
  };
  record(
    "1. forms — minLength 3: 「ab」 막힘 (invalid · onSubmit 없음) · 「abc」 제출",
    blocked.invalid === "true" && !blocked.toast.includes("form submitted") &&
      passed.invalid !== "true" && passed.toast.includes("form submitted"),
    { blocked, passed },
  );

  // 2. keyboard drag in the bound ListBox
  const options = pub.locator(".react-aria-ListBox [role=option]");
  await options.first().waitFor({ timeout: 10000 });
  const firstOption = options.first();
  await firstOption.focus();
  await pub.keyboard.press("ArrowDown");
  await pub.keyboard.press("ArrowUp");
  const describedby = await firstOption.getAttribute("aria-describedby");
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const dragging = await pub.evaluate(() => !!document.querySelector("[data-drop-target], .react-aria-DropIndicator"));
  await pub.keyboard.press("ArrowDown");
  await pub.waitForTimeout(150);
  await pub.keyboard.press("ArrowDown");
  await pub.waitForTimeout(150);
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(800);
  const reorderToast = await toasts(pub);
  record(
    "2. dnd — 키보드 끌기 (Enter · ArrowDown · Enter) 가 onReorder 실행",
    reorderToast.includes("list reordered"),
    { describedby, dragging, toast: reorderToast },
  );
  await pub.keyboard.press("Escape");

  // 3. a file dropped on the DropZone
  const zone = pub.locator(".react-aria-DropZone").first();
  await zone.scrollIntoViewIfNeeded();
  const dt = await pub.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["hello"], "hello.txt", { type: "text/plain" }));
    return transfer;
  });
  const box = await zone.boundingBox();
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await zone.dispatchEvent("dragenter", { dataTransfer: dt, ...at });
  await zone.dispatchEvent("dragover", { dataTransfer: dt, ...at });
  await pub.waitForTimeout(100);
  await zone.dispatchEvent("dragover", { dataTransfer: dt, ...at });
  await zone.dispatchEvent("drop", { dataTransfer: dt, ...at });
  await pub.waitForTimeout(800);
  const dropToast = await toasts(pub);
  record("3. dnd — DropZone 에 파일 → onDrop 실행", dropToast.includes("zone dropped"), {
    toast: dropToast,
  });

  // 4 · 5. Dialog focus return · Select inside the Dialog
  const trigger = pub.locator('button[data-catalog-id$="component-dialog__1"]').first();
  await trigger.click();
  await pub.waitForSelector("[role=dialog]", { timeout: 5000 });
  await pub.waitForTimeout(400);
  const dialogSelect = pub.locator("[role=dialog] .react-aria-Select button").first();
  const hasSelect = (await dialogSelect.count()) > 0;
  let nested = { hasSelect };
  if (hasSelect) {
    await dialogSelect.click();
    // (the page's own ListBox is a listbox too — the Select's is in its Popover)
    await pub.waitForSelector(".react-aria-Popover [role=listbox]", { timeout: 5000 });
    nested.opened = true;
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(400);
    nested = {
      ...nested,
      afterFirst: await pub.evaluate(() => ({
        listbox: !!document.querySelector(".react-aria-Popover [role=listbox]"),
        dialog: !!document.querySelector("[role=dialog]"),
        focusInSelect: !!document.activeElement?.closest(".react-aria-Select"),
      })),
    };
  }
  await pub.screenshot({ path: `${OUT}/5-dialog-select.png` });
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(500);
  const afterClose = await pub.evaluate(() => ({
    dialog: !!document.querySelector("[role=dialog]"),
    focusOnTrigger: !!document.activeElement?.getAttribute("data-catalog-id")?.endsWith("component-dialog__1"),
    active: document.activeElement?.outerHTML.slice(0, 160),
  }));
  record(
    "4. overlay — Dialog 를 Escape 로 닫으면 focus 가 trigger 로",
    !afterClose.dialog && afterClose.focusOnTrigger,
    afterClose,
  );
  record(
    "5. overlay — Dialog 안 Select: 첫 Escape 는 Select 만 닫음 · 둘째가 Dialog",
    hasSelect && nested.afterFirst?.listbox === false && nested.afterFirst?.dialog === true &&
      nested.afterFirst?.focusInSelect && !afterClose.dialog,
    nested,
  );

  // 6. reduced motion — the Menu's Popover enters without an animation
  const menuButton = pub.locator('button[data-catalog-id$="component-menu__trigger"]').first();
  await menuButton.click();
  await pub.waitForSelector("[role=menu]", { timeout: 5000 });
  const motion = await pub.evaluate(() => {
    const popover = document.querySelector("[role=menu]")?.closest(".react-aria-Popover");
    if (!popover) return null;
    const s = getComputedStyle(popover);
    return {
      reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationName: s.animationName,
      animationDuration: s.animationDuration,
      transitionDuration: s.transitionDuration,
      running: popover.getAnimations().map((a) => a.effect?.getTiming?.().duration),
    };
  });
  record(
    "6. motion — reduced-motion 에서 Menu Popover 등장 animation 없음",
    !!motion && motion.reduce &&
      (motion.animationName === "none" || /^0s(, 0s)*$/.test(motion.animationDuration)) &&
      motion.running.every((d) => !d),
    motion,
  );
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(400);

  // 7. containerPadding — the Popover keeps 40px from the viewport edge (RAC calculatePosition)
  const popTrigger = pub.locator('button[data-catalog-id$="component-popover__trigger"], [data-catalog-id*="component-popover"] button').first();
  await popTrigger.scrollIntoViewIfNeeded();
  const triggerBox = await popTrigger.boundingBox();
  await popTrigger.click();
  await pub.waitForTimeout(600);
  const popBox = await pub.evaluate(() => {
    const el = [...document.querySelectorAll(".react-aria-Popover")].find((p) => !p.querySelector("[role=menu], [role=listbox]"));
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, width: b.width, vw: innerWidth };
  });
  const centered =
    triggerBox && popBox && triggerBox.x + triggerBox.width / 2 - popBox.width / 2 - 600;
  record(
    "7. Popover containerPadding 40 — crossOffset 으로 왼쪽 밖이면 x = 40 (Canvas 도 같은 식)",
    !!popBox && centered < 40 && Math.abs(popBox.x - 40) < 1,
    { triggerBox, popBox, centered },
  );
  await pub.keyboard.press("Escape");
  await pub.waitForTimeout(300);

  // 8. Canvas = Publish — box sizes; the long Select stays one line, cut with an ellipsis
  //     (the Canvas page is 1920 wide — Publish measured at the same width)
  await pub.setViewportSize({ width: 1920, height: 1000 });
  await pub.waitForTimeout(600);
  const publishSizes = await pub.evaluate((roots) => {
    const out = {};
    for (const [key, source] of Object.entries(roots)) {
      const el = document.querySelector(`[data-catalog-id$="${source}"]`);
      const b = el?.getBoundingClientRect();
      out[key] = b && { width: Math.round(b.width), height: Math.round(b.height) };
    }
    const value = document
      .querySelector(`[data-catalog-id$="${roots.LongSelect}"]`)
      ?.querySelector(".react-aria-SelectValue");
    out.longValue = value && {
      cut: value.scrollWidth > value.clientWidth,
      overflow: getComputedStyle(value).textOverflow,
      whiteSpace: getComputedStyle(value).whiteSpace,
    };
    return out;
  }, placed.roots);
  const sizeDiff = Object.keys(canvasSizes).filter((key) => {
    const c = canvasSizes[key];
    const p = publishSizes[key];
    return !c || !p || Math.abs(c.width - p.width) > 1 || Math.abs(c.height - p.height) > 1;
  });
  record(
    "8. Canvas = Publish — Form · ListBox · DropZone · 긴 글자 Select 크기 (±1) · 긴 글자는 한 줄 말줄임",
    sizeDiff.length === 0 && publishSizes.longValue?.cut && publishSizes.longValue.overflow === "ellipsis",
    { canvasSizes, publishSizes, sizeDiff },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("9. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}

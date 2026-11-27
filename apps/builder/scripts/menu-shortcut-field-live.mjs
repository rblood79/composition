#!/usr/bin/env node
// MenuItem shortcut field (사용자 결정 2026-11-28 — 「토글 버튼 그룹 (⌘ · ⌥ · ⇧) + 키 입력, cmd 가 아닌 ⌘,
// 운영체제에 따라서 토글 버튼이 다르게」 · 「actionMenu 도 같은 패턴」):
//   1. Menu: select an item → Design 「Shortcut」 is the modifier toggles (no switch) — this
//      platform's (macOS here: ⌃ ⌥ ⇧ ⌘) — and a Key field
//   2. ⌘ + ⇧ + key 「k」 → the item's Keyboard text is 「⇧⌘K」
//   2b. every modifier off → no shortcut; on again → back
//   2c. Icon: no switch — pick an icon on the item, ✕ hides it
//   2d. Description: no switch — a text on the item shows it, empty hides it
//   2e. Label: its text field, no 「Required」 row
//   2f. Content · Collection follow the field pattern: no notice · no nested fieldset
//   3. ActionMenu: the same field on its item (template 「⌘C」) → ⌘ off · ⌥ on · 「p」 → 「⌥P」
//   4. Publish: each menu, opened, shows the shortcut at the item's end (`kbd`)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/menu-shortcut-field-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/menu-shortcut-field-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 600)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** Per placed component (the page body's children, in order): its first MenuItem · its Keyboard text. */
const placedItems = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const under = (top, out = []) => {
      out.push(top);
      for (const id of top.children ?? []) {
        const child = r.canvasInputs.get(id);
        if (child) under(child, out);
      }
      return out;
    };
    const items = all.filter((x) => r.typeOf(x) === "MenuItem");
    const top = (x) => {
      let at = x;
      for (;;) {
        const parent = r.canvasInputs.get(at.parentId);
        if (!parent || !r.canvasInputs.get(parent.parentId)) return at;
        at = parent;
      }
    };
    const tops = [...new Set(items.map((x) => top(x).id))];
    return tops.map((topId) => {
      const menuItem = items.find((x) => top(x).id === topId);
      const keyboard = under(menuItem).find((x) => r.typeOf(x) === "Keyboard");
      return {
        top: r.typeOf(r.canvasInputs.get(topId)),
        topId,
        id: menuItem.id,
        keyboard: keyboard ? String(keyboard.props.children) : null,
        keyboardHidden: keyboard?.hidden ?? null,
      };
    });
  });

const select = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, id);

/** The item's Shortcut field: its modifier toggles (no on/off switch — 사용자 2026-11-28). */
async function openField() {
  const group = page.getByRole("group", { name: /^(Shortcut|단축키)$/ }).first();
  await group.waitFor({ state: "visible", timeout: 15000 });
  const switches = await page
    .getByRole("switch", { name: /^(Shortcut|단축키)$/ })
    .count();
  if (switches) throw new Error("the Shortcut switch is still drawn");
  return group;
}

async function setShortcut(group, modifiers, key) {
  for (const name of modifiers) {
    await group.getByRole("button", { name }).click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    // (The key is the Shortcut row's action cell, under its legend 「Key」.)
    for (const legend of document.querySelectorAll("fieldset > legend"))
      if (/^(Key|키)$/.test(legend.textContent?.trim() ?? ""))
        legend.parentElement
          .querySelector("input")
          ?.setAttribute("data-live-key", "");
  });
  const keyInput = page.locator("[data-live-key]").last();
  if (key !== undefined) {
    await keyInput.click();
    await keyInput.fill(key);
    await keyInput.press("Enter");
    await page.waitForTimeout(600);
  }
}

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("menu shortcut field live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  for (const name of [/^menu$/i, /^action ?menu$/i]) {
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
    const entry = page
      .locator("button, [role='button'], [role='option'], [role='gridcell']")
      .filter({ hasText: name })
      .first();
    await entry.waitFor({ state: "visible", timeout: 15000 });
    await entry.click();
    await page.waitForTimeout(1500);
  }
  const properties = railButton(page, "properties");

  // 1 · 2. Menu.
  const placed = await placedItems();
  record("0 two placed menus with items", placed.length === 2, placed);
  await select(placed[0].id);
  await page.waitForTimeout(800);
  if ((await properties.getAttribute("aria-pressed")) !== "true") {
    await properties.click();
    await page.waitForTimeout(900);
  }
  const group = await openField();
  const chips = await group
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((b) => [b.textContent?.trim(), b.getAttribute("aria-label")]),
    );
  const platform = await page.evaluate(() => navigator.platform);
  record(
    "1 the toggles are this platform's (macOS: ⌃ ⌥ ⇧ ⌘ — Control · Option · Shift · Command)",
    platform.includes("Mac") &&
      JSON.stringify(chips) ===
        JSON.stringify([
          ["⌃", "Control"],
          ["⌥", "Option"],
          ["⇧", "Shift"],
          ["⌘", "Command"],
        ]),
    { platform, chips },
  );
  await setShortcut(group, ["Command", "Shift"], "k");
  const menuAfter = (await placedItems())[0];
  record(
    "2 Menu: ⌘ + ⇧ + k writes 「⇧⌘K」 on the item's Keyboard",
    menuAfter.keyboard === "⇧⌘K" && menuAfter.keyboardHidden !== true,
    menuAfter,
  );
  await page.screenshot({ path: `${OUT}/1-menu-field.png` });
  await setShortcut(group, ["Command", "Shift"]);
  const off = (await placedItems())[0];
  await setShortcut(group, ["Shift", "Command"]);
  const on = (await placedItems())[0];
  record(
    "2b no modifier on → no shortcut (the key stays); a modifier again → 「⇧⌘K」",
    (off.keyboard === null || off.keyboardHidden === true) &&
      on.keyboard === "⇧⌘K" &&
      on.keyboardHidden !== true,
    { off, on },
  );

  // 2c. Icon: no switch — pick an icon on the item itself, ✕ hides it.
  const iconSwitches = await page
    .getByRole("switch", { name: /^(Icon|아이콘)$/ })
    .count();
  const iconField = page
    .locator("fieldset")
    .filter({
      has: page.locator(":scope > legend", { hasText: /^(Icon|아이콘)$/ }),
    })
    .first();
  await iconField.locator(".icon-picker-input-trigger").click();
  await page.locator(".icon-picker-search-input").fill("star");
  await page.waitForTimeout(600);
  const picked = page.locator(".icon-picker-item").first();
  const pickedName = await picked.evaluate(
    (el) => el.getAttribute("data-key") ?? el.getAttribute("aria-label") ?? el.textContent,
  );
  await picked.click();
  await page.waitForTimeout(800);
  const iconOn = await page.evaluate((id) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const icon = r.canvasInputs
      .get(id)
      .children.map((c) => r.canvasInputs.get(c))
      .find((x) => x && r.typeOf(x) === "Icon" && x.props.slot === "icon");
    return icon ? { name: icon.props.iconName, hidden: icon.hidden ?? null } : null;
  }, placed[0].id);
  await iconField.locator(".icon-picker-clear").click();
  await page.waitForTimeout(800);
  const iconOff = await page.evaluate((id) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const icon = r.canvasInputs
      .get(id)
      .children.map((c) => r.canvasInputs.get(c))
      .find((x) => x && r.typeOf(x) === "Icon" && x.props.slot === "icon");
    return icon ? { name: icon.props.iconName, hidden: icon.hidden ?? null } : null;
  }, placed[0].id);
  record(
    "2c Icon: no switch · picking an icon shows it on the item · ✕ hides it",
    iconSwitches === 0 &&
      !!pickedName &&
      iconOn?.name === pickedName.trim() &&
      iconOn?.hidden !== true &&
      (iconOff === null || iconOff.hidden === true),
    { iconSwitches, pickedName, iconOn, iconOff },
  );
  // (Shown again for Publish.)
  await iconField.locator(".icon-picker-input-trigger").click();
  await page.locator(".icon-picker-search-input").fill("star");
  await page.waitForTimeout(600);
  await page.locator(".icon-picker-item").first().click();
  await page.waitForTimeout(800);

  // 2d. Description: no switch — a text on the item itself shows it, an empty text hides it.
  const descriptionOf = () =>
    page.evaluate((id) => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      const text = r.canvasInputs
        .get(id)
        .children.map((c) => r.canvasInputs.get(c))
        .find((x) => x && x.props.slot === "description");
      return text
        ? { text: String(text.props.children), hidden: text.hidden ?? null }
        : null;
    }, placed[0].id);
  const descriptionSwitches = await page
    .getByRole("switch", { name: /^(Description|설명)$/ })
    .count();
  const typeDescription = async (value) => {
    await page.evaluate(() => {
      for (const legend of document.querySelectorAll("fieldset > legend"))
        if (/^(Description|설명)$/.test(legend.textContent?.trim() ?? ""))
          legend.parentElement
            .querySelector("input, textarea")
            ?.setAttribute("data-live-description", "");
    });
    const input = page.locator("[data-live-description]").last();
    await input.click();
    await input.fill(value);
    await input.press("Enter");
    await page.waitForTimeout(800);
  };
  await typeDescription("Open the file");
  const descriptionOn = await descriptionOf();
  await typeDescription("");
  const descriptionOff = await descriptionOf();
  await typeDescription("Open the file");
  record(
    "2d Description: no switch · a text shows it on the item · empty hides it",
    descriptionSwitches === 0 &&
      descriptionOn?.text === "Open the file" &&
      descriptionOn.hidden !== true &&
      (descriptionOff === null || descriptionOff.hidden === true),
    { descriptionSwitches, descriptionOn, descriptionOff },
  );

  // 2e. Label: no 「Required」 row — its text field.
  const labelShown = await page.evaluate(() => {
    for (const legend of document.querySelectorAll("fieldset > legend"))
      if (/^(Label|라벨|레이블)$/.test(legend.textContent?.trim() ?? ""))
        return legend.parentElement.querySelector("input")?.value ?? null;
    return null;
  });
  const requiredRows = await page.getByText(/^(Required|필수)$/).count();
  record(
    "2e Label: its text field (「Menu Item 1」), no 「Required」 row",
    labelShown === "Menu Item 1" && requiredRows === 0,
    { labelShown, requiredRows },
  );

  // 2f. The sections' children follow the panel's field pattern (사용자 2026-11-28): no notice
  //     paragraph in Content, no fieldset inside a fieldset, a `.fieldset-row` holds fieldsets.
  const structure = await page.evaluate(() => {
    const out = {};
    for (const section of document.querySelectorAll(
      '.panel-wrapper[data-panel="properties"] .section',
    )) {
      const title = section.querySelector(".section-title")?.textContent?.trim();
      if (title !== "Component" && title !== "Content" && title !== "Collection") continue;
      const content = section.querySelector(".section-content");
      out[title] = {
        children: [...content.children].map((child) =>
          child.classList.contains("fieldset-row")
            ? `row(${[...child.children]
                .map((c) =>
                  c.classList.contains("fieldset-actions")
                    ? `actions(${[...c.querySelectorAll("legend, input, button")]
                        .map((x) =>
                          x.tagName === "LEGEND"
                            ? `legend:${x.textContent.trim()}`
                            : x.tagName.toLowerCase(),
                        )
                        .join(",")})`
                    : c.tagName.toLowerCase(),
                )
                .join(",")})`
            : `${child.tagName.toLowerCase()}.${[...child.classList].join(".")}`,
        ),
        nestedFieldsets: content.querySelectorAll("fieldset fieldset").length,
        notices: content.querySelectorAll(".item-origin-notice").length,
      };
    }
    return out;
  });
  const rowsHoldFieldsets = Object.values(structure).every((section) =>
    section.children.every(
      (child) =>
        !child.startsWith("row(") || /^row\((fieldset,?)+(actions\([^)]*\))?\)$/.test(child),
    ),
  );
  record(
    "2f Component · Content · Collection: no notice · no nested fieldset · rows hold fieldsets (+ an actions cell) · the key is the Shortcut row's action cell",
    structure.Content?.notices === 0 &&
      structure.Collection?.nestedFieldsets === 0 &&
      structure.Content?.nestedFieldsets === 0 &&
      structure.Component?.children.length > 0 &&
      structure.Collection?.children.some((child) =>
        /^row\(fieldset,actions\(legend:(Key|키),input\)\)$/.test(child),
      ) &&
      rowsHoldFieldsets,
    structure,
  );
  await page.screenshot({ path: `${OUT}/2-menu-item-panel.png` });
  await page.evaluate(() =>
    document
      .querySelector('.panel-wrapper[data-panel="properties"] .panel-contents')
      ?.scrollTo(0, 0),
  );
  await page.waitForTimeout(300);
  await page
    .locator('.panel-wrapper[data-panel="properties"]')
    .screenshot({ path: `${OUT}/2-component-section.png` });

  // 2g. The modifier toggles look like the Menu's own seg fields (Size · Selection mode —
  //     사용자 2026-11-28 「size, selection mode 와 같은 패턴」): same fieldset · track · button
  //     height · selected pill; every modifier on shows its pill.
  const segLook = (legendPattern) =>
    page.evaluate((source) => {
      const pattern = new RegExp(source);
      const fieldset = [
        ...document.querySelectorAll(
          '.panel-wrapper[data-panel="properties"] fieldset.properties-aria',
        ),
      ].find((f) => pattern.test(f.querySelector(":scope > legend")?.textContent?.trim() ?? ""));
      if (!fieldset) return null;
      const group = fieldset.querySelector(".react-aria-ToggleButtonGroup");
      const button = group.querySelector(".react-aria-ToggleButton");
      const pill = group.querySelector(".react-aria-SelectionIndicator");
      const gs = getComputedStyle(group);
      const bs = getComputedStyle(button);
      return {
        fieldset: [...fieldset.classList].filter((c) => c !== "shortcut-modifiers").join("."),
        inRow: fieldset.parentElement.classList.contains("fieldset-row"),
        indicator: group.getAttribute("data-indicator"),
        track: gs.backgroundColor,
        radius: gs.borderRadius,
        height: Math.round(group.getBoundingClientRect().height),
        buttonHeight: Math.round(button.getBoundingClientRect().height),
        font: `${bs.fontSize}/${bs.fontWeight}`,
        pill: pill ? getComputedStyle(pill).backgroundColor : null,
        pills: group.querySelectorAll(".react-aria-SelectionIndicator").length,
        selected: group.querySelectorAll(".react-aria-ToggleButton[data-selected]").length,
      };
    }, legendPattern);
  const shortcutLook = await segLook("^(Shortcut|단축키)$");
  await select(placed[0].topId);
  await page.waitForTimeout(800);
  const sizeLook = await segLook("^(Size|크기)$");
  const same = (a, b) =>
    a && b &&
    ["fieldset", "inRow", "indicator", "track", "radius", "height", "buttonHeight", "font", "pill"].every(
      (k) => a[k] === b[k],
    );
  record(
    "2g Shortcut toggles = the Menu Size seg's look (row · track · height · pill), a pill per modifier on",
    same(shortcutLook, sizeLook) && shortcutLook.pills === shortcutLook.selected && shortcutLook.selected >= 2,
    { shortcutLook, sizeLook },
  );
  await page.screenshot({ path: `${OUT}/2g-menu-size-panel.png` });

  // 3. ActionMenu.
  const actionItem = placed[1].id;
  await select(actionItem);
  await page.waitForTimeout(800);
  const actionGroup = await openField();
  // (Its template shortcut is 「⌘C」: ⌘ off, ⌥ on, key p.)
  await setShortcut(actionGroup, ["Command", "Option"], "p");
  const actionAfter = (await placedItems())[1];
  record(
    "3 ActionMenu: ⌥ + p writes 「⌥P」 on its item",
    actionAfter.keyboard === "⌥P",
    actionAfter,
  );

  // 4. Publish.
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
  await pub.waitForSelector('[aria-haspopup="true"]', { timeout: 60000 });
  await pub.waitForTimeout(800);
  const shown = [];
  const shownDescriptions = [];
  const triggers = pub.locator('[aria-haspopup="true"]');
  for (let i = 0; i < (await triggers.count()); i++) {
    await triggers.nth(i).click();
    await pub.waitForSelector('[role="menu"]', { timeout: 15000 });
    await pub.waitForTimeout(400);
    shown.push(
      await pub.evaluate(() =>
        [...document.querySelectorAll('[role="menu"] kbd')].map((k) => {
          const item = k.closest('[role="menuitem"]').getBoundingClientRect();
          const box = k.getBoundingClientRect();
          return {
            text: k.textContent,
            atEnd: item.right - box.right < 40,
          };
        }),
      ),
    );
    shownDescriptions.push(
      await pub.evaluate(() =>
        [...document.querySelectorAll('[role="menu"] [slot="description"]')].map(
          (d) => d.textContent,
        ),
      ),
    );
    await pub.screenshot({ path: `${OUT}/2-publish-menu-${i}.png` });
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(300);
  }
  const texts = shown.flat().map((k) => k.text);
  const descriptions = shownDescriptions.flat();
  record(
    "4 Publish: 「⇧⌘K」 and 「⌥P」 at the items' end · the description 「Open the file」",
    texts.includes("⇧⌘K") &&
      descriptions.includes("Open the file") &&
      texts.includes("⌥P") &&
      shown.flat().every((k) => k.atEnd),
    { shown, shownDescriptions },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error?.stack ?? error) });
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const passed = results.filter((r) => r.pass).length;
  process.stdout.write(`\n${passed}/${results.length} PASS → ${OUT}/results.json\n`);
  await browser.close();
}

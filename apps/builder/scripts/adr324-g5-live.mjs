#!/usr/bin/env node
// ADR-324 G5 live — 「모아서 저장」 in the real Builder → Publish (Chrome · WebKit), against the
// stand-in server over HTTP (`save-endpoint-stub.mjs` — the same core as the unit gates, its rows ·
// request log read apart from the product at `/__stub/state`):
//   1. Builder: Orders (remote · key id · version field) and its endpoints (list · PATCH · POST ·
//      DELETE · GET by key), a Table bound to it, Buttons whose rules edit it (Rename o1 · Rename o2
//      · Rename o3 · Add) — then the Data panel's table settings 「Save changes together」 switch
//      (the panel itself): the setting, a save bar after the Table, its edit marks on.
//   2. Publish: an edit → 0 writes (HC1) and the bar counts 1 · Save → 1 PATCH (key · changed field
//      · If-Match) and the bar counts 0.
//   3. Conflict: another user writes o2 first → Rename o2 → Save → 412 → the row's mark 「충돌」 with
//      the server's value · 「Keep mine」 → saved with the new version.
//   4. A lost answer: the PATCH applies and the socket closes → read again by key → saved (the
//      server wrote it once).
//   5. Discard: an edit · 「Discard」 → count 0, no request.
//   6. Keyboard: an edit → Tab to 「Save」 · Enter → saved.
//   7. Leaving with an unsaved change asks first (beforeunload); with none it does not.
//   8. page error 0.
//
//   node apps/builder/scripts/save-endpoint-stub.mjs 5199 &
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr324-g5-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr324-g5-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const API = process.env.STUB_URL ?? "http://localhost:5199";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
const stub = async (path, body) => {
  const response = await fetch(`${API}/__stub/${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response.json();
};
const writes = async () =>
  (await stub("state")).log.filter((entry) => entry.method !== "GET");

await stub("reset", {
  base: "/orders",
  versionField: "version",
  rows: [
    { id: "o1", name: "볼펜", quantity: 3, version: "v1" },
    { id: "o2", name: "노트", quantity: 10, version: "v1" },
    { id: "o3", name: "지우개", quantity: 0, version: "v1" },
  ],
});

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const BROWSER = process.argv.includes("--browser")
  ? process.argv[process.argv.indexOf("--browser") + 1]
  : "chrome";
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
let pub;
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr324 g5 ${BROWSER}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  // (SITE_LANG — the site's language: the save bar · toast · row reasons follow it, not the Builder's.)
  if (process.env.SITE_LANG)
    await page.evaluate((lang) => {
      const h = window.__COMPOSITION_CATALOG__;
      h.workspace.execute(h.commands.setSiteSettings({ patch: { lang } }));
    }, process.env.SITE_LANG);

  const built = await page.evaluate(async (API) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const g = ws.runtime.graph;
    const C = h.commands;
    const set = (value) => ({ kind: "set", value });
    const endpoint = (id, method, path, extra = {}) => ({
      kind: "endpoint",
      id: `data:endpoint:${id}`,
      name: id,
      method,
      baseUrl: API,
      path,
      headers: [],
      queryParams: [],
      bodyType: method === "GET" || method === "DELETE" ? "none" : "json",
      responseMapping: { dataPath: "", errorsPath: "errors" },
      executionMode: "client",
      ...extra,
    });
    ws.execute(
      C.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:orders",
            name: "Orders",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-qty", key: "quantity", type: "number" },
              { id: "f-ver", key: "version", type: "string" },
            ],
            keyField: "f-id",
            mockData: [],
            useMockData: false,
          },
          endpoint("list", "GET", "/orders", {
            targetCollectionId: "data:collection:orders",
          }),
          endpoint("patch", "PATCH", "/orders/{{ key }}"),
          endpoint("post", "POST", "/orders"),
          endpoint("delete", "DELETE", "/orders/{{ key }}"),
          endpoint("one", "GET", "/orders/{{ key }}"),
        ],
        label: "orders",
      }),
    );
    const snap = ws.session.getSnapshot();
    const body = g.getEntry(snap.pageId).children[0];
    const node = (id, type, props = {}) => ({
      kind: "node",
      id,
      definitionId: h.palette.catalogPaletteDefinitionId(g.library, type),
      children: [],
      props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, set(v)])),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const ids = {
      table: "project:node:g5-table",
      r1: "project:node:g5-r1",
      r2: "project:node:g5-r2",
      r3: "project:node:g5-r3",
      r4: "project:node:g5-r4",
      r5: "project:node:g5-r5",
    };
    const buttons = [
      [ids.r1, "Rename o1"],
      [ids.r2, "Rename o2"],
      [ids.r3, "Rename o3"],
      [ids.r4, "Rename o1 again"],
      [ids.r5, "Change o3"],
    ];
    ws.execute(
      C.insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          { ...node(ids.table, "Table"), sizing: { width: set(700), height: set(260) } },
          ...buttons.map(([id, label]) => node(id, "Button", { label })),
        ],
        rootIds: [ids.table, ...buttons.map(([id]) => id)],
        newId: ws.newId,
      }),
    );
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: ids.table }],
        h.binding.catalogBindingRef({ source: "dataTable", collectionId: "orders", name: "Orders" }),
      ),
    );
    ws.execute(
      C.setFields({
        targets: [{ kind: "node", id: ids.table }],
        props: { selectionMode: set("none") },
        label: "table",
      }),
    );
    const loaded = (path) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => new URL(name).pathname === path)
        .at(-1) ?? path;
    const { catalogInteractionsCommand, catalogNewInteraction } = await import(
      loaded("/src/builder/catalogRuntime/interactions.ts")
    );
    const rule = (ownerId, action) =>
      ws.execute(
        catalogInteractionsCommand(
          { ownerId },
          [catalogNewInteraction({ ownerId }, "onPress", [action], ws.newId)],
          "Rules",
        ),
      );
    // (Each press writes a new value — a count, so a second press is another edit.)
    rule(ids.r1, { opcode: "update", collectionId: "data:collection:orders", key: "o1", field: "data:field:f-name", value: "Edited o1" });
    rule(ids.r2, { opcode: "update", collectionId: "data:collection:orders", key: "o2", field: "data:field:f-qty", value: 99 });
    rule(ids.r3, { opcode: "update", collectionId: "data:collection:orders", key: "o3", field: "data:field:f-qty", value: 7 });
    rule(ids.r4, { opcode: "update", collectionId: "data:collection:orders", key: "o1", field: "data:field:f-name", value: "Again" });
    rule(ids.r5, { opcode: "update", collectionId: "data:collection:orders", key: "o3", field: "data:field:f-qty", value: 1 });
    return { ids };
  }, API);

  // ── the Data panel's switch (the panel itself) ──
  const settings = page.getByRole("button", { name: /Table settings Orders|표 설정 Orders/ });
  if (!(await settings.count())) {
    for (const name of [/^Data$/, /^데이터$/, /Data panel/i]) {
      const rail = page.getByRole("button", { name }).first();
      if (await rail.count()) {
        await rail.click();
        break;
      }
    }
    await page.waitForTimeout(800);
  }
  await settings.first().click();
  await page.waitForTimeout(600);
  // (The switch's drawn part — what a mouse presses; the input under it is hidden.)
  await page
    .locator('[data-section-id="datatable-table-save"] .indicator')
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/panel.png` });
  const turnedOn = await page.evaluate((ids) => {
    const h = window.__COMPOSITION_CATALOG__;
    const g = h.workspace.runtime.graph;
    const c = g.getEntry("data:collection:orders");
    const table = g.getEntry(ids.table);
    const body = g.getEntry(h.workspace.session.getSnapshot().pageId).children[0];
    const kids = g.getEntry(body).children;
    const bar = g.getEntry(kids[kids.indexOf(ids.table) + 1]);
    return {
      save: c.save,
      marks: table.props.showEditMarks?.value,
      bar: bar?.name,
      barChildren: bar?.children?.length,
    };
  }, built.ids);
  record(
    "1 Builder: 패널 「변경을 모아서 저장」 스위치 → 설정 (행별 PATCH · POST · DELETE) · Table 뒤 저장 막대 (8) · Edit marks",
    turnedOn.save?.send?.shape === "rows" &&
      turnedOn.save.send.update?.endpointId === "data:endpoint:patch" &&
      turnedOn.bar === "Save bar" &&
      turnedOn.barChildren === 8 &&
      turnedOn.marks === true,
    turnedOn,
  );
  // (Version detection on the panel's Conflict select → 「Version field」 — the field it picks.)
  await page.getByRole("button", { name: /Conflict detection|충돌 감지/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /Version field|버전 필드/ }).click();
  await page.waitForTimeout(500);
  const versioned = await page.evaluate(
    () => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry("data:collection:orders").save.conflict,
  );
  record(
    "1b 패널 충돌 감지 = 버전 필드 (version · If-Match)",
    versioned?.by === "version" && versioned.fieldId === "f-ver" && versioned.send === "ifMatch",
    versioned,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ── Publish ──
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1600, height: 1000 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="row"][data-key="o1"]', { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const press = async (name) => {
    await pub.getByRole("button", { name, exact: true }).click();
    await pub.waitForTimeout(1200);
  };
  const bar = () =>
    pub.evaluate(() => {
      const text = [...document.querySelectorAll("*")]
        .map((element) => element.childNodes.length === 1 && element.textContent)
        .find((value) => value && /Unsaved changes|저장 안 된 변경/.test(value));
      const button = (name) =>
        [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
      return {
        text: text || null,
        saveDisabled: button("Save")?.hasAttribute("disabled") ?? button("저장")?.hasAttribute("disabled") ?? null,
      };
    });
  const row = (key) =>
    pub.evaluate((key) => {
      const element = document.querySelector(`[role="row"][data-key="${key}"]`);
      return {
        text: element?.textContent ?? null,
        mark: element?.getAttribute("data-edit-status") ?? null,
        note: element?.querySelector("[data-edit-note]")?.textContent ?? null,
      };
    }, key);
  const saveName = (await pub.getByRole("button", { name: "저장", exact: true }).count()) ? "저장" : "Save";
  const discardName = saveName === "저장" ? "취소" : "Cancel";
  const mineName = saveName === "저장" ? "내 값으로 다시 저장" : "Keep mine";

  const w0 = (await writes()).length;
  await press("Rename o1");
  const edited = { bar: await bar(), row: await row("o1"), writes: (await writes()).length - w0 };
  record(
    "2a 편집 → 원격 쓰기 0 (HC1) · 막대 1건 · 저장 켜짐 · 행 dirty",
    edited.writes === 0 && /1/.test(edited.bar.text ?? "") && edited.bar.saveDisabled === false && edited.row.mark === "dirty",
    edited,
  );
  await press(saveName);
  const saved = (await writes()).slice(w0);
  const afterSave = { bar: await bar(), row: await row("o1"), server: (await stub("state")).rows.find((r) => r.id === "o1") };
  // (The save's toast — the site's language.)
  const toast = await pub.evaluate(() => document.body.innerText.match(/저장 1건|1 saved|保存 1件|已保存 1 条/)?.[0] ?? null);
  const toastWanted = { ko: "저장 1건", ja: "保存 1件", zh: "已保存 1 条" }[process.env.SITE_LANG] ?? "1 saved";
  record("2c 저장 결과 toast = 사이트 언어", toast === toastWanted, { toast, toastWanted, saveName });
  record(
    "2b 저장 → PATCH 1 (key · 바뀐 필드 · If-Match v1) · 서버 반영 · 막대 0 · 표시 사라짐",
    saved.length === 1 &&
      saved[0].method === "PATCH" &&
      saved[0].path === "/orders/o1" &&
      JSON.stringify(saved[0].body) === JSON.stringify({ name: "Edited o1" }) &&
      saved[0].headers["if-match"] === '"v1"' &&
      afterSave.server?.name === "Edited o1" &&
      afterSave.row.mark === null &&
      /0/.test(afterSave.bar.text ?? ""),
    { saved, ...afterSave },
  );

  // ── conflict ──
  await fetch(`${API}/orders/o2`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quantity: 50 }),
  });
  const w1 = (await writes()).length;
  await press("Rename o2");
  await press(saveName);
  const conflicted = { row: await row("o2"), log: (await writes()).slice(w1).map((e) => [e.method, e.path, e.status]) };
  record(
    "3a 다른 사람이 먼저 바꿈 → 412 → 행 「충돌」 · 서버 값 문구 · 서버 행은 그 사람 값",
    conflicted.row.mark === "conflict" &&
      /quantity = 50/.test(conflicted.row.note ?? "") &&
      conflicted.log.some(([m, , s]) => m === "PATCH" && s === 412),
    conflicted,
  );
  await press(mineName);
  const kept = { row: await row("o2"), server: (await stub("state")).rows.find((r) => r.id === "o2"), last: (await writes()).at(-1) };
  record(
    "3b 「내 값으로 다시 저장」 → 다시 읽은 서버 행의 버전 (If-Match v2) 으로 PATCH → 서버 99 · v3 · 표시 사라짐",
    kept.server?.quantity === 99 &&
      kept.server?.version === "v3" &&
      kept.row.mark === null &&
      kept.last?.headers?.["if-match"] === '"v2"',
    kept,
  );

  // ── lost answer ──
  await stub("fault", { kind: "lose", method: "PATCH" });
  const before3 = ((await stub("state")).writes.o3 ?? []).length;
  await press("Rename o3");
  await press(saveName);
  await pub.waitForTimeout(1500);
  const lost = {
    row: await row("o3"),
    writes: ((await stub("state")).writes.o3 ?? []).length - before3,
    log: (await stub("state")).log.slice(-4).map((e) => [e.method, e.path, e.status]),
  };
  record(
    "4 응답 유실 (반영 후 연결 끊김) → 다시 읽어 판정 → 저장됨 · 서버 쓰기 1 회 (브라우저가 다시 보낸 PATCH 는 버전 조건이 막는다)",
    lost.row.mark === null && lost.writes === 1,
    lost,
  );

  // ── discard ──
  const w2 = (await writes()).length;
  await press("Change o3");
  const pending = await bar();
  await press(discardName);
  const dropped = { pending, bar: await bar(), row: await row("o3"), writes: (await writes()).length - w2 };
  record("5 취소 → 막대 1 → 0 · 표시 없음 · 값 서버 것 (7) · 요청 0", dropped.writes === 0 && /1/.test(dropped.pending.text ?? "") && dropped.row.mark === null && /0/.test(dropped.bar.text ?? ""), dropped);

  // ── keyboard + leave warning ──
  await press("Rename o1 again");
  await pub.evaluate((name) => {
    const all = [...document.querySelectorAll("button")];
    const save = all.find((b) => b.textContent?.trim() === name);
    all[all.indexOf(save) - 1]?.focus();
  }, saveName);
  await pub.keyboard.press("Tab");
  const focused = await pub.evaluate(() => document.activeElement?.textContent?.trim());
  record("6 Tab 으로 저장 버튼에 focus", focused === saveName, { focused });

  // (Playwright reports `beforeunload` for a close that runs it — dismissed, the page stays.)
  let asked = false;
  pub.once("dialog", async (dialog) => {
    asked = dialog.type() === "beforeunload";
    await dialog.dismiss();
  });
  await pub.close({ runBeforeUnload: true });
  await pub.waitForTimeout(1500);
  record("7a 미저장 변경이 있는 채 떠나면 경고 (beforeunload) · 머무름", asked && !pub.isClosed(), { asked, closed: pub.isClosed() });
  // (Save it with the keyboard — the focus on Save, Enter — then leaving asks nothing.)
  await pub.evaluate((name) => {
    const save = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
    save?.focus();
  }, saveName);
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(1500);
  const keyed = await bar();
  const serverAgain = (await stub("state")).rows.find((r) => r.id === "o1");
  record("7b Enter 로 저장 → 서버 「Again」 · 막대 0", /0/.test(keyed.text ?? "") && serverAgain?.name === "Again", { ...keyed, serverAgain });
  await pub.screenshot({ path: `${OUT}/publish.png` }).catch(() => {});
  let askedAgain = false;
  pub.once("dialog", async (dialog) => {
    askedAgain = true;
    await dialog.dismiss();
  });
  await pub.close({ runBeforeUnload: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  record("7c 변경이 없으면 경고 없이 닫힘", !askedAgain && pub.isClosed(), { askedAgain, closed: pub.isClosed() });

  // ── round 3 (판독 h9 · m14) — back in the Builder: the panel's choices and the same switch off ──
  await page.bringToFront();
  await page.waitForTimeout(500);
  // (The settings view closed with the Escape above — open it again.)
  if (!(await page.locator('[data-section-id="datatable-table-save"]').count())) {
    await settings.first().click();
    await page.waitForTimeout(600);
  }
  await page
    .locator('[data-section-id="datatable-table-save"]')
    .getByRole("button", { name: /Update|수정/ })
    .first()
    .click();
  await page.waitForTimeout(400);
  const updateOptions = await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  record(
    "9a 패널 「고침」 연결 선택지 = PATCH · PUT endpoint 만 (DELETE · POST 없음)",
    updateOptions.some((text) => /PATCH|PUT/.test(text ?? "")) &&
      !updateOptions.some((text) => /DELETE|POST/.test(text ?? "")),
    { updateOptions },
  );
  await page
    .locator('[data-section-id="datatable-table-save"] .indicator')
    .first()
    .click();
  await page.waitForTimeout(800);
  const turnedOff = await page.evaluate((ids) => {
    const h = window.__COMPOSITION_CATALOG__;
    const g = h.workspace.runtime.graph;
    const body = g.getEntry(h.workspace.session.getSnapshot().pageId).children[0];
    const kids = g.getEntry(body).children;
    const project = g.getEntry(g.projectId);
    return {
      save: g.getEntry("data:collection:orders").save ?? null,
      afterTable: g.getEntry(kids[kids.indexOf(ids.table) + 1])?.name ?? null,
      saveRules: project.interactionIds.filter((id) =>
        JSON.stringify(g.getEntry(id)?.actions ?? []).includes("saveChanges"),
      ).length,
    };
  }, built.ids);
  record(
    "9b 같은 스위치로 끄기 → 설정 없음 · 저장 막대 없음 · 「변경 저장」 규칙 0",
    turnedOff.save === null && turnedOff.afterTable !== "Save bar" && turnedOff.saveRules === 0,
    turnedOff,
  );

  record("8 page error 0", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error?.stack ?? error).slice(0, 1500) });
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  await pub?.screenshot({ path: `${OUT}/failure-publish.png` }).catch(() => {});
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS → ${OUT}/results.json\n`);
  process.exit(failed ? 1 : 0);
}

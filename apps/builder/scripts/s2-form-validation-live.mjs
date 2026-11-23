#!/usr/bin/env node
// S2 Form validation live (2026-11-23, S2 체크리스트 부록 D.3 2단계 — 서버 validationErrors · 검증 규칙):
//   1. Design 패널: Form 의 첫 필드를 고르면 Behavior 구획에 「검증 규칙」 이 있고, 「규칙 추가」 →
//      비교 「같지 않음」 · 값 admin · 메시지 → 문서의 validate 가 조건 규칙 하나. 필드 칸은 「이 필드」,
//      비교 대상은 「고정 값」, 필드 목록에 같은 Form 의 다른 칸 (email)
//   2. endpoint 응답 설정의 필드 오류 경로 (errorsPath) 가 문서 endpoint 에 저장된다
//   3. Publish: admin 을 치고 칸을 떠나면 규칙 문구 (blur — S2 commit 시점), 고치면 사라진다
//   4. Publish: 제출 → 422 {errors:{username}} → 그 필드에 서버 문구 · 「saved」 toast 없음 (뒤 Do 멈춤)
//   5. Publish: 그 칸을 고치고 떠나면 서버 문구가 사라지고, 다시 제출 → 200 → 「saved」 toast
//   6. Undo: Builder 에서 규칙 편집을 되돌리면 validate 가 없다
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-form-validation-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-form-validation-live";
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

const SERVER_MESSAGE = "이미 가입된 주소입니다";
const RULE_MESSAGE = "admin 은 쓸 수 없습니다";

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("form validation live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // Place a Form; its first field is named `username` (the palette's Email field is `email`).
  const placed = await page.evaluate(async (repo) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const before = new Set(r.canvasInputs.keys());
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx, "Form").command);
    const form = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Form" && !before.has(x.id),
    );
    const fields = [];
    const visit = (id) => {
      const x = r.canvasInputs.get(id);
      if (!x) return;
      if (["TextField", "TextArea"].includes(r.typeOf(x)))
        fields.push({ record: x.id, source: x.sourceId, type: r.typeOf(x) });
      x.children.forEach(visit);
    };
    visit(form.id);
    const { setFields } = await import(
      `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id: fields[0].source }],
        props: { name: { kind: "set", value: "username" } },
        label: "Edit properties",
      }),
    );
    ws.selectItems([ws.itemOfRecord(fields[0].record)]);
    return { form: form.sourceId, formRecord: form.id, fields };
  }, REPO);
  await page.waitForTimeout(1000);

  // 1. The Design panel's rules editor (its rail button opens it — the right rail's paint roller).
  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  if (!(await panel.isVisible())) {
    // (The right rail's second button — Design, the paint roller.)
    await page.mouse.click(1895, 572);
    await page.waitForTimeout(1000);
  }
  if (process.env.PROBE) {
    await page.screenshot({ path: `${OUT}/probe.png` });
    const legends = await panel.evaluate((el) => ({
      legends: [...el.querySelectorAll("legend, .section-title")].map((x) => x.textContent),
      selection: window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().selection,
    }));
    record("probe", false, { placed, legends });
    throw new Error("probe");
  }
  const rules = panel.locator("fieldset.validation-rules-field");
  await rules.scrollIntoViewIfNeeded();
  await rules.getByRole("button", { name: /Add rule|규칙 추가/ }).click();
  await page.waitForTimeout(400);
  await rules.getByRole("button", { name: /Comparison|비교/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /^(Does not equal|같지 않음)$/ }).click();
  await page.waitForTimeout(300);
  // (A panel input is named by its fieldset's legend — the group.)
  const valueInput = rules
    .getByRole("group", { name: /^(Value|값)$/ })
    .locator("input")
    .first();
  await valueInput.fill("admin");
  await valueInput.press("Enter");
  await page.waitForTimeout(300);
  const messageInput = rules
    .getByRole("group", { name: /Error message|오류 메시지/ })
    .locator("input")
    .first();
  await messageInput.fill(RULE_MESSAGE);
  await messageInput.press("Enter");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/builder-rules.png` });
  // (The selects show their choice: the own value, a fixed value; the field list offers the Form's
  //  other named field — the palette's `email`.)
  const shownChoice = {
    field: (await rules.getByRole("group", { name: /^(Field|필드)$/ }).textContent())?.trim(),
    compareWith: (
      await rules.getByRole("group", { name: /^(Compare with|비교 대상)$/ }).textContent()
    )?.trim(),
  };
  await rules
    .getByRole("group", { name: /^(Field|필드)$/ })
    .getByRole("button")
    .first()
    .click();
  await page.waitForTimeout(300);
  shownChoice.options = await page
    .getByRole("option")
    .evaluateAll((items) => items.map((item) => item.textContent?.trim()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const stored = await page.evaluate((id) => {
    const node = window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id);
    // (A node's prop is its write — `{kind: "set", value}`.)
    return node?.props?.validate?.value;
  }, placed.fields[0].source);
  const rule = stored?.[0];
  record(
    "1 Design 패널: 규칙 추가 → 같지 않음 · admin · 문구 = 문서 validate",
    Array.isArray(stored) &&
      stored.length === 1 &&
      rule.when?.op === "notEquals" &&
      rule.when?.value === "admin" &&
      rule.when?.fields?.[0]?.[0] === "data:field:$value" &&
      rule.message === RULE_MESSAGE &&
      /This field|이 필드/.test(shownChoice.field ?? "") &&
      /A fixed value|고정 값/.test(shownChoice.compareWith ?? "") &&
      shownChoice.options?.includes("email"),
    { stored, shownChoice },
  );

  // 2. The endpoint and the Form's submit rule (callEndpoint, then 「saved」).
  const endpoint = await page.evaluate(async ({ repo, form }) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    // (The app's own module instances — after an edit the dev server serves them with `?t=`.)
    const loaded = (path) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => new URL(name).pathname === path)
        .at(-1) ?? path;
    const { useDataStore } = await import(loaded("/src/builder/stores/data.ts"));
    const { toEndpointDraft } = await import(
      loaded("/src/builder/stores/utils/dataChange.ts")
    );
    const created = await useDataStore.getState().createApiEndpoint({
      name: "signup",
      method: "POST",
      baseUrl: "https://api.example.test",
      path: "/signup",
      headers: [],
      queryParams: [],
      bodyType: "json",
      responseMapping: { dataPath: "" },
    });
    // (The endpoint editor's response path row — `save({responseMapping})` → a define_endpoint draft.)
    // (The store is the document's projection — wait for the created endpoint to come back.)
    let current;
    for (let i = 0; i < 40 && !current; i += 1) {
      current = [...useDataStore.getState().apiEndpoints.values()].find(
        (item) => item.id === created.id,
      );
      if (!current) await new Promise((r) => setTimeout(r, 100));
    }
    if (!current)
      throw new Error(
        `endpoint not projected: ${JSON.stringify([...useDataStore.getState().apiEndpoints.keys()])}`,
      );
    await useDataStore.getState().applyDataChange({
      ops: [
        {
          op: "define_endpoint",
          endpoint: toEndpointDraft({
            ...current,
            responseMapping: { dataPath: "", errorsPath: "errors" },
          }),
        },
      ],
      origin: "user",
    });
    const { catalogInteractionsCommand, catalogNewInteraction } = await import(
      "/src/builder/catalogRuntime/interactions.ts"
    );
    const owner = { ownerId: form };
    ws.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onSubmit",
            [
              {
                opcode: "callEndpoint",
                endpointId: `data:endpoint:${created.id}`,
                body: "!event.formData",
              },
              { opcode: "toast", message: "saved" },
            ],
            ws.newId,
          ),
        ],
        "Rules",
      ),
    );
    await new Promise((r) => setTimeout(r, 300));
    const entry = ws.runtime.graph.getEntry(`data:endpoint:${created.id}`);
    return { id: created.id, mapping: entry?.responseMapping };
  }, { repo: REPO, form: placed.form });
  record(
    "2 endpoint 필드 오류 경로 → 문서 endpoint responseMapping.errorsPath",
    endpoint.mapping?.errorsPath === "errors",
    endpoint,
  );
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectItems([]));
  await page.waitForTimeout(500);

  // 3 – 5. Publish, the endpoint answered by a route (422 with field errors, then 200).
  const sent = [];
  let answer = 422;
  await context.route("https://api.example.test/**", async (route) => {
    sent.push(route.request().postData());
    if (answer === 422)
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ errors: { username: SERVER_MESSAGE } }),
      });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1 }),
      });
  });
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector("form", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const field = (n) => pub.locator("form .react-aria-TextField, form .react-aria-TextArea").nth(n);
  const inputOf = (n) => field(n).locator("input, textarea").first();
  const count = await pub.locator("form .react-aria-TextField, form .react-aria-TextArea").count();
  // (The other fields get valid values — only the rule and the server refuse.)
  for (let n = 1; n < count; n += 1) {
    const input = inputOf(n);
    const type = await input.getAttribute("type");
    await input.fill(type === "email" ? `user${n}@example.test` : `value ${n}`);
  }
  await inputOf(0).fill("admin");
  await inputOf(0).press("Tab");
  await pub.waitForTimeout(400);
  const ruleShown = {
    text: await field(0).textContent(),
    invalid: await inputOf(0).getAttribute("aria-invalid"),
  };
  await inputOf(0).fill("alice@example.test");
  await inputOf(0).press("Tab");
  await pub.waitForTimeout(400);
  const ruleCleared = await field(0).textContent();
  record(
    "3 Publish: admin → 칸을 떠나면 규칙 문구 · invalid, 고치면 사라짐",
    ruleShown.text.includes(RULE_MESSAGE) &&
      ruleShown.invalid === "true" &&
      !ruleCleared.includes(RULE_MESSAGE),
    { ruleShown, ruleCleared },
  );

  const toastText = () =>
    pub.evaluate(() =>
      [...document.querySelectorAll('[role="alertdialog"], .react-aria-Toast')]
        .map((el) => el.textContent)
        .join(" | "),
    );
  await inputOf(0).press("Enter");
  await pub.waitForTimeout(1200);
  const refused = {
    sent: sent.length,
    text: await field(0).textContent(),
    invalid: await inputOf(0).getAttribute("aria-invalid"),
    toast: await toastText(),
  };
  await pub.screenshot({ path: `${OUT}/publish-server-error.png` });
  record(
    "4 Publish: 제출 → 422 → 필드에 서버 문구 · 「saved」 없음",
    refused.sent === 1 &&
      refused.text.includes(SERVER_MESSAGE) &&
      refused.invalid === "true" &&
      !refused.toast.includes("saved"),
    refused,
  );

  // (RAC clears a field's server error when its value commits — leaving the field, S2's 「after the
  //  user modifies」: `commitValidation`.)
  await inputOf(0).fill("bob@example.test");
  await inputOf(0).press("Tab");
  await pub.waitForTimeout(300);
  const editedText = await field(0).textContent();
  answer = 200;
  await inputOf(0).press("Enter");
  await pub.waitForTimeout(1200);
  const accepted = { sent: sent.length, toast: await toastText(), editedText };
  await pub.screenshot({ path: `${OUT}/publish-saved.png` });
  record(
    "5 Publish: 고치면 서버 문구 사라짐 · 다시 제출 → 200 → 「saved」",
    !editedText.includes(SERVER_MESSAGE) &&
      accepted.sent === 2 &&
      accepted.toast.includes("saved"),
    accepted,
  );
  await pub.close();

  // 6. Undo: back past the rule's message · value · comparison · add (and the rule, endpoint).
  await page.bringToFront();
  const undone = await page.evaluate(async (source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const read = () => ws.runtime.graph.getEntry(source)?.props?.validate?.value;
    for (let i = 0; i < 12 && read() !== undefined; i += 1) ws.undo();
    await new Promise((r) => setTimeout(r, 300));
    return read();
  }, placed.fields[0].source);
  record("6 Undo: 규칙 편집을 되돌리면 validate 없음", undone === undefined, { undone });

  record("7 page error 0", errors.length === 0, errors);
} catch (error) {
  record("script", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}

#!/usr/bin/env node
// ADR-321 G2 live — StepList 의 동작 (Phase 2): 실제 Builder 에서 팔레트로 StepList 를 놓고 (3 단계 —
// 완료 · 현재 · 남음), 목록 이름 · page 변수 moved · passed (When 규칙이 씀) · 이름 붙인 상태 step · done
// (목록의 selectedKey · lastCompletedStep 을 따름) · Do 넷을 실행하는 Button 넷 · 값을 보이는 Text 를
// 만든 뒤 Publish 에서
//   1. 첫 화면: RAC Group (이름 = 작성 이름) > ol > li > Link — role · aria-current · aria-disabled ·
//      tabindex 가 따로 적은 정답표와 같다 · 이름 붙인 상태 = 시작 값
//   2. 키보드: Tab 은 갈 수 있는 단계만 차례로 지나 다음 요소로 · focus ring · Enter 로 그 단계가 현재
//      (When 「단계 변경」 !event.key) · Space 는 옮기지 않는다
//   3. 포인터: 갈 수 없는 단계를 눌러도 그대로 · 갈 수 있는 단계는 현재가 된다
//   4. Do: 다음 · 이전 · 완료 · 단계로 이동 — 상태는 따르고 When 은 실행되지 않는다 (RAC 처럼 사용자의 변경만)
//   5. 「단계 완료」 뒤 다음 단계가 눌린다
//   6. 자유 이동 (Builder 에서 스위치를 켠 뒤 다시 연 Publish): 남은 단계를 누르면 건너뛴 단계가 완료,
//      When 「완료 단계 변경」
//   7. Builder: Design 패널에 「Free navigation」 스위치 · Interactions 패널에 규칙 둘의 When 이름
//   8. page error 0
//
//   BUILDER_URL=http://localhost:5174 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g2-live.mjs <out-dir> [--headless]
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g2-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const LIST_NAME = "가입 단계";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
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
const setProps = (recordId, props) =>
  page.evaluate(
    ({ recordId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(recordId).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { recordId, props },
  );

const openPublish = async () => {
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
  await pub.waitForSelector(".react-aria-StepList .step-link", {
    timeout: 60000,
  });
  await pub.waitForTimeout(700);
  return pub;
};

/** Publish: the list as the DOM shows it — the Group's role · name, each step's Link attributes. */
const shown = (pub) =>
  pub.evaluate(() => {
    const group = document.querySelector(".react-aria-StepList");
    const list = group?.firstElementChild;
    const own = (el) =>
      el
        .getAttributeNames()
        .filter((name) => name === "role" || name.startsWith("aria-"));
    return {
      group: [
        group?.tagName.toLowerCase(),
        group?.getAttribute("role"),
        group?.getAttribute("aria-label"),
      ],
      list: [list?.tagName.toLowerCase(), list ? own(list) : null],
      steps: [...(list?.children ?? [])].map((li) => {
        const link = li.querySelector(":scope > .step-link");
        return {
          li: [li.tagName.toLowerCase(), own(li)],
          state: li.getAttribute("data-step-state"),
          link: ["role", "aria-current", "aria-disabled", "tabindex"].map(
            (name) => link?.getAttribute(name) ?? null,
          ),
          text: link?.textContent,
        };
      }),
    };
  });
/** 「done now* todox」 — state word, `*` = aria-current, `x` = aria-disabled. */
const brief = async (pub) => {
  const WORD = { completed: "done", current: "now", incomplete: "todo" };
  return (await shown(pub)).steps
    .map(
      (step) =>
        `${WORD[step.state]}${step.link[1] === "step" ? "*" : ""}${step.link[2] === "true" ? "x" : ""}`,
    )
    .join(" ");
};
const readout = (pub, id) =>
  pub.locator(`[data-catalog-id="${id}"]`).evaluate((el) => el.textContent);
const focused = (pub) =>
  pub.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    const li = el.closest("li.react-aria-Step");
    if (li)
      return `step-${[...li.parentElement.children].indexOf(li) + 1}${
        el.hasAttribute("data-focus-visible") ? "+ring" : ""
      }`;
    return el.tagName.toLowerCase();
  });
const press = async (pub, id) => {
  await pub.locator(`[data-catalog-id="${id}"]`).click();
  await pub.waitForTimeout(250);
};
const pressStep = async (pub, index, options) => {
  await pub
    .locator(".react-aria-StepList .step-link")
    .nth(index)
    .click({ force: true, ...options });
  await pub.waitForTimeout(250);
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr321 g2 live ${WEBKIT ? "webkit" : "chrome"}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^step list$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);

  // The list's name, variables, named states, rules, four Buttons and the Text that shows the values.
  const made = await page.evaluate(
    async ({ name }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const loaded = (path) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((entry) => new URL(entry).pathname === path)
          .at(-1) ?? path;
      const { catalogVariableCommands: v } = await import(
        loaded("/src/builder/catalogRuntime/stateVariables.ts")
      );
      const { catalogInteractionsCommand, catalogNewInteraction } =
        await import(loaded("/src/builder/catalogRuntime/interactions.ts"));
      const { catalogPaletteDefinitionId } = await import(
        loaded("/src/builder/catalogRuntime/paletteInsert.ts")
      );
      const r = ws.root;
      const graph = ws.runtime.graph;
      const listRecord = [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === "StepList",
      );
      const list = listRecord.sourceId;
      const pageId = graph.getEntry(graph.projectId).pageIds[0];
      ws.execute(
        c.setNodeAttribute({ id: list, field: "ariaLabel", value: name }),
      );
      const ids = () =>
        new Set(graph.getEntry(graph.projectId).stateVariableIds ?? []);
      const before = ids();
      ws.execute(v.add(pageId, "moved", ws.newId));
      ws.execute(v.add(pageId, "passed", ws.newId));
      ws.execute(
        v.nameSource(
          pageId,
          list,
          { prop: "selectedKey", type: "string" },
          "step-2",
          "step",
          ws.newId,
        ),
      );
      ws.execute(
        v.nameSource(
          pageId,
          list,
          { prop: "lastCompletedStep", type: "string" },
          "step-1",
          "done",
          ws.newId,
        ),
      );
      const byName = (variable) =>
        [...ids()]
          .filter((id) => !before.has(id))
          .map((id) => graph.getEntry(id))
          .find((entry) => entry.name === variable);
      const owner = { ownerId: list };
      const write = (trigger, variable) =>
        catalogNewInteraction(
          owner,
          trigger,
          [
            {
              opcode: "setState",
              variableId: byName(variable).id,
              op: "set",
              value: "!event.key",
            },
          ],
          ws.newId,
        );
      ws.execute(
        catalogInteractionsCommand(
          owner,
          [
            write("onSelectionChange", "moved"),
            write("onLastCompletedStepChange", "passed"),
          ],
          "Rules",
        ),
      );
      const body = graph.getEntry(pageId).children[0];
      const insert = (id, type) =>
        ws.execute(
          c.insertNodes({
            parent: { kind: "node", id: body },
            entries: [
              {
                kind: "node",
                id,
                definitionId: catalogPaletteDefinitionId(graph.library, type),
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              },
            ],
            rootIds: [id],
            newId: ws.newId,
          }),
        );
      const buttons = {};
      for (const [capabilityId, value] of [
        ["nextStep"],
        ["previousStep"],
        ["completeStep"],
        ["goToStep", "step-3"],
      ]) {
        const id = `project:node:g2-${capabilityId}`;
        insert(id, "Button");
        const button = { ownerId: id };
        ws.execute(
          catalogInteractionsCommand(
            button,
            [
              catalogNewInteraction(
                button,
                "onPress",
                [
                  {
                    opcode: "capability",
                    target: { nodeId: list },
                    capabilityId,
                    ...(value ? { value } : {}),
                  },
                ],
                ws.newId,
              ),
            ],
            "Rules",
          ),
        );
        buttons[capabilityId] = r.recordsOfSource(id)[0];
      }
      const textId = "project:node:g2-readout";
      insert(textId, "Text");
      const text = r.recordsOfSource(textId)[0];
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(text).target],
          props: {
            children: {
              kind: "set",
              value:
                "step={{ step }} done={{ done }} moved={{ moved }} passed={{ passed }}",
            },
          },
        }),
      );
      return { listRecord: listRecord.id, list, buttons, text };
    },
    { name: LIST_NAME },
  );
  await page.waitForTimeout(800);

  // ── 1. first screen ──
  let pub = await openPublish();
  const first = await shown(pub);
  record(
    "1 첫 화면 — RAC Group (작성 이름) > ol > li > Link, 속성 = 정답표",
    same(first.group, ["div", "group", LIST_NAME]) &&
      same(first.list, ["ol", []]) &&
      first.steps.every((step) => same(step.li, ["li", []])) &&
      // (written by hand — 완료 · 현재 · 남음; the third step's previous step is not completed.)
      same(
        first.steps.map((step) => step.link),
        [
          ["link", null, null, "0"],
          ["link", "step", null, "0"],
          ["link", null, "true", null],
        ],
      ),
    first,
  );
  record(
    "1 이름 붙인 상태 = 시작 값 · 규칙 변수는 비어 있다",
    (await readout(pub, made.text)) ===
      "step=step-2 done=step-1 moved= passed=",
    await readout(pub, made.text),
  );

  // ── 2. keyboard ──
  // (No pointer before this — a click anywhere near the list's corner would press its first step.)
  const stops = [];
  for (let i = 0; i < 3; i += 1) {
    await pub.keyboard.press("Tab");
    stops.push(await focused(pub));
  }
  record(
    "2 Tab — 갈 수 있는 단계만 차례로 (focus ring), 갈 수 없는 단계는 건너뛴다",
    stops[0] === "step-1+ring" &&
      stops[1] === "step-2+ring" &&
      !stops[2].startsWith("step-"),
    stops,
  );
  // Back to the first step (the last input was a key — the focus is a keyboard one).
  await pub.evaluate(() => document.querySelectorAll(".step-link")[0].focus());
  await pub.waitForTimeout(150);
  const outline = await pub.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return {
      on: el.classList.contains("step-link") ? "link" : el.tagName,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  record(
    "2 focus ring — 키보드 focus 를 받은 Link 에 outline",
    outline.on === "link" && outline.style !== "none" && outline.width >= 2,
    outline,
  );
  await pub.keyboard.press("Space");
  await pub.waitForTimeout(200);
  const afterSpace = [await brief(pub), await readout(pub, made.text)];
  await pub.keyboard.press("Enter");
  await pub.waitForTimeout(300);
  const afterEnter = [await brief(pub), await readout(pub, made.text)];
  record(
    "2 Space 는 옮기지 않고 Enter 는 그 단계를 현재로 — When 「단계 변경」 !event.key",
    same(afterSpace, [
      "done now* todox",
      "step=step-2 done=step-1 moved= passed=",
    ]) &&
      same(afterEnter, [
        "now* todo todox",
        "step=step-1 done=step-1 moved=step-1 passed=",
      ]),
    { afterSpace, afterEnter },
  );

  // ── 3. pointer ──
  await pressStep(pub, 2);
  const blocked = [await brief(pub), await readout(pub, made.text)];
  await pressStep(pub, 1);
  const moved = [await brief(pub), await readout(pub, made.text)];
  record(
    "3 포인터 — 갈 수 없는 단계는 그대로, 갈 수 있는 단계는 현재가 된다",
    same(blocked, [
      "now* todo todox",
      "step=step-1 done=step-1 moved=step-1 passed=",
    ]) &&
      same(moved, [
        "done now* todox",
        "step=step-2 done=step-1 moved=step-2 passed=",
      ]),
    { blocked, moved },
  );

  // ── 4. the four Dos ──
  const trail = [];
  for (const capability of [
    "previousStep",
    "nextStep",
    "nextStep",
    "nextStep",
    "previousStep",
    "goToStep",
  ]) {
    await press(pub, made.buttons[capability]);
    trail.push(
      `${capability}: ${await brief(pub)} | ${await readout(pub, made.text)}`,
    );
  }
  // (written by hand from breakdown §5.2 — moved · passed keep the last user move: a Do's write
  //  runs no When.)
  const wantTrail = [
    "previousStep: now* todo todox | step=step-1 done=step-1 moved=step-2 passed=",
    "nextStep: done now* todox | step=step-2 done=step-1 moved=step-2 passed=",
    "nextStep: done done now* | step=step-3 done=step-2 moved=step-2 passed=",
    "nextStep: done done now* | step=step-3 done=step-2 moved=step-2 passed=",
    "previousStep: done now* todo | step=step-2 done=step-2 moved=step-2 passed=",
    "goToStep: done done now* | step=step-3 done=step-2 moved=step-2 passed=",
  ];
  record(
    "4 Do — 이전 · 다음 (끝에서는 머문다) · 단계로 이동: 상태는 따르고 When 은 실행되지 않는다",
    same(trail, wantTrail),
    trail,
  );
  await pub.close();

  // ── 5. 「단계 완료」 opens the next step ──
  pub = await openPublish();
  const closed = await brief(pub);
  await press(pub, made.buttons.completeStep);
  const opened = [await brief(pub), await readout(pub, made.text)];
  await pressStep(pub, 2);
  const went = [await brief(pub), await readout(pub, made.text)];
  record(
    "5 「단계 완료」 뒤 다음 단계가 눌린다",
    closed === "done now* todox" &&
      same(opened, [
        "done now* todo",
        "step=step-2 done=step-2 moved= passed=",
      ]) &&
      same(went, [
        "done done now*",
        "step=step-3 done=step-2 moved=step-3 passed=",
      ]),
    { closed, opened, went },
  );
  await pub.close();

  // ── 6. free navigation ──
  await setProps(made.listRecord, {
    allowsFreeNavigation: true,
    defaultSelectedKey: "step-1",
    defaultLastCompletedStep: "",
  });
  await page.waitForTimeout(600);
  pub = await openPublish();
  const freeStart = await brief(pub);
  await pressStep(pub, 2);
  const freeMoved = [await brief(pub), await readout(pub, made.text)];
  record(
    "6 자유 이동 — 남은 단계를 누르면 건너뛴 단계가 완료, When 「완료 단계 변경」",
    freeStart === "now* todo todo" &&
      same(freeMoved, [
        "done done now*",
        "step=step-3 done=step-2 moved=step-3 passed=step-2",
      ]),
    { freeStart, freeMoved },
  );
  await pub.close();

  // ── 7. the Builder's panels ──
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, made.listRecord);
  await openRail("properties");
  await page.waitForTimeout(900);
  const design = await page.evaluate(() => {
    const panel = document.querySelector(
      '.panel-wrapper[data-panel="properties"]',
    );
    const text = panel?.textContent ?? "";
    return {
      freeNavigation: /Free navigation|자유 이동/.test(text),
      name: [...(panel?.querySelectorAll("input, textarea") ?? [])].some(
        (input) => input.value === "가입 단계",
      ),
    };
  });
  record(
    "7 Design 패널 — 「Free navigation」 스위치와 목록 이름 칸",
    design.freeNavigation && design.name,
    design,
  );
  await openRail("events");
  await page.waitForTimeout(900);
  const rules = await page.evaluate(() => {
    const text = [...document.querySelectorAll(".panel-wrapper")]
      .map((panel) => panel.textContent ?? "")
      .join(" ");
    return {
      stepChange: /On step change|단계가 바뀔 때/.test(text),
      completedChange: /On completed step change|완료 단계가 바뀔 때/.test(
        text,
      ),
    };
  });
  record(
    "7 Interactions 패널 — 목록의 규칙 둘이 When 이름으로 보인다",
    rules.stepChange && rules.completedChange,
    rules,
  );

  record("8 page error 0", errors.length === 0, errors);
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  await page.screenshot({ path: `${OUT}/builder-final.png` }).catch(() => {});
  await browser.close();
}
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  failed.length
    ? `\n${failed.length} FAILED\n`
    : `\nALL PASS (${results.length})\n`,
);
process.exit(failed.length ? 1 : 0);

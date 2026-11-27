#!/usr/bin/env node
// ADR-321 G6 종결 live — 단계 입력 화면 하나 (StepList · StepPanel) 와 평점 입력 · 집계 표시 (Rating):
// 실제 Builder 에서 팔레트로 Stepper 를 놓고
//   패널 1 = Form (제출 → 목록의 「다음 단계」)
//   패널 2 = Form 안의 Rating 입력 (`name` score · `label` 내 평점, 이름 붙인 상태 stars) — 제출 →
//            집계 Rating 에 「값 넣기」 (변수 average 3.8 — 데이터 값) + 「다음 단계」
//   패널 3 = 표시 전용 Rating (집계 — 작성 값 4.3) + Text 「내 평점 {{ stars }}」
// Publish 에서
//   1. 시작: 단계 1 의 패널 (Form) · 단계 상태 current · incomplete · incomplete
//   2. Form 제출 → 패널 2: RAC Slider (range input name=score · 접근 이름 「내 평점」 · 값 0)
//   3. 별 4 누르기 → 4 · 화살표 ← → 3 (별 채움 = range input 값)
//   4. 패널 2 Form 의 FormData 에 score=3
//   5. 제출 → 패널 3: 집계 = RAC Meter · 값 4 (3.8 의 반쪽 별 단위) · 낭독 문구 · Text 「내 평점 3」 ·
//      단계 상태 completed · completed · current
//   6. 단계 2 누르기 → 평점 입력이 3 을 그대로 든다 (이름 붙인 상태 · 실행 값)
//   7. page error 0
// 시작 화면 (집계의 작성 값 4.3 → 반쪽 별 4.5) 은 Builder Canvas 와 Publish 가 같은 별을 그리는지도 본다.
//
//   BUILDER_URL=http://localhost:5173 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g6-live.mjs <out-dir> [--headless]
//   BROWSER=webkit 이면 Playwright WebKit 으로
//   --hold: 화면을 만든 뒤 Publish 창을 열어 두고 닫힐 때까지 기다린다 (확인 없음) — 사용자의 VoiceOver 청취 (G6)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g6-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const HOLD = process.argv.includes("--hold");

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

/** Star i's centre (Publish px from the Rating's corner — M: 18 px stars 22 apart, top 7). */
const centre = (index) => [index * 22 + 9, 7 + 9];

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr321 g6 live ${WEBKIT ? "webkit" : "chrome"}`);
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
    .filter({ hasText: /^stepper$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);

  // The screen: two Forms, the input Rating in the second, the aggregate Rating · a Text in the third.
  const made = await page.evaluate(async () => {
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
    const { catalogInteractionsCommand, catalogNewInteraction } = await import(
      loaded("/src/builder/catalogRuntime/interactions.ts")
    );
    const { catalogPaletteDefinitionId } = await import(
      loaded("/src/builder/catalogRuntime/paletteInsert.ts")
    );
    const r = ws.root;
    const graph = ws.runtime.graph;
    const stepper = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Stepper",
    );
    const kids = stepper.children.map((id) => r.canvasInputs.get(id));
    const list = kids.find((x) => r.typeOf(x) === "StepList").sourceId;
    const panels = kids
      .filter((x) => r.typeOf(x) === "StepPanel")
      .map((x) => x.sourceId);
    const pageId = graph.getEntry(graph.projectId).pageIds[0];
    const insert = (parent, id, type, props = {}) => {
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: parent },
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
      if (Object.keys(props).length)
        ws.execute(
          c.setFields({
            targets: [{ kind: "node", id }],
            props: Object.fromEntries(
              Object.entries(props).map(([k, value]) => [
                k,
                { kind: "set", value },
              ]),
            ),
            label: "Edit properties",
          }),
        );
    };
    const rules = (ownerId, trigger, steps) =>
      ws.execute(
        catalogInteractionsCommand(
          { ownerId },
          [catalogNewInteraction({ ownerId }, trigger, steps, ws.newId)],
          "Rules",
        ),
      );
    const next = {
      opcode: "capability",
      target: { nodeId: list },
      capabilityId: "nextStep",
    };
    const vars = () =>
      (graph.getEntry(graph.projectId).stateVariableIds ?? []).map((id) =>
        graph.getEntry(id),
      );

    insert(panels[0], "project:node:g6-form-1", "Form");
    rules("project:node:g6-form-1", "onSubmit", [next]);

    insert(panels[1], "project:node:g6-form-2", "Form");
    insert("project:node:g6-form-2", "project:node:g6-rating", "Rating", {
      name: "score",
      label: "내 평점",
      defaultValue: 0,
    });
    ws.execute(
      v.nameSource(
        pageId,
        "project:node:g6-rating",
        { prop: "value", type: "number" },
        0,
        "stars",
        ws.newId,
      ),
    );
    ws.execute(v.add(pageId, "average", ws.newId));
    ws.execute(
      v.setDefault(
        vars().find((x) => x.name === "average"),
        "3.8",
      ),
    );
    const average = vars().find((x) => x.name === "average");

    insert(panels[2], "project:node:g6-summary", "Rating", {
      isReadOnly: true,
      label: "평균 평점",
      defaultValue: 4.3,
    });
    rules("project:node:g6-form-2", "onSubmit", [
      {
        opcode: "capability",
        target: { nodeId: "project:node:g6-summary" },
        capabilityId: "setValue",
        value: `!var.${average.id}`,
      },
      next,
    ]);
    insert(panels[2], "project:node:g6-mine", "Text");
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: "project:node:g6-mine" }],
        props: { children: { kind: "set", value: "내 평점 {{ stars }}" } },
        label: "Edit properties",
      }),
    );
    const one = (id) => r.recordsOfSource(id)[0];
    return {
      stepper: stepper.id,
      form1: one("project:node:g6-form-1"),
      form2: one("project:node:g6-form-2"),
      rating: one("project:node:g6-rating"),
      summary: one("project:node:g6-summary"),
      mine: one("project:node:g6-mine"),
      vars: vars().map((x) => x.name),
    };
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/0-builder.png` });

  const pub = await openPublish();
  if (HOLD) {
    process.stdout.write(
      "Publish 창이 열렸습니다 — VoiceOver (Cmd + F5) 를 켜고 Tab 으로 단계 목록 · Form · 별점을 지나가 보세요. 창을 닫으면 끝납니다.\n",
    );
    await pub.waitForEvent("close", { timeout: 0 });
    process.stdout.write("창이 닫혔습니다 — 확인 없이 끝냅니다.\n");
    await browser.close();
    process.exit(0);
  }
  const el = (id) => `[data-catalog-id="${id}"]`;
  /** The panels the Stepper draws now, each as the made node it holds (form1 · form2 · summary). */
  const panelsShown = () =>
    pub.evaluate(
      ({ stepper, marks }) => {
        const box = document.querySelector(
          `[data-catalog-id="${CSS.escape(stepper)}"]`,
        );
        return [...box.children]
          .filter((child) => child.getAttribute("role") !== "group")
          .map(
            (child) =>
              Object.entries(marks).find(([, id]) =>
                child.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
              )?.[0] ?? child.textContent,
          );
      },
      {
        stepper: made.stepper,
        marks: { form1: made.form1, form2: made.form2, summary: made.summary },
      },
    );
  const stepStates = () =>
    pub.evaluate(() =>
      [...document.querySelectorAll(".react-aria-Step")].map((li) =>
        li.getAttribute("data-step-state"),
      ),
    );
  const readRating = (id) =>
    pub.evaluate((id) => {
      const box = document.querySelector(
        `[data-catalog-id="${CSS.escape(id)}"]`,
      );
      if (!box) return null;
      const input = box.querySelector("input");
      const b = box.getBoundingClientRect();
      return {
        role: box.getAttribute("role"),
        x: b.x,
        y: b.y,
        label: box.getAttribute("aria-label"),
        value: input?.value,
        name: input?.name,
        type: input?.type,
        now: box.getAttribute("aria-valuenow"),
        valuetext: box.getAttribute("aria-valuetext"),
        fills: [...box.querySelectorAll(".rating-star")].map(
          (s) => s.dataset.fill,
        ),
      };
    }, id);
  const optional = (form) =>
    pub.evaluate((id) => {
      for (const input of document.querySelectorAll(
        `[data-catalog-id="${CSS.escape(id)}"] input`,
      ))
        input.removeAttribute("required");
    }, form);
  const submit = async (form) => {
    await optional(form);
    await pub
      .locator(`${el(form)} button[type="submit"]`)
      .first()
      .click();
    await pub.waitForTimeout(500);
  };

  // 1. Start.
  const start = { panels: await panelsShown(), states: await stepStates() };
  record(
    "1 시작: 단계 1 의 패널 (Form) · current · incomplete · incomplete",
    same(start.panels, ["form1"]) &&
      same(start.states, ["current", "incomplete", "incomplete"]),
    { start, made },
  );
  await pub.screenshot({ path: `${OUT}/1-publish-step-1.png` });

  // 2. Submit → the rating input.
  await submit(made.form1);
  await pub.waitForSelector(`${el(made.rating)}[role="group"]`, {
    timeout: 30000,
  });
  let input = await readRating(made.rating);
  record(
    "2 Form 제출 → 패널 2: RAC Slider · range input name=score · 접근 이름 「내 평점」 · 값 0",
    input.role === "group" &&
      input.type === "range" &&
      input.name === "score" &&
      input.label === "내 평점" &&
      input.value === "0" &&
      input.fills.every((f) => f === "empty"),
    input,
  );

  // 3. Star 4, then ← to 3.
  const [cx, cy] = centre(3);
  await pub.mouse.click(input.x + cx, input.y + cy);
  await pub.waitForTimeout(150);
  const four = await readRating(made.rating);
  await pub.locator(`${el(made.rating)} input`).focus();
  await pub.keyboard.press("ArrowLeft");
  await pub.waitForTimeout(150);
  input = await readRating(made.rating);
  const full = (x) => x.fills.filter((f) => f === "full").length;
  record(
    "3 별 4 누르기 → 4 · ← → 3 (별 채움 = range input 값)",
    four.value === "4" &&
      full(four) === 4 &&
      input.value === "3" &&
      full(input) === 3,
    { four, three: input },
  );
  await pub.screenshot({ path: `${OUT}/3-publish-rated.png` });

  // 4. The form value.
  const formData = await pub.evaluate((id) => {
    const form = document.querySelector(
      `[data-catalog-id="${CSS.escape(id)}"]`,
    );
    const node = form.tagName === "FORM" ? form : form.querySelector("form");
    return Object.fromEntries(new FormData(node));
  }, made.form2);
  record("4 FormData 에 score=3", formData.score === "3", formData);

  // 5. Submit → the aggregate.
  await submit(made.form2);
  await pub.waitForSelector(`${el(made.summary)}[role="meter"]`, {
    timeout: 30000,
  });
  const summary = await readRating(made.summary);
  const mine = await pub.evaluate(
    (id) =>
      document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
        ?.textContent,
    made.mine,
  );
  const after = { panels: await panelsShown(), states: await stepStates() };
  record(
    "5 제출 → 패널 3: 집계 = RAC Meter · 값 4 (데이터 값 3.8 → 반쪽 별 단위) · 낭독 문구 · 「내 평점 3」 · completed · completed · current",
    summary.role === "meter" &&
      summary.now === "4" &&
      /4/.test(summary.valuetext ?? "") &&
      !/%/.test(summary.valuetext ?? "") &&
      summary.label === "평균 평점" &&
      same(summary.fills, ["full", "full", "full", "full", "empty"]) &&
      mine === "내 평점 3" &&
      same(after.panels, ["summary"]) &&
      same(after.states, ["completed", "completed", "current"]),
    { summary, mine, after },
  );
  await pub.screenshot({ path: `${OUT}/5-publish-summary.png` });

  // 6. Back to step 2.
  await pub.locator(".react-aria-StepList .step-link").nth(1).click();
  await pub.waitForSelector(`${el(made.rating)}[role="group"]`, {
    timeout: 30000,
  });
  const back = await readRating(made.rating);
  record(
    "6 단계 2 누르기 → 평점 입력이 3 을 그대로 든다",
    back.value === "3" && full(back) === 3,
    back,
  );
  await pub.close();

  // The start of the aggregate (authored 4.3 → 4.5, half a star) in a fresh Publish: step 3 first.
  const pub2 = await (async () => {
    await page.evaluate(
      ({ list }) => {
        const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(list).target],
            props: { defaultSelectedKey: { kind: "set", value: "step-3" } },
          }),
        );
      },
      {
        list: await page.evaluate((stepper) => {
          const r = window.__COMPOSITION_CATALOG__.workspace.root;
          return r.canvasInputs
            .get(stepper)
            .children.find(
              (id) => r.typeOf(r.canvasInputs.get(id)) === "StepList",
            );
        }, made.stepper),
      },
    );
    await page.waitForTimeout(800);
    return openPublish();
  })();
  await pub2.waitForSelector(
    `[data-catalog-id="${made.summary}"][role="meter"]`,
    {
      timeout: 30000,
    },
  );
  const authored = await pub2.evaluate((id) => {
    const box = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    return {
      now: box.getAttribute("aria-valuenow"),
      valuetext: box.getAttribute("aria-valuetext"),
      fills: [...box.querySelectorAll(".rating-star")].map(
        (s) => s.dataset.fill,
      ),
    };
  }, made.summary);
  const canvas = await page.evaluate((id) => {
    const b = window.__COMPOSITION_CATALOG__.canvas.boundsOf(id);
    return { box: b && { w: b.width, h: b.height } };
  }, made.summary);
  await page.screenshot({ path: `${OUT}/6-builder-step-3.png` });
  await pub2.screenshot({ path: `${OUT}/6-publish-step-3.png` });
  record(
    "5b 집계의 작성 값 4.3 → 4.5 (반쪽 별) · Builder 에서도 단계 3 의 패널이 그려진다",
    authored.now === "4.5" &&
      same(authored.fills, ["full", "full", "full", "full", "half"]) &&
      Math.abs((canvas.box?.w ?? 0) - 106) <= 1 &&
      Math.abs((canvas.box?.h ?? 0) - 32) <= 1,
    { authored, canvas },
  );
  await pub2.close();
} catch (error) {
  record("run", false, String(error?.stack ?? error));
} finally {
  record("7 page error 0", errors.length === 0, errors);
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n${failed ? "FAILED" : "ALL PASS"} ${results.length - failed}/${results.length}\n`,
  );
  process.exit(failed ? 1 : 0);
}

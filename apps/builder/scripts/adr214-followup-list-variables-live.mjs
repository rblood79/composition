#!/usr/bin/env node
// adr214-followup-list-variables-live.mjs — ADR-214 후속 `list_variables` 읽기 tool live — 실제 빌더 + AI 패널 (Ollama qwen3:14b):
//   ① 프로젝트 변수 count · Checkbox 암묵 agree 를 UI 로 만든 뒤 AI 패널에 "list_variables 로 변수 목록을 읽어줘"
//   ② provider 요청 본문에 tool 정의 `list_variables` 가 실린다 · 모델이 그 tool 을 부른다 (패널 tool-result 행)
//   ③ tool 결과 (role:"tool" 메시지) 에 count(project) · agree(element, Checkbox) 가 소유자와 함께 있고 런타임 값 키는 없다
//   ④ 호출 전후 Data 탭 목록 동일 (쓰기 0) · dialog 0 · page error 0
// 사용: node apps/builder/scripts/adr214-followup-list-variables-live.mjs [--headless]
// 환경: ollama serve 컨텍스트 ≥ 8k (기본 4096 이면 tool 정의가 잘린다 — /api/ps context_length 확인)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const OLLAMA = "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:14b";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-list-variables";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 list_variables live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};
const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 300) {
  const begin = Date.now();
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  } while (Date.now() - begin < maxMs);
  return last;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
});
await context.addInitScript(
  ({ MODEL }) => {
    const profile = {
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: MODEL,
    };
    localStorage.setItem(
      "composition.ai.profiles",
      JSON.stringify({ main: profile, planner: profile, executor: profile }),
    );
    window.__llmBodies = [];
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      if (url.includes("/chat/completions") && init?.body) {
        try {
          window.__llmBodies.push(JSON.parse(init.body));
        } catch {
          window.__llmBodies.push({ raw: String(init.body).slice(0, 200) });
        }
      }
      return orig(input, init);
    };
  },
  { MODEL },
);
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

const createProject = async (name) => {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(name);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url().split("/builder/")[1];
};
const createVariable = async (name, defaultValue) => {
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.locator(".panel-tab").nth(2).click();
  await page.waitForTimeout(300);
  await panel
    .locator('button:has-text("Add Variable"), button:has-text("변수 추가")')
    .first()
    .click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator
    .locator('input[aria-label="Name"], input[aria-label="이름"]')
    .fill(name);
  const typeSelect = creator.locator(".react-aria-Select button").first();
  if (typeof defaultValue === "number" && (await typeSelect.count())) {
    await typeSelect.click();
    await page
      .locator('[role="option"]', { hasText: /^Number$|^숫자$/ })
      .first()
      .click();
  }
  await creator
    .locator(
      'button:has-text("Create Variable"), button:has-text("변수 만들기")',
    )
    .last()
    .click();
  await page.waitForTimeout(800);
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  const defaultInput = editor
    .locator("fieldset", {
      has: page.locator('legend:has-text("Default Value")'),
    })
    .locator("input")
    .first();
  await defaultInput.waitFor({ timeout: 10_000 });
  await defaultInput.fill(String(defaultValue));
  await defaultInput.press("Enter");
  await page.waitForTimeout(400);
};
const addByTitle = async (re) => {
  await setPanel(page, "components", true);
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(
      st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      )?.id ??
        st.elements.find((e) => e.type === "body")?.id ??
        null,
    );
  });
  await page.waitForTimeout(300);
  const handle = await page.evaluateHandle(
    (src) =>
      [...document.querySelectorAll("button.list-item")].find((b) =>
        new RegExp(src, "i").test(b.getAttribute("title") ?? ""),
      ),
    re.source,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`팔레트 버튼 없음 ${re}`);
  await el.scrollIntoViewIfNeeded();
  const countEls = () =>
    page.evaluate(
      () => window.__composition_STORE__.getState().elements.length,
    );
  const before = await countEls();
  await el.click();
  await pollUntil(countEls, (n) => n > before, 15_000, 300);
  await page.waitForTimeout(500);
  return page.evaluate(
    () => window.__composition_STORE__.getState().selectedElementId,
  );
};
const readProjectVarRows = () =>
  page.evaluate(() =>
    JSON.stringify(
      [
        ...document.querySelectorAll(
          '[data-variable-group="project"] .list-item',
        ),
      ].map((e) => e.textContent),
    ),
  );

try {
  const ps = await fetch(`${OLLAMA}/api/ps`)
    .then((r) => r.json())
    .catch(() => null);
  log(
    "ollama ps",
    JSON.stringify(
      ps?.models?.map((m) => ({ name: m.name, ctx: m.context_length })) ?? ps,
    ),
  );
  const projectId = await createProject(`adr214-lv-${Date.now()}`);
  log("project", projectId);
  await createVariable("count", 0);
  const varsBefore = await readProjectVarRows();

  // Checkbox 암묵 isSelected → agree
  const checkId = await addByTitle(
    /^Add checkbox element$|addElement: Checkbox$/,
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    checkId,
  );
  await setPanel(page, "properties", true);
  const stateSection = page.locator(
    `#properties-state[data-state-owner="${checkId}"]`,
  );
  await stateSection.waitFor({ timeout: 10_000 });
  await stateSection.scrollIntoViewIfNeeded();
  const implicitInput = stateSection.locator(
    '.state-def[data-implicit="isSelected"] input.state-def-name-input',
  );
  await implicitInput.waitFor({ timeout: 8000 });
  await implicitInput.fill("agree");
  await implicitInput.press("Enter");
  await pollUntil(
    () =>
      stateSection
        .locator('.state-def[data-implicit="isSelected"] .state-def-name')
        .textContent()
        .catch(() => null),
    (t) => t === "agree",
    8000,
    200,
  );

  // AI 패널 → 전송
  await setPanel(page, "ai", true);
  const textarea = page.locator(".ai-composer textarea");
  await textarea.waitFor({ timeout: 10_000 });
  await textarea.fill(
    "list_variables 도구를 호출해서 이 프로젝트의 변수 목록을 읽고, 변수마다 이름과 소유자 종류(project/page/element)를 한 줄씩 알려줘. 다른 도구는 쓰지 마.",
  );
  await page
    .locator(
      '.ai-composer button[aria-label="질문 제출"], .ai-composer button[aria-label="Submit question"], .ai-composer button[type="submit"]',
    )
    .first()
    .click();
  const started = Date.now();
  // 완료된 호출은 `.tool-result-message` (toolLabels 어휘 "변수 목록 읽기 · 읽음") 로 남고 `.tool-call-message` 는 실행 중에만 보인다
  const toolResults = await pollUntil(
    () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".tool-result-message")].map((e) => ({
          label: e.querySelector(".tool-result-label")?.textContent ?? "",
          success: e.getAttribute("data-success"),
        })),
      ),
    (rows) => rows.some((r) => /변수 목록|variable list/i.test(r.label)),
    240_000,
    1500,
  );
  const elapsedMs = Date.now() - started;
  const bodies = await page.evaluate(() => window.__llmBodies);
  // 첫 요청은 planner (tools 0) — tool 이 실린 요청을 본다
  const toolBearing = bodies.find((b) => (b.tools ?? []).length > 0);
  const toolNames = (toolBearing?.tools ?? []).map((t) => t.function?.name);
  const hasDef = toolNames.includes("list_variables");
  record(
    "② 요청 본문 tools 에 list_variables 정의 · 모델이 list_variables 를 호출 (패널 tool-result 행 · toolLabels 어휘)",
    hasDef &&
      toolResults.some(
        (r) => /변수 목록|variable list/i.test(r.label) && r.success === "true",
      ),
    JSON.stringify({
      toolsCount: toolNames.length,
      hasDef,
      toolResults,
      requests: bodies.length,
      elapsedMs,
    }),
  );

  // tool 결과 메시지 (role:"tool") — 후속 요청 본문에 실린다
  const toolMsgs = bodies
    .flatMap((b) => (b.messages ?? []).filter((m) => m.role === "tool"))
    .map((m) => String(m.content ?? ""));
  const lvResult = toolMsgs
    .map((c) => {
      try {
        return JSON.parse(c);
      } catch {
        return null;
      }
    })
    .find(
      (v) =>
        v &&
        JSON.stringify(v).includes('"count"') &&
        JSON.stringify(v).includes('"agree"'),
    );
  const rows = Array.isArray(lvResult)
    ? lvResult
    : Array.isArray(lvResult?.data)
      ? lvResult.data
      : Array.isArray(lvResult?.result)
        ? lvResult.result
        : null;
  const countRow = rows?.find((r) => r.name === "count");
  const agreeRow = rows?.find((r) => r.name === "agree");
  const keys = rows ? [...new Set(rows.flatMap((r) => Object.keys(r)))] : [];
  record(
    "③ tool 결과: count → owner project · agree → owner element (Checkbox) · usedBy 수 · 런타임 값 키 없음",
    !!countRow &&
      countRow.owner?.kind === "project" &&
      !!agreeRow &&
      agreeRow.owner?.kind === "element" &&
      agreeRow.owner?.elementType === "Checkbox" &&
      typeof countRow.usedBy === "number" &&
      !keys.some((k) => /^(value|runtimeValue|current)$/i.test(k)),
    JSON.stringify({
      toolMsgs: toolMsgs.length,
      countRow,
      agreeRow,
      keys,
    }).slice(0, 600),
  );

  const assistant = await pollUntil(
    () =>
      page.evaluate(
        () =>
          [
            ...document.querySelectorAll(
              '.ai-message[data-role="assistant"] .ai-message-bubble',
            ),
          ]
            .map((e) => e.textContent ?? "")
            .at(-1) ?? "",
      ),
    (t) =>
      /count/.test(t) &&
      /agree/.test(t) &&
      /project|프로젝트/i.test(t) &&
      /element|요소/i.test(t),
    120_000,
    1500, // 스트리밍 중 조기 판정 방지 — 답변 완성분까지
  );
  record(
    "① 답변에 count · agree 와 소유자 종류가 언급된다",
    /count/.test(assistant) &&
      /agree/.test(assistant) &&
      /project|프로젝트/i.test(assistant) &&
      /element|요소/i.test(assistant),
    JSON.stringify(assistant.slice(0, 300)),
  );

  await setPanel(page, "datatable", true);
  await page.locator(".datatable-panel .panel-tab").nth(2).click();
  await page.waitForTimeout(300);
  const varsAfter = await readProjectVarRows();
  const indexKinds = await page
    .locator('[data-variable-group="index"] .variable-index-item')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-owner-kind")));
  record(
    "④ 쓰기 0 — Data 탭 프로젝트 변수 목록 · 인덱스 (element 1) 가 호출 전과 같다",
    varsAfter === varsBefore &&
      indexKinds.length === 1 &&
      indexKinds[0] === "element",
    JSON.stringify({ varsBefore, varsAfter, indexKinds }),
  );

  // 절단 여부 — tool 이 실린 요청을 stream:false 로 다시 보내 prompt_tokens 확인 (ollama 기본 num_ctx 4096 함정)
  if (toolBearing) {
    const usage = await fetch(`${OLLAMA}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...toolBearing, stream: false }),
    })
      .then((r) => r.json())
      .then((j) => j.usage)
      .catch((e) => ({ error: String(e) }));
    const bytes = JSON.stringify(toolBearing).length;
    record(
      "환경 — tool 실린 요청의 prompt_tokens 가 본문 크기에 걸맞다 (절단 없음)",
      (usage?.prompt_tokens ?? 0) > bytes / 8,
      JSON.stringify({ bytes, usage }),
    );
  }
  record("native dialog 0", dialogs === 0, String(dialogs));
  record(
    "page error 0",
    pageErrors.length === 0,
    pageErrors.join(" | ").slice(0, 200),
  );
  writeFileSync(
    resolve(OUT_DIR, "llm-bodies.json"),
    JSON.stringify(bodies, null, 2),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "final.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 400));
  await page
    .screenshot({ path: resolve(OUT_DIR, "failure.png") })
    .catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify(findings, null, 2),
  );
  await browser.close();
  const failed = findings.filter((f) => !f.pass).length;
  log(
    `done — ${findings.length - failed}/${findings.length} PASS → ${OUT_DIR}`,
  );
  process.exit(failed ? 1 : 0);
}

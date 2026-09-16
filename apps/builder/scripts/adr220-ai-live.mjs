#!/usr/bin/env node
// adr220-ai-live.mjs — ADR-220 G5 (AI 쪽): 실제 빌더 AI 패널에서 Ollama qwen3:14b 가
// `create_table_from_description` 을 호출하고, 규칙 kind `generate` (mock → generate rename) 로
// 샘플 행이 만들어져 승인 → IndexedDB collection 에 저장되는지 확인한다.
//   1) 모델 응답 (11434 스트림 본문) 안의 tool_call 인자에 `"kind":"generate"` 가 있거나 (모델 선택),
//      없으면 key 힌트 (phone/city/address → generate) 가 채운다 — 어느 쪽이든 행이 규칙대로 생성
//   2) 승인 다이얼로그 → 승인 → collection 행 5 · phone 형식 · page error 0
// 사용: node apps/builder/scripts/adr220-ai-live.mjs   (dev 5173 · .auth-session.json · Ollama 32k ctx)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE = "http://localhost:5173";
const OUT = process.env.ADR220_AI_OUT ?? "/private/tmp/adr220-ai-live";
const storageState = JSON.parse(
  readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
);
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("[220 ai live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState,
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(() => {
  const p = {
    provider: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen3:14b",
  };
  localStorage.setItem(
    "composition.ai.profiles",
    JSON.stringify({ main: { ...p }, planner: { ...p }, executor: { ...p } }),
  );
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const llmBodies = [];
page.on("response", async (r) => {
  if (!r.url().includes("11434")) return;
  try {
    llmBodies.push(await r.text());
  } catch {
    llmBodies.push("<unreadable>");
  }
});

async function idbCollections(projectId) {
  return page.evaluate(async (projectId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db
        .transaction("collections", "readonly")
        .objectStore("collections")
        .getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return rows.filter((row) => row.project_id === projectId);
  }, projectId);
}

try {
  const ps = await (await fetch("http://localhost:11434/api/ps")).json();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const input = page.locator("#new-project-name");
  await input.fill(`adr220-ai-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("builder ready", projectId);

  await page.locator('button[aria-label="AI"]').first().click();
  const textarea = page
    .locator(
      'textarea[aria-label="Ask anything"], textarea[aria-label="무엇이든 물어보세요"]',
    )
    .first();
  await textarea.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(1500);

  const message =
    "Use create_table_from_description to propose a new data collection (a data table in the Data panel, not a UI component) named Customers with fields: name (person name), phone (phone number), city, email. 5 sample rows.";
  await textarea.fill(message);
  await textarea.press("Enter");
  const started = Date.now();

  // 승인 다이얼로그 (tool 실행 → dispatchDataProposal → 확인)
  const dialog = page.locator(".agent-confirm-dialog");
  const panelState = () =>
    page.evaluate(() => ({
      assistant: [
        ...document.querySelectorAll(
          '.ai-message[data-role="assistant"] .ai-message-bubble',
        ),
      ].map((n) => n.textContent?.slice(0, 300)),
      toolCalls: [...document.querySelectorAll(".tool-call-message")].map(
        (n) => `${n.dataset.status}: ${n.textContent}`,
      ),
      toolResults: [...document.querySelectorAll(".tool-result-message")].map(
        (n) => `${n.dataset.success}: ${n.textContent?.slice(0, 200)}`,
      ),
    }));
  try {
    // 다이얼로그 또는 tool 실패 2회 (Agent 가 재시도한 뒤) 중 먼저 오는 쪽
    await page.waitForFunction(
      () =>
        document.querySelector(".agent-confirm-dialog") !== null ||
        document.querySelectorAll('.tool-result-message[data-success="false"]')
          .length >= 2,
      null,
      { timeout: 300_000 },
    );
    if (!(await dialog.count())) throw new Error("tool 실패 2회 — 다이얼로그 없음");
  } catch (e) {
    const state = await panelState();
    await page.screenshot({ path: resolve(OUT, "0-timeout.png") });
    writeFileSync(
      resolve(OUT, "timeout.json"),
      JSON.stringify(
        { state, errors, llmBodies },
        null,
        2,
      ),
    );
    record("승인 다이얼로그 도달", false, JSON.stringify(state).slice(0, 400));
    throw e;
  }
  const meta = await page
    .locator('[data-testid="agent-confirm-meta"]')
    .textContent()
    .catch(() => "");
  const body = await page
    .locator(".agent-confirm-body")
    .textContent()
    .catch(() => "");
  log("confirm dialog after", Math.round((Date.now() - started) / 1000), "s");
  await page.screenshot({ path: resolve(OUT, "1-confirm-dialog.png") });
  record(
    "create_table_from_description → 승인 다이얼로그 (create_collection 제안)",
    /Customers|customers/i.test(body ?? "") && /5/.test(body ?? ""),
    `${(body ?? "").replace(/\s+/g, " ").slice(0, 220)} · ${meta}`,
  );

  // 모델이 낸 tool 인자 — 스트림 본문에서 generate 규칙 확인
  const toolText = llmBodies.join("\n");
  const generateKind = /\\?"kind\\?"\s*:\s*\\?"generate\\?"/.test(toolText);
  const mockKind = /\\?"kind\\?"\s*:\s*\\?"mock\\?"/.test(toolText);
  const usedTool = /create_table_from_description/.test(toolText);
  record(
    "모델 tool_call 인자: kind mock 0 (generate 는 모델 선택 또는 key 힌트)",
    usedTool && !mockKind,
    `tool ${usedTool} · generate ${generateKind} · mock ${mockKind}`,
  );

  // 승인
  await page.locator(".agent-confirm-actions button").last().click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tool-result-message").length > 0,
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1500);
  const toolResults = await page.evaluate(() =>
    [...document.querySelectorAll(".tool-result-message")].map((n) => ({
      success: n.dataset.success,
      text: n.textContent?.slice(0, 200),
    })),
  );
  const collections = await idbCollections(projectId);
  const table = collections.find((c) => /customers/i.test(c.name));
  const rows = table?.mockData ?? [];
  const phoneKey = table?.schema.find((f) => /phone|tel/i.test(f.key))?.key;
  const phones = phoneKey ? rows.map((r) => r[phoneKey]) : [];
  record(
    "승인 → collection 저장: 행 5 · phone 형식 (generate 규칙 phone)",
    rows.length === 5 &&
      phones.length === 5 &&
      phones.every((p) => /^[\d+(][\d\s().-]{6,}$/.test(String(p))),
    `${table?.name} · ${rows.length} rows · ${JSON.stringify(rows[0]).slice(0, 200)} · tool ${JSON.stringify(toolResults).slice(0, 160)}`,
  );
  await page.screenshot({ path: resolve(OUT, "2-after-approve.png") });
  const stop = page.locator(
    'button[aria-label="Stop agent"], button[aria-label="에이전트 중단"]',
  );
  if (await stop.count()) await stop.click();
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 200));
  writeFileSync(
    resolve(OUT, "findings.json"),
    JSON.stringify(
      {
        ollamaPs: ps,
        findings,
        errors,
        message,
        toolResults,
        table: table && { name: table.name, schema: table.schema, rows },
        llmBodySample: toolText.slice(0, 4000),
      },
      null,
      2,
    ),
  );
} finally {
  const passed = findings.filter((f) => f.pass).length;
  log(`${passed}/${findings.length} PASS`);
  await browser.close();
  process.exitCode = passed === findings.length && findings.length > 0 ? 0 : 1;
}

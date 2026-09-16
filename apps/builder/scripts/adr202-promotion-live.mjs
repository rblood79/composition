#!/usr/bin/env node
// adr202-promotion-live.mjs — ADR-202 Implemented 승격 판정 live (2026-09-16). headed Playwright, 실제 builder dev (5173), 실제 Ollama (qwen3:14b, 32k ctx).
//   A) provider 설정 상태에서 direct "버튼 생성해" → 11434 호출 0 · Button +1
//   B) 모호 요청 → compile ambiguous → openai-compatible 은 legacy Agent (G4 예외) → 11434 호출 ≥1 (실모델)
// 준비: builder dev (5173) · 로그인 세션 (.auth-session.json) · Ollama qwen3:14b (OLLAMA_CONTEXT_LENGTH=32768).
// 사용: node apps/builder/scripts/adr202-promotion-live.mjs  (ADR202_OUT 으로 산출물 경로 지정)
//   C) G6 rollback 키 → 같은 direct 문구가 Agent 로 감 (11434 ≥1) → 키 제거 → direct 복귀 (0)
//   D) Stop 직후 (abort 스트림 미종료) 즉시 재전송이 버려지지 않는다 — stopAgent requestRef 해제 수리 검증
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE = "http://localhost:5173";
const OUT = process.env.ADR202_OUT ?? "/private/tmp/adr202-promotion-live";
const storageState = JSON.parse(
  readFileSync(
    resolve(
      "/Users/admin/work/composition/apps/builder/scripts/.auth-session.json",
    ),
    "utf8",
  ),
);
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("[202 live]", ...a);
const results = { startedAt: new Date().toISOString(), scenarios: [] };

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
let phase = "boot";
page.on("pageerror", (e) =>
  errors.push({
    phase,
    t: new Date().toISOString(),
    error: String(e).slice(0, 200),
  }),
);
let pendingLlm = 0;
page.on("request", (r) => {
  if (r.url().includes("11434")) pendingLlm++;
});
page.on("requestfinished", (r) => {
  if (r.url().includes("11434")) pendingLlm--;
});
page.on("requestfailed", (r) => {
  if (r.url().includes("11434")) pendingLlm--;
});
let netLog = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.startsWith(BASE)) return; // vite dev · HMR · 소스 모듈
  netLog.push({ url: u, method: r.method(), ts: Date.now() });
});
let llmResponses = 0;
page.on("response", (r) => {
  if (r.url().includes("11434")) llmResponses++;
});
const llmCalls = () => netLog.filter((r) => r.url.includes("11434")).length;
const external = () =>
  netLog.filter((r) => !r.url.includes("11434")).map((r) => r.url);

// 프로젝트 생성
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.locator("button.dashboard-create-button").first().click();
const input = page.locator("#new-project-name");
await input.fill(`adr202-promotion-${Date.now()}`);
await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
await waitReady(page);
log("builder ready", page.url());

const elementsSnapshot = () =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const els = Object.values(st.elements ?? {});
    return { count: els.length, types: els.map((e) => e.tag ?? e.type).sort() };
  });
const assistantTexts = () =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.ai-message[data-role="assistant"] .ai-message-bubble',
      ),
    ].map((n) => n.textContent),
  );
const toolResults = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".tool-result-message")].map((n) => ({
      success: n.dataset.success,
      text: n.textContent,
    })),
  );

// AI 패널 열기
await page.locator('button[aria-label="AI"]').first().click();
const textarea = page
  .locator(
    'textarea[aria-label="Ask anything"], textarea[aria-label="무엇이든 물어보세요"]',
  )
  .first();
await textarea.waitFor({ state: "visible", timeout: 20_000 });
await page.waitForTimeout(1500); // lazy AI 청크 로드 (첫 열림)
phase = "panel-open";
log("AI panel open · lazy loaded · net so far", netLog.length);

async function submit(
  label,
  message,
  { waitLlm = false, timeoutMs = 240_000, skipAbortWait = false } = {},
) {
  phase = label;
  // 직전 Agent 의 abort 된 스트림이 실제로 끝날 때까지 (requestRef 해제) 대기
  const tw = Date.now();
  while (!skipAbortWait && pendingLlm > 0 && Date.now() - tw < 120_000)
    await page.waitForTimeout(500);
  const waitedForAbortMs = Date.now() - tw;
  netLog = [];
  llmResponses = 0;
  const before = await elementsSnapshot();
  const beforeMsgs = (await assistantTexts()).length;
  const t0 = Date.now();
  await textarea.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const t = document.querySelector(
        'textarea[aria-label="Ask anything"], textarea[aria-label="무엇이든 물어보세요"]',
      );
      return t && !t.disabled;
    },
    null,
    { timeout: 300_000 },
  );
  await textarea.fill(message);
  await textarea.press("Enter");
  // 종료 판정: assistant 메시지 증가 + (waitLlm 이면 스트리밍 끝 = 2초간 메시지 텍스트 불변)
  let last = "";
  let stable = 0;
  let stopped = false;
  while (Date.now() - t0 < timeoutMs) {
    if (waitLlm && !stopped && llmResponses >= 1) {
      // 실모델 첫 응답 확인 — Agent 자연 종료 (MAX_TURNS 10 × 45~100초) 는 판정 대상 아님 → Stop
      await page.waitForTimeout(1500);
      const stop = page
        .locator(
          'button[aria-label="Stop agent"], button[aria-label="에이전트 중단"], button[aria-label="Stop"], button[aria-label="중지"]',
        )
        .first();
      if (await stop.count()) await stop.click();
      stopped = true;
      await page.waitForTimeout(1500);
      break;
    }
    await page.waitForTimeout(1000);
    const msgs = await assistantTexts();
    if (msgs.length > beforeMsgs) {
      const cur = msgs.join("");
      const running = await page.evaluate(() =>
        Boolean(document.querySelector(".tool-call-spinner")),
      );
      if (cur === last && !running) stable++;
      else stable = 0;
      last = cur;
      if (stable >= (waitLlm ? 4 : 1)) break;
    }
  }
  const after = await elementsSnapshot();
  const r = {
    label,
    message,
    ms: Date.now() - t0,
    llmCalls: llmCalls(),
    waitedForAbortMs,
    llmResponses,
    stoppedByHarness: waitLlm,
    externalRequests: external(),
    elementsBefore: before.count,
    elementsAfter: after.count,
    addedTypes: after.types.filter((x, i) => x !== before.types[i]).slice(0, 5),
    assistant: (await assistantTexts()).slice(beforeMsgs),
    toolResults: await toolResults(),
    pageErrors: errors.length,
  };
  results.scenarios.push(r);
  writeFileSync(`${OUT}/live-results.json`, JSON.stringify(results, null, 2));
  log(
    label,
    JSON.stringify({
      ms: r.ms,
      llmCalls: r.llmCalls,
      ext: r.externalRequests.length,
      els: `${r.elementsBefore}→${r.elementsAfter}`,
      assistant: r.assistant.map((s) => s.slice(0, 60)),
    }),
  );
  await page.screenshot({ path: `${OUT}/live-${label}.png` });
  return r;
}

// A) direct — provider 설정됨에도 provider 호출 0
await submit("A-direct-button", "버튼 생성해");
await submit("A2-direct-select", "셀렉트 생성해");

// B) 모호 — G4 예외: openai-compatible 은 legacy Agent → 실모델 호출
await submit("B-ambiguous", "이 화면을 조금 더 보기 좋게 정리해줘", {
  waitLlm: true,
});

// C) G6 rollback 키
await page.evaluate(() =>
  sessionStorage.setItem("composition.ai.compiler.disabled", "true"),
);
await submit("C1-disabled-button", "버튼 생성해", { waitLlm: true });
await page.evaluate(() =>
  sessionStorage.removeItem("composition.ai.compiler.disabled"),
);
await submit("C2-reenabled-button", "버튼 생성해");

// D) 수리 검증 — Stop 직후 (abort 스트림 미종료) 바로 direct 재전송이 버려지지 않는다
await submit("D1-ambiguous-stop", "이 화면을 조금 더 보기 좋게 정리해줘", {
  waitLlm: true,
});
const dPending = pendingLlm;
await submit("D2-resend-immediately", "버튼 생성해", { skipAbortWait: true });
results.dPendingAtResend = dPending;
log("D pending llm at resend", dPending);

// 계측 (same-instance 시도 — 다른 인스턴스면 빈 배열이 나온다)
results.metricsProbe = await page.evaluate(async () => {
  try {
    const m = await import("/src/services/ai/compiler/runtime.ts");
    return m.getCompilerMetrics();
  } catch (e) {
    return String(e);
  }
});
results.ollamaPs = await (await fetch("http://localhost:11434/api/ps")).json();
results.pageErrors = errors;
results.endedAt = new Date().toISOString();
writeFileSync(`${OUT}/live-results.json`, JSON.stringify(results, null, 2));
log("metricsProbe", JSON.stringify(results.metricsProbe).slice(0, 600));
log("pageErrors", errors.length);
await browser.close();

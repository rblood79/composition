#!/usr/bin/env node
/**
 * AI 패널 reasoningEffort 배선 live — 실제 AI 패널 요청 본문에 프로파일 값이 실리는가.
 *
 * local-ollama 프리셋 + 모델 입력 뒤 저장되는 모양을 심고 (planner 만 배선 확인용 "low"), 모호 요청을
 * 보내 11434 로 나가는 첫 요청 (planner) 본문을 가로챈다 (Ollama 없이 — 503 으로 끝낸다).
 *
 *   node apps/builder/scripts/ai-reasoning-effort-live.mjs
 */
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch();
let ok = false;
try {
  const { page } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
    frameCapture: false,
    initScript: () => {
      const p = (effort) => ({
        provider: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "qwen3:14b",
        ...(effort ? { reasoningEffort: effort } : {}),
      });
      // AGENT_PROFILE_PRESETS["local-ollama"] 적용 + 모델 입력 뒤 저장되는 모양
      localStorage.setItem(
        "composition.ai.profiles",
        JSON.stringify({
          main: p("none"),
          // 모호 요청의 첫 호출은 planner — 프리셋은 비워 두지만 배선 확인용으로 구분되는 값을 둔다
          planner: p("low"),
          executor: p("none"),
          verifier: p(),
          fast: p("none"),
        }),
      );
    },
  });
  const bodies = [];
  await page.route("**/localhost:11434/**", async (route) => {
    try {
      bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    } catch {
      bodies.push({ unparsable: true });
    }
    await route.fulfill({ status: 503, body: "stub" });
  });
  await createIsolatedProject(page, BASE_URL);
  await page.locator('button[aria-label="AI"]').first().click();
  const textarea = page
    .locator('textarea[aria-label="Ask anything"], textarea[aria-label="무엇이든 물어보세요"]')
    .first();
  await textarea.waitFor({ state: "visible", timeout: 20_000 });
  await textarea.fill("이 화면을 조금 더 보기 좋게 정리해줘");
  await textarea.press("Enter");
  await page.waitForTimeout(4000);
  const efforts = bodies.map((b) => b.reasoning_effort ?? "(없음)");
  // 첫 호출 (planner) 이 프로파일 값을 싣는가 — 호출 옵션 없이 프로파일에서 온 값이다
  ok = bodies.length > 0 && bodies[0].reasoning_effort === "low";
  process.stdout.write(
    `${ok ? "✓" : "✗"} 요청 ${bodies.length}건 reasoning_effort=${JSON.stringify(efforts)} model=${bodies[0]?.model}\n`,
  );
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);

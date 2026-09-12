/**
 * 하니스용 인증 세션 파일 생성 — dev 빌더 (5173) 에 검증 코드로 로그인한 뒤
 * Playwright storageState 를 `apps/builder/scripts/.auth-session.json` (gitignore) 에 쓴다.
 * 라이선스 토큰은 서버 루트 `public/license` 에 있어야 한다.
 *
 * 실행: node apps/builder/scripts/capture-auth-session.mjs <6자리 코드> [--base http://localhost:5173] [--out <path>]
 * 파일에는 토큰 payload 사본 (license_key 등) 이 들어간다 — 커밋·출력 금지.
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const code = args.find((a) => /^\d{6}$/.test(a));
if (!code) throw new Error("usage: capture-auth-session.mjs <6자리 코드> [--base url] [--out path]");
const opt = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = opt("--base", "http://localhost:5173");
const out = resolve(
  opt("--out", resolve(dirname(fileURLToPath(import.meta.url)), ".auth-session.json")),
);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/signin`);
await page.waitForSelector('input[inputmode="numeric"]', { timeout: 15000 });
await page.waitForFunction(() => !document.querySelector(".auth-config-error"), null, { timeout: 15000 });
await page.locator('input[inputmode="numeric"]').fill(code);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await ctx.storageState({ path: out });
await browser.close();
console.log(`auth session → ${out}`);

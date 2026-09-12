/**
 * 라이선스 인증 live 하니스 — 실제 빌더 (dev 5173) 에서:
 *  1) /dashboard 직접 진입 → /signin 으로 리다이렉트
 *  2) 서버 license 자동 인식 + 틀린 코드 → 오류
 *  3) 올바른 코드 → /dashboard, localStorage 기록 (vc 없음)
 *  4) 새 탭/리로드 → 바로 /dashboard (재인증 없음)
 *  5) 만료 조작 → /signin
 *  6) 로그아웃 → /signin, 기록 삭제
 * 실행: node apps/builder/scripts/license-auth-live.mjs <license 토큰 파일> <code>
 *   — 하니스가 파일을 apps/builder/public/license 로 놓고 종료 시 원복, dev 5173 필요
 */
import { chromium } from "playwright";
import fs from "node:fs";

const [tokenPath, code] = process.argv.slice(2);
if (!tokenPath || !code) throw new Error("usage: <license 토큰 파일> <code>");
const token = fs.readFileSync(tokenPath, "utf8").trim();
const deployedPath = new URL("../public/license", import.meta.url);
const hadDeployed = fs.existsSync(deployedPath);
const previous = hadDeployed ? fs.readFileSync(deployedPath) : null;
fs.writeFileSync(deployedPath, token);
const restore = () => {
  if (hadDeployed) fs.writeFileSync(deployedPath, previous);
  else fs.rmSync(deployedPath, { force: true });
};
process.on("exit", restore);
const base = "http://localhost:5173";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

// 1) 게이트
await page.goto(`${base}/dashboard`);
await page.waitForURL(/\/signin/, { timeout: 15000 });
check("1 /dashboard 직접 진입 → /signin", page.url().endsWith("/signin"));

// 2) 파일 + 틀린 코드
await page.waitForSelector('.auth-license-source[data-kind="deployed"]');
const codeInput = page.locator('input[inputmode="numeric"]');
await codeInput.fill(code === "000000" ? "000001" : "000000");
await page.click('button[type="submit"]');
await page.waitForSelector(".react-aria-FieldError", { timeout: 30000 });
const errText = await page.textContent(".react-aria-FieldError");
check("2 서버 license 자동 인식", true);
check("2 틀린 코드 → 오류", /일치|match/.test(errText ?? ""), errText ?? "");
check("2 기록 없음", (await page.evaluate(() => localStorage.getItem("composition-license-auth"))) === null);

// 3) 올바른 코드
await codeInput.fill(code);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
const stored = await page.evaluate(() => localStorage.getItem("composition-license-auth"));
check("3 올바른 코드 → /dashboard", page.url().endsWith("/dashboard"));
check("3 기록 저장 (vc·코드 없음)", !!stored && !stored.includes('"vc"') && !stored.includes(code));
await page.waitForSelector(".dashboard-header", { timeout: 15000 });

// 4) 리로드 + 새 탭
await page.reload();
await page.waitForSelector(".dashboard-header", { timeout: 15000 });
check("4 리로드 → 바로 /dashboard", page.url().endsWith("/dashboard"));
const page2 = await ctx.newPage();
await page2.goto(`${base}/dashboard`);
await page2.waitForSelector(".dashboard-header", { timeout: 15000 });
check("4 새 탭 → 바로 /dashboard", page2.url().endsWith("/dashboard"));
await page2.close();

// 5) 만료 조작
await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem("composition-license-auth"));
  a.expiresAt = Date.now() - 1000;
  localStorage.setItem("composition-license-auth", JSON.stringify(a));
});
await page.goto(`${base}/dashboard`);
await page.waitForURL(/\/signin/, { timeout: 15000 });
check("5 만료 → /signin + 기록 삭제", (await page.evaluate(() => localStorage.getItem("composition-license-auth"))) === null);

// 6) 재인증 → 로그아웃
await page.waitForSelector('.auth-license-source[data-kind="deployed"]');
await page.locator('input[inputmode="numeric"]').fill(code);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.click(".dashboard-sign-out");
await page.waitForURL(/\/signin/, { timeout: 15000 });
check("6 로그아웃 → /signin + 기록 삭제", (await page.evaluate(() => localStorage.getItem("composition-license-auth"))) === null);

// 7) 네트워크: 인증 중 외부 요청 0 (localhost 만)
const external = [];
page.on("request", (r) => { if (!r.url().startsWith(base)) external.push(r.url()); });
await page.locator('input[inputmode="numeric"]').fill(code);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
check("7 인증 중 외부 요청 0", external.length === 0, external.join(", "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);

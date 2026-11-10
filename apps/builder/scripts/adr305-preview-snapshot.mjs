/**
 * ADR-305 Phase 0 — Preview iframe · Publish 문서 스냅샷 하니스 (G0 · G3 · G4 의 oracle).
 *
 *   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr305-preview-snapshot.mjs <outDir>
 *     ADR305_COUNT=1   = Preview 시트 규칙마다 선택자 계수 (G0 분류)
 *     ADR305_PUBLISH=0 = Publish 생략
 *
 * 팔레트의 모든 컴포넌트를 Body 에 하나씩 놓은 프로젝트를 Preview iframe (Compare Mode) 과 Publish (헤더
 * 「Preview」 → 새 탭) 에서 캡처한다. 테마 = light · dark (문서 루트 `data-theme` 을 바꿔 같은 로드에서 —
 * CSS cascade oracle). overlay 는 `aria-haspopup` · `aria-expanded` 를 가진 트리거마다 virtual click 으로 열고
 * 캡처 뒤 Escape. 출력 `<outDir>/{preview,publish}/<screen>.json`.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureInPage, STATE_ATTRS, STATE_PROPS } from "./adr305Snapshot.mjs";
import {
  collectRules,
  ENTRIES,
  expandCssGraph,
  stripStateSelector,
} from "./adr305Sheets.mjs";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: adr305-preview-snapshot.mjs <outDir>");
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const selectors =
  process.env.ADR305_COUNT === "1"
    ? collectRules(expandCssGraph(ENTRIES.previewIndex)).map((r) => [
        r.id,
        stripStateSelector(r.selector),
      ])
    : [];
const auth = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
auth.origins = auth.origins.map((o) => ({ ...o, origin: base }));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({
  storageState: auth,
  viewport: { width: 1800, height: 1100 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const summary = { base, inserted: [], failed: [], screens: {}, errors: [] };
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const rail = async (name, on = true) => {
  const b = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if (((await b.getAttribute("aria-pressed")) === "true") !== on)
    await b.click();
  await page.waitForTimeout(200);
};

const captureDoc = async (target, dir, name) => {
  mkdirSync(dir, { recursive: true });
  for (const theme of ["light", "dark"]) {
    await target.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
    }, theme);
    await target.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const snap = await target.evaluate(captureInPage, {
      selectors: theme === "light" ? selectors : [],
      statePass: process.env.ADR305_NOSTATE !== "1",
      stateAttrs: STATE_ATTRS,
      stateProps: STATE_PROPS,
      maxDesc: 24,
    });
    writeFileSync(join(dir, `${name}-${theme}.json`), JSON.stringify(snap));
    console.log(
      `${dir.split("/").pop()} ${name}-${theme} ${snap.elementCount} el`,
    );
  }
  await target.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "light"),
  );
};

/** 트리거마다 열고 캡처 — 트리거 목록은 문서 순서 (실행마다 같다). */
const captureOverlays = async (target, dir) => {
  const count = await target.evaluate(
    () =>
      document.querySelectorAll(
        "[data-catalog-id] [aria-haspopup]:not([aria-haspopup='false']), [data-catalog-id][aria-haspopup]:not([aria-haspopup='false'])",
      ).length,
  );
  for (let i = 0; i < count; i++) {
    const label = await target.evaluate((i) => {
      const el = document.querySelectorAll(
        "[data-catalog-id] [aria-haspopup]:not([aria-haspopup='false']), [data-catalog-id][aria-haspopup]:not([aria-haspopup='false'])",
      )[i];
      el.scrollIntoView({ block: "center" });
      el.click();
      return `${el.closest("[data-catalog-id]")?.className ?? ""}`.split(
        " ",
      )[0];
    }, i);
    await page.waitForTimeout(500);
    const open = await target.evaluate(
      () =>
        document.querySelectorAll(
          "[data-trigger], .react-aria-Popover, [role='dialog'], [role='listbox'], [role='menu']",
        ).length,
    );
    if (open)
      await captureDoc(
        target,
        dir,
        `overlay-${String(i).padStart(2, "0")}-${label}`,
      );
    await target.evaluate(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
  }
};

try {
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("ADR305 preview snapshot");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await rail("Navigator");
  await rail("Components");
  const comps = page.locator('[data-panel-id="components"]');
  const names = await comps
    .locator("[role='list'] button")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()),
    );
  const body = page
    .getByRole("treegrid", { name: "Layers", exact: true })
    .getByRole("row", { name: "Body", exact: true });
  for (const name of names) {
    try {
      await body.press("Space");
      await comps.getByRole("searchbox").fill(name);
      await comps
        .getByRole("button", { name, exact: true })
        .click({ timeout: 4000 });
      await comps.getByRole("searchbox").fill("");
      await page.waitForTimeout(250);
      await page.keyboard.press("Escape");
      summary.inserted.push(name);
    } catch (e) {
      summary.failed.push({ name, error: String(e).split("\n")[0] });
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  console.log(
    `inserted ${summary.inserted.length} · failed ${summary.failed.length}`,
  );
  await page.waitForTimeout(1500);
  await page
    .getByRole("button", { name: "Compare mode (Preview + Skia)", exact: true })
    .click();
  await page.locator("#previewFrame").waitFor();
  const frame = page.frameLocator("#previewFrame");
  await frame.locator("[data-catalog-id]").first().waitFor();
  await page.waitForTimeout(2500);
  const preview = await (await page.$("#previewFrame")).contentFrame();
  const ready = (n) =>
    document.querySelectorAll("[data-catalog-id]").length >= n;
  await preview.waitForFunction(ready, summary.inserted.length, {
    timeout: 30000,
  });
  const pdir = join(outDir, "preview");
  await captureDoc(preview, pdir, "page");
  await captureOverlays(preview, pdir);

  if (process.env.ADR305_PUBLISH !== "0") {
    const [pub] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Preview", exact: true }).click(),
    ]);
    pub.on("pageerror", (e) => pageErrors.push(`publish: ${e.message}`));
    await pub.waitForURL(/publish/);
    await pub.waitForFunction(ready, summary.inserted.length, {
      timeout: 30000,
    });
    await pub.waitForTimeout(2500);
    summary.publishUrl = pub.url().replace(/project=[^&]+/, "project=…");
    const target = pub.mainFrame();
    const qdir = join(outDir, "publish");
    await captureDoc(target, qdir, "page");
    await captureOverlays(target, qdir);
  }
} catch (e) {
  summary.errors.push(String(e).split("\n")[0]);
  console.log("✗", String(e).split("\n")[0]);
  await page.screenshot({ path: join(outDir, "failure.png") }).catch(() => {});
}
summary.pageErrors = pageErrors;
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();
console.log(
  `errors ${summary.errors.length} · pageErrors ${pageErrors.length}`,
);

// Headed Builder 검증: false에서 선택 리스너가 없고, true에서 선택이 동기화되며,
// 두 설정 모두 CSS Radio의 실제 선택 동작을 유지한다. 저장된 인증 세션을 사용한다.
// node apps/builder/scripts/hitarea-selection-live.mjs <증거 폴더>
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2];
assert.ok(out, "증거 폴더가 필요합니다.");
mkdirSync(out, { recursive: true });
const savedState = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const results = [];
try {
  for (const [enabled, base] of [
    [false, process.env.FALSE_BUILDER_URL ?? "http://localhost:5173"],
    [true, process.env.TRUE_BUILDER_URL ?? "http://127.0.0.1:5175"],
  ]) {
    if (process.argv.includes("--true-only") && !enabled) continue;
    console.log(`START HITAREA_MODE=${enabled} ${base}`);
    const context = await browser.newContext({
      storageState: {
        ...savedState,
        origins: savedState.origins.map((entry) => ({
          ...entry,
          origin: base,
        })),
      },
      viewport: { width: 1600, height: 1000 },
    });
    const errors = [];
    const page = await context.newPage();
    const moduleUrls = {};
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (
        path === "/src/builder/stores/data.ts" ||
        path === "/src/builder/panels/themes/catalog/catalogThemesHost.ts"
      )
        moduleUrls[path] ??= request.url();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      window.__hitareaMessages = [];
      window.__hitareaListeners = 0;
      window.__catalogDataPackets = [];
      window.__legacyPreviewMessages = [];
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        type,
        listener,
        options,
      ) {
        if (
          this === document &&
          type === "click" &&
          typeof listener === "function" &&
          listener.toString().includes("CATALOG_SELECT")
        )
          window.__hitareaListeners += 1;
        return original.call(this, type, listener, options);
      };
      window.addEventListener("message", (event) => {
        if (event.data?.type === "CATALOG_SELECT")
          window.__hitareaMessages.push(event.data);
        if (event.data?.type === "CATALOG_DATA")
          window.__catalogDataPackets.push(event.data);
        if (
          [
            "UPDATE_DATA_TABLES",
            "UPDATE_THEME_TOKENS",
            "SET_DARK_MODE",
            "THEME_BASE_TYPOGRAPHY",
          ].includes(event.data?.type)
        )
          window.__legacyPreviewMessages.push(event.data.type);
      });
    });
    try {
      await page.goto(`${base}/dashboard`);
      await page
        .getByRole("button", { name: /new project|새 프로젝트/i })
        .first()
        .click();
      await page.keyboard.type(`Hitarea ${enabled} ${Date.now()}`);
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/builder\//, { timeout: 30000 });
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      const search = page.getByLabel(/Search components|컴포넌트 검색/);
      if (!(await search.isVisible()))
        await page
          .getByRole("button", { name: /^(Components|컴포넌트)$/ })
          .first()
          .click();
      await search.fill("radio");
      await page
        .locator(".list-item", { hasText: /^radio ?group$/i })
        .first()
        .click();
      await page.waitForFunction(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        return [...root.domInputs.values()].some(
          (record) => root.typeOf(record) === "RadioGroup",
        );
      });
      const initiallyCompared = !!(await page.locator("#previewFrame").count());
      assert.equal(initiallyCompared, enabled, "Compare Mode 초기 설정 유지");
      if (!initiallyCompared)
        await page
          .getByRole("button", { name: /Compare Mode|비교 모드/ })
          .first()
          .click();
      await page.locator("#previewFrame").waitFor();
      const frame = await page
        .locator("#previewFrame")
        .elementHandle()
        .then((handle) => handle.contentFrame());
      const radio = frame.getByRole("radio").nth(1);
      await radio.waitFor({ state: "attached" });
      console.log(`READY HITAREA_MODE=${enabled}`);
      const listenerCount = await frame.evaluate(
        () => window.__hitareaListeners,
      );
      assert.equal(listenerCount, enabled ? 1 : 0);
      const before = await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.session
          .getSnapshot()
          .selection.map((item) => item.identity),
      );
      const target = await radio.evaluate((element) =>
        element.closest("[data-catalog-id]").getAttribute("data-catalog-id"),
      );
      await radio.evaluate((element) => element.click());
      await page.waitForFunction(
        (count) => window.__hitareaMessages.length >= count,
        enabled ? 1 : 0,
      );
      await radio.waitFor({ state: "attached" });
      await page.waitForTimeout(250);
      assert.equal(
        await radio.isChecked(),
        true,
        "CSS Radio가 선택되어야 합니다.",
      );
      const after = await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.session
          .getSnapshot()
          .selection.map((item) => item.identity),
      );
      const messages = await page.evaluate(() => window.__hitareaMessages);
      assert.deepEqual(after, enabled ? [target] : before);
      assert.equal(messages.length, enabled ? 1 : 0);
      console.log(`SELECTION PASS HITAREA_MODE=${enabled}`);

      const collectionId = await page.evaluate(async (moduleUrl) => {
        const { useDataStore } = await import(moduleUrl);
        const store = useDataStore.getState();
        const workspace = window.__COMPOSITION_CATALOG__.workspace;
        const collection = await store.createDataTable({
          name: "Legacy cleanup live",
          project_id: workspace.projectId,
          schema: [{ key: "name", type: "string" }],
          mockData: [{ name: "before" }],
          useMockData: true,
        });
        useDataStore
          .getState()
          .setRuntimeData(collection.id, [{ name: "after" }]);
        return collection.id;
      }, moduleUrls["/src/builder/stores/data.ts"]);
      console.log(`COLLECTION ${collectionId} HITAREA_MODE=${enabled}`);
      await frame.waitForFunction(
        (id) =>
          window.__catalogDataPackets.some((packet) =>
            packet.collections.some(
              (collection) =>
                collection.id === id &&
                collection.runtimeData?.[0]?.name === "after",
            ),
          ),
        collectionId,
      );
      console.log(`DATA PASS HITAREA_MODE=${enabled}`);
      await page.evaluate(
        async (moduleUrl) => {
          const { createCatalogThemesHost } = await import(moduleUrl);
          const host = createCatalogThemesHost(
            window.__COMPOSITION_CATALOG__.workspace,
          );
          host.setActiveThemePreset({ darkMode: "dark" });
          host.setActiveThemeBaseTypography({ fontSize: 18 });
        },
        moduleUrls["/src/builder/panels/themes/catalog/catalogThemesHost.ts"] ??
          `${base}/src/builder/panels/themes/catalog/catalogThemesHost.ts`,
      );
      await frame.waitForFunction(
        () =>
          document.documentElement.getAttribute("data-theme") === "dark" &&
          document.body.style.fontSize === "18px",
      );
      const legacyMessages = await frame.evaluate(
        () => window.__legacyPreviewMessages,
      );
      assert.deepEqual(
        legacyMessages,
        [],
        "구형 Preview 메시지가 없어야 합니다.",
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      await page.screenshot({ path: `${out}/${enabled}.png`, timeout: 10000 });
      results.push({
        enabled,
        base,
        listenerCount,
        before,
        after,
        target,
        messages,
        radioChecked: true,
        initiallyCompared,
        catalogDataSynced: true,
        darkThemeSynced: true,
        legacyMessages,
        errors,
        pass: true,
      });
      console.log(
        `PASS HITAREA_MODE=${enabled}: listeners=${listenerCount}, messages=${messages.length}, CSS Radio checked`,
      );
    } catch (error) {
      console.error(error);
      await page
        .screenshot({ path: `${out}/${enabled}-failure.png`, timeout: 10000 })
        .catch(() => {});
      const preview = page
        .frames()
        .find((item) => item.url().includes("preview.html"));
      const diagnostics = {
        packets: await preview?.evaluate(() => window.__catalogDataPackets),
        collections: moduleUrls["/src/builder/stores/data.ts"]
          ? await page.evaluate(async (moduleUrl) => {
              const { useDataStore } = await import(moduleUrl);
              return [...useDataStore.getState().collections.values()].map(
                ({ id, name, mockData, runtimeData }) => ({
                  id,
                  name,
                  mockData,
                  runtimeData,
                }),
              );
            }, moduleUrls["/src/builder/stores/data.ts"])
          : [],
        moduleUrls,
      };
      results.push({
        enabled,
        base,
        pass: false,
        error: String(error),
        errors,
        url: page.url(),
        diagnostics,
      });
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify({ results, cpuThrottle: "none", headed: true }, null, 2),
  );
  await browser.close();
}

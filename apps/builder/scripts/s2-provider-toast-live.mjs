#!/usr/bin/env node
// S2 Provider · Toast 대조 결함 live (2026-11-24, S2 체크리스트 부록 D.1 — 사용자 「권장대로 세가지 진행해」):
//   Builder 에서 Link (href /about) · frame (locale ja-JP, 안에 Text) · Button (toast 규칙) · 동작
//   버튼을 지운 Toast 모양 · system 테마를 만들고 Preview 를 연다.
//   1. Link 의 href = 「#/about」 (Publish hash 경로)
//   2. Ctrl 클릭 = 새 탭이 #/about 로 열리고 원래 탭은 그대로
//   3. 문서 color-scheme = light · OS 를 dark 로 바꾸면 새로고침 없이 data-theme · color-scheme 가 dark
//   4. frame 요소에 lang="ja-JP" · frame 서체 = S2 일본어 서체 (문서가 기본 서체일 때 — 안의 Text 는
//      자기 inline 서체를 쓴다: 기록만)
//   5. Toast 모양: 2 개 쌓이면 뒤 조각이 모양 상자 (S2 skin 의 variant 색 아님)
//   6. 닫기 버튼 이름 = S2 dialog.dismiss (en 「Dismiss」 · ko 「무시」) · page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-provider-toast-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-provider-toast-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  colorScheme: "light",
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("provider toast live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const built = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const graph = ws.runtime.graph;
    const c = h.commands;
    const BODY = "project:node:home-body";
    const def = (type) => h.palette.catalogPaletteDefinitionId(graph.library, type);
    const node = (id, type, props = {}, children = []) => ({
      kind: "node",
      id,
      definitionId: def(type),
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const ids = {
      link: "project:node:live-link",
      frame: "project:node:live-frame",
      text: "project:node:live-ja-text",
      button: "project:node:live-button",
      toast: "project:node:live-toast",
    };
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(ids.link, "Link", { href: "/about", children: "About" }),
          node(ids.frame, "frame", { locale: "ja-JP" }, [ids.text]),
          node(ids.text, "Text", { children: "日本語のテキスト" }),
          node(ids.button, "Button", { label: "Notify" }),
          node(ids.toast, "Toast"),
        ],
        rootIds: [ids.link, ids.frame, ids.button, ids.toast],
        newId: ws.newId,
      }),
    );
    // (The shape without its action Button.)
    const root = ws.root;
    const inToast = (id) => {
      const r = id && root.domInputs.get(id);
      return !!r && (r.sourceId === ids.toast || inToast(r.parentId));
    };
    const toastButton = [...root.domInputs.values()].find(
      (r) => root.typeOf(r) === "Button" && inToast(r.parentId),
    );
    ws.execute(
      c.removeTargets({
        targets: [ws.itemOfRecord(toastButton.id).target],
        newId: ws.newId,
      }),
    );
    ws.execute(c.createComponent({ id: ids.toast, name: "AppToast", newId: ws.newId }));
    const project = () => graph.getEntry(graph.projectId);
    const shapeId = project().definitionIds.find(
      (id) => graph.getEntry(id)?.name === "AppToast",
    );
    ws.execute(c.setToastShape({ id: shapeId }));
    ws.execute(
      c.setNodeInteractions({
        ownerId: ids.button,
        entries: [
          {
            kind: "interaction",
            id: ws.newId("interaction"),
            ownerId: ids.button,
            trigger: "onPress",
            actions: [
              {
                opcode: "toast",
                message: "Saved",
                variant: "positive",
              },
            ],
          },
        ],
      }),
    );
    ws.execute(
      c.createTheme({
        theme: {
          kind: "theme",
          id: "project:theme:live",
          name: "System",
          tokenIds: [],
          preset: { tint: "blue", neutral: "neutral", radius: "md", darkMode: "system" },
        },
        activate: true,
      }),
    );
    return { ids, shapeId, toastShapeId: project().toastShapeId };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/1-builder.png` });

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector("a", { timeout: 60000 });
  await pub.waitForTimeout(1000);
  const url = pub.url();

  // 1. href
  const href = await pub.evaluate(
    () => [...document.querySelectorAll("a")].find((a) => a.textContent === "About")?.getAttribute("href"),
  );
  record("1. Link href = #/about (hash route)", href === "#/about", { href, url });

  // 2. Ctrl click → new tab
  const before = pub.url();
  const tab = context.waitForEvent("page", { timeout: 10000 }).catch(() => null);
  await pub
    .locator("a", { hasText: "About" })
    .click({ modifiers: [process.platform === "darwin" ? "Meta" : "Control"] });
  const opened = await tab;
  if (opened) await opened.waitForLoadState().catch(() => {});
  await pub.waitForTimeout(500);
  record(
    "2. Ctrl/Cmd 클릭 = 새 탭 #/about · 원래 탭 그대로",
    !!opened && opened.url().endsWith("#/about") && pub.url() === before,
    { opened: opened?.url(), stayed: pub.url() === before },
  );
  await opened?.close();

  // 3. color-scheme · OS follow
  const scheme = () =>
    pub.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      colorScheme: document.documentElement.style.colorScheme,
      bg: getComputedStyle(document.body).backgroundColor,
    }));
  const light = await scheme();
  await pub.emulateMedia({ colorScheme: "dark" });
  await pub.waitForTimeout(800);
  const dark = await scheme();
  await pub.screenshot({ path: `${OUT}/2-publish-dark.png` });
  record(
    "3. color-scheme light → OS dark 전환을 새로고침 없이 따름",
    light.theme === "light" &&
      light.colorScheme === "light" &&
      dark.theme === "dark" &&
      dark.colorScheme === "dark" &&
      dark.bg !== light.bg,
    { light, dark },
  );
  await pub.emulateMedia({ colorScheme: "light" });
  await pub.waitForTimeout(500);

  // 4. frame lang
  const lang = await pub.evaluate(() => {
    const text = [...document.querySelectorAll("*")].find(
      (e) => e.childElementCount === 0 && e.textContent === "日本語のテキスト",
    );
    return {
      lang: text?.closest("[lang]")?.getAttribute("lang"),
      isRoot: text?.closest("[lang]") === document.documentElement,
      font: text && getComputedStyle(text).fontFamily.slice(0, 60),
      frameFont:
        text && getComputedStyle(text.closest("[lang]")).fontFamily.slice(0, 60),
      textFontRule: text && getComputedStyle(text).getPropertyValue("--font-sans").slice(0, 40),
      rootDefault: document.documentElement.hasAttribute("data-catalog-default-font"),
      rootLang: document.documentElement.lang,
      inlineFont: text?.style.fontFamily,
    };
  });
  record(
    "4. frame 요소 lang=ja-JP · frame 서체 = 일본어 서체",
    lang.lang === "ja-JP" &&
      !lang.isRoot &&
      lang.frameFont?.startsWith("adobe-clean-han-japanese"),
    lang,
  );

  // 5. toast shape without a Button
  const press = () =>
    pub.locator("button", { hasText: "Notify" }).first().click();
  await press();
  await pub.waitForTimeout(600);
  const shown = await pub.evaluate(() => {
    const box = document.querySelector(".catalog-toast-shaped > .react-aria-Toast");
    return {
      box: !!box,
      text: box?.textContent ?? "",
      actionButton: !!box?.querySelector(".react-aria-Button"),
      close: document
        .querySelector(".catalog-toast-shaped .toast-close-button")
        ?.getAttribute("aria-label"),
    };
  });
  await press();
  await pub.waitForTimeout(600);
  const sliver = await pub.evaluate(() => {
    const s = document.querySelector(".catalog-toast-behind");
    return {
      present: !!s,
      inlineBg: s?.style.backgroundColor ?? null,
      shapeBox: !!s?.querySelector(".react-aria-Toast"),
      shapeBg: s?.querySelector(".react-aria-Toast")
        ? getComputedStyle(s.querySelector(".react-aria-Toast")).backgroundColor
        : null,
    };
  });
  await pub.screenshot({ path: `${OUT}/3-toast-stack.png` });
  record(
    "5. Toast 모양 — 쌓인 뒤 조각 = 모양 상자 (variant 색 inline 없음)",
    shown.box &&
      shown.text.includes("Saved") &&
      sliver.present &&
      sliver.inlineBg === "" &&
      sliver.shapeBox,
    { shown, sliver },
  );
  record("6. 닫기 버튼 이름 = S2 dialog.dismiss", ["Dismiss", "무시"].includes(shown.close), {
    close: shown.close,
  });
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("7. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}

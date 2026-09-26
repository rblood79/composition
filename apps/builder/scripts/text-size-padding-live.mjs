// text-size-padding-live.mjs — Text size(width/height) + padding 조건별 Skia layout rect vs Preview
//   iframe DOM rect 대조 (실제 빌더 부팅, 2026-09-20 root padding 이중 차감 · `%` 높이 Step 4.5 수리).
//   node apps/builder/scripts/text-size-padding-live.mjs [--headless] [--mobile] [--body-pad] [--reload] [--user]
//   --mobile 은 부팅 전 localStorage breakpoint (390) · --body-pad 는 현재 페이지 body padding 24 ·
//   --reload 는 시드 뒤 새로고침 (DB 에서 읽은 상태로 측정) · --user 는 사용자 문서의 px 폭 케이스 ·
//   --cases-json <file> 은 [{key, style}] 배열 (base 위에 병합) · --shot <png> 는 대조 뒤 화면 캡처.
import { chromium } from "playwright";
import { resolve } from "node:path";
const REPO = "/Users/admin/work/composition";
const { waitReady, createIsolatedProject } = await import(
  `${REPO}/apps/builder/scripts/perf-baseline.mjs`
);
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve(REPO, "apps/builder/scripts/.auth-session.json");
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[text-probe]", ...a);
const RAIL = [
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
const TEXT =
  "ABCDEFG\n12345\n가나다라마바사\n098763\nBGTRFV bye bye\nKKJLGGGH\nEND";
const base = { whiteSpace: "pre-wrap", flexShrink: "0" };
const userBase = {
  ...base,
  marginTop: "0px",
  marginRight: "0px",
  marginBottom: "0px",
  marginLeft: "0px",
  textAlign: "left",
  verticalAlign: "top",
  height: "100%",
};
const casesJsonIdx = process.argv.indexOf("--cases-json");
const CASES = casesJsonIdx >= 0
  ? JSON.parse((await import("node:fs")).readFileSync(process.argv[casesJsonIdx + 1], "utf8")).map((c) => ({ ...c, style: { ...base, ...c.style } }))
  : process.argv.includes("--user")
  ? [
      {
        key: "user1 w205.2 pad24 border",
        style: {
          ...userBase,
          width: "205.2px",
          paddingTop: "24px",
          paddingRight: "24px",
          paddingBottom: "24px",
          paddingLeft: "24px",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#FF0000",
        },
      },
      {
        key: "user2 w171 pad24 border",
        style: {
          ...userBase,
          width: "171px",
          paddingTop: "24px",
          paddingRight: "24px",
          paddingBottom: "24px",
          paddingLeft: "24px",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#FF0000",
        },
      },
      {
        key: "user3 w171 pad14 border",
        style: {
          ...userBase,
          width: "171px",
          paddingTop: "14px",
          paddingRight: "14px",
          paddingBottom: "14px",
          paddingLeft: "14px",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#FF0000",
        },
      },
      {
        key: "w150 pad24",
        style: { ...base, width: "150px", padding: "24px" },
      },
      {
        key: "w120 pad10",
        style: { ...base, width: "120px", padding: "10px" },
      },
      { key: "w100 pad0", style: { ...base, width: "100px" } },
    ]
  : [
      {
        key: "w60pct-h100pct-pad24-border",
        style: {
          ...base,
          width: "60%",
          height: "100%",
          padding: "24px",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#FF0000",
        },
      },
      {
        key: "w50pct-h100pct-pad24-border",
        style: {
          ...base,
          width: "50%",
          height: "100%",
          padding: "24px",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "#FF0000",
        },
      },
      {
        key: "w50pct-h100pct-pad14",
        style: { ...base, width: "50%", height: "100%", padding: "14px" },
      },
      {
        key: "w200px-pad24",
        style: { ...base, width: "200px", padding: "24px" },
      },
      {
        key: "w200px-h300px-pad24",
        style: { ...base, width: "200px", height: "300px", padding: "24px" },
      },
      {
        key: "w200px-h100px-pad24",
        style: { ...base, width: "200px", height: "100px", padding: "24px" },
      },
      {
        key: "w50pct-pad24",
        style: { ...base, width: "50%", padding: "24px" },
      },
      { key: "auto-pad24", style: { ...base, padding: "24px" } },
      { key: "w200px-pad0", style: { ...base, width: "200px" } },
    ];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) {
    await b.click();
    await page.waitForTimeout(700);
  }
}
async function addText(page) {
  await setPanel(page, "components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill("text");
  await page.waitForTimeout(300);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  let picked = -1;
  for (let i = 0; i < n; i++) {
    const t = (await items.nth(i).innerText()).trim().toLowerCase();
    if (t === "text" || t.startsWith("text\n")) {
      picked = i;
      break;
    }
  }
  await items.nth(picked < 0 ? 0 : picked).click();
  await page.waitForFunction(
    (before) =>
      window.__composition_STORE__
        .getState()
        .elements.some((e) => !before.includes(e.id)),
    before,
    { timeout: 15000 },
  );
  await page.waitForTimeout(600);
  return page.evaluate((before) => {
    const st = window.__composition_STORE__.getState();
    const fresh = st.elements.filter((e) => !before.includes(e.id));
    return { id: fresh[0].id, type: fresh[0].type ?? fresh[0].tag };
  }, before);
}
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
if (process.argv.includes("--mobile"))
  await context.addInitScript(() => {
    try {
      localStorage.setItem("builder-breakpoint", "mobile");
    } catch {}
  });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await createIsolatedProject(page, BASE_URL);
  log("project", page.url());
  if (process.argv.includes("--body-pad")) {
    await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      st.updateElementProps(body.id, {
        style: {
          ...(body.props?.style ?? {}),
          display: "block",
          paddingTop: "24px",
          paddingRight: 24,
          paddingBottom: 24,
          paddingLeft: 24,
        },
      });
    });
    await page.waitForTimeout(800);
  }
  const added = [];
  for (const c of CASES) {
    const a = await addText(page);
    await page.evaluate(
      ([id, style, text]) => {
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { children: text, style, size: "md" });
      },
      [a.id, c.style, TEXT],
    );
    await page.waitForTimeout(400);
    added.push({ ...c, ...a });
    log("added", c.key, a.type, a.id.slice(0, 8));
  }
  await setPanel(page, "components", false);
  await page.waitForTimeout(1500);
  if (process.argv.includes("--reload")) {
    const url = page.url();
    await page.goto(url, { waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(2000);
    log(
      "reloaded",
      JSON.stringify(
        await page.evaluate(() => ({
          bp: window.__composition_STORE__.getState().activeBreakpoint,
          n: window.__composition_STORE__.getState().elements.length,
        })),
      ),
    );
  }
  const skia = await page.evaluate(
    (ids) => {
      const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const out = {
        body: lm.get(body.id)
          ? [lm.get(body.id).width, lm.get(body.id).height]
          : null,
        bodyStyle: body.props?.style,
      };
      for (const id of ids) {
        const l = lm.get(id);
        out[id] = l ? [l.x, l.y, l.width, l.height] : null;
      }
      return out;
    },
    added.map((a) => a.id),
  );
  log("skia body", JSON.stringify(skia.body), JSON.stringify(skia.bodyStyle));
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(3500);
  }
  const ids = added.map((a) => a.id);
  await page
    .waitForFunction(
      (ids) =>
        [...document.querySelectorAll("iframe")].some((f) =>
          ids.every((id) =>
            f.contentDocument?.querySelector(`[data-element-id^="${id}"]`),
          ),
        ),
      ids,
      { timeout: 20000 },
    )
    .catch(() => log("warn: preview iframe 미도달"));
  await page.evaluate((w) => {
    for (const f of document.querySelectorAll("iframe")) {
      f.style.width = `${w}px`;
      f.style.minWidth = `${w}px`;
      f.style.maxWidth = "none";
    }
  }, skia.body[0]);
  await page.waitForTimeout(1200);
  const dom = await page.evaluate((ids) => {
    for (const f of document.querySelectorAll("iframe")) {
      const d = f.contentDocument;
      if (!d) continue;
      if (!ids.every((id) => d.querySelector(`[data-element-id^="${id}"]`)))
        continue;
      const bodyEl = d.querySelector("[data-element-id]");
      const out = {
        viewport: [
          d.documentElement.clientWidth,
          d.documentElement.clientHeight,
        ],
        bodyRect: null,
        bodyInfo: null,
      };
      const rootBody = [...d.querySelectorAll("[data-element-id]")].find(
        (e) => !e.parentElement?.closest("[data-element-id]"),
      );
      if (rootBody) {
        const r = rootBody.getBoundingClientRect();
        const cs = getComputedStyle(rootBody);
        out.bodyRect = [r.x, r.y, r.width, r.height];
        out.bodyInfo = {
          tag: rootBody.tagName,
          cls: rootBody.className,
          height: cs.height,
          minHeight: cs.minHeight,
          display: cs.display,
          padding: cs.padding,
        };
      }
      for (const id of ids) {
        let el = null;
        for (const e of d.querySelectorAll(`[data-element-id^="${id}"]`)) {
          const r = e.getBoundingClientRect();
          if (r.width > 0 || r.height > 0) {
            el = e;
            break;
          }
        }
        if (!el) {
          out[id] = null;
          continue;
        }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const pr = rootBody?.getBoundingClientRect() ?? { x: 0, y: 0 };
        out[id] = {
          rect: [r.x - pr.x, r.y - pr.y, r.width, r.height],
          tag: el.tagName,
          cls: el.className,
          cs: {
            display: cs.display,
            boxSizing: cs.boxSizing,
            width: cs.width,
            height: cs.height,
            padding: cs.padding,
            border: cs.borderWidth,
            lineHeight: cs.lineHeight,
            fontSize: cs.fontSize,
            whiteSpace: cs.whiteSpace,
          },
          inline: el.getAttribute("style"),
        };
      }
      return out;
    }
    return null;
  }, ids);
  if (!dom) throw new Error("preview iframe 에서 요소를 못 찾음");
  log(
    "dom viewport",
    JSON.stringify(dom.viewport),
    "body",
    JSON.stringify(dom.bodyRect),
    JSON.stringify(dom.bodyInfo),
  );
  for (const a of added) {
    const s = skia[a.id];
    const d = dom[a.id];
    const dr = d?.rect;
    const diff = s && dr ? s.map((v, i) => +(v - dr[i]).toFixed(1)) : null;
    const bad = diff ? diff.some((v) => Math.abs(v) > 1.5) : true;
    log(
      `${bad ? "DIFF" : "ok  "} ${a.key}\n   skia ${JSON.stringify(s?.map((v) => +v.toFixed(1)))}\n   dom  ${JSON.stringify(dr?.map((v) => +v.toFixed(1)))} <${d?.tag} class="${d?.cls}"> ${JSON.stringify(d?.cs)}\n   inline ${d?.inline}`,
    );
  }
  const shotIdx = process.argv.indexOf("--shot");
  if (shotIdx >= 0) {
    await page.screenshot({ path: process.argv[shotIdx + 1] });
    log("shot", process.argv[shotIdx + 1]);
  }
  log("pageerrors", errors.length, errors.slice(0, 3));
} finally {
  await browser.close();
}

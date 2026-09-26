// grid-row-margin-live.mjs — 컨테이너 auto 크기에 자식 margin-box 가 들어가는지 (grid 행 · flex 양축 ·
//   block shrink-to-fit) + grid 행이 area 폭으로 재지는지 — Skia layout rect vs Preview iframe DOM rect
//   대조 (실제 빌더 부팅, 2026-09-20 엔진 row_intrinsic margin-box · 양축 sweep 수리).
//   node apps/builder/scripts/grid-row-margin-live.mjs [--headless]
//   kids[].kids 로 손자까지 (wrap flex 안의 항목).
import { chromium } from "playwright";
import { resolve } from "node:path";
const REPO = "/Users/admin/work/composition";
const { waitReady, createIsolatedProject } = await import(
  `${REPO}/apps/builder/scripts/perf-baseline.mjs`
);
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve(REPO, "apps/builder/scripts/.auth-session.json");
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[grid-probe]", ...a);
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
const CASES = [
  {
    key: "grid 2col auto-row > child margin 10 (h40 → 트랙 60)",
    frame: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        width: "40px",
        height: "40px",
        marginTop: "10px",
        marginRight: "10px",
        marginBottom: "10px",
        marginLeft: "10px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
      },
      {
        width: "40px",
        height: "20px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#00AA00",
      },
    ],
  },
  {
    key: "grid rows auto auto + rowGap 8 > marginBottom 30 / marginTop 4",
    frame: {
      display: "grid",
      gridTemplateColumns: "100px",
      gridTemplateRows: "auto auto",
      rowGap: "8px",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        width: "40px",
        height: "10px",
        marginBottom: "30px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
      },
      {
        width: "40px",
        height: "10px",
        marginTop: "4px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#AA00AA",
      },
    ],
  },
  {
    key: "flex row auto 높이 > 자식 marginTop 10 / marginBottom 30 → 80",
    frame: {
      display: "flex",
      flexDirection: "row",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        width: "40px",
        height: "40px",
        marginTop: "10px",
        marginBottom: "30px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
      },
      {
        width: "40px",
        height: "40px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#00AA00",
      },
    ],
  },
  {
    key: "flex row > shrink-to-fit flex row 자식 > marginRight 20 → 내부 폭 62 (2+40+20)",
    frame: {
      display: "flex",
      flexDirection: "row",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        display: "flex",
        flexDirection: "row",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
        kids: [
          {
            width: "40px",
            height: "40px",
            marginRight: "20px",
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: "#00AA00",
          },
        ],
      },
    ],
  },
  {
    key: "grid 2열 auto 행 > wrap flex 자식 (100×3) → area 폭 149 에서 3줄 (Chrome 122)",
    frame: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
        kids: [
          {
            width: "100px",
            height: "40px",
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: "#00AA00",
          },
          {
            width: "100px",
            height: "40px",
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: "#00AA00",
          },
          {
            width: "100px",
            height: "40px",
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: "#00AA00",
          },
        ],
      },
      {
        width: "40px",
        height: "10px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#AA00AA",
      },
    ],
  },
  {
    key: "grid 2열 auto 행 > 자식 margin 5% (area 149 기준 7.45) → 트랙 54.9",
    frame: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        width: "40px",
        height: "40px",
        margin: "5%",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
      },
      {
        width: "40px",
        height: "10px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#00AA00",
      },
    ],
  },
  {
    key: "대조군 grid rows 30px > marginBottom 50 (고정 트랙은 안 늘어남)",
    frame: {
      display: "grid",
      gridTemplateColumns: "100px",
      gridTemplateRows: "30px",
      width: "300px",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#0000FF",
    },
    kids: [
      {
        width: "40px",
        height: "10px",
        marginBottom: "50px",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#FF0000",
      },
    ],
  },
];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) {
    await b.click();
    await page.waitForTimeout(700);
  }
}
async function addFromPalette(page, query, parentId) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (pid) => window.__composition_STORE__.getState().setSelectedElement(pid),
    parentId ?? null,
  );
  await page.waitForTimeout(200);
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill(query);
  await page.waitForTimeout(300);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  let picked = -1;
  for (let i = 0; i < n; i++) {
    const t = (await items.nth(i).innerText()).trim().toLowerCase();
    if (t === query || t.startsWith(`${query}\n`)) {
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
  await page.waitForTimeout(500);
  return page.evaluate((before) => {
    const st = window.__composition_STORE__.getState();
    const fresh = st.elements.filter((e) => !before.includes(e.id));
    return {
      id: fresh[0].id,
      type: fresh[0].type ?? fresh[0].tag,
      parent: fresh[0].parent_id,
    };
  }, before);
}
const setStyle = (page, id, style, extra = {}) =>
  page.evaluate(
    ([id, style, extra]) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      st.updateElementProps(id, {
        ...extra,
        style: { ...(el?.props?.style ?? {}), ...style },
      });
    },
    [id, style, extra],
  );
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
// 스크린샷용 — mobile breakpoint (390) 는 캔버스 카메라가 페이지를 화면 안에 두고 시작한다.
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
  const added = [];
  for (const c of CASES) {
    const f = await addFromPalette(page, "frame");
    await setStyle(page, f.id, c.frame);
    await page.waitForTimeout(300);
    const kids = [];
    const grandkids = [];
    for (const k of c.kids) {
      const { kids: sub, ...style } = k;
      const t = await addFromPalette(page, "frame", f.id);
      if (t.parent !== f.id) log("warn: 자식 부모 불일치", t);
      await setStyle(page, t.id, style);
      await page.waitForTimeout(300);
      kids.push(t.id);
      for (const g of sub ?? []) {
        const gt = await addFromPalette(page, "frame", t.id);
        if (gt.parent !== t.id) log("warn: 손자 부모 불일치", gt);
        await setStyle(page, gt.id, g);
        await page.waitForTimeout(300);
        grandkids.push(gt.id);
      }
    }
    added.push({ ...c, id: f.id, kids, grandkids });
    log(
      "added",
      c.key,
      f.id.slice(0, 8),
      kids.map((k) => k.slice(0, 8)),
    );
  }
  await setPanel(page, "components", false);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  // 시드 뒤 새로고침 — DB 에서 읽은 상태로 측정 (persist 경로 포함).
  await page.goto(page.url(), { waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const allIds = added.flatMap((a) => [a.id, ...a.kids, ...a.grandkids]);
  const skia = await page.evaluate((ids) => {
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const out = {};
    for (const id of ids) {
      const l = lm.get(id);
      out[id] = l ? [l.x, l.y, l.width, l.height] : null;
    }
    return out;
  }, allIds);
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
  await page
    .waitForFunction(
      (ids) =>
        [...document.querySelectorAll("iframe")].some((f) =>
          ids.every((id) =>
            f.contentDocument?.querySelector(`[data-element-id^="${id}"]`),
          ),
        ),
      allIds,
      { timeout: 20000 },
    )
    .catch(() => log("warn: preview iframe 미도달"));
  const dom = await page.evaluate((ids) => {
    for (const f of document.querySelectorAll("iframe")) {
      const d = f.contentDocument;
      if (!d) continue;
      if (!ids.every((id) => d.querySelector(`[data-element-id^="${id}"]`)))
        continue;
      const out = {};
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
        const p = el.parentElement?.closest("[data-element-id]");
        const pr = p?.getBoundingClientRect() ?? { x: 0, y: 0 };
        const pcs = p ? getComputedStyle(p) : null;
        const px = pcs
          ? parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth)
          : 0;
        const py = pcs
          ? parseFloat(pcs.paddingTop) + parseFloat(pcs.borderTopWidth)
          : 0;
        out[id] = {
          rect: [r.x - pr.x - px, r.y - pr.y - py, r.width, r.height],
          display: getComputedStyle(el).display,
        };
      }
      return out;
    }
    return null;
  }, allIds);
  if (!dom) throw new Error("preview iframe 에서 요소를 못 찾음");
  let bad = 0;
  for (const a of added) {
    log(`# ${a.key}`);
    for (const [label, id] of [
      ["frame", a.id],
      ...a.kids.map((k, i) => [`kid${i}`, k]),
      ...a.grandkids.map((k, i) => [`grand${i}`, k]),
    ]) {
      const s = skia[id];
      const d = dom[id]?.rect;
      // frame 은 크기만 (body 안 위치는 다른 형제 누적), 자식은 부모 상대 x/y + 크기
      const idx = label === "frame" ? [2, 3] : [0, 1, 2, 3];
      const diff = s && d ? idx.map((i) => +(s[i] - d[i]).toFixed(1)) : null;
      const isBad = diff ? diff.some((v) => Math.abs(v) > 1.5) : true;
      if (isBad) bad++;
      log(
        `  ${isBad ? "DIFF" : "ok  "} ${label} skia ${JSON.stringify(s?.map((v) => +v.toFixed(1)))} dom ${JSON.stringify(d?.map((v) => +v.toFixed(1)))} (${dom[id]?.display})`,
      );
    }
  }
  await page.mouse.move(400, 400);
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: `${process.env.SHOT_DIR ?? "/tmp"}/grid-compare.png`,
  });
  await page.screenshot({
    path: `${process.env.SHOT_DIR ?? "/tmp"}/grid-compare-crop.png`,
    clip: { x: 160, y: 20, width: 1130, height: 520 },
  });
  log("pageerrors", errors.length, errors.slice(0, 3));
  log(bad === 0 ? "ALL OK" : `DIFF ${bad}`);
} finally {
  await browser.close();
}

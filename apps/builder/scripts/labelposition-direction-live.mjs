// Meter · ProgressBar · Slider — Style 패널 Direction 토글과 labelPosition 의 관계, 인라인 방향의 Skia 배치.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/labelposition-direction-live.mjs  →  output/playwright/labelposition-direction/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/labelposition-direction";
const RAIL_ORDER = [
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
// TextField 는 대조군 — 이미 Direction 이 labelPosition 으로 번역되는 타입.
const TYPES = ["ProgressBar", "Meter", "Slider", "TextField"];
const DIRECTION_INDEX = { block: 0, row: 1, column: 2 };

async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label = (await items.nth(i).innerText()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      await items.nth(i).click();
      break;
    }
  }
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          // 팔레트는 Components 페이지 origin 의 instance (`ref`) 를 만든다 (ADR-234 · 237).
          .elements.find(
            (e) => (e.type === t || e.type === "ref") && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(async () => {
      console.error(
        "added types",
        await page.evaluate(
          (before) =>
            window.__composition_STORE__
              .getState()
              .elements.filter((e) => !before.includes(e.id))
              .map((e) => e.type),
          before,
        ),
      );
      return null;
    });
  await page.waitForTimeout(800);
  await setPanel(page, "components", false);
  return id;
}

/** 요소의 props 를 교체한다 (style 은 통째로). 사용자 경로가 아닌 시드 — 옛 토글이 남긴 인라인 재현용. */
async function seed(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(900);
}

/** Skia layout 의 자식 배치 — 부모 기준 x/y 로 row · column · grid 를 판정한다. */
async function arrangement(page, id) {
  return page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elementsMap.get(id);
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    // ref instance 의 자식은 store 에 없고 layout map 에 `<instance>/<origin 자식>` 키로만 있다.
    const own = (st.childrenMap?.get(id) ?? [])
      .map((c) => (typeof c === "string" ? st.elementsMap.get(c) : c))
      .filter(Boolean)
      .map((c) => ({ id: c.id, type: c.type }));
    const synthetic = [...lm.keys()]
      .filter((k) => k.startsWith(`${id}/`) && !k.slice(id.length + 1).includes("/"))
      .map((k) => ({ id: k, type: st.elementsMap.get(k.slice(id.length + 1))?.type ?? "?" }));
    const kids = (own.length > 0 ? own : synthetic)
      .map((c) => {
        const l = lm.get(c.id);
        return l
          ? {
              type: c.type,
              x: Math.round(l.x),
              y: Math.round(l.y),
              w: Math.round(l.width),
              h: Math.round(l.height),
            }
          : null;
      })
      .filter(Boolean);
    const ys = kids.map((k) => k.y);
    const xs = kids.map((k) => k.x);
    const sameRow = Math.max(...ys) - Math.min(...ys) <= 6;
    const sameCol = Math.max(...xs) - Math.min(...xs) <= 2;
    const kind = sameRow ? "row" : sameCol ? "column" : "grid";
    const order = [...kids]
      .sort((a, b) => (kind === "row" ? a.x - b.x : a.y - b.y || a.x - b.x))
      .map((k) => k.type)
      .join(">");
    return {
      type: el?.type,
      ref: el?.ref ?? null,
      kind,
      order,
      labelPosition: el?.props?.labelPosition ?? null,
      inline: {
        display: el?.props?.style?.display ?? null,
        flexDirection: el?.props?.style?.flexDirection ?? null,
      },
      kids,
    };
  }, id);
}

async function directionState(page) {
  const buttons = page.locator(".layout-direction .flex-direction button");
  const out = {};
  for (const [key, i] of Object.entries(DIRECTION_INDEX)) {
    const b = buttons.nth(i);
    out[key] = {
      selected: (await b.getAttribute("data-selected")) === "true",
      disabled: (await b.getAttribute("data-disabled")) === "true",
    };
  }
  return out;
}

async function clickDirection(page, key) {
  await page
    .locator(".layout-direction .flex-direction button")
    .nth(DIRECTION_INDEX[key])
    .click();
  await page.waitForTimeout(1000);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { checks: {}, errors };

try {
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("labelposition-direction");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const bodyId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    )?.id;
  });

  for (const type of TYPES) {
    const id = await addFromPalette(page, type, bodyId);
    const r = (report.checks[type] = { id });
    await seed(page, id, { label: `${type} label` });
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      id,
    );
    await setPanel(page, "styles", true);
    await page.waitForTimeout(600);

    // A. 기본 (top) — 패널 표시와 Skia 배치.
    r.A_top = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // B. top 에서 Direction Row 클릭 — 무엇이 기록되고 Skia 가 어떻게 놓이나.
    await clickDirection(page, "row");
    r.B_topClickRow = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // C. Direction Column 클릭 — 되돌아가나.
    await clickDirection(page, "column");
    r.C_clickColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // C2. 이미 선택된 Column 을 다시 클릭 — 빈 선택이 side 로 번역되지 않는다 (판독 M1).
    await clickDirection(page, "column");
    r.C2_reclickColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // D. 옛 토글이 남긴 인라인 (flex column) + labelPosition side — DOM 은 인라인이 이긴다 (column).
    await seed(page, id, {
      labelPosition: "side",
      style: { display: "flex", flexDirection: "column" },
    });
    r.D_sideWithInlineColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // F. D 에서 Direction Column 클릭 — labelPosition 이 top 이 되고 남은 인라인 display · flexDirection 이 지워진다.
    await clickDirection(page, "column");
    r.F_staleThenColumn = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };

    // E. 인라인 없는 side — label > track > value 한 줄.
    await seed(page, id, { labelPosition: "side", style: {} });
    r.E_sideClean = {
      layout: await arrangement(page, id),
      direction: await directionState(page),
    };
    // H. 정렬 계열 — grid 기본 (ProgressBar · Meter · Slider) 은 비활성, 라벨 위치 flex (TextField) 는
    //   점을 눌러도 display · flexDirection 을 쓰지 않는다.
    await seed(page, id, { labelPosition: "top", style: {} });
    const alignGroup = page.locator(".flex-alignment [role='radiogroup'], .flex-alignment .react-aria-ToggleButtonGroup").first();
    const alignDisabled = (await alignGroup.getAttribute("data-disabled")) === "true";
    const firstDot = page.locator(".flex-alignment button").first();
    const dotDisabled = (await firstDot.getAttribute("data-disabled")) === "true";
    if (!dotDisabled) {
      await firstDot.click();
      await page.waitForTimeout(900);
    }
    r.H_alignment = {
      alignDisabled,
      dotDisabled,
      layout: await arrangement(page, id),
      style: await page.evaluate(
        (id) => window.__composition_STORE__.getState().elementsMap.get(id)?.props?.style ?? null,
        id,
      ),
    };
    await page.screenshot({ path: `${OUT}/${type}.png` });
    await setPanel(page, "styles", false);
  }

  // G. instance 안 자식 (synthetic `<form>/<path>`) — Form 안 TextField 에서 Direction 이 labelPosition 을 쓴다.
  {
    const formId = await addFromPalette(page, "Form", bodyId);
    const r = (report.checks.FormChild = { formId });
    const childId = await page.evaluate((formId) => {
      const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const st = window.__composition_STORE__.getState();
      // origin 안 필드는 어느 깊이든 `<form>/<…>/<field>` — 마지막 조각의 origin 노드 (ref 면 그 원본) 가 TextField.
      const typeOf = (id) => {
        const n = st.elementsMap.get(id);
        return n?.type === "ref" ? st.elementsMap.get(n.ref)?.type : n?.type;
      };
      const keys = [...lm.keys()].filter((k) => k.startsWith(`${formId}/`));
      // path 조각은 이름 기반 (`<form>/TextField/Name`) — TextField origin 자식 (`component-textfield__N`) 의 부모 키.
      const key = keys
        .filter((k) => /\/component-textfield__1$/.test(k))
        .map((k) => k.slice(0, k.lastIndexOf("/")))
        .sort((a, b) => a.length - b.length)[0];
      return key ?? { missing: true, keys: keys.slice(0, 30).map((k) => `${k} → ${typeOf(k.split("/").pop())}`) };
    }, formId).then((v) => {
      if (v && typeof v === "object") {
        r.probe = v.keys;
        return null;
      }
      return v;
    });
    r.childId = childId;
    const readChild = () =>
      page.evaluate(
        ({ formId, childId }) => {
          const st = window.__composition_STORE__.getState();
          const form = st.elementsMap.get(formId);
          const path = childId.slice(formId.length + 1);
          // 중첩 경로면 patch 키도 전체 path.
          const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
          const kids = [...lm.keys()]
            .filter((k) => k.startsWith(`${childId}/`) && !k.slice(childId.length + 1).includes("/"))
            .map((k) => ({ k: k.slice(childId.length + 1), x: Math.round(lm.get(k).x), y: Math.round(lm.get(k).y) }));
          return { patch: form?.descendants?.[path] ?? null, kids };
        },
        { formId, childId },
      );
    if (childId) {
      await page.evaluate(
        (id) => window.__composition_STORE__.getState().setSelectedElement(id),
        childId,
      );
      await setPanel(page, "styles", true);
      await page.waitForTimeout(800);
      r.before = { ...(await readChild()), direction: await directionState(page) };
      await clickDirection(page, "row");
      r.afterRow = { ...(await readChild()), direction: await directionState(page) };
      // 옛 경로가 남긴 patch 인라인 재현 (종전 토글이 synthetic 에 쓰던 값).
      await page.evaluate(() =>
        window.__composition_STORE__
          .getState()
          .updateSelectedProperties({ style: { display: "flex", flexDirection: "row" } }),
      );
      await page.waitForTimeout(900);
      r.staleSeeded = { ...(await readChild()), direction: await directionState(page) };
      await clickDirection(page, "column");
      r.afterColumn = { ...(await readChild()), direction: await directionState(page) };
      await page.screenshot({ path: `${OUT}/form-child.png` });
    }
  }
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

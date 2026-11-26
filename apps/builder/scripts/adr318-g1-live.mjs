#!/usr/bin/env node
// ADR-318 G1 live — Resizable 분할창의 정적 배치 (Phase 1): 팔레트로 Group 을 놓고, 작성 값을 바꿀 때마다
// Canvas record 상자 (엔진) 와 Publish DOM 상자 (`getBoundingClientRect` — 기준값, Q5) 를 ±1 px 로 대조한다.
//   1. 팔레트 「resizable panels」 → Group > Panel · Handle · Panel (Layers · record)
//   2. 기본 (50 / 50, 가로) · 3. 왼쪽 defaultSize 30 · 4. 왼쪽 minSize 200px (몫 10) ·
//   5. 왼쪽 maxSize 40% (몫 80) · 6. 세로 (Group orientation vertical, 높이 200) — 각 상태 Publish 대조
//   7. 식이 뜻한 크기 (따로 적은 값) — Canvas 가 그 값 (Group 폭 W, 손잡이 1 px)
//   8. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr318-g1-live.mjs <out-dir>
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr318-g1-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser =
  process.env.BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};

/** The Group's records (Canvas): id · node · type · box relative to the Group. */
const canvasBoxes = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const group = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "ResizablePanelGroup",
    );
    if (!group) return null;
    const ids = [group.id, ...group.children];
    const geo = r.getGeometry(ids);
    const g = geo.get(group.id);
    return ids.map((id) => {
      const rec = r.canvasInputs.get(id);
      const b = geo.get(id);
      return {
        id,
        node: rec?.sourceId,
        type: rec ? r.typeOf(rec) : null,
        x: b && b.x - g.x,
        y: b && b.y - g.y,
        w: b?.width,
        h: b?.height,
      };
    });
  });

const setProps = (nodeId, props) =>
  page.evaluate(
    ({ nodeId, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const r = ws.root;
      const rec = [...r.canvasInputs.values()].find(
        (x) => x.sourceId === nodeId,
      );
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(rec.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              v === null ? { kind: "remove" } : { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    { nodeId, props },
  );

/** Publish DOM boxes of the same records (relative to the Group). */
const publishBoxes = async (ids) => {
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-ResizablePanelGroup", {
    timeout: 60000,
  });
  // (Publish reads the saved document — wait until it draws these records.)
  await pub
    .waitForFunction(
      (ids) =>
        ids.every((id) =>
          document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`),
        ),
      ids,
      { timeout: 30000 },
    )
    .catch(() => {});
  await pub.waitForTimeout(600);
  const found = await pub.evaluate(() =>
    [...document.querySelectorAll("[data-catalog-id]")]
      .filter((el) => String(el.className).includes("Resizable"))
      .map((el) => el.getAttribute("data-catalog-id")),
  );
  if (!found.includes(ids[0])) {
    await pub.screenshot({ path: `${OUT}/publish-missing.png` });
    process.stdout.write(
      `  publish text: ${(await pub.evaluate(() => document.body.innerText)).slice(0, 600)}\n`,
    );
  }
  const boxes = await pub.evaluate((ids) => {
    const of = (id) =>
      document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const g = of(ids[0])?.getBoundingClientRect();
    return ids.map((id) => {
      const el = of(id);
      const b = el?.getBoundingClientRect();
      return b && g
        ? {
            id,
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute("role"),
            cls: el.className,
            style: el.getAttribute("style"),
            bg: getComputedStyle(el).backgroundColor,
            token: (() => {
              const probe = document.createElement("div");
              probe.style.background = "var(--neutral-surface-hover)";
              document.body.append(probe);
              const value = getComputedStyle(probe).backgroundColor;
              probe.remove();
              return value;
            })(),
            x: b.x - g.x,
            y: b.y - g.y,
            w: b.width,
            h: b.height,
          }
        : { id, missing: true };
    });
  }, ids);
  await pub.close();
  return boxes;
};

const compare = (canvas, dom) => {
  const bad = [];
  canvas.forEach((c, i) => {
    const d = dom[i];
    if (!d || d.missing) return bad.push(`${c.type}: DOM 없음`);
    for (const f of ["x", "y", "w", "h"])
      if (Math.abs(c[f] - d[f]) > 1)
        bad.push(
          `${c.type}#${i}.${f}: canvas=${c[f]?.toFixed(1)} dom=${d[f].toFixed(1)}`,
        );
  });
  return bad;
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr318 g1 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Palette → the Group.
  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^resizable panels$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  const placed = await canvasBoxes();
  record(
    "1 팔레트 → Group > Panel · Handle · Panel",
    !!placed &&
      placed.map((b) => b.type).join(",") ===
        "ResizablePanelGroup,ResizablePanel,ResizableHandle,ResizablePanel",
    placed?.map((b) => b.type),
  );
  if (!placed) throw new Error("no group");
  const [, left, , right] = placed;
  await page.screenshot({ path: `${OUT}/1-placed.png` });

  const steps = [
    { id: "2 기본 50 / 50", node: null, props: null },
    {
      id: "3 왼쪽 defaultSize 30",
      node: left.node,
      props: { defaultSize: 30 },
    },
    {
      id: "4 왼쪽 minSize 200px (몫 10)",
      node: left.node,
      props: { defaultSize: 10, minSize: "200px" },
    },
    {
      id: "5 왼쪽 maxSize 40% (몫 80)",
      node: left.node,
      props: { defaultSize: 80, minSize: null, maxSize: "40%" },
    },
    {
      id: "6 세로 (orientation vertical)",
      node: placed[0].node,
      props: { orientation: "vertical" },
      reset: { node: left.node, props: { defaultSize: 30, maxSize: null } },
    },
  ];
  for (const step of steps) {
    if (step.reset) await setProps(step.reset.node, step.reset.props);
    if (step.node) await setProps(step.node, step.props);
    await page.waitForTimeout(700);
    const canvas = await canvasBoxes();
    const W = canvas[0].w;
    const H = canvas[0].h;
    const vertical = step.id.startsWith("6");
    const main = (vertical ? H : W) - 1;
    // 7. the formula's sizes (written out per step).
    const want = {
      "2 기본 50 / 50": [main * 0.5, main * 0.5],
      "3 왼쪽 defaultSize 30": [main * 0.3, main * 0.7],
      "4 왼쪽 minSize 200px (몫 10)": [200, main - 200],
      "5 왼쪽 maxSize 40% (몫 80)": [W * 0.4, main - W * 0.4],
      "6 세로 (orientation vertical)": [main * 0.3, main * 0.7],
    }[step.id];
    const size = (b) => (vertical ? b.h : b.w);
    const formula = [size(canvas[1]), size(canvas[3])];
    const handle = canvas[2];
    const dom = await publishBoxes(canvas.map((b) => b.id));
    const bad = compare(canvas, dom);
    record(`${step.id} — Canvas = Publish (±1 px)`, bad.length === 0, {
      bad,
      styles: dom.map((b) => b.style),
      canvas: canvas.map((b) =>
        [b.x, b.y, b.w, b.h].map((v) => Math.round(v * 10) / 10),
      ),
      dom: dom.map((b) =>
        [b.x, b.y, b.w, b.h].map((v) => Math.round(v * 10) / 10),
      ),
    });
    record(
      `${step.id} — 식이 뜻한 크기 · 손잡이 1 px`,
      formula.every((v, i) => Math.abs(v - want[i]) <= 1) &&
        Math.abs((vertical ? handle.h : handle.w) - 1) <= 0.01,
      { formula, want, handle: [handle.w, handle.h] },
    );
    if (step.id.startsWith("2")) {
      // (The Canvas paints the rule's paint tree at draw time — the record has no color; both read
      //  the one tree (ADR-297). Here: the DOM line is that token, the Panels have no fill.)
      record(
        "칠 — Handle 선 = 토큰 --neutral-surface-hover · Panel 칠 없음 (Publish)",
        dom[2].bg === dom[2].token &&
          dom[1].bg === "rgba(0, 0, 0, 0)" &&
          dom[3].bg === "rgba(0, 0, 0, 0)",
        {
          handle: dom[2].bg,
          token: dom[2].token,
          panels: [dom[1].bg, dom[3].bg],
        },
      );
    }
    if (step.id.startsWith("2"))
      record(
        "D1 — Group · Panel 은 role 없는 div · Handle 은 separator (Phase 2 의 닫힌 목록)",
        dom.every((b) => b.tag === "div") &&
          [dom[0], dom[1], dom[3]].every((b) => !b.role) &&
          dom[2].role === "separator",
        dom.map((b) => [b.tag, b.role, String(b.cls).split(" ")[0]]),
      );
    await page.screenshot({
      path: `${OUT}/${step.id.split(" ")[0]}-canvas.png`,
    });
  }
  record("8 page error 0", errors.length === 0, errors.slice(0, 5));
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(
    `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} (${results.length})\n`,
  );
}

#!/usr/bin/env node
// ADR-318 Phase 0 — 시제품 P2 · P3 · P4 의 go / no-go 를 실제 브라우저에서 판정한다 (P1 은 parity
// browser test `tests/parity/adr318ResizableFlexShare.browser.test.ts` · P4 의 VoiceOver 청취는 사용자).
//   node apps/builder/scripts/adr318-phase0-prototypes.mjs <out-dir> [--only p2,p3,p4] [--browser chrome,webkit]
//   node apps/builder/scripts/adr318-phase0-prototypes.mjs <out-dir> --serve   (사용자 청취용 — 주소만 출력)
// `adr318Prototypes.mjs` (설치된 react-aria · RAC 위의 작은 Resizable) 를 production lib build 해 빈 페이지에
// 올린다. 판정값은 브라우저의 rAF 간격 · long-animation-frame · DOM 속성 · scrollY · 접근성 트리다 (Q5).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr318-phase0";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const ONLY = arg("--only", null)?.split(",");
const BROWSERS = (arg("--browser", "chrome,webkit") ?? "").split(",");
const SERVE = process.argv.includes("--serve");

const { build } = await import("vite");
await build({
  configFile: false,
  logLevel: "warn",
  root: `${REPO}/apps/builder`,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: `${REPO}/apps/builder/scripts/adr318Prototypes.mjs`,
      formats: ["es"],
      fileName: () => "prototypes.js",
    },
    outDir: `${OUT}/site`,
    emptyOutDir: true,
    minify: true,
  },
});
writeFileSync(
  `${OUT}/site/index.html`,
  `<!doctype html><meta charset="utf-8"><title>adr318</title>
<style>body{margin:0;font:14px system-ui}</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;
if (location.hash === "#auto") mount({});</script>`,
);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const file = join(`${OUT}/site`, path === "/" ? "index.html" : path);
  if (!existsSync(file) || path === "/favicon.ico") {
    res.writeHead(path === "/favicon.ico" ? 204 : 404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type":
      { ".js": "text/javascript", ".html": "text/html" }[extname(file)] ??
      "application/octet-stream",
  });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const URL_BASE = `http://127.0.0.1:${server.address().port}/`;
if (SERVE) {
  process.stdout.write(`청취용 페이지: ${URL_BASE}#auto (Ctrl+C 로 끝)\n`);
  await new Promise(() => {});
}

const settle = (page, frames = 4) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const tick = (left) =>
          left ? requestAnimationFrame(() => tick(left - 1)) : resolve();
        tick(n);
      }),
    frames,
  );
const handle = (page, group) =>
  page.locator(`[role=separator][data-group="${group}"]`);
const valueNow = (page, group) =>
  handle(page, group).getAttribute("aria-valuenow").then(Number);
const centerOf = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const mount = async (page, options) => {
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate((o) => window.__mount(o), options);
  await page.waitForFunction(() => window.__ready === true);
  await settle(page, 10);
};
const quantile = (values, q) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const median = (values) => quantile(values, 0.5);

const CHECKS = {
  // P2 — 끌기 중 프레임. 바깥 손잡이 (옆 Panel 에 RAC Table 1,000 행 · Virtualizer) 를 왕복으로 끈다.
  async p2(page, out, browser) {
    if (browser !== "chrome") {
      out.push({
        name: "P2 는 Chrome 에서만 (CPU throttle = CDP)",
        pass: true,
        detail: "skip",
      });
      return;
    }
    const cdp = await page.context().newCDPSession(page);
    const table = {};
    for (const tableKind of [true, "plain"])
      for (const rate of [1, 4]) {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        for (const pair of [0, 1, 2]) {
          const order = pair % 2 ? ["end", "frame"] : ["frame", "end"];
          for (const arm of order) {
            await mount(page, { arm, table: tableKind });
            const visible = await page.evaluate(() => document.visibilityState);
            const start = await centerOf(handle(page, "outer"));
            await page.evaluate(() => {
              window.__frames = [];
              window.__loaf = [];
              window.__writes = 0;
              const loop = (t) => {
                window.__frames.push(t);
                if (window.__recording) requestAnimationFrame(loop);
              };
              window.__recording = true;
              requestAnimationFrame(loop);
              if (
                PerformanceObserver.supportedEntryTypes?.includes(
                  "long-animation-frame",
                )
              )
                new PerformanceObserver((list) => {
                  for (const entry of list.getEntries())
                    window.__loaf.push(entry.duration);
                }).observe({ type: "long-animation-frame" });
            });
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            // 왕복 3 번 — ±300px, 6px 걸음 (한 걸음 = 한 pointermove).
            let x = start.x;
            for (let lap = 0; lap < 3; lap++)
              for (const dir of [-1, 1, 1, -1])
                for (let s = 0; s < 25; s++) {
                  x += dir * 6;
                  await page.mouse.move(x, start.y);
                }
            await page.mouse.up();
            const got = await page.evaluate(() => {
              window.__recording = false;
              const f = window.__frames;
              return {
                deltas: f.slice(1).map((t, i) => t - f[i]),
                loaf: window.__loaf,
                writes: window.__writes,
                readout: document.querySelector('[data-readout="outer-0"]')
                  ?.textContent,
              };
            });
            const key = `${tableKind === "plain" ? "가상 없음" : "가상"} ${rate}x ${arm}`;
            (table[key] ??= []).push({
              p50: median(got.deltas),
              p95: quantile(got.deltas, 0.95),
              p99: quantile(got.deltas, 0.99),
              frames: got.deltas.length,
              loafMax: got.loaf.length ? Math.max(...got.loaf) : 0,
              loafCount: got.loaf.length,
              writes: got.writes,
              visible,
            });
            if (got.writes === 0)
              out.push({
                name: `[${key}] 끌기가 닿음`,
                pass: false,
                detail: "writes 0",
              });
          }
        }
      }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    for (const [key, runs] of Object.entries(table)) {
      const p95 = median(runs.map((r) => r.p95));
      const line = `p50 ${median(runs.map((r) => r.p50)).toFixed(1)} · p95 ${p95.toFixed(1)} · p99 ${median(
        runs.map((r) => r.p99),
      ).toFixed(
        1,
      )} ms · LoAF ${median(runs.map((r) => r.loafCount))} 개 (최대 ${median(
        runs.map((r) => r.loafMax),
      ).toFixed(
        0,
      )} ms) · 쓰기 ${median(runs.map((r) => r.writes))} · 프레임 ${median(
        runs.map((r) => r.frames),
      )} · ${runs[0].visible} · 3 회 중앙값 [p95 ${runs.map((r) => r.p95.toFixed(1)).join(" / ")}]`;
      out.push({
        name: `[${key}] 끌기 중 frame p95 ${key.includes(" 1x") ? "≤ 16.7 ms (go 기준)" : "(병기)"}`,
        pass: key.includes(" 1x") ? p95 <= 16.7 : true,
        detail: line,
      });
    }
  },

  // P3 — 중첩 번짐 · 축과 다른 화살표 · iframe 위에서 놓기.
  async p3(page, out) {
    await mount(page, { arm: "frame", table: false });
    const before = {
      outer: await valueNow(page, "outer"),
      mid: await valueNow(page, "mid"),
      inner: await valueNow(page, "inner"),
    };
    // (1) 안쪽 손잡이 키 — 축 방향 → 자기만.
    await handle(page, "inner").focus();
    await page.keyboard.press("ArrowRight");
    await settle(page);
    const k1 = {
      outer: await valueNow(page, "outer"),
      mid: await valueNow(page, "mid"),
      inner: await valueNow(page, "inner"),
    };
    out.push({
      name: "안쪽 손잡이 ArrowRight → 안쪽만 +5",
      pass:
        k1.inner === before.inner + 5 &&
        k1.mid === before.mid &&
        k1.outer === before.outer,
      detail: JSON.stringify({ before, after: k1 }),
    });
    // (2) 축과 다른 화살표 — 가로 Group 의 손잡이에서 ArrowDown: 값 그대로 · 기본 동작 (스크롤) 살아 있음.
    await page.evaluate(() => {
      window.__lastKey = null;
      document.addEventListener("keydown", (e) => {
        window.__lastKey = { key: e.key, prevented: e.defaultPrevented };
      });
    });
    // 대조군 — 아무 처리 없는 focus 가능한 div 에서 같은 키 (그 브라우저 · 자동화가 화살표로 스크롤하는가).
    const control = await page.evaluate(async () => {
      const div = document.createElement("div");
      div.tabIndex = 0;
      div.textContent = "control";
      document.body.prepend(div);
      div.focus();
      return true;
    });
    await page.keyboard.press("ArrowDown");
    await settle(page, 6);
    const controlScroll = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.body.firstElementChild.remove();
    });
    await settle(page);
    await handle(page, "outer").focus();
    const scroll0 = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    await settle(page, 6);
    const scroll1 = await page.evaluate(() => window.scrollY);
    const last = await page.evaluate(() => window.__lastKey);
    out.push({
      name: "가로 Group 손잡이의 ArrowDown — 값 그대로 · document 까지 감 · 막지 않음 · 페이지 스크롤",
      pass:
        (await valueNow(page, "outer")) === before.outer &&
        last?.key === "ArrowDown" &&
        last.prevented === false &&
        scroll1 > scroll0 === controlScroll > 0,
      detail: JSON.stringify({
        last,
        scroll0,
        scroll1,
        control,
        controlScroll,
      }),
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    // (3) 안쪽 손잡이 끌기 → 바깥 · 가운데 그대로.
    const c = await centerOf(handle(page, "inner"));
    const pre = {
      outer: await valueNow(page, "outer"),
      mid: await valueNow(page, "mid"),
      inner: await valueNow(page, "inner"),
    };
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    for (let s = 1; s <= 10; s++) await page.mouse.move(c.x - s * 5, c.y);
    await page.mouse.up();
    await settle(page);
    const post = {
      outer: await valueNow(page, "outer"),
      mid: await valueNow(page, "mid"),
      inner: await valueNow(page, "inner"),
    };
    out.push({
      name: "안쪽 손잡이 끌기 → 바깥 · 가운데 값 그대로 · 안쪽만 줄어듦",
      pass:
        post.inner < pre.inner &&
        post.outer === pre.outer &&
        post.mid === pre.mid,
      detail: JSON.stringify({ pre, post }),
    });
    // (4) iframe 위에서 놓기 — 가림막 없음 / 있음.
    for (const shield of ["none", "panels", "capture"]) {
      await mount(page, { arm: "frame", table: false, shield });
      const at = await centerOf(handle(page, "inner"));
      const frame = await page.locator("[data-iframe]").boundingBox();
      await page.evaluate(() => {
        window.__seen = { move: 0, up: 0, hit: [] };
        window.addEventListener(
          "pointermove",
          (e) => {
            window.__seen.move++;
            if (window.__seen.hit.length < 3)
              window.__seen.hit.push(e.target?.tagName + "|" + e.clientX);
          },
          true,
        );
        window.addEventListener("pointerup", () => window.__seen.up++, true);
      });
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      // 최대 (70 %) 를 넘겨 iframe 안쪽 깊이까지 — 손잡이는 멈추고 포인터만 iframe 위로.
      const target = {
        x: frame.x + frame.width * 0.8,
        y: frame.y + frame.height / 2,
      };
      for (let s = 1; s <= 12; s++)
        await page.mouse.move(
          at.x + ((target.x - at.x) * s) / 12,
          at.y + ((target.y - at.y) * s) / 12,
        );
      await page.mouse.up();
      await settle(page);
      const released = await valueNow(page, "inner");
      // 놓은 뒤 버튼 없이 왼쪽으로 — 끌기가 끝났으면 값이 그대로.
      for (let s = 1; s <= 8; s++)
        await page.mouse.move(target.x - s * 60, at.y);
      await settle(page);
      const after = await valueNow(page, "inner");
      const stuck = await page.evaluate(
        () =>
          !!document.querySelector(
            '[role=separator][data-group="inner"][data-resizing]',
          ),
      );
      out.push({
        // 「none」 은 대조군 — 가림막 없이는 iframe 위에서 놓은 끌기가 끝나지 않는다 (재현돼야 PASS).
        name:
          shield === "none"
            ? "[none · 대조군] 가림막 없이는 iframe 위에서 놓은 끌기가 이어진다 (끊김 재현)"
            : `[${shield}] iframe 위에서 놓은 끌기가 끝남 (놓은 뒤 이동에 값 그대로) · iframe 위 이동도 따라감`,
        pass:
          shield === "none"
            ? stuck && after !== released
            : after === released && !stuck && released === 70,
        detail: JSON.stringify({
          released,
          after,
          stuck,
          seen: await page.evaluate(() => window.__seen),
          at,
          target,
        }),
      });
    }
  },

  // P4 — 접근성 트리의 separator 이름 · 값 (Chrome CDP · WebKit ariaSnapshot). 청취는 사용자.
  async p4(page, out, browser) {
    await mount(page, { arm: "frame", table: false });
    if (browser === "chrome") {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const seps = nodes.filter(
        (n) => n.role?.value === "separator" && !n.ignored,
      );
      const read = seps.map((n) => ({
        name: n.name?.value,
        value: n.value?.value,
        props: Object.fromEntries(
          (n.properties ?? [])
            .filter((p) =>
              [
                "valuemin",
                "valuemax",
                "focusable",
                "orientation",
                "valuetext",
              ].includes(p.name),
            )
            .map((p) => [p.name, p.value?.value]),
        ),
      }));
      out.push({
        name: "Chrome 접근성 트리 — separator 3 개가 이름 · 값 · 최소 · 최대 · focus 가능",
        pass:
          read.length === 3 &&
          read.every(
            (r) =>
              r.name &&
              r.value !== undefined &&
              r.props.valuemin !== undefined &&
              r.props.focusable,
          ),
        detail: JSON.stringify(read),
      });
    } else {
      // WebKit 은 자동화로 접근성 값을 읽을 길이 없다 — 이름 (aria snapshot) 과 속성만, 값 낭독은 VoiceOver 청취.
      const snap = await handle(page, "outer").ariaSnapshot();
      const attrs = await handle(page, "outer").evaluate((el) =>
        Object.fromEntries(
          [
            "role",
            "aria-valuenow",
            "aria-valuemin",
            "aria-valuemax",
            "aria-orientation",
            "tabindex",
          ].map((n) => [n, el.getAttribute(n)]),
        ),
      );
      out.push({
        name: "WebKit — separator 이름 (aria snapshot) · 값 속성 (낭독은 VoiceOver 청취)",
        pass:
          /separator "Resize table panel"/.test(snap) &&
          attrs["aria-valuenow"] === "50",
        detail: JSON.stringify({ snap, attrs }),
      });
    }
  },
};

const NAMES = ["p2", "p3", "p4"].filter((name) => !ONLY || ONLY.includes(name));
const results = {};
for (const browser of BROWSERS) {
  const instance =
    browser === "webkit"
      ? await webkit.launch({ headless: false })
      : await chromium.launch({ headless: false, channel: "chrome" });
  results[browser] = { version: instance.version() };
  for (const name of NAMES) {
    const context = await instance.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text().slice(0, 300));
    });
    const out = [];
    process.stdout.write(`\n[${browser}] ${name}\n`);
    const push = out.push.bind(out);
    out.push = (line) => {
      process.stdout.write(
        `  ${line.pass ? "PASS" : "FAIL"}  ${line.name} — ${line.detail}\n`,
      );
      return push(line);
    };
    try {
      await CHECKS[name](page, out, browser);
    } catch (error) {
      out.push({
        name: "실행 오류",
        pass: false,
        detail: String(error).split("\n").slice(0, 3).join(" | "),
      });
    }
    out.push({
      name: "페이지 오류 0",
      pass: errors.length === 0,
      detail: errors.slice(0, 3).join(" ‖ "),
    });
    await page.screenshot({ path: `${OUT}/${browser}-${name}.png` });
    results[browser][name] = out;
    await context.close();
  }
  await instance.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
server.close();
const failed = Object.values(results).flatMap((byName) =>
  Object.entries(byName).flatMap(([name, out]) =>
    Array.isArray(out)
      ? out.filter((line) => !line.pass).map((line) => `${name}: ${line.name}`)
      : [],
  ),
);
process.stdout.write(
  `\n${failed.length ? `FAIL ${failed.length}` : "ALL PASS"} → ${OUT}/results.json\n`,
);

#!/usr/bin/env node
// ADR-323 Phase 0 — 시제품 P1 ~ P4 (breakdown §7) 의 go / no-go 를 실제 브라우저에서 판정한다.
//   node apps/builder/scripts/adr323-phase0-prototypes.mjs <out-dir> [--only p1,p2,p3,p4] [--browser chrome,webkit]
//   node apps/builder/scripts/adr323-phase0-prototypes.mjs <out-dir> --serve   (사용자 청취용 — 주소만 출력, 기본 p1)
// `adr323Prototypes.mjs` (설치된 react-aria · RAC 위의 작은 시제품) 를 production lib build 해 빈 페이지에
// 올린다. 판정값은 브라우저의 접근성 트리 · focus · rAF 간격 · long-animation-frame · DOM 좌표다 (Q5).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr323-phase0";
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
      entry: `${REPO}/apps/builder/scripts/adr323Prototypes.mjs`,
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
  `<!doctype html><meta charset="utf-8"><title>adr323</title>
<style>body{margin:0;font:14px system-ui}</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;
if (location.hash) mount({ kind: location.hash.slice(1) });</script>`,
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
  process.stdout.write(`청취용 페이지: ${URL_BASE}#p1 (Ctrl+C 로 끝)\n`);
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
const fmt = (n) => (typeof n === "number" ? n.toFixed(1) : String(n));
/** rAF 마다 `step(i)` 을 부르고 그 프레임 간격을 잰다 (보이는 탭 · LoAF 같이). */
const frameRun = (page, kind, frames, amount) =>
  page.evaluate(
    ({ kind, frames, amount }) =>
      new Promise((resolve) => {
        const loaf = [];
        let observer;
        if (
          PerformanceObserver.supportedEntryTypes?.includes(
            "long-animation-frame",
          )
        ) {
          observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) loaf.push(entry.duration);
          });
          observer.observe({ type: "long-animation-frame" });
        }
        const table = document.querySelector("#gantt");
        const next = document.querySelector("#next");
        const stamps = [];
        const work = [];
        let i = 0;
        const tick = (t) => {
          stamps.push(t);
          if (i >= frames) {
            observer?.disconnect();
            resolve({
              deltas: stamps.slice(1).map((s, k) => s - stamps[k]),
              work,
              loaf,
              visible: document.visibilityState,
            });
            return;
          }
          if (kind === "vertical") table.scrollTop += amount;
          else if (kind === "horizontal") table.scrollLeft += amount;
          else if (kind === "flip" && i % 2 === 0) {
            // 넘기기의 main thread 몫 — 클릭 → React 의 commit (discrete 갱신은 microtask 에서 그린다 —
            // 그 뒤에 줄 선 microtask) → 강제 layout.
            const t0 = performance.now();
            next.click();
            queueMicrotask(() => {
              void document.querySelector("#scroller").offsetHeight;
              work.push(performance.now() - t0);
            });
          }
          i++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { kind, frames, amount },
  );

const CHECKS = {
  // P1 — 월 칸 안 일정 글자의 낭독 이름 · 날짜 키 이동 (대조군 = 자식 없는 Calendar).
  async p1(page, out) {
    await mount(page, { kind: "p1" });
    const cell = (id, day) =>
      page
        .locator(`#${id} [role=gridcell] [role=button]`)
        .filter({ hasText: new RegExp(`^${day}(\\D|$)`) })
        .first();
    const snap = await page.locator("#events").ariaSnapshot();
    const line10 = snap.split("\n").find((l) => /November 10, 2026/.test(l));
    const attrs = await cell("events", 10).evaluate((el) => ({
      label: el.getAttribute("aria-label"),
      describedby: el.getAttribute("aria-describedby"),
      text: el.textContent,
    }));
    out.push({
      name: "칸 (11-10, 일정 4 건) 의 낭독 이름에 일정 글자가 실림 (go 기준)",
      pass:
        /Design review/.test(line10 ?? "") ||
        /Design review/.test(attrs.label ?? ""),
      detail: JSON.stringify({
        line10,
        attrs,
        eventTextInSnapshot: /Design review/.test(snap),
      }),
    });
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "PageDown",
      "PageUp",
      "Home",
      "End",
      "ArrowDown",
    ];
    const walk = async (id) => {
      await cell(id, 15).focus();
      const seq = [];
      for (const key of keys) {
        await page.keyboard.press(key);
        seq.push(
          await page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
        );
      }
      return seq;
    };
    const control = await walk("control");
    const events = await walk("events");
    out.push({
      name: "날짜 키 이동 = 대조군 (화살표 · PageUp/Down · Home/End)",
      pass:
        JSON.stringify(control) === JSON.stringify(events) &&
        control.every(Boolean),
      detail: JSON.stringify({ control, events }),
    });
  },

  // P2 — 주 보기 200 건 (같은 시각 20 건 겹침).
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
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      const runs = [];
      for (let run = 0; run < 3; run++) {
        await page.goto(URL_BASE);
        await page.waitForFunction(() => typeof window.__mount === "function");
        const first = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const t0 = performance.now();
              window.__mount({ kind: "p2", count: 200 });
              const wait = () =>
                document.querySelectorAll("[data-event-id]").length >= 200
                  ? requestAnimationFrame(() => resolve(performance.now() - t0))
                  : requestAnimationFrame(wait);
              requestAnimationFrame(wait);
            }),
        );
        await settle(page, 10);
        const shape = await page.evaluate(() => {
          const stack = [
            ...document.querySelectorAll("[data-event-id]"),
          ].filter((b) => / stack /.test(b.textContent));
          return {
            buttons: document.querySelectorAll("[data-event-id]").length,
            stackLefts: new Set(
              stack.map((b) => Math.round(b.getBoundingClientRect().left)),
            ).size,
            geom0: window.__geomMs[0],
          };
        });
        await page.evaluate(() => (window.__geomMs = []));
        const idle = await frameRun(page, "idle", 40, 0);
        const flip = await frameRun(page, "flip", 120, 0);
        const geom = await page.evaluate(() => window.__geomMs.slice());
        // 넘기기 프레임 = 넘긴 프레임의 간격 (짝수 i 에서 click → 다음 간격).
        const flipDeltas = flip.deltas.filter((_, k) => k % 2 === 0);
        runs.push({
          first,
          ...shape,
          geomMax: Math.max(...geom),
          geomMedian: median(geom),
          flipP95: quantile(flipDeltas, 0.95),
          flipMax: Math.max(...flipDeltas),
          idleP95: quantile(idle.deltas, 0.95),
          workP95: quantile(flip.work, 0.95),
          workP50: median(flip.work),
          workFirst: flip.work[0],
          workMax: Math.max(...flip.work),
          loafCount: flip.loaf.length,
          loafMax: flip.loaf.length ? Math.max(...flip.loaf) : 0,
          visible: flip.visible,
        });
      }
      const p95 = median(runs.map((r) => r.flipP95));
      out.push({
        name: `[${rate}x] 주 넘기기 ${rate === 1 ? "— 작업 p95 ≤ 16.7 ms · frame p95 ≤ 빈 프레임 + 1 ms (go 기준)" : "(병기)"} · 기하 한 프레임 안`,
        pass:
          rate !== 1 ||
          (median(runs.map((r) => r.workP95)) <= 16.7 &&
            p95 <= median(runs.map((r) => r.idleP95)) + 1 &&
            runs.every(
              (r) =>
                r.geomMax < 16.7 && r.buttons === 200 && r.stackLefts === 20,
            )),
        detail: `넘기기 작업 (클릭 → commit → layout) p50 ${fmt(median(runs.map((r) => r.workP50)))} · p95 ${fmt(median(runs.map((r) => r.workP95)))} · 첫 넘기기 ${fmt(median(runs.map((r) => r.workFirst)))} · 최대 ${fmt(median(runs.map((r) => r.workMax)))} ms · 빈 프레임 대조군 p95 ${fmt(median(runs.map((r) => r.idleP95)))} · 넘기기 p95 ${fmt(p95)} · 최대 ${fmt(median(runs.map((r) => r.flipMax)))} ms · 기하 중앙 ${fmt(
          median(runs.map((r) => r.geomMedian)),
        )} · 최대 ${fmt(median(runs.map((r) => r.geomMax)))} ms · 첫 표시 ${fmt(
          median(runs.map((r) => r.first)),
        )} ms · Button ${runs[0].buttons} · 겹침 칸 ${runs[0].stackLefts} · LoAF ${median(
          runs.map((r) => r.loafCount),
        )} (최대 ${fmt(median(runs.map((r) => r.loafMax)))}) · ${runs[0].visible} · 3 회 [p95 ${runs
          .map((r) => fmt(r.flipP95))
          .join(" / ")}]`,
      });
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  },

  // P3 — Table 시간축 열 5,000 행 (대조군 = 시간축 열 없는 같은 Table, 교대 3 쌍).
  async p3(page, out, browser) {
    // 키 이동 · 고정 열 (두 브라우저)
    await mount(page, { kind: "p3", axis: true, rowCount: 5000 });
    const owner = page
      .locator("#gantt [role=row]")
      .nth(1)
      .locator("[role=rowheader],[role=gridcell]")
      .nth(3);
    await owner.click();
    await page.keyboard.press("ArrowRight");
    const reached = await page.evaluate(() => ({
      bar: document.activeElement?.getAttribute("data-bar"),
      role: document.activeElement?.getAttribute("role"),
      tag: document.activeElement?.tagName,
    }));
    await page.keyboard.press("Enter");
    const pressed = await page.evaluate(() => window.__pressed);
    await page.keyboard.press("ArrowDown");
    const down = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("data-bar") ??
        document.activeElement?.getAttribute("role"),
    );
    out.push({
      name: "키로 막대 Button 에 닿음 (Owner 칸 → →) · Enter = press",
      pass: reached.bar === "t0" && pressed === "t0",
      detail: JSON.stringify({ reached, pressed, afterArrowDown: down }),
    });
    const pin = await page.evaluate(async () => {
      const table = document.querySelector("#gantt");
      const head = () => {
        const c = document.querySelector("#gantt [role=rowheader][data-pin]");
        return Math.round(
          c.getBoundingClientRect().left - table.getBoundingClientRect().left,
        );
      };
      const before = head();
      table.scrollLeft = 1500;
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const after = head();
      const bars = document.querySelectorAll("[data-bar]").length;
      table.scrollLeft = 0;
      return {
        before,
        after,
        bars,
        rows: document.querySelectorAll("#gantt [role=row]").length,
      };
    });
    out.push({
      name: "가로 스크롤 1,500 px 뒤 앞 열 고정 (Task 칸 자리 그대로)",
      pass: pin.before === pin.after,
      detail: JSON.stringify(pin),
    });
    if (browser !== "chrome") return;
    const cdp = await page.context().newCDPSession(page);
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      const table = {};
      for (let pair = 0; pair < 3; pair++) {
        const order = pair % 2 ? [false, true] : [true, false];
        for (const axis of order) {
          await mount(page, { kind: "p3", axis, rowCount: 5000 });
          const kinds = axis ? ["vertical", "horizontal"] : ["vertical"];
          for (const kind of kinds) {
            const got = await frameRun(
              page,
              kind,
              kind === "vertical" ? 150 : 60,
              kind === "vertical" ? 96 : 40,
            );
            const key = `${axis ? "시간축 열" : "대조군"} ${kind === "vertical" ? "세로" : "가로"} ${rate}x`;
            (table[key] ??= []).push({
              p50: median(got.deltas),
              p95: quantile(got.deltas, 0.95),
              loafCount: got.loaf.length,
              loafMax: got.loaf.length ? Math.max(...got.loaf) : 0,
              visible: got.visible,
            });
          }
        }
      }
      for (const [key, runs] of Object.entries(table))
        out.push({
          name: `[${key}] 스크롤 frame`,
          pass: true,
          detail: `p50 ${fmt(median(runs.map((r) => r.p50)))} · p95 ${fmt(median(runs.map((r) => r.p95)))} ms · LoAF ${median(
            runs.map((r) => r.loafCount),
          )} (최대 ${fmt(median(runs.map((r) => r.loafMax)))}) · ${runs[0].visible} · 3 회 [p95 ${runs.map((r) => fmt(r.p95)).join(" / ")}]`,
          p95: median(runs.map((r) => r.p95)),
        });
      const axisP95 = out.find(
        (l) => l.name === `[시간축 열 세로 ${rate}x] 스크롤 frame`,
      ).p95;
      const ctrlP95 = out.find(
        (l) => l.name === `[대조군 세로 ${rate}x] 스크롤 frame`,
      ).p95;
      out.push({
        name: `[${rate}x] 세로 스크롤 p95 — 시간축 열 ≤ 대조군 + 1 ms ${rate === 1 ? "(go 기준)" : "(병기)"}`,
        pass: rate !== 1 || axisP95 <= ctrlP95 + 1,
        detail: `시간축 ${fmt(axisP95)} · 대조군 ${fmt(ctrlP95)} ms`,
      });
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  },

  // P4 — 끌기 (포인터 handler + pointer capture · 끄는 동안만 Escape listener).
  async p4(page, out) {
    const ev = page.locator("#ev");
    const state = () =>
      page.evaluate(() => ({
        start: Number(document.querySelector("#ev")?.dataset.start),
        end: Number(document.querySelector("#ev")?.dataset.end),
        top: document.querySelector("#ev")?.style.top,
        ...window.__p4,
        log: undefined,
        dialog: Boolean(document.querySelector("#dialog")),
      }));
    const dragBy = async (from, dy, { escapeAt, to } = {}) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      const steps = 10;
      for (let s = 1; s <= steps; s++) {
        await page.mouse.move(from.x, from.y + (dy * s) / steps);
        if (escapeAt === s) await page.keyboard.press("Escape");
      }
      if (to) await page.mouse.move(to.x, to.y, { steps: 5 });
      await page.mouse.up();
      await settle(page, 4);
    };
    // (mount 가 페이지를 다시 읽는다 — `window.__p4` 는 모듈이 0 으로 만든다.)
    const reset = (o) => mount(page, { kind: "p4", ...o });

    await reset({});
    await ev.click();
    await settle(page, 2);
    let s = await state();
    out.push({
      name: "누르기 = press 1 · 쓰기 0 · listener 0",
      pass: s.presses === 1 && s.commits === 0 && s.escListeners === 0,
      detail: JSON.stringify(s),
    });

    let c = await centerOf(ev);
    await dragBy(c, 60);
    s = await state();
    out.push({
      name: "옮기기 +60 px = 시작 120 → 180 (15 분 단위) · 쓰기 1 · press 0 · listener 0",
      pass:
        s.start === 180 &&
        s.end === 240 &&
        s.commits === 1 &&
        s.presses === 1 &&
        s.escListeners === 0,
      detail: JSON.stringify(s),
    });

    const box = await ev.boundingBox();
    await dragBy({ x: box.x + box.width / 2, y: box.y + box.height - 2 }, 30);
    s = await state();
    out.push({
      name: "끝 길이 조절 +30 px = 끝 240 → 270 · 시작 그대로 · 쓰기 2",
      pass: s.start === 180 && s.end === 270 && s.commits === 2,
      detail: JSON.stringify(s),
    });

    c = await centerOf(ev);
    await dragBy(c, 90, { escapeAt: 5 });
    s = await state();
    out.push({
      name: "끌기 중 Escape → 놓기 무시 (원래 자리 · 쓰기 그대로 · press 0 · listener 0)",
      pass:
        s.start === 180 &&
        s.top === "180px" &&
        s.commits === 2 &&
        s.cancels === 1 &&
        s.presses === 1 &&
        s.escListeners === 0,
      detail: JSON.stringify(s),
    });

    await ev.focus();
    await page.keyboard.press("ArrowDown");
    s = await state();
    out.push({
      name: "focus 된 일정에 ArrowDown — 움직이지 않음 (키 handler 없음)",
      pass: s.start === 180 && s.commits === 2,
      detail: JSON.stringify(s),
    });

    // 스크롤 영역 밖 · iframe 위에서 놓기 — capture 있음 / 없음 (대조군)
    for (const capture of [true, false]) {
      await reset({ capture });
      c = await centerOf(ev);
      const frame = await centerOf(page.locator("#frame"));
      await dragBy(c, 30, { to: frame });
      const afterUp = await state();
      await page.mouse.move(frame.x, frame.y + 100, { steps: 5 });
      await settle(page, 4);
      const later = await state();
      out.push({
        name: `iframe 위에서 놓기 (capture ${capture ? "있음" : "없음 — 대조군"}) — 끌기가 끝남 · 놓은 뒤 움직임 무시`,
        pass: capture
          ? afterUp.escListeners === 0 && later.top === afterUp.top
          : true,
        detail: JSON.stringify({
          afterUp,
          laterTop: later.top,
          laterListeners: later.escListeners,
        }),
      });
      await page.mouse.click(10, 500);
    }

    // Modal Dialog 안 — Escape 를 Dialog 가 먼저 가져가는가 (막지 않음 / 막음)
    for (const stopEscape of [false, true]) {
      await reset({ inDialog: true, stopEscape });
      c = await centerOf(ev);
      await dragBy(c, 90, { escapeAt: 5 });
      s = await state();
      out.push({
        name: `Dialog 안 끌기 중 Escape (전파 ${stopEscape ? "막음" : "그대로"}) — listener 가 먼저 받아 취소`,
        pass:
          s.cancels === 1 &&
          s.commits === 0 &&
          s.escListeners === 0 &&
          (stopEscape ? s.dialog : true),
        detail: JSON.stringify(s),
      });
    }
  },
};

const NAMES = ["p1", "p2", "p3", "p4"].filter(
  (name) => !ONLY || ONLY.includes(name),
);
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

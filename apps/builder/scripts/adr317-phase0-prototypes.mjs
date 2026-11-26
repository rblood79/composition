#!/usr/bin/env node
// ADR-317 Phase 0 — 시제품 P1 · P2 · P4 의 go / no-go 를 실제 브라우저에서 판정한다 (P3 은 Phase 1 의
// 묶음 쓰기 위에서 · P5 는 사용자 VoiceOver 청취).
//   node apps/builder/scripts/adr317-phase0-prototypes.mjs <out-dir> [--only p1,p2,p4] [--browser chrome,webkit]
// `adr317Prototypes.mjs` (설치된 RAC 1.22.1 + 제품의 `attachCatalogCellSelection`) 를 lib build 해 빈
// 페이지에 올린다. 판정값은 브라우저가 낸 이벤트 (`paste` 의 clipboardData) · 좌표 · DOM 속성 · 계산된
// 색이다 (Q5 — 정답 값은 아래에 따로 적었다. 시제품 자신의 상태는 조작이 닿았는지 확인하는 용도).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr317-phase0";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const ONLY = arg("--only", null)?.split(",");
const BROWSERS = (arg("--browser", "chrome,webkit") ?? "").split(",");

const { build } = await import("vite");
await build({
  configFile: false,
  logLevel: "warn",
  root: `${REPO}/apps/builder`,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: `${REPO}/apps/builder/scripts/adr317Prototypes.mjs`,
      formats: ["es"],
      fileName: () => "prototypes.js",
    },
    outDir: `${OUT}/site`,
    emptyOutDir: true,
    minify: false,
  },
});
writeFileSync(
  `${OUT}/site/index.html`,
  `<!doctype html><meta charset="utf-8"><title>adr317</title>
<style>body{margin:0;font:14px system-ui}</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;</script>`,
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

const ROW = 40;
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
const cell = (page, row, column) =>
  page.locator(
    `#p [role=row][data-key="${row}"] [data-column-key="${column}"]`,
  );
const value = (page, row, column) =>
  page.evaluate(([r, c]) => window.__api.p.value(r, c), [row, column]);
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const CHECKS = {
  // P1 — focus 가 gridcell (편집 불가) 에 있을 때 Ctrl / Cmd + V 의 `paste` 가 표에 오는가.
  async p1(page, out, browser, context) {
    for (const beforePaste of [false, true]) {
      const tag = beforePaste ? "beforepaste 막음" : "beforepaste 없음";
      await page.evaluate(
        (b) => window.__mount({ beforePaste: b }),
        beforePaste,
      );
      // 우리 복사 (제품의 `copy` listener) → 붙여넣기 왕복.
      await cell(page, "r1", "c1").click();
      await cell(page, "r2", "c2").click({ modifiers: ["Shift"] });
      await page.keyboard.press(`${MOD}+KeyC`);
      await cell(page, "r6", "c3").click();
      await page.keyboard.press(`${MOD}+KeyV`);
      await settle(page);
      const pastes = await page.evaluate(() => window.__api.p.pastes());
      const got = pastes.at(-1);
      out.push({
        name: `[${tag}] paste 가 표에 옴 (focus = gridcell)`,
        pass: !!got && got.text !== null,
        detail: JSON.stringify(got ?? null),
      });
      // 정답 (따로 적은 값): r1..r2 × c1..c2 의 원래 값이 r6..r7 × c3..c4 에.
      const want = {
        "r6|c3": "1:1",
        "r6|c4": "1:2",
        "r7|c3": "2:1",
        "r7|c4": "2:2",
      };
      const have = {};
      for (const key of Object.keys(want)) {
        const [r, c] = key.split("|");
        have[key] = await value(page, r, c);
      }
      out.push({
        name: `[${tag}] 복사 → 붙여넣기 값이 정답과 같음`,
        pass: Object.entries(want).every(([k, v]) => have[k] === v),
        detail: JSON.stringify(have),
      });
      // 화면 글자도 (그려진 칸).
      const drawn = await cell(page, "r7", "c4").textContent();
      out.push({
        name: `[${tag}] 그려진 칸 글자 반영`,
        pass: drawn?.startsWith("2:2") ?? false,
        detail: `r7|c4 = ${drawn}`,
      });
    }
    // 바깥 프로그램 (Excel · Sheets) 형식 — 따옴표 칸 안의 탭 · 줄바꿈. 클립보드에 직접 쓴다.
    await page.evaluate(() => window.__mount({}));
    const excel = 'a\t"b\tc"\n"multi\nline"\td';
    let wrote = false;
    try {
      if (browser !== "webkit")
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await cell(page, "r20", "c1").click();
      wrote = await page.evaluate(
        (text) =>
          navigator.clipboard.writeText(text).then(
            () => true,
            () => false,
          ),
        excel,
      );
    } catch {
      wrote = false;
    }
    if (wrote) {
      await page.keyboard.press(`${MOD}+KeyV`);
      await settle(page);
      const have = [
        await value(page, "r20", "c1"),
        await value(page, "r20", "c2"),
        await value(page, "r21", "c1"),
        await value(page, "r21", "c2"),
      ];
      const want = ["a", "b\tc", "multi\nline", "d"];
      out.push({
        name: "Excel 형식 (따옴표 · 칸 안 탭 · 줄바꿈) 이 칸 4 개로",
        pass: want.every((v, i) => have[i] === v),
        detail: JSON.stringify(have),
      });
    } else
      out.push({
        name: "Excel 형식 — 클립보드 쓰기 (navigator.clipboard) 불가, 건너뜀",
        pass: true,
        detail:
          "이 브라우저 자동화에서 클립보드 직접 쓰기 실패 — 파서는 단위 검사로",
      });
  },

  // P2 — 가상 표에서 손잡이 끌기 · 자동 스크롤 · 손잡이 요소 해제 · 범위 끌기와 구별.
  async p2(page, out) {
    await page.evaluate(() => window.__mount({}));
    // (focus 를 손잡이 칸이 아닌 r2|c1 에 둔다 — RAC 는 focus 된 행을 창 밖에서도 남긴다.)
    await cell(page, "r3", "c2").click();
    await cell(page, "r2", "c1").click({ modifiers: ["Shift"] });
    await settle(page);
    const handle = page.locator("#p [data-fill-handle]");
    const count = await handle.count();
    out.push({
      name: "손잡이가 마지막 범위의 오른쪽 아래 칸에 하나",
      pass:
        count === 1 &&
        (await handle.evaluate(
          (el) =>
            el.closest("[role=row]")?.dataset.key === "r3" &&
            el.closest("[data-column-key]")?.dataset.columnKey === "c2",
        )),
      detail: `개수 ${count}`,
    });
    const box = await handle.boundingBox();
    const table = await page.locator("#p").boundingBox();
    const before = await page.evaluate(() => window.__api.p.ranges());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2, table.y + table.height - 4, { steps: 8 });
    await page.mouse.move(box.x + 2, table.y + table.height + 30, { steps: 4 });
    await page.waitForTimeout(1500);
    const scrolled = await page.evaluate(
      () => document.querySelector("#p").scrollTop,
    );
    await page.mouse.move(box.x + 2, table.y + table.height - 60, { steps: 6 });
    await settle(page, 6);
    const target = await page.evaluate(() => window.__api.p.fillTo());
    await page.mouse.up();
    await settle(page, 6);
    const fill = await page.evaluate(() => window.__api.p.lastFill);
    out.push({
      name: "자동 스크롤 — 창 밖 행까지 넓힘",
      pass: scrolled > 10 * ROW && fill?.to > 20,
      detail: `scrollTop ${scrolled} · 끝 행 ${fill?.to} (놓기 직전 ${target})`,
    });
    out.push({
      name: "손잡이 요소가 창 밖으로 나가 해제돼도 끌기가 이어짐",
      pass: !!fill && fill.lostHandle === true && fill.to > 20,
      detail: JSON.stringify(fill),
    });
    // 정답: r4..r[to] 의 c1 · c2 = r2 · r3 의 값이 번갈아 (값 복사).
    const to = fill?.to ?? 0;
    const want = (r) => (r % 2 === 0 ? ["2:1", "2:2"] : ["3:1", "3:2"]);
    let bad = [];
    for (let r = 4; r <= to; r++) {
      const have = [
        await value(page, `r${r}`, "c1"),
        await value(page, `r${r}`, "c2"),
      ];
      if (have[0] !== want(r)[0] || have[1] !== want(r)[1])
        bad.push(`r${r}=${have}`);
    }
    const next = [
      await value(page, `r${to + 1}`, "c1"),
      await value(page, "r4", "c3"),
    ];
    out.push({
      name: "채운 값이 정답과 같음 (넓힌 칸만 · 다른 열 그대로)",
      pass:
        to > 4 &&
        bad.length === 0 &&
        next[0] === `${to + 1}:1` &&
        next[1] === "4:3",
      detail: bad.length
        ? bad.slice(0, 4).join(" ")
        : `r4..r${to} 정답 · ${JSON.stringify(next)}`,
    });
    const after = await page.evaluate(() => window.__api.p.ranges());
    out.push({
      name: "손잡이 끌기가 범위 선택을 바꾸지 않음 (범위 끌기와 갈림)",
      pass: JSON.stringify(before) === JSON.stringify(after),
      detail: JSON.stringify(after),
    });
    // 칸에서 시작한 끌기는 범위 선택 그대로 (ADR-315).
    await page.evaluate(() => (document.querySelector("#p").scrollTop = 0));
    // (RAC 는 스크롤이 끝난 뒤 300 ms 동안 내용의 pointer 를 끈다 — 사람의 클릭도 같다.)
    await page.waitForTimeout(450);
    const a = await cell(page, "r5", "c4").boundingBox();
    const b = await cell(page, "r7", "c5").boundingBox();
    await page.mouse.move(a.x + 10, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + 10, b.y + 10, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    const ranges = await page.evaluate(() => window.__api.p.ranges());
    out.push({
      name: "칸에서 시작한 끌기는 범위 선택",
      pass:
        JSON.stringify(ranges.at(-1)) ===
        JSON.stringify({
          anchor: { row: "r5", column: "c4" },
          focus: { row: "r7", column: "c5" },
        }),
      detail: JSON.stringify(ranges.at(-1)),
    });
  },

  // P4 — 줄무늬 짝 · 홀이 화면 순서와 같은가 (가상 표 스크롤 · 정렬 · 비가상).
  async p4(page, out) {
    const check = async (label) => {
      const seen = await page.evaluate(() => {
        const shown = window.__api.p.rows().map((row) => row.id);
        const index = new Map(shown.map((id, i) => [id, i]));
        return [...document.querySelectorAll("#p [role=row][data-key]")]
          .map((row) => {
            const box = (
              row.parentElement.getAttribute("role") === "presentation"
                ? row.parentElement
                : row
            ).getBoundingClientRect();
            const first = row.querySelector("[role=gridcell],[role=rowheader]");
            return {
              key: row.dataset.key,
              top: box.top,
              stripe: row.dataset.stripe,
              want: index.get(row.dataset.key) % 2 ? "odd" : "even",
              bg: first ? getComputedStyle(first).backgroundColor : null,
            };
          })
          .sort((x, y) => x.top - y.top);
      });
      const wrong = seen.filter((row) => row.stripe !== row.want);
      const alternates = seen.every(
        (row, i) => i === 0 || row.stripe !== seen[i - 1].stripe,
      );
      const paint = seen.every(
        (row) =>
          row.bg ===
          (row.stripe === "odd" ? "rgb(243, 243, 243)" : "rgb(255, 255, 255)"),
      );
      out.push({
        name: `${label} — 짝 · 홀 = 데이터 순서 · 화면에서 번갈아 · 칠`,
        pass: seen.length > 3 && !wrong.length && alternates && paint,
        detail: `행 ${seen.length} · 틀림 ${wrong.length} · 번갈아 ${alternates} · 칠 ${paint} · 첫 ${seen[0]?.key}`,
      });
    };
    await page.evaluate(() => window.__mount({}));
    await check("가상 · 처음");
    await page.evaluate(
      () => (document.querySelector("#p").scrollTop = 1234 * 40 + 17),
    );
    await settle(page, 6);
    await check("가상 · 스크롤 1234 행");
    await page.evaluate(() => window.__api.p.sort(true));
    await settle(page, 6);
    await check("가상 · 내림차순 정렬 뒤");
    await page.evaluate(
      () => (document.querySelector("#p").scrollTop = 7 * 40),
    );
    await settle(page, 6);
    await check("가상 · 정렬 뒤 위로 스크롤");
    await page.evaluate(() => window.__mount({ virtual: false, count: 40 }));
    await check("비가상 40 행");
  },
};

const NAMES = ["p1", "p2", "p4"].filter((name) => !ONLY || ONLY.includes(name));
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
    await page.goto(URL_BASE);
    await page.waitForFunction(() => typeof window.__mount === "function");
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
      await CHECKS[name](page, out, browser, context);
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

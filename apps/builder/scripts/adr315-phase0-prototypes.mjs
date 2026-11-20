#!/usr/bin/env node
// ADR-315 Phase 0 — 시제품 S1 ~ S6 의 go / no-go 를 실제 브라우저에서 판정한다.
//   node apps/builder/scripts/adr315-phase0-prototypes.mjs <out-dir> [--only s1v,s2] [--browser chrome|webkit]
// `adr315Prototypes.mjs` 를 lib build 해 빈 페이지에 올리고 (설치된 RAC 1.22.1 — 제품과 같은 패키지),
// 판정값은 브라우저의 좌표 (`getBoundingClientRect` · `elementFromPoint`) · DOM 속성 · 접근성 트리다
// (Q5 — 시제품 자신의 상태로 채점하지 않는다. 상태를 읽는 줄은 조작이 닿았는지 확인하는 용도).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr315-phase0";
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
      entry: `${REPO}/apps/builder/scripts/adr315Prototypes.mjs`,
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
  `<!doctype html><meta charset="utf-8"><title>adr315</title>
<style>body{margin:0;font:14px system-ui}</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;</script>`,
);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const file = join(`${OUT}/site`, path === "/" ? "index.html" : path);
  if (path === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type":
      { ".js": "text/javascript", ".html": "text/html", ".css": "text/css" }[
        extname(file)
      ] ?? "application/octet-stream",
  });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const URL_BASE = `http://127.0.0.1:${server.address().port}/`;

const ROW = 40;
const HEAD = 40;
const COL = 120;
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

/** Two frames + a microtask round — a scroll's rows are drawn. */
const settle = (page, frames = 3) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const tick = (left) =>
          left ? requestAnimationFrame(() => tick(left - 1)) : resolve();
        tick(n);
      }),
    frames,
  );
const scrollTo = async (page, id, left, top) => {
  await page.evaluate(
    ([sel, x, y]) => {
      const el = document.querySelector(sel);
      if (x != null) el.scrollLeft = x;
      if (y != null) el.scrollTop = y;
    },
    [id, left, top],
  );
  await settle(page, 4);
};
/** The table's box and, per drawn row (top to bottom), its key · box · cells. */
const snapshot = (page, id) =>
  page.evaluate((sel) => {
    const table = document.querySelector(sel);
    const box = table.getBoundingClientRect();
    const view = {
      left: box.left + table.clientLeft,
      top: box.top + table.clientTop,
      right: box.left + table.clientLeft + table.clientWidth,
      bottom: box.top + table.clientTop + table.clientHeight,
      scrollLeft: table.scrollLeft,
      scrollTop: table.scrollTop,
      scrollWidth: table.scrollWidth,
      scrollHeight: table.scrollHeight,
      clientWidth: table.clientWidth,
      clientHeight: table.clientHeight,
    };
    // (가상 표는 칸마다 `role=presentation` 감싸개가 있다 — 칸은 role 로 찾는다.)
    const cellsOf = (row) =>
      [
        ...row.querySelectorAll(
          "[role=gridcell],[role=rowheader],[role=columnheader]",
        ),
      ].map((cell) => {
        const r = cell.getBoundingClientRect();
        return {
          text: cell.textContent,
          role: cell.getAttribute("role"),
          pin: cell.dataset.pin ?? null,
          selected: cell.getAttribute("aria-selected"),
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        };
      });
    const rows = [...table.querySelectorAll("[role=row]")].map((row) => {
      // (가상 표의 행 요소는 높이가 0 이다 — 칸이 absolute. 행의 상자는 감싸개의 것.)
      const r = (
        row.parentElement.getAttribute("role") === "presentation"
          ? row.parentElement
          : row
      ).getBoundingClientRect();
      return {
        key: row.dataset.key ?? null,
        header: Boolean(row.closest("thead, [role=rowgroup]:first-child")),
        pinRow: row.dataset.pinRow ?? null,
        level: row.getAttribute("aria-level"),
        expanded: row.getAttribute("aria-expanded"),
        pending: row.hasAttribute("data-row-pending"),
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        cells: cellsOf(row),
      };
    });
    return { view, rows };
  }, id);
// (RAC 는 스크롤 중 내용의 pointer event 를 끈다 — hit test 는 스크롤이 끝난 뒤에.)
const hit = async (page, x, y) => {
  await page.waitForTimeout(600);
  return hitNow(page, x, y);
};
const hitNow = (page, x, y) =>
  page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py);
      const cell = el?.closest(
        "[role=gridcell],[role=rowheader],[role=columnheader]",
      );
      return cell ? cell.textContent : (el?.tagName ?? null);
    },
    [x, y],
  );

// ---------------------------------------------------------------------------------------------
const CHECKS = {
  /** S1 — 고정 열. `id` 로 가상 · 비가상을 같이 판정한다. */
  async pinColumns(page, id, out) {
    const pinnedAt = async (label) => {
      const { view, rows } = await snapshot(page, id);
      const head = rows.find((row) =>
        row.cells.some((c) => c.role === "columnheader"),
      );
      const body = rows.filter(
        (row) =>
          !row.cells.some((c) => c.role === "columnheader") &&
          row.bottom > view.top + HEAD + 1 &&
          row.top < view.bottom - 1 &&
          row.cells.length,
      );
      const judge = (row) => {
        const start = row.cells.filter((c) => c.pin === "start");
        const end = row.cells.filter((c) => c.pin === "end");
        return {
          start: start.map((c) => Math.round(c.left - view.left)),
          end: end.map((c) => Math.round(view.right - c.right)),
          tops: [...start, ...end].map((c) => Math.round(c.top - row.top)),
          cells: row.cells.length,
        };
      };
      return {
        label,
        view,
        head: judge(head),
        body: body.map(judge),
        bodyRows: body.length,
      };
    };
    const expect = (name, state, startWant, endWant) => {
      const rows = [state.head, ...state.body];
      const ok =
        state.bodyRows > 5 &&
        rows.every(
          (row) =>
            row.start.length === startWant.length &&
            row.start.every((x, i) => near(x, startWant[i])) &&
            row.end.length === endWant.length &&
            row.end.every((x, i) => near(x, endWant[i])) &&
            row.tops.every((y) => near(y, 0)),
        );
      out.push({
        name,
        pass: ok,
        detail: ok
          ? `${state.bodyRows} 행 · 머리글 포함 start ${JSON.stringify(state.head.start)} end ${JSON.stringify(state.head.end)} · 행의 칸 ${state.body[0]?.cells}`
          : JSON.stringify({
              head: state.head,
              first: state.body[0],
              rows: state.bodyRows,
            }),
      });
    };
    expect("처음 (가로 0)", await pinnedAt("0"), [0, COL], [0]);
    await scrollTo(page, id, 1000, null);
    const mid = await pinnedAt("1000");
    expect("가로 1000", mid, [0, COL], [0]);
    // 고정 열이 가운데 열 위에 그려지는가 — 실제 hit test.
    const over = await hit(page, mid.view.left + 60, mid.view.top + HEAD + 20);
    const overEnd = await hit(
      page,
      mid.view.right - 60,
      mid.view.top + HEAD + 20,
    );
    out.push({
      name: "고정 열이 스크롤된 칸 위에 그려짐 (hit test)",
      pass: /:0$/.test(over ?? "") && /:29$/.test(overEnd ?? ""),
      detail: `start 자리 = ${over} · end 자리 = ${overEnd}`,
    });
    await scrollTo(page, id, 1000, 20000);
    expect("가로 1000 · 세로 20000", await pinnedAt("v"), [0, COL], [0]);
    await scrollTo(page, id, 1e6, null);
    const last = await pinnedAt("max");
    expect("가로 끝", last, [0, COL], [0]);
    await page.evaluate(
      (name) =>
        window.__api[name].setPin({ start: ["c0"], end: ["c28", "c29"] }),
      id.slice(1),
    );
    await settle(page, 4);
    await scrollTo(page, id, 600, 0);
    expect(
      "고정 바꿈 (앞 1 · 뒤 2) · 가로 600",
      await pinnedAt("re"),
      [0],
      [COL, 0],
    );
  },
  async s1v(page, out) {
    await page.evaluate(() => window.__mount("s1v"));
    await settle(page, 4);
    await CHECKS.pinColumns(page, "#s1v", out);
    const { rows } = await snapshot(page, "#s1v");
    const widest = Math.max(...rows.map((row) => row.cells.length));
    out.push({
      name: "가로 가상화 유지 (행의 칸 수 < 열 30)",
      pass: widest < 20,
      detail: `행의 칸 최대 ${widest}`,
    });
  },
  async s1p(page, out) {
    await page.evaluate(() => window.__mount("s1p"));
    await settle(page, 4);
    await CHECKS.pinColumns(page, "#s1p", out);
  },

  async s2(page, out) {
    const run = async (groups, children, label) => {
      await page.evaluate(
        ([g, c]) => window.__mount("s2", { groups: g, children: c }),
        [groups, children],
      );
      await settle(page, 6);
      let snap = await snapshot(page, "#s2");
      out.push({
        name: `${label} 접힘: 스크롤 높이 = 머리글 + 묶음 × 행`,
        pass: near(
          snap.view.scrollHeight,
          Math.max(snap.view.clientHeight, HEAD + groups * ROW),
          2,
        ),
        detail: `${snap.view.scrollHeight} (기대 ${Math.max(snap.view.clientHeight, HEAD + groups * ROW)})`,
      });
      const t0 = Date.now();
      await page.evaluate(() => window.__api.s2.expandAll());
      await settle(page, 8);
      const expandMs = Date.now() - t0;
      snap = await snapshot(page, "#s2");
      const total = groups * (children + 1);
      out.push({
        name: `${label} 모두 펼침: 스크롤 높이 = 머리글 + (묶음 + 자식) × 행`,
        pass: near(snap.view.scrollHeight, HEAD + total * ROW, 2),
        detail: `${snap.view.scrollHeight} (기대 ${HEAD + total * ROW}) · 펼침 ${expandMs} ms`,
      });
      // 가운데로: 보이는 행의 key 순서가 손계산 (평탄화한 순서) 과 같고 빈 행 0.
      const top = Math.floor((total * ROW) / 2 / ROW) * ROW + 13 * ROW;
      await scrollTo(page, "#s2", null, top);
      await settle(page, 6);
      snap = await snapshot(page, "#s2");
      const body = snap.rows
        .filter(
          (row) =>
            row.top >= snap.view.top + HEAD - 1 &&
            row.bottom <= snap.view.bottom + 1,
        )
        .sort((a, b) => a.top - b.top);
      const first = Math.round(
        (body[0].top - (snap.view.top + HEAD) + snap.view.scrollTop) / ROW,
      );
      const want = (flat) => {
        const g = Math.floor(flat / (children + 1));
        const r = flat % (children + 1);
        return r === 0
          ? { text: `Group ${g}`, level: "1" }
          : { text: `${g}:${r - 1}`, level: "2" };
      };
      const wrong = body.filter((row, i) => {
        const w = want(first + i);
        return (
          !row.cells.length ||
          !row.cells[0].text.endsWith(w.text) ||
          row.level !== w.level
        );
      });
      out.push({
        name: `${label} 가운데 스크롤: 순서 · 단계 손계산 일치 · 빈 행 0`,
        pass: body.length > 8 && wrong.length === 0,
        detail: `보이는 행 ${body.length} · 어긋남 ${wrong.length} · DOM 행 ${snap.rows.length}${wrong[0] ? ` · 예 ${JSON.stringify({ t: wrong[0].cells[0]?.text, l: wrong[0].level })}` : ""}`,
      });
      return snap;
    };
    await run(1000, 10, "1,000 묶음 × 10");
    // 키보드 · 표시 버튼으로 접기 / 펼치기 (RAC 의 것 그대로).
    // (보이는 묶음 행을 고른다 — DOM 의 첫 묶음 행은 화면 밖 overscan 행일 수 있다.)
    const groupKey = await page.evaluate(() => {
      const table = document.querySelector("#s2");
      const box = table.getBoundingClientRect();
      return [...table.querySelectorAll('[role=row][aria-level="1"]')].find(
        (row) => {
          const top = row.parentElement.getBoundingClientRect().top;
          return top > box.top + 80 && top < box.bottom - 80;
        },
      )?.dataset.key;
    });
    const groupRow = page.locator(`#s2 [role=row][data-key="${groupKey}"]`);
    const before = (await snapshot(page, "#s2")).view.scrollHeight;
    await groupRow.focus();
    await page.keyboard.press("ArrowLeft");
    await settle(page, 6);
    const afterKey = (await snapshot(page, "#s2")).view.scrollHeight;
    out.push({
      name: "키보드 ← 로 묶음 접기 (스크롤 높이 − 자식 10 행)",
      pass: near(before - afterKey, 10 * ROW, 2),
      detail: `${before} → ${afterKey}`,
    });
    const collapsed = await groupRow.getAttribute("aria-expanded");
    await groupRow.locator("button").click();
    await settle(page, 6);
    const afterClick = (await snapshot(page, "#s2")).view.scrollHeight;
    out.push({
      name: "표시 버튼 클릭으로 다시 펼치기",
      pass: collapsed === "false" && near(afterClick, before, 2),
      detail: `${afterKey} → ${afterClick} · 접힌 행 aria-expanded=${collapsed}`,
    });
    await page.evaluate(() => window.__api.s2.unmount());
    // 접힌 묶음 행의 접근성: 자식 Row 를 collection 에 두는 방식마다 `aria-expanded` · → 키.
    for (const [mode, want] of [
      ["rows", "false"],
      ["placeholder", "false"],
      ["none", null],
    ]) {
      await page.evaluate(
        (m) =>
          window.__mount("s2", { groups: 200, children: 10, collapsed: m }),
        mode,
      );
      await settle(page, 6);
      const row = page.locator('#s2 [role=row][data-key="g2"]');
      const attr = await row.getAttribute("aria-expanded");
      const h0 = (await snapshot(page, "#s2")).view.scrollHeight;
      await row.focus();
      await page.keyboard.press("ArrowRight");
      await settle(page, 6);
      const h1 = (await snapshot(page, "#s2")).view.scrollHeight;
      const opened = await row.getAttribute("aria-expanded");
      out.push({
        name: `접힌 묶음 행 — 자식 Row 「${mode}」: aria-expanded=${want} · → 키로 펼침${want === null ? " (RAC 가 붙이지 않음 — 기록)" : ""}`,
        pass:
          attr === want &&
          (want === null
            ? h1 === h0
            : near(h1 - h0, 10 * ROW, 2) && opened === "true"),
        detail: `접힘 aria-expanded=${attr} · → 뒤 ${opened} · 높이 ${h0} → ${h1}`,
      });
      await page.evaluate(() => window.__api.s2.unmount());
    }
    await run(5, 2000, "5 묶음 × 2,000");
    await page.evaluate(() => window.__api.s2.unmount());
    await run(100, 100, "100 묶음 × 100");
  },

  async pinRows(page, id, total, top, bottom, out) {
    const read = async () => {
      const { view, rows } = await snapshot(page, id);
      const body = rows.filter(
        (row) => !row.cells.some((c) => c.role === "columnheader"),
      );
      const pinTop = body
        .filter((row) => row.pinRow === "top")
        .sort((a, b) => a.top - b.top);
      const pinBottom = body
        .filter((row) => row.pinRow === "bottom")
        .sort((a, b) => a.top - b.top);
      return {
        view,
        top: pinTop.map((row) => ({
          text: row.cells[0]?.text,
          y: Math.round(row.top - view.top),
        })),
        bottom: pinBottom.map((row) => ({
          text: row.cells[0]?.text,
          y: Math.round(view.bottom - row.bottom),
        })),
        rest: body.filter(
          (row) =>
            !row.pinRow && row.bottom > view.top && row.top < view.bottom,
        ).length,
      };
    };
    const expect = (name, state) => {
      const ok =
        state.top.length === top.length &&
        state.top.every(
          (row, i) => row.text === `${top[i]}:0` && near(row.y, HEAD + i * ROW),
        ) &&
        state.bottom.length === bottom.length &&
        state.bottom.every(
          (row, i) =>
            row.text === `${bottom[i]}:0` &&
            near(row.y, (bottom.length - 1 - i) * ROW),
        ) &&
        state.rest > 5;
      out.push({
        name,
        pass: ok,
        detail: JSON.stringify({
          top: state.top,
          bottom: state.bottom,
          rest: state.rest,
        }),
      });
    };
    const first = await read();
    expect("처음 (세로 0)", first);
    out.push({
      name: "스크롤 높이 = 머리글 + 전체 행",
      pass: near(first.view.scrollHeight, HEAD + total * ROW, 2),
      detail: `${first.view.scrollHeight} (기대 ${HEAD + total * ROW})`,
    });
    await scrollTo(page, id, null, Math.floor(total / 2) * ROW);
    const mid = await read();
    expect("세로 가운데", mid);
    const over = await hit(page, mid.view.left + 40, mid.view.top + HEAD + 20);
    const under = await hit(page, mid.view.left + 40, mid.view.bottom - 20);
    out.push({
      name: "고정 행이 스크롤된 행 위에 그려짐 (hit test)",
      pass: over === `${top[0]}:0` && under === `${bottom.at(-1)}:0`,
      detail: `위 = ${over} · 아래 = ${under}`,
    });
    await scrollTo(page, id, null, 1e7);
    expect("세로 끝", await read());
  },
  async s3v(page, out) {
    await page.evaluate(() => window.__mount("s3v"));
    await settle(page, 4);
    await CHECKS.pinRows(page, "#s3v", 2000, [700, 5], [1500], out);
    const { rows } = await snapshot(page, "#s3v");
    out.push({
      name: "가상화 유지 (DOM 행 < 60)",
      pass: rows.length < 60,
      detail: `DOM 행 ${rows.length}`,
    });
  },
  async s3p(page, out) {
    await page.evaluate(() => window.__mount("s3p"));
    await settle(page, 4);
    await CHECKS.pinRows(page, "#s3p", 300, [200, 5], [150], out);
  },

  async s4(page, out) {
    await page.evaluate(() => window.__mount("s4"));
    await settle(page, 4);
    const sorts = () =>
      page.evaluate(() =>
        window.__api.s4
          .sorts()
          .map((s) => `${s.column}${s.direction === "ascending" ? "+" : "-"}`)
          .join(","),
      );
    const marks = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("#s4 [role=columnheader]")]
          .map(
            (el) =>
              `${el.getAttribute("aria-sort") ?? ""}|${el.querySelector("[data-sort-order]")?.textContent.trim() ?? ""}`,
          )
          .join(" "),
      );
    const head = (n) => page.locator("#s4 [role=columnheader]").nth(n);
    const step = async (name, action, want) => {
      await action();
      await settle(page, 2);
      const got = await sorts();
      out.push({
        name,
        pass: got === want,
        detail: `${got} (기대 ${want}) · ${await marks()}`,
      });
    };
    await step("클릭 c1", () => head(1).click(), "c1+");
    await step(
      "Shift 클릭 c3 — 추가",
      () => head(3).click({ modifiers: ["Shift"] }),
      "c1+,c3+",
    );
    await step(
      "Shift 클릭 c3 — 방향 뒤집기",
      () => head(3).click({ modifiers: ["Shift"] }),
      "c1+,c3-",
    );
    await step(
      "Shift 클릭 c1 (첫 정렬) — 방향 뒤집기",
      () => head(1).click({ modifiers: ["Shift"] }),
      "c1-,c3-",
    );
    await step("클릭 c2 — 한 열로", () => head(2).click(), "c2+");
    await step(
      "키보드 Enter c4",
      async () => {
        await head(4).focus();
        await page.keyboard.press("Enter");
      },
      "c4+",
    );
    await step(
      "키보드 Shift+Enter c5 — 추가",
      async () => {
        await head(5).focus();
        await page.keyboard.press("Shift+Enter");
      },
      "c4+,c5+",
    );
    const shown = await marks();
    out.push({
      name: "순번 · 방향 표시 (우리 요소) 가 정렬 열마다",
      pass: /\|1▲/.test(shown) && /\|2▲/.test(shown),
      detail: shown,
    });
    const aria = await page.evaluate(() =>
      [...document.querySelectorAll("#s4 [role=columnheader]")]
        .map((el) => el.getAttribute("aria-sort"))
        .filter((v) => v && v !== "none"),
    );
    out.push({
      name: "aria-sort 는 첫 정렬 열 하나",
      pass: aria.length === 1,
      detail: JSON.stringify(aria),
    });
  },

  async s5(page, out, browser) {
    await page.evaluate(() => window.__mount("s5"));
    await settle(page, 4);
    const order = () => page.evaluate(() => window.__api.s5.order().join(","));
    const heads = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("#s5 [role=columnheader]")]
          .sort(
            (a, b) =>
              a.getBoundingClientRect().left - b.getBoundingClientRect().left,
          )
          .map((el) => /Col (\d+)/.exec(el.textContent)?.[1])
          .join(","),
      );
    const cellsInRow = () =>
      page.evaluate(
        () =>
          document
            .querySelector("#s5 [role=row][data-key]")
            ?.querySelectorAll("[role=gridcell],[role=rowheader]").length,
      );
    const menu = async (column, item) => {
      await page.locator(`#s5 [data-menu=${column}]`).click();
      await page.getByRole("menuitem", { name: item }).click();
      await settle(page, 4);
    };
    await menu("c2", "Hide column");
    out.push({
      name: "열 메뉴 「숨기기」 — 머리글 · 행의 칸이 같이 빠짐",
      pass: (await heads()) === "0,1,3,4,5,6,7" && (await cellsInRow()) === 7,
      detail: `머리글 ${await heads()} · 행의 칸 ${await cellsInRow()}`,
    });
    await menu("c4", "Move left");
    out.push({
      name: "열 메뉴 「왼쪽으로」",
      pass: (await heads()) === "0,1,4,3,5,6,7",
      detail: await heads(),
    });
    await menu("c0", "Hide column");
    out.push({
      name: "row header 열은 숨기지 않음 (RAC 불변식)",
      pass: (await heads()) === "0,1,4,3,5,6,7",
      detail: await heads(),
    });
    out.push({
      name: "메뉴 조작이 정렬을 일으키지 않음",
      pass: (await page.evaluate(() => window.__api.s5.sorted())) === null,
      detail: JSON.stringify(
        await page.evaluate(() => window.__api.s5.sorted()),
      ),
    });
    // 정렬은 그대로 동작 (끌기 앞).
    const sortClick = async () => {
      // (머리글의 빈 자리 — 손잡이 · 메뉴 버튼이 아닌 곳.)
      const headBox = await page
        .locator("#s5 [role=columnheader]")
        .nth(1)
        .boundingBox();
      await page.mouse.click(
        headBox.x + headBox.width - 6,
        headBox.y + headBox.height / 2,
      );
      await settle(page, 3);
      return page.evaluate(() => JSON.stringify(window.__api.s5.sorted()));
    };
    const sortedBefore = await sortClick();
    out.push({
      name: "머리글의 빈 자리 클릭은 정렬 (끌기 앞)",
      pass: sortedBefore !== "null",
      detail: sortedBefore,
    });
    // 끌기 (포인터): 손잡이 c6 → c1 머리글.
    let dragError = null;
    try {
      // (실제 마우스 이동으로 — native drag 는 mousedown 뒤 이동이 몇 번 있어야 시작한다.)
      const from = await page
        .locator("#s5 [data-drag-handle=c6]")
        .boundingBox();
      const to = await page.locator("#s5 [data-drop-target=c1]").boundingBox();
      // (요소의 정중앙을 누르지 않는다 — react-aria 는 정중앙 pointerdown 을 화면 낭독기의 가상
      //  끌기로 본다: `useDrag` 의 TalkBack 판정.)
      await page.mouse.move(from.x + 3, from.y + from.height / 2 - 4);
      await page.mouse.down();
      await page.mouse.move(from.x - 20, from.y + from.height / 2, {
        steps: 5,
      });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 12,
      });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await settle(page, 6);
    } catch (error) {
      dragError = String(error).split("\n")[0];
    }
    out.push({
      name: `머리글 끌기 (포인터) c6 → c1 앞 [${browser}]`,
      pass: (await heads()) === "0,6,1,4,3,5,7",
      detail: `${await heads()}${dragError ? ` · ${dragError}` : ""}`,
    });
    // 끌기 (키보드): 손잡이에서 Enter → Tab 으로 대상 → Enter (react-aria 의 키보드 끌기).
    const beforeKey = await heads();
    await page.locator("#s5 [data-drag-handle=c7]").focus();
    await page.keyboard.press("Enter");
    await settle(page, 3);
    const started = await page.evaluate(() =>
      Boolean(document.querySelector("#s5 [data-drag-handle][data-dragging]")),
    );
    if (process.argv.includes("--debug"))
      process.stdout.write(
        `    debug: ${JSON.stringify(
          await page.evaluate(() => ({
            active: document.activeElement?.outerHTML.slice(0, 160),
            live: [...document.querySelectorAll("[aria-live]")]
              .map((el) => el.textContent)
              .join("|"),
            focused: document.hasFocus(),
          })),
        )}\n`,
      );
    await page.keyboard.press("Tab");
    await settle(page, 2);
    const target = await page.evaluate(
      () => document.activeElement?.dataset.dropTarget ?? null,
    );
    await page.keyboard.press("Enter");
    await settle(page, 6);
    const afterKey = await heads();
    out.push({
      name: `머리글 끌기 (키보드) c7 → Tab 한 번의 대상 [${browser}]`,
      pass:
        started && afterKey !== beforeKey && afterKey.split(",").length === 7,
      detail: `${beforeKey} → ${afterKey} (끌기 시작 ${started} · 대상 ${target})`,
    });
    const sortedAfterDrag = await page.evaluate(() =>
      JSON.stringify(window.__api.s5.sorted()),
    );
    out.push({
      name: "끌기가 정렬을 바꾸지 않음",
      pass: sortedAfterDrag === sortedBefore,
      detail: sortedAfterDrag,
    });
    const first = await sortClick();
    const second = first === sortedAfterDrag ? await sortClick() : first;
    out.push({
      // (WebKit: 키보드 끌기를 놓은 직후의 첫 포인터 클릭 하나가 먹지 않는다 — 기록, Phase 4 에서 다시 본다.)
      name: `끌기 뒤에도 머리글 클릭은 정렬 [${browser}]`,
      pass: second !== sortedAfterDrag,
      detail:
        first !== sortedAfterDrag
          ? `첫 클릭 ${first}`
          : `첫 클릭은 먹지 않음 · 둘째 클릭 ${second}`,
    });
  },

  async s6(page, out, browser, context) {
    await page.evaluate(() => window.__mount("s6"));
    await settle(page, 4);
    const mod = "Meta";
    const selected = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("#s6 [data-cell][aria-selected=true]")]
          .map((el) => el.dataset.cell)
          .sort()
          .join(" "),
      );
    const active = () =>
      page.evaluate(
        () =>
          document.activeElement?.dataset.cell ??
          document.activeElement?.getAttribute("role"),
      );
    const cell = (row, column) =>
      page.locator(`#s6 [data-cell="${row}|${column}"]`);
    const box = (rows, cols) =>
      rows
        .flatMap((r) => cols.map((c) => `r${r}|c${c}`))
        .sort()
        .join(" ");
    const step = async (name, action, want, focus) => {
      await action();
      await settle(page, 3);
      const got = await selected();
      const at = await active();
      const ok = got === want && (focus === undefined || at === focus);
      out.push({
        name,
        pass: ok,
        detail: ok
          ? `선택 ${got.split(" ").filter(Boolean).length} 칸 · focus ${at}`
          : `선택 [${got}] 기대 [${want}] · focus ${at} 기대 ${focus}`,
      });
    };
    out.push({
      name: "grid 에 aria-multiselectable",
      pass:
        (await page.locator("#s6").getAttribute("aria-multiselectable")) ===
        "true",
      detail: `role=${await page.locator("#s6").getAttribute("role")}`,
    });
    await step(
      "칸 클릭 — 한 칸 · 그 칸에 focus",
      () => cell("r2", "c1").click(),
      box([2], [1]),
      "r2|c1",
    );
    await step(
      "Shift + → → ↓ ↓ — 3 × 3",
      async () => {
        for (const key of [
          "ArrowRight",
          "ArrowRight",
          "ArrowDown",
          "ArrowDown",
        ])
          await page.keyboard.press(`Shift+${key}`);
      },
      box([2, 3, 4], [1, 2, 3]),
      "r4|c3",
    );
    await step(
      "↓ (Shift 없음) — 한 칸으로",
      () => page.keyboard.press("ArrowDown"),
      box([5], [3]),
      "r5|c3",
    );
    await step(
      "Shift 클릭 — 범위 확장",
      () => cell("r8", "c4").click({ modifiers: ["Shift"] }),
      box([5, 6, 7, 8], [3, 4]),
    );
    await step(
      "Cmd 클릭 — 범위 추가",
      () => cell("r1", "c0").click({ modifiers: [mod] }),
      [...box([5, 6, 7, 8], [3, 4]).split(" "), "r1|c0"].sort().join(" "),
    );
    await page.keyboard.press(`${mod}+c`);
    await settle(page, 2);
    const copied = await page.evaluate(() => window.__api.s6.copied());
    out.push({
      name: "Cmd + C — 마지막 범위의 값 (탭 구분)",
      pass: copied === "1:0",
      detail: JSON.stringify(copied),
    });
    await step(
      "끌어 범위",
      async () => {
        const from = await cell("r2", "c1").boundingBox();
        const to = await cell("r4", "c2").boundingBox();
        await page.mouse.move(from.x + 10, from.y + 10);
        await page.mouse.down();
        await page.mouse.move(to.x + 10, to.y + 10, { steps: 6 });
        await page.mouse.up();
      },
      box([2, 3, 4], [1, 2]),
    );
    await page.keyboard.press(`${mod}+c`);
    await settle(page, 2);
    const copiedBox = await page.evaluate(() => window.__api.s6.copied());
    out.push({
      name: "Cmd + C — 3 × 2 범위",
      pass: copiedBox === "2:1\t2:2\n3:1\t3:2\n4:1\t4:2",
      detail: JSON.stringify(copiedBox),
    });
    // 접근성 트리: 선택 칸이 selected 로 노출되는가.
    if (browser === "chrome") {
      const cdp = await context.newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const cells = nodes.filter((n) =>
        ["gridcell", "rowheader", "cell"].includes(n.role?.value),
      );
      const on = cells.filter((n) =>
        n.properties?.some(
          (p) => p.name === "selected" && p.value.value === true,
        ),
      );
      const grid = nodes.find((n) =>
        ["grid", "treegrid", "table"].includes(n.role?.value),
      );
      out.push({
        name: "접근성 트리 (Chrome): 선택 칸 selected · grid multiselectable",
        pass:
          on.length === 6 &&
          Boolean(
            grid?.properties?.some(
              (p) => p.name === "multiselectable" && p.value.value === true,
            ),
          ),
        detail: `selected 칸 ${on.length} / 칸 ${cells.length} · grid ${grid?.role?.value} ${JSON.stringify(grid?.properties?.filter((p) => p.name === "multiselectable"))}`,
      });
    }
    // 가상 표: 창 밖까지의 범위 — 스크롤한 뒤 Shift 클릭.
    await scrollTo(page, "#s6", null, 1490 * ROW);
    // (좌표로 누른다 — locator.click 의 자동 스크롤이 칸을 sticky 머리글 아래에 둔다: WebKit.)
    const clickAt = async (row, column, shift) => {
      // (스크롤 직후에는 RAC 가 내용의 pointer event 를 꺼 둔다 — `hit` 과 같은 대기.)
      await page.waitForTimeout(600);
      const target = await cell(row, column).boundingBox();
      const top = () =>
        page.evaluate(() => document.querySelector("#s6").scrollTop);
      const before = await top();
      if (shift) await page.keyboard.down("Shift");
      if (process.argv.includes("--debug"))
        process.stdout.write(
          `    debug: scrollTop ${before} → Shift down ${await top()}\n`,
        );
      await page.mouse.click(target.x + 12, target.y + 12);
      if (shift) await page.keyboard.up("Shift");
      await settle(page, 3);
      if (process.argv.includes("--debug"))
        process.stdout.write(
          `    debug: ${JSON.stringify(await page.evaluate(() => ({ ranges: window.__api.s6.ranges(), active: document.activeElement?.dataset.cell ?? document.activeElement?.tagName })))} · 누른 자리 ${JSON.stringify(target)}\n`,
        );
    };
    await clickAt("r1500", "c2", true);
    const far = await page.evaluate(() => {
      const cells = [...document.querySelectorAll("#s6 [data-cell]")];
      const want = (el) => {
        const [row, column] = el.dataset.cell.split("|");
        const r = Number(row.slice(1));
        const c = Number(column.slice(1));
        return r >= 2 && r <= 1500 && c >= 1 && c <= 2;
      };
      return {
        drawn: cells.length,
        wrong: cells.filter(
          (el) => (el.getAttribute("aria-selected") === "true") !== want(el),
        ).length,
        on: cells.filter((el) => el.getAttribute("aria-selected") === "true")
          .length,
      };
    });
    out.push({
      name: "창 밖까지 범위 (r2 → r1500): 그려진 칸의 aria-selected 가 범위와 일치",
      pass: far.wrong === 0 && far.on > 0,
      detail: JSON.stringify(far),
    });
    await page.keyboard.press(`${mod}+c`);
    await settle(page, 2);
    const lines = await page.evaluate(
      () => window.__api.s6.copied()?.split("\n").length,
    );
    out.push({
      name: "창 밖 칸까지 복사 (1,499 줄)",
      pass: lines === 1499,
      detail: `${lines} 줄`,
    });
    await step("Esc — 해제", () => page.keyboard.press("Escape"), "");
    await clickAt("r1495", "c0", false);
    await page.keyboard.press(`${mod}+a`);
    await settle(page, 3);
    const all = await page.evaluate(() => {
      const cells = [...document.querySelectorAll("#s6 [data-cell]")];
      return {
        drawn: cells.length,
        on: cells.filter((el) => el.getAttribute("aria-selected") === "true")
          .length,
      };
    });
    out.push({
      name: "Cmd + A — 그려진 칸 전부 선택",
      pass: all.drawn > 0 && all.drawn === all.on,
      detail: JSON.stringify(all),
    });
  },
};

// `--dump <name>`: 시제품 하나의 DOM 구조만 찍고 끝낸다 (시제품을 고칠 때).
const DUMP = arg("--dump", null);
if (DUMP) {
  const instance = await chromium.launch({ headless: true });
  const page = await instance.newPage();
  page.on("pageerror", (error) =>
    process.stdout.write(`ERR ${String(error).slice(0, 400)}\n`),
  );
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate((name) => window.__mount(name), DUMP);
  await page.waitForTimeout(500);
  const text = await page.evaluate((name) => {
    const out = [];
    const walk = (el, depth) => {
      if (depth > 5) return;
      const attrs = [...el.attributes]
        .filter((a) => !a.name.startsWith("data-rac") && a.name !== "class")
        .map((a) => `${a.name}="${a.value.slice(0, 160)}"`)
        .join(" ");
      out.push(
        `${"  ".repeat(depth)}<${el.tagName.toLowerCase()} ${attrs}> ${el.children.length ? "" : el.textContent.slice(0, 20)}`,
      );
      [...el.children].slice(0, 4).forEach((child) => walk(child, depth + 1));
    };
    walk(document.querySelector(`#${name}`), 0);
    return out.join("\n");
  }, DUMP);
  process.stdout.write(`${text}\n`);
  await instance.close();
  server.close();
  process.exit(0);
}

// `--eval <name> <js>`: 시제품 하나를 올리고 식 하나의 값을 찍는다 (시제품을 고칠 때).
const EVAL = arg("--eval", null);
if (EVAL) {
  const instance = await chromium.launch({ headless: true });
  const page = await instance.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (error) =>
    process.stdout.write(`ERR ${String(error).slice(0, 400)}\n`),
  );
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate((name) => window.__mount(name), EVAL);
  await page.waitForTimeout(400);
  const code = process.argv[process.argv.indexOf("--eval") + 2];
  const value = await page.evaluate(`(async () => { ${code} })()`);
  process.stdout.write(`${JSON.stringify(value, null, 1)}\n`);
  await instance.close();
  server.close();
  process.exit(0);
}

const NAMES = ["s1v", "s1p", "s2", "s3v", "s3p", "s4", "s5", "s6"].filter(
  (name) => !ONLY || ONLY.includes(name),
);
const results = {};
for (const browser of BROWSERS) {
  const instance =
    browser === "webkit"
      ? await webkit.launch({ headless: false })
      : browser === "chromium"
        ? await chromium.launch({ headless: true })
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
    // (판정 줄은 나오는 대로 찍는다 — 멈춘 단계가 보이게.)
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

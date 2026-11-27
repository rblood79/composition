#!/usr/bin/env node
// ADR-320 Phase 0 — 시제품 P1 ~ P4 의 go / no-go 를 실제 브라우저에서 판정한다 (VoiceOver 청취는 사용자).
//   node apps/builder/scripts/adr320-phase0-prototypes.mjs <out-dir> [--only p1,p2,p3,p4] [--browser chrome,webkit]
//   node apps/builder/scripts/adr320-phase0-prototypes.mjs <out-dir> --serve   (청취용 — `#p1` · `#p2` 주소)
// `adr320Prototypes.mjs` (설치된 RAC 위의 작은 필터 바) 를 production lib build 해 빈 페이지에 올린다.
// 판정값은 브라우저의 focus · DOM 속성 · 접근성 트리 · performance.now 이고, 기대값은 이 파일에 따로 적었다.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr320-phase0";
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
      entry: `${REPO}/apps/builder/scripts/adr320Prototypes.mjs`,
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
  `<!doctype html><meta charset="utf-8"><title>adr320</title>
<style>body{margin:16px;font:14px system-ui}
[role=toolbar]{display:flex;gap:8px;align-items:center;margin:8px 0}
[role=group]{display:inline-flex;gap:2px;align-items:center;border:1px solid #999;border-radius:6px;padding:2px 4px}
[role=row]{display:flex;gap:4px;align-items:center;height:32px;padding-left:calc((var(--tree-item-level) - 1) * 24px)}
[role=treegrid]{width:520px;border:1px solid #ccc;margin:8px 0}
[data-drop-target]{outline:2px solid blue}
.react-aria-DropIndicator[data-drop-target]{outline:1px solid blue}
:focus-visible,[data-focus-visible]{outline:2px solid orange}
</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;
if (location.hash.startsWith("#p")) mount({ kind: location.hash.slice(1) });</script>`,
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
  process.stdout.write(
    `청취용 페이지: ${URL_BASE}#p1 (칩 줄) · ${URL_BASE}#p2 (조건 빌더) (Ctrl+C 로 끝)\n`,
  );
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
const mount = async (page, kind) => {
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate((k) => {
    window.__ready = false;
    window.__mount({ kind: k });
  }, kind);
  await page.waitForFunction(() => window.__ready === true);
  await settle(page, 6);
};
/** focus 가 있는 요소의 `data-part` (없으면 가장 가까운 행 · 태그). */
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    return (
      el.getAttribute("data-part") ??
      (el.getAttribute("data-row")
        ? `row:${el.getAttribute("data-row")}`
        : `${el.tagName.toLowerCase()}[${el.getAttribute("role") ?? ""}]`)
    );
  });
const part = (page, name) => page.locator(`[data-part="${name}"]`);
const press = async (page, key, frames = 3) => {
  await page.keyboard.press(key);
  await settle(page, frames);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const state = (page) => page.evaluate(() => window.__state());

const CHECKS = {
  // P1 — 칩 줄: Toolbar > Group > 버튼 넷. 기대값은 breakdown §4 · §7 의 go 기준.
  async p1(page, out, browser) {
    await mount(page, "p1");
    await part(page, "before").focus();
    await press(page, "Tab");
    out.push({
      name: "Tab 으로 들어오면 첫 버튼",
      pass: (await focused(page)) === "c1-op",
      detail: await focused(page),
    });
    const order = [await focused(page)];
    for (let index = 0; index < 9; index += 1) {
      await press(page, "ArrowRight");
      order.push(await focused(page));
    }
    const expected = [
      "c1-op",
      "c1-value",
      "c1-menu",
      "c1-remove",
      "c2-op",
      "c2-value",
      "c2-menu",
      "c2-remove",
      "add",
      "clear",
    ];
    out.push({
      name: "ArrowRight 가 칩을 건너 버튼 10 개를 차례로",
      pass: same(order, expected),
      detail: order.join(" → "),
    });
    await press(page, "Tab");
    const left = await focused(page);
    await press(page, "Shift+Tab");
    const back = await focused(page);
    out.push({
      name: "Tab 한 번에 나가고 Shift+Tab 은 마지막 버튼으로",
      pass: left === "after" && back === "clear",
      detail: `${left} · ${back}`,
    });

    // 비교 메뉴 — 열기 · 고르기 · focus 복귀
    await part(page, "c1-op").focus();
    await press(page, "Enter", 8);
    const menuOpen = await page.locator('[role="menu"]').count();
    await press(page, "ArrowDown");
    await press(page, "Enter", 8);
    out.push({
      name: "비교 메뉴: Enter 로 열고 ↓ Enter 로 고르면 닫히고 focus 가 그 버튼으로",
      pass:
        menuOpen === 1 &&
        (await page.locator('[role="menu"]').count()) === 0 &&
        (await focused(page)) === "c1-op" &&
        (await state(page))[0].op === "contains",
      detail: `열림 ${menuOpen} · focus ${await focused(page)} · op ${(await state(page))[0].op}`,
    });

    // 값 대화상자 — 열기 · 입력 · Esc · focus 복귀
    await part(page, "c1-value").focus();
    await press(page, "Enter", 8);
    const inDialog = await focused(page);
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );
    await page.keyboard.type("부산");
    await settle(page);
    await press(page, "Escape", 8);
    out.push({
      name: "값 대화상자: 열면 입력 칸에 focus, Esc 로 닫으면 값 버튼으로",
      pass:
        inDialog === "c1-input" &&
        (await page.locator('[role="dialog"]').count()) === 0 &&
        (await focused(page)) === "c1-value" &&
        (await state(page))[0].value === "부산",
      detail: `안 ${inDialog} · focus ${await focused(page)} · 값 ${(await state(page))[0].value}`,
    });

    // 조건 메뉴 — 끄기
    await part(page, "c1-menu").focus();
    await press(page, "Enter", 8);
    await press(page, "ArrowDown");
    await press(page, "Enter", 8);
    const label = await page
      .locator('[data-chip="c1"]')
      .getAttribute("aria-label");
    out.push({
      name: "조건 메뉴: 끄기 → 칩 이름에 「꺼짐」, focus 는 메뉴 버튼으로",
      pass:
        (await state(page))[0].enabled === false &&
        /꺼짐$/.test(label ?? "") &&
        (await focused(page)) === "c1-menu",
      detail: `${label} · focus ${await focused(page)}`,
    });

    // 삭제 버튼 — 지운 뒤 focus 가 어디로 가는지 (관찰)
    await part(page, "c2-remove").focus();
    await press(page, "Enter", 8);
    const after = await focused(page);
    out.push({
      name: "삭제 버튼: 칩이 사라짐 (focus 자리는 관찰값)",
      pass: (await state(page)).length === 1,
      detail: `남은 칩 ${(await state(page)).length} · 지운 뒤 focus = ${after}`,
    });
    // 지운 뒤에도 키보드로 이어서 조작할 수 있는가 — Tab 으로 다시 toolbar 에 들어간다
    if (after === "body") {
      await part(page, "before").focus();
      await press(page, "Tab");
    }
    out.push({
      name: "삭제 뒤 toolbar 가 계속 키보드로 닿는다",
      pass: /^(c1-|add|clear)/.test(await focused(page)),
      detail: await focused(page),
    });

    // 접근성 트리
    if (browser === "chrome") {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const byId = new Map(nodes.map((node) => [node.nodeId, node]));
      const toolbar = nodes.find(
        (node) => node.role?.value === "toolbar" && !node.ignored,
      );
      const under = (node, role) => {
        const found = [];
        const walk = (id) => {
          const item = byId.get(id);
          if (!item) return;
          if (!item.ignored && item.role?.value === role) found.push(item);
          (item.childIds ?? []).forEach(walk);
        };
        (node?.childIds ?? []).forEach(walk);
        return found;
      };
      const groups = under(toolbar, "group");
      const buttons = groups.flatMap((group) =>
        under(group, "button").map((button) => button.name?.value),
      );
      out.push({
        name: "Chrome 접근성 트리 — toolbar 「필터」 > group (이름 = 필드 · 비교 · 값) > button 넷 (이름 있음)",
        pass:
          toolbar?.name?.value === "필터" &&
          groups.length === 1 &&
          groups[0].name?.value === "부서 포함 부산 꺼짐" &&
          same(buttons, ["포함", "부산", "조건 메뉴", "삭제"]),
        detail: JSON.stringify({
          toolbar: toolbar?.name?.value,
          groups: groups.map((group) => group.name?.value),
          buttons,
        }),
      });
    } else {
      const snap = await part(page, "toolbar").ariaSnapshot();
      out.push({
        name: "WebKit aria snapshot — toolbar > group > button 이름",
        pass:
          /toolbar "필터"/.test(snap) &&
          /group "부서 포함 부산 꺼짐"/.test(snap) &&
          /button "조건 메뉴"/.test(snap) &&
          /button "삭제"/.test(snap),
        detail: snap.replace(/\n\s*/g, " | "),
      });
    }
  },

  // P2 — 조건 빌더: Tree 행 안 버튼 · 묶음 · 끌기 (포인터 · 키보드)
  async p2(page, out, browser) {
    await mount(page, "p2");
    await part(page, "before").focus();
    await press(page, "Tab");
    const rows = [];
    for (let index = 0; index < 7; index += 1) {
      rows.push(
        await page.evaluate(() => {
          const el = document.activeElement?.closest("[data-row]");
          return `${el?.getAttribute("data-row")}/${el?.getAttribute("aria-level")}`;
        }),
      );
      await press(page, "ArrowDown");
    }
    out.push({
      name: "↓ 가 행을 차례로, 단계 (aria-level) 는 묶음 깊이",
      pass: same(rows, [
        "c1/1",
        "g1/1",
        "c2/2",
        "c3/2",
        "g2/2",
        "c4/3",
        "c5/1",
      ]),
      detail: rows.join(" → "),
    });

    // 조건 행 안의 버튼 — 화살표로 닿는가
    await page.locator('[data-row="c1"]').focus();
    await settle(page);
    const inRow = [];
    for (let index = 0; index < 6; index += 1) {
      await press(page, "ArrowRight");
      inRow.push(await focused(page));
    }
    const leafParts = ["c1-drag", "c1-field", "c1-op", "c1-value", "c1-menu"];
    out.push({
      name: "조건 행: → 로 행 안 버튼 다섯 (끌기 · 필드 · 비교 · 값 · 메뉴) 에 모두 닿음",
      pass: leafParts.every((name) => inRow.includes(name)),
      detail: inRow.join(" → "),
    });

    // 묶음 행 안의 버튼
    await page.locator('[data-row="g1"]').focus();
    await settle(page);
    const inGroup = [];
    for (let index = 0; index < 6; index += 1) {
      await press(page, "ArrowRight");
      inGroup.push(await focused(page));
    }
    out.push({
      name: "묶음 행: → 로 전환 버튼 · 메뉴에 닿음",
      pass: inGroup.includes("g1-toggle") && inGroup.includes("g1-menu"),
      detail: inGroup.join(" → "),
    });
    await part(page, "g1-toggle").focus();
    await press(page, "Enter", 6);
    const toggled = await page.evaluate(() => window.__ops());
    out.push({
      name: "묶음 전환 버튼: Enter → 「또는」 이 「그리고」 로, focus 유지",
      pass: toggled.g1 === "and" && (await focused(page)) === "g1-toggle",
      detail: `${JSON.stringify(toggled)} · focus ${await focused(page)}`,
    });

    // 접근성 트리의 단계
    if (browser === "chrome") {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const grid = nodes.find(
        (node) => node.role?.value === "treegrid" && !node.ignored,
      );
      const levels = nodes
        .filter((node) => node.role?.value === "row" && !node.ignored)
        .map(
          (node) =>
            (node.properties ?? []).find((item) => item.name === "level")?.value
              ?.value,
        );
      out.push({
        name: "Chrome 접근성 트리 — treegrid 「조건」, 행 7 의 단계 1 1 2 2 2 3 1",
        pass:
          grid?.name?.value === "조건" && same(levels, [1, 1, 2, 2, 2, 3, 1]),
        detail: JSON.stringify({ grid: grid?.name?.value, levels }),
      });
    }

    // 포인터 끌기 — 묶음 안으로 · 밖으로 · 순서
    // (행 가장자리에서 EDGE px 안쪽 — 「앞 · 뒤」 구역의 안. `--edge` 로 바꿔 경계 민감도를 본다.)
    const EDGE = Number(arg("--edge", "5"));
    const hovered = [];
    const drag = async (from, to, where) => {
      const start = await part(page, `${from}-drag`).boundingBox();
      const target = await page.locator(`[data-row="${to}"]`).boundingBox();
      const y =
        where === "on"
          ? target.y + target.height / 2
          : where === "before"
            ? target.y + EDGE
            : target.y + target.height - EDGE;
      await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        start.x + start.width / 2 + 6,
        start.y + start.height / 2 + 6,
        { steps: 3 },
      );
      await page.mouse.move(target.x + 200, y, { steps: 12 });
      // (놓을 자리는 마지막 dragover 가 정한다 — 합성 포인터는 마지막 지점에서 멈춘 채 이벤트가
      //  하나 더 오지 않을 수 있어, 사람 손처럼 그 자리에서 1 px 움직였다 돌아온다.)
      await page.waitForTimeout(120);
      await page.mouse.move(target.x + 201, y);
      await page.waitForTimeout(120);
      await page.mouse.move(target.x + 200, y);
      await page.waitForTimeout(120);
      await settle(page, 6);
      hovered.push(
        await page.evaluate(() => {
          const el = document.querySelector("[data-drop-target]");
          return el
            ? (el.getAttribute("data-row") ??
                el.querySelector("[aria-label]")?.getAttribute("aria-label") ??
                el.className)
            : "없음";
        }),
      );
      await page.mouse.up();
      await settle(page, 10);
    };
    await mount(page, "p2");
    await drag("c5", "g1", "on");
    const into = await state(page);
    await drag("c2", "c1", "before");
    const reordered = await state(page);
    await drag("c4", "c1", "after");
    const outOf = await state(page);
    out.push({
      name: "포인터 끌기: c5 를 묶음 g1 안으로",
      pass: into === "c1,g1[c2,c3,g2[c4],c5]",
      detail: into,
    });
    out.push({
      name: "포인터 끌기: 묶음 안의 c2 를 맨 앞으로 (묶음 밖)",
      pass: reordered === "c2,c1,g1[c3,g2[c4],c5]",
      detail: reordered,
    });
    out.push({
      name: "포인터 끌기: 2 단 묶음 안의 c4 를 c1 뒤로 (루트)",
      pass: outOf === "c2,c1,c4,g1[c3,g2[],c5]",
      detail: `${outOf} · 놓기 직전 표시 ${hovered.join(" / ")} · onMove ${(await page.evaluate(() => window.__moves ?? [])).join(" / ")}`,
    });

    // 키보드 끌기 — 끌기 버튼 Enter → 놓을 자리 이동 → Enter
    //   (끌기 버튼은 행 안의 focus 자리라 실제 경로로 간다: 행까지 ↓, 행 안으로 →.)
    await mount(page, "p2");
    await part(page, "before").focus();
    await press(page, "Tab");
    for (let index = 0; index < 6; index += 1) await press(page, "ArrowDown");
    await press(page, "ArrowRight");
    const handle = await focused(page);
    await press(page, "Enter", 8);
    const targets = [];
    let reached = false;
    for (let index = 0; index < 20 && !reached; index += 1) {
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        return (
          el?.getAttribute("aria-label") ??
          el?.closest("[data-row]")?.getAttribute("data-row") ??
          el?.textContent?.slice(0, 40) ??
          ""
        );
      });
      const onRow = await page.evaluate(
        () =>
          document
            .querySelector("[data-row][data-drop-target]")
            ?.getAttribute("data-row") ?? null,
      );
      targets.push(onRow ? `on:${onRow}` : label);
      if (onRow === "g1") {
        reached = true;
        break;
      }
      await press(page, "ArrowUp", 4);
    }
    await press(page, "Enter", 10);
    const byKeyboard = await state(page);
    out.push({
      name: "키보드 끌기: c5 끌기 버튼 Enter → ↑ 로 「g1 안」 → Enter",
      pass:
        handle === "c5-drag" &&
        reached &&
        byKeyboard === "c1,g1[c2,c3,g2[c4],c5]",
      detail: `${byKeyboard} · 시작 ${handle} · 지나온 자리 ${targets.join(" / ")}`,
    });
  },

  // P3 — 「또는」 묶음의 행 필터 계산 시간 (Chrome — CPU throttle = CDP)
  async p3(page, out, browser) {
    if (browser !== "chrome") {
      out.push({
        name: "P3 는 Chrome 에서만 (CPU throttle = CDP)",
        pass: true,
        detail: "skip",
      });
      return;
    }
    await mount(page, "p3");
    const cdp = await page.context().newCDPSession(page);
    const visible = await page.evaluate(() => document.visibilityState);
    const table = {};
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      for (const count of [10_000, 100_000])
        table[`${count}@${rate}x`] = await page.evaluate(
          (n) => window.__p3(n),
          count,
        );
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const wrong = Object.values(table).reduce(
      (sum, item) => sum + item.flatWrong + item.treeWrong,
      0,
    );
    out.push({
      name: "두 경로의 결과 = 따로 적은 술어 (틀린 행 0)",
      pass: wrong === 0,
      detail: `틀린 행 ${wrong} · 남은 행 (10,000) 평평 ${table["10000@1x"].flatKept} · 묶음 ${table["10000@1x"].treeKept}`,
    });
    const line = (key) =>
      `${key}: 평평 ${table[key].flatMs.toFixed(2)} ms · 묶음 ${table[key].treeMs.toFixed(2)} ms (${(table[key].treeMs / table[key].flatMs).toFixed(2)} 배)`;
    for (const key of Object.keys(table))
      out.push({
        name: `계산 시간 ${key}`,
        // go 기준 = 10,000 행에서 지금 경로의 2 배 안. 100,000 행은 기록.
        pass: key.startsWith("10000")
          ? table[key].treeMs <= table[key].flatMs * 2
          : true,
        detail: `${line(key)} · ${visible}`,
      });
  },

  // P4 — announce 가 live region 에 문구를 싣는가
  async p4(page, out, browser) {
    await mount(page, "p4");
    await part(page, "announce").click();
    await settle(page, 20);
    await page.waitForTimeout(300);
    const live = await page.evaluate(() =>
      [...document.querySelectorAll("[aria-live]")].map((el) => ({
        live: el.getAttribute("aria-live"),
        role: el.getAttribute("role"),
        text: el.textContent,
      })),
    );
    out.push({
      name: "announce — live region 에 「조건 2 개 적용」",
      pass: live.some((item) => (item.text ?? "").includes("조건 2 개 적용")),
      detail: JSON.stringify(live),
    });
    if (browser === "chrome") {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const found = nodes.filter(
        (node) =>
          !node.ignored && (node.name?.value ?? "").includes("조건 2 개 적용"),
      );
      out.push({
        name: "Chrome 접근성 트리에 그 문구",
        pass: found.length > 0,
        detail: JSON.stringify(
          found.map((node) => ({
            role: node.role?.value,
            name: node.name?.value,
          })),
        ),
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

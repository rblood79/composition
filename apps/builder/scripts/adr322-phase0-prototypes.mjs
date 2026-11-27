#!/usr/bin/env node
// ADR-322 Phase 0 — 시제품 P1 ~ P5 의 go / no-go 를 실제 브라우저에서 판정한다 (VoiceOver 청취는 사용자 — G6).
//   node apps/builder/scripts/adr322-phase0-prototypes.mjs <out-dir> [--only p1,p2,p3,p4,p5] [--browser chrome,webkit]
//   node apps/builder/scripts/adr322-phase0-prototypes.mjs <out-dir> --serve   (청취용 — `#p1` · `#p2` · `#p3` 주소)
// `adr322Prototypes.mjs` (설치된 RAC 위의 작은 Cascader) 를 production lib build 해 빈 페이지에 올린다.
// 판정값은 브라우저의 focus · DOM 속성 · 접근성 스냅샷 · submit 이벤트 수 · FormData · performance.now 이고,
// 기대값은 이 파일에 따로 적었다 (breakdown §3.1 표 · §6 go 기준).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr322-phase0";
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
      entry: `${REPO}/apps/builder/scripts/adr322Prototypes.mjs`,
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
  `<!doctype html><meta charset="utf-8"><title>adr322</title>
<style>body{margin:16px;font:14px system-ui}
[role=menu],[role=grid],[role=treegrid],[role=listbox]{background:#fff;border:1px solid #999;min-width:200px;max-height:420px;overflow:auto}
[role=menuitemradio],[role=menuitem],[role=row],[role=option]{display:block;padding:2px 8px}
[role=row]{padding-left:calc((var(--tree-item-level, 1) - 1) * 16px + 8px)}
[aria-checked=true],[aria-selected=true]{font-weight:bold}
:focus-visible,[data-focus-visible],[data-focused]{outline:2px solid orange}
</style><body>
<script type="module">import { mount, warm } from "./prototypes.js"; window.__mount = mount; window.__warm = warm;
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
    `청취용 페이지: ${URL_BASE}#p1 (columns) · ${URL_BASE}#p2 (drill) · ${URL_BASE}#p3 (검색) (Ctrl+C 로 끝)\n`,
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
const mount = async (page, kind, cfg) => {
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate(
    ([k, c]) => window.__mount({ kind: k, cfg: c }),
    [kind, cfg],
  );
  await page.waitForFunction(() => window.__ready === true);
  await settle(page, 6);
};
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    return (
      el.getAttribute("data-part") ??
      `${el.tagName.toLowerCase()}[${el.getAttribute("role") ?? ""}]`
    );
  });
const part = (page, name) => page.locator(`[data-part="${name}"]`);
const press = async (page, key, frames = 4) => {
  await page.keyboard.press(key);
  await settle(page, frames);
};
const state = (page) => page.evaluate(() => window.__state());
const count = (page, selector) => page.locator(selector).count();
const SELECT_ALL = process.platform === "darwin" ? "Meta+A" : "Control+A";

const CHECKS = {
  // P1 — columns: Menu + SubmenuTrigger 3 단. go = 키보드로 3 단 내려가 고르고 닫힘 · 접근성 트리에 menu 와 선택 상태.
  async p1(page, out) {
    await mount(page, "p1");
    await part(page, "before").focus();
    await press(page, "Tab");
    await press(page, "Enter", 8);
    const first = await focused(page);
    out.push({
      name: "Enter 로 열면 첫 단계 menu · 첫 항목에 focus",
      pass: (await count(page, '[role="menu"]')) === 1 && first === "item:11",
      detail: `menu ${await count(page, '[role="menu"]')} · focus ${first}`,
    });
    await press(page, "ArrowRight", 8);
    const second = await focused(page);
    await press(page, "ArrowRight", 8);
    const third = await focused(page);
    out.push({
      name: "→ 두 번에 하위 메뉴 둘이 열리고 셋째 단계 첫 항목에 focus",
      pass:
        (await count(page, '[role="menu"]')) === 3 &&
        second === "item:11/11-680" &&
        third === "item:11/11-680/11-680-1",
      detail: `menu ${await count(page, '[role="menu"]')} · ${second} → ${third}`,
    });
    await press(page, "ArrowLeft", 8);
    const back = await focused(page);
    out.push({
      name: "← 로 하위 메뉴가 닫히고 부모 항목에 focus",
      pass:
        (await count(page, '[role="menu"]')) === 2 && back === "item:11/11-680",
      detail: `menu ${await count(page, '[role="menu"]')} · ${back}`,
    });
    await press(page, "ArrowRight", 8);
    await press(page, "ArrowDown");
    await press(page, "Enter", 10);
    const picked = await state(page);
    out.push({
      name: "끝 항목 Enter — 메뉴 전부 닫힘 · focus 가 여는 버튼 · 값 = 경로 식별자",
      pass:
        (await count(page, '[role="menu"]')) === 0 &&
        (await focused(page)) === "open" &&
        picked.value === "11/11-680/11-680-2" &&
        picked.text === "서울 / 강남구 / 삼성동",
      detail: `menu ${await count(page, '[role="menu"]')} · focus ${await focused(page)} · ${picked.value} · ${picked.text}`,
    });
    // 다시 열어 선택 상태가 접근성 트리에 실리는지
    await press(page, "Enter", 8);
    await press(page, "ArrowRight", 8);
    await press(page, "ArrowRight", 8);
    const snap = await part(page, "menu:11/11-680").ariaSnapshot();
    const rootSnap = await part(page, "menu:root").ariaSnapshot();
    out.push({
      name: "접근성 트리 — 끝 단계 menu 에 menuitemradio 「삼성동」 [checked]",
      pass: /menuitemradio "삼성동" \[checked\]/.test(snap),
      detail: snap.replace(/\n/g, " ¶ "),
    });
    out.push({
      name: "(기록) 첫 단계 menu 의 하위 메뉴 항목 role · 상태",
      pass: true,
      detail: rootSnap.replace(/\n/g, " ¶ "),
    });
    await press(page, "Escape", 8);
    const afterOne = await count(page, '[role="menu"]');
    for (
      let index = 0;
      index < 3 && (await count(page, '[role="menu"]'));
      index += 1
    )
      await press(page, "Escape", 8);
    out.push({
      name: "Esc — 닫히고 focus 가 여는 버튼 (Esc 한 번에 닫히는 메뉴 수 기록)",
      pass:
        (await count(page, '[role="menu"]')) === 0 &&
        (await focused(page)) === "open",
      detail: `한 번 뒤 menu ${afterOne} · focus ${await focused(page)}`,
    });
    // typeahead
    await press(page, "Enter", 8);
    // 기록만: 한글 IME 입력은 keydown 이 `Process` 라 typeahead 에 닿지 않는다 — 글자 key 를 직접 보낸 결과.
    await page.evaluate(() =>
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "부", bubbles: true }),
      ),
    );
    await settle(page, 6);
    out.push({
      name: "(기록) typeahead — keydown 「부」 직접",
      pass: true,
      detail: await focused(page),
    });
    await press(page, "Escape", 8);
  },

  // P2 — drill: GridList 행 동작 (들어가기) 과 선택 분리 · Breadcrumbs · 「뒤로」 · 단계가 바뀔 때 focus 유지.
  async p2(page, out) {
    await mount(page, "p2");
    await part(page, "before").focus();
    await press(page, "Tab");
    await press(page, "Enter", 10);
    const first = await focused(page);
    out.push({
      name: "Enter 로 열면 dialog · 첫 행에 focus (GridList autoFocus)",
      pass: (await count(page, '[role="dialog"]')) === 1 && first === "row:11",
      detail: `dialog ${await count(page, '[role="dialog"]')} · ${first}`,
    });
    await press(page, "Enter", 10);
    const inSeoul = await focused(page);
    out.push({
      name: "가지 행 Enter = 들어가기 — 다음 단계 첫 행에 focus · 값은 그대로",
      pass: inSeoul === "row:11/11-680" && (await state(page)).value === null,
      detail: `${inSeoul} · 값 ${(await state(page)).value}`,
    });
    await press(page, "ArrowDown");
    await press(page, "Enter", 10);
    const inJung = await focused(page);
    await press(page, "Enter", 10);
    const picked = await state(page);
    out.push({
      name: "끝 행 Enter = 고르기 — 닫힘 · focus 가 여는 버튼 · 값",
      pass:
        inJung === "row:11/11-140/11-140-1" &&
        (await count(page, '[role="dialog"]')) === 0 &&
        (await focused(page)) === "open" &&
        picked.value === "11/11-140/11-140-1" &&
        picked.text === "서울 / 중구 / 명동",
      detail: `${inJung} → focus ${await focused(page)} · ${picked.value} · ${picked.text}`,
    });
    await press(page, "Enter", 10);
    const reopened = await focused(page);
    const selected = await page
      .locator('[data-part="row:11/11-140/11-140-1"]')
      .getAttribute("aria-selected");
    out.push({
      name: "다시 열면 고른 값의 단계 · 그 행 aria-selected",
      pass: reopened === "row:11/11-140/11-140-1" && selected === "true",
      detail: `${reopened} · aria-selected ${selected} · 단계 ${(await state(page)).level}`,
    });
    await press(page, "Shift+Tab");
    const onBack = await focused(page);
    await press(page, "Enter", 10);
    const afterBack = await focused(page);
    out.push({
      name: "Shift+Tab → 「뒤로」 · Enter 로 한 단계 위 · focus 를 잃지 않음",
      pass:
        onBack === "back" &&
        (await state(page)).level === "11" &&
        afterBack !== "body",
      detail: `${onBack} → 단계 ${(await state(page)).level} · focus ${afterBack}`,
    });
    // breadcrumb — 전체로
    await part(page, "crumb:root").focus();
    await press(page, "Enter", 10);
    out.push({
      name: "breadcrumb 「전체」 Enter → 첫 단계 · focus 를 잃지 않음",
      pass:
        (await state(page)).level === null && (await focused(page)) !== "body",
      detail: `단계 ${(await state(page)).level} · focus ${await focused(page)}`,
    });
    // 가지 행 Space = 고르기 (「어느 단계든」 — 결정 2 의 drill 표현)
    await part(page, "row:11").focus();
    await press(page, "Space", 6);
    out.push({
      name: "(결정 2 재료) 가지 행 Space = 선택 — 값이 가지 · dialog 는 열린 채",
      pass:
        (await state(page)).value === "11" &&
        (await count(page, '[role="dialog"]')) === 1,
      detail: `값 ${(await state(page)).value} · dialog ${await count(page, '[role="dialog"]')}`,
    });
    const snap = await part(page, "grid").ariaSnapshot();
    out.push({
      name: "(기록) grid 접근성 스냅샷",
      pass: true,
      detail: snap.replace(/\n/g, " ¶ "),
    });
    await press(page, "Escape", 10);
    out.push({
      name: "Esc — 닫히고 focus 가 여는 버튼",
      pass:
        (await count(page, '[role="dialog"]')) === 0 &&
        (await focused(page)) === "open",
      detail: await focused(page),
    });
  },

  // P3 — 검색: Autocomplete 가 Menu 의 평평한 결과를 거르는지 (go). Tree 를 감쌀 수 있는지는 기록만.
  async p3(page, out) {
    await mount(page, "p3");
    await part(page, "search").focus();
    await page.keyboard.type("동");
    await settle(page, 6);
    const hits = await page.locator('[role="menuitemradio"]').allTextContents();
    out.push({
      name: "「동」 — 끝 항목 넷이 경로와 함께 (세종 없음)",
      pass:
        hits.length === 4 &&
        hits.includes("명동 — 서울 / 중구 / 명동") &&
        hits.includes("남포동 — 부산 / 중구 / 남포동"),
      detail: hits.join(" · "),
    });
    await press(page, "ArrowDown");
    const active = await page.evaluate(() => ({
      focus: document.activeElement?.getAttribute("data-part"),
      descendant: document.activeElement?.getAttribute("aria-activedescendant"),
    }));
    out.push({
      name: "↓ — focus 는 검색 칸에 남고 aria-activedescendant 가 결과를 가리킴 (virtual focus)",
      pass: active.focus === "search" && Boolean(active.descendant),
      detail: JSON.stringify(active),
    });
    await press(page, SELECT_ALL);
    await page.keyboard.type("명");
    await settle(page, 6);
    const one = await page.locator('[role="menuitemradio"]').allTextContents();
    await press(page, "ArrowDown");
    await press(page, "Enter", 6);
    out.push({
      name: "「명」 → 결과 하나 · ↓ Enter 로 고르면 값 = 그 항목의 경로 식별자",
      pass:
        one.length === 1 && (await state(page)).value === "11/11-140/11-140-1",
      detail: `${one.join(" · ")} · 값 ${(await state(page)).value}`,
    });

    await mount(page, "p3tree");
    const before = await count(page, '[role="row"]');
    await part(page, "search").focus();
    await page.keyboard.type("명");
    await settle(page, 6);
    const after = await count(page, '[role="row"]');
    out.push({
      name: "(기록) Autocomplete > Tree — 「명」 입력 전후 행 수",
      pass: true,
      detail: `${before} → ${after} (${after < before ? "걸러짐" : "걸러지지 않음"})`,
    });
  },

  // P4 — 5,000 항목 · 4 단. 교대 3 쌍 (대조군 Select 5,000) · CPU 1x · 4x (Chrome). 열기 = 클릭부터 목록이 다 그려진 뒤 다음 frame.
  async p4(page, out, browser) {
    const cdp =
      browser === "chrome" ? await page.context().newCDPSession(page) : null;
    const timeOpen = async (kind, selector, min) => {
      await page.goto(URL_BASE);
      await page.waitForFunction(() => typeof window.__warm === "function");
      await page.evaluate(() => window.__warm());
      await page.evaluate((k) => window.__mount({ kind: k }), kind);
      await page.waitForFunction(() => window.__ready === true);
      await settle(page, 6);
      return page.evaluate(
        ([sel, least]) =>
          new Promise((resolve) => {
            const button = document.querySelector('[data-part="open"]');
            const start = performance.now();
            button.click();
            const tick = () => {
              if (document.querySelectorAll(sel).length >= least)
                requestAnimationFrame(() =>
                  setTimeout(() =>
                    resolve({
                      ms: performance.now() - start,
                      drawn: document.querySelectorAll(sel).length,
                    }),
                  ),
                );
              else requestAnimationFrame(tick);
            };
            tick();
          }),
        [selector, min],
      );
    };
    const timeSubmenu = async () => {
      await page.goto(URL_BASE);
      await page.waitForFunction(() => typeof window.__warm === "function");
      await page.evaluate(() => window.__warm());
      await page.evaluate(() => window.__mount({ kind: "p4columns" }));
      await page.waitForFunction(() => window.__ready === true);
      await part(page, "open").focus();
      await press(page, "Enter", 8);
      await press(page, "ArrowRight", 8);
      await press(page, "ArrowRight", 8);
      const at = await focused(page);
      await page.evaluate(() => {
        window.__t0 = null;
        document.addEventListener(
          "keydown",
          () => (window.__t0 ??= performance.now()),
          {
            capture: true,
            once: true,
          },
        );
      });
      await page.keyboard.press("ArrowRight");
      const result = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const sel = '[data-part="menu:0/0-0/0-0-0"] [role="menuitemradio"]';
            const tick = () => {
              if (document.querySelectorAll(sel).length >= 300)
                requestAnimationFrame(() =>
                  setTimeout(() =>
                    resolve({
                      ms: performance.now() - window.__t0,
                      drawn: document.querySelectorAll(sel).length,
                    }),
                  ),
                );
              else requestAnimationFrame(tick);
            };
            tick();
          }),
      );
      return { ...result, at };
    };
    const median = (list) =>
      [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
    const rates = browser === "chrome" ? [1, 4] : [1];
    for (const rate of rates) {
      if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      const select = [];
      const tree = [];
      const virtual = [];
      const columns = [];
      let drawn = {};
      for (let pair = 0; pair < 3; pair += 1) {
        const order = pair % 2 ? ["tree", "select"] : ["select", "tree"];
        for (const which of order) {
          const result =
            which === "select"
              ? await timeOpen("p4select", '[role="option"]', 5000)
              : await timeOpen("p4tree", '[role="row"]', 5000);
          (which === "select" ? select : tree).push(result.ms);
          drawn[which] = result.drawn;
        }
        const v = await timeOpen("p4virtual", '[role="row"]', 5);
        virtual.push(v.ms);
        drawn.virtual = v.drawn;
        const c = await timeSubmenu();
        columns.push(c.ms);
        drawn.columns = `${c.drawn} (${c.at})`;
      }
      const base = median(select);
      const ratio = (list) => (median(list) / base).toFixed(2);
      out.push({
        name: `CPU ${rate}x — tree 전부 펼침 (가상화 없음) ≤ Select 5,000 × 1.5`,
        pass: median(tree) <= base * 1.5,
        detail: `Select ${select.map((ms) => ms.toFixed(0)).join("/")} ms (중앙 ${base.toFixed(0)}) · tree ${tree.map((ms) => ms.toFixed(0)).join("/")} (×${ratio(tree)}) · 그린 행 ${JSON.stringify(drawn)}`,
      });
      out.push({
        name: `CPU ${rate}x — tree + Virtualizer ≤ Select × 1.5`,
        pass: median(virtual) <= base * 1.5,
        detail: `${virtual.map((ms) => ms.toFixed(0)).join("/")} ms (×${ratio(virtual)})`,
      });
      out.push({
        name: `CPU ${rate}x — columns 300 항목 단계 열기 ≤ Select × 1.5`,
        pass: median(columns) <= base * 1.5,
        detail: `${columns.map((ms) => ms.toFixed(0)).join("/")} ms (×${ratio(columns)})`,
      });
    }
    if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  },

  // P5 — 필수 검증: §3.1 표 여덟 상태 × native · aria × Enter · requestSubmit.
  async p5(page, out) {
    const CASES = [
      {
        id: "필수·빈·단일",
        cfg: { name: "region", required: true },
        empty: true,
      },
      {
        id: "필수·빈·다중",
        cfg: { name: "region", required: true, multiple: true },
        empty: true,
      },
      {
        id: "필수·값·단일",
        cfg: { name: "region", required: true, initial: ["11-680-1"] },
      },
      {
        id: "필수·값·다중",
        cfg: {
          name: "region",
          required: true,
          multiple: true,
          initial: ["11-680-1", "26-110-1"],
        },
      },
      {
        id: "비활성·빈",
        cfg: { name: "region", required: true, disabled: true },
      },
      {
        id: "비활성·값",
        cfg: {
          name: "region",
          required: true,
          disabled: true,
          initial: ["36"],
        },
      },
      { id: "필수아님·빈", cfg: { name: "region" } },
      {
        id: "이름없음·필수·빈",
        cfg: { name: "", required: true },
        empty: true,
      },
      {
        id: "이름없음·필수·값",
        cfg: { name: "", required: true, initial: ["36"] },
      },
      { id: "이름없음·필수아님", cfg: { name: "" } },
    ];
    const expect = (c, behavior) => {
      const { cfg } = c;
      const blocked = Boolean(
        behavior === "native" && cfg.required && !cfg.disabled && c.empty,
      );
      const named = Boolean(cfg.name) && !cfg.disabled;
      const values = cfg.initial?.length ? cfg.initial : [""];
      return {
        submits: blocked ? 0 : 1,
        entries: blocked ? [] : named ? values.map((v) => ["region", v]) : [],
        error: blocked,
        focus: blocked ? "open" : null,
        inputs:
          cfg.name || (behavior === "native" && cfg.required)
            ? cfg.name
              ? Math.max(1, cfg.initial?.length ?? 0)
              : 1
            : 0,
      };
    };
    for (const behavior of ["native", "aria"]) {
      for (const c of CASES) {
        for (const how of ["Enter", "requestSubmit"]) {
          await mount(page, "p5", { ...c.cfg, behavior });
          if (how === "Enter") {
            await part(page, "text").focus();
            await press(page, "Enter", 8);
          } else {
            await page.evaluate(() =>
              document.querySelector('[data-part="form"]').requestSubmit(),
            );
            await settle(page, 8);
          }
          const got = await state(page);
          const error = (await part(page, "error").count()) > 0;
          const focus = await focused(page);
          const inputs = await page.evaluate(
            () =>
              document.querySelectorAll(
                '[data-part="form"] input:not([data-part])',
              ).length,
          );
          const want = expect(c, behavior);
          const pass =
            got.submits === want.submits &&
            JSON.stringify(got.entries) === JSON.stringify(want.entries) &&
            error === want.error &&
            (want.focus === null || focus === want.focus) &&
            inputs === want.inputs;
          out.push({
            name: `${behavior} · ${c.id} · ${how}`,
            pass,
            detail: `submit ${got.submits} · FormData ${JSON.stringify(got.entries)} · 오류 ${error} · focus ${focus} · input ${inputs} (기대 ${JSON.stringify(want)})`,
          });
          // 막힌 경우: 값을 고르면 오류가 지워지고 다음 제출은 1 회
          if (want.submits === 0 && how === "requestSubmit") {
            await page.evaluate(() => window.__set(["11-680-1"]));
            await settle(page, 6);
            const cleared = (await part(page, "error").count()) === 0;
            await page.evaluate(() =>
              document.querySelector('[data-part="form"]').requestSubmit(),
            );
            await settle(page, 8);
            const after = await state(page);
            out.push({
              name: `${behavior} · ${c.id} · 값을 고른 뒤 — 오류 지워짐 · 제출 1`,
              pass:
                cleared &&
                after.submits === 1 &&
                JSON.stringify(after.entries) ===
                  JSON.stringify(c.cfg.name ? [["region", "11-680-1"]] : []),
              detail: `오류 지워짐 ${cleared} · submit ${after.submits} · ${JSON.stringify(after.entries)}`,
            });
          }
        }
      }
    }
  },
};

const NAMES = ["p1", "p2", "p3", "p4", "p5"].filter(
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

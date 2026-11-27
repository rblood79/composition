#!/usr/bin/env node
// ADR-321 Phase 0 — 시제품 P1 (StepList 조립) · P2 (Rating 의 별 누르기) 의 go / no-go 재료를 실제 Chrome 에서 잰다.
//   node apps/builder/scripts/adr321-phase0-prototypes.mjs <out-dir> [--only p1,p2] [--headless]
//   node apps/builder/scripts/adr321-phase0-prototypes.mjs <out-dir> --serve   (사용자 VoiceOver 청취용 — 주소만 출력)
// `adr321Prototypes.mjs` (설치된 RAC 위의 조립) 와 대조 목록 `adr321V3StepListReference.mjs` (v3 private hook 을
// 그대로 그린 것) 를 production lib build 해 빈 페이지에 올린다. 판정값은 DOM 속성 · Chrome 접근성 트리 (CDP) ·
// `document.activeElement` · range input 값과 아래에 따로 적은 정답표다 — 시제품의 함수 출력으로 채점하지 않는다.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr321-phase0";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const SCRIPTS = `${REPO}/apps/builder/scripts`;
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const ONLY = arg("--only", null)?.split(",");
const SERVE = process.argv.includes("--serve");
const HEADLESS = process.argv.includes("--headless");

// ── 정답표 (따로 적어 둔 기준값 — 시제품의 출력이 아니다) ────────────────────────────────────────────────
// 단계 fixture: 현재 단계 · 갈 수 없는 단계 (v3 규칙 `useStepListState.mjs:60-65` 를 읽고 fixture 마다 하드코딩한 값).
const STEP_ANSWERS = {
  A: { current: "s3", disabled: ["s4", "s5"] },
  B: { current: "s4", disabled: ["s2", "s5"] },
  C: { current: "s3", disabled: ["s5"] },
  D: { current: "s1", disabled: ["s2", "s3", "s4", "s5"] },
};
// v3 `useStepListItem.mjs:26-32` 가 단계에 내는 속성: role link · 현재 = aria-current step ·
// 갈 수 없음 = aria-disabled true 와 tabIndex 없음 · 갈 수 있음 = tabIndex 0.
const expectedStep = (answer, key) => ({
  role: "link",
  current: answer.current === key ? "step" : null,
  disabled: answer.disabled.includes(key) ? "true" : null,
  tabindex: answer.disabled.includes(key) ? null : "0",
});
const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5"];
const SIZES = { M: { star: 18, gap: 4 }, S: { star: 16, gap: 4 } };
const ARMS = ["naive", "shifted", "shifted-slots"];

// ── HC2 정적 검사 (시제품 파일) ──────────────────────────────────────────────
const prototypeSource = readFileSync(`${SCRIPTS}/adr321Prototypes.mjs`, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const hc2 = {
  roleLiteral: (prototypeSource.match(/\brole\s*[:=]/g) ?? []).length,
  ariaLiteral: [
    ...new Set(prototypeSource.match(/["']aria-[a-z]+["']/g) ?? []),
  ],
  keyHandler: (prototypeSource.match(/onKey(Down|Up|Press)/g) ?? []).length,
  privateImport: (prototypeSource.match(/dist\/private|Reference\.mjs/g) ?? [])
    .length,
};

const { build } = await import("vite");
writeFileSync(
  `${OUT}/entry.mjs`,
  `import { mount, STEP_FIXTURES } from "${SCRIPTS}/adr321Prototypes.mjs";
import { mountReference } from "${SCRIPTS}/adr321V3StepListReference.mjs";
window.__mount = () => { mount(); mountReference(STEP_FIXTURES); };
`,
);
await build({
  configFile: false,
  logLevel: "warn",
  root: `${REPO}/apps/builder`,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: `${OUT}/entry.mjs`,
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
  `<!doctype html><html lang="ko"><meta charset="utf-8"><title>adr321</title>
<style>body{margin:0;font:14px system-ui}</style><body>
<script type="module">import "./prototypes.js"; if (location.hash === "#auto") window.__mount();
window.__loaded = true;</script>`,
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
const mount = async (page) => {
  await page.goto(URL_BASE);
  await page.waitForFunction(() => window.__loaded === true);
  await page.evaluate(() => window.__mount());
  await page.waitForFunction(() => window.__ready === true);
  await settle(page, 6);
};

/** Chrome 접근성 트리 (CDP `Accessibility.getFullAXTree`) 에서 `selector` 요소의 가지를 글자로. */
async function axLines(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
  });
  const { node } = await cdp.send("DOM.describeNode", {
    objectId: result.objectId,
  });
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const byId = new Map(nodes.map((entry) => [entry.nodeId, entry]));
  const start = nodes.find(
    (entry) => entry.backendDOMNodeId === node.backendNodeId,
  );
  const lines = [];
  const walk = (entry, depth) => {
    if (!entry) return;
    const shown = !entry.ignored;
    if (shown) {
      const props = (entry.properties ?? [])
        .map((prop) => `${prop.name}=${JSON.stringify(prop.value?.value)}`)
        .join(" ");
      const value =
        entry.value?.value === undefined
          ? ""
          : ` value=${JSON.stringify(entry.value.value)}`;
      lines.push(
        `${"  ".repeat(depth)}${entry.role?.value} ${JSON.stringify(entry.name?.value ?? "")}${value}${props ? ` [${props}]` : ""}`,
      );
    }
    for (const id of entry.childIds ?? [])
      walk(byId.get(id), shown ? depth + 1 : depth);
  };
  walk(start, 0);
  await cdp.detach();
  return lines;
}

/**
 * Chrome 의 접근성 트리 원본 (`chrome://accessibility` — CDP 는 `aria-current` 와 meter 의 값 문구를 내지
 * 않는다). `api` = "blink" (Chrome 내부 트리) · "mac" (VoiceOver 가 읽는 macOS 접근성 객체).
 */
async function chromeTree(page, api) {
  const ax = await page.context().newPage();
  await ax.goto("chrome://accessibility");
  await ax.waitForSelector(".row button[id$=showOrRefreshTree]");
  const button = await ax.evaluate(
    () =>
      [...document.querySelectorAll(".row")]
        .find((row) => /adr321/.test(row.innerText))
        ?.querySelector("button[id$=showOrRefreshTree]")?.id,
  );
  await ax.selectOption("#apiType", api);
  await ax.click(`#${button}`);
  let text = "";
  for (let tries = 0; tries < 40 && text.length < 200; tries += 1) {
    await ax.waitForTimeout(250);
    text = await ax.evaluate(
      (id) =>
        document.getElementById(id).closest(".row").querySelector("pre")
          ?.innerText ?? "",
      button,
    );
  }
  await ax.close();
  await page.bringToFront();
  writeFileSync(`${OUT}/chrome-accessibility-${api}.txt`, text);
  return text.split("\n");
}
const backendIdOf = async (page, selector) => {
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
  });
  const { node } = await cdp.send("DOM.describeNode", {
    objectId: result.objectId,
  });
  await cdp.detach();
  return node.backendNodeId;
};
const depthOf = (line) => line.match(/^\+*/)[0].length;
const attrOf = (line, name) => {
  const match = line.match(new RegExp(`(?:^|[ +])${name}=('([^']*)'|\\S+)`));
  return match ? (match[2] ?? match[1]) : undefined;
};
const BLINK_KEEP = [
  "name",
  "ariaCurrentState",
  "restriction",
  "value",
  "ariaValueText",
  "valueForRange",
  "minValueForRange",
  "maxValueForRange",
];
const MAC_KEEP = [
  "AXSubrole",
  "AXARIACurrent",
  "AXDescription",
  "AXTitle",
  "AXEnabled",
  "AXValue",
  "AXValueDescription",
  "AXMinValue",
  "AXMaxValue",
  "AXRoleDescription",
];
/** 트리 줄 하나를 role · 상태 · 고른 속성으로 줄인다 (`base` = 가지의 뿌리 깊이). */
const compact = (line, api, base) => {
  const body = line.replace(/^\++/, "");
  const head =
    api === "blink"
      ? body.slice(0, body.indexOf(" location=")).replace(/^id#=-?\d+ /, "")
      : body.split(" ")[0];
  const attrs = (api === "blink" ? BLINK_KEEP : MAC_KEEP)
    .map((name) => [name, attrOf(body, name)])
    .filter(([, value]) => value !== undefined && value !== "_const_NULL")
    .map(([name, value]) => `${name}=${value}`);
  return `${"  ".repeat((depthOf(line) - base) / 2)}${head}${attrs.length ? ` [${attrs.join(" ")}]` : ""}`;
};
/** `backendId` 요소의 줄과 그 아래 줄 (roles 에 든 것만). */
const subtree = (lines, api, backendId, roles) => {
  const at = lines.findIndex((line) =>
    api === "blink"
      ? new RegExp(`^\\+*id#=${backendId} `).test(line)
      : line.includes(`ChromeAXNodeId='${backendId}'`),
  );
  if (at < 0) return [`(노드 ${backendId} 없음)`];
  const base = depthOf(lines[at]);
  const picked = [lines[at]];
  for (let i = at + 1; i < lines.length && depthOf(lines[i]) > base; i += 1)
    picked.push(lines[i]);
  return picked
    .filter((line) =>
      roles.some((role) =>
        new RegExp(
          api === "blink" ? `^\\+*id#=-?\\d+ ${role}\\b` : `^\\+*${role}\\b`,
        ).test(line),
      ),
    )
    .map((line) => compact(line, api, base));
};

const stepAttrs = (page, listSelector) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(`${selector} [data-step]`)].map((el) => ({
        key: el.dataset.step,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        current: el.getAttribute("aria-current"),
        disabled: el.getAttribute("aria-disabled"),
        tabindex: el.getAttribute("tabindex"),
      })),
    listSelector,
  );
const activeName = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return (
      el?.dataset?.step ??
      el?.dataset?.edge ??
      (el?.closest?.("[data-rating]")
        ? `rating:${el.closest("[data-rating]").dataset.rating}`
        : (el?.tagName?.toLowerCase() ?? "none"))
    );
  });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const centerOf = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const ratingValue = (page, id) =>
  page.evaluate((key) => {
    const input = document.querySelector(`[data-rating="${key}"] input`);
    return {
      value: input.value,
      text: input.getAttribute("aria-valuetext"),
    };
  }, id);
const setRating = async (page, id, value) => {
  await page.evaluate(
    ([key, next]) => window.__rating[key].set(next),
    [id, value],
  );
  await settle(page, 2);
};

const CHECKS = {
  // P1 — `ol > li > RAC Link` 조립. 기준: v3 hook 을 그린 대조 목록의 속성 + 손으로 적은 정답표.
  async p1(page, out, record) {
    await mount(page);
    out.push({
      name: "HC2 정적 검사 — role 리터럴 0 · aria 리터럴은 RAC prop 둘 · 키 handler 0 · private import 0",
      pass:
        hc2.roleLiteral === 0 &&
        hc2.keyHandler === 0 &&
        hc2.privateImport === 0 &&
        same(hc2.ariaLiteral.sort(), ['"aria-current"', '"aria-label"']),
      detail: JSON.stringify(hc2),
    });
    record.attributes = {};
    for (const [id, answer] of Object.entries(STEP_ANSWERS)) {
      const ours = await stepAttrs(page, `[data-list="${id}"]`);
      const v3 = await stepAttrs(page, `[data-v3-list="${id}"]`);
      record.attributes[id] = { ours, v3 };
      const pick = ({ key, role, current, disabled, tabindex }) => ({
        key,
        role,
        current,
        disabled,
        tabindex,
      });
      const want = STEP_KEYS.map((key) => ({
        key,
        ...expectedStep(answer, key),
      }));
      out.push({
        name: `fixture ${id} — 조립의 속성 = 정답표`,
        pass: same(ours.map(pick), want),
        detail: ours
          .map(
            (s) =>
              `${s.key}:${s.tag}[role=${s.role} current=${s.current} disabled=${s.disabled} tabindex=${s.tabindex}]`,
          )
          .join(" "),
      });
      out.push({
        name: `fixture ${id} — 조립의 속성 = v3 hook 대조 목록의 속성`,
        pass: same(ours.map(pick), v3.map(pick)),
        detail: v3
          .map(
            (s) =>
              `${s.key}:${s.tag}[role=${s.role} current=${s.current} disabled=${s.disabled} tabindex=${s.tabindex}]`,
          )
          .join(" "),
      });
    }
    record.axTree = {
      ours: await axLines(page, '[data-list="A"]'),
      v3: await axLines(page, '[data-v3-list="A"]'),
      oursB: await axLines(page, '[data-list="B"]'),
    };
    const roles = (lines) => lines.map((line) => line.trim().split(" ")[0]);
    out.push({
      name: "접근성 트리 (fixture A) — list 1 · listitem 5 · link 5",
      pass:
        roles(record.axTree.ours).filter((role) => role === "list").length ===
          1 &&
        roles(record.axTree.ours).filter((role) => role === "listitem")
          .length === 5 &&
        roles(record.axTree.ours).filter((role) => role === "link").length ===
          5,
      detail: `\n${record.axTree.ours.join("\n")}`,
    });
    out.push({
      name: "접근성 트리 (v3 대조 목록, fixture A) — 기록",
      pass: true,
      detail: `\n${record.axTree.v3.join("\n")}`,
    });

    // Chrome 내부 트리 · macOS 접근성 객체 — `aria-current` 가 접근성 트리에 실렸는지 (CDP 에는 없다).
    const blink = await chromeTree(page, "blink");
    const mac = await chromeTree(page, "mac");
    record.chromeTree = {};
    for (const id of ["A", "B"]) {
      const ours = await backendIdOf(page, `[data-list="${id}"]`);
      const v3 = await backendIdOf(page, `[data-v3-list="${id}"]`);
      record.chromeTree[id] = {
        blinkOurs: subtree(blink, "blink", ours, ["list", "listItem", "link"]),
        blinkV3: subtree(blink, "blink", v3, ["list", "listItem", "link"]),
        macOurs: subtree(mac, "mac", ours, ["AXList", "AXGroup", "AXLink"]),
        macV3: subtree(mac, "mac", v3, ["AXList", "AXGroup", "AXLink"]),
      };
    }
    // 정답표 (fixture A): 현재 = s3 하나 · 갈 수 없음 = s4 · s5. 줄 순서 = 단계 순서.
    const linkStates = (lines, api) =>
      lines
        .filter((line) => /^\s*(link|AXLink)\b/.test(line))
        .map((line) =>
          api === "blink"
            ? `${/ariaCurrentState=step/.test(line) ? "current" : "-"}/${/restriction=disabled/.test(line) ? "disabled" : "-"}/${/^\s*link[^[]*\bfocusable\b/.test(line) ? "focusable" : "-"}`
            : `${/AXARIACurrent=step/.test(line) ? "current" : "-"}/${/AXEnabled=0/.test(line) ? "disabled" : "-"}`,
        );
    const wantBlink = [
      "-/-/focusable",
      "-/-/focusable",
      "current/-/focusable",
      "-/disabled/-",
      "-/disabled/-",
    ];
    const wantMac = ["-/-", "-/-", "current/-", "-/disabled", "-/disabled"];
    const treeA = record.chromeTree.A;
    out.push({
      name: "Chrome 내부 접근성 트리 (fixture A) — list · listItem 5 · link 5, s3 만 ariaCurrentState=step, s4 · s5 는 restriction=disabled (정답표)",
      pass:
        same(linkStates(treeA.blinkOurs, "blink"), wantBlink) &&
        treeA.blinkOurs.filter((line) => /^\s*listItem\b/.test(line)).length ===
          5 &&
        /^list\b/.test(treeA.blinkOurs[0]),
      detail: `\n${treeA.blinkOurs.join("\n")}`,
    });
    out.push({
      name: "Chrome 내부 접근성 트리 — 조립의 link 상태 = v3 대조 목록의 link 상태 (fixture A · B)",
      pass: ["A", "B"].every((id) =>
        same(
          linkStates(record.chromeTree[id].blinkOurs, "blink"),
          linkStates(record.chromeTree[id].blinkV3, "blink"),
        ),
      ),
      detail: `\n${treeA.blinkV3.join("\n")}`,
    });
    out.push({
      name: "macOS 접근성 객체 (VoiceOver 가 읽는 트리, fixture A) — s3 만 AXARIACurrent=step, s4 · s5 는 AXEnabled=0 (정답표) · v3 대조 목록과 같다",
      pass:
        same(linkStates(treeA.macOurs, "mac"), wantMac) &&
        same(linkStates(treeA.macOurs, "mac"), linkStates(treeA.macV3, "mac")),
      detail: `\n${treeA.macOurs.join("\n")}\n— v3 —\n${treeA.macV3.join("\n")}`,
    });

    // Tab 순서 — 갈 수 없는 단계는 건너뛴다.
    record.tabOrder = {};
    for (const [id, want] of [
      ["A", ["s1", "s2", "s3", "after"]],
      ["B", ["s1", "s3", "s4", "after"]],
    ]) {
      await page.locator(`[data-fixture="${id}"] [data-edge="before"]`).focus();
      const seen = [];
      for (let i = 0; i < want.length; i += 1) {
        await page.keyboard.press("Tab");
        seen.push(await activeName(page));
      }
      record.tabOrder[id] = seen;
      out.push({
        name: `Tab 순서 fixture ${id} — 정답표 ${want.join(" → ")}`,
        pass: same(seen, want),
        detail: seen.join(" → "),
      });
    }
    // v3 대조 목록의 Tab 순서 (fixture A) — 기록.
    await page.locator('[data-odd="-1-uncontrolled"] input').focus();
    const v3Tabs = [];
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Tab");
      v3Tabs.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el?.closest?.("[data-v3-list]")
            ? `${el.closest("[data-v3-list]").dataset.v3List}:${el.dataset.step}`
            : (el?.dataset?.rating ?? el?.tagName?.toLowerCase());
        }),
      );
    }
    record.tabOrderV3 = v3Tabs;
    out.push({
      name: "Tab 순서 — v3 대조 목록 (기록: 목록 A 의 s1 → s2 → s3 뒤 목록 B)",
      pass: same(v3Tabs.slice(0, 3), ["A:s1", "A:s2", "A:s3"]),
      detail: v3Tabs.join(" → "),
    });

    // Enter 활성 · Space · 갈 수 없는 단계 누르기 · 단계 완료.
    const currentOf = (id) =>
      page.evaluate(
        (key) =>
          document.querySelector(
            `[data-list="${key}"] [data-step][aria-current="step"]`,
          )?.dataset.step ?? null,
        id,
      );
    await page.locator('[data-fixture="A"] [data-edge="before"]').focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await settle(page);
    const afterEnter = await currentOf("A");
    out.push({
      name: "Enter — focus 가 있는 완료 단계 s1 이 현재 단계가 된다",
      pass: afterEnter === "s1",
      detail: `current=${afterEnter} · ${JSON.stringify((await stepAttrs(page, '[data-list="A"]')).map((s) => `${s.key}:${s.current ?? "-"}/${s.disabled ?? "-"}`))}`,
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await settle(page);
    const afterSpace = await currentOf("A");
    record.spaceActivates = afterSpace === "s2";
    record.spaceScrollY = await page.evaluate(() => {
      const y = window.scrollY;
      window.scrollTo(0, 0);
      return y;
    });
    out.push({
      name: "Space — link 는 Space 로 활성되지 않는다 (기록: RAC Link 의 press 는 Enter)",
      pass: afterSpace === "s1",
      detail: `focus=s2 · Space 뒤 current=${afterSpace} · 페이지 scrollY=${record.spaceScrollY} (Space 를 막지 않는다 — 문서가 화면보다 길면 스크롤)`,
    });
    const blocked = await centerOf(
      page.locator('[data-list="A"] [data-step="s5"]'),
    );
    await page.mouse.click(blocked.x, blocked.y);
    await settle(page);
    out.push({
      name: "포인터 — 갈 수 없는 단계 s5 를 눌러도 바뀌지 않는다",
      pass: (await currentOf("A")) === "s1",
      detail: `current=${await currentOf("A")}`,
    });
    const third = await centerOf(
      page.locator('[data-list="A"] [data-step="s3"]'),
    );
    await page.mouse.click(third.x, third.y);
    await settle(page);
    out.push({
      name: "포인터 — 갈 수 있는 단계 s3 를 누르면 현재 단계",
      pass: (await currentOf("A")) === "s3",
      detail: `current=${await currentOf("A")}`,
    });
    await page.locator('[data-fixture="A"] [data-edge="complete"]').focus();
    await page.keyboard.press("Enter");
    await settle(page);
    const advanced = await stepAttrs(page, '[data-list="A"]');
    out.push({
      name: "단계 완료 · 다음 단계 — s4 가 현재가 되고 갈 수 없는 단계는 s5 만 남는다 (정답표)",
      pass:
        (await currentOf("A")) === "s4" &&
        same(
          advanced.filter((step) => step.disabled).map((step) => step.key),
          ["s5"],
        ),
      detail: advanced
        .map((s) => `${s.key}:${s.current ?? "-"}/${s.disabled ?? "-"}`)
        .join(" "),
    });
    // v3 대조 목록의 Enter (기록).
    await page.locator('[data-v3-list="A"] [data-step="s1"]').focus();
    await page.keyboard.press("Enter");
    await settle(page);
    const v3After = await stepAttrs(page, '[data-v3-list="A"]');
    record.v3Enter = v3After;
    out.push({
      name: "v3 대조 목록 — s1 에서 Enter (기록)",
      pass: true,
      detail: v3After
        .map((s) => `${s.key}:${s.current ?? "-"}/${s.disabled ?? "-"}`)
        .join(" "),
    });
  },

  // P2 — RAC Slider (0 ~ 5 · step 1) 의 track 위 별 다섯. 정답: 별 i 의 어디를 눌러도 값 i.
  async p2(page, out, record) {
    await mount(page);
    record.points = {};
    for (const arm of ARMS)
      for (const size of Object.keys(SIZES)) {
        const id = `${arm}-${size}`;
        const rows = [];
        let hits = 0;
        for (let star = 1; star <= 5; star += 1) {
          const box = await page
            .locator(`[data-rating="${id}"] [data-star="${star}"] .star`)
            .boundingBox();
          const y = box.y + box.height / 2;
          const row = { star };
          for (const [name, x] of [
            ["left", box.x + 1],
            ["center", box.x + box.width / 2],
            ["right", box.x + box.width - 1],
          ]) {
            await setRating(page, id, 0);
            await page.mouse.click(x, y);
            await settle(page, 2);
            const got = Number((await ratingValue(page, id)).value);
            row[name] = got;
            if (got === star) hits += 1;
          }
          rows.push(row);
        }
        const track = await page
          .locator(`[data-rating="${id}"] .track`)
          .boundingBox();
        const first = await page
          .locator(`[data-rating="${id}"] [data-star="1"] .star`)
          .boundingBox();
        const last = await page
          .locator(`[data-rating="${id}"] [data-star="5"] .star`)
          .boundingBox();
        record.points[id] = {
          rows,
          hits,
          track: { left: track.x, width: track.width },
          stars: { left: first.x, right: last.x + last.width },
        };
        out.push({
          name: `별 누르기 15 점 — ${id} (별 줄 ${first.x}..${last.x + last.width} · track ${track.x}..${track.x + track.width})`,
          // naive 는 대조군 — 어긋남을 기록한다 (판정 대상은 shifted 둘).
          pass: arm === "naive" ? hits < 15 : hits === 15,
          detail: `${hits}/15 · ${rows.map((r) => `별${r.star}: ${r.left}/${r.center}/${r.right}`).join(" · ")}`,
        });
      }

    // 별 줄 밖 왼쪽 (track 의 첫 slot 반 칸) — shifted 는 0 으로, shifted-slots 는 그대로.
    for (const [arm, want] of [
      ["shifted", 0],
      ["shifted-slots", 3],
    ]) {
      const id = `${arm}-M`;
      const track = await page
        .locator(`[data-rating="${id}"] .track`)
        .boundingBox();
      await setRating(page, id, 3);
      await page.mouse.click(track.x + 3, track.y + track.height / 2);
      await settle(page, 2);
      const got = Number((await ratingValue(page, id)).value);
      out.push({
        name: `별 줄 밖 왼쪽 (track 왼쪽 끝 + 3 px) 누르기 — ${id} (값 3 에서, 정답 ${want})`,
        pass: got === want,
        detail: `값 ${got}`,
      });
    }
    // 끌기 — 별 1 에서 눌러 별 4 까지.
    for (const arm of ["shifted", "shifted-slots"]) {
      const id = `${arm}-M`;
      await setRating(page, id, 0);
      const from = await centerOf(
        page.locator(`[data-rating="${id}"] [data-star="1"] .star`),
      );
      const to = await centerOf(
        page.locator(`[data-rating="${id}"] [data-star="4"] .star`),
      );
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      const seen = [Number((await ratingValue(page, id)).value)];
      for (let step = 1; step <= 6; step += 1) {
        await page.mouse.move(from.x + ((to.x - from.x) * step) / 6, from.y);
        await settle(page, 1);
        seen.push(Number((await ratingValue(page, id)).value));
      }
      await page.mouse.up();
      await settle(page, 2);
      out.push({
        name: `끌기 별 1 → 별 4 — ${id} (정답: 1 에서 시작해 4 로 끝)`,
        pass: seen[0] === 1 && seen.at(-1) === 4,
        detail: seen.join(" → "),
      });
    }

    // 키보드 — 화살표로 0 까지 (HC5).
    const id = "shifted-M";
    await setRating(page, id, 0);
    await page.locator('[data-fixture="D"] [data-edge="complete"]').focus();
    const reach = [];
    for (let i = 0; i < 12 && reach.at(-1) !== `rating:${id}`; i += 1) {
      await page.keyboard.press("Tab");
      reach.push(await activeName(page));
    }
    const keys = [
      ...Array(6).fill("ArrowRight"),
      ...Array(6).fill("ArrowLeft"),
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "End",
      "Home",
      "PageUp",
      "PageDown",
    ];
    const want = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 1, 2, 1, 5, 0, 1, 0];
    const seen = [];
    for (const key of keys) {
      await page.keyboard.press(key);
      await settle(page, 1);
      seen.push(await ratingValue(page, id));
    }
    record.keyboard = { reach, keys, seen };
    out.push({
      name: `Tab 으로 별점에 닿는다 — ${id}`,
      pass: reach.at(-1) === `rating:${id}`,
      detail: reach.join(" → "),
    });
    out.push({
      name: "화살표 · Home · End · PageUp · PageDown — 정답표 (0 도달 포함)",
      pass: same(
        seen.map((entry) => Number(entry.value)),
        want,
      ),
      detail: keys
        .map((key, i) => `${key}=${seen[i].value}(${seen[i].text})`)
        .join(" "),
    });
    await setRating(page, id, 3);
    record.axSlider = await axLines(page, `[data-rating="${id}"]`);
    out.push({
      name: "접근성 트리 — slider 와 값 3 · 최소 0 · 최대 5",
      pass: record.axSlider.some(
        (line) =>
          line.trim().startsWith("slider") &&
          /valuemin=0/.test(line) &&
          /valuemax=5/.test(line) &&
          /value=3\b|valuetext="3"/.test(line),
      ),
      detail: `\n${record.axSlider.join("\n")}`,
    });
    const blink = await chromeTree(page, "blink");
    const mac = await chromeTree(page, "mac");
    const sliderRoot = await backendIdOf(page, `[data-rating="${id}"]`);
    record.chromeSlider = {
      blink: subtree(blink, "blink", sliderRoot, ["group", "slider"]),
      mac: subtree(mac, "mac", sliderRoot, ["AXGroup", "AXSlider"]),
    };
    out.push({
      name: "Chrome 내부 트리 · macOS 객체 — group 「평점」 안의 slider 하나, 값 3 · 0 ~ 5",
      pass:
        record.chromeSlider.blink.some(
          (line) =>
            /^\s*slider\b/.test(line) &&
            /ariaValueText=3\b/.test(line) &&
            /valueForRange=3\.00/.test(line) &&
            /minValueForRange=0\.00/.test(line) &&
            /maxValueForRange=5\.00/.test(line),
        ) &&
        record.chromeSlider.mac.some(
          (line) =>
            /^\s*AXSlider\b/.test(line) &&
            /AXValue=3\b/.test(line) &&
            /AXMinValue=0\b/.test(line) &&
            /AXMaxValue=5\b/.test(line),
        ),
      detail: `\n${record.chromeSlider.blink.join("\n")}\n${record.chromeSlider.mac.join("\n")}`,
    });
    record.chromeMeters = {};
    for (const meter of ["plain", "labelled"]) {
      const backendId = await backendIdOf(page, `[data-meter="${meter}"]`);
      record.chromeMeters[meter] = {
        blink: subtree(blink, "blink", backendId, ["meter"]),
        mac: subtree(mac, "mac", backendId, ["AXLevelIndicator"]),
      };
    }

    // 범위 밖 · 단계 사이 값을 준 Slider 의 range input 값 (F11) — 정답표 2.5 → 3 · 6 → 5 · −1 → 0.
    const odd = await page.evaluate(() =>
      [...document.querySelectorAll("[data-odd]")].map((el) => {
        const input = el.querySelector("input");
        return {
          id: el.dataset.odd,
          value: input.value,
          valueAttr: input.getAttribute("value"),
          text: input.getAttribute("aria-valuetext"),
          min: input.min,
          max: input.max,
          step: input.step,
          thumbLeft: el.querySelector(".react-aria-SliderThumb").style.left,
        };
      }),
    );
    record.odd = odd;
    const oddWant = { 2.5: "3", 6: "5", "-1": "0" };
    out.push({
      name: "단계 사이 · 범위 밖 값의 range input 값 — 정답표 2.5 → 3 · 6 → 5 · −1 → 0",
      pass: odd.every(
        (entry) =>
          entry.value === oddWant[entry.id.replace(/-(un)?controlled$/, "")],
      ),
      detail: odd
        .map(
          (entry) =>
            `${entry.id}: input.value=${entry.value} aria-valuetext=${entry.text} thumb left=${entry.thumbLeft}`,
        )
        .join(" · "),
    });

    // Meter 0 ~ 5 의 2.5 — `aria-valuetext` (valueLabel 유 · 무, F12).
    const meters = await page.evaluate(() =>
      [...document.querySelectorAll("[data-meter]")].map((el) => ({
        id: el.dataset.meter,
        role: el.getAttribute("role"),
        now: el.getAttribute("aria-valuenow"),
        min: el.getAttribute("aria-valuemin"),
        max: el.getAttribute("aria-valuemax"),
        text: el.getAttribute("aria-valuetext"),
      })),
    );
    record.meters = meters;
    record.axMeters = {
      plain: await axLines(page, '[data-meter="plain"]'),
      labelled: await axLines(page, '[data-meter="labelled"]'),
    };
    out.push({
      name: "Meter 2.5 / 5 — valueLabel 없음 = 「50%」 · 있음 = 「5점 만점에 2.5점」 (정답표: DOM 속성 · Chrome 내부 트리 · macOS 객체 셋 다)",
      pass:
        meters.find((m) => m.id === "plain")?.text === "50%" &&
        meters.find((m) => m.id === "labelled")?.text === "5점 만점에 2.5점" &&
        /ariaValueText=50%/.test(record.chromeMeters.plain.blink[0]) &&
        /ariaValueText=5점 만점에 2\.5점/.test(
          record.chromeMeters.labelled.blink[0],
        ) &&
        /AXValueDescription=50%/.test(record.chromeMeters.plain.mac[0]) &&
        /AXValueDescription=5점 만점에 2\.5점/.test(
          record.chromeMeters.labelled.mac[0],
        ),
      detail: `${meters.map((m) => `${m.id}: role=${m.role} now=${m.now} min=${m.min} max=${m.max} text=${m.text}`).join(" · ")}\nCDP: ${record.axMeters.plain.join(" ")} ‖ ${record.axMeters.labelled.join(" ")}\n${["plain", "labelled"].flatMap((m) => [...record.chromeMeters[m].blink, ...record.chromeMeters[m].mac]).join("\n")}`,
    });
  },
};

const NAMES = (ONLY ?? Object.keys(CHECKS)).filter((name) => CHECKS[name]);
const instance = await chromium.launch({
  headless: HEADLESS,
  channel: "chrome",
  // `chrome://accessibility` 가 페이지의 트리를 내려면 renderer 접근성이 켜져 있어야 한다.
  args: ["--force-renderer-accessibility"],
});
const results = { chrome: { version: instance.version(), headless: HEADLESS } };
for (const name of NAMES) {
  const context = await instance.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 300));
  });
  const out = [];
  const record = {};
  process.stdout.write(`\n[chrome ${instance.version()}] ${name}\n`);
  const push = out.push.bind(out);
  out.push = (line) => {
    process.stdout.write(
      `  ${line.pass ? "PASS" : "FAIL"}  ${line.name} — ${line.detail}\n`,
    );
    return push(line);
  };
  try {
    await CHECKS[name](page, out, record);
  } catch (error) {
    out.push({
      name: "실행 오류",
      pass: false,
      detail: String(error).split("\n").slice(0, 3).join(" | "),
    });
  }
  record.conditions = await page.evaluate(() => ({
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
    devicePixelRatio: window.devicePixelRatio,
    viewport: [window.innerWidth, window.innerHeight],
    userAgent: navigator.userAgent,
  }));
  out.push({
    name: "측정 조건",
    pass: true,
    detail: JSON.stringify(record.conditions),
  });
  out.push({
    name: "페이지 오류 0",
    pass: errors.length === 0,
    detail: errors.slice(0, 3).join(" ‖ "),
  });
  await page.screenshot({ path: `${OUT}/chrome-${name}.png` });
  results.chrome[name] = { lines: out, record };
  await context.close();
}
await instance.close();
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
server.close();
const failed = NAMES.flatMap((name) =>
  results.chrome[name].lines
    .filter((line) => !line.pass)
    .map((line) => `${name}: ${line.name}`),
);
process.stdout.write(
  `\n${failed.length ? `FAIL ${failed.length}\n${failed.join("\n")}` : "ALL PASS"} → ${OUT}/results.json\n`,
);

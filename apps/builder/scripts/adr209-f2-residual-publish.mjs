#!/usr/bin/env node
// adr209-f2-residual-publish.mjs — ADR-209 후속 F2 잔여 T12 의 **독립 Publish** 구간.
//
// Builder 를 거치지 않는 publish 런타임이 `adr209-f2-residual-live.mjs` 가 남긴 export
// (pie · 360×260 · padding T8 R16 B24 L40) 를 읽어, 사용자 padding 이 content box 로 반영되고
// 원이 그 안에 그려지는지 확인한다. publish 는 `data-theme` 을 세우지 않으므로 light 로만 그린다 —
// 그 사실도 그대로 기록한다.
//
// 준비: `pnpm -F @composition/publish dev` (3001) 와 `/private/tmp/adr209-f2-residual/project.json`.
// 사용: node apps/builder/scripts/adr209-f2-residual-publish.mjs [--headed]
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const PUBLISH_URL = "http://localhost:3001";
const OUT_DIR = "/private/tmp/adr209-f2-residual";
const EXPORT_PATH = `${OUT_DIR}/project.json`;
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-209 F2-residual publish]", ...a);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const projectJson = readFileSync(EXPORT_PATH, "utf8");
const fileServer = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(projectJson);
});
await new Promise((resolve) => fileServer.listen(0, "127.0.0.1", resolve));
const projectUrl = `http://127.0.0.1:${fileServer.address().port}/project.json`;

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function readChart() {
  return page.evaluate(() => {
    const el = document.querySelector(".react-aria-Chart");
    if (!el) return { found: false };
    const svg = el.querySelector("svg");
    const cs = getComputedStyle(el);
    const paths = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
      const fill = getComputedStyle(p).fill;
      return fill && fill !== "none" && !/^rgba?\(0, 0, 0, 0\)$/.test(fill);
    });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of paths) {
      const b = p.getBBox();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
    }
    const box = el.getBoundingClientRect();
    return {
      found: true,
      theme: document.documentElement.getAttribute("data-theme"),
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
      box: { w: Math.round(box.width), h: Math.round(box.height) },
      ink: paths.length ? { left: +minX.toFixed(1), top: +minY.toFixed(1), right: +maxX.toFixed(1), bottom: +maxY.toFixed(1) } : null,
      pathCount: paths.length,
      fills: [...new Set(paths.map((p) => getComputedStyle(p).fill))],
      texts: [...(svg?.querySelectorAll("text") ?? [])].length,
      seriesVar: cs.getPropertyValue("--chart-series-1").trim(),
      background: cs.backgroundColor,
    };
  });
}

try {
  await page.goto(`${PUBLISH_URL}/?project=${encodeURIComponent(projectUrl)}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".react-aria-Chart", { timeout: 30_000 });
  await page.waitForTimeout(3000);
  const light = await readChart();
  record(
    "독립 publish 가 export 의 pie 를 360×260 으로 그린다",
    light.found && light.box.w === 360 && light.box.h === 260 && light.pathCount > 0,
    JSON.stringify({ box: light.box, paths: light.pathCount, fills: light.fills?.length, texts: light.texts }),
  );
  record(
    "publish content box = 입력한 4방향 padding (T8 R16 B24 L40)",
    JSON.stringify(light.padding) === JSON.stringify(["8px", "16px", "24px", "40px"]),
    JSON.stringify(light.padding),
  );
  // 반지름 = min(content w, content h)/2 − labelRoom (computeChartScene) — 값 라벨 자리만큼 줄 수
  // 있으므로 절대 지름 대신 "content box 안 · 원형 · 중심이 content box 중심" 을 본다.
  const cw = 360 - 40 - 16, ch = 260 - 8 - 24;
  const ink = light.ink;
  const w = ink ? ink.right - ink.left : 0, h = ink ? ink.bottom - ink.top : 0;
  const cx = ink ? (ink.left + ink.right) / 2 : 0, cy = ink ? (ink.top + ink.bottom) / 2 : 0;
  record(
    "원이 content box 안에서 그 중심에 원형으로 그려진다 (±2px)",
    !!ink && ink.left >= 39 && ink.top >= 7 && ink.right <= 360 - 16 + 1 && ink.bottom <= 260 - 24 + 1 &&
      Math.abs(w - h) <= 2 && Math.abs(cx - (40 + cw / 2)) <= 2 && Math.abs(cy - (8 + ch / 2)) <= 2 && h <= ch + 1,
    `ink=${JSON.stringify(ink)} 지름 ${w.toFixed(1)}×${h.toFixed(1)} 중심 (${cx.toFixed(1)}, ${cy.toFixed(1)}) 기대 중심 (${40 + cw / 2}, ${8 + ch / 2}) content ${cw}×${ch}`,
  );
  record(
    "publish 는 data-theme 을 세우지 않아 light 로만 그린다 (기존 계약 — 기록)",
    light.theme === null,
    `data-theme=${JSON.stringify(light.theme)} · --chart-series-1=${light.seriesVar} · bg=${light.background}`,
  );

  // 브라우저 dark 선호는 publish 의 chart 토큰에 영향을 주지 않아야 한다 (data-theme 기반 팔레트).
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(800);
  const osDark = await readChart();
  record(
    "OS dark 선호만으로는 series 토큰이 바뀌지 않는다 (팔레트는 data-theme 기반)",
    osDark.seriesVar === light.seriesVar && osDark.theme === null,
    `--chart-series-1 ${light.seriesVar} → ${osDark.seriesVar}`,
  );

  await page.screenshot({ path: `${OUT_DIR}/20-publish.png` });
  writeFileSync(`${OUT_DIR}/publish-findings.json`, JSON.stringify({ projectUrl, findings }, null, 2));
  const failed = findings.filter((f) => !f.pass);
  log(`결과 ${findings.length - failed.length}/${findings.length} PASS`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  log("ERROR", error?.message ?? error);
  await page.screenshot({ path: `${OUT_DIR}/20-publish-error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  fileServer.close();
}

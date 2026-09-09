#!/usr/bin/env node
// adr209-publish-live.mjs — ADR-209 후속 F2 의 **독립 Publish** 구간.
//
// Builder 를 전혀 거치지 않는 publish 런타임이 같은 export 문서를 읽고
// 해제 상태(`color: ""`)를 단일 시리즈로 그리는지 확인한다.
//
// 준비: `pnpm -F @composition/publish dev` (3001) 와
//       `node apps/builder/scripts/adr209-series-release-live.mjs` 로 만든
//       `/private/tmp/adr209-live/project.json`.
// 사용: node apps/builder/scripts/adr209-publish-live.mjs [--headed]
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const PUBLISH_URL = "http://localhost:3001";
const EXPORT_PATH = "/private/tmp/adr209-live/project.json";
const OUT_DIR = "/private/tmp/adr209-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-209 publish]", ...a);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const projectJson = readFileSync(EXPORT_PATH, "utf8");
// export 파일을 CORS 허용으로 흘려 준다 — publish 앱은 `?project=<url>` 을 fetch 한다.
const fileServer = createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(projectJson);
});
await new Promise((resolve) => fileServer.listen(0, "127.0.0.1", resolve));
const projectUrl = `http://127.0.0.1:${fileServer.address().port}/project.json`;

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const requests = [];
page.on("request", (r) => requests.push(r.url()));

try {
  await page.goto(`${PUBLISH_URL}/?project=${encodeURIComponent(projectUrl)}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".react-aria-Chart", { timeout: 30_000 });
  await page.waitForTimeout(3000);

  const chart = await page.evaluate(() => {
    const el = document.querySelector(".react-aria-Chart");
    if (!el) return { found: false };
    const svg = el.querySelector("svg");
    const fills = new Set(
      [...(svg?.querySelectorAll("rect,path") ?? [])]
        .map((n) => n.getAttribute("fill"))
        .filter((f) => f && f !== "none" && !/^transparent$/i.test(f)),
    );
    const box = el.getBoundingClientRect();
    return {
      found: true,
      rects: svg?.querySelectorAll("rect").length ?? 0,
      paths: svg?.querySelectorAll("path").length ?? 0,
      texts: svg?.querySelectorAll("text").length ?? 0,
      fills: [...fills],
      size: { w: Math.round(box.width), h: Math.round(box.height) },
      seriesVar: getComputedStyle(el).getPropertyValue("--chart-series-1").trim(),
    };
  });

  record(
    "독립 publish 런타임이 export 문서의 Chart 를 그린다 (T10)",
    chart.found && chart.rects + chart.paths > 0 && chart.size.w > 0,
    JSON.stringify(chart),
  );
  record(
    "해제 상태가 독립 런타임에서도 단일 시리즈다",
    chart.fills?.length === 1,
    `fill 종류 ${chart.fills?.length} (${(chart.fills ?? []).join(", ")})`,
  );
  record(
    "축 레이블 등 나머지 매핑이 살아 있다 (빈 상자 아님)",
    (chart.texts ?? 0) > 0,
    `text ${chart.texts}개 · --chart-series-1="${chart.seriesVar}"`,
  );

  await page.screenshot({ path: `${OUT_DIR}/20-publish.png` });
  writeFileSync(`${OUT_DIR}/publish-findings.json`, JSON.stringify({ projectUrl, findings, requests: requests.slice(0, 40) }, null, 2));
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

// WebKit 이 fetch() 로 받은 wasm 을 HTTP 캐시에서 다시 쓰는가 — 일반 context vs persistent context.
import { webkit, chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPagesServer } from "./adr244-pages-server.mjs";
const server = await startPagesServer({ dist: ".cache/adr244/dist" });
const url = `${server.base}wasm/canvaskit.wasm`;
const probe = async (page) => {
  await page
    .goto(`${server.base}license`, { waitUntil: "commit" })
    .catch(() => {});
  await page.goto(`${server.base}appIcon.svg`);
  const from = server.mark();
  const sizes = await page.evaluate(async (url) => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(url, { credentials: "same-origin" });
      await r.arrayBuffer();
      out.push(performance.getEntriesByName(url).at(-1)?.transferSize);
    }
    return out;
  }, url);
  // 문서를 새로 연 뒤 (재방문) 한 번 더
  await page.goto(`${server.base}appIcon.svg?again`);
  const again = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: "same-origin" });
    await r.arrayBuffer();
    return performance.getEntriesByName(url).at(-1)?.transferSize;
  }, url);
  return {
    transferSizes: sizes,
    afterReload: again,
    serverRequests: server
      .since(from)
      .filter((e) => e.path.endsWith("canvaskit.wasm"))
      .map((e) => e.status),
  };
};
for (const [name, type] of [
  ["webkit", webkit],
  ["chromium", chromium],
]) {
  const browser = await type.launch(
    name === "chromium" ? { channel: "chrome" } : {},
  );
  const ctx = await browser.newContext();
  console.log(
    name,
    "일반 context",
    JSON.stringify(await probe(await ctx.newPage())),
  );
  await browser.close();
  const persistent = await type.launchPersistentContext(
    mkdtempSync(join(tmpdir(), "adr244-")),
    name === "chromium" ? { channel: "chrome" } : {},
  );
  console.log(
    name,
    "persistent context",
    JSON.stringify(await probe(await persistent.newPage())),
  );
  await persistent.close();
}
await server.close();

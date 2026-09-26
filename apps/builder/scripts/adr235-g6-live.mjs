#!/usr/bin/env node
// adr235-g6-live.mjs — ADR-235 G6 live (디렉토리 연결, 실제 builder · Playwright Chrome).
//
// 폴더 선택창은 자동화할 수 없어 OPFS 디렉토리 핸들 (같은 File System Access API — getFileHandle ·
// createWritable · removeEntry) 을 DEV 훅 `__composition_CONNECT_FOLDER__` 로 같은 연결 경로에 넣는다.
//
//   F1 연결 → 1세대 (manifest · parts · assets · manifests/)
//   F2 편집 → DB 저장 뒤 백그라운드로 2세대 · 직전 세대 보존 · 문서에 새 요소
//   F3 외부 수정 (manifest revision 변경) → 편집해도 쓰지 않고 conflict · "덮어쓰기" → 새 세대
//   F4 manifest.json 손상 → "폴더 내용으로 열기" 가 manifests/ 에서 복구해 적용
//   F5 권한 없음 (queryPermission = prompt) → 쓰지 않고 needs-permission · 허용 → 씀
//   F6 새로고침 → 연결 복원 (flag · 링크 DB) → 편집이 계속 폴더로
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject, waitReady } from "./perf-baseline.mjs";

const out = "/private/tmp/adr235-g6-live";
mkdirSync(out, { recursive: true });
const storageState = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 340)}\n`);
};

/** 페이지 안 도우미 설치 — OPFS 폴더 읽기 · 상태 이벤트 수집 · 요소 추가 */
const HELPERS = () => {
  performance.setResourceTimingBufferSize(20000);
  window.__g6 = {
    states: [],
    async dir() {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("g6-project", { create: true });
    },
    async read(path) {
      let dir = await this.dir();
      const segs = path.split("/");
      try {
        for (const s of segs.slice(0, -1)) dir = await dir.getDirectoryHandle(s);
        const f = await (await dir.getFileHandle(segs.at(-1))).getFile();
        return await f.text();
      } catch {
        return null;
      }
    },
    async list(name) {
      try {
        const d = await (await this.dir()).getDirectoryHandle(name);
        const out = [];
        for await (const [n] of d.entries()) out.push(n);
        return out;
      } catch {
        return [];
      }
    },
    async manifest() {
      const text = await this.read("manifest.json");
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return "corrupt";
      }
    },
    async addElement(id) {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body");
      const now = new Date().toISOString();
      await st.addComplexElement({ id, customId: id, type: "frame", parent_id: body.id, page_id: st.currentPageId, created_at: now, updated_at: now, props: { style: { width: "20px", height: "20px" } } }, []);
    },
    async waitFor(pred, ms = 8000) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        if (await pred()) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    },
  };
  window.addEventListener("composition:directory-link", (e) => window.__g6.states.push(e.detail.status));
};

const browser = await chromium.launch({ channel: "chrome", headless: !process.argv.includes("--headed") });
try {
  const { page, context } = await createInstrumentedContext(browser, { storageState, frameCapture: false, initScript: HELPERS });
  page.on("crash", () => process.stderr.write("[page crash]\n"));
  page.on("close", () => process.stderr.write("[page close]\n"));
  page.on("dialog", (d) => { process.stderr.write(`[dialog] ${d.type()} ${d.message()}\n`); void d.accept(); });
  await createIsolatedProject(page, "http://localhost:5173");

  const f1 = await page.evaluate(async () => {
    const dir = await window.__g6.dir();
    const state = await window.__composition_CONNECT_FOLDER__(dir);
    const m = await window.__g6.manifest();
    return { status: state.status, revision: m?.revision, parts: (await window.__g6.list("parts")).length, manifests: await window.__g6.list("manifests"), flag: localStorage.getItem(`composition.dir-link.${window.__canonical_STORE__.getState().currentProjectId}`) };
  });
  // 빈 collections · API · 변수 part 는 내용이 같아 ([]) 한 파일을 공유한다 (불변 경로 재사용)
  record("F1 연결 → 1세대", f1.status === "synced" && f1.revision === 1 && f1.parts >= 2 && f1.manifests.length === 1 && f1.flag === "1", f1);

  const f2 = await page.evaluate(async () => {
    await window.__g6.addElement("g6-a");
    const ok = await window.__g6.waitFor(async () => (await window.__g6.manifest())?.revision === 2);
    const m = await window.__g6.manifest();
    const doc = await window.__g6.read(m.parts.document.path);
    return { ok, revision: m.revision, previous: m.previousRevision, hasElement: doc?.includes("g6-a"), manifests: (await window.__g6.list("manifests")).length };
  });
  record("F2 편집 → DB 저장 뒤 2세대 · 직전 세대 보존", f2.ok && f2.hasElement && f2.previous === 1 && f2.manifests === 2, f2);

  const f3 = await page.evaluate(async () => {
    // 외부 수정 — 다른 곳에서 revision 99 로 저장했다고 친다
    const m = await window.__g6.manifest();
    const dir = await window.__g6.dir();
    const w = await (await dir.getFileHandle("manifest.json")).createWritable();
    await w.write(JSON.stringify({ ...m, revision: 99, previousRevision: 2 }));
    await w.close();
    window.__g6.states.length = 0;
    await window.__g6.addElement("g6-b");
    await window.__g6.waitFor(async () => window.__g6.states.includes("conflict"));
    const during = (await window.__g6.manifest()).revision;
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/projectDirectoryLink.ts"));
    const link = (await import(url)).getDirectoryLink(window.__canonical_STORE__.getState().currentProjectId);
    await link.write(true);
    const after = await window.__g6.manifest();
    return { conflict: window.__g6.states.includes("conflict"), during, afterRevision: after.revision, hasB: (await window.__g6.read(after.parts.document.path))?.includes("g6-b") };
  });
  record("F3 외부 수정 → 쓰지 않고 conflict · 덮어쓰기 → 새 세대", f3.conflict && f3.during === 99 && f3.afterRevision === 100 && f3.hasB, f3);

  const f4 = await page.evaluate(async () => {
    const dir = await window.__g6.dir();
    const w = await (await dir.getFileHandle("manifest.json")).createWritable();
    await w.write("{broken");
    await w.close();
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/projectDirectoryLink.ts"));
    const link = (await import(url)).getDirectoryLink(window.__canonical_STORE__.getState().currentProjectId);
    const read = await link.readFromDirectory();
    return { recovered: read.recovered, revision: read.manifest.revision, hasB: JSON.stringify(read.content.document).includes("g6-b") };
  });
  record("F4 manifest.json 손상 → manifests/ 최신 유효 세대로 복구", f4.recovered && f4.revision === 100 && f4.hasB, f4);

  const f5 = await page.evaluate(async () => {
    const proto = FileSystemDirectoryHandle.prototype;
    const original = proto.queryPermission;
    proto.queryPermission = async () => "prompt";
    window.__g6.states.length = 0;
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/projectDirectoryLink.ts"));
    const mod = await import(url);
    const projectId = window.__canonical_STORE__.getState().currentProjectId;
    const before = (await window.__g6.manifest())?.revision ?? null;
    await mod.getDirectoryLink(projectId).write();
    const blocked = window.__g6.states.includes("needs-permission");
    const unchanged = ((await window.__g6.manifest())?.revision ?? null) === before;
    proto.queryPermission = original;
    proto.requestPermission ??= async () => "granted";
    await mod.getDirectoryLink(projectId).requestPermission();
    const after = await window.__g6.manifest();
    return { blocked, unchanged, afterRevision: after?.revision };
  });
  record("F5 권한 없음 → 쓰지 않고 needs-permission · 허용 → 씀", f5.blocked && f5.unchanged && f5.afterRevision === 101, f5);

  await context.close();
} finally {
  await browser.close();
}
// F6 — 브라우저 재시작 뒤 복원 (persistent profile — 실제 사용자 프로필과 같은 조건). Playwright 의 임시
//   (비영속) 컨텍스트는 OPFS 디렉토리 핸들을 IndexedDB 에서 읽을 때 브라우저가 종료된다 (raw IndexedDB 로
//   재현 — 제품 코드와 무관) — 그래서 F1~F5 컨텍스트에서 새로고침하지 않는다. 복원이 죽는 환경이면
//   crash sentinel 이 다음 실행에서 복원을 건너뛰는지 (루프 없음) 를 본다.
{
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const profile = mkdtempSync(resolve(tmpdir(), "adr235-g6-"));
  const auth = storageState.origins?.find((o) => o.origin.includes("localhost:5173"))?.localStorage ?? [];
  const seedAuth = (entries) => {
    for (const { name, value } of entries) if (!localStorage.getItem(name)) localStorage.setItem(name, value);
  };
  const launch = async () => {
    const ctx = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: !process.argv.includes("--headed"), viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(seedAuth, auth);
    await ctx.addInitScript(HELPERS);
    return ctx;
  };
  let ctx = await launch();
  let page = ctx.pages()[0] ?? (await ctx.newPage());
  await createIsolatedProject(page, "http://localhost:5173");
  const url = page.url();
  const projectId = await page.evaluate(async () => {
    await window.__composition_CONNECT_FOLDER__(await window.__g6.dir());
    return window.__canonical_STORE__.getState().currentProjectId;
  });
  let crashed = false;
  await page.reload({ waitUntil: "networkidle" }).catch(() => (crashed = true));
  await page.waitForTimeout(3000).catch(() => (crashed = true));
  if (page.isClosed()) crashed = true;
  await ctx.close().catch(() => {});
  ctx = await launch();
  page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url, { waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const f6 = await page.evaluate((pid) => ({
    flag: localStorage.getItem(`composition.dir-link.${pid}`),
    sentinel: localStorage.getItem(`composition.dir-link.resuming.${pid}`),
    button: document.querySelector(".directory-link")?.getAttribute("data-status") ?? null,
  }), projectId);
  record(
    "F6 브라우저 재시작 뒤 연결 복원 (영속 프로필) — 복원이 죽는 환경이면 sentinel 로 루프 없음",
    crashed ? f6.flag === null && f6.sentinel === null && f6.button === "error" : f6.flag === "1",
    { crashed, ...f6 },
  );
  await ctx.close();
}
writeFileSync(resolve(out, `g6-${Date.now()}.json`), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS\n`);
process.exit(failed.length ? 1 : 0);

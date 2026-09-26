#!/usr/bin/env node
// adr235-evict-live.mjs — ADR-235 Decision 4 후속 live (오래 닫힌 폴더 연결 프로젝트의 IndexedDB 비우기).
//
// 영속 프로필 (Playwright 비영속 컨텍스트는 OPFS 디렉토리 핸들을 IndexedDB 에서 읽을 때 종료된다 — G6 기록)
// · 폴더 선택창 대신 OPFS 디렉토리 핸들을 DEV 훅 `__composition_CONNECT_FOLDER__` 로 같은 연결 경로에.
//
//   V1 연결 프로젝트 A 편집 → 폴더 세대 + 연결 기록에 IndexedDB 도장
//   V2 A 가 열려 있는 동안 (다른 탭) — 기간이 지나도 비우지 않는다 (Web Locks)
//   V3 A 를 닫고 기간 경과 (기록 시각을 40일 전으로) → B 에서 GC 실행 → A 의 문서 · 백업 · collections 비움,
//      projects 행 (요약) 은 남음 · 기록 clearedAt
//   V4 A 를 열면 폴더 버튼 cleared · 폴더에 쓰지 않음 → "폴더 내용으로 열기" → 요소 복원 · 다시 폴더에 씀
//   V5 A 편집 뒤 (도장 불일치) 기간이 지나도 비우지 않는다 — 폴더에 없는 DB 변경 보호
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedProject, waitReady } from "./perf-baseline.mjs";

const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const out = "/private/tmp/adr235-evict-live";
mkdirSync(out, { recursive: true });
const storageState = JSON.parse(
  readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
);
const auth =
  storageState.origins?.find((o) => o.origin.includes("localhost:5173"))
    ?.localStorage ?? [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 400)}\n`,
  );
};

const HELPERS = () => {
  const openDb = (name) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const tx = async (dbName, store, mode, run) => {
    const db = await openDb(dbName);
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      t.oncomplete = () => {
        db.close();
        resolve(req?.result);
      };
      t.onerror = () => reject(t.error);
    });
  };
  window.__ev = {
    async dir(name) {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle(name, { create: true });
    },
    async manifestRevision(name) {
      try {
        const dir = await this.dir(name);
        const f = await (await dir.getFileHandle("manifest.json")).getFile();
        return JSON.parse(await f.text()).revision;
      } catch {
        return null;
      }
    },
    link: (id) =>
      tx("composition-links", "links", "readonly", (s) => s.get(id)),
    async ageLink(id, days) {
      const rec = await this.link(id);
      const old = new Date(Date.now() - days * 86400000).toISOString();
      await tx("composition-links", "links", "readwrite", (s) =>
        s.put({ ...rec, linkedAt: old, syncedAt: old, lastOpenedAt: old }),
      );
    },
    head: (id) =>
      tx("composition", "document_heads", "readonly", (s) => s.get(id)),
    project: (id) =>
      tx("composition", "projects", "readonly", (s) => s.get(id)),
    backups: (id) =>
      tx("composition", "documents_backup", "readonly", (s) =>
        s.index("project_id").count(id),
      ),
    async addElement(id) {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.page_id === st.currentPageId && e.type === "body",
      );
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id,
          customId: id,
          type: "frame",
          parent_id: body.id,
          page_id: st.currentPageId,
          created_at: now,
          updated_at: now,
          props: { style: { width: "20px", height: "20px" } },
        },
        [],
      );
    },
    hasElement: (id) =>
      window.__composition_STORE__.getState().elements.some((e) => e.id === id),
    async waitFor(pred, ms = 10000) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        if (await pred()) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    },
  };
};

const profile = mkdtempSync(resolve(tmpdir(), "adr235-evict-"));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chrome",
  headless: !process.argv.includes("--headed"),
  viewport: { width: 1440, height: 900 },
});
await ctx.addInitScript((entries) => {
  for (const { name, value } of entries)
    if (!localStorage.getItem(name)) localStorage.setItem(name, value);
}, auth);
await ctx.addInitScript(HELPERS);
const errors = [];
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on("pageerror", (e) => errors.push(String(e)));

  // A — 연결 · 편집
  const { projectUrl: urlA } = await createIsolatedProject(page, BASE);
  const idA = await page.evaluate(
    () => window.__canonical_STORE__.getState().currentProjectId,
  );
  const v1 = await page.evaluate(async () => {
    await window.__composition_CONNECT_FOLDER__(
      await window.__ev.dir("evict-a"),
    );
    await window.__ev.addElement("evict-el");
    const ok = await window.__ev.waitFor(
      async () => (await window.__ev.manifestRevision("evict-a")) >= 2,
    );
    const pid = window.__canonical_STORE__.getState().currentProjectId;
    await window.__ev.waitFor(
      async () => !!(await window.__ev.link(pid))?.syncedStamp,
    );
    const link = await window.__ev.link(pid);
    return {
      ok,
      revision: link?.lastRevision,
      stamp: link?.syncedStamp,
      head: (await window.__ev.head(pid))?.revision,
    };
  });
  record(
    "V1 편집 → 폴더 세대 + 도장 (DB head = 도장)",
    v1.ok && !!v1.stamp && v1.stamp.documentRevision === v1.head,
    v1,
  );

  // V2 — A 가 다른 탭에서 열려 있다
  const other = await ctx.newPage();
  await createIsolatedProject(other, BASE);
  const v2 = await other.evaluate(async (pid) => {
    await window.__ev.ageLink(pid, 40);
    await window.__composition_ASSET_GC__({ graceMs: 0 });
    return {
      head: !!(await window.__ev.head(pid)),
      clearedAt: (await window.__ev.link(pid))?.clearedAt ?? null,
    };
  }, idA);
  record(
    "V2 A 가 열려 있으면 기간이 지나도 비우지 않음 (Web Locks)",
    v2.head && v2.clearedAt === null,
    v2,
  );

  // V3 — A 를 닫고 (이 탭에서 B 로 이동) GC
  await page.close();
  const v3 = await other.evaluate(async (pid) => {
    await window.__ev.ageLink(pid, 40);
    await window.__composition_ASSET_GC__({ graceMs: 0 });
    return {
      head: !!(await window.__ev.head(pid)),
      backups: await window.__ev.backups(pid),
      project: !!(await window.__ev.project(pid)),
      clearedAt: (await window.__ev.link(pid))?.clearedAt ?? null,
    };
  }, idA);
  record(
    "V3 닫힌 뒤 기간 경과 → 문서 · 백업 비움 · projects 행 유지 · clearedAt",
    !v3.head && v3.backups === 0 && v3.project && !!v3.clearedAt,
    v3,
  );

  // V4 — A 열기 → cleared → 폴더 내용으로 열기
  const pageA = other;
  await pageA.goto(urlA, { waitUntil: "networkidle" });
  await waitReady(pageA);
  const before = await pageA.evaluate(async () => {
    const ok = await window.__ev.waitFor(
      () =>
        document
          .querySelector(".directory-link")
          ?.getAttribute("data-status") === "cleared",
    );
    return {
      ok,
      element: window.__ev.hasElement("evict-el"),
      revision: await window.__ev.manifestRevision("evict-a"),
    };
  });
  // 비운 상태에서 편집해도 폴더에 쓰지 않는다
  await pageA.evaluate(() => window.__ev.addElement("scratch-el"));
  await pageA.waitForTimeout(3000);
  const untouched = await pageA.evaluate(() =>
    window.__ev.manifestRevision("evict-a"),
  );
  await pageA.locator(".directory-link").click();
  await pageA
    .getByRole("menuitem", { name: /folder's version|폴더 내용으로/ })
    .click();
  const after = await pageA.evaluate(async (pid) => {
    const restored = await window.__ev.waitFor(() =>
      window.__ev.hasElement("evict-el"),
    );
    await window.__ev.addElement("after-el");
    const rev = await window.__ev.waitFor(
      async () => (await window.__ev.manifestRevision("evict-a")) > 2,
    );
    return {
      restored,
      status: document
        .querySelector(".directory-link")
        ?.getAttribute("data-status"),
      head: !!(await window.__ev.head(pid)),
      revision: await window.__ev.manifestRevision("evict-a"),
      clearedAt: (await window.__ev.link(pid))?.clearedAt ?? null,
      rev,
    };
  }, idA);
  record(
    "V4 열면 cleared · 편집해도 폴더 그대로 → 폴더 내용으로 열기 → 복원 · 다시 폴더에 씀",
    before.ok &&
      !before.element &&
      untouched === before.revision &&
      after.restored &&
      after.head &&
      after.clearedAt === null &&
      after.rev,
    { before, untouched, after },
  );

  // V5 — A 가 폴더에 없는 DB 변경을 가진 채 닫힘 (도장 불일치) → 비우지 않음
  const v5 = await pageA.evaluate(async (pid) => {
    const link = await window.__ev.link(pid);
    // 폴더 쓰기 뒤 DB 만 바뀐 상태를 만든다 — 도장을 옛 값으로
    const db = await new Promise((r) => {
      const q = indexedDB.open("composition-links");
      q.onsuccess = () => r(q.result);
    });
    await new Promise((r) => {
      const t = db.transaction("links", "readwrite");
      t.objectStore("links").put({
        ...link,
        syncedStamp: { ...link.syncedStamp, documentRevision: "stale" },
      });
      t.oncomplete = r;
    });
    db.close();
    return pid;
  }, idA);
  const third = await ctx.newPage();
  await createIsolatedProject(third, BASE);
  await pageA.close();
  const v5r = await third.evaluate(async (pid) => {
    await window.__ev.ageLink(pid, 40);
    await window.__composition_ASSET_GC__({ graceMs: 0 });
    return {
      head: !!(await window.__ev.head(pid)),
      clearedAt: (await window.__ev.link(pid))?.clearedAt ?? null,
    };
  }, v5);
  record(
    "V5 도장 불일치 (폴더에 없는 DB 변경) → 비우지 않음",
    v5r.head && v5r.clearedAt === null,
    v5r,
  );
  // V6 — 판독 HIGH-2 반증: 연결 프로젝트 C 에서 SPA 로 다른 프로젝트 D 로 옮긴 뒤 폰트 이벤트 (프로젝트
  //   id 없는 쓰기 계기) → C 의 남은 연결이 D 내용을 C 폴더에 쓰지 않는다
  const pageC = await ctx.newPage();
  pageC.on("pageerror", (e) => errors.push(String(e)));
  await createIsolatedProject(pageC, BASE);
  const revC = await pageC.evaluate(async () => {
    await window.__composition_CONNECT_FOLDER__(
      await window.__ev.dir("evict-c"),
    );
    await window.__ev.addElement("c-el");
    await window.__ev.waitFor(
      async () => (await window.__ev.manifestRevision("evict-c")) >= 2,
    );
    return window.__ev.manifestRevision("evict-c");
  });
  await pageC.evaluate(() => {
    history.pushState({}, "", "/dashboard");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  const create = pageC.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 15_000 });
  await create.click();
  await pageC.locator("#new-project-name").fill(`evict-d-${Date.now()}`);
  await pageC.locator("#new-project-name").press("Enter");
  await pageC.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
  await waitReady(pageC);
  const v6 = await pageC.evaluate(async () => {
    await window.__ev.addElement("d-el");
    window.dispatchEvent(new CustomEvent("composition:custom-fonts-updated"));
    await new Promise((r) => setTimeout(r, 4000));
    return { revision: await window.__ev.manifestRevision("evict-c") };
  });
  record(
    "V6 SPA 로 다른 프로젝트로 옮긴 뒤 쓰기 계기 → 이전 연결이 폴더에 쓰지 않음",
    revC >= 2 && v6.revision === revC,
    { revC, ...v6 },
  );
  record("page error 0", errors.length === 0, errors.slice(0, 3));
} finally {
  await ctx.close();
}
writeFileSync(
  resolve(out, `evict-${Date.now()}.json`),
  JSON.stringify(results, null, 2),
);
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);

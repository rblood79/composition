#!/usr/bin/env node
// adr229-bc-live.mjs — ADR-229 Phase 4 G4 live (실제 빌더, headed Playwright): **ADR-229 이전에 만든 기존 프로젝트**
//   를 연다 — Playwright 프로필의 IndexedDB 는 run 마다 비어 있어 옛 프로젝트가 없으므로, 새 프로젝트를 만들고
//   **저장 경로 (store 액션) 로 229 이전 모양** (Tag item origin 0 · TagGroup slot 없음 · 조합 origin 자식 plain =
//   ADR-228 이 만들던 문서) 으로 되돌린 뒤 reload 해 229 hydration 을 통과시킨다.
//   B-a) 기존 origin 의 plain 자식은 ref 로 바뀌지 않는다 (Form · Toolbar · ButtonGroup 자식 type 에 ref 0) — 기존 저작 불변
//   B-b) Tag item origin 2 (Icon/Avatar/Text) + `component-taggroup.slot` 은 보충됐다 (없던 template 만)
//   B-c) reload → Components body Δnode 0 · Δbyte 0 · 직렬화 동일 (재hydration)
//   B-d) 그 문서에 TagGroup instance 를 놓으면 chip 이 Tag item origin 을 읽는다 (두 leg 30) — 해소기 유지
//   page error 0
// 사용: node apps/builder/scripts/adr229-bc-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-bc-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 bc]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};
const state = (page, fn, arg) => page.evaluate(fn, arg);
const componentsBodySnapshot = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const byParent = new Map();
    for (const e of st.elements) {
      const arr = byParent.get(e.parent_id) ?? [];
      arr.push(e);
      byParent.set(e.parent_id, arr);
    }
    const walk = (id) =>
      (byParent.get(id) ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        ref: e.ref ?? null,
        slot: e.slot ?? null,
        props: e.props ?? {},
        descendants: e.descendants ?? null,
        children: walk(e.id),
      }));
    const tree = walk(body?.id);
    const count = (nodes) =>
      nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    return { n: count(tree), bytes: JSON.stringify(tree).length, tree };
  });
const childTypes = (tree, id) => {
  const find = (nodes) => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = find(n.children);
      if (f) return f;
    }
    return null;
  };
  const node = find(tree);
  return node ? node.children.map((c) => `${c.type}:${c.ref ?? ""}`) : null;
};
const findIn = (tree, id) => {
  const find = (nodes) => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = find(n.children);
      if (f) return f;
    }
    return null;
  };
  return find(tree);
};
async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr229bc-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const chosenTitle = page.url().split("/builder/")[1];
  log("project", chosenTitle);

  // ── 229 이전 모양으로 되돌린다 — 저장된 canonical 문서를 직접 고쳐 쓴다 (system origin 은 store 삭제가 막혀 있다):
  //    Tag item origin 2 삭제 · TagGroup root slot 제거 · Form/Toolbar/ButtonGroup origin 의 ref 자식 → plain (228 모양). ──
  const projectId = chosenTitle;
  const canonicalSnapshot = (doc) => {
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === "page-components-body") return n;
        const f = find(n.children ?? []);
        if (f) return f;
      }
      return null;
    };
    const body = find(doc.children);
    const walk = (nodes) =>
      (nodes ?? []).map((n) => ({
        id: n.id,
        type: n.type,
        ref: n.ref ?? null,
        slot: n.slot ?? null,
        props: n.props ?? {},
        descendants: n.descendants ?? null,
        children: walk(n.children),
      }));
    const tree = walk(body?.children);
    const count = (nodes) =>
      nodes.reduce((k, c) => k + 1 + count(c.children), 0);
    return { n: count(tree), bytes: JSON.stringify(tree).length, tree };
  };
  const rewritten = await state(
    page,
    async (projectId) => {
      const { getDB } = await import("/src/lib/db/index.ts");
      const db = await getDB();
      const doc = await db.documents.get(projectId);
      if (!doc) return { error: "문서 없음" };
      const byId = new Map();
      const index = (nodes) => {
        for (const n of nodes) {
          byId.set(n.id, n);
          index(n.children ?? []);
        }
      };
      index(doc.children);
      const mergeProps = (base, patch) => ({
        ...base,
        ...patch,
        ...(base?.style || patch?.style
          ? { style: { ...(base?.style ?? {}), ...(patch?.style ?? {}) } }
          : {}),
      });
      const OPEN = new Set([
        "component-form",
        "component-toolbar",
        "component-buttongroup",
      ]);
      const openRef = (node) => {
        const target = byId.get(node.ref);
        if (!target) return node;
        const { ref: _r, descendants: _d, type: _t, ...rest } = node;
        return {
          ...rest,
          type: target.type,
          ...(target.slot !== undefined ? { slot: target.slot } : {}),
          props: JSON.parse(
            JSON.stringify(mergeProps(target.props ?? {}, node.props ?? {})),
          ),
          children: (target.children ?? []).map((c, i) =>
            renameSubtree(c, `${node.id}__${i + 1}`),
          ),
        };
      };
      const renameSubtree = (n, id) => ({
        ...(n.type === "ref" ? openRef({ ...n, id }) : { ...n, id }),
        ...(n.type === "ref"
          ? {}
          : {
              children: (n.children ?? []).map((c, i) =>
                renameSubtree(c, `${id}__${i + 1}`),
              ),
            }),
      });
      const opened = {};
      const walk = (nodes) =>
        nodes
          .filter(
            (n) =>
              n.id !== "component-tag-item-default" &&
              n.id !== "component-tag-item-selected",
          )
          .map((n) => {
            let next = n;
            if (n.id === "component-taggroup") {
              const { slot: _s, ...rest } = n;
              next = rest;
            }
            if (OPEN.has(n.id)) {
              opened[n.id] = (n.children ?? []).filter(
                (c) => c.type === "ref",
              ).length;
              next = {
                ...next,
                children: (n.children ?? []).map((c) =>
                  c.type === "ref" ? openRef(c) : c,
                ),
              };
            }
            return next.children
              ? { ...next, children: walk(next.children) }
              : next;
          });
      const doc2 = { ...doc, children: walk(doc.children) };
      await db.documents.put(projectId, doc2);
      const back = await db.documents.get(projectId);
      return { opened, doc: back };
    },
    projectId,
  );
  if (rewritten.error) throw new Error(rewritten.error);
  const pre = canonicalSnapshot(rewritten.doc);
  const preShapeOk =
    !findIn(pre.tree, "component-tag-item-default") &&
    !findIn(pre.tree, "component-tag-item-selected") &&
    findIn(pre.tree, "component-taggroup")?.slot == null &&
    [
      childTypes(pre.tree, "component-form"),
      childTypes(pre.tree, "component-toolbar"),
      childTypes(pre.tree, "component-buttongroup"),
    ].every(
      (list) =>
        Array.isArray(list) &&
        list.length > 0 &&
        list.every((t) => !t.startsWith("ref:")),
    );
  record(
    "B-0: 229 이전 모양 (저장된 canonical 문서 재작성) — Tag item origin 0 · TagGroup slot 없음 · Form/Toolbar/ButtonGroup 자식 plain (ref 자식 각각 열림)",
    preShapeOk &&
      rewritten.opened["component-form"] === 3 &&
      rewritten.opened["component-toolbar"] === 3 &&
      rewritten.opened["component-buttongroup"] === 2,
    JSON.stringify({
      opened: rewritten.opened,
      n: pre.n,
      bytes: pre.bytes,
      form: childTypes(pre.tree, "component-form"),
      toolbar: childTypes(pre.tree, "component-toolbar"),
      buttonGroup: childTypes(pre.tree, "component-buttongroup"),
    }),
  );
  await page.waitForTimeout(3000);
  // ── 첫 reload = 229 hydration (기존 문서를 여는 것과 같다) ──
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  await page.waitForTimeout(3000);
  const readPersisted = () =>
    state(
      page,
      async (projectId) => {
        const { getDB } = await import("/src/lib/db/index.ts");
        const db = await getDB();
        return db.documents.get(projectId);
      },
      projectId,
    );
  const first = canonicalSnapshot(await readPersisted());
  const formChildren = childTypes(first.tree, "component-form");
  const toolbarChildren = childTypes(first.tree, "component-toolbar");
  const buttonGroupChildren = childTypes(first.tree, "component-buttongroup");
  const allPlain = [formChildren, toolbarChildren, buttonGroupChildren].every(
    (list) =>
      Array.isArray(list) &&
      list.length > 0 &&
      list.every((t) => !t.startsWith("ref:")),
  );
  record(
    "B-a: 229 hydration 뒤 조합 origin (Form · Toolbar · ButtonGroup) 자식은 plain 그대로 (ref 0) — 기존 저작 불변 · 사용자 페이지/기존 노드 직렬화 동일",
    allPlain &&
      JSON.stringify(pre.tree.map((n) => n.id)) ===
        JSON.stringify(first.tree.slice(0, pre.tree.length).map((n) => n.id)),
    JSON.stringify({
      project: chosenTitle,
      formChildren,
      toolbarChildren,
      buttonGroupChildren,
    }),
  );
  const tagDefault = findIn(first.tree, "component-tag-item-default");
  const tagSelected = findIn(first.tree, "component-tag-item-selected");
  const tagGroup = findIn(first.tree, "component-taggroup");
  record(
    "B-b: Tag item origin 2 (Icon/Avatar/Text) + component-taggroup.slot [default, selected] 보충 — 없던 template 만",
    tagDefault?.children.map((c) => c.type).join(",") === "Icon,Avatar,Text" &&
      tagSelected?.children.map((c) => c.type).join(",") ===
        "Icon,Avatar,Text" &&
      JSON.stringify(tagGroup?.slot) ===
        JSON.stringify([
          "component-tag-item-default",
          "component-tag-item-selected",
        ]) &&
      tagGroup?.children.every((c) => c.slot == null),
    JSON.stringify({
      tagDefault: tagDefault?.children.map((c) => c.type),
      tagSelected: tagSelected?.children.map((c) => c.type),
      slot: tagGroup?.slot,
      tagGroupChildren: tagGroup?.children.map(
        (c) => `${c.type}:${c.slot ?? ""}`,
      ),
      deltaNode: first.n - pre.n,
      deltaBytes: first.bytes - pre.bytes,
    }),
  );
  record(
    "B-b′: 최초 보충량 Δnode 8 (Tag item origin root 2 + slot 자식 6) · 기존 노드 (id 별 props/children 순서) 불변, TagGroup 은 slot 만 추가",
    first.n - pre.n === 8 &&
      (() => {
        const flat = (nodes, into = new Map()) => {
          for (const n of nodes) {
            const { children, ...rest } = n;
            into.set(
              n.id,
              JSON.stringify({ ...rest, childIds: children.map((c) => c.id) }),
            );
            flat(children, into);
          }
          return into;
        };
        const a = flat(pre.tree);
        const b = flat(first.tree);
        const preIds = new Set(a.keys());
        const bFiltered = (nodes, into = new Map()) => {
          for (const n of nodes) {
            const { children, ...rest } = n;
            into.set(
              n.id,
              JSON.stringify({
                ...rest,
                childIds: children
                  .map((c) => c.id)
                  .filter((id) => preIds.has(id)),
              }),
            );
            bFiltered(children, into);
          }
          return into;
        };
        const b2 = bFiltered(first.tree);
        const changed = [...a.keys()].filter((id) => a.get(id) !== b2.get(id));
        return changed.length === 1 && changed[0] === "component-taggroup";
      })(),
    JSON.stringify({
      deltaNode: first.n - pre.n,
      deltaBytes: first.bytes - pre.bytes,
    }),
  );

  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(3000);
  const second = canonicalSnapshot(await readPersisted());
  record(
    "B-c: reload → Components body Δnode 0 · Δbyte 0 · 직렬화 동일 (재hydration)",
    first.n === second.n &&
      first.bytes === second.bytes &&
      JSON.stringify(first.tree) === JSON.stringify(second.tree),
    JSON.stringify({
      n: [first.n, second.n],
      bytes: [first.bytes, second.bytes],
    }),
  );

  // B-d: 그 문서에 TagGroup instance → chip 두 leg (Tag item origin read-through).
  const INSTANCE_ID = `adr229-bc-tg-${Date.now()}`;
  await state(
    page,
    (INSTANCE_ID) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: INSTANCE_ID,
        customId: INSTANCE_ID,
        type: "ref",
        ref: "component-taggroup",
        componentName: "TagGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: {
          items: [
            { id: "a", label: "Alpha", icon: "star" },
            { id: "b", label: "Beta" },
          ],
          maxRows: 0,
        },
        created_at: now,
        updated_at: now,
      });
    },
    INSTANCE_ID,
  );
  await page.waitForTimeout(1500);
  await ensureCompareMode(page);
  const readBoth = () =>
    state(
      page,
      (INSTANCE_ID) => {
        const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
        const prefix = `projection:tag-row:${INSTANCE_ID}/component-taggroup__2:`;
        const skia = [];
        for (const [key, l] of map.entries()) {
          if (
            String(key).startsWith(prefix) &&
            !String(key).endsWith("__show_all__")
          )
            skia.push({
              key: String(key).slice(prefix.length),
              h: Math.round(l.height * 100) / 100,
            });
        }
        let preview = null;
        for (const f of document.querySelectorAll("iframe")) {
          const doc = f.contentDocument;
          const wrapper = doc?.querySelector(
            `[data-element-id="${INSTANCE_ID}"]`,
          );
          const tags = wrapper?.querySelectorAll(".react-aria-Tag");
          if (!tags?.length) continue;
          preview = [...tags]
            .filter(
              (t) =>
                t.getBoundingClientRect().width > 0 &&
                !t.closest('[aria-hidden="true"]'),
            )
            .map((t) => ({
              text: t.textContent.trim(),
              h: Math.round(t.getBoundingClientRect().height * 100) / 100,
              icon: !!t.querySelector(".tag-leading-icon"),
            }));
        }
        return { skia, preview };
      },
      INSTANCE_ID,
    );
  let both = await readBoth();
  for (
    let i = 0;
    i < 24 && !(both.skia.length === 2 && both.preview?.length === 2);
    i += 1
  ) {
    await page.waitForTimeout(500);
    both = await readBoth();
  }
  record(
    "B-d: 기존 문서에 TagGroup instance → chip 2 두 leg (Skia 30 = Preview 30 · Alpha icon) — Tag item origin read-through",
    both.skia.length === 2 &&
      both.preview?.length === 2 &&
      both.skia.every((c) => Math.abs(c.h - 30) <= 0.5) &&
      both.preview.every((c) => Math.abs(c.h - 30) <= 0.5) &&
      both.preview.find((c) => c.text === "Alpha")?.icon === true,
    JSON.stringify(both),
  );
  // 정리 — 기존 프로젝트에 남기지 않는다.
  await state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      st.removeElement(id);
      st.setSelectedElement(null);
    },
    INSTANCE_ID,
  );
  await page.waitForTimeout(1500);

  record(
    "page error 0",
    errors.length === 0,
    `${errors.length} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page
    .screenshot({ path: resolve(OUT_DIR, "error.png") })
    .catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}

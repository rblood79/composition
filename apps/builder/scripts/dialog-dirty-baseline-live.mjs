#!/usr/bin/env node
// dialog-dirty-baseline-live.mjs — 팔레트로 만든 Dialog 본문의 Styles "수정" 수 (2026-09-25 게이트 drift 수리).
//   팔레트 Dialog = `DialogTrigger > [Button, Dialog]` · Dialog 인라인 width 400 · maxWidth 100% 가 dirty baseline
//   미러에 없어 갓 만든 Dialog 가 "수정 2" 였다. 새 프로젝트 → 팔레트 Dialog → Dialog 선택 → Styles 탭 aria-label 의
//   수정 수 0 · page error 0. (Compare Mode · Preview 미개방)
// 사용: node apps/builder/scripts/dialog-dirty-baseline-live.mjs [--base http://localhost:5173] [--auth <storageState.json>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[dialog dirty live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1200)}`,
  );
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);
const ev = (fn, a) => page.evaluate(fn, a);

// 팔레트 Dialog 클릭 (body 선택 상태 — 페이지에 추가)
await openPanels(page, ["Components"]);
const panel = page.locator('[data-panel-id="components"]');
const search = panel.locator("input").first();
await search.waitFor({ state: "visible", timeout: 20_000 });
await search.fill("Dialog");
await page.waitForTimeout(400);
const items = panel.locator(".list-item");
let clicked = false;
for (let i = 0; i < (await items.count()); i++) {
  const text =
    (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
  if (text.trim().toLowerCase() === "dialog") {
    await items.nth(i).click();
    clicked = true;
    break;
  }
}
await page.waitForTimeout(2000);

// 팔레트 Dialog = `component-dialog` origin 의 ref instance (ADR-228). 수정 수를 볼 대상 = origin 의 Dialog 노드
//   (Components 페이지 — factory 인라인으로 seed) 와 instance 안 합성 Dialog 노드 (origin 값 상속).
const created = await ev(() => {
  const st = window.__composition_STORE__.getState();
  const instance = [...st.elementsMap.values()].find(
    (e) => e.page_id === st.currentPageId && e.ref === "component-dialog",
  );
  const all = [...st.elementsMap.values()];
  const origin = st.elementsMap.get("component-dialog");
  const originDialog =
    origin?.type === "Dialog"
      ? origin
      : all.find((e) => e.parent_id === "component-dialog" && e.type === "Dialog");
  return {
    instance: instance?.id ?? null,
    originType: origin?.type ?? null,
    originDialog: originDialog
      ? { id: originDialog.id, style: originDialog.props?.style }
      : null,
  };
});
record(
  "팔레트 Dialog = component-dialog instance · origin Dialog 인라인 width 400",
  clicked &&
    Boolean(created.instance) &&
    created.originDialog?.style?.width === "400px",
  { clicked, created },
);

async function modifiedLabels(id) {
  await ev(
    (id) =>
      window.__composition_STORE__.getState().setSelectedElement(id, {}, {}, {}),
    id,
  );
  await page.waitForTimeout(800);
  await openPanels(page, ["Styles"]);
  await page.waitForTimeout(1200);
  return page
    .locator(".styles-panel-tab")
    .evaluateAll((tabs) => tabs.map((t) => t.getAttribute("aria-label")));
}
const noCount = (labels) =>
  labels.length > 0 && !labels.some((l) => /\(\d+\)$/.test(l ?? ""));

if (created.originDialog) {
  const originLabels = await modifiedLabels(created.originDialog.id);
  record("origin Dialog 의 Styles 수정 수 0", noCount(originLabels), {
    originLabels,
  });
}
if (created.instance) {
  const synthetic = await ev(
    ({ instance, originDialogId }) => {
      const st = window.__composition_STORE__.getState();
      // 합성 id = `<instance>/<segment>` — origin root 가 Dialog 면 instance 자신.
      return originDialogId === "component-dialog"
        ? instance
        : `${instance}/${st.elementsMap.get(originDialogId)?.customId || originDialogId}`;
    },
    { instance: created.instance, originDialogId: created.originDialog?.id },
  );
  const instanceLabels = await modifiedLabels(synthetic);
  record(
    "instance 의 Dialog 노드 Styles 수정 수 0",
    noCount(instanceLabels),
    { synthetic, instanceLabels },
  );
}

record("page error 0", errors.length === 0, errors.slice(0, 3));
const failed = findings.filter((f) => !f.pass).length;
console.log(`[dialog dirty live] ${findings.length - failed}/${findings.length} PASS`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);

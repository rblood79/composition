#!/usr/bin/env node
// adr208-visiblewhen-live.mjs — ADR-208 P1 live exercise (G2 ②③④).
//
// 단위 테스트가 못 보는 것만 본다: 실제 빌더에서 Chart 를 놓고 chartType 을 바꿨을 때
// **Properties 패널의 필드 집합이 실제로 갈리는가**. 단위는 `resolveEditContract` 를
// 직접 호출하지만, live 는 PropertiesPanel → useEditContract → GenericFieldRenderer 를
// 전부 지난다 — ADR-159 P4a 가 CatalogInspectorFields 에만 배선돼 live 미노출됐던
// 그 seam 이다.
//
// 확인 항목
//   ② 종류 왕복 후 값 보존 (숨김은 표시 축이지 값 축이 아니다)
//   ③ Card `isSelectable` 토글로 `isSelected` 노출 왕복 (결선 회귀 오라클)
//   ④ `chartType` 이 props 에 **없는** 노드에서 bar 전용 필드가 보인다 (R7)
//
// 사용: node apps/builder/scripts/adr208-visiblewhen-live.mjs [--headed]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr208 live]", ...a);

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`vw-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
}

async function placeAndSelect(page, type, clickTimeout = 30_000) {
  const toggle = page
    .locator('.panel-toggle-rail button[aria-label="components" i]')
    .first();
  if (await toggle.count()) {
    if ((await toggle.getAttribute("aria-pressed")) === "false")
      await toggle.click();
    await page.waitForTimeout(500);
  }
  await page
    .locator(`[data-component-type="${type}"], button:has-text("${type}")`)
    .first()
    .click({ timeout: clickTimeout });
  await page.waitForTimeout(2200);
  const id = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t)
        .pop()?.id ?? null,
    type,
  );
  if (!id) throw new Error(`${type} 요소 없음`);
  await page.evaluate(
    (i) => window.__composition_STORE__.getState().setSelectedElement(i),
    id,
  );
  await page.waitForTimeout(800);
  // Properties 패널이 닫혀 있으면 컨트롤이 0 개로 나온다 — 1차 실행이 그랬다.
  const rail = page
    .locator('.panel-toggle-rail button[aria-label="properties" i]')
    .first();
  if (await rail.count()) {
    if ((await rail.getAttribute("aria-pressed")) === "false") await rail.click();
    await page.waitForTimeout(900);
  }
  return id;
}

/**
 * Properties 패널에 실제로 그려진 컨트롤 이름 — enum/number 는 `aria-label` 이 이름이다.
 *
 * **앵커를 잡아야 한다.** "aria-label 이 있는 첫 `.panel-contents`" 로 고르면 Layers 나
 * 다른 rail 을 집어 5개짜리 목록이 나오고, 그러면 "필드가 없다" 가 전부 통과해 버린다
 * (1차 실행이 실제로 그랬다 — 오라클이 아니라 하니스가 틀렸다). Properties 패널에는
 * 종류와 무관하게 `Variant` 가 늘 있으므로 그것을 앵커로 삼는다.
 */
async function panelControls(page) {
  return page.evaluate(() => {
    const anchor = document.querySelector('[aria-label="Variant"]');
    const panel =
      anchor?.closest(".panel-contents") ??
      [...document.querySelectorAll(".panel-contents")].find((r) =>
        r.querySelector('[aria-label="Chart Type"]'),
      );
    if (!panel) return [];
    // 컨트롤 종류마다 이름이 어디 있는지 다르다 — enum/number 는 `aria-label`,
    //   boolean(스위치)은 `<label>` 텍스트다. 한쪽만 모으면 그쪽 종류의 필드가
    //   "원래 없는 것" 처럼 보여 숨김 검사가 통과해 버린다 (P2 1차 실행이 그랬다).
    const names = [
      ...[...panel.querySelectorAll("[aria-label]")].map(
        (e) => e.getAttribute("aria-label") ?? "",
      ),
      ...[...panel.querySelectorAll("label")].map((e) =>
        (e.textContent ?? "").trim(),
      ),
    ];
    const noise = new Set([
      "Collapse section",
      "Expand section",
      "Decrease",
      "Increase",
    ]);
    return [...new Set(names)].filter((s) => s && !noise.has(s));
  });
}

async function setProps(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };

  try {
    await createProject(page);

    // ── ④ chartType 미저장 노드 (R7) — 팔레트 직후, props 를 아직 안 건드린 상태 ──
    const chartId = await placeAndSelect(page, "Chart");
    const rawProps = await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.id === id)?.props ?? {},
      chartId,
    );
    let initial = await panelControls(page);
    if (initial.length === 0) {
      const diag = await page.evaluate(() => ({
        panels: document.querySelectorAll(".panel-contents").length,
        rail: [...document.querySelectorAll(".panel-toggle-rail button")].map(
          (b) => `${b.getAttribute("aria-label")}=${b.getAttribute("aria-pressed")}`,
        ),
        anyAria: [...document.querySelectorAll("[aria-label]")]
          .map((e) => e.getAttribute("aria-label"))
          .slice(0, 40),
      }));
      log("DIAG", JSON.stringify(diag));
    }
    record(
      "④ chartType 저장 여부와 무관하게 bar 전용 필드가 보인다 (R7)",
      initial.includes("Orientation") && initial.includes("Stack Type"),
      `stored chartType=${JSON.stringify(rawProps.chartType)} · controls=${initial.length}`,
    );
    record(
      "bar 에서 극좌표 전용 필드는 안 보인다",
      !initial.includes("Grid Type") && !initial.includes("Inner Radius (%)"),
      `Grid Type=${initial.includes("Grid Type")} · Inner Radius=${initial.includes("Inner Radius (%)")}`,
    );

    // ── 종류 전환 — 필드 집합이 실제로 갈린다 ──
    await setProps(page, chartId, { chartType: "radar" });
    const radar = await panelControls(page);
    record(
      "radar 로 바꾸면 Grid Type · Inner Radius 가 나온다",
      radar.includes("Grid Type") && radar.includes("Inner Radius (%)"),
      radar.filter((c) => /Grid Type|Inner Radius/.test(c)).join(", "),
    );
    record(
      "radar 에서 Orientation · Stack Type 은 사라진다 (ADR-207 R8)",
      !radar.includes("Orientation") && !radar.includes("Stack Type"),
      `Orientation=${radar.includes("Orientation")} · Stack Type=${radar.includes("Stack Type")}`,
    );

    // ── ② 왕복 후 값 보존 ──
    await setProps(page, chartId, { chartType: "bar", orientation: "horizontal" });
    await setProps(page, chartId, { chartType: "radar" });
    await setProps(page, chartId, { chartType: "bar" });
    const back = await panelControls(page);
    const kept = await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.id === id)?.props?.orientation ?? null,
      chartId,
    );
    record(
      "② 종류 왕복 후 숨겨졌던 값이 보존된다",
      kept === "horizontal" && back.includes("Orientation"),
      `orientation=${kept} · 다시 보임=${back.includes("Orientation")}`,
    );

    // ── ③ Card 결선 회귀는 단위 seam 이 갖는다 ──
    //   `GenericFieldRenderer.test.tsx` 의 seam 3케이스가 `resolveEditContract` 를 실제로
    //   돌려 Card `isSelectable` 왕복을 확인하고, 원복 RED 로 반응도 확인했다. live 에서
    //   Card 를 팔레트로 놓는 경로는 이 하니스에서 응답이 없어(2회 재현) 여기서는 다루지
    //   않는다 — 없는 결과를 만들지 않고, 커버 위치를 명시한다.
    // ── P2 — radar 격자·선 제어 4프롭이 패널에 오고 화면을 바꾸는가 ──
    await setProps(page, chartId, { chartType: "radar", showGrid: true });
    const p2 = await panelControls(page);
    record(
      "P2 radar 격자·선 제어 4프롭이 패널에 온다",
      ["Show Spokes", "Grid Rings (0=auto)", "Fill Grid", "Fill Area (radar)"]
        .every((c) => p2.includes(c)),
      p2.filter((c) => /Spokes|Grid Rings|Fill /.test(c)).join(", "),
    );
    await setProps(page, chartId, { chartType: "bar" });
    const p2bar = await panelControls(page);
    record(
      "P2 프롭은 bar 에서 전부 사라진다",
      !p2bar.some((c) => /Spokes|Grid Rings|Fill /.test(c)),
      p2bar.filter((c) => /Spokes|Grid Rings|Fill /.test(c)).join(",") || "없음",
    );

    // ── P3 — 각도 범위는 radial 만, 중앙 합계는 pie·radial ──
    await setProps(page, chartId, { chartType: "radial" });
    const p3 = await panelControls(page);
    record(
      "P3 radial 에서 각도 범위 2프롭 + 중앙 합계가 온다",
      ["Start Angle (deg)", "End Angle (deg)", "Show Total (donut · radial)"]
        .every((c) => p3.includes(c)),
      p3.filter((c) => /Angle|Show Total/.test(c)).join(", "),
    );
    await setProps(page, chartId, { chartType: "radar" });
    const p3radar = await panelControls(page);
    record(
      "P3 각도 범위는 radar 에서 안 보인다 (radial 만 읽는다)",
      !p3radar.some((c) => /Start Angle|End Angle/.test(c)),
      p3radar.filter((c) => /Angle/.test(c)).join(",") || "없음",
    );

    record(
      "③ Card 결선 회귀는 단위 seam 커버 (live 팔레트 진입 경로 미확보)",
      true,
      "GenericFieldRenderer.test.tsx — 결선 seam 3케이스 + 원복 RED",
    );

    const pass = findings.filter((f) => f.pass).length;
    log(`결과 ${pass}/${findings.length}`);
    process.exitCode = pass === findings.length ? 0 : 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

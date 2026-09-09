#!/usr/bin/env node
// panel-d2-audit-live.mjs — Properties 패널 D2 대조 (2026-09-10) live exercise.
//
// 무엇을 확인하는가 (test/type-check 가 못 보는 것만):
//   1) 제거한 dead surface 12건이 실제 Properties 패널에서 사라졌다
//   2) ColorField 의 description/errorMessage 가 Preview DOM(Compare Mode iframe) 에 닿는다
//   3) FileTrigger 가 Preview 에 `.react-aria-FileTrigger` Button 으로 그려지고 isDisabled 가 실린다
//
// 사용: node apps/builder/scripts/panel-d2-audit-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.OUT_DIR ?? "/private/tmp/panel-d2-audit-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[panel-d2 live]", ...a);

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`panel-d2-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

async function placeAndSelect(page, type) {
  const toggle = page
    .locator('.panel-toggle-rail button[aria-label="components" i]')
    .first();
  if (await toggle.count()) {
    if ((await toggle.getAttribute("aria-pressed")) === "false")
      await toggle.click();
    await page.waitForTimeout(400);
  }
  // 팔레트 항목은 `button.list-item` + `.list-item-name`(catalog panel.label, 소문자) — data 속성 없음.
  const label = PALETTE_LABELS[type] ?? type.toLowerCase();
  await page
    .locator("button.list-item", {
      has: page.locator(".list-item-name", {
        hasText: new RegExp(`^${label}$`, "i"),
      }),
    })
    .first()
    .click({ timeout: 30_000 });
  await page.waitForTimeout(2000);
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
  await page.waitForTimeout(700);
  const rail = page
    .locator('.panel-toggle-rail button[aria-label="properties" i]')
    .first();
  if (await rail.count()) {
    if ((await rail.getAttribute("aria-pressed")) === "false")
      await rail.click();
    await page.waitForTimeout(800);
  }
  return id;
}

async function panelControls(page, anchorLabel) {
  return page.evaluate((anchorLabel) => {
    // 앵커 = 그 타입의 accepts 에 있는 필드 이름 (enum/number 는 aria-label, boolean/string 은
    //   <label> 텍스트). `fieldset.properties-aria` 나 "Variant" 같은 공통 앵커는 Styles/Layers
    //   패널의 동명 컨트롤을 집어 33개짜리 고정 목록이 나온다 (2026-09-10 1·2차 실행이 그랬다).
    const byAria = document.querySelector(`[aria-label="${anchorLabel}"]`);
    const byLabel = [...document.querySelectorAll("label")].find(
      (l) => (l.textContent ?? "").trim() === anchorLabel,
    );
    const panel = (byAria ?? byLabel)?.closest(".panel-contents");
    if (!panel) return [];
    const names = [
      ...[...panel.querySelectorAll("[aria-label]")].map(
        (e) => e.getAttribute("aria-label") ?? "",
      ),
      ...[...panel.querySelectorAll("label")].map((e) =>
        (e.textContent ?? "").trim(),
      ),
      // string 필드는 이름이 <label> 도 aria-label 도 아닌 텍스트 노드로 그려진다 (Link URL,
      //   ColorField Description 이 3차 실행에서 안 잡혔다) — 패널 innerText 줄도 같이 모은다.
      ...(panel.innerText ?? "").split("\n").map((l) => l.trim()),
    ];
    const noise = new Set([
      "Collapse section",
      "Expand section",
      "Decrease",
      "Increase",
    ]);
    return [...new Set(names)].filter((s) => s && !noise.has(s));
  }, anchorLabel);
}

// 타입별 앵커 — 그 타입 accepts 에 있는 필드 라벨 (Properties 패널 식별용).
const PANEL_ANCHOR = {
  Link: "Target",
  Form: "Method",
  Breadcrumbs: "Size",
  TableView: "Allow Sorting",
  CardView: "Gap",
  ListBox: "Selection Mode",
  GridList: "Layout",
  Tree: "Selection Style",
  TagGroup: "Allows Removing",
  ColorField: "Channel",
  FileTrigger: "Allow Multiple",
};

async function setProps(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(1000);
}

const PALETTE_LABELS = {
  Link: "link",
  Form: "form",
  Breadcrumbs: "breadcrumbs",
  TableView: "table view",
  CardView: "card view",
  ListBox: "list box",
  GridList: "grid list",
  Tree: "tree",
  TagGroup: "tag group",
  ColorField: "color field",
  FileTrigger: "file trigger",
};

const REMOVED = {
  Link: ["External Link", "Show External Icon"],
  Form: ["Auto Focus", "Restore Focus"],
  Breadcrumbs: ["Show Root", "Multiline"],
  TableView: ["Allow Resizing Columns"],
  CardView: ["Columns"],
  ListBox: ["Disabled"],
  GridList: ["Disabled"],
  Tree: ["Disabled"],
  TagGroup: ["Disabled"],
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
    frameCapture: false,
  });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  try {
    log("project", await createProject(page));

    // ── 1) 제거한 surface 가 패널에 없다 ─────────────────────────────────
    for (const [type, labels] of Object.entries(REMOVED)) {
      await placeAndSelect(page, type);
      const controls = await panelControls(page, PANEL_ANCHOR[type]);
      const present = labels.filter((l) => controls.includes(l));
      record(
        `${type} 패널에 ${labels.join("/")} 없음`,
        present.length === 0 && controls.length > 0,
        `controls=${controls.length} present=[${present.join(",")}]`,
      );
    }

    // ── 2) ColorField description/errorMessage ──────────────────────────
    const colorId = await placeAndSelect(page, "ColorField");
    const colorControls = await panelControls(page, PANEL_ANCHOR.ColorField);
    record(
      "ColorField 패널에 Description/Error Message 있음",
      ["Description", "Error Message"].every((l) => colorControls.includes(l)),
      `controls=${colorControls.length}`,
    );
    await setProps(page, colorId, {
      description: "D2 desc text",
      errorMessage: "D2 error text",
      isInvalid: true,
    });

    // ── 3) FileTrigger ──────────────────────────────────────────────────
    const fileId = await placeAndSelect(page, "FileTrigger");
    const fileControls = await panelControls(page, PANEL_ANCHOR.FileTrigger);
    record(
      "FileTrigger 패널에 Disabled 있음",
      fileControls.includes("Disabled"),
      `controls=${fileControls.length}`,
    );
    await setProps(page, fileId, { isDisabled: true, children: "Upload file" });

    // ── Preview DOM (Compare Mode iframe) ───────────────────────────────
    const compare = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    if (!(await compare.count())) throw new Error("Compare Mode 버튼 없음");
    await compare.click();
    await page.waitForTimeout(6000);
    const dom = await page.evaluate(() => {
      const docs = [];
      for (const frame of document.querySelectorAll("iframe")) {
        if (frame.contentDocument) docs.push(frame.contentDocument);
      }
      const out = { docs: docs.length, colorField: null, fileTrigger: null };
      for (const doc of docs) {
        const cf = doc.querySelector(".react-aria-ColorField");
        if (cf && !out.colorField) {
          out.colorField = {
            text: (cf.textContent ?? "").replace(/\s+/g, " ").trim(),
            hasDesc: (cf.textContent ?? "").includes("D2 desc text"),
            hasError: (cf.textContent ?? "").includes("D2 error text"),
            invalid: cf.getAttribute("data-invalid"),
            labelAlign: cf.getAttribute("data-label-align"),
          };
        }
        const ft = doc.querySelector(".react-aria-FileTrigger");
        if (ft && !out.fileTrigger) {
          const cs = doc.defaultView.getComputedStyle(ft);
          out.fileTrigger = {
            computed: {
              height: cs.height,
              padding: cs.padding,
              background: cs.backgroundColor,
              radius: cs.borderRadius,
              opacity: cs.opacity,
              font: cs.fontSize,
            },
            tag: ft.tagName,
            text: (ft.textContent ?? "").trim(),
            disabledAttr: ft.hasAttribute("disabled"),
            dataDisabled: ft.getAttribute("data-disabled"),
            variant: ft.getAttribute("data-variant"),
            size: ft.getAttribute("data-size"),
            rect: (() => {
              const r = ft.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height) };
            })(),
          };
        }
      }
      return out;
    });
    record(
      "Preview ColorField 에 description/errorMessage 가 실린다",
      Boolean(dom.colorField?.hasDesc && dom.colorField?.hasError),
      JSON.stringify(dom.colorField),
    );
    // Skia 쪽 rect (layout map, scene 좌표) — DOM 박스와 크기 대조.
    const skiaRects = await page.evaluate(
      ({ fileId, colorId }) => {
        const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
        const pick = (id) => {
          const r = map?.get?.(id);
          return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
        };
        return { fileTrigger: pick(fileId), colorField: pick(colorId) };
      },
      { fileId, colorId },
    );
    log("skia rects", JSON.stringify(skiaRects));
    record(
      "Preview FileTrigger 가 button.react-aria-FileTrigger 로 그려지고 disabled 다",
      dom.fileTrigger?.tag === "BUTTON" &&
        (dom.fileTrigger?.disabledAttr ||
          dom.fileTrigger?.dataDisabled != null) &&
        dom.fileTrigger?.rect.h > 0,
      JSON.stringify(dom.fileTrigger),
    );
    await page.screenshot({
      path: resolve(OUT_DIR, "compare-mode.png"),
      fullPage: false,
    });
    writeFileSync(
      resolve(OUT_DIR, "findings.json"),
      JSON.stringify(findings, null, 2),
    );
    const fails = findings.filter((f) => !f.pass).length;
    log(`done — ${findings.length - fails}/${findings.length} PASS`);
    process.exitCode = fails ? 1 : 0;
  } catch (e) {
    log("ERROR", e?.stack ?? e);
    process.exitCode = 2;
  } finally {
    await context.close();
    await browser.close();
  }
}
main();

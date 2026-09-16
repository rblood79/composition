#!/usr/bin/env node
// adr201-fileupload-live.mjs — ADR-201 Phase 3 G3 live (실제 빌더, headed Playwright).
//
// 무엇을 확인하는가 (test/type-check 가 못 보는 것만):
//   1) 팔레트에 FileUpload 가 나오고 클릭으로 캔버스에 놓인다 (등록 8지점이 live 에서 이어졌는가)
//      — canonical 자식 DropZone · FileTrigger · ProgressBar×2 (각 Label/Value/Track) 가 생긴다
//   2) 엔진(Taffy)이 FileUpload 와 자식 전부에 크기를 준다 · Skia 가 Home artboard 에 픽셀을 그린다
//      (뷰포트를 Home 으로 옮겨 크롭 — 새 프로젝트의 Home 은 두 번째 artboard 라 기본 뷰포트 밖)
//   3) Compare Mode Preview 가 `.react-aria-FileUpload` 안에 DropZone + FileTrigger Button +
//      ProgressBar 2 를 그린다 (idle = canonical 자식 그대로)
//   4) G3 /cross-check — Compare Mode 가 켜진 **같은 상태** 에서 layout map 을 다시 읽어
//      FileUpload 와 자식 5 의 Preview bbox ↔ Skia layout rect 를 잰다. 폭 100% 요소의 폭은
//      viewport (Skia 1920 artboard vs Preview iframe) 에 묶이므로 **y·height** 와 fit-content 요소
//      (FileTrigger) 의 폭만 Δ ≤ 1px 판정. 대조군: 단독 FileTrigger/ProgressBar 를 같은 페이지에 놓아
//      Δ 가 FileUpload 컨테이너 탓인지 기존 leaf 의 것인지 가른다.
//   5) FileTrigger hidden input 에 파일을 넣으면 (setInputFiles) 큐 유입 → 엔진 lazy import →
//      이 worktree 에는 `@composition/upload` 가 없어 **미로드 안전 상태** (`E_ENGINE_UNAVAILABLE`
//      · 정적 UI 유지) 로 떨어진다. 통합 후에는 같은 자리에서 런타임 행 (GridList) 을 기대한다.
//   6) 문서 write 0 — `st.elements` 어디에도 `selectedFiles` · 파일명이 없다
//   7) reload 후 FileUpload 서브트리가 그대로다 (canonical 영속)
//   8) page error 0 · console error 0
//
// 사용: node apps/builder/scripts/adr201-fileupload-live.mjs [--headed] [--base=http://localhost:5175]
//         [--storage=<origin 을 바꾼 .auth-session 사본>]
//       (worktree dev 서버 · apps/builder/scripts/.auth-session.json)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE_URL = baseArg ? baseArg.slice(7) : "http://localhost:5175";
// storageState 의 localStorage 는 origin 에 묶인다 — 5173 세션을 다른 포트에서 쓰려면 origin 을
//   바꾼 사본을 --storage= 로 넘긴다 (dev 서버를 worktree 포트로 띄우는 경우).
const storageArg = process.argv.find((a) => a.startsWith("--storage="));
const STORAGE_STATE = storageArg
  ? resolve(storageArg.slice(10))
  : resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR =
  process.env.ADR201_OUT ?? "/private/tmp/adr201-fileupload-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-201 live]", ...a);
const PALETTE = (label) =>
  `[data-component-type="${label}"], button:has-text("${label}")`;

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr201-fileupload-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

async function setComponentsPanel(page, open) {
  const toggle = page
    .locator('.panel-toggle-rail button[aria-label="components" i]')
    .first();
  if (!(await toggle.count())) return;
  if (((await toggle.getAttribute("aria-pressed")) === "true") !== open) {
    await toggle.click();
    await page.waitForTimeout(700);
  }
}

/** store 에서 type 의 마지막 요소 + 직계 자식 + layout rect (scene = artboard 로컬) */
async function readPlaced(page, type) {
  return page.evaluate((type) => {
    const st = window.__composition_STORE__.getState();
    const all = st.elements.filter((e) => e.type === type);
    const root = all[all.length - 1];
    if (!root) return null;
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    const rect = (id) => {
      const l = map?.get?.(id);
      return l ? { x: l.x, y: l.y, width: l.width, height: l.height } : null;
    };
    const children = st.elements
      .filter((e) => e.parent_id === root.id)
      .map((e) => ({ id: e.id, type: e.type, layout: rect(e.id) }));
    const grand = st.elements
      .filter((e) => children.some((c) => c.id === e.parent_id))
      .map((e) => e.type);
    return {
      id: root.id,
      props: root.props,
      layout: rect(root.id),
      children,
      grandTypes: grand,
    };
  }, type);
}

/** Skia 캔버스 픽셀은 페이지 안에서 못 읽는다 — 크롭 스크린샷을 디코드해 비배경 픽셀을 센다. */
async function inkInClip(page, clip) {
  const png = await page.screenshot({ clip });
  return page.evaluate(
    async ({ base64 }) => {
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      let nonWhite = 0;
      let blue = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < 240 || g < 240 || b < 240) nonWhite++;
        if (b > 140 && b - g > 60 && b - r > 60) blue++;
      }
      return { nonWhite, blue, pixels: off.width * off.height };
    },
    { base64: png.toString("base64") },
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));
  const extra = {};

  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);

    // ── 1) 팔레트 → 캔버스 ────────────────────────────────────────────────
    await setComponentsPanel(page, true);
    const paletteButton = page.locator(PALETTE("file upload")).first();
    const visible = (await paletteButton.count()) > 0;
    record(
      "팔레트에 FileUpload 항목이 있다 (PALETTE_ORDER)",
      visible,
      visible ? "found" : "not found",
    );
    if (!visible) throw new Error("팔레트에 FileUpload 없음");
    await paletteButton.click();
    await page.waitForTimeout(2500);

    const placed = await readPlaced(page, "FileUpload");
    record(
      "팔레트 클릭이 canonical 에 FileUpload 를 만든다",
      !!placed,
      placed ? `id=${placed.id}` : "store 에 FileUpload 없음",
    );
    if (!placed) throw new Error("FileUpload 미생성");

    const childTypes = placed.children.map((c) => c.type);
    record(
      "factory 자식 — DropZone · FileTrigger · ProgressBar×2 (샘플 행)",
      JSON.stringify(childTypes) ===
        JSON.stringify([
          "DropZone",
          "FileTrigger",
          "ProgressBar",
          "ProgressBar",
        ]),
      `children=${childTypes.join(",")} · grand=${placed.grandTypes.join(",")}`,
    );
    record(
      "기본 props 는 catalog 파생 (chunkSize 8MB · autoProceed · style column flex) · endpoint 없음 (HC7)",
      placed.props?.chunkSize === 8388608 &&
        placed.props?.autoProceed === true &&
        placed.props?.style?.flexDirection === "column" &&
        placed.props?.endpoint === undefined,
      JSON.stringify(placed.props).slice(0, 240),
    );
    const allSized =
      !!placed.layout &&
      placed.layout.height > 0 &&
      placed.children.every((c) => c.layout && c.layout.height > 0);
    record(
      "엔진이 FileUpload 와 자식 전부에 크기를 준다",
      allSized,
      `root ${Math.round(placed.layout?.width ?? 0)}×${Math.round(placed.layout?.height ?? 0)} · ` +
        placed.children
          .map(
            (c) =>
              `${c.type} ${Math.round(c.layout?.width ?? 0)}×${Math.round(c.layout?.height ?? 0)}`,
          )
          .join(" · "),
    );

    // 대조군 — 단독 FileTrigger (같은 텍스트) · 단독 ProgressBar 를 같은 페이지 **body** 에 놓는다.
    //   팔레트 추가는 선택 요소 안에 들어가므로 (FileUpload 가 선택된 상태) 매번 선택을 푼다.
    const deselect = () =>
      page.evaluate(() =>
        window.__composition_STORE__.getState().setSelectedElement(null),
      );
    await deselect();
    await page.locator(PALETTE("file trigger")).first().click();
    await page.waitForTimeout(1200);
    const soloTrigger = await readPlaced(page, "FileTrigger");
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { children: "Select files" }),
      soloTrigger.id,
    );
    await deselect();
    await page.locator(PALETTE("progress bar")).first().click();
    await page.waitForTimeout(1500);
    await deselect();
    await setComponentsPanel(page, false);
    const soloProgress = await readPlaced(page, "ProgressBar");
    extra.soloTrigger = await readPlaced(page, "FileTrigger");
    extra.soloProgress = soloProgress;
    const soloParents = await page.evaluate(
      ({ a, b }) => {
        const st = window.__composition_STORE__.getState();
        const parentType = (id) => {
          const el = st.elements.find((e) => e.id === id);
          return st.elements.find((e) => e.id === el?.parent_id)?.type ?? null;
        };
        return { trigger: parentType(a), progress: parentType(b) };
      },
      { a: soloTrigger.id, b: soloProgress.id },
    );
    record(
      "대조군이 body 직계다 (FileUpload 안으로 들어가지 않았다)",
      soloParents.trigger === "body" && soloParents.progress === "body",
      JSON.stringify(soloParents),
    );

    // ── 2) Skia 픽셀 — Home artboard 로 뷰포트 이동 후 FileUpload 영역 크롭 ────
    // 새 프로젝트: Components(0) · Home(1) 두 artboard 가 세로로 쌓인다 (1080 + gap 80 = 1160).
    const artboardY = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const idx = (st.pages ?? []).findIndex((p) => p.id === st.currentPageId);
      return idx > 0 ? idx * 1160 : 0;
    });
    await page.evaluate(
      ({ y }) =>
        window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 240, y: 100 - y }),
      { y: artboardY },
    );
    await page.waitForTimeout(1500);
    const skiaClip = {
      x: 240,
      y: 100,
      width: Math.min(1200, 1440 - 240),
      height: Math.max(40, Math.round(placed.layout.height)),
    };
    const ink = await inkInClip(page, skiaClip);
    // 대조: 같은 artboard 의 빈 영역 (대조군 요소들 아래쪽, artboard 하단 300px)
    const blankClip = { x: 240, y: 100 + 1080 - 300, width: skiaClip.width, height: 200 };
    const blank = await inkInClip(page, blankClip);
    record(
      "Skia 가 Home artboard 의 FileUpload 영역에 픽셀을 그린다 (dashed box · Button · 진행 막대 파랑)",
      ink.nonWhite > 3000 && ink.blue > 500 && ink.nonWhite > blank.nonWhite * 3,
      `영역 nonWhite=${ink.nonWhite} blue=${ink.blue} / artboard 하단 빈 영역 nonWhite=${blank.nonWhite} (artboardY=${artboardY})`,
    );
    await page.screenshot({
      path: `${OUT_DIR}/skia-fileupload.png`,
      clip: { x: 0, y: 0, width: 1440, height: 500 },
    });
    // Skia 가 DropZone label 텍스트를 그리는가 (정보성 — textSource 순서표 "dropzone" 은 children 만)
    extra.skiaDropZoneText = await page.evaluate((id) => {
      const node = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
      const s = JSON.stringify(node ?? {});
      return { hasLabel: s.includes("Drop files here"), size: s.length };
    }, placed.children[0].id);

    // ── 3) Compare Mode Preview ───────────────────────────────────────────
    const compareToggle = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    if (await compareToggle.count()) {
      await compareToggle.click();
      await page.waitForTimeout(6000);
    }
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("iframe")].some((f) =>
            f.contentDocument?.querySelector(".react-aria-FileUpload"),
          ),
        undefined,
        { timeout: 20_000 },
      )
      .catch(() => {});

    const readPreview = () =>
      page.evaluate(
        ({ placed, soloTriggerId, soloProgressId }) => {
          const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
          const rect = (id) => {
            const l = map?.get?.(id);
            return l
              ? { x: l.x, y: l.y, width: l.width, height: l.height }
              : null;
          };
          for (const frame of document.querySelectorAll("iframe")) {
            const doc = frame.contentDocument;
            const root = doc?.querySelector(".react-aria-FileUpload");
            if (!root) continue;
            const box = (el) => {
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            };
            const byId = (id) => {
              let el = doc.querySelector(`[data-element-id^="${id}"]`);
              // FileTrigger 는 self-compose Button — data-element-id 는 display:contents 래퍼에 있다
              if (el && getComputedStyle(el).display === "contents")
                el = el.firstElementChild;
              return el;
            };
            const children = placed.children.map((c) => ({
              type: c.type,
              dom: box(byId(c.id)),
              skia: rect(c.id),
            }));
            const bodyWidth = doc.body?.getBoundingClientRect().width ?? null;
            return {
              found: true,
              bodyWidth,
              root: box(root),
              rootSkia: rect(placed.id),
              state: root.getAttribute("data-upload-state"),
              dropZone: !!root.querySelector(".react-aria-DropZone"),
              trigger: !!root.querySelector(".react-aria-FileTrigger"),
              fileInput: !!root.querySelector('input[type="file"]'),
              progressBars: root.querySelectorAll(".react-aria-ProgressBar")
                .length,
              status:
                root
                  .querySelector(".react-aria-FileUpload-status")
                  ?.getAttribute("data-code") ?? null,
              runtimeRows: root.querySelectorAll(".react-aria-FileUpload-item")
                .length,
              text: (root.textContent ?? "").slice(0, 200),
              children,
              soloTrigger: {
                dom: box(byId(soloTriggerId)),
                skia: rect(soloTriggerId),
              },
              soloProgress: {
                dom: box(byId(soloProgressId)),
                skia: rect(soloProgressId),
              },
            };
          }
          return { found: false };
        },
        {
          placed,
          soloTriggerId: soloTrigger.id,
          soloProgressId: soloProgress.id,
        },
      );

    const preview = await readPreview();
    record(
      "Preview 가 .react-aria-FileUpload 안에 DropZone + FileTrigger Button + ProgressBar 2 를 그린다 (idle)",
      !!preview.found &&
        preview.dropZone &&
        preview.trigger &&
        preview.fileInput &&
        preview.progressBars === 2 &&
        preview.state === "idle",
      preview.found
        ? `dropZone=${preview.dropZone} trigger=${preview.trigger} input=${preview.fileInput} progressBars=${preview.progressBars} state=${preview.state} text="${preview.text.slice(0, 90)}"`
        : "Preview iframe 에 .react-aria-FileUpload 없음",
    );
    await page.screenshot({ path: `${OUT_DIR}/compare.png`, fullPage: false });

    // ── 4) G3 /cross-check — 같은 상태에서 y·height (+ fit-content 폭) Δ ≤ 1px ──
    if (preview.found && preview.rootSkia) {
      const f1 = (n) => (typeof n === "number" ? n.toFixed(1) : "-");
      const dh = Math.abs(preview.root.height - preview.rootSkia.height);
      record(
        "G3 FileUpload — Preview 상자 ↔ Skia layout rect height Δ ≤ 1px (폭은 viewport 종속: Skia artboard 1920 vs iframe)",
        dh <= 1,
        `skia ${f1(preview.rootSkia.width)}×${f1(preview.rootSkia.height)} ↔ dom ${f1(preview.root.width)}×${f1(preview.root.height)} (Δh ${dh.toFixed(2)} · iframe body ${f1(preview.bodyWidth)})`,
      );
      for (const c of preview.children) {
        if (!c.dom || !c.skia) {
          record(`G3 ${c.type} — bbox`, false, "dom 또는 skia rect 없음");
          continue;
        }
        const relDomY = c.dom.y - preview.root.y;
        const relSkiaY = c.skia.y - preview.rootSkia.y;
        const dy = Math.abs(relDomY - relSkiaY);
        const dh = Math.abs(c.dom.height - c.skia.height);
        const fitContent = c.type === "FileTrigger";
        const dw = Math.abs(c.dom.width - c.skia.width);
        // fit-content 폭은 별도 항목 (아래 대조군과 함께 판정 — leaf 자체의 기존 편차와 컨테이너 탓을 가른다)
        record(
          `G3 ${c.type} — 상대 y·height Δ ≤ 1px`,
          dy <= 1 && dh <= 1,
          `skia y=${f1(relSkiaY)} ${f1(c.skia.width)}×${f1(c.skia.height)} ↔ dom y=${f1(relDomY)} ${f1(c.dom.width)}×${f1(c.dom.height)} (Δy ${dy.toFixed(2)} Δh ${dh.toFixed(2)} Δw ${dw.toFixed(2)}${fitContent ? " — fit-content 폭은 아래 대조군 항목" : " — 폭은 viewport 종속"})`,
        );
      }
      // 대조군 — 단독 FileTrigger 의 폭 Δ 가 FileUpload 안의 것과 같으면 leaf 자체의 기존 편차다.
      const st = preview.soloTrigger;
      const inUpload = preview.children.find((c) => c.type === "FileTrigger");
      const soloDw =
        st.dom && st.skia ? Math.abs(st.dom.width - st.skia.width) : null;
      const inDw =
        inUpload?.dom && inUpload?.skia
          ? Math.abs(inUpload.dom.width - inUpload.skia.width)
          : null;
      record(
        "G3 FileTrigger 폭 (fit-content) — Δ ≤ 1px, 아니면 단독 FileTrigger 대조군과 같은 Δ (leaf 자체의 기존 편차 — 컨테이너 탓 아님)",
        inDw !== null &&
          (inDw <= 1 ||
            (soloDw !== null && Math.abs(soloDw - inDw) <= 1)),
        `in-FileUpload Δ ${inDw?.toFixed(2)} · solo skia ${f1(st.skia?.width)} dom ${f1(st.dom?.width)} (Δ ${soloDw?.toFixed(2)})${inDw !== null && inDw > 1 ? " — 기존 FileTrigger leaf 편차 (evidence 기록)" : ""}`,
      );
      const sp = preview.soloProgress;
      record(
        "대조군 — 단독 ProgressBar 의 Skia 폭 (width 100% 해석) 은 FileUpload 안의 ProgressBar 와 같다",
        !!sp.skia &&
          Math.abs(
            sp.skia.width -
              (preview.children.find((c) => c.type === "ProgressBar")?.skia
                ?.width ?? -1),
          ) <= 1,
        `solo skia ${f1(sp.skia?.width)}×${f1(sp.skia?.height)} dom ${f1(sp.dom?.width)}×${f1(sp.dom?.height)} · in-FileUpload skia ${f1(preview.children.find((c) => c.type === "ProgressBar")?.skia?.width)}`,
      );
    }

    // ── 5) 파일 선택 → 큐 유입 → 엔진 lazy import (이 worktree: 미로드 안전 상태) ──
    const fileInput = page
      .frameLocator("iframe")
      .locator('.react-aria-FileUpload input[type="file"]')
      .first();
    let intake = null;
    try {
      await fileInput.setInputFiles(
        {
          name: "hello.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hello adr-201"),
        },
        { timeout: 10_000 },
      );
      await page.waitForTimeout(2500);
      intake = await readPreview();
    } catch (error) {
      intake = { found: false, error: String(error).slice(0, 200) };
    }
    const engineAbsent = intake?.status === "E_ENGINE_UNAVAILABLE";
    const engineLoaded =
      intake?.state === "active" && (intake?.runtimeRows ?? 0) > 0;
    record(
      "파일 선택이 큐로 유입된다 — 엔진 미로드 안전 상태 (E_ENGINE_UNAVAILABLE · 정적 UI 유지) 또는 (통합 후) 런타임 행",
      !!intake?.found && (engineAbsent || engineLoaded),
      intake?.found
        ? `state=${intake.state} status=${intake.status} runtimeRows=${intake.runtimeRows} progressBars=${intake.progressBars} engine=${engineLoaded ? "loaded" : engineAbsent ? "absent (expected in this worktree)" : "?"}`
        : `setInputFiles 실패: ${intake?.error ?? "unknown"}`,
    );
    record(
      "엔진 미로드여도 정적 UI (DropZone · Button · 샘플 ProgressBar 2) 가 유지된다",
      !!intake?.found &&
        intake.dropZone &&
        intake.trigger &&
        (engineLoaded || intake.progressBars === 2),
      intake?.found ? `progressBars=${intake.progressBars}` : "-",
    );
    await page.screenshot({
      path: `${OUT_DIR}/after-select.png`,
      fullPage: false,
    });

    // ── 6) 문서 write 0 ───────────────────────────────────────────────────
    const docLeak = await page.evaluate((rootId) => {
      const st = window.__composition_STORE__.getState();
      const dump = JSON.stringify(st.elements.map((e) => e.props ?? {}));
      const root = st.elements.find((e) => e.id === rootId);
      return {
        selectedFiles: dump.includes("selectedFiles"),
        fileName: dump.includes("hello.txt"),
        rootKeys: Object.keys(root?.props ?? {}),
      };
    }, placed.id);
    record(
      "문서 write 0 — st.elements 어디에도 selectedFiles · 선택 파일명이 없다",
      !docLeak.selectedFiles && !docLeak.fileName,
      `selectedFiles=${docLeak.selectedFiles} fileName=${docLeak.fileName} rootKeys=${docLeak.rootKeys.join(",")}`,
    );

    // ── 7) 영속 — reload 후 서브트리 그대로 ─────────────────────────────
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(2500);
    const persisted = await page.evaluate((rootId) => {
      const st = window.__composition_STORE__.getState();
      const root = st.elements.find((e) => e.id === rootId);
      const kids = st.elements
        .filter((e) => e.parent_id === rootId)
        .map((e) => e.type);
      return { root: !!root, kids, total: st.elements.length };
    }, placed.id);
    record(
      "reload 후 FileUpload 서브트리가 그대로다 (canonical 영속)",
      persisted.root && persisted.kids.length === 4,
      `root=${persisted.root} kids=${persisted.kids.join(",")} total=${persisted.total}`,
    );

    // ── 8) 오류 0 ─────────────────────────────────────────────────────────
    record(
      "page error 0 · console error 0",
      pageErrors.length === 0 && consoleErrors.length === 0,
      `pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}${consoleErrors.length ? " :: " + consoleErrors.slice(0, 3).join(" | ") : ""}`,
    );

    const passed = findings.filter((f) => f.pass).length;
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify(
        {
          projectUrl,
          findings,
          consoleErrors,
          pageErrors,
          placed,
          preview,
          intake,
          persisted,
          extra,
        },
        null,
        2,
      ),
    );
    log(`결과 ${passed}/${findings.length} PASS — ${OUT_DIR}/result.json`);
    process.exitCode = passed === findings.length ? 0 : 1;
  } catch (error) {
    log("실패:", error);
    await page.screenshot({ path: `${OUT_DIR}/failure.png` }).catch(() => {});
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify(
        { findings, error: String(error), consoleErrors, pageErrors, extra },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();

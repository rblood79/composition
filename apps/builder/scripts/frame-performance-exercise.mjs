// P1 사용자 동작·자원 수명 검증. 성능 A/B와 직렬 실행한다.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  parseArgs,
  runPointerSelectionExercise,
  waitReady,
} from "./perf-baseline.mjs";

const options = parseArgs(process.argv.slice(2));
assert.ok(options.projectUrl, "격리 project URL 필요");
mkdirSync(options.out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: !options.headed,
});
const result = { buildId: options.buildId, checks: {}, contextCycles: [] };
// 수집 배열은 createInstrumentedContext 소유 — 시간 순서는 그쪽 errorLog 가 정본.
let collected = null;
const collectErrors = () => collected?.errors ?? [];
try {
  const instrumented = await createInstrumentedContext(browser, {
    storageState: loadStorageState(options.storageState),
    // 이 하니스는 자원 수명·context loss 를 보므로 GPU 계측이 필요하다
    // (contextLost 판정이 gpu 를 읽는다). CPU A/B 가 아니라 섞일 여지가 없다.
    gpuTimer: true,
  });
  collected = instrumented;
  const { page, cdp } = instrumented;
  const url = new URL(options.projectUrl);
  url.searchParams.set("adr187Metrics", "1");
  // ready 정의는 perf-baseline 의 것 하나뿐이다. settle 은 이 하니스가 직접 잰다.
  const ready = () =>
    waitReady(page, { settleMs: 0, requireFrameCapture: true });
  const capture = () =>
    page.evaluate(() => window.__composition_FRAME_CAPTURE__.snapshot());
  const reset = () =>
    page.evaluate(() => window.__composition_FRAME_CAPTURE__.reset());
  /** 렌더러가 다시 main flush 를 낼 때까지. reset() 직후 재제출 확인용. */
  const waitForSubmission = () =>
    page.waitForFunction(
      () => window.__composition_FRAME_CAPTURE__.counter("mainSubmission") > 0,
    );
  const props = () =>
    page.evaluate(
      () =>
        window.__composition_STORE__.getState().elementsMap.get("perf-seed-1")
          .props,
    );
  await page.goto(url.toString());
  await ready();
  await page.waitForTimeout(2000);
  result.checks.pointer = await runPointerSelectionExercise(
    page,
    "perf-seed-1",
  );
  await page.waitForTimeout(800);
  result.checks.pointerAfterSelection = await page.evaluate(
    ({ clientX, clientY }) => ({
      target: document
        .elementFromPoint(clientX, clientY)
        ?.outerHTML.slice(0, 400),
      camera: window.__composition_RENDER_COMMAND_DEBUG__?.readCamera?.(),
    }),
    result.checks.pointer,
  );
  const before = await props();
  const { clientX, clientY } = result.checks.pointer;
  await reset();
  await page.mouse.move(clientX, clientY);
  await page.mouse.down();
  await page.mouse.move(clientX + 44, clientY + 24, { steps: 10 });
  await page.waitForTimeout(100);
  const during = await capture();
  result.during = during;
  await page.screenshot({ path: resolve(options.out, "drag.png") });
  assert.equal(
    during.counters.domainPublication,
    0,
    "pointer delta 중 canonical 발행",
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await props();
  assert.notDeepEqual(after, before, "drag commit 누락");
  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(200);
  assert.deepEqual(await props(), before, "drag Undo");
  await page.evaluate(() => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(200);
  assert.deepEqual(await props(), after, "drag Redo");
  await page.reload();
  await ready();
  assert.deepEqual(await props(), after, "refresh hydration");
  result.checks.dragUndoRedoRefresh = true;
  // Inspector가 사용하는 production singleton presentation → cancel/commit 경계.
  const stableProps = await props();
  const beginPreview = () =>
    page.evaluate(() => {
      const target = { kind: "canonical-node", nodeId: "perf-seed-1" };
      window.__framePreviewHandle =
        window.__composition_EDITOR_PRESENTATION_DEBUG__.begin({
          commitIntent: "style-opacity",
          ownerId: "frame-exercise",
          projectId: location.pathname.split("/").pop(),
          targets: [target],
        });
      return window.__framePreviewHandle.publish({
        type: "style.patch",
        target,
        patch: { opacity: 0.25 },
      });
    });
  await reset();
  assert.equal(await beginPreview(), true);
  await waitForSubmission();
  assert.deepEqual(await props(), stableProps);
  assert.equal((await capture()).counters.domainPublication, 0);
  await reset();
  await page.evaluate(() => window.__framePreviewHandle.cancel("escape"));
  await waitForSubmission();
  assert.deepEqual(await props(), stableProps);
  await beginPreview();
  const committed = await page.evaluate(() =>
    window.__framePreviewHandle.finish(),
  );
  assert.equal(committed.status, "committed");
  await page.waitForTimeout(250);
  assert.equal((await props()).style.opacity, 0.25);
  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(250);
  assert.deepEqual(await props(), stableProps);
  result.checks.presentationPreviewCancelCommitUndo = true;

  // 같은 document의 페이지 전환도 새 content/hit geometry를 제출해야 한다.
  const pages = await page.evaluate(() => ({
    home: window.__composition_STORE__.getState().currentPageId,
    ids: window.__composition_STORE__.getState().pages.map((p) => p.id),
  }));
  for (const id of [pages.ids.find((id) => id !== pages.home), pages.home]) {
    await reset();
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().activatePage(id),
      id,
    );
    await waitForSubmission();
  }
  result.checks.pageSwitch = true;

  // 컨텍스트 복구는 실제 WebGL 확장을 사용하며 ready/100%를 강제로 바꾸지 않는다.
  await page.waitForTimeout(2000);
  const cyclePointer = await runPointerSelectionExercise(page, "perf-seed-1");
  await page.waitForTimeout(2000);
  const cycleProps = await props();
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.mouse.move(10, 850);
  await page.waitForTimeout(300);
  const beforeRestorePixels = await page.screenshot({
    clip: { x: 650, y: 340, width: 450, height: 550 },
    path: resolve(options.out, "before-restore.png"),
  });
  await cdp.send("Performance.enable");
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(cyclePointer.clientX, cyclePointer.clientY);
    await page.mouse.down();
    await page.mouse.move(cyclePointer.clientX + 12, cyclePointer.clientY + 8, {
      steps: 4,
    });
    await page.mouse.up();
    await page.waitForTimeout(150);
    assert.notDeepEqual(await props(), cycleProps, `cycle ${i} drag commit`);
    await page.evaluate(() => window.__composition_STORE__.getState().undo());
    await page.waitForTimeout(150);
    assert.deepEqual(await props(), cycleProps, `cycle ${i} drag undo`);
    await reset();
    await page.evaluate(() => {
      const gl = document
        .querySelector('[data-testid="skia-canvas-unified"]')
        .getContext("webgl2");
      window.__frameContextTest = gl.getExtension("WEBGL_lose_context");
      if (!window.__frameContextTest)
        throw new Error("context loss extension unsupported");
      window.__frameContextTest.loseContext();
    });
    await page.waitForFunction(
      () =>
        window.__composition_FRAME_CAPTURE__.probe().rendererSources[0].gpu
          .contextLost,
    );
    await page.waitForTimeout(50);
    await page.evaluate(() => window.__frameContextTest.restoreContext());
    await page.waitForFunction(() => {
      const s = window.__composition_FRAME_CAPTURE__.probe();
      return (
        !s.rendererSources[0].gpu.contextLost && s.counters.mainSubmission > 1
      );
    });
    await page.waitForTimeout(250);
    const snapshot = await capture();
    assert.equal(snapshot.rendererSources.length, 1);
    assert.equal(snapshot.rendererSources[0].resources.mainSurface, 1);
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = await cdp.send("Performance.getMetrics");
    result.contextCycles.push({
      capture: snapshot,
      metrics: metrics.metrics.filter((m) =>
        ["Nodes", "JSEventListeners", "JSHeapUsedSize"].includes(m.name),
      ),
    });
  }
  result.checks.contextRestore20 = true;
  result.checks.dragUndo20 = true;
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.mouse.move(10, 850);
  await page.waitForTimeout(2000);
  assert.ok(
    beforeRestorePixels.equals(
      await page.screenshot({
        clip: { x: 650, y: 340, width: 450, height: 550 },
        path: resolve(options.out, "after-restore.png"),
      }),
    ),
    "context restore Canvas pixel parity",
  );
  result.checks.contextPixelParity = true;
  await page.screenshot({ path: resolve(options.out, "restored.png") });

  await page.waitForTimeout(2000); // minimap 1500ms 종료와 최종 overlay 제출 뒤 settled 구간
  await reset();
  await page.waitForTimeout(10000);
  result.settled = await capture();
  assert.equal(result.settled.counters.contentBuild, 0);
  assert.equal(result.settled.counters.planBuild, 0);
  assert.equal(result.settled.counters.mainSubmission, 0);
  result.checks.settledIdle = true;
  // 자원 완료가 동일한 document revision에서도 content를 다시 제출한다.
  let imageRoute;
  let routeSeen;
  const pendingImage = new Promise((resolve) => {
    routeSeen = resolve;
  });
  await page.route("**/frame-delayed-fixture.png", (route) => {
    imageRoute = route;
    routeSeen();
  });
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ee2266";
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.evaluate(() => {
    const s = window.__composition_STORE__.getState();
    const body = s.elements.find(
      (e) => e.page_id === s.currentPageId && e.type === "body",
    );
    return s.addComplexElement(
      {
        id: "frame-delayed-image",
        type: "Image",
        parent_id: body.id,
        page_id: s.currentPageId,
        props: {
          src: location.origin + "/frame-delayed-fixture.png",
          alt: "Delayed fixture",
          style: {
            position: "absolute",
            left: "40px",
            top: "40px",
            width: "96px",
            height: "96px",
          },
        },
      },
      [],
    );
  });
  await Promise.race([
    pendingImage,
    page.waitForTimeout(10000).then(() => {
      throw new Error("image request missing");
    }),
  ]);
  await page.waitForTimeout(300);
  await reset();
  await imageRoute.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from(png, "base64"),
  });
  await page.waitForFunction(() => {
    const s = window.__composition_FRAME_CAPTURE__.probe();
    return (
      s.counters.mainSubmission > 0 &&
      s.rendererSources[0].resources.imagesGlobal > 0
    );
  });
  result.checks.delayedImage = await capture();
  await reset();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("composition:custom-fonts-updated")),
  );
  await waitForSubmission();
  result.checks.fontSyncPublication = true; // 기존 폰트 동기화 알림; 신규 외부 font 다운로드 측정은 아님.
  await reset();
  await page.setViewportSize({ width: 1280, height: 800 });
  await waitForSubmission();
  result.checks.resize = true;
  await page.evaluate(() => {
    history.pushState(null, "", "/composition/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForFunction(
    () =>
      window.__composition_FRAME_CAPTURE__.probe().rendererSources.length === 0,
  );
  await reset();
  await page.waitForTimeout(300);
  result.unmounted = await capture();
  assert.equal(result.unmounted.counters.renderRaf, 0);
  result.checks.unmount = true;
  const errors = collectErrors();
  assert.equal(errors.length, 0, errors.join("\n"));
} catch (error) {
  result.failure = String(error);
  // createInstrumentedContext 가 리스너 등록 뒤에 throw 하면 수집분이 error 에 실린다.
  collected ??= error.collected ?? null;
  throw error;
} finally {
  try {
    await browser.close();
  } finally {
    // close 뒤에 읽어야 unload/teardown pageerror 까지 들어온다.
    result.errors = collectErrors();
    result.errorLog = collected?.errorLog ?? [];
    writeFileSync(
      resolve(options.out, "exercise.json"),
      JSON.stringify(result, null, 2),
    );
  }
}

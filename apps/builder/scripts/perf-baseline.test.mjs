import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import {
  FRAME_CLASSES,
  parseArgs,
  RECORDER_SCRIPT,
  summarizeRecording,
} from "./perf-baseline.mjs";

async function record(samples, layerTreeRows = 0) {
  let now = 0;
  let next;
  const window = {};
  runInNewContext(RECORDER_SCRIPT, {
    window,
    performance: { now: () => now },
    document: {
      querySelectorAll: (selector) => {
        assert.equal(selector, '.layer-tree--rac-virtualized [role="row"]');
        return { length: layerTreeRows };
      },
    },
    requestAnimationFrame: (callback) => {
      next = callback;
    },
  });
  window.__perfRecorder.start();
  for (const [timestamp, callbackTime] of samples) {
    now = callbackTime;
    next(timestamp);
  }
  return window.__perfRecorder.stop();
}

test("frame 결과에 LayerTree로 scope한 가시 행 수를 기록한다", async () => {
  const result = summarizeRecording(await record([[10, 11]], 17));
  assert.equal(result.layerTreeRows, 17);
});

test("Navigator 측정은 실제 root를 펼쳐 5k 창 렌더를 활성화한다", async () => {
  const source = await readFile(
    new URL("./perf-baseline.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /button\[aria-label\^="Expand "\]/);
  assert.match(source, /finalRows <= 1/);
  assert.match(source, /await expandLayerTreeRoot\(page\)/);
});

test("callback 지연 증가를 RAF cadence 누락으로 집계하지 않는다", async () => {
  const rec = await record([
    [10, 11],
    [26, 41],
    [42, 43],
  ]);
  const result = summarizeRecording(rec);
  assert.equal(result.frames, 3);
  assert.equal(result.gapMax, 30);
  assert.equal(result.dropPct, 33.3);
  assert.equal(result.rafTimestampGap.count, 2);
  assert.equal(result.rafTimestampGap.max, 16);
  assert.equal(result.rafTimestampGap.overThreshold, 0);
  assert.equal(result.callbackDelay.max, 15);
  assert.equal(result.gapEvents[0].rafGap, 16);
});

test("실제 RAF timestamp 간격 초과를 별도로 보존한다", async () => {
  const result = summarizeRecording(
    await record([
      [10, 11],
      [60, 61],
    ]),
  );
  assert.equal(result.rafTimestampGap.max, 50);
  assert.equal(result.rafTimestampGap.overThresholdPct, 100);
  assert.equal(result.callbackDelay.max, 1);
  assert.equal(result.gapEvents[0].rafGap, 50);
});

test("첫 callback 대기는 기존 gap에만 포함하고 RAF 간격을 만들지 않는다", async () => {
  const result = summarizeRecording(await record([[40, 42]]));
  assert.equal(result.gapMax, 42);
  assert.equal(result.dropPct, 100);
  assert.equal(result.rafTimestampGap.count, 0);
  assert.equal(result.rafTimestampGap.overThresholdPct, 0);
  assert.equal(result.gapEvents[0].rafGap, null);
});

test("선택 driver 기본값과 명시 옵션을 검증한다", () => {
  assert.equal(parseArgs([]).selectionDriver, "external-props");
  assert.equal(
    parseArgs(["--selection-driver", "id-only"]).selectionDriver,
    "id-only",
  );
  assert.throws(
    () => parseArgs(["--selection-driver", "typo"]),
    /selection driver/,
  );
});

test("격리 프로젝트의 IndexedDB를 후속 persistent run용 storage state로 저장한다", async () => {
  const snapshotPath = "/private/tmp/adr203-storage-state.json";
  assert.equal(
    parseArgs(["--save-storage-state", snapshotPath]).saveStorageState,
    resolve(snapshotPath),
  );

  const source = await readFile(
    new URL("./perf-baseline.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /context\.storageState\(\{[\s\S]*indexedDB: true/);
});

test("pointer exercise는 실제 canvas mouse click과 선택 결과를 기록한다", async () => {
  assert.equal(parseArgs(["--pointer-exercise"]).pointerExercise, true);

  const source = await readFile(
    new URL("./perf-baseline.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /page\.mouse\.click\(probe\.clientX, probe\.clientY\)/);
  assert.match(source, /page\.keyboard\.press\("Meta\+0"\)/);
  assert.match(source, /page\.mouse\.down\(\{ button: "middle" \}\)/);
  assert.match(source, /actualElementId === targetId/);
  assert.match(source, /setSelectedElement\(null\)/);
  assert.match(source, /renderDebug\?\.readCamera\(\)/);
});

test("ID-only driver는 props 투영 없이 실제 선택 handler와 같은 인수를 전달한다", async () => {
  for (const selectionDriver of ["id-only", "external-props"]) {
    const calls = [];
    const props = { style: { color: "red" } };
    const state = {
      get elements() {
        assert.equal(selectionDriver, "external-props");
        return [{ id: "node", props }];
      },
      setSelectedElement: (...args) => calls.push(args),
      clearSelection() {},
    };
    let now = 0;
    const page = {
      evaluate: (fn, args) =>
        runInNewContext(`(${fn.toString()})(args)`, {
          args,
          window: { __composition_STORE__: { getState: () => state } },
          performance: { now: () => now++ },
          setTimeout: (callback) => callback(),
        }),
    };
    await FRAME_CLASSES.select(page, { seedIds: ["node"], selectionDriver }, 2);
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], "node");
    assert.equal(calls[0].length, selectionDriver === "id-only" ? 1 : 4);
    assert.deepEqual(calls[1], [null]);
    if (selectionDriver === "external-props") {
      assert.equal(calls[0][1], props);
      assert.equal(calls[0][2], props.style);
      assert.equal(Object.keys(calls[0][3]).length, 0);
    }
  }
});

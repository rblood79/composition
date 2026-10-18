// ADR-246 G1 (f) — 판정 함수 fixture. `node --test apps/builder/scripts/perf-ratchet-gate.test.mjs`
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAddClasses,
  applyAddKeys,
  applyAddRun,
  applyRaise,
  applyUpdate,
  bLimit,
  buildSeedCeilings,
  countsByClass,
  decide,
  flattenCounts,
  judge,
  runKeyOf,
  harnessArgsFrom,
} from "./perf-ratchet-gate.mjs";
import { revisionProblems } from "./perf-ratchet-run.mjs";

const ratchet = () => ({
  band: 1.03,
  minSlack: 2,
  runs: { 60: { classes: ["select"], args: [] } },
  seeds: {
    60: {
      select: {
        A: { "perfLabels.render.frame": 60, "caches.commandStream.misses": 0 },
        B: { reactRenderMeasures: 5900 },
      },
    },
  },
  raises: [],
});
const measure = (over = {}) => ({
  60: {
    select: {
      "perfLabels.render.frame": 60,
      "caches.commandStream.misses": 0,
      reactRenderMeasures: 5900,
      ...over,
    },
  },
});

test("같으면 통과 · 하향 후보 없음", () => {
  const v = judge(ratchet(), measure());
  assert.equal(v.overA.length, 0);
  assert.equal(v.overB.length, 0);
  assert.equal(v.lowerable.length, 0);
  assert.equal(decide(v), "pass");
});

test("등급 A 1 초과 → 재실행 요구 → 같은 값이면 차단", () => {
  const first = judge(ratchet(), measure({ "caches.commandStream.misses": 1 }));
  assert.deepEqual(
    first.overA.map((o) => o.path),
    ["seeds.60.select.A.caches.commandStream.misses"],
  );
  assert.equal(decide(first), "rerun");
  const second = judge(
    ratchet(),
    measure({ "caches.commandStream.misses": 1 }),
  );
  assert.equal(decide(first, second), "block");
});

test("HC2 — 재실행이 통과하거나 값이 다르면 측정 불가 (차단 아님)", () => {
  const first = judge(ratchet(), measure({ "perfLabels.render.frame": 70 }));
  assert.equal(decide(first, judge(ratchet(), measure())), "unmeasurable");
  assert.equal(
    decide(first, judge(ratchet(), measure({ "perfLabels.render.frame": 71 }))),
    "unmeasurable",
  );
});

test("등급 B 단독 초과는 경고만 — 밴드 = max(ceil(×1.03), +2)", () => {
  assert.equal(bLimit(5900, ratchet()), 6077);
  assert.equal(bLimit(10, ratchet()), 12);
  const v = judge(ratchet(), measure({ reactRenderMeasures: 6100 }));
  assert.equal(v.overB.length, 1);
  assert.equal(decide(v), "pass");
  assert.equal(
    judge(ratchet(), measure({ reactRenderMeasures: 6077 })).overB.length,
    0,
  );
});

test("하향만 기록 — --update 는 올리지 않는다 · 새 지표는 B 로", () => {
  const v = judge(
    ratchet(),
    measure({ "perfLabels.render.frame": 50, "perfLabels.scene.build": 3 }),
  );
  assert.equal(
    v.lowerable[0].path,
    "seeds.60.select.A.perfLabels.render.frame",
  );
  const next = applyUpdate(ratchet(), v);
  assert.equal(next.seeds[60].select.A["perfLabels.render.frame"], 50);
  assert.equal(next.seeds[60].select.B["perfLabels.scene.build"], 3);
  assert.equal(next.seeds[60].select.B.reactRenderMeasures, 5900);
});

test("올리기 뒤 --update 로 낮추면 그 올리기는 끝난다 — 낮춘 값이 상한", () => {
  const path = "seeds.60.select.A.perfLabels.render.frame";
  const raised = applyRaise(
    ratchet(),
    {
      path,
      to: 70,
      approvedBy: "사용자",
      reason: "fixture",
      expires: "2026-12-01",
    },
    "2026-10-01",
  );
  const today = "2026-10-15";
  const next = applyUpdate(
    raised,
    judge(raised, measure({ "perfLabels.render.frame": 50 }), { today }),
    { today },
  );
  assert.equal(next.raises[0].supersededOn, today);
  const again = judge(next, measure({ "perfLabels.render.frame": 50 }), {
    today,
  });
  assert.deepEqual(again.lowerable, []);
  assert.equal(
    judge(next, measure({ "perfLabels.render.frame": 55 }), { today }).overA
      .length,
    1,
  );
});

test("올리기는 승인 필드 전부 필요 · 만료 뒤 원래 상한으로 판정", () => {
  assert.throws(() =>
    applyRaise(ratchet(), {
      path: "seeds.60.select.A.caches.commandStream.misses",
      to: 3,
    }),
  );
  const raised = applyRaise(
    ratchet(),
    {
      path: "seeds.60.select.A.caches.commandStream.misses",
      to: 3,
      approvedBy: "사용자",
      reason: "fixture",
      expires: "2026-10-10",
    },
    "2026-09-27",
  );
  assert.equal(
    judge(raised, measure({ "caches.commandStream.misses": 3 }), {
      today: "2026-10-01",
    }).overA.length,
    0,
  );
  assert.equal(
    judge(raised, measure({ "caches.commandStream.misses": 3 }), {
      today: "2026-10-11",
    }).overA.length,
    1,
  );
  assert.throws(() =>
    applyRaise(ratchet(), {
      path: "seeds.60.select.A.perfLabels.render.frame",
      to: 10,
      approvedBy: "x",
      reason: "y",
      expires: "2026-12-01",
    }),
  );
});

test("초기화 — 반복 실행에서 같은 값만 A, 흔들린 값과 ALWAYS_B 는 B (최댓값)", () => {
  const seed = buildSeedCeilings([
    {
      edit: {
        "perfLabels.scene.build": 16,
        "cdp.LayoutCount": 7,
        "domMutations.childList": 7,
        "caches.x.hits": 3,
      },
    },
    {
      edit: {
        "perfLabels.scene.build": 16,
        "cdp.LayoutCount": 7,
        "domMutations.childList": 8,
        "caches.x.hits": 4,
      },
    },
  ]);
  assert.deepEqual(seed.edit.A, { "perfLabels.scene.build": 16 });
  assert.deepEqual(seed.edit.B, {
    "caches.x.hits": 4,
    "cdp.LayoutCount": 7,
    "domMutations.childList": 8,
  });
});

test("flattenCounts — v8 상위 함수는 file#fn 키, 합계·게이지는 제외", () => {
  const flat = flattenCounts({
    perfLabels: { "render.frame": 3 },
    caches: {
      commandStream: { hits: 1, misses: 0, missReasons: { forced: 0 } },
    },
    measuresTotal: 99,
    v8: {
      total: 1e6,
      app: 500,
      deps: 10,
      topApp: [
        { fn: "f", file: "src/a.ts", n: 40 },
        // The profiler's per-frame rAF tick counts frames, not work — left out.
        {
          fn: "(anonymous)",
          file: "src/builder/workspace/canvas/utils/gpuProfilerCore.ts",
          n: 1442,
        },
      ],
    },
  });
  assert.deepEqual(flat, {
    "perfLabels.render.frame": 3,
    "caches.commandStream.hits": 1,
    "caches.commandStream.misses": 0,
    "caches.commandStream.missReasons.forced": 0,
    "v8.app": 500,
    "v8.fn.src/a.ts#f": 40,
  });
});

test("revision — push 대상 ≠ HEAD · 런타임 tracked 변경은 문제, untracked 는 무시", () => {
  assert.deepEqual(
    revisionProblems("aaa", { head: "aaa", dirtyLines: ["?? apps/x.tmp"] }),
    [],
  );
  assert.equal(
    revisionProblems("bbb", { head: "aaa", dirtyLines: [] }).length,
    1,
  );
  assert.equal(
    revisionProblems("aaa", {
      head: "aaa",
      dirtyLines: [" M apps/builder/vite.config.ts"],
    }).length,
    1,
  );
});

test("분리된 catalog React 모듈도 기존 함수 호출 상한으로 판정한다", () => {
  const file = "src/builder/catalogRuntime/react.runtime.ts";
  const key = "v8.fn.src/builder/catalogRuntime/react.tsx#useCatalogWorkspace";
  const r = ratchet();
  r.seeds[60].select.A[key] = 10;
  const flat = flattenCounts({
    v8: { topApp: [{ file, fn: "useCatalogWorkspace", n: 11 }] },
  });
  assert.equal(flat[key], 11);
  const verdict = judge(r, measure(flat));
  assert.equal(verdict.overA.length, 1);
  assert.equal(verdict.lowerable.length, 0);
  assert.equal(decide(verdict, verdict), "block");
});

test("분리 모듈의 같은 이름은 합산하고 동일 원본 중복은 최대값을 유지한다", () => {
  const flat = flattenCounts({
    v8: {
      topApp: [
        {
          file: "src/builder/catalogRuntime/react.runtime.ts",
          fn: "(anonymous)",
          n: 4,
        },
        {
          file: "src/builder/catalogRuntime/react.runtime.ts",
          fn: "(anonymous)",
          n: 3,
        },
        {
          file: "src/builder/catalogRuntime/react.components.tsx",
          fn: "(anonymous)",
          n: 5,
        },
        { file: "src/other.runtime.ts", fn: "f", n: 2 },
        { file: "src/other.runtime.ts", fn: "f", n: 1 },
      ],
    },
  });
  assert.deepEqual(flat, {
    "v8.fn.src/builder/catalogRuntime/react.tsx#(anonymous)": 9,
    "v8.fn.src/other.runtime.ts#f": 2,
  });
});

test("v8.fn 키는 상위 목록에 없으면 판정하지 않는다 — 0 으로 읽어 하향 · 차단하지 않음", () => {
  const r = ratchet();
  r.seeds[60].select.A["v8.fn.src/a.ts#hot"] = 0;
  r.seeds[60].select.B["v8.fn.src/b.ts#ranked"] = 900;
  const absent = judge(r, measure());
  assert.equal(absent.lowerable.length, 0);
  assert.equal(absent.overA.length, 0);
  const back = judge(r, measure({ "v8.fn.src/a.ts#hot": 62910 }));
  assert.deepEqual(
    back.overA.map((o) => o.path),
    ["seeds.60.select.A.v8.fn.src/a.ts#hot"],
  );
});

const addReport = (classes, counts, opts = {}) => ({
  head: "abc",
  options: {
    seedCount: 60,
    fixedInputs: true,
    callCounts: false,
    classes,
    ...opts,
  },
  results: Object.fromEntries(
    classes.map((cls) => [cls, { counts: counts[cls] ?? {} }]),
  ),
});

test("--add-class — 기존 부류 상한은 그대로, 새 부류만 반복 실행으로 A/B 를 정한다", () => {
  const base = ratchet();
  base.runs[60].args = [
    "--lane",
    "frame",
    "--seed-count",
    "60",
    "--fixed-inputs",
    "--classes",
    "select",
  ];
  const select = {
    perfLabels: { "render.frame": 50 },
    caches: { commandStream: { misses: 0 } },
    reactRenderMeasures: 5000,
  };
  const reports = [
    addReport(["select", "drag"], {
      select,
      drag: { perfLabels: { "render.frame": 180 }, reactRenderMeasures: 236 },
    }),
    addReport(["select", "drag"], {
      select,
      drag: { perfLabels: { "render.frame": 180 }, reactRenderMeasures: 226 },
    }),
  ];
  const next = applyAddClasses(base, "60", reports);
  // 낮은 측정값이 와도 기존 상한을 바꾸지 않는다 (하향은 --update 의 일)
  assert.deepEqual(next.seeds[60].select, base.seeds[60].select);
  assert.deepEqual(next.seeds[60].drag, {
    A: { "perfLabels.render.frame": 180 },
    B: { reactRenderMeasures: 236 },
  });
  assert.deepEqual(next.runs[60].classes, ["select", "drag"]);
  assert.deepEqual(next.runs[60].args, [
    "--lane",
    "frame",
    "--seed-count",
    "60",
    "--fixed-inputs",
    "--classes",
    "select,drag",
  ]);
  assert.deepEqual(base.runs[60].classes, ["select"]); // 원본 불변
});

test("--add-class — 기존 부류가 A 를 넘거나 조건 · 순서가 다르면 거부한다", () => {
  const base = ratchet();
  const ok = {
    perfLabels: { "render.frame": 60 },
    caches: { commandStream: { misses: 0 } },
  };
  const over = { ...ok, caches: { commandStream: { misses: 1 } } };
  assert.throws(
    () =>
      applyAddClasses(base, "60", [
        addReport(["select", "drag"], { select: over }),
      ]),
    /A 초과/,
  );
  assert.throws(
    () =>
      applyAddClasses(base, "60", [
        addReport(["drag", "select"], { select: ok }),
      ]),
    /앞에 그대로/,
  );
  assert.throws(
    () =>
      applyAddClasses(base, "60", [
        addReport(["select", "drag"], { select: ok }, { seedCount: 600 }),
      ]),
    /seed/,
  );
  assert.throws(
    () => applyAddClasses(base, "60", [addReport(["select"], { select: ok })]),
    /새 부류가 없다/,
  );
});

// ADR-263 HC5 — 새 카운트의 A 등록 (0 포함) 과 원복 RED 판정
const keysBase = () => {
  const base = ratchet();
  base.recorderSha256 = "old";
  base.runs[60].args = [
    "--lane",
    "frame",
    "--seed-count",
    "60",
    "--fixed-inputs",
    "--classes",
    "select",
  ];
  return base;
};
const keysReport = (render) =>
  addReport(["select"], {
    select: {
      perfLabels: { "render.frame": 60 },
      caches: { commandStream: { misses: 0 } },
      reactRenderMeasures: 5900,
      render,
    },
  });

test("--add-keys — 2회 같은 값을 0 포함 A 로 넣고 기존 상한은 그대로 둔다", () => {
  const base = keysBase();
  const render = { bufferProxyReads: 0, execVisited: 100 };
  const next = applyAddKeys(
    base,
    "60",
    [keysReport(render), keysReport(render)],
    ["render.*"],
    {
      recorderSha: "old",
    },
  );
  assert.equal(next.seeds[60].select.A["render.bufferProxyReads"], 0);
  assert.equal(next.seeds[60].select.A["render.execVisited"], 100);
  assert.equal(next.seeds[60].select.A["perfLabels.render.frame"], 60);
  assert.deepEqual(next.seeds[60].select.B, base.seeds[60].select.B);
  assert.equal(base.seeds[60].select.A["render.execVisited"], undefined); // 원본 불변

  // 원복 RED: 0 → 5,000 · 100 → 1,000 이면 두 번 다 같은 초과 → block
  const regressed = {
    60: countsByClass(
      keysReport({ bufferProxyReads: 5000, execVisited: 1000 }),
    ),
  };
  const first = judge(next, regressed);
  assert.deepEqual(first.overA.map((o) => o.path).sort(), [
    "seeds.60.select.A.render.bufferProxyReads",
    "seeds.60.select.A.render.execVisited",
  ]);
  assert.equal(decide(first, judge(next, regressed)), "block");
  // 같은 회귀를 --update 만으로 넣었다면 통과했을 것 (M2 반례)
  const updated = applyUpdate(
    base,
    judge(base, { 60: countsByClass(keysReport(render)) }),
  );
  assert.equal(
    decide(judge(updated, regressed), judge(updated, regressed)),
    "pass",
  );
});

// ADR-268 G0 (b) — 엔진 카운트를 0 포함 A 로 등록하면 +1 이 차단이다 (`--update` 면 0 키는 판정 밖)
test("--add-keys — engine.* 0 포함 A 등록 뒤 +1 보고는 block", () => {
  const base = keysBase();
  const engineReport = (engine) =>
    addReport(["select"], {
      select: {
        perfLabels: { "render.frame": 60 },
        caches: { commandStream: { misses: 0 } },
        reactRenderMeasures: 5900,
        engine,
      },
    });
  const at = { solveVisits: 12, intrinsicMeasureMiss: 0 };
  const next = applyAddKeys(
    base,
    "60",
    [engineReport(at), engineReport(at)],
    ["engine.solveVisits", "engine.intrinsicMeasureMiss"],
    { recorderSha: "old" },
  );
  assert.equal(next.seeds[60].select.A["engine.solveVisits"], 12);
  assert.equal(next.seeds[60].select.A["engine.intrinsicMeasureMiss"], 0);
  for (const over of [
    { solveVisits: 13, intrinsicMeasureMiss: 0 },
    { solveVisits: 12, intrinsicMeasureMiss: 1 },
  ]) {
    const regressed = { 60: countsByClass(engineReport(over)) };
    assert.equal(
      decide(judge(next, regressed), judge(next, regressed)),
      "block",
      JSON.stringify(over),
    );
  }
  // --update 로 넣었다면: 0 키는 newKeys 에서 빠져 등록되지 않고 +1 은 통과한다
  const updated = applyUpdate(
    base,
    judge(base, { 60: countsByClass(engineReport(at)) }),
  );
  const regressed = {
    60: countsByClass(
      engineReport({ solveVisits: 12, intrinsicMeasureMiss: 1 }),
    ),
  };
  assert.equal(
    decide(judge(updated, regressed), judge(updated, regressed)),
    "pass",
  );
});

test("--add-keys — 값이 갈리거나 · 기존 키 · v8.fn · 조건 불일치 · 기존 A 초과면 거부한다", () => {
  const base = keysBase();
  const r = (v) => keysReport({ execVisited: v });
  assert.throws(
    () => applyAddKeys(base, "60", [r(1), r(2)], ["render.execVisited"]),
    /갈린/,
  );
  assert.throws(
    () => applyAddKeys(base, "60", [r(1)], ["render.execVisited"]),
    /둘 이상/,
  );
  // 접두 패턴은 「접두.*」 뿐 — `gpuContexts*` 는 글자 그대로 0 키가 되던 것 (ADR-273 후속)
  assert.throws(
    () => applyAddKeys(base, "60", [r(1), r(1)], ["render.execVisit*"]),
    /접두\.\*/,
  );
  assert.throws(
    () => applyAddKeys(base, "60", [r(1), r(1)], ["perfLabels.render.frame"]),
    /이미 상한/,
  );
  assert.throws(
    () => applyAddKeys(base, "60", [r(1), r(1)], ["v8.fn.src/a.ts#f"]),
    /v8\.fn/,
  );
  const other = addReport(["select", "drag"], {});
  assert.throws(
    () => applyAddKeys(base, "60", [other, other], ["render.*"]),
    /조건 불일치/,
  );
  const over = addReport(["select"], {
    select: { perfLabels: { "render.frame": 61 }, render: { execVisited: 1 } },
  });
  assert.throws(
    () => applyAddKeys(base, "60", [over, over], ["render.*"]),
    /기존 A 초과/,
  );
});

test("--add-keys — recorder 해시가 바뀌면 --accept-recorder 일 때만 기록한다", () => {
  const base = keysBase();
  const r = keysReport({ execVisited: 3 });
  assert.throws(
    () =>
      applyAddKeys(base, "60", [r, r], ["render.*"], { recorderSha: "new" }),
    /accept-recorder/,
  );
  const next = applyAddKeys(base, "60", [r, r], ["render.*"], {
    recorderSha: "new",
    acceptRecorder: true,
    today: "2026-10-16",
  });
  assert.equal(next.recorderSha256, "new");
  assert.deepEqual(next.recorderChanges, [
    { from: "old", to: "new", on: "2026-10-16", reason: "--add-keys render.*" },
  ]);
});

// ADR-264 — fixture 가 다른 run (중첩 문서) 을 같은 게이트에 더한다
test("--add-run — fixture 가 run 키와 하니스 인자에 실리고, 등록한 키의 회귀는 block", () => {
  const nested = (writes) =>
    addReport(
      ["edit"],
      { edit: { render: { patchWrites: writes, patchMovedOnlyCommands: 0 } } },
      { seedCount: 600, fixtureKind: "nested-flex" },
    );
  assert.equal(runKeyOf({ seedCount: 600 }), "600");
  assert.equal(runKeyOf({ seedCount: 600, fixtureKind: "mixed" }), "600");
  assert.equal(
    runKeyOf({ seedCount: 600, fixtureKind: "nested-flex" }),
    "600:nested-flex",
  );
  // ADR-273: DPR 1 이 아니면 키 · 인자에 DPR 을 싣는다
  assert.equal(runKeyOf({ seedCount: 60, dpr: 1 }), "60");
  assert.equal(
    runKeyOf({ seedCount: 60, fixtureKind: "app-pages", dpr: 2 }),
    "60:app-pages@dpr2",
  );
  assert.deepEqual(
    harnessArgsFrom({
      seedCount: 60,
      fixtureKind: "app-pages",
      dpr: 2,
      fixedInputs: true,
      classes: ["pan", "zoom"],
    }),
    [
      "--lane",
      "frame",
      "--seed-count",
      "60",
      "--fixed-inputs",
      "--fixture-kind",
      "app-pages",
      "--dpr",
      "2",
      "--classes",
      "pan,zoom",
    ],
  );
  const base = ratchet();
  const next = applyAddRun(base, "600:nested-flex", [nested(95), nested(95)], {
    today: "2026-10-16",
  });
  assert.deepEqual(next.runs["600:nested-flex"].args, [
    "--lane",
    "frame",
    "--seed-count",
    "600",
    "--fixed-inputs",
    "--fixture-kind",
    "nested-flex",
    "--classes",
    "edit",
  ]);
  assert.equal(next.seeds["600:nested-flex"].edit.A["render.patchWrites"], 95);
  assert.equal(
    next.seeds["600:nested-flex"].edit.A["render.patchMovedOnlyCommands"],
    0,
  );
  // 기존 run 은 그대로
  assert.deepEqual(next.runs[60], base.runs[60]);
  assert.deepEqual(next.seeds[60], base.seeds[60]);
  // 원복 RED: 등록한 키가 올라가면 decide = block
  const verdict = judge(next, {
    "600:nested-flex": countsByClass(nested(25623)),
  });
  assert.equal(decide(verdict, verdict), "block");
  assert.throws(
    () => applyAddRun(next, "600:nested-flex", [nested(95), nested(95)]),
    /이미 있다/,
  );
  assert.throws(
    () => applyAddRun(base, "600", [nested(95), nested(95)]),
    /run 불일치/,
  );
  assert.throws(
    () => applyAddRun(base, "600:nested-flex", [nested(95)]),
    /둘 이상/,
  );
});

test("ADR-271: --zoom 은 run 키 · 저장 args 에 실리고 재실행 인자가 같은 키를 낸다 (r1 M4)", async () => {
  const { parseArgs } = await import("./perf-baseline.mjs");
  assert.equal(
    runKeyOf({ seedCount: 60, fixtureKind: "app-pages", zoom: null }),
    "60:app-pages",
  );
  assert.equal(
    runKeyOf({ seedCount: 60, fixtureKind: "app-pages", zoom: 0.1 }),
    "60:app-pages@zoom0.1",
  );
  assert.equal(
    runKeyOf({ seedCount: 60, fixtureKind: "app-pages", zoom: 0.25, dpr: 2 }),
    "60:app-pages@zoom0.25@dpr2",
  );
  const options = {
    seedCount: 60,
    fixtureKind: "app-pages",
    zoom: 0.1,
    fixedInputs: true,
    classes: ["zoom", "zoom-ladder"],
  };
  const args = harnessArgsFrom(options);
  assert.deepEqual(
    args.slice(args.indexOf("--zoom"), args.indexOf("--zoom") + 2),
    ["--zoom", "0.1"],
  );
  // 게이트가 저장 args 로 다시 잴 때 하니스가 받는 options — 같은 배율 · 같은 키
  const rerun = parseArgs(args);
  assert.equal(rerun.zoom, 0.1);
  assert.equal(runKeyOf(rerun), runKeyOf(options));
  assert.equal(
    runKeyOf(parseArgs(harnessArgsFrom({ ...options, zoom: null }))),
    "60:app-pages",
  );
});

test("ADR-272: many-pages 는 페이지 수 · grid 간격이 run 키 · 저장 args 에 실린다", async () => {
  const { parseArgs } = await import("./perf-baseline.mjs");
  const options = {
    seedCount: 60,
    fixtureKind: "many-pages",
    pages: 100,
    gridGap: null,
    zoom: 0.1,
    fixedInputs: true,
    classes: ["zoom"],
  };
  assert.equal(runKeyOf(options), "60:many-pages100@zoom0.1");
  assert.equal(
    runKeyOf({ ...options, pages: 300, gridGap: 320 }),
    "60:many-pages300@gap320@zoom0.1",
  );
  for (const variant of [options, { ...options, pages: 300, gridGap: 320 }]) {
    const rerun = parseArgs(harnessArgsFrom(variant));
    assert.equal(runKeyOf(rerun), runKeyOf(variant));
  }
  // 다른 fixture 는 키가 그대로 (기존 run 보존)
  assert.equal(
    runKeyOf({ seedCount: 60, fixtureKind: "app-pages", pages: 2 }),
    "60:app-pages",
  );
  assert.throws(
    () => parseArgs(["--fixture-kind", "app-pages", "--grid-gap", "320"]),
    /many-pages 전용/,
  );
});

test("ADR-272: seed 키에 . 이 있어도 (@zoom0.1) --update · --raise 가 경로를 바르게 가른다", () => {
  const r = {
    seeds: {
      60: { zoom: { A: { "render.x": 9 }, B: {} } },
      // 다른 seed 의 접두 — 가장 긴 seed 키를 골라야 한다
      "60:app-pages@zoom0": { zoom: { A: { "render.x": 9 }, B: {} } },
      "60:app-pages@zoom0.1": {
        zoom: { A: { "render.x": 9, "warmAfter.a.b": 5 }, B: {} },
      },
    },
    raises: [],
  };
  const verdict = judge(r, {
    60: { zoom: { "render.x": 9 } },
    "60:app-pages@zoom0": { zoom: { "render.x": 9 } },
    "60:app-pages@zoom0.1": {
      zoom: { "render.x": 7, "warmAfter.a.b": 5, "render.y": 3 },
    },
  });
  const next = applyUpdate(r, verdict, { today: "2026-10-18" });
  assert.equal(next.seeds["60:app-pages@zoom0.1"].zoom.A["render.x"], 7);
  assert.equal(next.seeds["60:app-pages@zoom0.1"].zoom.B["render.y"], 3);
  assert.equal(next.seeds[60].zoom.A["render.x"], 9);
  const raised = applyRaise(
    r,
    {
      path: "seeds.60:app-pages@zoom0.1.zoom.A.warmAfter.a.b",
      to: 6,
      approvedBy: "u",
      reason: "t",
      expires: "2026-11-01",
    },
    "2026-10-18",
  );
  assert.equal(raised.raises[0].from, 5);
});

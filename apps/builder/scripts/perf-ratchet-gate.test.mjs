// ADR-246 G1 (f) — 판정 함수 fixture. `node --test apps/builder/scripts/perf-ratchet-gate.test.mjs`
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRaise,
  applyUpdate,
  bLimit,
  buildSeedCeilings,
  decide,
  flattenCounts,
  judge,
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
      topApp: [{ fn: "f", file: "src/a.ts", n: 40 }],
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

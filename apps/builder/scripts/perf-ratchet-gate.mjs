#!/usr/bin/env node
/**
 * ADR-246 — 결정적 카운트 ratchet 게이트.
 *
 * `perf-baseline.mjs --lane frame --fixed-inputs` 가 내는 `results.<부류>.counts` 를
 * `apps/builder/perf/ratchet.json` 의 상한과 비교한다. wall-clock (gap · taskMs · longtask)
 * 은 판정에 쓰지 않는다 — 같은 코드에서도 흔들려 게이트가 못 된다 (research 문서 §8-3).
 *
 *   등급 A — 같은 시드·옵션 반복 실행에서 값이 정확히 같았던 지표. 상한 = 값.
 *   등급 B — 반복 실행에서 조금씩 흔들린 지표 (React dev 렌더 measure · layout/style
 *            recalc · rAF 경계의 ±1 프레임). 상한 = max(ceil(값 × band), 값 + minSlack).
 *            B 단독 초과는 경고만 — 차단은 A 초과일 때.
 *
 * 자기검증 (HC2): A 초과가 나오면 같은 조건으로 1회 재실행한다. 두 번 다 초과이고 값이
 * 같을 때만 차단. 재실행 값이 다르면 "측정 불가" (같은 코드 · 다른 값 = 하니스 결함 신호).
 *
 * 상한은 내려가기만 한다 (HC3): `--update` 는 낮아진 값과 새 지표만 기록한다. 올리기는
 * `--raise` 로만, 승인자 · 사유 · 만료일이 모두 있어야 하며 만료 뒤에는 원래 상한으로 판정한다.
 * 올린 경로를 `--update` 가 낮추면 그 올리기는 끝난다 (`supersededOn`) — 낮춘 값이 상한이다.
 *
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --run [--sha <push sha>]      # pre-push 가 부른다
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --judge <seed>=<frame.json> … # 이미 잰 결과로 판정만
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --init <seed>=<frame.json>,<frame.json>,… …
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --update <seed>=<frame.json> …
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --add-class <seed>=<frame.json>,<frame.json>,…
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --add-keys <seed>=<frame.json>,<frame.json> --keys <k1,k2|접두.*> [--accept-recorder]
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --add-run <seed>[:<fixture>]=<frame.json>,<frame.json>,…
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --raise <path> --to <n> --approved-by <who> --reason <why> --expires <YYYY-MM-DD>
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const RATCHET_PATH =
  process.env.PERF_RATCHET_PATH ??
  resolve(import.meta.dirname ?? ".", "../perf/ratchet.json");

/** 본질적으로 흔들리는 지표 — 반복 실행에서 같았더라도 B 로 둔다 (§8-2). */
const ALWAYS_B = [
  /^reactRenderMeasures$/,
  /^cdp\./,
  /^domMutations\.childList$/,
];

/** 판정에서 뺀다 — 카운트가 아니거나 (게이지 · 진단) run 마다 의미가 달라지는 값. */
const EXCLUDED = [
  /^measuresTotal$/,
  // ADR-273: GrDirectContext 캐시 사용 바이트의 고수위 — 횟수가 아니라 게이지라 run 마다 수십 KB 흔들린다
  // (166,000,132 ↔ 165,946,884 같은 코드). 판정은 `render.grCacheNearLimitFrames` (A) 가 맡는다.
  /^render\.grCacheUsageMax$/,
  /^v8\.topApp/,
  /^v8\.topDeps/,
  /^v8\.total$/,
  /^v8\.deps$/,
  // The GPU profiler's rAF `tick` runs once per frame: its call count is the frames the run
  // lasted (995 ~ 1442 on one commit, 2026-10-03) — time, not work.
  /^v8\.fn\.src\/builder\/workspace\/canvas\/utils\/gpuProfilerCore\.ts#\(anonymous\)$/,
];

const V8_SOURCE_IDENTITIES = new Map([
  [
    "src/builder/catalogRuntime/react.runtime.ts",
    "src/builder/catalogRuntime/react.tsx",
  ],
  [
    "src/builder/catalogRuntime/react.components.tsx",
    "src/builder/catalogRuntime/react.tsx",
  ],
]);

export function recorderSha256(recorderScript) {
  return createHash("sha256").update(recorderScript).digest("hex");
}

/**
 * `counts` 객체를 평탄 키 → 정수 맵으로. v8 상위 함수는 `v8.fn.<file>#<name>` 키로 편다
 * (--call-counts run 에서만 존재).
 */
export function flattenCounts(counts) {
  const out = {};
  const walk = (value, prefix) => {
    if (value == null) return;
    if (typeof value === "number") {
      out[prefix] = value;
      return;
    }
    if (typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (EXCLUDED.some((re) => re.test(key))) continue;
      walk(v, key);
    }
  };
  walk(counts, "");
  const sourceCounts = new Map();
  for (const f of counts?.v8?.topApp ?? []) {
    const key = `v8.fn.${f.file}#${f.fn}`;
    if (EXCLUDED.some((re) => re.test(key))) continue;
    const existing = sourceCounts.get(key);
    sourceCounts.set(key, { ...f, n: Math.max(existing?.n ?? 0, f.n) });
  }
  for (const f of sourceCounts.values()) {
    const file = V8_SOURCE_IDENTITIES.get(f.file) ?? f.file;
    const key = `v8.fn.${file}#${f.fn}`;
    out[key] = (out[key] ?? 0) + f.n;
  }
  return out;
}

/** frame lane 결과 JSON → { <부류>: flat counts } */
export function countsByClass(report) {
  const out = {};
  for (const [cls, r] of Object.entries(report.results ?? {}))
    if (r.counts) out[cls] = flattenCounts(r.counts);
  return out;
}

/**
 * 같은 조건 N 회 결과로 초기 상한을 만든다. 모든 run 에서 같은 값이면 A, 아니면 B (값 = 최댓값).
 * ALWAYS_B 는 같아도 B.
 */
export function buildSeedCeilings(runs) {
  const classes = new Set(runs.flatMap((r) => Object.keys(r)));
  const seed = {};
  for (const cls of classes) {
    const keys = new Set(runs.flatMap((r) => Object.keys(r[cls] ?? {})));
    const A = {};
    const B = {};
    for (const key of [...keys].sort()) {
      const values = runs.map((r) => r[cls]?.[key] ?? 0);
      const max = Math.max(...values);
      const stable = values.every((v) => v === values[0]);
      if (stable && !ALWAYS_B.some((re) => re.test(key))) A[key] = max;
      else B[key] = max;
    }
    seed[cls] = { A, B };
  }
  return seed;
}

export function bLimit(base, ratchet) {
  const band = ratchet.band ?? 1.03;
  const minSlack = ratchet.minSlack ?? 2;
  return Math.max(Math.ceil(base * band), base + minSlack);
}

/** 만료 전 · 하향으로 끝나지 않은 올리기 반영 — 경로 `seeds.<seed>.<cls>.<A|B>.<key>` */
export function effectiveCeiling(ratchet, seed, cls, grade, key, today) {
  const base = ratchet.seeds?.[seed]?.[cls]?.[grade]?.[key];
  const path = `seeds.${seed}.${cls}.${grade}.${key}`;
  const raise = (ratchet.raises ?? [])
    .filter(
      (r) =>
        r.path === path &&
        !r.supersededOn &&
        (!r.expires || today <= r.expires),
    )
    .at(-1);
  return raise ? raise.to : base;
}

/**
 * 판정. `measured` = { <seed>: { <cls>: flat counts } }.
 * 반환: overA (차단 후보) · overB (경고) · lowerable (--update 후보) · newKeys · missingClasses.
 */
/**
 * 함수별 호출 수 (`v8.fn.*`) 는 상위 20 만 기록된다. 목록에 없으면 0 이 아니라 "순위 밖" 이다 — 0 으로 읽으면 다른
 * 함수에 밀려난 것만으로 하향 (→ 0) 이 기록되고, 다시 순위에 들면 회귀 없이 차단된다. 그래서 판정하지 않는다.
 * 상한 0 은 "상위 20 밖에 머문다" 는 뜻이 된다.
 */
function isUnranked(actual, key) {
  return key.startsWith("v8.fn.") && !(key in actual);
}

export function judge(ratchet, measured, { today = isoToday() } = {}) {
  const overA = [];
  const overB = [];
  const lowerable = [];
  const newKeys = [];
  const missingClasses = [];
  for (const [seed, classes] of Object.entries(ratchet.seeds ?? {})) {
    for (const [cls, grades] of Object.entries(classes)) {
      const actual = measured[seed]?.[cls];
      if (!actual) {
        missingClasses.push(`${seed}.${cls}`);
        continue;
      }
      for (const [key] of Object.entries(grades.A ?? {})) {
        if (isUnranked(actual, key)) continue;
        const ceiling = effectiveCeiling(ratchet, seed, cls, "A", key, today);
        const value = actual[key] ?? 0;
        const path = `seeds.${seed}.${cls}.A.${key}`;
        if (value > ceiling) overA.push({ path, ceiling, value });
        else if (value < ceiling) lowerable.push({ path, ceiling, value });
      }
      for (const [key, base] of Object.entries(grades.B ?? {})) {
        if (isUnranked(actual, key)) continue;
        const ceiling = effectiveCeiling(ratchet, seed, cls, "B", key, today);
        const limit = bLimit(ceiling, ratchet);
        const value = actual[key] ?? 0;
        const path = `seeds.${seed}.${cls}.B.${key}`;
        if (value > limit) overB.push({ path, ceiling: base, limit, value });
        else if (bLimit(value, ratchet) < ceiling)
          lowerable.push({ path, ceiling: base, value });
      }
      const known = new Set([
        ...Object.keys(grades.A ?? {}),
        ...Object.keys(grades.B ?? {}),
      ]);
      for (const key of Object.keys(actual))
        if (!known.has(key) && actual[key] > 0)
          newKeys.push({
            path: `seeds.${seed}.${cls}.?.${key}`,
            value: actual[key],
          });
    }
  }
  return { overA, overB, lowerable, newKeys, missingClasses };
}

/**
 * HC2 — 첫 판정과 재실행 판정을 합친다.
 *  block: 두 번 다 A 초과이고 초과 목록 · 값이 같다
 *  unmeasurable: 첫 실행만 초과 · 또는 두 실행의 A 값이 다르다
 *  pass: A 초과 없음 (B 초과는 경고)
 */
export function decide(first, second = null) {
  if (!first.overA.length) return "pass";
  if (!second) return "rerun";
  const sig = (j) =>
    JSON.stringify(j.overA.map((o) => [o.path, o.value]).sort());
  if (second.overA.length && sig(first) === sig(second)) return "block";
  return "unmeasurable";
}

/**
 * 하향만 반영한 새 ratchet. 새 지표는 해당 등급을 알 수 없으므로 B 로 추가한다.
 * 하향 판정은 올리기를 반영한 상한 기준이므로, 낮춘 경로의 올리기는 끝낸다 — 남겨 두면
 * 상한이 계속 올린 값이라 같은 하향이 매번 다시 보고되고 낮춘 기준값은 쓰이지 않는다.
 */
/**
 * `seeds.<seed>.<부류>.<등급>.<지표>` → 조각. seed 키에 `.` 이 들어갈 수 있어 (`60:app-pages@zoom0.1`) `.` 으로
 * 자르지 않고 ratchet 의 seed 키 중 가장 긴 접두로 고른다 (ADR-272 — `--update` 가 `@zoom0.1` run 에서 깨졌다).
 */
export function parseRatchetPath(ratchet, path) {
  const seed = Object.keys(ratchet.seeds ?? {})
    .filter((s) => path.startsWith(`seeds.${s}.`))
    .sort((a, b) => b.length - a.length)[0];
  if (seed === undefined) return null;
  const [cls, grade, ...rest] = path
    .slice(`seeds.${seed}.`.length)
    .split(".");
  return { seed, cls, grade, key: rest.join(".") };
}

export function applyUpdate(
  ratchet,
  verdict,
  { head = null, today = isoToday() } = {},
) {
  const next = structuredClone(ratchet);
  for (const { path, value } of verdict.lowerable) {
    const { seed, cls, grade, key } = parseRatchetPath(next, path);
    next.seeds[seed][cls][grade][key] = value;
    for (const raise of next.raises ?? [])
      if (raise.path === path && !raise.supersededOn)
        raise.supersededOn = today;
  }
  for (const { path, value } of verdict.newKeys) {
    const { seed, cls, key } = parseRatchetPath(next, path);
    next.seeds[seed][cls].B[key] = value;
  }
  next.generatedAt = today;
  if (head) next.head = head;
  return next;
}

export function applyRaise(
  ratchet,
  { path, to, approvedBy, reason, expires },
  today = isoToday(),
) {
  if (!path || !(to >= 0) || !approvedBy || !reason || !expires)
    throw new Error(
      "올리기는 --raise <path> --to <n> --approved-by --reason --expires 가 모두 있어야 한다 (HC3)",
    );
  const parsed = parseRatchetPath(ratchet, path);
  const from = parsed
    ? ratchet.seeds[parsed.seed]?.[parsed.cls]?.[parsed.grade]?.[parsed.key]
    : null;
  if (from == null) throw new Error(`없는 경로: ${path}`);
  if (to <= from)
    throw new Error(`올리기가 아니다 (${from} → ${to}) — 낮추기는 --update`);
  const next = structuredClone(ratchet);
  next.raises = [
    ...(next.raises ?? []),
    { path, from, to, approvedBy, on: today, reason, expires },
  ];
  return next;
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function renderVerdict(verdict, { header = "", decision = null } = {}) {
  const lines = [];
  if (header) lines.push(header);
  if (verdict.overA.length) {
    lines.push(`  등급 A 초과 ${verdict.overA.length}:`);
    for (const o of verdict.overA.slice(0, 20))
      lines.push(`    ${o.path}  ${o.ceiling} → ${o.value}`);
  }
  if (verdict.overB.length) {
    lines.push(`  등급 B 초과 (경고) ${verdict.overB.length}:`);
    for (const o of verdict.overB.slice(0, 10))
      lines.push(`    ${o.path}  ${o.ceiling} (한도 ${o.limit}) → ${o.value}`);
  }
  if (verdict.missingClasses.length)
    lines.push(`  결과 없는 부류: ${verdict.missingClasses.join(", ")}`);
  if (verdict.lowerable.length)
    lines.push(
      `  하향 가능 ${verdict.lowerable.length} (--update 로 기록): ${verdict.lowerable
        .slice(0, 4)
        .map((l) => `${l.path} ${l.ceiling} → ${l.value}`)
        .join(" · ")}${verdict.lowerable.length > 4 ? " …" : ""}`,
    );
  if (verdict.newKeys.length)
    lines.push(`  새 지표 ${verdict.newKeys.length} (--update 로 B 에 추가)`);
  if (decision) lines.push(`  판정: ${decision}`);
  return lines.join("\n");
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/**
 * 기존 seed 에 부류를 더한다 — 기존 부류의 상한은 그대로 두고 (올리지도 낮추지도 않는다) 새 부류만
 * 반복 실행으로 A/B 를 정한다. 게이트는 한 페이지에서 부류를 차례로 돌리므로 새 부류는 기존 목록
 * 뒤에 붙인 같은 조건으로 재야 하고, 그 실행에서 기존 부류가 A 를 넘지 않아야 한다 (붙인 부류가
 * 앞 부류를 흔들지 않는다는 확인). `--init` 은 전체를 다시 써서 승인 없는 상향이 될 수 있다.
 */
export function applyAddClasses(
  ratchet,
  seed,
  reports,
  { today = isoToday() } = {},
) {
  const run = ratchet.runs?.[seed];
  if (!run || !ratchet.seeds?.[seed])
    throw new Error(`seed ${seed} 이 ratchet 에 없다 — --init 으로 시작`);
  const callCounts = run.args.includes("--call-counts");
  for (const report of reports) {
    const o = report.options;
    if (runKeyOf(o) !== String(seed))
      throw new Error(`seed 불일치: 결과 ${runKeyOf(o)} ≠ ${seed}`);
    if (!o.fixedInputs || Boolean(o.callCounts) !== callCounts)
      throw new Error(
        `조건 불일치: --fixed-inputs · --call-counts 가 seed ${seed} 기준과 같아야 한다`,
      );
    if (run.classes.some((cls, i) => o.classes[i] !== cls))
      throw new Error(
        `기존 부류 ${run.classes.join(",")} 를 앞에 그대로 두고 뒤에 붙여 재야 한다 — ${o.classes.join(",")}`,
      );
    const verdict = judge(
      { ...ratchet, seeds: { [seed]: ratchet.seeds[seed] } },
      { [seed]: countsByClass(report) },
      { today },
    );
    if (verdict.overA.length)
      throw new Error(
        `기존 부류 A 초과 ${verdict.overA.map((v) => v.path).join(", ")} — 붙인 부류가 앞 부류를 바꿨거나 회귀`,
      );
  }
  const added = reports[0].options.classes.slice(run.classes.length);
  if (!added.length) throw new Error("새 부류가 없다");
  const ceilings = buildSeedCeilings(
    reports.map((r) => {
      const byClass = countsByClass(r);
      return Object.fromEntries(added.map((cls) => [cls, byClass[cls] ?? {}]));
    }),
  );
  const next = structuredClone(ratchet);
  next.runs[seed] = {
    classes: reports[0].options.classes,
    args: harnessArgsFrom(reports[0].options),
  };
  for (const cls of added) next.seeds[seed][cls] = ceilings[cls];
  next.generatedAt = today;
  if (reports[0].head) next.head = reports[0].head;
  return next;
}

/**
 * ADR-263 HC5 — 새 카운트를 등급 A 상한으로 등록한다 (0 포함).
 *
 * `--update` 는 새 지표를 B (경고만) 에 넣고 값 0 은 넣지 않아 회귀를 막지 못한다 (`judge` 의
 * newKeys 조건 · `decide` 는 A 초과만 차단). 여기서는 같은 조건 (seed 의 부류 목록 · 하니스
 * 인자 그대로) 으로 잰 보고 둘 이상이 **같은 값** 을 낸 키만 A 로 넣는다. 기존 A · B 상한은
 * 바꾸지 않는다 — 이미 있는 키 · 값이 갈린 키 · 함수 순위 키 (`v8.fn.*`) 는 거부한다.
 *
 * 하니스 recorder 가 새 채널을 더해 해시가 바뀐 경우 (`acceptRecorder`): 모든 보고가 기존 A 를
 * 넘지 않아야 해시를 새로 기록한다 — 더한 채널이 기존 카운트를 올리지 않았다는 확인이다.
 *
 * `keys` 는 평탄 키 또는 `접두.*` (그 아래 전부).
 */
export function applyAddKeys(
  ratchet,
  seed,
  reports,
  keys,
  { recorderSha = null, acceptRecorder = false, today = isoToday() } = {},
) {
  const run = ratchet.runs?.[seed];
  if (!run || !ratchet.seeds?.[seed])
    throw new Error(`seed ${seed} 이 ratchet 에 없다 — --init 으로 시작`);
  if (reports.length < 2)
    throw new Error(
      "같은 조건 보고가 둘 이상 있어야 한다 (등급 A = 반복 실행에서 같은 값)",
    );
  if (!keys.length) throw new Error("--keys 가 비었다");
  if (keys.some((k) => k.startsWith("v8.fn.")))
    throw new Error("v8.fn.* 은 상위 20 순위 키라 A 로 등록하지 않는다");
  const recorderChanged =
    recorderSha !== null && ratchet.recorderSha256 !== recorderSha;
  if (recorderChanged && !acceptRecorder)
    throw new Error(
      "recorder 해시 불일치 — 채널을 더한 변경이면 --accept-recorder",
    );
  const args = JSON.stringify(run.args);
  for (const report of reports) {
    if (runKeyOf(report.options ?? {}) !== String(seed))
      throw new Error(
        `seed 불일치: 결과 ${runKeyOf(report.options ?? {})} ≠ ${seed}`,
      );
    if (JSON.stringify(harnessArgsFrom(report.options)) !== args)
      throw new Error(
        `조건 불일치: seed ${seed} 기준 인자 ${run.args.join(" ")} 로 재야 한다`,
      );
    const verdict = judge(
      { ...ratchet, seeds: { [seed]: ratchet.seeds[seed] } },
      { [seed]: countsByClass(report) },
      { today },
    );
    if (verdict.overA.length)
      throw new Error(
        `기존 A 초과 ${verdict.overA.map((v) => v.path).join(", ")} — 기준으로 쓸 수 없는 보고`,
      );
  }
  const matches = (key) =>
    keys.some((k) =>
      k.endsWith(".*") ? key.startsWith(k.slice(0, -1)) : key === k,
    );
  const byReport = reports.map(countsByClass);
  const next = structuredClone(ratchet);
  let added = 0;
  for (const cls of run.classes) {
    const grades = next.seeds[seed][cls];
    if (!grades) continue;
    const exact = keys.filter((k) => !k.endsWith(".*"));
    const seen = new Set([
      ...exact,
      ...byReport.flatMap((r) => Object.keys(r[cls] ?? {}).filter(matches)),
    ]);
    for (const key of [...seen].sort()) {
      if (key in (grades.A ?? {}) || key in (grades.B ?? {}))
        throw new Error(
          `이미 상한이 있는 키: seeds.${seed}.${cls}.${key} — 기존 상한은 바꾸지 않는다`,
        );
      const values = byReport.map((r) => r[cls]?.[key] ?? 0);
      if (!values.every((v) => v === values[0]))
        throw new Error(
          `값이 갈린 키 (등급 A 아님): seeds.${seed}.${cls}.${key} ${values.join(" / ")}`,
        );
      grades.A[key] = values[0];
      added += 1;
    }
  }
  if (!added) throw new Error("등록할 키가 없다");
  if (recorderChanged) {
    next.recorderChanges = [
      ...(next.recorderChanges ?? []),
      {
        from: ratchet.recorderSha256,
        to: recorderSha,
        on: today,
        reason: `--add-keys ${keys.join(",")}`,
      },
    ];
    next.recorderSha256 = recorderSha;
  }
  next.generatedAt = today;
  return next;
}

/**
 * ADR-264 — 새 run (시드 수 · fixture 조합) 을 더한다. 기존 run · 상한은 건드리지 않는다.
 * 같은 조건 보고 둘 이상으로 `--init` 과 같은 A/B 를 정한다 — 키는 `runKeyOf` (보고의 조건).
 */
export function applyAddRun(
  ratchet,
  key,
  reports,
  { recorderSha = null, today = isoToday() } = {},
) {
  if (ratchet.runs?.[key] || ratchet.seeds?.[key])
    throw new Error(
      `run ${key} 이 이미 있다 — --add-class · --add-keys 로 더한다`,
    );
  if (reports.length < 2)
    throw new Error(
      "같은 조건 보고가 둘 이상 있어야 한다 (등급 A = 반복 실행에서 같은 값)",
    );
  if (recorderSha !== null && ratchet.recorderSha256 !== recorderSha)
    throw new Error(
      "recorder 해시 불일치 — 하니스가 바뀌었다. 기준 재설정 필요 (--init)",
    );
  const args = JSON.stringify(harnessArgsFrom(reports[0].options));
  for (const report of reports) {
    if (runKeyOf(report.options) !== key)
      throw new Error(`run 불일치: 결과 ${runKeyOf(report.options)} ≠ ${key}`);
    if (JSON.stringify(harnessArgsFrom(report.options)) !== args)
      throw new Error(`조건 불일치: 보고들의 하니스 인자가 다르다`);
  }
  const next = structuredClone(ratchet);
  next.runs[key] = {
    classes: reports[0].options.classes,
    args: harnessArgsFrom(reports[0].options),
  };
  next.seeds[key] = buildSeedCeilings(reports.map(countsByClass));
  next.generatedAt = today;
  return next;
}

function parseSeedFiles(args) {
  // "60=a.json,b.json" → { "60": ["a.json","b.json"] }
  const out = {};
  for (const a of args) {
    const [seed, files] = a.split("=");
    if (!files)
      throw new Error(`형식: <seed>=<frame.json>[,<frame.json>…] — ${a}`);
    out[seed] = files.split(",");
  }
  return out;
}

const readReport = (f) => JSON.parse(readFileSync(f, "utf8"));

/** 하니스 기본 fixture — run 키 · 인자에 적지 않는다. */
const DEFAULT_FIXTURE = "mixed";

/**
 * 결과 JSON 의 options → ratchet run 키. 기본 fixture 는 시드 수 그대로 (`600`), 다른 fixture 는
 * `600:nested-flex` (ADR-264 — 중첩 문서에서만 보이는 비용을 같은 게이트로 잰다). DPR 1 이 아니면
 * `@dpr2` 를 붙인다 (ADR-273 — device px 여백 · surface 바이트는 DPR 2 에서만 갈린다).
 */
export function runKeyOf(options) {
  const fixture = options.fixtureKind ?? DEFAULT_FIXTURE;
  // ADR-272: `many-pages` 는 페이지 수 · grid 간격이 문서를 정한다 — 키에 싣는다 (간격 기본 80 은 생략).
  const sized =
    fixture === "many-pages"
      ? `${fixture}${options.pages}${options.gridGap == null ? "" : `@gap${options.gridGap}`}`
      : fixture;
  const base =
    fixture === DEFAULT_FIXTURE
      ? String(options.seedCount)
      : `${options.seedCount}:${sized}`;
  // ADR-271: 시작 배율을 고정한 run (`--zoom`) 은 다른 기준이다 — 기본 배율 run 과 합치지 않는다.
  const zoomed = options.zoom == null ? base : `${base}@zoom${options.zoom}`;
  return (options.dpr ?? 1) === 1 ? zoomed : `${zoomed}@dpr${options.dpr}`;
}

/** 결과 JSON 의 options → 같은 조건을 재현하는 하니스 인자 (게이트가 이대로 다시 잰다). */
export function harnessArgsFrom(options) {
  if (!options.fixedInputs)
    throw new Error("--fixed-inputs 로 잰 결과만 기준이 될 수 있다");
  const args = [
    "--lane",
    "frame",
    "--seed-count",
    String(options.seedCount),
    "--fixed-inputs",
  ];
  if ((options.fixtureKind ?? DEFAULT_FIXTURE) !== DEFAULT_FIXTURE)
    args.push("--fixture-kind", options.fixtureKind);
  if (options.fixtureKind === "many-pages") {
    args.push("--pages", String(options.pages));
    if (options.gridGap != null)
      args.push("--grid-gap", String(options.gridGap));
  }
  if (options.callCounts) args.push("--call-counts");
  if ((options.dpr ?? 1) !== 1) args.push("--dpr", String(options.dpr));
  if (options.zoom != null) args.push("--zoom", String(options.zoom));
  args.push("--classes", options.classes.join(","));
  return args;
}

async function cliMain(argv) {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (cmd === "--run") {
    const { runGate } = await import("./perf-ratchet-run.mjs");
    process.exit(await runGate(rest));
  }
  const { RECORDER_SCRIPT } = await import("./perf-baseline.mjs");
  const recorderSha = recorderSha256(RECORDER_SCRIPT);
  if (cmd === "--init") {
    const bySeed = parseSeedFiles(rest.filter((a) => a.includes("=")));
    const seeds = {};
    const runs = {};
    let head = null;
    for (const [seed, files] of Object.entries(bySeed)) {
      const reports = files.map(readReport);
      head = reports[0].head;
      runs[seed] = {
        classes: Object.keys(reports[0].results),
        args: harnessArgsFrom(reports[0].options),
      };
      seeds[seed] = buildSeedCeilings(reports.map(countsByClass));
    }
    const ratchet = {
      version: 1,
      recorderSha256: recorderSha,
      generatedAt: isoToday(),
      head,
      band: Number(process.env.RATCHET_BAND ?? 1.05),
      minSlack: 2,
      runs,
      seeds,
      raises: [],
    };
    writeFileSync(RATCHET_PATH, JSON.stringify(ratchet, null, 2) + "\n");
    process.stdout.write(`[ADR-246] ratchet 초기화 → ${RATCHET_PATH}\n`);
    return;
  }
  if (!existsSync(RATCHET_PATH))
    throw new Error(`ratchet 없음: ${RATCHET_PATH} (--init 먼저)`);
  const ratchet = JSON.parse(readFileSync(RATCHET_PATH, "utf8"));
  if (cmd === "--judge" || cmd === "--update") {
    const bySeed = parseSeedFiles(rest);
    const measured = {};
    let head = null;
    for (const [seed, files] of Object.entries(bySeed)) {
      const report = readReport(files[0]);
      head = report.head;
      measured[seed] = countsByClass(report);
    }
    const verdict = judge(ratchet, measured);
    if (ratchet.recorderSha256 !== recorderSha)
      process.stdout.write(
        "[ADR-246] recorder 해시 불일치 — 하니스가 바뀌었다. 기준 재설정 필요 (--init)\n",
      );
    if (cmd === "--update") {
      if (verdict.overA.length)
        throw new Error("A 초과가 있는 결과로 --update 할 수 없다");
      writeFileSync(
        RATCHET_PATH,
        JSON.stringify(applyUpdate(ratchet, verdict, { head }), null, 2) + "\n",
      );
      process.stdout.write(
        `[ADR-246] 하향 ${verdict.lowerable.length} · 새 지표 ${verdict.newKeys.length} 기록\n`,
      );
      return;
    }
    process.stdout.write(
      renderVerdict(verdict, { header: "[ADR-246] perf ratchet (판정만)" }) +
        "\n",
    );
    process.exit(verdict.overA.length ? 1 : 0);
  }
  if (cmd === "--add-class") {
    if (ratchet.recorderSha256 !== recorderSha)
      throw new Error(
        "recorder 해시 불일치 — 하니스가 바뀌었다. 기준 재설정 필요 (--init)",
      );
    let next = ratchet;
    for (const [seed, files] of Object.entries(parseSeedFiles(rest)))
      next = applyAddClasses(next, seed, files.map(readReport));
    writeFileSync(RATCHET_PATH, JSON.stringify(next, null, 2) + "\n");
    process.stdout.write(`[ADR-246] 부류 추가 기록 → ${RATCHET_PATH}\n`);
    return;
  }
  if (cmd === "--add-run") {
    let next = ratchet;
    for (const [key, files] of Object.entries(parseSeedFiles(rest)))
      next = applyAddRun(next, key, files.map(readReport), { recorderSha });
    writeFileSync(RATCHET_PATH, JSON.stringify(next, null, 2) + "\n");
    process.stdout.write(`[ADR-264] run 추가 기록 → ${RATCHET_PATH}\n`);
    return;
  }
  if (cmd === "--add-keys") {
    const at = rest.indexOf("--keys");
    if (at < 0)
      throw new Error(
        "--add-keys <seed>=<a.json>,<b.json> --keys <k1,k2|접두.*>",
      );
    const keys = rest[at + 1].split(",").filter(Boolean);
    const acceptRecorder = rest.includes("--accept-recorder");
    let next = ratchet;
    for (const [seed, files] of Object.entries(
      parseSeedFiles(
        rest.filter((a) => a.includes("=") && !a.startsWith("--")),
      ),
    ))
      next = applyAddKeys(next, seed, files.map(readReport), keys, {
        recorderSha,
        acceptRecorder,
      });
    writeFileSync(RATCHET_PATH, JSON.stringify(next, null, 2) + "\n");
    process.stdout.write(`[ADR-263] 새 카운트 A 등록 → ${RATCHET_PATH}\n`);
    return;
  }
  if (cmd === "--raise") {
    const get = (k) => rest[rest.indexOf(k) + 1];
    const next = applyRaise(ratchet, {
      path: rest[0],
      to: Number(get("--to")),
      approvedBy: get("--approved-by"),
      reason: get("--reason"),
      expires: get("--expires"),
    });
    writeFileSync(RATCHET_PATH, JSON.stringify(next, null, 2) + "\n");
    process.stdout.write(`[ADR-246] 올리기 기록 (만료 ${get("--expires")})\n`);
    return;
  }
  throw new Error(
    `명령: --run | --judge | --init | --update | --add-class | --add-keys | --add-run | --raise`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  cliMain(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`[ADR-246] ${e?.message ?? e}\n`);
    process.exit(2);
  });

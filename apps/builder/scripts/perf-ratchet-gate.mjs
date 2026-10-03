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
 *
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --run [--sha <push sha>]      # pre-push 가 부른다
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --judge <seed>=<frame.json> … # 이미 잰 결과로 판정만
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --init <seed>=<frame.json>,<frame.json>,… …
 *   node apps/builder/scripts/perf-ratchet-gate.mjs --update <seed>=<frame.json> …
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
  /^v8\.topApp/,
  /^v8\.total$/,
  /^v8\.deps$/,
  // The GPU profiler's rAF `tick` runs once per frame: its call count is the frames the run
  // lasted (995 ~ 1442 on one commit, 2026-10-03) — time, not work.
  /^v8\.fn\.src\/builder\/workspace\/canvas\/utils\/gpuProfilerCore\.ts#\(anonymous\)$/,
];

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
  for (const f of counts?.v8?.topApp ?? []) {
    const key = `v8.fn.${f.file}#${f.fn}`;
    if (EXCLUDED.some((re) => re.test(key))) continue;
    out[key] = Math.max(out[key] ?? 0, f.n);
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

/** 만료 전 승인된 올리기 반영 — 경로 `seeds.<seed>.<cls>.<A|B>.<key>` */
export function effectiveCeiling(ratchet, seed, cls, grade, key, today) {
  const base = ratchet.seeds?.[seed]?.[cls]?.[grade]?.[key];
  const path = `seeds.${seed}.${cls}.${grade}.${key}`;
  const raise = (ratchet.raises ?? [])
    .filter((r) => r.path === path && (!r.expires || today <= r.expires))
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

/** 하향만 반영한 새 ratchet. 새 지표는 해당 등급을 알 수 없으므로 B 로 추가한다. */
export function applyUpdate(
  ratchet,
  verdict,
  { head = null, today = isoToday() } = {},
) {
  const next = structuredClone(ratchet);
  for (const { path, value } of verdict.lowerable) {
    const [, seed, cls, grade, ...rest] = path.split(".");
    next.seeds[seed][cls][grade][rest.join(".")] = value;
  }
  for (const { path, value } of verdict.newKeys) {
    const [, seed, cls, , ...rest] = path.split(".");
    next.seeds[seed][cls].B[rest.join(".")] = value;
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
  const [, seed, cls, grade, ...rest] = path.split(".");
  const from = ratchet.seeds?.[seed]?.[cls]?.[grade]?.[rest.join(".")];
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
  if (options.callCounts) args.push("--call-counts");
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
  throw new Error(`명령: --run | --judge | --init | --update | --raise`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  cliMain(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`[ADR-246] ${e?.message ?? e}\n`);
    process.exit(2);
  });

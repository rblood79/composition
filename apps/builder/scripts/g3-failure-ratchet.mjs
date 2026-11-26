#!/usr/bin/env node
/**
 * G3 하니스 실패 ratchet — 남아 있는 실패 목록을 기준선으로 두고 새 실패만 막는다.
 *
 * G3 (`vitest.adr248-g3.browser.config.ts`) 는 실패가 남은 채로 돈다 (2026-11-27 105 건 — 하니스
 * 측정 · 낡은 fixture · 낡은 예외 목록). 실행마다 실패 전체가 다시 나와서 새 회귀 한 건이 그 사이에
 * 묻힌다. 그래서 기준선 (`tests/adr248-g3/failures.baseline.json`) 의 실패 id 와 이번 실행을 비교해
 * 기준선에 없는 실패만 막고, 새 실패는 실패 문구의 모양 (숫자를 지운 첫 줄) 으로 종류를 묶어 보인다.
 *
 * 자기검증: 새 실패가 나오면 그 파일만 1 회 다시 돌린다. 두 번 다 실패한 것만 새 실패다 — 한 번만
 * 실패한 것은 「흔들림」 으로 따로 보고한다 (병렬 부하의 시간 초과).
 *
 * 기준선은 줄어들기만 한다: `--update` 는 통과로 바뀐 id 를 지운다. 실행하지 않은 (skip) id 는
 * 지우지 않는다. 새 실패를 기준선에 넣는 것은 `--accept <id…> --reason <why>` 로만.
 *
 *   node apps/builder/scripts/g3-failure-ratchet.mjs --run                  # G3 실행 + 판정
 *   node apps/builder/scripts/g3-failure-ratchet.mjs --judge <report.json>  # 이미 낸 vitest json 으로 판정만
 *   node apps/builder/scripts/g3-failure-ratchet.mjs --update <report.json> # 통과로 바뀐 id 를 기준선에서 지움
 *   node apps/builder/scripts/g3-failure-ratchet.mjs --init <report.json>   # 기준선이 없을 때만
 *   node apps/builder/scripts/g3-failure-ratchet.mjs --accept <id>… --reason <why> --report <report.json>
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BUILDER_DIR = resolve(import.meta.dirname ?? ".", "..");

export const BASELINE_PATH =
  process.env.G3_RATCHET_BASELINE ??
  resolve(BUILDER_DIR, "tests/adr248-g3/failures.baseline.json");

const CONFIG = "vitest.adr248-g3.browser.config.ts";

/** 실패 id — 파일 (builder 기준 상대 경로) + describe · it 제목. */
export function idOf(file, assertion) {
  const rel = relative(BUILDER_DIR, file) || file;
  const titles = [...(assertion.ancestorTitles ?? []), assertion.title];
  return `${rel} › ${titles.join(" › ")}`;
}

/** vitest json 보고 → { failed: Map<id, 문구>, passed: Set<id>, skipped: Set<id> } */
export function outcomesOf(report) {
  const failed = new Map();
  const passed = new Set();
  const skipped = new Set();
  for (const file of report.testResults ?? []) {
    const assertions = file.assertionResults ?? [];
    // 파일 자체가 실패 (import 오류 · beforeAll 실패) 하면 assertion 이 비거나 전부 skip 이다.
    if (
      file.status === "failed" &&
      !assertions.some((a) => a.status === "failed")
    ) {
      failed.set(idOf(file.name, { title: "(file)" }), file.message ?? "");
    }
    for (const a of assertions) {
      const id = idOf(file.name, a);
      if (a.status === "failed")
        failed.set(id, (a.failureMessages ?? []).join("\n"));
      else if (a.status === "passed") passed.add(id);
      else skipped.add(id);
    }
  }
  return { failed, passed, skipped };
}

/**
 * 실패 문구의 종류 — 첫 의미 있는 줄에서 케이스 이름 (`ComboBox@M`) · 숫자 · 색 값 · 따옴표 안
 * 문자열을 지운 모양. 같은 원인은
 * 케이스마다 값만 달라 갈라지므로 값을 버린다 (parity 하니스 `fingerprintOf` 와 같은 생각).
 */
export function kindOf(message) {
  const line =
    message
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("at ")) ?? "";
  return line
    .replace(/\b[A-Z]\w*@\w+\b/g, "·@·")
    .replace(/#[0-9a-f]{3,8}\b/gi, "#·")
    .replace(/"[^"]*"/g, '"·"')
    .replace(/'[^']*'/g, "'·'")
    .replace(/-?\d+(\.\d+)?/g, "#")
    .slice(0, 160);
}

/** 판정 — 기준선과 이번 실행. */
export function judge(baseline, outcomes) {
  const known = new Set(baseline.failures.map((f) => f.id));
  const fresh = [...outcomes.failed.keys()]
    .filter((id) => !known.has(id))
    .sort();
  const resolved = [...known].filter((id) => outcomes.passed.has(id)).sort();
  const notRun = [...known]
    .filter((id) => !outcomes.passed.has(id) && !outcomes.failed.has(id))
    .sort();
  return { fresh, resolved, notRun };
}

/** 종류별 묶음 — 건수 내림차순. */
export function groupByKind(ids, messages) {
  const groups = new Map();
  for (const id of ids) {
    const kind = kindOf(messages.get(id) ?? "");
    const list = groups.get(kind);
    if (list) list.push(id);
    else groups.set(kind, [id]);
  }
  return [...groups]
    .map(([kind, list]) => ({ kind, ids: list }))
    .sort(
      (a, b) => b.ids.length - a.ids.length || a.kind.localeCompare(b.kind),
    );
}

/** 기준선에서 통과로 바뀐 id 만 지운다 — 늘리지 않는다. */
export function applyUpdate(baseline, outcomes) {
  const failures = baseline.failures.filter((f) => !outcomes.passed.has(f.id));
  return { ...baseline, failures };
}

/** 새 실패를 사유와 함께 기준선에 넣는다 — 이번 실행에서 실제로 실패한 id 만. */
export function applyAccept(baseline, outcomes, ids, reason, date) {
  if (!reason) throw new Error("--accept 에는 --reason 이 필요하다");
  const known = new Set(baseline.failures.map((f) => f.id));
  const added = [];
  for (const id of ids) {
    if (known.has(id)) continue;
    if (!outcomes.failed.has(id))
      throw new Error(`이번 실행에서 실패하지 않은 id: ${id}`);
    added.push({
      id,
      kind: kindOf(outcomes.failed.get(id)),
      accepted: { reason, date },
    });
  }
  const failures = [...baseline.failures, ...added].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return { ...baseline, failures };
}

export function baselineFrom(outcomes) {
  return {
    note: "G3 하니스에 남은 실패 — g3-failure-ratchet.mjs 가 관리한다. 줄이기는 --update, 넣기는 --accept --reason.",
    failures: [...outcomes.failed]
      .map(([id, message]) => ({ id, kind: kindOf(message) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeBaseline(baseline) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

/** G3 실행 → vitest json 경로. files 를 주면 그 파일만. */
function runG3(files = []) {
  const out = join(mkdtempSync(join(tmpdir(), "g3-ratchet-")), "report.json");
  spawnSync(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--config",
      CONFIG,
      "--reporter=json",
      `--outputFile=${out}`,
      ...files,
    ],
    { cwd: BUILDER_DIR, stdio: ["ignore", "ignore", "inherit"] },
  );
  if (!existsSync(out))
    throw new Error(
      "vitest 가 json 보고를 쓰지 않았다 (설정 · 브라우저 실행 실패)",
    );
  return out;
}

function fileOfId(id) {
  return id.split(" › ")[0];
}

function printReport(baseline, outcomes, result, flaky = []) {
  const total = outcomes.failed.size + outcomes.passed.size;
  console.log(
    `[g3-ratchet] 실행 ${total} · 실패 ${outcomes.failed.size} · 기준선 ${baseline.failures.length} · skip ${outcomes.skipped.size}`,
  );
  if (result.resolved.length) {
    console.log(
      `  통과로 바뀜 ${result.resolved.length} — --update 로 기준선에서 지운다`,
    );
    for (const id of result.resolved) console.log(`    ${id}`);
  }
  if (result.notRun.length) {
    console.log(
      `  기준선 중 이번에 돌지 않음 ${result.notRun.length} (skip · 파일 지정) — 판정 밖`,
    );
  }
  if (flaky.length) {
    console.log(`  흔들림 ${flaky.length} — 첫 실행만 실패, 다시 돌리면 통과`);
    for (const id of flaky) console.log(`    ${id}`);
  }
  if (result.fresh.length) {
    const groups = groupByKind(result.fresh, outcomes.failed);
    console.log(`  새 실패 ${result.fresh.length} · 종류 ${groups.length}`);
    for (const g of groups) {
      console.log(`  [${g.ids.length}] ${g.kind}`);
      for (const id of g.ids) console.log(`      ${id}`);
    }
  }
}

function main(argv) {
  const has = (flag) => argv.includes(flag);
  const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (has("--init")) {
    if (existsSync(BASELINE_PATH))
      throw new Error(
        `기준선이 이미 있다: ${BASELINE_PATH} — --update · --accept 를 쓴다`,
      );
    const outcomes = outcomesOf(readJson(valueOf("--init")));
    writeBaseline(baselineFrom(outcomes));
    console.log(
      `[g3-ratchet] 기준선 ${outcomes.failed.size} 건 기록 → ${BASELINE_PATH}`,
    );
    return 0;
  }

  if (!existsSync(BASELINE_PATH))
    throw new Error(`기준선 없음: ${BASELINE_PATH} — --init <report.json>`);
  const baseline = readJson(BASELINE_PATH);

  if (has("--update")) {
    const outcomes = outcomesOf(readJson(valueOf("--update")));
    const next = applyUpdate(baseline, outcomes);
    writeBaseline(next);
    console.log(
      `[g3-ratchet] 기준선 ${baseline.failures.length} → ${next.failures.length}`,
    );
    return 0;
  }

  if (has("--accept")) {
    const reportPath = valueOf("--report");
    if (!reportPath)
      throw new Error("--accept 에는 --report <report.json> 이 필요하다");
    const ids = [];
    for (
      let i = argv.indexOf("--accept") + 1;
      i < argv.length && !argv[i].startsWith("--");
      i++
    )
      ids.push(argv[i]);
    const next = applyAccept(
      baseline,
      outcomesOf(readJson(reportPath)),
      ids,
      valueOf("--reason"),
      new Date().toISOString().slice(0, 10),
    );
    writeBaseline(next);
    console.log(
      `[g3-ratchet] 기준선 ${baseline.failures.length} → ${next.failures.length}`,
    );
    return 0;
  }

  const reportPath = has("--judge")
    ? valueOf("--judge")
    : has("--run")
      ? runG3()
      : undefined;
  if (!reportPath) {
    console.error(
      "사용: --run | --judge <report.json> | --update <report.json> | --init <report.json> | --accept <id…> --reason <why> --report <report.json>",
    );
    return 2;
  }
  if (has("--run")) console.log(`[g3-ratchet] 보고: ${reportPath}`);
  const outcomes = outcomesOf(readJson(reportPath));
  let result = judge(baseline, outcomes);
  let flaky = [];

  // 자기검증 — 새 실패가 난 파일만 다시 돌려 두 번 다 실패한 것만 새 실패로 남긴다.
  if (has("--run") && result.fresh.length) {
    const files = [...new Set(result.fresh.map(fileOfId))].filter((f) =>
      f.endsWith(".ts"),
    );
    const again = outcomesOf(readJson(runG3(files)));
    flaky = result.fresh.filter((id) => !again.failed.has(id));
    result = {
      ...result,
      fresh: result.fresh.filter((id) => again.failed.has(id)),
    };
  }

  printReport(baseline, outcomes, result, flaky);
  if (result.fresh.length) {
    console.log(
      "[g3-ratchet] FAIL — 새 실패. 의도된 것이면 --accept <id> --reason <why> --report <report.json>",
    );
    return 1;
  }
  console.log("[g3-ratchet] PASS — 새 실패 0");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`[g3-ratchet] ${error.message}`);
    process.exit(2);
  }
}

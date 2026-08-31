#!/usr/bin/env node
/**
 * ADR-198 Phase 5 — D3 시각 파리티 게이트 러너 (test-only)
 *
 * `vitest run` 을 그대로 부르지 않고 이 러너를 두는 이유는 4가지다. 전부 ADR 의
 * 조항이지 취향이 아니다.
 *
 * 1. **doctor 가 먼저 돈다** (HC11 / G5). doctor fixture 가 기대 픽셀을 못 내면
 *    나머지 매트릭스는 의미가 없다 — vitest 는 파일 순서를 보장하지 않으므로
 *    호출을 둘로 나눠 순서를 강제한다. doctor 실패는 `PARITY-ENV` 로 끝나고
 *    **아무것도 건너뛰지 않는다**.
 * 2. **skip 은 통과가 아니다** (G5). 셋업이 깨져 0건이 돌거나 파일이 include
 *    glob 에서 조용히 빠지면 vitest 는 초록으로 끝난다. 그래서 측정된 테스트
 *    수를 바닥값으로 못박는다 — 줄면 실패다.
 * 3. **시간 예산을 실제로 잰다** (HC10). smoke ≤90s / full ≤5min 은 문서의
 *    숫자가 아니라 매 실행의 판정 조건이다.
 * 4. **실패는 닫힌 집합의 코드로 보고한다** (HC9). 실패 출력에서 `PARITY-*` 를
 *    뽑아 요약에 싣고, 없으면 셋업 실패로 보아 `PARITY-ENV` 를 쓴다.
 *
 * 사용: `node scripts/visual-parity-gate.mjs [smoke|full]`
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUILDER_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CONFIG = "vitest.visual-parity.config.ts";
const ARTIFACT_DIR = "tests/visual-parity/.artifacts";

/** HC9 닫힌 집합 — `tests/visual-parity/harness/types.ts::PARITY_CODES` 와 같아야 한다 */
const PARITY_CODES = [
  "PARITY-ENV",
  "PARITY-LIVE",
  "PARITY-L0-IDENTITY",
  "PARITY-L1-GEOMETRY",
  "PARITY-L2-STYLE",
  "PARITY-L3-PIXEL",
  "PARITY-L4-TEXT",
  "PARITY-RESOURCE",
];

/** 두 호출 모두에서 맨 먼저 도는 환경 판정 (HC11) */
const DOCTOR = ["tests/visual-parity/skia/doctor.browser.test.ts"];

/**
 * smoke = push 를 막는 집합. 파일럿 3종에 대한 게이트 계약 전부.
 *
 * 빠진 것은 비용이 아니라 **성격**으로 갈랐다: `rasterDelta` 는 R13 전제를
 * 한 번 재는 측정이고, `preview/{previewLeg,shapeProbe,simplifiedDomProbe}` 는
 * 하니스 자체를 검사하는 probe 다. 둘 다 코드가 바뀔 때마다 다시 물어야 할
 * 질문이 아니라서 full 로 보낸다.
 */
const SMOKE = [
  "tests/visual-parity/identity.browser.test.ts",
  "tests/visual-parity/productionPath.browser.test.ts",
  "tests/visual-parity/skia/productionLeg.browser.test.ts",
  "tests/visual-parity/skia/g2.browser.test.ts",
  "tests/visual-parity/preview/productionLeg.browser.test.ts",
  "tests/visual-parity/compare/crossLeg.browser.test.ts",
  "tests/visual-parity/compare/negativeProbes.browser.test.ts",
  "tests/visual-parity/compare/ledgerRatchet.browser.test.ts",
];

/**
 * 바닥 테스트 수 — 2026-08-31 실측값. **이보다 적으면 실패**다.
 *
 * 상한이 아니라 하한인 이유: Phase 6 이 fixture 를 늘리면 수는 커진다. 반대로
 * 파일 하나가 include glob 에서 빠지거나 셋업이 깨져 조용히 줄어드는 경우가
 * 게이트를 vacuous 하게 만드는 실제 경로다.
 */
const FLOORS = { doctor: 3, smoke: 81, full: 98 };

/** HC10 — 초 단위 벽시계 예산 */
const BUDGET_SECONDS = { smoke: 90, full: 300 };

const mode = process.argv[2] ?? "smoke";
if (mode !== "smoke" && mode !== "full") {
  console.error(`ADR-198 gate: 알 수 없는 mode "${mode}" (smoke|full)`);
  process.exit(2);
}

function runVitest(label, files, jsonPath) {
  const args = [
    "vitest",
    "run",
    "--config",
    CONFIG,
    ...files,
    "--reporter=default",
    "--reporter=json",
    `--outputFile=${jsonPath}`,
  ];
  const started = Date.now();
  const res = spawnSync("pnpm", ["exec", ...args], {
    cwd: BUILDER_ROOT,
    stdio: "inherit",
    encoding: "utf8",
  });
  const seconds = (Date.now() - started) / 1000;

  let report = null;
  if (existsSync(jsonPath)) {
    try {
      report = JSON.parse(readFileSync(jsonPath, "utf8"));
    } catch {
      report = null;
    }
  }
  return { label, exitCode: res.status ?? 1, seconds, report };
}

/** 실패 메시지에서 닫힌 집합의 코드를 뽑는다. 없으면 셋업 실패로 본다 (HC9) */
function extractCode(report) {
  if (!report) return "PARITY-ENV";
  const messages = [];
  for (const file of report.testResults ?? []) {
    if (file.message) messages.push(file.message);
    for (const t of file.assertionResults ?? []) {
      if (t.status === "failed") messages.push(...(t.failureMessages ?? []));
    }
  }
  const blob = messages.join("\n");
  for (const code of PARITY_CODES) {
    if (blob.includes(code)) return code;
  }
  return "PARITY-ENV";
}

/** skip 을 통과로 세지 않는다 (G5) */
function checkRun(run, floor) {
  const problems = [];
  const r = run.report;

  if (!r) {
    problems.push(
      `${run.label}: vitest JSON 리포트가 없다 — 러너가 뜨지 못했다 (셋업 실패는 skip 이 아니라 실패다)`,
    );
    return problems;
  }
  if (run.exitCode !== 0 || r.success === false) {
    problems.push(`${run.label}: 테스트 실패 (exit=${run.exitCode})`);
  }
  const total = r.numTotalTests ?? 0;
  if (total < floor) {
    problems.push(
      `${run.label}: 테스트 ${total}건 — 바닥값 ${floor} 미만. ` +
        `파일이 include 에서 빠졌거나 셋업이 깨졌다 (조용한 vacuous 게이트 차단)`,
    );
  }
  const pending = r.numPendingTests ?? 0;
  if (pending > 0) {
    problems.push(`${run.label}: skip 된 테스트 ${pending}건 — 게이트는 skip 을 허용하지 않는다`);
  }
  return problems;
}

function listArtifacts() {
  const dir = join(BUILDER_ROOT, ARTIFACT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !f.startsWith("."));
}

/**
 * 경로 스코프는 두 곳에 **문자 그대로** 복제돼 있다 — `.githooks/pre-push`(bash)
 * 와 `.github/workflows/deploy.yml`(YAML). bash 도 YAML 도 공용 상수를 import 할
 * 수 없어서 복제가 불가피한데, 복제는 조용히 갈린다: 한쪽만 넓히면 그 경로는
 * 로컬에서만(또는 CI 에서만) 검사되고 반대쪽은 무음으로 통과한다.
 *
 * 그래서 게이트가 돌 때마다 두 문자열을 직접 비교한다. 갈리면 게이트 자체를
 * 실패시킨다 — 스코프가 어긋난 상태의 초록은 무엇도 보증하지 않는다.
 */
function checkScopeSync() {
  const repoRoot = resolve(BUILDER_ROOT, "../..");
  const pick = (relPath) => {
    const src = readFileSync(join(repoRoot, relPath), "utf8");
    const m = src.match(/'(\^\(packages\/shared[^']*)'/);
    return m ? m[1] : null;
  };

  const hook = pick(".githooks/pre-push");
  const workflow = pick(".github/workflows/deploy.yml");

  if (!hook || !workflow) {
    return [
      `경로 스코프 정규식을 찾지 못했다 (hook=${hook ? "ok" : "없음"}, ` +
        `workflow=${workflow ? "ok" : "없음"}) — 한쪽이 사라지면 그쪽 차단 지점이 통째로 없어진다`,
    ];
  }
  if (hook !== workflow) {
    return [
      "pre-push hook 과 deploy.yml 의 D3 경로 스코프가 갈렸다 — " +
        "한쪽만 넓히면 그 경로는 반대쪽에서 무음으로 통과한다\n" +
        `      hook:     ${hook}\n      workflow: ${workflow}`,
    ];
  }

  const missing = [...DOCTOR, ...SMOKE].filter(
    (f) => !existsSync(join(BUILDER_ROOT, f)),
  );
  if (missing.length > 0) {
    return [`smoke 목록의 파일이 없다: ${missing.join(", ")} — 이름이 바뀌었거나 지워졌다`];
  }
  return [];
}

const tmp = mkdtempSync(join(tmpdir(), "adr198-gate-"));
const runs = [];

const scopeProblems = checkScopeSync();
if (scopeProblems.length > 0) {
  console.error(`\n[ADR-198] FAIL  code=PARITY-ENV  layer=env`);
  for (const p of scopeProblems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`\n[ADR-198] visual parity gate — mode=${mode}`);
console.log(`[ADR-198] 1/2 doctor fixture (HC11 — 환경 판정이 매트릭스보다 먼저)`);
const doctorRun = runVitest("doctor", DOCTOR, join(tmp, "doctor.json"));
runs.push(doctorRun);

let problems = checkRun(doctorRun, FLOORS.doctor);
if (problems.length > 0) {
  console.error(`\n[ADR-198] FAIL  code=PARITY-ENV  layer=env`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `\n  doctor 가 기대 픽셀을 내지 못했다. 매트릭스는 돌리지 않는다 — ` +
      `건너뛴 것이 아니라 환경이 게이트를 통과하지 못한 것이다.`,
  );
  process.exit(1);
}
console.log(`[ADR-198] doctor PASS (${doctorRun.seconds.toFixed(1)}s)`);

const matrix = mode === "smoke" ? SMOKE : [];
console.log(
  `[ADR-198] 2/2 ${mode} matrix (${mode === "smoke" ? `${SMOKE.length} files` : "전체"})`,
);
const matrixRun = runVitest(mode, matrix, join(tmp, "matrix.json"));
runs.push(matrixRun);

// full 은 include glob 전체를 돌리므로 doctor 를 다시 포함한다 — 바닥값도 그만큼 높다.
problems = checkRun(matrixRun, mode === "smoke" ? FLOORS.smoke : FLOORS.full);

const totalSeconds = runs.reduce((a, r) => a + r.seconds, 0);
const budget = BUDGET_SECONDS[mode];
if (totalSeconds > budget) {
  problems.push(
    `벽시계 ${totalSeconds.toFixed(1)}s 가 HC10 예산 ${budget}s 를 넘었다 — ` +
      `예산을 늘리지 말고 매트릭스를 줄인다`,
  );
}

const testCount =
  (doctorRun.report?.numTotalTests ?? 0) + (matrixRun.report?.numTotalTests ?? 0);

console.log(`\n[ADR-198] mode=${mode}  tests=${testCount}  wall=${totalSeconds.toFixed(1)}s / ${budget}s`);

if (problems.length > 0) {
  const code = extractCode(matrixRun.report);
  console.error(`[ADR-198] FAIL  code=${code}`);
  for (const p of problems) console.error(`  - ${p}`);
  const artifacts = listArtifacts();
  if (artifacts.length > 0) {
    console.error(`\n  증거: ${ARTIFACT_DIR}/ (${artifacts.length} files)`);
    for (const f of artifacts.slice(0, 12)) console.error(`    ${f}`);
  }
  process.exit(1);
}

console.log(`[ADR-198] PASS`);

/**
 * ADR-246 — ratchet 게이트 실행부 (서버 확보 · revision 확인 · 하니스 실행 · 판정).
 * 판정 로직은 `perf-ratchet-gate.mjs` (순수 함수). 이 파일은 프로세스 · 네트워크 · git 을 다룬다.
 *
 * 측정 코드 = push 대상 revision (HC4):
 *   빠른 경로 — push 되는 sha 가 HEAD 이고 런타임 tracked 파일에 변경이 없으면 메인 워킹트리를 잰다.
 *     서버는 5173 이 이 워킹트리를 서빙할 때 (`/__composition_dev_root`) 재사용, 아니면 5179 에 띄운다.
 *   worktree 경로 — 아니면 (다른 세션의 WIP 가 있거나 HEAD ≠ sha) push 대상 sha 를 전용 worktree
 *     (<repo>/.cache/perf-ratchet/wt) 에 checkout 하고 그 root 를 5179 로 서빙해 잰다.
 *   어느 쪽도 못 하면 차단 (exit 1). 건너뛰는 길은 SKIP_PERF_RATCHET=1 뿐 (hook 이 처리).
 */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RATCHET_PATH,
  countsByClass,
  decide,
  judge,
  recorderSha256,
  renderVerdict,
} from "./perf-ratchet-gate.mjs";

// 스크립트 위치 기준 — 호출한 셸의 cwd 가 다른 worktree 여도 이 checkout 을 가리킨다.
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: import.meta.dirname,
  encoding: "utf8",
}).trim();
const BUILDER_DIR = join(REPO_ROOT, "apps/builder");
const AUTH_SESSION = join(BUILDER_DIR, "scripts/.auth-session.json");

/** 측정값을 바꿀 수 있는 tracked 경로 — 성능 스코프보다 넓게 (vite.config 등 포함). */
export const RUNTIME_PATHS = [
  "apps",
  "packages",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "patches",
  "turbo.json",
];

const ENGINE_WASM = join(
  BUILDER_DIR,
  "src/builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
);

const git = (...args) =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();

/** revision 일치 — 문제 목록 (빈 배열이면 통과). */
export function revisionProblems(sha, { dirtyLines = null, head = null } = {}) {
  const problems = [];
  const headSha = head ?? git("rev-parse", "HEAD");
  if (sha && sha !== headSha)
    problems.push(
      `push 대상 ${sha.slice(0, 9)} 가 HEAD ${headSha.slice(0, 9)} 가 아니다 — 측정 코드가 push 대상과 다르다`,
    );
  const lines =
    dirtyLines ??
    git("status", "--porcelain", "--", ...RUNTIME_PATHS)
      .split("\n")
      .filter(Boolean);
  const tracked = lines.filter((l) => !l.startsWith("??"));
  if (tracked.length)
    problems.push(
      `런타임 경로에 미커밋 변경 ${tracked.length} — 측정값이 push 대상과 다르다 (stash · 커밋 뒤 push):\n${tracked
        .slice(0, 8)
        .map((l) => `      ${l}`)
        .join("\n")}`,
    );
  return problems;
}

/** engine 소스가 wasm 산출물보다 새로우면 stale 바이너리를 잰다 — 차단 사유 (m6). */
export function engineWasmProblem() {
  let wasmMtime;
  try {
    wasmMtime = statSync(ENGINE_WASM).mtimeMs;
  } catch {
    return "engine wasm 산출물 없음 — pnpm wasm:build:engine";
  }
  const newest = (dir) => {
    let max = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) max = Math.max(max, newest(p));
      else max = Math.max(max, statSync(p).mtimeMs);
    }
    return max;
  };
  const src = Math.max(
    newest(join(REPO_ROOT, "packages/engine/src")),
    statSync(join(REPO_ROOT, "packages/engine/Cargo.toml")).mtimeMs,
  );
  return src > wasmMtime
    ? "engine 소스가 wasm 산출물보다 새롭다 — pnpm wasm:build:engine 뒤 push"
    : null;
}

async function devRootAt(url) {
  try {
    const res = await fetch(`${url}/__composition_dev_root`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return (await res.json()).root ?? null;
  } catch {
    return null;
  }
}

/**
 * 서버 확보. 5173 이 이 워킹트리면 재사용, 아니면 자체 포트에 띄운다.
 * 반환 { url, owned, stop() } · 실패 시 throw.
 */
export async function acquireServer({
  port = 5179,
  readyMs = 60_000,
  root = REPO_ROOT,
} = {}) {
  const shared = "http://localhost:5173";
  if (root === REPO_ROOT && (await devRootAt(shared)) === REPO_ROOT)
    return { url: shared, owned: false, stop: () => {}, root };
  const url = `http://localhost:${port}`;
  const occupant = await devRootAt(url);
  if (occupant)
    throw new Error(
      `${url} 를 다른 서버가 쓰고 있다 (root ${occupant}) — 자체 서버를 띄울 수 없다`,
    );
  const child = spawn(
    "pnpm",
    ["exec", "vite", "--port", String(port), "--strictPort"],
    {
      cwd: join(root, "apps/builder"),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  };
  const t0 = Date.now();
  while (Date.now() - t0 < readyMs) {
    if (child.exitCode != null) {
      throw new Error(
        `자체 서버 기동 실패 (exit ${child.exitCode}) — ${log.trim().split("\n").slice(-3).join(" | ")}`,
      );
    }
    const served = await devRootAt(url);
    if (served === root)
      return { url, owned: true, stop, bootMs: Date.now() - t0, root };
    if (served) {
      stop();
      throw new Error(`${url} 가 다른 root 를 서빙한다: ${served}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error(`자체 서버가 ${readyMs / 1000}초 안에 준비되지 않았다`);
}

/** 저장된 인증 세션의 origin 을 대상 서버로 바꾼 임시 파일 경로. */
export function storageStateFor(url) {
  const state = JSON.parse(readFileSync(AUTH_SESSION, "utf8"));
  const origin = new URL(url).origin;
  state.origins = (state.origins ?? []).map((o) => ({ ...o, origin }));
  const dir = mkdtempSync(join(tmpdir(), "perf-ratchet-auth-"));
  const file = join(dir, "state.json");
  writeFileSync(file, JSON.stringify(state));
  return file;
}

/**
 * push 대상 sha 를 전용 worktree 에 checkout 한다 — 메인 워킹트리에 다른 세션의 미커밋 변경이
 * 있어도 push 대상 코드를 잰다 (HC4 "흐름을 끊지 않는다" · round 2 h2 "측정 코드 = push 대상").
 * 위치: <repo>/.cache/perf-ratchet/wt (gitignored · git status 에 안 보임). 재사용한다.
 * gitignored 산출물: node_modules 는 `pnpm install --offline --frozen-lockfile` (postinstall 이
 * canvaskit · specs · upload 를 만든다) · engine wasm 은 메인에서 복사 (engine 소스가 sha 와
 * 같고 wasm 이 신선할 때만) · 라이선스 토큰 복사.
 */
export function prepareWorktree(sha, { log = () => {} } = {}) {
  // `.git` 안은 Vite 기본 server.fs.deny (`**/.git/**`) 에 걸려 서빙이 거부된다 (Phase 1 실측) —
  // 이미 gitignored 인 `.cache/` 아래에 둔다. node_modules 아래는 Vite 가 의존성으로 취급해 안 된다.
  const wt = join(REPO_ROOT, ".cache", "perf-ratchet", "wt");
  const t0 = Date.now();
  const problems = [];
  const engineDiff = spawnSyncStatus(
    "git",
    ["diff", "--quiet", sha, "--", "packages/engine"],
    REPO_ROOT,
  );
  if (engineDiff !== 0)
    problems.push(
      "메인 워킹트리의 packages/engine 이 push 대상과 다르다 — engine wasm 을 push 대상 기준으로 만들 수 없다 (메인을 push 대상과 맞추고 pnpm wasm:build:engine)",
    );
  const wasm = engineWasmProblem();
  if (wasm) problems.push(wasm);
  if (problems.length) return { problems };
  if (!existsSync(join(wt, ".git"))) {
    mkdirSync(join(REPO_ROOT, ".cache", "perf-ratchet"), { recursive: true });
    execFileSync("git", ["worktree", "add", "--detach", "--force", wt, sha], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
    log("worktree 생성");
  } else {
    execFileSync("git", ["checkout", "--detach", "--force", sha], {
      cwd: wt,
      stdio: "ignore",
    });
  }
  const install = spawnSyncStatus(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile"],
    wt,
  );
  if (install !== 0) {
    const retry = spawnSyncStatus("pnpm", ["install", "--frozen-lockfile"], wt);
    if (retry !== 0)
      return { problems: [`worktree pnpm install 실패 (exit ${retry})`] };
  }
  const pkgRel =
    "apps/builder/src/builder/workspace/canvas/wasm-bindings/engine-pkg";
  cpSync(join(REPO_ROOT, pkgRel), join(wt, pkgRel), { recursive: true });
  const license = join(REPO_ROOT, "apps/builder/public/license");
  if (existsSync(license))
    cpSync(license, join(wt, "apps/builder/public/license"), {
      recursive: true,
    });
  log(`worktree 준비 ${Math.round((Date.now() - t0) / 1000)}초`);
  return { problems: [], root: wt, prepMs: Date.now() - t0 };
}

function spawnSyncStatus(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "ignore" });
  return r.status ?? 1;
}

function runHarness({ url, storageState, args, outDir, root = REPO_ROOT }) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(root, "apps/builder/scripts/perf-baseline.mjs"),
        ...args,
        "--storage-state",
        storageState,
        "--out",
        outDir,
      ],
      {
        cwd: root,
        env: { ...process.env, BUILDER_URL: url },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (code) => {
      if (code !== 0)
        return reject(
          new Error(
            `하니스 실패 (exit ${code}): ${log.trim().split("\n").slice(-4).join(" | ")}`,
          ),
        );
      const file = readdirSync(outDir).find((f) => f.startsWith("frame-"));
      if (!file) return reject(new Error("하니스 결과 JSON 없음"));
      resolveRun(JSON.parse(readFileSync(join(outDir, file), "utf8")));
    });
  });
}

/** ratchet.runs 의 시드별 조건으로 한 바퀴 잰다 → { <seed>: { <cls>: flat counts } } */
export async function measureOnce({
  ratchet,
  url,
  storageState,
  root = REPO_ROOT,
}) {
  const measured = {};
  for (const [seed, run] of Object.entries(ratchet.runs)) {
    const outDir = mkdtempSync(join(tmpdir(), `perf-ratchet-${seed}-`));
    const report = await runHarness({
      url,
      storageState,
      args: run.args,
      outDir,
      root,
    });
    measured[seed] = countsByClass(report);
  }
  return measured;
}

function parseArgs(argv) {
  const opts = { sha: null, port: 5179, engineChanged: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--sha") opts.sha = argv[++i];
    else if (argv[i] === "--port") opts.port = Number(argv[++i]);
    else if (argv[i] === "--engine-changed") opts.engineChanged = true;
  }
  return opts;
}

/** pre-push 진입점. exit code: 0 통과 (경고 포함) · 1 차단. */
export async function runGate(argv) {
  const opts = parseArgs(argv);
  const t0 = Date.now();
  const say = (s) => process.stdout.write(`${s}\n`);
  const ratchet = JSON.parse(readFileSync(RATCHET_PATH, "utf8"));
  const { RECORDER_SCRIPT } = await import("./perf-baseline.mjs");
  if (ratchet.recorderSha256 !== recorderSha256(RECORDER_SCRIPT))
    say(
      "[ADR-246] recorder 해시 불일치 — 하니스가 바뀌었다. 판정은 계속하되 기준 재설정이 필요하다 (--init)",
    );
  const sha = opts.sha || git("rev-parse", "HEAD");
  // 빠른 경로: 메인 워킹트리가 push 대상과 같으면 (HEAD = sha · 런타임 tracked 변경 0) 메인을 잰다.
  // 아니면 push 대상 sha 전용 worktree 에서 잰다 — 다른 세션의 WIP 가 push 를 막지 않는다.
  let root = REPO_ROOT;
  let mode = "메인 워킹트리";
  const mainProblems = revisionProblems(sha);
  if (opts.engineChanged && !mainProblems.length) {
    const wasm = engineWasmProblem();
    if (wasm) mainProblems.push(wasm);
  }
  if (mainProblems.length) {
    say(
      `[ADR-246] 메인 워킹트리를 그대로 잴 수 없다 — push 대상 ${sha.slice(0, 9)} 을 전용 worktree 에서 잰다:`,
    );
    for (const p of mainProblems) say(`  · ${p.split("\n")[0]}`);
    const wt = prepareWorktree(sha, { log: (m) => say(`  ${m}`) });
    if (wt.problems.length) {
      say(
        "[ADR-246] push 를 막았다 — push 대상 코드를 잴 환경을 만들지 못했다:",
      );
      for (const p of wt.problems) say(`  - ${p}`);
      say("  급하면 SKIP_PERF_RATCHET=1 git push … (건너뛴 사실이 출력된다)");
      return 1;
    }
    root = wt.root;
    mode = `worktree ${sha.slice(0, 9)}`;
  }
  let server;
  try {
    server = await acquireServer({ port: opts.port, root });
  } catch (e) {
    say(`[ADR-246] push 를 막았다 — 측정 서버를 확보하지 못했다: ${e.message}`);
    say("  급하면 SKIP_PERF_RATCHET=1 git push …");
    return 1;
  }
  try {
    say(
      `[ADR-246] perf ratchet — ${mode} · 서버 ${server.url} (${server.owned ? `자체 기동 ${Math.round((server.bootMs ?? 0) / 1000)}초` : "5173 재사용"}) · 시드 ${Object.keys(ratchet.runs).join(", ")}`,
    );
    const storageState = storageStateFor(server.url);
    const first = judge(
      ratchet,
      await measureOnce({ ratchet, url: server.url, storageState, root }),
    );
    let decision = decide(first);
    let second = null;
    if (decision === "rerun") {
      say(
        renderVerdict(first, {
          header: "  첫 실행 — 등급 A 초과, 같은 조건으로 1회 재실행 (HC2)",
        }),
      );
      second = judge(
        ratchet,
        await measureOnce({ ratchet, url: server.url, storageState, root }),
      );
      decision = decide(first, second);
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    say(
      renderVerdict(second ?? first, {
        header: `  결과 (${secs}초)`,
        decision,
      }),
    );
    if (decision === "block") {
      say("[ADR-246] push 를 막았다 — 등급 A 카운트가 두 번 다 상한을 넘었다.");
      say(
        "  의도한 증가면 사유와 함께 사용자 승인으로 --raise (만료일 필수). 급하면 SKIP_PERF_RATCHET=1.",
      );
      return 1;
    }
    if (decision === "unmeasurable")
      say(
        "[ADR-246] 측정 불가 — 같은 코드 · 다른 값 (하니스 결함 신호). 통과시키고 기록한다.",
      );
    return 0;
  } catch (e) {
    say(`[ADR-246] push 를 막았다 — 측정 실패: ${e.message}`);
    return 1;
  } finally {
    server.stop();
  }
}

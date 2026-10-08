import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-workflow-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of ["scripts/codex", "scripts/agent", ".codex/hooks"])
    fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  for (const name of ["package.json", ".prettierignore"])
    if (fs.existsSync(path.join(root, name)))
      fs.copyFileSync(path.join(root, name), path.join(dir, name));
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(dir, "node_modules"),
  );
  fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/\n.agent/\n");
  fs.writeFileSync(path.join(dir, "sample.ts"), "export const sample = 1;\n");
  const env = {
    ...process.env,
    AGENT_RUNS_DIR: path.join(dir, ".agent/runs"),
    TMPDIR: dir,
  };
  const run = (args, extra = {}) =>
    spawnSync(args[0], args.slice(1), {
      cwd: dir,
      env,
      encoding: "utf8",
      ...extra,
    });
  for (const args of [
    ["git", "init", "-q"],
    ["git", "add", "."],
    [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ],
  ])
    assert.equal(run(args).status, 0);
  return { dir, run, env };
}
function plan(t, file) {
  const f = fixture(t);
  const r = f.run([
    "bash",
    "scripts/agent/work.sh",
    "verify",
    "--dry-run",
    "--files",
    file,
  ]);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test("shared UI 변경은 시각·브라우저 검증을 선택한다", (t) => {
  const out = plan(t, "packages/shared/src/components/Popover.tsx");
  assert.match(out, /cross-check\s+plan/);
  assert.match(out, /live-exercise\s+plan/);
});
test("shared 원본 변경은 등록 검증을 선택한다", (t) => {
  assert.match(
    plan(
      t,
      "packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts",
    ),
    /registration\s+plan/,
  );
});
test("ADR248 G3 테스트는 전용 browser config에서만 실행한다", (t) => {
  const out = plan(
    t,
    "apps/builder/tests/adr248-g3/paletteBaseCanvas.browser.test.ts",
  );
  assert.match(out, /--config vitest\.adr248-g3\.browser\.config\.ts/);
  assert.doesNotMatch(out, /vitest run tests\/adr248-g3/);
});
test("스킬과 tooling 변경에만 스킬 검증·회귀를 선택한다", (t) => {
  assert.match(
    plan(t, ".claude/skills/evaluate/SKILL.md"),
    /skills-validate\s+plan/,
  );
  const tooling = plan(t, "scripts/codex/validate-skills.mjs");
  assert.match(tooling, /skills-validate\s+plan/);
  assert.match(tooling, /skills-test\s+plan/);
  assert.doesNotMatch(
    plan(t, "docs/design/notes.md"),
    /skills-(validate|test)\s+plan/,
  );
});

function start(f) {
  const r = f.run([
    "bash",
    "scripts/agent/run-ledger.sh",
    "start",
    "--understood-as",
    "test",
  ]);
  assert.equal(r.status, 0, r.stderr);
}
function evidence(f, status, extra = []) {
  const r = f.run([
    "bash",
    "scripts/agent/run-ledger.sh",
    "evidence",
    "live-exercise",
    status,
    ...extra,
  ]);
  assert.equal(r.status, 0, r.stderr);
}
test("최신 FAIL이 과거 PASS를 무효화한다", (t) => {
  const f = fixture(t);
  start(f);
  evidence(f, "pass");
  assert.equal(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
  evidence(f, "fail");
  assert.notEqual(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
});
test("검증 뒤 파일 내용이 바뀌면 PASS를 재사용하지 않는다", (t) => {
  const f = fixture(t);
  start(f);
  evidence(f, "pass");
  fs.writeFileSync(path.join(f.dir, "sample.ts"), "export const sample = 2;\n");
  assert.notEqual(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
  evidence(f, "pass");
  assert.equal(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
});
test("snapshot 없는 옛 PASS는 성공 근거가 아니다", (t) => {
  const f = fixture(t);
  start(f);
  const id = fs.readFileSync(
    path.join(f.env.AGENT_RUNS_DIR, "current"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(f.env.AGENT_RUNS_DIR, id, "evidence.jsonl"),
    '{"kind":"live-exercise","status":"pass"}\n',
  );
  assert.notEqual(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
});
test("명시 범위 밖 편집은 증거를 유지하고 HEAD 변경은 무효화한다", (t) => {
  const f = fixture(t);
  start(f);
  evidence(f, "pass", ["--files", "sample.ts"]);
  fs.writeFileSync(path.join(f.dir, "notes.md"), "unrelated\n");
  assert.equal(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
  assert.equal(f.run(["git", "add", "notes.md"]).status, 0);
  assert.equal(
    f.run([
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "next",
    ]).status,
    0,
  );
  assert.notEqual(
    f.run(["bash", "scripts/agent/run-ledger.sh", "has-live"]).status,
    0,
  );
});
test("work verify와 close도 최신 FAIL·변경된 소스의 PASS를 거부한다", (t) => {
  const f = fixture(t);
  start(f);
  const file = "packages/shared/src/components/Popover.tsx";
  fs.mkdirSync(path.dirname(path.join(f.dir, file)), { recursive: true });
  fs.writeFileSync(path.join(f.dir, file), "export {};\n");
  for (const kind of ["cross-check", "live-exercise"]) {
    const r = f.run([
      "bash",
      "scripts/agent/run-ledger.sh",
      "evidence",
      kind,
      "pass",
      "--files",
      file,
    ]);
    assert.equal(r.status, 0, r.stderr);
  }
  const verify = () =>
    f.run([
      "bash",
      "scripts/agent/work.sh",
      "verify",
      "--skip-exec",
      "--files",
      file,
    ]);
  assert.equal(verify().status, 0);
  evidence(f, "fail", ["--files", file]);
  const failed = verify();
  assert.equal(failed.status, 3, failed.stdout + failed.stderr);
  evidence(f, "pass", ["--files", file]);
  fs.writeFileSync(path.join(f.dir, file), "export const changed = 1;\n");
  assert.equal(
    f.run(["bash", "scripts/agent/work.sh", "close", "done"]).status,
    3,
  );
});

test("CLI와 hook은 원본 표기를 보존하고 공백 경로 일반 파일만 포맷한다", (t) => {
  const f = fixture(t);
  const lib =
    "packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts";
  const normal = "sample file.ts";
  fs.mkdirSync(path.dirname(path.join(f.dir, lib)), { recursive: true });
  const original = 'export const node = { "id": "node" };\n';
  for (const hook of [false, true]) {
    fs.writeFileSync(path.join(f.dir, lib), original);
    fs.writeFileSync(path.join(f.dir, normal), "export const x={a:1}\n");
    const r = hook
      ? f.run(["bash", ".codex/hooks/auto-format.sh"], {
          input: JSON.stringify({
            cwd: f.dir,
            tool_input: {
              command: `*** Update File: ${lib}\n*** Update File: ${normal}`,
            },
          }),
        })
      : f.run(["bash", "scripts/codex/format-changed.sh", "--", lib, normal]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(f.dir, lib), "utf8"), original);
    assert.equal(
      fs.readFileSync(path.join(f.dir, normal), "utf8"),
      "export const x = { a: 1 };\n",
    );
  }
});
test("포맷 검사는 실패해도 소스를 수정하지 않는다", (t) => {
  const f = fixture(t),
    file = path.join(f.dir, "sample.ts"),
    input = "export const x={a:1}\n";
  fs.writeFileSync(file, input);
  const r = f.run([
    "bash",
    "scripts/codex/format-changed.sh",
    "--check",
    "sample.ts",
  ]);
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), input);
});
function fakePnpm(f) {
  const bin = path.join(f.dir, "bin");
  fs.mkdirSync(bin);
  const log = path.join(f.dir, "commands.log");
  fs.writeFileSync(
    path.join(bin, "pnpm"),
    '#!/bin/bash\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$*" in\n  "run codex:format:check") bash scripts/codex/format-changed.sh --check ;;\n  "run codex:format") bash scripts/codex/format-changed.sh ;;\n  "run codex:skills:validate") exit "${VALIDATE_EXIT:-0}" ;;\n  *) exit 0 ;;\nesac\n',
    { mode: 0o755 },
  );
  f.env.PATH = `${bin}:${f.env.PATH}`;
  f.env.COMMAND_LOG = log;
  return () => fs.readFileSync(log, "utf8");
}
test("preflight 진입점은 포맷 불일치에서 실패하고 소스를 보존한다", (t) => {
  const f = fixture(t),
    commands = fakePnpm(f);
  const file = path.join(f.dir, "sample.ts"),
    input = "export const x={a:1}\n";
  fs.writeFileSync(file, input);
  const script = JSON.parse(fs.readFileSync(path.join(f.dir, "package.json")))
    .scripts["codex:preflight"];
  assert.notEqual(f.run(["bash", "-c", script]).status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), input);
  assert.match(commands(), /run codex:format:check/);
});
test("preflight 진입점이 관련 스킬 gate까지 실행한다", (t) => {
  const f = fixture(t),
    commands = fakePnpm(f);
  const script = JSON.parse(fs.readFileSync(path.join(f.dir, "package.json")))
    .scripts["codex:preflight"];
  assert.equal(f.run(["bash", "-c", script]).status, 0);
  assert.match(commands(), /run codex:skills:gate/);
});
test("스킬 gate는 선택된 검사만 실행하고 validator 실패를 전파한다", (t) => {
  const f = fixture(t),
    commands = fakePnpm(f);
  const run = (file) =>
    f.run(["bash", "scripts/codex/skills-gate.sh", "--", file]);
  assert.equal(run("docs/design/notes.md").status, 0);
  assert.equal(fs.existsSync(path.join(f.dir, "commands.log")), false);
  assert.equal(run(".claude/skills/evaluate/SKILL.md").status, 0);
  assert.equal(commands(), "run codex:skills:validate\n");
  fs.writeFileSync(path.join(f.dir, "commands.log"), "");
  assert.equal(run("scripts/codex/validate-skills.mjs").status, 0);
  assert.match(commands(), /codex:skills:test/);
  assert.match(commands(), /codex:workflow:test/);
  f.env.VALIDATE_EXIT = "9";
  assert.equal(run(".claude/skills/evaluate/SKILL.md").status, 9);
});
test("기본 스킬 gate는 삭제된 검증기 경로도 검사한다", (t) => {
  const f = fixture(t),
    commands = fakePnpm(f);
  fs.unlinkSync(path.join(f.dir, "scripts/codex/validate-skills.mjs"));
  const r = f.run(["bash", "scripts/codex/skills-gate.sh"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(commands(), /codex:skills:validate/);
  assert.match(commands(), /codex:skills:test/);
});
test("snapshot은 현행 권한과 관련 경로만 짧게 안내한다", (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.dir, "packages/shared/src/catalog/runtime"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(f.dir, "packages/shared/src/catalog/runtime/domBinding.tsx"),
    "export {};\n",
  );
  const r = f.run(["bash", "scripts/codex/context-snapshot.sh"]);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /legacy \.claude|Default git flow/);
  assert.match(r.stdout, /명시.*요청/);
  assert.match(r.stdout, /domain-rac-composition\.md/);
  assert.ok(r.stdout.split("\n").length < 60);
});

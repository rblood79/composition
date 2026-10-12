import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(
  readFileSync(new URL("../hooks.json", import.meta.url), "utf8"),
);

test("자동 포맷은 일반 파일만 처리하고 심링크와 자동 다운로드는 건너뛴다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "codex-format-test-"));
  try {
    mkdirSync(join(fixture, "node_modules/.bin"), { recursive: true });
    writeFileSync(
      join(fixture, "node_modules/.bin/prettier"),
      '#!/bin/sh\nprintf "formatted\\n"\n',
      { mode: 0o755 },
    );
    writeFileSync(join(fixture, "source.md"), "source\n");
    symlinkSync("source.md", join(fixture, "mirror.md"));
    for (const [file, output] of [
      ["source.md", "formatted\n"],
      ["mirror.md", ""],
    ]) {
      const result = spawnSync(
        "bash",
        [join(root, ".codex/hooks/auto-format.sh")],
        {
          cwd: fixture,
          encoding: "utf8",
          input: JSON.stringify({
            cwd: fixture,
            tool_input: { file_path: join(fixture, file) },
          }),
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, output);
    }
    rmSync(join(fixture, "node_modules/.bin/prettier"));
    const missing = spawnSync(
      "bash",
      [
        "-c",
        'npx() { echo unexpected-download; }; export -f npx; bash "$1"',
        "hook-test",
        join(root, ".codex/hooks/auto-format.sh"),
      ],
      {
        cwd: fixture,
        encoding: "utf8",
        input: JSON.stringify({
          cwd: fixture,
          tool_input: { file_path: join(fixture, "source.md") },
        }),
      },
    );
    assert.equal(missing.status, 0, missing.stderr);
    assert.equal(missing.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("자동 hook은 작업과 무관한 프롬프트 주입·전체 검사를 실행하지 않는다", () => {
  const commands = Object.values(config.hooks).flatMap((groups) =>
    groups.flatMap((group) => group.hooks.map((hook) => hook.command)),
  );
  assert.equal(commands.length, 2);
  assert.ok(commands.some((command) => command.includes("protect-files.sh")));
  assert.ok(commands.some((command) => command.includes("auto-format.sh")));
});

test("hook audit은 미등록 hook과 끊어진 공용 adapter 연결을 거부한다", () => {
  const fixture = mkdtempSync(join(tmpdir(), "codex-hook-audit-test-"));
  const hooksDir = join(fixture, ".codex/hooks");
  try {
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(fixture, ".codex/hooks.json"), JSON.stringify(config));
    for (const name of [
      "protect-files.sh",
      "auto-format.sh",
      "codex-hook-utils.sh",
    ]) {
      writeFileSync(
        join(hooksDir, name),
        readFileSync(join(root, ".codex/hooks", name)),
        { mode: 0o755 },
      );
    }
    const audit = () =>
      spawnSync(
        process.execPath,
        [join(root, "scripts/codex/hook-config-audit.mjs"), fixture],
        { encoding: "utf8" },
      );
    assert.doesNotMatch(audit().stdout, /ERROR/);
    writeFileSync(join(hooksDir, "legacy.sh"), "#!/bin/bash\nexit 0\n");
    assert.match(audit().stdout, /ERROR.*미등록 Codex hook: legacy\.sh/);
    rmSync(join(hooksDir, "legacy.sh"));
    rmSync(join(hooksDir, "codex-hook-utils.sh"));
    assert.match(
      audit().stdout,
      /ERROR.*공용 hook 파일 없음 codex-hook-utils\.sh/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

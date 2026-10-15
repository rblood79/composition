#!/usr/bin/env node
// perf-build-dist.mjs — perf-baseline `--serve-dist` 용 production harness 빌드.
//
//   pnpm perf:build-dist [-- --out <dir>]   (기본 /private/tmp/perf-baseline-dist)
//
// VITE_COMPOSITION_HARNESS=1 이 Playwright 핸들 (`__COMPOSITION_CATALOG__` · canvas camera) 을
// 남기고, --sourcemap 이 프로필 frame 이름 복원을 받친다 (런타임 코드는 같다). 빌드한 commit 과
// dirty 파일을 `perf-build.json` 에 남긴다 — 측정 결과의 head 는 이 값이다.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const at = argv.indexOf("--out");
const out = resolve(at >= 0 ? argv[at + 1] : "/private/tmp/perf-baseline-dist");
// trimEnd — porcelain 첫 줄의 앞 공백 (작업 트리만 수정) 은 상태 열이라 남긴다.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trimEnd();
const head = git("rev-parse", "HEAD");
const dirtyFiles = git("status", "--porcelain").split("\n").filter(Boolean);

execFileSync(
  "pnpm",
  ["-F", "@composition/builder", "exec", "vite", "build", "--sourcemap", "--outDir", out, "--emptyOutDir"],
  { stdio: "inherit", env: { ...process.env, VITE_COMPOSITION_HARNESS: "1" } },
);
writeFileSync(
  join(out, "perf-build.json"),
  JSON.stringify({ head, dirtyFiles, builtAt: new Date().toISOString() }, null, 2),
);
process.stdout.write(
  `\n[perf-build-dist] ${out} · head ${head.slice(0, 9)}${dirtyFiles.length ? ` · dirty ${dirtyFiles.length} (측정 결과에 기록된다)` : ""}\n`,
);

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseArgs } from "./perf-baseline.mjs";
import {
  createFrameResolver,
  decodeMappings,
  originalPosition,
  readDistBuild,
  resolveProfiles,
  serveHarnessDist,
} from "./perfDist.mjs";

// 축소 번들 한 줄 (`function a(){}function bB(){return 1}`) 과 손으로 쓴 sourcemap:
//   "AAEAA" = [0,0,2,0,0]  → genCol 0  · one.ts 3:0  · alpha
//   "eCOEC" = [15,1,7,2,1] → genCol 15 · two.ts 10:2 · betaFn (원본 필드는 앞 segment 에 누적)
const MAP = {
  version: 3,
  sources: ["../../src/one.ts", "../../src/builder/two.ts"],
  names: ["alpha", "betaFn"],
  mappings: "AAEAA,eCOEC",
};

test("decodeMappings 는 필드를 누적 해제한다 (genCol 은 줄마다 0 부터)", () => {
  const lines = decodeMappings(`${MAP.mappings};AAAA`);
  assert.deepEqual(lines[0], [
    [0, 0, 2, 0, 0],
    [15, 1, 9, 2, 1],
  ]);
  // 둘째 줄 "AAAA" 는 genCol 0 · 원본 필드는 앞 줄 값에서 이어진다.
  assert.deepEqual(lines[1], [[0, 1, 9, 2, -1]]);
});

test("originalPosition 은 열 이하의 마지막 segment 를 고른다", () => {
  const decoded = decodeMappings(MAP.mappings);
  assert.deepEqual(originalPosition(MAP, decoded, 1, 20), {
    source: "../../src/builder/two.ts",
    line: 10,
    name: "betaFn",
  });
  assert.equal(originalPosition(MAP, decoded, 1, 14).name, "alpha");
  assert.equal(originalPosition(MAP, decoded, 2, 0), null);
});

test("frame resolver 는 축소 이름의 정의 열로 원본 함수를 찾고, 못 찾으면 그대로 둔다", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "perf-dist-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "main-x.js"), "function a(){}function bB(){return 1}\n");
  writeFileSync(join(dir, "assets", "main-x.js.map"), JSON.stringify(MAP));
  const resolveFrame = createFrameResolver(dir);
  assert.equal(
    resolveFrame("bB http://localhost:4190/composition/assets/main-x.js:1"),
    "betaFn src/builder/two.ts:10",
  );
  // 정의가 없는 이름 · map 없는 파일 · wasm 은 그대로
  for (const label of [
    "zz http://localhost:4190/composition/assets/main-x.js:1",
    "q http://localhost:4190/composition/assets/other.js:1",
    "wasm-function[9] http://localhost:4190/composition/assets/engine_bg.wasm:1",
  ])
    assert.equal(resolveFrame(label), label);

  const results = {
    edit: {
      profile: {
        top: [
          { frame: "bB http://localhost:4190/composition/assets/main-x.js:1", pct: 11.5 },
          { frame: "(anonymous) http://localhost:4190/composition/assets/main-x.js:1", pct: 1 },
        ],
        app: [],
      },
    },
    idle: { profile: null },
  };
  resolveProfiles(results, resolveFrame);
  assert.deepEqual(results.edit.profile.appResolved, [
    { frame: "betaFn src/builder/two.ts:10", pct: 11.5 },
  ]);
  assert.equal(results.edit.profile.top[0].frame.startsWith("bB "), true);
});

test("--serve-dist 는 dist 경로·포트를 받고, 서버는 dev 와 같은 헤더로 SPA 경로를 index 로 돌린다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "perf-dist-serve-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>x</title>");
  writeFileSync(join(dir, "version.json"), JSON.stringify({ buildId: "b1" }));
  writeFileSync(join(dir, "perf-build.json"), JSON.stringify({ head: "abc", dirtyFiles: [] }));
  const options = parseArgs(["--lane", "frame", "--serve-dist", dir, "--dist-port", "4391"]);
  assert.equal(options.serveDist, dir);
  assert.equal(options.distPort, 4391);
  assert.deepEqual(readDistBuild(dir), { buildId: "b1", head: "abc", dirtyFiles: [] });

  const server = await serveHarnessDist(dir, 4391);
  t.after(() => server.close());
  const res = await fetch(`${server.url}/builder/some-project`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("document-policy"), "js-profiling");
  assert.equal(res.headers.get("cross-origin-embedder-policy"), null);
  assert.match(await res.text(), /<title>x<\/title>/);
});

test("--serve-dist 는 빌드 안 된 경로를 거부한다", async () => {
  await assert.rejects(serveHarnessDist(tmpdir() + "/perf-dist-none", 4392), /perf:build-dist/);
});

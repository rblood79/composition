// perfDist.mjs — perf-baseline 의 production 측정 레인 (`--serve-dist <dir>`).
//
// dev 빌드는 React DEV 부담 (logComponentRender · runWithFiberInDEV …) 이 busy 의 15~20% 라
// 절대값이 부푼다. 이 모듈은 harness 빌드 (`pnpm perf:build-dist` — VITE_COMPOSITION_HARNESS=1
// + sourcemap) 를 정적 서버로 띄우고, 축소된 프로필 frame 이름을 sourcemap 으로 되돌린다.
//
// 서버 헤더는 dev 서버 (vite.config.ts server.headers) 와 맞춘다: Document-Policy js-profiling
// (--profile 의 Profiler 생성 조건), COOP/COEP 없음 (dev 와 다른 격리 상태로 재지 않는다).
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

/** `/composition/` base 의 dist 정적 서버 (SPA fallback = index.html). */
export async function serveHarnessDist(distDir, port) {
  if (!existsSync(join(distDir, "index.html")))
    throw new Error(`--serve-dist: ${distDir}/index.html 없음 — pnpm perf:build-dist 먼저`);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(
      new URL(req.url, "http://x").pathname,
    ).replace(/^\/composition\/?/, "");
    let file = join(distDir, path);
    if (!path || !existsSync(file) || statSync(file).isDirectory())
      file = join(distDir, "index.html");
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "document-policy": "js-profiling",
    });
    res.end(readFileSync(file));
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, () =>
      done({
        url: `http://localhost:${port}/composition`,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    );
  });
}

/** `perf-build.json` (perf-build-dist.mjs 가 남김) — 빌드한 commit · dirty 파일. */
export function readDistBuild(distDir) {
  const read = (name) => {
    const path = join(distDir, name);
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  };
  return { ...read("version.json"), ...read("perf-build.json") };
}

// ── sourcemap (v3) — base64 VLQ 디코더. source-map-js 는 builder 에서 해석되지 않는다 (pnpm 비호이스트).
const B64 = new Map(
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].map(
    (c, i) => [c, i],
  ),
);
function decodeSegment(text) {
  const out = [];
  let value = 0;
  let shift = 0;
  for (const c of text) {
    const digit = B64.get(c);
    value += (digit & 31) << shift;
    if (digit & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

/** 생성 줄마다 [genCol, src, line, col, name?] (모두 0-base, 누적 해제) 배열. */
export function decodeMappings(mappings) {
  const lines = [];
  let src = 0;
  let line = 0;
  let col = 0;
  let name = 0;
  for (const text of mappings.split(";")) {
    const segs = [];
    let genCol = 0;
    for (const raw of text.split(",")) {
      if (!raw) continue;
      const f = decodeSegment(raw);
      genCol += f[0];
      if (f.length < 4) continue;
      src += f[1];
      line += f[2];
      col += f[3];
      if (f.length > 4) name += f[4];
      segs.push([genCol, src, line, col, f.length > 4 ? name : -1]);
    }
    lines.push(segs);
  }
  return lines;
}

/** 생성 위치 (line 1-base, column 0-base) → 원본 { source, line (1-base), name }. */
export function originalPosition(map, decoded, line, column) {
  const segs = decoded[line - 1] ?? [];
  let hit = null;
  for (const s of segs) {
    if (s[0] > column) break;
    hit = s;
  }
  if (!hit) return null;
  return {
    source: map.sources[hit[1]] ?? null,
    line: hit[2] + 1,
    name: hit[4] >= 0 ? map.names[hit[4]] : null,
  };
}

/**
 * 프로필 frame label (`name http://…/assets/file.js:line` — recorder 는 열을 남기지 않는다) 을
 * 원본 `name src/…:line` 으로. 열은 그 줄에서 축소 이름의 정의 위치를 찾아 정한다 —
 * 못 찾으면 label 을 그대로 둔다 (추측해서 다른 함수로 바꾸지 않는다).
 */
export function createFrameResolver(distDir) {
  const files = new Map();
  const load = (file) => {
    if (!files.has(file)) {
      const js = join(distDir, "assets", file);
      const mapPath = `${js}.map`;
      if (!existsSync(js) || !existsSync(mapPath)) files.set(file, null);
      else {
        const map = JSON.parse(readFileSync(mapPath, "utf8"));
        files.set(file, {
          map,
          decoded: decodeMappings(map.mappings),
          src: readFileSync(js, "utf8").split("\n"),
        });
      }
    }
    return files.get(file);
  };
  return (label) => {
    const m = /^(\S+) .*\/assets\/([^/:]+\.js):(\d+)$/.exec(label);
    if (!m) return label;
    const [, name, file, lineText] = m;
    const entry = load(file);
    if (!entry) return label;
    const line = Number(lineText);
    const text = entry.src[line - 1] ?? "";
    const id = name.replace(/[$]/g, "\\$");
    const def = new RegExp(
      `(?:function\\*?\\s+${id}\\s*\\(|(?:^|[,;{(\\s])${id}\\s*=\\s*(?:async\\s*)?(?:function|\\(|[A-Za-z_$][\\w$]*\\s*=>)|(?:^|[,;{}\\s])${id}\\s*\\([^)]*\\)\\s*\\{)`,
    ).exec(text);
    if (!def) return label;
    const pos = originalPosition(
      entry.map,
      entry.decoded,
      line,
      def.index + def[0].indexOf(name),
    );
    if (!pos?.source) return label;
    const source = pos.source
      .replace(/^.*[/]src[/]/, "src/")
      .replace(/^.*[/]node_modules[/](?:[.]pnpm[/][^/]+[/]node_modules[/])?/, "nm/");
    return `${pos.name ?? name} ${source}:${pos.line}`;
  };
}

/** results.<부류>.profile.top 을 원본 이름으로 — topResolved · appResolved 를 덧붙인다. */
export function resolveProfiles(results, resolveFrame) {
  for (const r of Object.values(results)) {
    if (!r?.profile) continue;
    r.profile.topResolved = r.profile.top.map((t) => ({
      ...t,
      frame: resolveFrame(t.frame),
    }));
    r.profile.appResolved = r.profile.topResolved.filter((t) =>
      t.frame.includes(" src/"),
    );
  }
  return results;
}

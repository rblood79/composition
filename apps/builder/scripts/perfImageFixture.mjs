// ADR-270 Phase 0 — 이미지 fixture (`app-pages-images` · `app-pages-images-asset`).
//
// Image 노드에는 `src` 가 없다 (DOM 은 `<img alt="">`, Canvas 는 placeholder 상자) — 사용자가 사진을 넣는
// 길은 Fill 패널의 Image (`fills` 의 `kind: "image"` 층, 업로드는 ADR-235 `asset:` ref) 다. 그래서 fixture 는
// `app-pages` 의 Image 상자마다 image fill 을 준다. PNG 는 여기서 만든다 (결정적 — 크기 · 무늬 · 반투명이
// 번호로 정해진다). 완료 시각은 하니스가 정한다: 정적 URL 변형은 `page.route` 가 응답을 붙들고 in-page
// 드라이버가 `__perfReleaseImage` 로 한 장씩 푼다 (등급 A — 완료가 어느 프레임에 오는지를 하니스가 고른다).
// `asset:` 변형은 blob URL 이라 붙들 수 없다 — 드라이버가 Image 상자의 fill 을 한 장씩 새 ref 로 바꾼다
// (업로드 · 놓기와 같은 길).
import { deflateSync } from "node:zlib";

/** 이미지 수 — `app-pages` 의 22 페이지에 하나씩 도는 서로 다른 그림. */
export const PERF_IMAGE_COUNT = 22;

/** 번호 → 크기 · 반투명. 2,048² 두 장 · 1,024² · 512² · 256² 가 섞이고 다섯에 하나가 반투명. */
export function perfImageSpec(k) {
  const size = k === 0 || k === 11 ? 2048 : [256, 512, 1024][k % 3];
  return { size, translucent: k % 5 === 4 };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * RGBA PNG. 무늬 = 번호로 정한 색의 대각 그라데이션 + 64 px 격자 (축소 · object-fit 차가 픽셀에 보이게).
 * `gen` 은 왼쪽 위 픽셀 하나에 들어간다 — 같은 그림의 다른 세대가 다른 바이트 (`asset:` ref 는 해시).
 */
export function makePerfPng(k, gen = 0) {
  const { size, translucent } = perfImageSpec(k);
  const hue = (k * 47) % 360;
  const rgb = (h) => {
    const f = (n) => {
      const a = (n + h / 30) % 12;
      return Math.round(
        255 * (0.55 - 0.35 * Math.max(-1, Math.min(a - 3, 9 - a, 1))),
      );
    };
    return [f(0), f(8), f(4)];
  };
  const [r0, g0, b0] = rgb(hue);
  const [r1, g1, b1] = rgb((hue + 120) % 360);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (2 * size);
      const grid = x % 64 === 0 || y % 64 === 0;
      const o = y * stride + 1 + x * 4;
      raw[o] = grid ? 255 : Math.round(r0 + (r1 - r0) * t);
      raw[o + 1] = grid ? 255 : Math.round(g0 + (g1 - g0) * t);
      raw[o + 2] = grid ? 255 : Math.round(b0 + (b1 - b0) * t);
      raw[o + 3] = translucent ? Math.round(64 + 160 * t) : 255;
    }
  }
  raw[1] = gen & 0xff;
  raw[2] = (gen >> 8) & 0xff;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 정적 URL 변형의 주소 — 세대마다 다른 URL (캐시 miss). */
export const perfImageUrl = (k, gen) => `/__perf-images/g${gen}/${k}.png`;

/**
 * `/__perf-images/**` 요청을 붙든다. `release()` = 먼저 온 요청 하나를 PNG 로 풀기 (FIFO — 요청 순서는
 * bind 순서라 결정적). in-page 드라이버는 `__perfReleaseImage()` · `__perfHeldImages()` 로 부른다.
 */
export async function installPerfImageRoutes(page) {
  const held = [];
  const bytes = new Map();
  const pngOf = (path) => {
    const m = /\/__perf-images\/g(\d+)\/(\d+)\.png$/.exec(path);
    if (!m) return null;
    const key = `${m[1]}/${m[2]}`;
    if (!bytes.has(key))
      bytes.set(key, makePerfPng(Number(m[2]), Number(m[1])));
    return bytes.get(key);
  };
  await page.route("**/__perf-images/**", (route) => {
    held.push(route);
  });
  const release = async () => {
    const route = held.shift();
    if (!route) return null;
    const url = new URL(route.request().url()).pathname;
    const body = pngOf(url);
    if (!body) await route.fulfill({ status: 404, body: "" });
    else
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        headers: { "cache-control": "no-store" },
        body,
      });
    return url;
  };
  await page.exposeFunction("__perfReleaseImage", release);
  await page.exposeFunction("__perfHeldImages", () => held.length);
  return {
    release,
    held: () => held.length,
    async releaseAll() {
      while (held.length) await release();
    },
  };
}

/**
 * 문서의 Image 노드에 image fill 을 준다 (한 transaction · history skip 아님 — 시드의 다른 삽입과 같은
 * 기록 경로). `urls[i % urls.length]`. 반환: 노드 id 순서 (문서 순서).
 */
export function assignPerfImageFills(page, urls) {
  return page.evaluate((urls) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const graph = ws.runtime.graph;
    const ids = [];
    const visit = (id) => {
      const entry = graph.getEntry(id);
      if (entry?.kind !== "node") return;
      // Library definitions (`lib:` — palette primitives) live outside the graph's entries.
      const def = entry.definitionId.startsWith("lib:")
        ? graph.library.definitions.get(entry.definitionId)
        : graph.getEntry(entry.definitionId);
      if (def?.name === "Image") ids.push(id);
      for (const child of entry.children ?? []) visit(child);
    };
    for (const pageId of graph.getEntry(graph.projectId).pageIds)
      for (const body of graph.getEntry(pageId).children) visit(body);
    if (!ids.length) throw new Error("app-pages-images: Image 노드 없음");
    const fill = (url, i) => [
      {
        id: `perf-image-fill-${i}`,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        kind: "image",
        url,
        mode: "fill",
      },
    ];
    ws.execute(() =>
      h.commands.composeCommands(
        graph,
        "Image fills",
        ids.map((id, i) =>
          h.commands.setWholeField({
            targets: [{ kind: "node", id }],
            field: "fills",
            value: fill(urls[i % urls.length], i),
          }),
        ),
      ),
    );
    ws.session.clearSelection();
    return ids;
  }, urls);
}

/** `asset:` 변형 — 세대 `gen` 의 PNG 22 장을 Fill 패널의 업로드 writer 로 저장하고 ref 를 돌려준다. */
export async function storePerfImageAssets(page, gen) {
  const files = Array.from({ length: PERF_IMAGE_COUNT }, (_, k) =>
    makePerfPng(k, gen).toString("base64"),
  );
  return page.evaluate(async (files) => {
    const writer = window.__COMPOSITION_CATALOG__.assets;
    if (!writer?.storeUploadedFile)
      throw new Error(
        "__COMPOSITION_CATALOG__.assets 없음 (dev · harness 빌드)",
      );
    const refs = [];
    for (const [k, b64] of files.entries()) {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const stored = await writer.storeUploadedFile(
        new File([bin], `perf-${k}.png`, { type: "image/png" }),
      );
      refs.push(stored.ref);
    }
    return refs;
  }, files);
}

import { describe, expect, it } from "vitest";

import { refFromHash, sha256Hex } from "../assetBytes";
import {
  buildV2Generation,
  encodeManifest,
  isZipBytes,
  manifestPath,
  mapV2Source,
  openV2Zip,
  packV2Zip,
  readV2Generation,
  V2AssetMissingError,
  V2FormatError,
  type ProjectContentV2,
  type V2AssetBytes,
} from "../formatV2";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9]);
const WOFF = new Uint8Array([119, 79, 70, 50, 1, 2]);

async function fixture() {
  const png = await sha256Hex(PNG);
  const woff = await sha256Hex(WOFF);
  const store = new Map<string, V2AssetBytes>([
    [png, { bytes: PNG, mime: "image/png", ext: "png", name: "a.png" }],
    [woff, { bytes: WOFF, mime: "font/woff2", ext: "woff2" }],
  ]);
  const content: ProjectContentV2 = {
    project: { id: "p1", name: "Demo" },
    document: {
      version: "composition-1.0",
      children: [
        { id: "page-a", type: "frame", children: [] },
        {
          id: "page-b",
          type: "frame",
          children: [
            { id: "img", type: "Image", props: { src: refFromHash(png) } },
          ],
        },
      ],
    },
    collections: [{ id: "c1", mockData: [{ avatar: refFromHash(png) }] }],
    apiEndpoints: [{ id: "api1", url: "https://x" }],
    variables: [{ id: "v1", defaultValue: 1 }],
    fontRegistry: {
      version: 2,
      faces: [
        {
          id: "f1",
          family: "Inter",
          source: { type: "project-asset", url: refFromHash(woff) },
        },
      ],
    },
    currentPageId: "page-b",
    metadata: { author: "me" },
  };
  return { content, store, png, woff };
}

describe("형식 v2 (ADR-235 Phase 4)", () => {
  it("세대 = 불변 part · 자산 파일 + manifest (현재 페이지 · metadata 포함)", async () => {
    const { content, store, png, woff } = await fixture();
    const generation = await buildV2Generation(
      content,
      async (hash) => store.get(hash) ?? null,
    );
    const paths = [...generation.files.keys()].sort();
    expect(paths).toContain(`assets/${png}.png`);
    expect(paths).toContain(`assets/${woff}.woff2`);
    expect(paths.filter((p) => p.startsWith("parts/"))).toHaveLength(5);
    expect(generation.manifest).toMatchObject({
      formatVersion: "2.0.0",
      project: { id: "p1", name: "Demo" },
      editor: { currentPageId: "page-b" },
      metadata: { author: "me" },
    });
    // part 이름 = 내용 해시 (같은 내용이면 같은 파일)
    const again = await buildV2Generation(
      content,
      async (hash) => store.get(hash) ?? null,
    );
    expect([...again.files.keys()].sort()).toEqual(paths);
  });

  it("자산 바이트가 없으면 만들지 않는다 (HC7)", async () => {
    const { content } = await fixture();
    await expect(
      buildV2Generation(content, async () => null),
    ).rejects.toBeInstanceOf(V2AssetMissingError);
  });

  it("zip 왕복 — 문서 · 자산 · collections 3종 · 폰트 · currentPageId · metadata 동일 (G5)", async () => {
    const { content, store } = await fixture();
    const generation = await buildV2Generation(
      content,
      async (hash) => store.get(hash) ?? null,
    );
    const blob = await packV2Zip(generation);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(isZipBytes(bytes)).toBe(true);
    const read = await readV2Generation(await openV2Zip(bytes));
    expect(read.recovered).toBe(false);
    expect(read.content).toEqual(content);
    expect([...read.assets.keys()].sort()).toEqual([...store.keys()].sort());
    for (const [hash, asset] of read.assets) {
      expect([...asset.bytes]).toEqual([...store.get(hash)!.bytes]);
    }
  });

  it("manifest.json 손상 · part 누락이면 manifests/ 의 직전 유효 세대로 복구한다", async () => {
    const { content, store } = await fixture();
    const g1 = await buildV2Generation(
      content,
      async (h) => store.get(h) ?? null,
      {
        revision: 1,
        previousRevision: null,
      },
    );
    // 2세대 = 문서가 바뀌어 document part 가 다르다
    const changed = {
      ...content,
      document: { ...(content.document as object), note: "gen2" },
      currentPageId: "page-a",
    };
    const g2 = await buildV2Generation(
      changed,
      async (h) => store.get(h) ?? null,
      {
        revision: 2,
        previousRevision: 1,
      },
    );
    const files = new Map<string, Uint8Array>([...g1.files, ...g2.files]);
    files.set(manifestPath(1), encodeManifest(g1.manifest));
    files.set(manifestPath(2), encodeManifest(g2.manifest));
    // 정상: manifest.json = 2세대
    files.set("manifest.json", encodeManifest(g2.manifest));
    expect(
      (await readV2Generation(mapV2Source(files))).content.currentPageId,
    ).toBe("page-a");
    // manifest.json 손상 → manifests/ 최신 (2)
    files.set("manifest.json", new TextEncoder().encode("{broken"));
    const recovered = await readV2Generation(mapV2Source(files));
    expect(recovered).toMatchObject({
      recovered: true,
      manifest: { revision: 2 },
    });
    // 2세대 part 하나 누락 → 1세대
    const onlyG2 = [...g2.files.keys()].find(
      (p) => p.startsWith("parts/") && !g1.files.has(p),
    )!;
    files.delete(onlyG2);
    const fallback = await readV2Generation(mapV2Source(files));
    expect(fallback).toMatchObject({
      recovered: true,
      manifest: { revision: 1 },
    });
    expect(fallback.content.currentPageId).toBe("page-b");
  });

  it("part 해시 불일치 · 자산 해시 불일치를 받아들이지 않는다", async () => {
    const { content, store, png } = await fixture();
    const g = await buildV2Generation(
      content,
      async (h) => store.get(h) ?? null,
    );
    const files = new Map(g.files);
    files.set("manifest.json", encodeManifest(g.manifest));
    files.set(`assets/${png}.png`, new Uint8Array([1, 2, 3]));
    await expect(readV2Generation(mapV2Source(files))).rejects.toBeInstanceOf(
      V2FormatError,
    );
  });

  it("최상위 폴더로 묶인 zip 도 읽는다", async () => {
    const { content, store } = await fixture();
    const g = await buildV2Generation(
      content,
      async (h) => store.get(h) ?? null,
    );
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("Demo.composition/manifest.json", encodeManifest(g.manifest));
    for (const [path, bytes] of g.files)
      zip.file(`Demo.composition/${path}`, bytes);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const read = await readV2Generation(await openV2Zip(bytes));
    expect(read.content.currentPageId).toBe("page-b");
  });
});

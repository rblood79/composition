// @vitest-environment node
/**
 * ADR-235 Phase 1 — 자산 저장소 (IndexedDB `assets` · `asset_gc`) + 해석기.
 * node 환경: 실제 Blob · structuredClone · URL.createObjectURL 을 쓴다 (jsdom Blob 은 복제 불가).
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveAssetUrl,
  resolveAssetUrlAsync,
  setAssetUrlResolver,
} from "@composition/shared";
import {
  refFromHash as assetRefFromHash,
  sha256Hex,
} from "@composition/shared/assets";
import { IndexedDBAdapter } from "../../db/indexedDB/adapter";
import { closeAssetDb, openAssetDb, readAllAssetGcRecords } from "../assetDb";
import {
  AssetMissingError,
  prepareAssetReferences,
  readAssetBlob,
  storeAssetBytes,
} from "../assetStore";
import { createIndexedDbAssetUrlResolver } from "../assetUrlResolver";
import { ASSETS_STORE } from "../assetSchema";
import { inlineAssetRefs } from "../assetExport";
import { collectAssetRefs } from "@composition/shared";
import { decodeDataUrl } from "@composition/shared/assets";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

let adapter: IndexedDBAdapter;

beforeEach(async () => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  adapter = new IndexedDBAdapter();
  await adapter.init();
});

afterEach(async () => {
  setAssetUrlResolver(null);
  await closeAssetDb();
  await adapter.close();
});

async function countAssets(): Promise<number> {
  const db = await openAssetDb();
  return new Promise((resolve) => {
    const req = db!.transaction(ASSETS_STORE).objectStore(ASSETS_STORE).count();
    req.onsuccess = () => resolve(req.result);
  });
}

describe("assetStore (ADR-235 Phase 1)", () => {
  it("DB 가 없으면 만들지 않고 null — builder 업그레이드 경로 보존", async () => {
    await closeAssetDb();
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
    expect(await openAssetDb()).toBeNull();
    const names = await (
      globalThis as unknown as { indexedDB: IDBFactory }
    ).indexedDB.databases();
    expect(names.map((d) => d.name)).not.toContain("composition");
  });

  it("같은 바이트 2회 저장 = 자산 1개 · 참조 동일 (G1)", async () => {
    const first = await storeAssetBytes({ bytes: PNG, mime: "image/png" });
    const second = await storeAssetBytes({
      bytes: PNG.slice(),
      mime: "image/png",
    });
    expect(first.ref).toBe(second.ref);
    expect(first.ref).toBe(assetRefFromHash(await sha256Hex(PNG)));
    expect(first.ext).toBe("png");
    expect(await countAssets()).toBe(1);
    const blob = await readAssetBlob(first.ref);
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(PNG);
  });

  it("저장 · 참조 준비는 pin 과 epoch 증가를 같은 트랜잭션에서 확정한다", async () => {
    const stored = await storeAssetBytes(
      { bytes: PNG, mime: "image/png" },
      "tab-1",
    );
    await prepareAssetReferences([stored.ref], "tab-2");
    const [gc] = await readAllAssetGcRecords();
    expect(gc.hash).toBe(stored.hash);
    expect(gc.referenceEpoch).toBe(2);
    expect(gc.pins.sort()).toEqual(["tab-1", "tab-2"]);
    expect(gc.candidate).toBeUndefined();
  });

  it("바이트가 없는 참조의 준비는 실패하고 pin 을 남기지 않는다", async () => {
    const stored = await storeAssetBytes({ bytes: PNG, mime: "image/png" });
    const missing = assetRefFromHash("f".repeat(64));
    await expect(
      prepareAssetReferences([stored.ref, missing], "tab-x"),
    ).rejects.toBeInstanceOf(AssetMissingError);
    const records = await readAllAssetGcRecords();
    // 전체 트랜잭션 abort — 먼저 처리된 stored 의 pin 도 남지 않는다
    expect(records).toHaveLength(1);
    expect(records[0].pins).not.toContain("tab-x");
    await expect(
      prepareAssetReferences(["asset:sha256-bad"]),
    ).rejects.toBeInstanceOf(AssetMissingError);
  });

  it("해석기: ensure 뒤 blob URL, 없는 자산은 null (요청 0)", async () => {
    const stored = await storeAssetBytes({ bytes: PNG, mime: "image/png" });
    const resolver = createIndexedDbAssetUrlResolver();
    setAssetUrlResolver(resolver);
    let notified = 0;
    resolver.subscribe(() => (notified += 1));

    expect(resolveAssetUrl(stored.ref)).toBeNull();
    const url = await resolveAssetUrlAsync(stored.ref);
    expect(url).toMatch(/^blob:/);
    expect(resolveAssetUrl(stored.ref)).toBe(url);
    expect(notified).toBe(1);

    const missing = assetRefFromHash("e".repeat(64));
    expect(await resolveAssetUrlAsync(missing)).toBeNull();

    const fetched = await fetch(url!);
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(PNG);

    resolver.revoke(stored.ref);
    expect(resolveAssetUrl(stored.ref)).toBeNull();
  });

  it("register 는 writer 가 저장한 바이트를 IndexedDB 왕복 없이 즉시 해석한다", () => {
    const resolver = createIndexedDbAssetUrlResolver();
    setAssetUrlResolver(resolver);
    const ref = assetRefFromHash("c".repeat(64));
    const url = resolver.register(ref, new Blob([PNG], { type: "image/png" }));
    expect(resolveAssetUrl(ref)).toBe(url);
  });

  it("자립 v1 내보내기: 참조를 바이트 dataURL 로 되살린다 (HC7)", async () => {
    const stored = await storeAssetBytes({ bytes: PNG, mime: "image/png" });
    const envelope = {
      document: {
        children: [
          {
            fills: [{ type: "image", url: stored.ref }],
            metadata: { legacyProps: { fills: [{ url: stored.ref }] } },
            props: { style: { backgroundImage: `url(${stored.ref})` } },
          },
        ],
      },
      fontRegistry: { version: 2, faces: [] },
    };
    const inlined = await inlineAssetRefs(envelope);
    expect(collectAssetRefs(inlined).size).toBe(0);
    const url = (inlined.document.children[0].fills[0] as { url: string }).url;
    expect(decodeDataUrl(url)?.bytes).toEqual(PNG);
    expect(inlined.document.children[0].props.style.backgroundImage).toBe(
      `url(${url})`,
    );
    // 원본 불변
    expect(envelope.document.children[0].fills[0].url).toBe(stored.ref);
  });

  it("자립 내보내기: 없는 자산이면 실패 — 참조만 든 파일을 만들지 않는다", async () => {
    const missing = assetRefFromHash("d".repeat(64));
    await expect(
      inlineAssetRefs({ document: { src: missing } }),
    ).rejects.toBeInstanceOf(AssetMissingError);
  });
});

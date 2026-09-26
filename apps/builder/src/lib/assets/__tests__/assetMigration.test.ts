// @vitest-environment node
/**
 * ADR-235 Phase 2 — 인라인 dataURL → 자산 이관 (G2).
 * (a) 자산 저장 강제 실패 시 인라인 유지 (b) 2회 실행 결과 동일 (c) 이관 전 백업 존재.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { encodeDataUrl } from "@composition/shared/assets";
import { IndexedDBAdapter } from "../../db/indexedDB/adapter";
import { closeAssetDb, readAssetRecords } from "../assetDb";
import {
  findInlineAssetDataUrls,
  migrateFontRegistry,
  migrateProjectInlineAssets,
  migrateValueInlineAssets,
  replaceInlineAssetDataUrls,
} from "../assetMigration";

const PNG = encodeDataUrl(
  "image/png",
  new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
);
const JPG = encodeDataUrl("image/jpeg", new Uint8Array([255, 216, 255, 9]));

function doc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "a",
        type: "frame",
        fills: [{ id: "f", type: "image", url: PNG, mode: "fill" }],
        metadata: { legacyProps: { fills: [{ url: PNG }] } },
        props: { style: { backgroundImage: `url("${JPG}")` } },
      },
      { id: "b", type: "Image", props: { src: JPG, alt: "x" } },
      { id: "c", type: "Text", props: { children: "data: 는 텍스트" } },
    ],
  } as unknown as CompositionDocument;
}

let adapter: IndexedDBAdapter;
beforeEach(async () => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  adapter = new IndexedDBAdapter();
  await adapter.init();
});
afterEach(async () => {
  await closeAssetDb();
  await adapter.close();
});

describe("인라인 자산 탐지 · 치환", () => {
  it("문자열 전체 dataURL + CSS url(data:…) 를 찾고 일반 텍스트는 무시한다", () => {
    expect([...findInlineAssetDataUrls(doc())].sort()).toEqual(
      [JPG, PNG].sort(),
    );
  });

  it("치환은 전수 · 원본 불변 · 변화 없으면 같은 참조", () => {
    const source = doc();
    const map = new Map([
      [PNG, `asset:sha256-${"a".repeat(64)}`],
      [JPG, `asset:sha256-${"b".repeat(64)}`],
    ] as const);
    const next = replaceInlineAssetDataUrls(source, map);
    expect(findInlineAssetDataUrls(next).size).toBe(0);
    expect(
      (
        next.children[0] as unknown as {
          props: { style: { backgroundImage: string } };
        }
      ).props.style.backgroundImage,
    ).toBe(`url("asset:sha256-${"b".repeat(64)}")`);
    expect(findInlineAssetDataUrls(source).size).toBe(2);
    expect(replaceInlineAssetDataUrls(source, new Map())).toBe(source);
  });
});

describe("프로젝트 이관 (G2 원복 RED)", () => {
  async function run(
    current: { value: CompositionDocument },
    options: {
      backup?: () => Promise<boolean>;
      store?: Parameters<typeof migrateProjectInlineAssets>[0]["store"];
    } = {},
  ) {
    const applied: CompositionDocument[] = [];
    const result = await migrateProjectInlineAssets<CompositionDocument>({
      getDocument: () => current.value,
      backupNow: options.backup ?? (async () => true),
      apply: (next) => {
        applied.push(next);
        current.value = next;
      },
      store: options.store,
    });
    return { result, applied };
  }

  it("(a) 자산 저장이 실패하면 문서를 바꾸지 않는다 (인라인 유지)", async () => {
    const current = { value: doc() };
    const failing = vi.fn(async () => {
      throw new Error("quota");
    });
    const { result, applied } = await run(current, { store: failing });
    expect(result.status).toBe("store-failed");
    expect(applied).toHaveLength(0);
    expect(findInlineAssetDataUrls(current.value).size).toBe(2);
  });

  it("(a') 일부만 실패하면 성공분만 치환하고 실패분은 인라인으로 남긴다", async () => {
    const { storeAssetBytes } = await import("../assetStore");
    const current = { value: doc() };
    const partial: typeof storeAssetBytes = async (input, session) => {
      if (input.mime === "image/jpeg") throw new Error("quota");
      return storeAssetBytes(input, session);
    };
    const { result } = await run(current, { store: partial });
    expect(result).toMatchObject({
      status: "migrated",
      migrated: 1,
      failed: 1,
    });
    expect([...findInlineAssetDataUrls(current.value)]).toEqual([JPG]);
  });

  it("(c) 백업을 남기지 못하면 치환하지 않는다", async () => {
    const current = { value: doc() };
    const { result, applied } = await run(current, {
      backup: async () => false,
    });
    expect(result.status).toBe("backup-failed");
    expect(applied).toHaveLength(0);
  });

  it("(b) 두 번 실행해도 결과가 같다 (멱등) · 바이트는 원본 그대로", async () => {
    const current = { value: doc() };
    const first = await run(current);
    expect(first.result).toMatchObject({ status: "migrated", migrated: 2 });
    const afterFirst = JSON.stringify(current.value);
    const second = await run(current);
    expect(second.result.status).toBe("none");
    expect(JSON.stringify(current.value)).toBe(afterFirst);
    const refs = [...afterFirst.matchAll(/asset:sha256-([0-9a-f]{64})/g)].map(
      (m) => m[1],
    );
    const records = await readAssetRecords(refs);
    expect(records.size).toBe(2);
    const bytes = await Promise.all(
      [...records.values()].map(async (r) => [
        ...new Uint8Array(await r.blob.arrayBuffer()),
      ]),
    );
    expect(bytes).toContainEqual([137, 80, 78, 71, 1, 2, 3]);
  });

  it("치환은 저장이 끝난 시점의 최신 문서에 적용한다 (저장 중 편집 보존)", async () => {
    const current = { value: doc() };
    const { storeAssetBytes } = await import("../assetStore");
    const slow: typeof storeAssetBytes = async (input, session) => {
      const stored = await storeAssetBytes(input, session);
      // 저장 중 사용자가 텍스트를 바꿨다
      current.value = {
        ...current.value,
        children: current.value.children.map((node) =>
          node.id === "c" ? { ...node, props: { children: "edited" } } : node,
        ),
      } as CompositionDocument;
      return stored;
    };
    await run(current, { store: slow });
    const text = current.value.children.find(
      (n) => n.id === "c",
    ) as unknown as {
      props: { children: string };
    };
    expect(text.props.children).toBe("edited");
    expect(findInlineAssetDataUrls(current.value).size).toBe(0);
  });

  it("(c) adapter backupNow — 저장된 이관 전 문서가 백업 ring 에 남는다", async () => {
    const original = doc();
    await adapter.documents.put("p1", original);
    expect(await adapter.documents.backupNow("p1")).toBe(true);
    const backups = await adapter.documents.getBackups("p1");
    expect(backups).toHaveLength(1);
    expect(findInlineAssetDataUrls(backups[0].document).size).toBe(2);
    // 같은 세대면 다시 쓰지 않는다
    expect(await adapter.documents.backupNow("p1")).toBe(true);
    expect(await adapter.documents.getBackups("p1")).toHaveLength(1);
    expect(await adapter.documents.backupNow("missing")).toBe(false);
  });
});

describe("가져오기 · 폰트 레지스트리 이관", () => {
  it("v1 envelope 의 인라인 자산을 자산화한다", async () => {
    const envelope = {
      document: doc(),
      fontRegistry: { version: 2, faces: [] },
    };
    const { value, migrated } = await migrateValueInlineAssets(envelope);
    expect(migrated).toBe(2);
    expect(findInlineAssetDataUrls(value).size).toBe(0);
  });

  it("4MB 폰트 — 레지스트리가 참조만 들어 localStorage 한도 안에 저장된다 · 원본은 자산으로 백업", async () => {
    const fontBytes = new Uint8Array(4 * 1024 * 1024).map((_, i) => i % 251);
    const face = {
      id: "big",
      family: "Big",
      source: {
        type: "data-url-temp",
        url: encodeDataUrl("font/woff2", fontBytes),
      },
    };
    // localStorage (~5MB) 대역 — 원본 레지스트리는 이미 한도 근처
    let stored: string | null = JSON.stringify({ version: 2, faces: [face] });
    const LIMIT = 5 * 1024 * 1024 * 1.1;
    let backupRef: string | null = null;
    const saved: string[] = [];
    const result = await migrateFontRegistry({
      load: () => JSON.parse(stored!) as { version: 2; faces: (typeof face)[] },
      save: (next) => {
        const raw = JSON.stringify(next);
        if (raw.length > LIMIT)
          throw new DOMException("quota", "QuotaExceededError");
        stored = raw;
        saved.push(raw);
      },
      readRaw: () => stored,
      writeBackupRef: (ref) => (backupRef = ref),
    });
    expect(result).toEqual({ migrated: 1, failed: 0 });
    expect(saved).toHaveLength(1);
    expect(saved[0].length).toBeLessThan(1024);
    const next = JSON.parse(saved[0]);
    expect(next.faces[0].source).toMatchObject({ type: "project-asset" });
    expect(next.faces[0].source.url).toMatch(/^asset:sha256-/);
    expect(backupRef).toMatch(/^asset:sha256-/);
    const records = await readAssetRecords([
      next.faces[0].source.url.slice("asset:sha256-".length),
      backupRef!.slice("asset:sha256-".length),
    ]);
    expect(records.size).toBe(2);
  });
});

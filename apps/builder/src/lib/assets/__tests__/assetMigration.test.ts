// @vitest-environment node
/**
 * ADR-235 Phase 2 — 인라인 dataURL → 자산 이관 (G2).
 * 가져온 파일 envelope · 폰트 레지스트리의 인라인 자산 이관.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LegacyDocumentFixture } from "../../db/__tests__/support/legacyPayload";
import { encodeDataUrl } from "@composition/shared/assets";
import { IndexedDBAdapter } from "../../db/indexedDB/adapter";
import { closeAssetDb, readAssetRecords } from "../assetDb";
import {
  findInlineAssetDataUrls,
  migrateFontRegistry,
  migrateValueInlineAssets,
  replaceInlineAssetDataUrls,
} from "../assetMigration";

const PNG = encodeDataUrl(
  "image/png",
  new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
);
const JPG = encodeDataUrl("image/jpeg", new Uint8Array([255, 216, 255, 9]));

function doc(): LegacyDocumentFixture {
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
  } as unknown as LegacyDocumentFixture;
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

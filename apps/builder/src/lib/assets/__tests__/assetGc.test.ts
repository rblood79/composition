// @vitest-environment node
/**
 * ADR-235 Phase 3 — 자산 GC (G3). root 반증 · §3.1 경쟁 순서 · pin 정리.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { IndexedDBAdapter } from "../../db/indexedDB/adapter";
import { closeAssetDb, readAllAssetGcRecords } from "../assetDb";
import { releaseAssetPins, runAssetGc, type AssetGcRoots } from "../assetGc";
import { openAssetDb } from "../assetDb";
import { collectDurableAssetRoots } from "../assetGcRoots";
import {
  AssetMissingError,
  prepareAssetReferences,
  readAssetBlob,
  storeAssetBytes,
} from "../assetStore";

let adapter: IndexedDBAdapter;
const SELF = "tab-self";
const OTHER = "tab-other";

beforeEach(async () => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  adapter = new IndexedDBAdapter();
  await adapter.init();
});
afterEach(async () => {
  await closeAssetDb();
  await adapter.close();
});

async function asset(seed: number, session = OTHER) {
  return storeAssetBytes(
    { bytes: new Uint8Array([seed, seed + 1, seed + 2]), mime: "image/png" },
    session,
  );
}

/** pin 은 끝난 세션으로 보고 푼다 (살아 있는 세션 = SELF 만) */
const live = async () => new Set([SELF]);

function roots(durable: unknown[] = [], memory: unknown[] = []): AssetGcRoots {
  return { durable: async () => durable, memory: () => memory };
}

async function gc(
  r: AssetGcRoots,
  extra: Partial<Parameters<typeof runAssetGc>[0]> = {},
) {
  return runAssetGc({
    roots: r,
    graceMs: 0,
    sessionId: SELF,
    liveSessions: live,
    ...extra,
  });
}

describe("GC mark · sweep", () => {
  it("미참조 자산은 두 번째 mark 에서 지워지고 tombstone 이 남는다", async () => {
    const a = await asset(1);
    const first = await gc(roots());
    expect(first).toMatchObject({ candidates: 1, deleted: [] });
    expect(await readAssetBlob(a.ref)).not.toBeNull();
    const second = await gc(roots());
    expect(second.deleted).toEqual([a.hash]);
    expect(await readAssetBlob(a.ref)).toBeNull();
    const [record] = await readAllAssetGcRecords();
    expect(record.deletedAt).toBeDefined();
    expect(record.referenceEpoch).toBeGreaterThan(1);
  });

  it("유예가 지나지 않은 후보는 지우지 않는다", async () => {
    await asset(1);
    await runAssetGc({
      roots: roots(),
      sessionId: SELF,
      liveSessions: live,
      graceMs: 60_000,
    });
    const second = await runAssetGc({
      roots: roots(),
      sessionId: SELF,
      liveSessions: live,
      graceMs: 60_000,
    });
    expect(second.deleted).toEqual([]);
    expect(second.cancelled).toHaveLength(1);
  });

  it.each([
    [
      "백업에만",
      (ref: string) =>
        roots([
          { backup: { document: { children: [{ fills: [{ url: ref }] }] } } },
        ]),
    ],
    [
      "스냅샷에만",
      (ref: string) => roots([{ snapshot: { doc: { props: { src: ref } } } }]),
    ],
    [
      "다른 프로젝트에만",
      (ref: string) =>
        roots([{ project_id: "p2", value: JSON.stringify({ url: ref }) }]),
    ],
    [
      "history entry 에만",
      (ref: string) =>
        roots([
          {
            entry: {
              data: { canonicalEvents: [{ node: { fills: [{ url: ref }] } }] },
            },
          },
        ]),
    ],
    [
      "메모리 history 에만",
      (ref: string) =>
        roots([], [[{ entries: [{ prevProps: { src: ref } }] }]]),
    ],
    [
      "폰트 레지스트리 · 백업 참조에만",
      (ref: string) =>
        roots([JSON.stringify({ faces: [{ source: { url: ref } }] })]),
    ],
  ])("%s 남은 자산은 지우지 않는다", async (_label, rootsFor) => {
    const a = await asset(3);
    await gc(rootsFor(a.ref));
    const second = await gc(rootsFor(a.ref));
    expect(second.deleted).toEqual([]);
    expect(await readAssetBlob(a.ref)).not.toBeNull();
  });

  it("다시 참조되면 후보가 풀린다", async () => {
    const a = await asset(4);
    await gc(roots());
    await gc(roots([a.ref]));
    const records = await readAllAssetGcRecords();
    expect(records[0].candidate).toBeUndefined();
    const third = await gc(roots());
    expect(third.deleted).toEqual([]); // 다시 두 번 mark 해야 한다
  });
});

describe("§3.1 참조 공개 · 삭제 경쟁 (G3 고정 반례)", () => {
  it("(a) 두 번째 mark 와 삭제 사이에 바이트 재저장 없이 재참조 → pin 선행이면 삭제 취소", async () => {
    const a = await asset(5);
    await gc(roots());
    const report = await gc(roots(), {
      beforeSweep: async () => {
        await prepareAssetReferences([a.ref], OTHER);
      },
    });
    expect(report.deleted).toEqual([]);
    expect(report.cancelled).toEqual([a.hash]);
    expect(await readAssetBlob(a.ref)).not.toBeNull();
    const [record] = await readAllAssetGcRecords();
    expect(record.pins).toContain(OTHER);
  });

  it("(b) 삭제가 먼저 확정되면 참조 준비가 실패한다 (깨진 참조 공개 거부)", async () => {
    const a = await asset(6);
    await gc(roots());
    await gc(roots());
    await expect(prepareAssetReferences([a.ref], OTHER)).rejects.toBeInstanceOf(
      AssetMissingError,
    );
    // 재업로드 (바이트 있음) 는 된다 — tombstone epoch 를 재사용하지 않는다
    const again = await asset(6);
    const [record] = await readAllAssetGcRecords();
    expect(again.ref).toBe(a.ref);
    expect(record.deletedAt).toBeUndefined();
    expect(record.referenceEpoch).toBeGreaterThan(2);
  });

  it("(c) mark 가 root 영속화 전에 시작되고 영속 뒤 pin 이 풀려도 그 sweep 은 취소된다", async () => {
    // SELF 가 참조를 공개 (pin) → 첫 GC: pin 이라 후보 아님
    const a = await asset(7, SELF);
    expect((await gc(roots())).candidates).toBe(0);
    // 영속 root 에 들어가기 전 (durable 비어 있음) SELF 가 참조를 지웠다고 치고, pin 해제는
    // 영속 root 에 있을 때만이므로 이번 GC 에서도 풀리지 않는다
    expect((await gc(roots())).released).toBe(0);
    // 영속 root 에 들어간 뒤 GC: pin 해제 (epoch 증가) — 같은 GC 안에서는 참조돼 후보 아님
    const released = await gc(roots([a.ref]));
    expect(released.released).toBe(1);
    // 이제 참조가 사라지면 두 번 mark 해야 지워진다. 첫 mark 와 sweep 사이에 pin 해제가 끼면 취소.
    await gc(roots());
    const report = await gc(roots(), {
      beforeSweep: async () => {
        await prepareAssetReferences([a.ref], OTHER); // 다른 탭이 재참조 (epoch 증가)
      },
    });
    expect(report.deleted).toEqual([]);
  });

  it("(c\') 두 번째 mark 와 삭제 사이에 재참조 → 영속 → pin 해제까지 끝나도 그 sweep 은 취소된다", async () => {
    const a = await asset(14);
    await gc(roots());
    const report = await gc(roots(), {
      beforeSweep: async () => {
        await prepareAssetReferences([a.ref], OTHER);
        await releaseAssetPins([a.hash], new Set([OTHER]));
      },
    });
    expect(report.deleted).toEqual([]);
    expect(await readAssetBlob(a.ref)).not.toBeNull();
  });

  it("삭제 tx 는 pin 을 따로 확인한다 (epoch 를 올리지 않은 pin — 구버전 writer · 손상 메타)", async () => {
    const a = await asset(15);
    await gc(roots());
    const report = await gc(roots(), {
      beforeSweep: async () => {
        const db = await openAssetDb();
        await new Promise<void>((resolve) => {
          const tx = db!.transaction("asset_gc", "readwrite");
          const store = tx.objectStore("asset_gc");
          const req = store.get(a.hash);
          req.onsuccess = () =>
            store.put({ ...req.result, pins: ["tab-legacy"] });
          tx.oncomplete = () => resolve();
        });
      },
    });
    expect(report.deleted).toEqual([]);
  });

  it("삭제 tx 는 epoch 를 따로 확인한다 (후보가 남은 채 epoch 만 오른 경우)", async () => {
    const a = await asset(16);
    await gc(roots());
    const report = await gc(roots(), {
      beforeSweep: async () => {
        const db = await openAssetDb();
        await new Promise<void>((resolve) => {
          const tx = db!.transaction("asset_gc", "readwrite");
          const store = tx.objectStore("asset_gc");
          const req = store.get(a.hash);
          req.onsuccess = () =>
            store.put({
              ...req.result,
              referenceEpoch: req.result.referenceEpoch + 1,
            });
          tx.oncomplete = () => resolve();
        });
      },
    });
    expect(report.deleted).toEqual([]);
  });

  it("pin 해제는 epoch 를 올려 그 전에 시작된 mark 의 후보를 무효화한다", async () => {
    const a = await asset(17, SELF);
    // 영속 root 에 있는 SELF pin → 해제되며 epoch 증가
    const before = (await readAllAssetGcRecords())[0].referenceEpoch;
    await gc(roots([a.ref]));
    const after = (await readAllAssetGcRecords())[0];
    expect(after.pins).toEqual([]);
    expect(after.referenceEpoch).toBe(before + 1);
  });

  it("끝난 세션의 pin 은 풀고 살아 있는 세션의 pin 은 유지한다", async () => {
    const dead = await asset(8, "tab-dead");
    const alive = await asset(9, SELF);
    await gc(roots());
    const report = await gc(roots());
    expect(report.deleted).toEqual([dead.hash]);
    expect(await readAssetBlob(alive.ref)).not.toBeNull();
  });

  it("세션 생존을 알 수 없으면 (Web Locks 없음) 다른 세션 pin 을 풀지 않는다", async () => {
    const a = await asset(10, "tab-unknown");
    const unknown = async () => null;
    await runAssetGc({
      roots: roots(),
      graceMs: 0,
      sessionId: SELF,
      liveSessions: unknown,
    });
    const report = await runAssetGc({
      roots: roots(),
      graceMs: 0,
      sessionId: SELF,
      liveSessions: unknown,
    });
    expect(report.deleted).toEqual([]);
    expect(await readAssetBlob(a.ref)).not.toBeNull();
  });
});

describe("영속 root 수집 (G0 (b) 보유처)", () => {
  it("살아 있는 프로젝트의 문서 · 백업 · collections 와 전체 history entry 를 모으고 지운 프로젝트 백업은 뺀다", async () => {
    const live = await asset(11);
    const orphan = await asset(12);
    const hist = await asset(13);
    await adapter.projects.insert({
      id: "p1",
      name: "p1",
      created_at: "",
      updated_at: "",
    } as never);
    const doc = (url: string) =>
      ({
        version: "composition-1.0",
        children: [{ id: "n", type: "frame", fills: [{ url }] }],
      }) as unknown as CompositionDocument;
    await adapter.documents.put("p1", doc(live.ref));
    await adapter.documents.put("gone", doc(orphan.ref));
    await adapter.documents.backupNow("gone");
    await adapter.documents.delete("gone");
    // history DB
    await new Promise<void>((resolve) => {
      const req = indexedDB.open("composition-history", 4);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("history-entries", { keyPath: "id" });
        req.result.createObjectStore("snapshots", { keyPath: "id" });
      };
      req.onsuccess = () => {
        const tx = req.result.transaction("history-entries", "readwrite");
        tx.objectStore("history-entries").put({
          id: "e1",
          pageId: "x",
          entry: { props: { src: hist.ref } },
        });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
      };
    });
    const text = JSON.stringify(await collectDurableAssetRoots());
    expect(text).toContain(live.hash);
    expect(text).toContain(hist.hash);
    expect(text).not.toContain(orphan.hash);
  });
});

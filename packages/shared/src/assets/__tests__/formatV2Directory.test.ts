import { describe, expect, it } from "vitest";

import { refFromHash, sha256Hex } from "../assetBytes";
import {
  buildV2Generation,
  directoryV2Source,
  memoryV2Directory,
  nextV2Revision,
  readManifestRevision,
  readV2Generation,
  writeV2Directory,
  type ProjectContentV2,
  type V2AssetBytes,
} from "../formatV2";

const bytes = (n: number) => new Uint8Array([137, 80, 78, 71, n, n + 1]);

async function generation(label: string, revision: number, assetSeed: number) {
  const png = bytes(assetSeed);
  const hash = await sha256Hex(png);
  const store = new Map<string, V2AssetBytes>([
    [hash, { bytes: png, mime: "image/png", ext: "png" }],
  ]);
  const content: ProjectContentV2 = {
    project: { id: "p", name: "P" },
    document: {
      children: [{ id: "n", label, props: { src: refFromHash(hash) } }],
    },
    currentPageId: `page-${label}`,
  };
  return buildV2Generation(content, async (h) => store.get(h) ?? null, {
    revision,
    previousRevision: revision > 1 ? revision - 1 : null,
  });
}

const STEPS = [
  "assets",
  "parts",
  "manifest-record",
  "manifest",
  "cleanup",
] as const;

describe("디렉토리 세대 전환 (ADR-235 G6)", () => {
  it("쓰기 → 읽기 · revision · 재확인", async () => {
    const dir = memoryV2Directory();
    await writeV2Directory(dir, await generation("a", 1, 1));
    expect(await readManifestRevision(dir)).toBe(1);
    const read = await readV2Generation(directoryV2Source(dir));
    expect(read.content.currentPageId).toBe("page-a");
    expect(read.recovered).toBe(false);
  });

  it.each(STEPS)(
    "중단 주입 (%s 뒤) — 읽기 결과는 직전 세대 전체 또는 새 세대 전체",
    async (step) => {
      const dir = memoryV2Directory();
      await writeV2Directory(dir, await generation("a", 1, 1));
      const g2 = await generation("b", 2, 2);
      await expect(
        writeV2Directory(dir, g2, {
          checkpoint: async (at) => {
            if (at === step) throw new Error("interrupted");
          },
        }),
      ).rejects.toThrow("interrupted");
      const read = await readV2Generation(directoryV2Source(dir));
      const page = read.content.currentPageId;
      expect(["page-a", "page-b"]).toContain(page);
      // 섞임 0 — 문서 · 자산이 같은 세대
      const doc = read.content.document as {
        children: { label: string; props: { src: string } }[];
      };
      expect(`page-${doc.children[0].label}`).toBe(page);
      const expectedAsset = await sha256Hex(bytes(page === "page-a" ? 1 : 2));
      expect(doc.children[0].props.src).toBe(refFromHash(expectedAsset));
      expect(read.assets.has(expectedAsset)).toBe(true);
      // manifest.json 교체 전 중단이면 직전 세대, 뒤면 새 세대
      const replaced = step === "manifest" || step === "cleanup";
      expect(page).toBe(replaced ? "page-b" : "page-a");
    },
  );

  it("manifest.json 쓰기 중 손상 (부분 쓰기) → 기록된 새 세대로 복구", async () => {
    const dir = memoryV2Directory();
    await writeV2Directory(dir, await generation("a", 1, 1));
    const g2 = await generation("b", 2, 2);
    await expect(
      writeV2Directory(dir, g2, {
        checkpoint: async (at) => {
          if (at === "manifest-record") {
            dir.files.set(
              "manifest.json",
              new TextEncoder().encode('{"formatVersion":"2.0'),
            );
            throw new Error("crash while writing manifest.json");
          }
        },
      }),
    ).rejects.toThrow();
    const read = await readV2Generation(directoryV2Source(dir));
    expect(read).toMatchObject({
      recovered: true,
      content: { currentPageId: "page-b" },
    });
  });

  it("보존 세대 = 현재 + 직전 1 — 더 오래된 세대의 파일만 정리한다", async () => {
    const dir = memoryV2Directory();
    const g1 = await generation("a", 1, 1);
    const g2 = await generation("b", 2, 2);
    const g3 = await generation("c", 3, 3);
    await writeV2Directory(dir, g1);
    await writeV2Directory(dir, g2);
    await writeV2Directory(dir, g3);
    const onlyG1 = [...g1.files.keys()].filter(
      (p) => !g2.files.has(p) && !g3.files.has(p),
    );
    expect(onlyG1.length).toBeGreaterThan(0);
    for (const path of onlyG1) expect(dir.files.has(path)).toBe(false);
    for (const path of [...g2.files.keys(), ...g3.files.keys()])
      expect(dir.files.has(path)).toBe(true);
    expect(await dir.list("manifests")).toHaveLength(2);
    // 현재 manifest 가 손상되면 직전 (g2) 가 아니라 기록된 최신 (g3) 으로 복구
    dir.files.set("manifest.json", new Uint8Array([1, 2, 3]));
    expect(
      (await readV2Generation(directoryV2Source(dir))).manifest.revision,
    ).toBe(3);
  });

  it("기존 파일은 덮어쓰지 않는다 (불변 경로 재사용)", async () => {
    const dir = memoryV2Directory();
    const g1 = await generation("a", 1, 1);
    await writeV2Directory(dir, g1);
    const writes: string[] = [];
    const spy = {
      ...dir,
      write: async (path: string, b: Uint8Array) => {
        writes.push(path);
        await dir.write(path, b);
      },
    };
    const same = await generation("a", 2, 1); // 같은 내용 = 같은 part · 자산
    await writeV2Directory(spy, same);
    expect(
      writes.filter((p) => p.startsWith("parts/") || p.startsWith("assets/")),
    ).toEqual([]);
  });

  it("다음 세대 번호는 manifest.json 이 손상돼도 되돌아가지 않는다", async () => {
    const dir = memoryV2Directory();
    await writeV2Directory(dir, await generation("a", 7, 1));
    dir.files.set("manifest.json", new Uint8Array([1]));
    expect(await nextV2Revision(dir)).toEqual({
      revision: 8,
      previousRevision: 7,
    });
    expect(await nextV2Revision(dir, 20)).toEqual({
      revision: 21,
      previousRevision: 20,
    });
    expect(await nextV2Revision(memoryV2Directory())).toEqual({
      revision: 1,
      previousRevision: null,
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  assetHashFromRef,
  assetRefFromHash,
  collectAssetRefs,
  decodeDataUrl,
  encodeDataUrl,
  ensureAssetRefs,
  extensionForMime,
  isAssetRef,
  mapAssetRefs,
  resolveAssetUrl,
  resolveAssetUrlAsync,
  setAssetUrlResolver,
  sha256Hex,
  type AssetRef,
  type AssetUrlResolver,
} from "../assetRef";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const REF_A = assetRefFromHash(HASH_A);
const REF_B = assetRefFromHash(HASH_B);

function fakeResolver(ready: Record<string, string> = {}) {
  const urls = new Map<string, string>(Object.entries(ready));
  const ensured: string[][] = [];
  const resolver: AssetUrlResolver = {
    resolveSync: (ref) => urls.get(ref) ?? null,
    ensure: async (refs) => {
      const list = [...refs];
      ensured.push(list);
      for (const ref of list) urls.set(ref, `blob:test/${ref.slice(-4)}`);
    },
    subscribe: () => () => {},
  };
  return { resolver, ensured };
}

describe("assetRef (ADR-235)", () => {
  afterEach(() => setAssetUrlResolver(null));

  it("참조 규약: asset:sha256-<64 hex> 만 참조다", () => {
    expect(isAssetRef(REF_A)).toBe(true);
    expect(isAssetRef(`asset:sha256-${"A".repeat(64)}`)).toBe(false);
    expect(isAssetRef("asset:sha256-abc")).toBe(false);
    expect(isAssetRef("data:image/png;base64,AA")).toBe(false);
    expect(assetHashFromRef(REF_A)).toBe(HASH_A);
    expect(assetHashFromRef("nope")).toBeNull();
  });

  it("collectAssetRefs 는 필드 목록이 아니라 문자열 전수 순회로 모은다", () => {
    const doc = {
      children: [
        {
          fills: [{ type: "image", url: REF_A }],
          metadata: { legacyProps: { fills: [{ url: REF_A }] } },
          props: { src: REF_B, style: { backgroundImage: `url(${REF_B})` } },
        },
      ],
    };
    expect([...collectAssetRefs(doc)].sort()).toEqual([REF_A, REF_B]);
  });

  it("mapAssetRefs 는 참조 문자열만 바꾸고 원본을 바꾸지 않는다", () => {
    const doc = { a: [REF_A, "x"], b: { c: `url(${REF_B})` }, d: 1 };
    const mapped = mapAssetRefs(doc, (ref) => `data:${ref.slice(-2)}`);
    expect(mapped).toEqual({
      a: [`data:aa`, "x"],
      b: { c: "url(data:bb)" },
      d: 1,
    });
    expect(collectAssetRefs(mapped).size).toBe(0);
    expect(doc.a[0]).toBe(REF_A);
    const untouched = { a: ["x"] };
    expect(mapAssetRefs(untouched, () => "y")).toBe(untouched);
  });

  it("resolveAssetUrl — dual-read: 비참조는 그대로, 준비 전 참조는 null", () => {
    expect(resolveAssetUrl("https://x/y.png")).toBe("https://x/y.png");
    expect(resolveAssetUrl("data:image/png;base64,AA")).toBe(
      "data:image/png;base64,AA",
    );
    expect(resolveAssetUrl(REF_A)).toBeNull(); // 해석기 없음
    setAssetUrlResolver(fakeResolver({ [REF_A]: "blob:ready" }).resolver);
    expect(resolveAssetUrl(REF_A)).toBe("blob:ready");
    expect(resolveAssetUrl(REF_B)).toBeNull();
    expect(resolveAssetUrl("asset:sha256-bad")).toBeNull();
  });

  it("resolveAssetUrlAsync · ensureAssetRefs 는 준비 안 된 참조만 준비한다", async () => {
    const { resolver, ensured } = fakeResolver({ [REF_A]: "blob:ready" });
    setAssetUrlResolver(resolver);
    await ensureAssetRefs({ x: [REF_A, REF_B] });
    expect(ensured).toEqual([[REF_B]]);
    expect(await resolveAssetUrlAsync(REF_B)).toBe(
      `blob:test/${REF_B.slice(-4)}`,
    );
    expect(await resolveAssetUrlAsync("https://x")).toBe("https://x");
  });

  it("dataURL 왕복 · SHA-256 · 확장자", async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const url = encodeDataUrl("image/png", bytes);
    const decoded = decodeDataUrl(url);
    expect(decoded?.mime).toBe("image/png");
    expect([...(decoded?.bytes ?? [])]).toEqual([...bytes]);
    expect(decodeDataUrl("data:image/svg+xml,%3Csvg%2F%3E")?.bytes).toEqual(
      new TextEncoder().encode("<svg/>"),
    );
    expect(decodeDataUrl("https://x")).toBeNull();
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("application/x-unknown", "a.WOFF2")).toBe("woff2");
    expect(extensionForMime("application/x-unknown")).toBe("bin");
  });

  it("같은 바이트 → 같은 참조 (내용 주소)", async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    const b = await sha256Hex(new Uint8Array([1, 2, 3]).buffer);
    expect(a).toBe(b);
    const ref: AssetRef = assetRefFromHash(a);
    expect(isAssetRef(ref)).toBe(true);
  });
});

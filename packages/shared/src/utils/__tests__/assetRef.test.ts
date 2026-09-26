import { afterEach, describe, expect, it } from "vitest";

import {
  isAssetRef,
  loadAssetUrlResolver,
  resolveAssetUrl,
  setAssetUrlResolver,
  setAssetUrlResolverLoader,
  subscribeAssetUrls,
  type AssetRef,
  type AssetUrlResolver,
} from "../assetRef";
import {
  collectAssetRefs,
  ensureAssetRefs,
  resolveAssetUrlAsync,
} from "../assetRefAsync";
import {
  hashFromRef as assetHashFromRef,
  refFromHash as assetRefFromHash,
  decodeDataUrl,
  encodeDataUrl,
  extensionForMime,
  mapAssetRefs,
  sha256Hex,
} from "../../assets/assetBytes";

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
  afterEach(() => {
    setAssetUrlResolver(null);
    setAssetUrlResolverLoader(null);
  });

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

  it("해석기는 첫 비동기 준비 때 loader 로 설치된다 (initial 밖) · 설치 전 구독도 알림을 받는다", async () => {
    const { resolver } = fakeResolver();
    let notifySubscribers: () => void = () => {};
    const withNotify: AssetUrlResolver = {
      ...resolver,
      ensure: async (refs) => {
        await resolver.ensure(refs);
        notifySubscribers();
      },
      subscribe: (listener) => {
        notifySubscribers = listener;
        return () => {};
      },
    };
    let loads = 0;
    setAssetUrlResolverLoader(async () => {
      loads += 1;
      return withNotify;
    });
    let notified = 0;
    subscribeAssetUrls(() => (notified += 1));
    await ensureAssetRefs({ nothing: "here" });
    expect(resolveAssetUrl("https://x/y.png")).toBe("https://x/y.png");
    expect(loads).toBe(0); // 참조가 없으면 불러오지 않는다
    await ensureAssetRefs([REF_A]);
    expect(loads).toBe(1);
    // 설치 알림 1 (writer 가 먼저 등록한 참조 대비) + 준비 알림 1
    expect(notified).toBe(2);
    expect(resolveAssetUrl(REF_A)).toBe(`blob:test/${REF_A.slice(-4)}`);
    expect(await loadAssetUrlResolver()).toBe(withNotify);
    expect(loads).toBe(1);
  });

  it("동기 조회 miss 는 준비를 한 번만 요청하고 (microtask 묶음) 준비되면 알린다", async () => {
    const REF_C = assetRefFromHash("c".repeat(64));
    const REF_D = assetRefFromHash("d".repeat(64));
    const { resolver, ensured } = fakeResolver();
    let notifySubscribers: () => void = () => {};
    setAssetUrlResolverLoader(async () => ({
      ...resolver,
      ensure: async (refs) => {
        await resolver.ensure(refs);
        notifySubscribers();
      },
      subscribe: (listener) => {
        notifySubscribers = listener;
        return () => {};
      },
    }));
    let notified = 0;
    subscribeAssetUrls(() => (notified += 1));
    expect(resolveAssetUrl(REF_C)).toBeNull();
    expect(resolveAssetUrl(REF_D)).toBeNull();
    expect(resolveAssetUrl(REF_C)).toBeNull(); // 같은 참조 재요청 없음
    await new Promise((r) => setTimeout(r, 0));
    expect(ensured).toEqual([[REF_C, REF_D]]);
    expect(notified).toBe(2); // 설치 알림 + 준비 알림
    expect(resolveAssetUrl(REF_C)).toBe(`blob:test/${REF_C.slice(-4)}`);
  });
});

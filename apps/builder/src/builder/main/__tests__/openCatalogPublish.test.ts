/**
 * ADR-305 Decision 6 · G4 (c) — Publish 이동 URL 은 배포 base 아래의 디렉터리 진입이다.
 * 옛 URL (origin 의 `/publish`) 은 production base `/composition/` 밖이라 정적 호스팅에서 404 였다.
 */
import { describe, expect, it } from "vitest";
import { publishEntryUrl } from "../openCatalogPublish";

describe("publishEntryUrl", () => {
  it.each([
    ["/", "http://localhost:5173", "http://localhost:5173/publish/"],
    [
      "/composition/",
      "https://example.github.io",
      "https://example.github.io/composition/publish/",
    ],
  ])("base %s → %s 아래 publish/", (base, origin, expected) => {
    const url = publishEntryUrl(base, origin);
    url.searchParams.set("project", "blob:http://x/1234-5678");
    expect(url.origin + url.pathname).toBe(expected);
    expect(url.pathname.endsWith("/")).toBe(true);
    expect(url.pathname.startsWith(base)).toBe(true);
    expect(url.searchParams.get("project")).toBe("blob:http://x/1234-5678");
  });
});

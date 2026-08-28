/**
 * ADR-134 G5 — 손으로 적은 층이 catalog SSOT 를 벗어나지 않는가.
 *
 * AI 카탈로그 본체는 파생이라 저절로 맞는다. 조용히 죽을 수 있는 것은 별칭 사전 /
 * core set / 컨테이너 목록뿐이라, 여기만 감시한다.
 */
import { describe, expect, it } from "vitest";
import { checkCatalogDrift } from "./specSync";
import { CONTAINER_TYPES, getAiCatalogEntry } from "./componentCatalog";
import { CORE_TYPES, KO_ALIASES } from "./dynamicInjection";

describe("catalog drift", () => {
  it("drift 0", () => {
    expect(checkCatalogDrift()).toEqual([]);
  });

  it("별칭·core·컨테이너가 모두 실재하는 type 을 가리킨다", () => {
    const dead = [
      ...Object.values(KO_ALIASES),
      ...CORE_TYPES,
      ...CONTAINER_TYPES,
    ].filter((type) => !getAiCatalogEntry(type));
    expect(dead).toEqual([]);
  });

  it("검사가 실제로 drift 를 잡는다 (감시 자체의 대조군)", () => {
    // 존재하지 않는 type 을 가리키는 별칭을 넣으면 반드시 걸려야 한다
    const fake = { ...KO_ALIASES, 없는것: "NoSuchComponent" };
    const dead = Object.entries(fake).filter(
      ([, type]) => !getAiCatalogEntry(type),
    );
    expect(dead).toEqual([["없는것", "NoSuchComponent"]]);
  });
});

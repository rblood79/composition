import { describe, expect, it } from "vitest";

import {
  RAC_KEYED_ITEM_TYPES,
  resolveAuthoredDomId,
} from "../outputs/domIdentity";

describe("resolveAuthoredDomId", () => {
  it("사용자가 지정한 customId 를 DOM id 로 돌려준다", () => {
    expect(resolveAuthoredDomId("Button", "button_1")).toBe("button_1");
  });

  it("customId 가 없으면 emit 하지 않는다", () => {
    expect(resolveAuthoredDomId("Button", undefined)).toBeUndefined();
    expect(resolveAuthoredDomId("Button", "")).toBeUndefined();
  });

  it("렌더러가 이미 id 를 산출했으면 덮지 않는다", () => {
    expect(resolveAuthoredDomId("Button", "button_1", "rac-id")).toBeUndefined();
  });

  it("RAC 에서 id 가 collection key 인 타입은 제외한다", () => {
    for (const type of RAC_KEYED_ITEM_TYPES) {
      expect(resolveAuthoredDomId(type, "item_1")).toBeUndefined();
    }
  });
});

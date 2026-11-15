/**
 * ADR-306 Phase 3 (Phase 2 열린 항목) — Canvas 의 family 로드가 실패하면 그 Chart 를 다시 그릴 때
 * `CHART_FAMILY_RETRY_MS` 가 지난 뒤에만 다시 로드한다 (실패마다 다시 그리고 다시 로드하는 반복은 막고,
 * 세션 안에서 영영 비지는 않는다).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  __setChartFamilyLoaderForTest,
  categoryFamilyForTest,
} from "./chartFamilyRetry.fixture";
import { CHART_FAMILY_RETRY_MS, ensureChartFamily } from "../ruleShapes";
import { getChartFamily } from "@composition/rendering";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ADR-306 — Canvas family 로드 재시도", () => {
  it("실패 직후는 다시 걸지 않고, 간격이 지나면 다시 로드한다", async () => {
    let calls = 0;
    let fail = true;
    restore = __setChartFamilyLoaderForTest("category", () => {
      calls += 1;
      return fail
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(categoryFamilyForTest());
    });
    ensureChartFamily("funnel");
    await flush();
    expect(calls).toBe(1);
    ensureChartFamily("funnel", Date.now() + 1_000);
    await flush();
    expect(calls).toBe(1);
    fail = false;
    ensureChartFamily("funnel", Date.now() + CHART_FAMILY_RETRY_MS + 1);
    await flush();
    expect(calls).toBe(2);
    expect(getChartFamily("category")).toBeDefined();
  });
});

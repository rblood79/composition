import { describe, expect, it, vi } from "vitest";
import {
  reloadIfStaleDeploy,
  type StaleDeployDeps,
} from "../staleDeployRecovery";

/**
 * ADR-244 — 옛 배포 탭의 부팅 실패는 서버 buildId 가 다를 때만 새로고침 한 번으로 복구한다.
 * 판정을 못 하면 새로고침하지 않는다 (실패 화면이 무한 새로고침보다 낫다).
 */
function deps(overrides: Partial<StaleDeployDeps> = {}) {
  const store = new Map<string, string>();
  const reload = vi.fn();
  const value: StaleDeployDeps = {
    current: "build-a",
    readServerBuildId: async () => "build-b",
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, item) => void store.set(key, item),
    },
    reload,
    ...overrides,
  };
  return { value, reload, store };
}

describe("reloadIfStaleDeploy", () => {
  it("서버 buildId 가 다르면 한 번 새로고침한다", async () => {
    const { value, reload } = deps();
    await expect(reloadIfStaleDeploy(value)).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("같은 서버 buildId 로는 두 번 새로고침하지 않는다", async () => {
    const { value, reload } = deps();
    await reloadIfStaleDeploy(value);
    await expect(reloadIfStaleDeploy(value)).resolves.toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("그 사이 다시 배포되면 (다른 서버 buildId) 한 번 더 복구한다", async () => {
    const { value, reload } = deps();
    await reloadIfStaleDeploy(value);
    await reloadIfStaleDeploy({
      ...value,
      readServerBuildId: async () => "build-c",
    });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("buildId 가 같으면 배포 문제가 아니다", async () => {
    const { value, reload } = deps({
      readServerBuildId: async () => "build-a",
    });
    await expect(reloadIfStaleDeploy(value)).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  const undecidable: [string, Partial<StaleDeployDeps>][] = [
    [
      "probe 실패",
      { readServerBuildId: () => Promise.reject(new Error("offline")) },
    ],
    ["version.json 없음", { readServerBuildId: () => Promise.resolve(null) }],
    ["dev 번들", { current: "dev" }],
    ["빈 buildId", { current: "" }],
  ];
  it.each(undecidable)("%s 이면 새로고침하지 않는다", async (_, overrides) => {
    const { value, reload } = deps(overrides);
    await expect(reloadIfStaleDeploy(value)).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("표식을 남길 수 없으면 (storage 불가) 반복을 막을 수 없어 새로고침하지 않는다", async () => {
    const { value, reload } = deps({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("SecurityError");
        },
      },
    });
    await expect(reloadIfStaleDeploy(value)).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

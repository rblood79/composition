import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAuth,
  getCurrentUserId,
  LICENSE_ATTEMPT_POLICY,
  LOCAL_AUTH_STORAGE_KEY,
  lockoutRemainingMs,
  readValidAuth,
  recordFailedAttempt,
  saveAuth,
} from "../localAuth";
import type { LicensePayload } from "../licenseToken";

const payload: LicensePayload = {
  products: "Composition",
  project: "alice",
  client_os: "Cross-Platform",
  license: "Web Version",
  dev_count: "1EA",
  period: "Unlimited",
  license_key: "AAAAA-BBBBB-CCCCC-UNLMT-DDDDD",
  iat: 1_700_000_000,
  vc: { v: 1, kdf: "PBKDF2-SHA256", iter: 600000, salt: "s", iv: "i", ct: "c" },
};

beforeEach(() => {
  localStorage.clear();
});

describe("localAuth", () => {
  it("saveAuth 는 vc 를 빼고 저장, readValidAuth 가 그대로 돌려준다", () => {
    const saved = saveAuth(payload, 1_000);
    expect(saved.expiresAt).toBeNull();
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY)!;
    expect(raw).not.toContain('"vc"');
    expect(readValidAuth(2_000)).toEqual(saved);
    expect(getCurrentUserId()).toBe(payload.license_key);
  });

  it("exp 가 있으면 expiresAt = exp*1000, 지나면 null + 삭제", () => {
    saveAuth({ ...payload, exp: 10 }, 1_000);
    expect(readValidAuth(9_999)?.expiresAt).toBe(10_000);
    expect(readValidAuth(10_001)).toBeNull();
    expect(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("손상된 기록은 null + 삭제", () => {
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, "{not json");
    expect(readValidAuth()).toBeNull();
    localStorage.setItem(
      LOCAL_AUTH_STORAGE_KEY,
      JSON.stringify({ issuedAt: 1 }),
    );
    expect(readValidAuth()).toBeNull();
    expect(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("clearAuth 후 getCurrentUserId 는 throw", () => {
    saveAuth(payload);
    clearAuth();
    expect(readValidAuth()).toBeNull();
    expect(() => getCurrentUserId()).toThrow();
  });

  it("실패 N회 → 잠금, 시간 지나면 해제", () => {
    const { maxFailedAttempts, lockoutMs } = LICENSE_ATTEMPT_POLICY;
    for (let i = 1; i < maxFailedAttempts; i++) {
      expect(recordFailedAttempt(1_000)).toBe(0);
    }
    expect(recordFailedAttempt(1_000)).toBe(lockoutMs);
    expect(lockoutRemainingMs(1_000 + lockoutMs / 2)).toBe(lockoutMs / 2);
    expect(lockoutRemainingMs(1_000 + lockoutMs)).toBe(0);
    // 해제 후 카운터 초기화
    expect(recordFailedAttempt(5_000)).toBe(0);
  });
});

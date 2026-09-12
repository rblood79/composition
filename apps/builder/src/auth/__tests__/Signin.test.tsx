// @vitest-environment jsdom
/**
 * 라이선스 활성화 화면 — 서버 루트 `license` 자동 읽기 + 코드 입력 → 로컬 인증 기록 + /dashboard.
 * 토큰은 발급기 fixture (실제 ES256 서명) 를 쓴다.
 */
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../license/__tests__/fixtures/license.fixture.json";
import { LOCAL_AUTH_STORAGE_KEY, readValidAuth } from "../license/localAuth";

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import Signin from "../Signin";

describe("Signin (라이선스 활성화)", () => {
  const fetchLicense = (token: string | null) =>
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.endsWith("/license") || token === null) {
        return { ok: false, text: async () => "" };
      }
      return { ok: true, text: async () => token };
    });

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    // useBuilderChromeTheme (auto 모드) — jsdom 에는 matchMedia 가 없다
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubEnv("VITE_LICENSE_PUBLIC_KEY", fixture.publicPem);
    vi.stubGlobal("fetch", fetchLicense(fixture.token));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function submitCode(value: string) {
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });
    const submit = screen.getByRole("button", { name: "submit" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
  }

  it("서버 license + 올바른 코드 → 인증 기록 저장 + /dashboard", async () => {
    render(<Signin />);
    await submitCode(fixture.code);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
    const auth = readValidAuth();
    expect(auth?.license.license_key).toBe(fixture.licenseKey);
    expect(auth?.expiresAt).toBeNull();
    expect(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY)).not.toContain('"vc"');
  });

  it("6칸은 input 값을 비춘다 (input 하나 · 칸은 aria-hidden)", async () => {
    render(<Signin />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123" } });
    const cells = document.querySelectorAll(".auth-code-cell");
    expect(cells.length).toBe(6);
    expect(Array.from(cells, (c) => c.textContent)).toEqual(["1", "2", "3", "", "", ""]);
    expect(document.querySelectorAll(".auth-code-cell[data-filled]").length).toBe(3);
    expect(screen.getAllByRole("textbox").length).toBe(1);
  });

  it("틀린 코드 → 오류 문구, 기록 없음", async () => {
    render(<Signin />);
    await submitCode("000000");
    await screen.findByText("errorCode");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(readValidAuth()).toBeNull();
  });

  it("서버 license 없음 (404 · index.html 폴백) → 안내 + 제출 불가, 파일 선택 없음", async () => {
    vi.stubGlobal("fetch", fetchLicense(null));
    render(<Signin />);
    await screen.findByText("licenseFileNone");
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector(".auth-license-source")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: fixture.code },
    });
    expect(
      (screen.getByRole("button", { name: "submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("Vite dev 가 index.html 을 돌려줘도 라이선스로 오인하지 않는다", async () => {
    vi.stubGlobal("fetch", fetchLicense("<!doctype html><html></html>"));
    render(<Signin />);
    await screen.findByText("licenseFileNone");
  });

  it("override 공개키가 손상이면 설정 오류 + 제출 불가", async () => {
    vi.stubEnv("VITE_LICENSE_PUBLIC_KEY", "not-a-key");
    render(<Signin />);
    await screen.findByText("errorPublicKeyMissing");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: fixture.code },
    });
    expect(
      (screen.getByRole("button", { name: "submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

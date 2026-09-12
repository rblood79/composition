// @vitest-environment jsdom
/**
 * 라이선스 활성화 화면 — 파일 선택 + 코드 입력 → 로컬 인증 기록 + /dashboard.
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

function pickFile(text: string, name = "token.jwt") {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File([text], name, { type: "text/plain" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("Signin (라이선스 활성화)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    vi.stubEnv("VITE_LICENSE_PUBLIC_KEY", fixture.publicPem);
    // 서버 루트 license.jwt 없음 → 파일 선택 경로
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, text: async () => "" })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("파일 + 올바른 코드 → 인증 기록 저장 + /dashboard", async () => {
    render(<Signin />);
    await screen.findByText("licenseFileNone");
    pickFile(fixture.token);
    await screen.findByText("token.jwt");

    const code = screen.getByRole("textbox");
    fireEvent.change(code, { target: { value: fixture.code } });
    const submit = screen.getByRole("button", { name: "submit" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
    const auth = readValidAuth();
    expect(auth?.license.license_key).toBe(fixture.licenseKey);
    expect(auth?.expiresAt).toBeNull();
    expect(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY)).not.toContain('"vc"');
  });

  it("틀린 코드 → 오류 문구, 기록 없음", async () => {
    render(<Signin />);
    await screen.findByText("licenseFileNone");
    pickFile(fixture.token);
    await screen.findByText("token.jwt");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "000000" },
    });
    const submit = screen.getByRole("button", { name: "submit" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await screen.findByText("errorCode");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(readValidAuth()).toBeNull();
  });

  it("JWT 형태가 아닌 파일은 거부", async () => {
    render(<Signin />);
    await screen.findByText("licenseFileNone");
    pickFile("hello world", "notes.txt");
    await screen.findByText("licenseFileInvalid");
    expect(
      (screen.getByRole("button", { name: "submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("서버 루트 license.jwt 가 있으면 자동 입력", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => fixture.token })),
    );
    render(<Signin />);
    await screen.findByText("licenseFileDeployed");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: fixture.code },
    });
    const submit = screen.getByRole("button", { name: "submit" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard"),
    );
  });

  it("공개키 미설정이면 설정 오류 + 제출 불가", async () => {
    vi.stubEnv("VITE_LICENSE_PUBLIC_KEY", "");
    render(<Signin />);
    await screen.findByRole("alert");
    pickFile(fixture.token);
    await screen.findByText("token.jwt");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: fixture.code },
    });
    expect(
      (screen.getByRole("button", { name: "submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

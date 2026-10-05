import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsEditor } from "../DataTableEditor";

/**
 * 2026-10-05 감사 LOW — 설정 화면이 열린 채 테이블 이름이 밖에서 바뀌면 (undo · 목록에서 rename)
 * 이름 칸이 새 이름을 보이고, blur 가 옛 이름을 다시 쓰지 않는다. 간격 칸도 같다.
 */
afterEach(cleanup);

const props = (name: string, intervalSec = 30) => ({
  name,
  useMockData: false,
  executionPolicy: { mode: "interval" as const, intervalSec },
  endpoints: [],
  linkedEndpointId: "",
  onNameChange: vi.fn(),
  onUseMockDataChange: vi.fn(),
  onEndpointChange: vi.fn(),
  onPolicyChange: vi.fn(),
});

describe("SettingsEditor — 밖에서 바뀐 값", () => {
  it("이름이 밖에서 바뀌면 칸이 따라가고 blur 가 옛 이름을 쓰지 않는다", () => {
    const first = props("users");
    const { rerender } = render(<SettingsEditor {...first} />);
    const next = { ...props("members"), onNameChange: first.onNameChange };
    rerender(<SettingsEditor {...next} />);
    const input = screen.getByRole("textbox", { name: "Table Name" });
    expect((input as HTMLInputElement).value).toBe("members");
    fireEvent.blur(input);
    expect(first.onNameChange).not.toHaveBeenCalled();
  });

  it("간격이 밖에서 바뀌면 칸이 따라간다", () => {
    const { rerender } = render(<SettingsEditor {...props("t", 30)} />);
    rerender(<SettingsEditor {...props("t", 90)} />);
    expect(
      (screen.getByRole("spinbutton") as HTMLInputElement).value,
    ).toBe("90");
  });
});

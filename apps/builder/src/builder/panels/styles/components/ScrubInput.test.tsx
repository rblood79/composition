import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrubInput } from "./ScrubInput";

afterEach(cleanup);

/** store preview 경로처럼 onScrub 값이 곧바로 value prop 으로 되돌아오는 호출측 */
function Host({
  onScrub,
  onCommit,
}: {
  onScrub: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [value, setValue] = useState(4);
  return (
    <ScrubInput
      value={value}
      min={0}
      max={200}
      suffix="px"
      label="Blur radius"
      onScrub={(v) => {
        onScrub(v);
        setValue(v);
      }}
      onCommit={(v) => {
        onCommit(v);
        setValue(v);
      }}
    />
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ScrubInput 드래그 — onScrub 이 value prop 을 되돌려도 드래그가 이어진다", () => {
  it("pointermove 마다 onScrub, pointerup 에 onCommit 한 번 · 클릭 편집 모드로 새지 않음", async () => {
    const onScrub = vi.fn();
    const onCommit = vi.fn();
    render(<Host onScrub={onScrub} onCommit={onCommit} />);
    await flush();
    const el = screen
      .getByLabelText("Blur radius")
      .closest(".scrub-input") as HTMLElement;
    fireEvent.pointerDown(el, { button: 0, clientX: 100 });
    fireEvent.pointerMove(document, { clientX: 110 });
    await flush();
    expect(onScrub).toHaveBeenLastCalledWith(14);
    fireEvent.pointerMove(document, { clientX: 120 });
    await flush();
    expect(onScrub).toHaveBeenLastCalledWith(24);
    fireEvent.pointerMove(document, { clientX: 130 });
    await flush();
    expect(onScrub).toHaveBeenLastCalledWith(34);
    fireEvent.pointerUp(document);
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(34);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByLabelText("Blur radius").textContent).toBe("34");
  });
});

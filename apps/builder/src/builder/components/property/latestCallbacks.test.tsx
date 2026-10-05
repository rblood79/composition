// @vitest-environment jsdom
/**
 * Property 컨트롤의 memo 비교는 콜백 prop 을 보지 않는다 — 값이 그대로면 다시 렌더되지 않는다.
 * 그래도 사용자 입력은 **가장 최근 렌더의 콜백**으로 가야 한다. 옛 콜백이 불리면 호출처가
 * 렌더 시점에 잡은 상태로 배열 전체를 다시 써서 그 사이의 편집을 되돌린다 (2026-10-05 감사 H1 —
 * 인터랙션 규칙 · Chart 시리즈 · 다중 선택 Properties).
 */
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyInput } from "./PropertyInput";
import { PropertySelect } from "./PropertySelect";
import { PropertySwitch } from "./PropertySwitch";
import { PropertyUnitInput } from "./PropertyUnitInput";
import { withLatestCallbacks } from "./latestCallbacks";

afterEach(cleanup);

describe("Property 컨트롤 — 값이 같은 렌더에서도 최신 콜백 호출", () => {
  it("PropertyInput blur 는 최신 onChange 로 저장한다", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const { container, rerender } = render(
      <PropertyInput label="Name" value="a" onChange={stale} />,
    );
    rerender(<PropertyInput label="Name" value="a" onChange={latest} />);
    const input = container.querySelector("input")!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "b" } });
    fireEvent.blur(input);
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith("b");
  });

  it("PropertySelect 선택은 최신 onChange 로 보낸다", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const options = [
      { value: "start", label: "Start" },
      { value: "end", label: "End" },
    ];
    const ui = render(
      <PropertySelect
        label="Align"
        value="start"
        onChange={stale}
        options={options}
        translateOptions={false}
      />,
    );
    ui.rerender(
      <PropertySelect
        label="Align"
        value="start"
        onChange={latest}
        options={options}
        translateOptions={false}
      />,
    );
    fireEvent.click(
      within(ui.getByRole("group", { name: "Align" })).getByRole("button"),
    );
    fireEvent.click(ui.getByRole("option", { name: "End" }));
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith("end");
  });

  it("PropertySwitch 토글은 최신 onChange 로 보낸다", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const ui = render(
      <PropertySwitch label="Visible" isSelected={false} onChange={stale} />,
    );
    ui.rerender(
      <PropertySwitch label="Visible" isSelected={false} onChange={latest} />,
    );
    fireEvent.click(ui.getByRole("switch"));
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(true);
  });

  it("PropertyUnitInput Enter 는 최신 onChange 로 저장한다", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const ui = render(
      <PropertyUnitInput label="Width" value="10px" onChange={stale} />,
    );
    ui.rerender(
      <PropertyUnitInput label="Width" value="10px" onChange={latest} />,
    );
    const input = ui.container.querySelector("input")!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalled();
  });
});

describe("withLatestCallbacks", () => {
  it("콜백 prop 은 렌더마다 같은 proxy 로 넘기고, 없으면 undefined 를 넘긴다", () => {
    const seen: unknown[] = [];
    function Inner(props: { onPick?: () => void; label: string }) {
      seen.push(props.onPick);
      return <span>{props.label}</span>;
    }
    const Wrapped = withLatestCallbacks(Inner, ["onPick"]);
    const ui = render(<Wrapped label="x" onPick={() => {}} />);
    ui.rerender(<Wrapped label="y" onPick={() => {}} />);
    ui.rerender(<Wrapped label="z" />);
    expect(typeof seen[0]).toBe("function");
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBeUndefined();
  });
});

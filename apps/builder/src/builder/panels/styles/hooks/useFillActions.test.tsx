// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { openStylesFixture } from "../__tests__/support/catalogStylesFixture";
import { useFillActions } from "./useFillActions";
import { useFillValues, useFillUIStore } from "./useFillValues";

describe("useFillActions", () => {
  beforeEach(() => {
    useFillUIStore.setState({
      activeFillIndex: 0,
      colorInputMode: "hex",
    });
  });

  it("backgroundColor 만 있는 요소도 synthetic fill 로 canonicalize 해서 편집할 수 있다", async () => {
    const fixture = await openStylesFixture(
      [{ id: "box", style: { backgroundColor: "#112233" } }],
      { select: "box" },
    );
    const { result } = renderHook(
      () => ({ values: useFillValues(), actions: useFillActions() }),
      { wrapper: fixture.wrapper },
    );

    expect(result.current.values.fills).toHaveLength(1);

    act(() => {
      result.current.actions.updateFill(result.current.values.fills[0]!.id, {
        color: "#445566FF",
      });
    });

    const fills = fixture.host.readFills();
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({ type: "color", color: "#445566FF" });
    expect(fixture.styleOf("box").backgroundColor).toBeUndefined();
  });
});

// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createDefaultColorFill,
  FillType,
} from "../../../../types/builder/fill.types";
import {
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";
import { useFillActions } from "./useFillActions";

/**
 * ADR-248 4e-9 C: the Fill actions build on the fills the panel shows — the selected record's own
 * layers, or an instance position's resolved layers (its component's) — over the catalog Styles
 * host. (The old store's canonical-vs-legacy precedence cases went with the old store.)
 */
const COLOR = createDefaultColorFill("#112233FF");

function actionsOf(fixture: StylesFixture) {
  return renderHook(() => useFillActions(), { wrapper: fixture.wrapper })
    .result;
}

describe("useFillActions — 표시·액션 동일 소스", () => {
  it("addFill 베이스는 선택 요소의 현재 fills 다", async () => {
    const fixture = await openStylesFixture([{ id: "el-1", fills: [COLOR] }], {
      select: "el-1",
    });
    const result = actionsOf(fixture);

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    const committed = fixture.host.readFills();
    // 기존 fill 이 베이스로 보존되고 그 위에 append 된다.
    expect(committed).toHaveLength(2);
    expect(committed[0]).toEqual(COLOR);
    expect(committed[1]!.type).toBe(FillType.LinearGradient);
  });

  it("ensureColorFill 은 color fill 이 이미 있으면 갱신만 한다 (중복 append 차단)", async () => {
    const fixture = await openStylesFixture([{ id: "el-1", fills: [COLOR] }], {
      select: "el-1",
    });
    const result = actionsOf(fixture);

    act(() => {
      result.current.ensureColorFill("#FF0000FF");
    });

    const committed = fixture.host.readFills();
    expect(committed).toHaveLength(1);
    expect(committed[0]).toEqual({ ...COLOR, color: "#FF0000FF" });
  });

  it("ensureColorFill 은 color fill 이 없으면 1건 생성한다", async () => {
    const fixture = await openStylesFixture([{ id: "el-1" }], {
      select: "el-1",
    });
    const result = actionsOf(fixture);

    act(() => {
      result.current.ensureColorFill("#FF0000FF");
    });

    const committed = fixture.host.readFills();
    expect(committed).toHaveLength(1);
    expect(committed[0]!.type).toBe(FillType.Color);
  });
});

describe("useFillActions — instance 안 자식", () => {
  it("현재 fills 를 해석 노드 (component 의 layer) 에서 읽는다 — 표시와 같은 소스", async () => {
    const fixture = await openStylesFixture([
      { id: "form" },
      { id: "field-1", type: "TextField", parent: "form", fills: [COLOR] },
    ]);
    const instance = fixture.componentize("form", "Form");
    const child = fixture.workspace.root.domInputs.get(instance)!.children[0]!;
    fixture.workspace.selectRecords([child]);
    const result = actionsOf(fixture);

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    // 빈 베이스로 저장하면 component 의 fill 을 지운다.
    const committed = fixture.host.readFills();
    expect(committed).toHaveLength(2);
    expect(committed[0]).toEqual(COLOR);
  });
});

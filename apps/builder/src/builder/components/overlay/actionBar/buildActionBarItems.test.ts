import { afterEach, describe, expect, it, vi } from "vitest";
import { registerContextMenuProvider } from "../contextMenu/buildContextMenuItems";
import type { ContextMenuItem } from "../contextMenu/types";
import {
  buildActionBarItems,
  buildActionBarRequest,
} from "./buildActionBarItems";

const noop = () => undefined;
const action = (id: string): ContextMenuItem => ({
  kind: "action",
  id,
  label: id,
  run: noop,
});

describe("buildActionBarItems — 182 레지스트리 재사용", () => {
  const unregisters: Array<() => void> = [];
  afterEach(() => {
    unregisters.splice(0).forEach((unregister) => unregister());
  });

  it("선택 0 → null, provider 호출 없음", () => {
    const provider = vi.fn(() => [action("duplicate")]);
    unregisters.push(registerContextMenuProvider("canvas-element", provider));
    expect(buildActionBarItems([])).toBeNull();
    expect(provider).not.toHaveBeenCalled();
  });

  it("surface canvas-element 로 선택 집합을 넘기고 정책을 적용한다", () => {
    const provider = vi.fn(() => [
      action("copy"),
      action("duplicate"),
      action("group"),
      action("delete"),
    ]);
    unregisters.push(registerContextMenuProvider("canvas-element", provider));

    const model = buildActionBarItems(["a", "b"]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(
      buildActionBarRequest(["a", "b"]),
      {},
    );
    expect(model?.context).toBe("single");
    expect(model?.items.map((item) => item.id)).toEqual(["duplicate"]);
  });

  it("provider 미등록 (캔버스 없음) → null", () => {
    expect(buildActionBarItems(["a"])).toBeNull();
  });

  it("modeOverride 훅은 182 와 같은 자리에서 항목을 교체한다", () => {
    unregisters.push(
      registerContextMenuProvider("canvas-element", () => [action("group")]),
    );
    const model = buildActionBarItems(["a"], {
      modeOverride: () => [action("duplicate"), action("group")],
    });
    expect(model?.items.map((item) => item.id)).toEqual(["duplicate"]);
  });

  it("request 는 호출자 배열을 복사한다 (provider 가 변형해도 선택 불변)", () => {
    const source = ["a"];
    const request = buildActionBarRequest(source);
    request.targetElementIds.push("b");
    expect(source).toEqual(["a"]);
  });
});

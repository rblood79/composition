import { describe, expect, it, vi } from "vitest";
import { resolveCapabilities, resolveTriggers } from "../capabilityRegistry";
import { executeInteractionRule, type DispatchDeps } from "../dispatcher";
import type { InteractionRule } from "../interactionRule.types";

/**
 * ADR-280 Phase 0 (G0) — dispatcher-level reproductions (breakdown §1b RED 3 · 4). `it.fails`
 * states the behavior Phase 1 · 2 must reach; it turns into a failing test once that lands.
 * The Preview-path reproductions are `apps/builder/src/preview/catalog/__tests__/adr280Phase0.test.tsx`.
 */
function depsFor(type: string, props: Record<string, unknown>) {
  const updateElementProps = vi.fn();
  const deps: DispatchDeps = {
    getElement: (id) => (id === "target" ? { type, props } : undefined),
    updateElementProps,
    navigate: vi.fn(),
    showToast: vi.fn(),
  };
  return { deps, updateElementProps };
}

const capability = (name: string, value?: unknown): InteractionRule => ({
  id: "rule",
  type: "interaction",
  elementId: "button",
  trigger: "onPress",
  action: {
    kind: "capability",
    targetId: "target",
    capability: name,
    ...(value !== undefined ? { params: { value } } : {}),
  },
});

describe("ADR-280 Phase 0 — RED 3: the open concept sits on the overlay body, not its trigger", () => {
  // (Phase 1 — the open concept's When is derived on the MenuTrigger: fixed, `it`.)
  it("a MenuTrigger offers onOpenChange as a When", () => {
    expect(resolveTriggers("MenuTrigger")).toContain("onOpenChange");
  });

  it("a MenuTrigger offers open / close as a Do", () => {
    expect(Object.keys(resolveCapabilities("MenuTrigger"))).toEqual(
      expect.arrayContaining(["open", "close"]),
    );
  });

  it("today: a rule opening a Menu node fails as an unregistered capability", () => {
    const { deps, updateElementProps } = depsFor("Menu", {});
    expect(executeInteractionRule(capability("open"), deps)).toEqual({
      ok: false,
      reason: "capability 미등재: Menu.open",
    });
    expect(updateElementProps).not.toHaveBeenCalled();
  });
});

// (Phase 2 — fixed: each `it.fails` became `it`.)
describe("ADR-280 Phase 0 — RED 4: a capability write ignores RAC's constraints", () => {
  it("(a) a disabled Checkbox is not checked", () => {
    const { deps, updateElementProps } = depsFor("Checkbox", {
      isDisabled: true,
      isSelected: false,
    });
    expect(executeInteractionRule(capability("check"), deps).ok).toBe(false);
    expect(updateElementProps).not.toHaveBeenCalled();
  });

  it("(d) disallowEmptySelection keeps a ListBox's last selection", () => {
    const { deps, updateElementProps } = depsFor("ListBox", {
      selectionMode: "multiple",
      disallowEmptySelection: true,
      selectedKeys: ["inbox"],
    });
    expect(executeInteractionRule(capability("clearSelection"), deps).ok).toBe(
      false,
    );
    expect(updateElementProps).not.toHaveBeenCalled();
  });

  it("(e) a disabled key is not selected", () => {
    const { deps, updateElementProps } = depsFor("ListBox", {
      selectionMode: "single",
      disabledKeys: ["archive"],
    });
    expect(
      executeInteractionRule(capability("selectItem", "archive"), deps).ok,
    ).toBe(false);
    expect(updateElementProps).not.toHaveBeenCalled();
  });

  it("(f) selectItem adds to a multiple selection instead of replacing it", () => {
    const { deps, updateElementProps } = depsFor("ListBox", {
      selectionMode: "multiple",
      selectedKeys: ["inbox"],
    });
    executeInteractionRule(capability("selectItem", "starred"), deps);
    expect(updateElementProps).toHaveBeenCalledWith("target", {
      selectedKeys: ["inbox", "starred"],
    });
  });
});

describe("ADR-280 Phase 0 — RED 5: Form imperative capabilities always fail", () => {
  it("today: submit / reset return 'imperative capability 미지원'", () => {
    const { deps } = depsFor("Form", {});
    for (const name of ["submit", "reset"])
      expect(executeInteractionRule(capability(name), deps)).toEqual({
        ok: false,
        reason: `imperative capability 미지원: Form.${name}`,
      });
  });
});

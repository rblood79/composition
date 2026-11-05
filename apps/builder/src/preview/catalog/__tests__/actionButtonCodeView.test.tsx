import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTriggers } from "../../../../../../packages/shared/src/interactions/capabilityRegistry";
import { openAdr296 } from "./support/adr296Harness";

afterEach(() => vi.restoreAllMocks());

describe("ActionButton family Code and Events", () => {
  it("registers Press only on the button and exports real shared imports", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const button = h.add("ActionButton", { label: "Copy" });
    h.add("ActionButtonGroup");
    h.rules(button, [
      { trigger: "onPress", actions: [{ opcode: "toast", message: "Copied" }] },
    ]);
    const code = h.code();
    expect(code).toContain("from '@composition/shared/components'");
    expect(code).toContain("<ActionButton");
    expect(code).toContain("<ActionButtonGroup");
    expect(code).toContain("onPress=");
    expect(code).not.toMatch(
      /import[^\n]*ActionButton[^\n]*from 'react-aria-components'/,
    );
    expect(h.apply(code).rejected).toEqual([]);
    expect(
      h.apply(code.replace("title: 'Copied'", "title: 'Done'")).rejected,
    ).toEqual([]);
    expect(h.rulesOf(button)[0]!.actions).toEqual([
      { opcode: "toast", message: "Done" },
    ]);
    expect(resolveTriggers("ActionButton")).toContain("onPress");
    expect(resolveTriggers("ActionButtonGroup")).toEqual([]);
    h.workspace.dispose();
  });

  it("applies props and keeps identity through Undo", async () => {
    const h = await openAdr296();
    const button = h.add("ActionButton", { label: "Copy", isQuiet: false });
    const group = h.add("ActionButtonGroup", { density: "regular" });
    const before = h.code();
    const result = h.apply(
      before
        .replace('density="regular"', 'density="compact"')
        .replace("isQuiet={false}", "isQuiet={true}"),
    );
    expect(result.rejected).toEqual([]);
    expect(h.code()).toContain('density="compact"');
    expect(h.node(button).id).toBe(button);
    expect(h.node(group).id).toBe(group);
    h.workspace.undo();
    expect(h.code()).toBe(before);
    h.workspace.dispose();
  });

  it("adds an ActionButton to the group through Code and undoes it atomically", async () => {
    const h = await openAdr296();
    const group = h.add("ActionButtonGroup");
    const before = h.code();
    const edited = before.replace(
      "</ActionButtonGroup>",
      '<ActionButton label="Archive" icon="archive" />\n</ActionButtonGroup>',
    );
    expect(edited).not.toBe(before);
    expect(h.apply(edited).rejected).toEqual([]);
    expect(h.code()).toContain('label="Archive"');
    expect(h.node(group).id).toBe(group);
    h.workspace.undo();
    expect(h.code()).toBe(before);
    h.workspace.dispose();
  });
});

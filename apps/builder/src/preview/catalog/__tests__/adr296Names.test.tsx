import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { BODY, openAdr296 } from "./support/adr296Harness";

/**
 * ADR-296 Phase 1 판독 MEDIUM-1 — a named handler's name is a position (`onButtonPress2` · `keep('do-2')`
 * · the node's code name): an edit that removes a rule, or adds an element before, numbers the names
 * again. The check compares a read · unchanged handler by its rules, not its name — these edits apply.
 */
afterEach(() => vi.restoreAllMocks());

async function threeRules() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  const button = h.add("Button");
  const ids = h.rules(button, [
    { trigger: "onPress", actions: [{ opcode: "toast", message: "one" }] },
    { trigger: "onPress", actions: [{ opcode: "toast", message: "two" }] },
    { trigger: "onPress", actions: [{ opcode: "toast", message: "three" }] },
  ]);
  return { h, button, ids };
}
const removeFn = (code: string, name: string) =>
  code
    .replace(
      new RegExp(` {2}function ${name}\\(\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`),
      "",
    )
    .replace(` ${name}();`, "");

describe("ADR-296 — handler names are positions, not identity", () => {
  it("the middle rule removed (its function and its call) — the others keep their ids", async () => {
    const { h, button, ids } = await threeRules();
    const result = h.apply(removeFn(h.code(), "onButtonPress2"));
    expect(result.rejected).toEqual([]);
    expect(h.rulesOf(button).map((rule) => [rule.id, rule.actions[0]])).toEqual(
      [
        [ids[0], { opcode: "toast", message: "one" }],
        [ids[2], { opcode: "toast", message: "three" }],
      ],
    );
  });

  it("two rules down to one — the named form left as written applies", async () => {
    const { h, button, ids } = await threeRules();
    const once = removeFn(
      removeFn(h.code(), "onButtonPress3"),
      "onButtonPress2",
    );
    const result = h.apply(once);
    expect(result.rejected).toEqual([]);
    expect(h.rulesOf(button).map((rule) => rule.id)).toEqual([ids[0]]);
  });

  it("an element added before a button with named handlers — its handlers stay", async () => {
    const { h, button } = await threeRules();
    const code = h.code();
    const result = h.apply(
      code.replace("      <Button", "      <Button />\n      <Button"),
    );
    expect(result.rejected).toEqual([]);
    expect(h.node(BODY).children).toHaveLength(2);
    expect(h.rulesOf(button)).toHaveLength(3);
  });

  it("a kept Do before another: removing the first keeps the second (its token numbered again)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const a = h.add("Button");
    const b = h.add("Button");
    const unset = {
      opcode: "capability" as const,
      target: { unset: true as const },
      capabilityId: "hide",
    };
    h.rules(a, [
      {
        trigger: "onPress",
        actions: [unset, { opcode: "toast", message: "a" }],
      },
    ]);
    h.rules(b, [
      { trigger: "onPress", actions: [{ opcode: "toast", message: "b" }] },
    ]);
    const result = h.apply(h.code().replace("'a'", "'aa'"));
    expect(result.rejected).toEqual([]);
    expect(h.rulesOf(a)[0]!.actions).toEqual([
      unset,
      { opcode: "toast", message: "aa" },
    ]);
    void (b as NodeId);
  });
});

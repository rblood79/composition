import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RichText } from "../../../../../../../../packages/shared/src/catalog/document/types";
import { getTextEditorHandle } from "../../../../catalogRuntime/textEditorHandle";
import EditorField from "./EditorField";

/**
 * The Typography panel asks `marks()` twice a render on every PM transaction: equal values come
 * back as the same object (its memo holds), and a token's value is read on every call — a theme
 * change during the edit shows at once, with no transaction and no re-render of the field
 * (code review 2026-11-04 of `6aac5a44e`: the cache keyed on the `markCss` function went stale).
 */
describe("EditorField marks()", () => {
  it("keeps equal values as one object and reads token values on every call", () => {
    const theme = { mode: "light" };
    const initial: RichText = {
      kind: "text",
      runs: [{ text: "Hi", marks: { color: "{color.accent}" } }],
    };
    render(
      <EditorField
        identity="t"
        initial={initial}
        rich
        nodeValues={{}}
        markCss={(key, value) =>
          key === "color" && value === "{color.accent}"
            ? theme.mode === "light"
              ? "#0000ff"
              : "#8888ff"
            : undefined
        }
        className=""
        style={{}}
        onChange={() => undefined}
        onCommit={() => undefined}
        onMount={() => undefined}
      />,
    );
    const handle = getTextEditorHandle()!;
    const first = handle.marks();
    expect(first.color).toBe("#0000ff");
    expect(handle.marks()).toBe(first);
    theme.mode = "dark";
    expect(handle.marks().color).toBe("#8888ff");
  });
});

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORE_STYLES_HOST, StylesHostContext } from "../stylesHost";
import { useFillUIStore } from "../hooks/useFillValues";
import { ColorInputFields } from "./ColorInputFields";
import { ImageFillEditor } from "./ImageFillEditor";
import { ScrubInput } from "./ScrubInput";

afterEach(cleanup);

/**
 * ADR-248 4e: a typed value commits on blur when the host's selection is still the one the field
 * was focused on — the host's (the catalog session's), not the old store's (always empty there).
 */
function withHost(selected: { id: string }, children: React.ReactNode) {
  return (
    <StylesHostContext.Provider
      value={{
        ...STORE_STYLES_HOST,
        useSelectedId: () => "a",
        readSelectedId: () => selected.id,
      }}
    >
      {children}
    </StylesHostContext.Provider>
  );
}

async function typeInto(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    fireEvent.blur(input);
  });
}

describe("Styles typed input commits against the host's selection", () => {
  it("ScrubInput: same selection commits; another selection drops the value", async () => {
    const onCommit = vi.fn();
    const selected = { id: "a" };
    render(
      withHost(
        selected,
        <ScrubInput value={4} onCommit={onCommit} label="Opacity" />,
      ),
    );
    const open = () => {
      const scrub = screen
        .getByLabelText("Opacity")
        .closest(".scrub-input") as HTMLElement;
      fireEvent.pointerDown(scrub, { button: 0, clientX: 10 });
      fireEvent.pointerUp(document, { clientX: 10 });
    };
    act(open);
    await typeInto(screen.getByLabelText("Opacity"), "12");
    expect(onCommit).toHaveBeenCalledWith(12);
    selected.id = "b";
    act(open);
    await typeInto(screen.getByLabelText("Opacity"), "30");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("ColorInputFields text field: same selection commits", async () => {
    useFillUIStore.setState({ colorInputMode: "css" });
    const onChange = vi.fn();
    render(
      withHost(
        { id: "a" },
        <ColorInputFields value="#112233" onChange={onChange} />,
      ),
    );
    const hex = screen.getAllByRole("textbox")[0]!;
    await typeInto(hex, "#445566");
    expect(onChange).toHaveBeenCalled();
  });

  it("ImageFillEditor URL: same selection commits; another selection drops it", async () => {
    const onUpdateEnd = vi.fn();
    const selected = { id: "a" };
    render(
      withHost(
        selected,
        <ImageFillEditor
          fill={{ id: "f1", type: "image", url: "", enabled: true, opacity: 100, blendMode: "normal", mode: "fill" } as never}
          onUpdate={() => {}}
          onUpdateEnd={onUpdateEnd}
        />,
      ),
    );
    const url = screen.getByLabelText("Image URL");
    await typeInto(url, "https://example.test/a.png");
    expect(onUpdateEnd).toHaveBeenCalledWith({
      url: "https://example.test/a.png",
    });
    selected.id = "b";
    await typeInto(url, "https://example.test/b.png");
    expect(onUpdateEnd).toHaveBeenCalledTimes(1);
  });
});

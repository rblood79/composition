import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A running Preview controls both the ComboBox's `selectedKey` and its `inputValue` (ADR-280), and
 * RAC then leaves the input text to the selection's writer (the reference's "Fully controlled"):
 * picking an item shows its text, a blur puts the selected item's text back — unless
 * `allowsCustomValue`, where RAC commits the typed text and clears the selection. A picked item
 * leaves the list closed. Measurement:
 * jsdom, the palette ComboBox (Aardvark · Cat · Dog · Kangaroo).
 */
afterEach(() => {
  vi.restoreAllMocks();
});


const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function comboBoxPreview(allowsCustomValue: boolean) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["ComboBox"]);
  const [comboBox] = h.ids as [NodeId];
  h.declare(comboBox, { allowsCustomValue });
  await settle();
  const input = () =>
    h.element(comboBox)!.querySelector("input") as HTMLInputElement;
  const pick = async (name: string) => {
    act(() => {
      input().focus();
    });
    act(() => {
      fireEvent.click(h.element(comboBox)!.querySelector("button")!);
    });
    await settle();
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (item) => item.textContent?.includes(name),
    )!;
    // (Live — an item with an action, a virtual click: RAC's `performAction` sends
    // `react-aria-item-action`, which closes the list, before the item selects. jsdom's items
    // select first, so the order is given here — one press, one batch.)
    act(() => {
      option.dispatchEvent(
        new CustomEvent("react-aria-item-action", { bubbles: true }),
      );
      fireEvent.click(option);
    });
    await settle();
  };
  const typeAndBlur = async (text: string) => {
    act(() => {
      input().focus();
    });
    act(() => {
      fireEvent.change(input(), { target: { value: text } });
    });
    await settle();
    act(() => {
      input().blur();
    });
    await settle();
  };
  return { ...h, input, pick, typeAndBlur };
}

describe("ComboBox input text follows the selection (both controlled)", () => {
  it("picking an item shows its text; a blur puts it back over typed text", async () => {
    const h = await comboBoxPreview(false);
    await h.pick("Dog");
    expect(h.input().value).toBe("Dog");
    // (The text arriving after the item closed the list does not open it again.)
    expect(h.input().getAttribute("aria-expanded")).toBe("false");
    await h.typeAndBlur("Dogxyz");
    expect(h.input().value).toBe("Dog");
    h.view.unmount();
  });

  it("allowsCustomValue: a blur keeps the typed text (RAC commits it, the selection clears)", async () => {
    const h = await comboBoxPreview(true);
    await h.pick("Cat");
    expect(h.input().value).toBe("Cat");
    await h.typeAndBlur("Catfish");
    expect(h.input().value).toBe("Catfish");
    h.view.unmount();
  });
});

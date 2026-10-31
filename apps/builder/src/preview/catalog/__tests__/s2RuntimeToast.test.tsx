import "fake-indexeddb/auto";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ToastProvider,
  useToast,
  type ToastOptions,
} from "@composition/shared/components";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-295 후속 C2 — the app's toasts as S2 1.8.1 (`@react-spectrum/s2` `Toast.tsx`, 사용자 「Toast - RSC 기준」):
 * - a rule's `toast` Do is `ToastQueue.<variant>(message, {timeout})` — `variant` · `timeout` reach the region;
 *   a failure the session reports is `negative`;
 * - the region is RAC's (`alertdialog` toasts, the close button's name); a toast is a solid variant color with
 *   white text and its icon (neutral none); no timeout = stays, a set one is at least 5s;
 * - one stack: the newest on top, the ones behind a sliver; 「Show all」 expands, 「Clear all」 empties.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe("S2 toast — a rule's toast Do", () => {
  it("variant · timeout go to the toast; absent = none (info · until closed)", async () => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", {
      opcode: "toast",
      message: "Saved",
      variant: "positive",
      timeout: 6000,
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    expect(h.toasts).toEqual(["Saved"]);
    expect(h.toastOptions).toEqual([{ variant: "positive", timeout: 6000 }]);
    h.view.unmount();

    const plain = await openAdr280Preview(["Button"]);
    const [other] = plain.ids as [NodeId];
    plain.rule(other, "onPress", { opcode: "toast", message: "Hi" });
    act(() => {
      fireEvent.click(plain.element(other)!);
    });
    expect(plain.toastOptions).toEqual([{}]);
    plain.view.unmount();
  });

  it.each([
    [{ variant: "warning" }, "INVALID_TOAST_VARIANT"],
    [{ timeout: 0 }, "INVALID_TOAST_TIMEOUT"],
    [{ timeout: 1.5 }, "INVALID_TOAST_TIMEOUT"],
  ])("%j is refused (%s)", async (extra, code) => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    let refused: unknown;
    try {
      h.rule(button, "onPress", {
        opcode: "toast",
        message: "x",
        ...extra,
      } as never);
    } catch (error) {
      refused = (error as { code?: unknown }).code;
    }
    expect(refused).toBe(code);
    h.view.unmount();
  });
});

/** The provider's `addToast` (to add a toast after the region has loaded). */
let added: (options: ToastOptions) => string = () => "";

function Toasts({ toasts }: { toasts: ToastOptions[] }) {
  const { addToast } = useToast();
  added = addToast;
  useEffect(() => {
    for (const toast of toasts) addToast(toast);
  }, [addToast, toasts]);
  return null;
}

async function show(toasts: ToastOptions[]) {
  const view = render(
    <ToastProvider placement="bottom end">
      <Toasts toasts={toasts} />
    </ToastProvider>,
  );
  const doc = view.container.ownerDocument;
  // (The region module loads with the first toast — `ToastProvider`.)
  await waitFor(() =>
    expect(doc.querySelector(".catalog-toast-region")).not.toBeNull(),
  );
  return {
    view,
    add: (options: ToastOptions) => added(options),
    toasts: () => [...doc.querySelectorAll<HTMLElement>(".catalog-toast")],
    dialogs: () => [...doc.querySelectorAll<HTMLElement>("[role=alertdialog]")],
    button: (text: string) =>
      [...doc.querySelectorAll<HTMLElement>("button")].find(
        (b) => b.textContent === text,
      ),
  };
}

describe("S2 toast — the region", () => {
  it.each([
    ["neutral", "var(--fg-muted)", false],
    ["info", "var(--informative)", true],
    ["positive", "var(--positive)", true],
    ["negative", "var(--negative)", true],
  ] as const)(
    "%s: a solid %s with white text, icon %s, RAC's alertdialog and close button",
    async (variant, background, icon) => {
      const h = await show([{ title: "Hello", variant }]);
      const [toast] = h.toasts();
      expect(toast?.getAttribute("role")).toBe("alertdialog");
      expect(toast?.getAttribute("data-variant")).toBe(variant);
      expect(toast?.style.backgroundColor).toBe(background);
      expect(toast?.style.color).toBe("var(--color-white)");
      expect(toast?.style.minHeight).toContain("--catalog-token-size-unit");
      expect(toast?.style.maxWidth).toContain("90vw");
      expect(!!toast?.querySelector(".catalog-toast-icon")).toBe(icon);
      expect(
        toast?.querySelector("button[slot=close]")?.getAttribute("aria-label"),
      ).toBeTruthy();
      expect(toast?.textContent).toContain("Hello");
      // (Not the document Text node's class — its sheet paints `--fg` over the toast's white.)
      expect(toast?.querySelector(".react-aria-Text")).toBeNull();
      h.view.unmount();
    },
  );

  it("no variant = info", async () => {
    const h = await show([{ title: "Hello" }]);
    expect(h.toasts()[0]?.getAttribute("data-variant")).toBe("info");
    h.view.unmount();
  });

  it("no timeout stays; a set timeout is at least 5s (S2)", async () => {
    const h = await show([{ title: "first" }]);
    vi.useFakeTimers();
    act(() => {
      h.add({ title: "stays" });
      h.add({ title: "short", timeout: 1000 });
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(h.view.container.ownerDocument.body.textContent).toContain("short");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const text = h.view.container.ownerDocument.body.textContent;
    expect(text).not.toContain("short");
    expect(text).toContain("stays");
    h.view.unmount();
  });

  it("a stack: the newest on top, the ones behind a sliver; Show all expands, Clear all empties", async () => {
    const h = await show([
      { title: "one" },
      { title: "two" },
      { title: "three" },
    ]);
    // Collapsed: one RAC toast (the newest) + two slivers.
    expect(h.dialogs()).toHaveLength(1);
    expect(h.dialogs()[0]?.textContent).toContain("three");
    expect(
      h.view.container.ownerDocument.querySelectorAll(".catalog-toast-behind"),
    ).toHaveLength(2);
    act(() => {
      fireEvent.click(h.button("Show all")!);
    });
    expect(h.dialogs()).toHaveLength(3);
    expect(
      h.view.container.ownerDocument.querySelector(
        ".catalog-toast-region[data-expanded]",
      ),
    ).not.toBeNull();
    act(() => {
      fireEvent.click(h.button("Clear all")!);
    });
    expect(h.toasts()).toHaveLength(0);
    h.view.unmount();
  });
});

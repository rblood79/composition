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

describe("S2 toast — view transitions · the expanded list takes over the screen (C6)", () => {
  type Transition = { type: string[]; reduce: boolean };
  let transitions: Transition[] = [];
  let finish: (() => void)[] = [];
  const doc = document as unknown as { startViewTransition?: unknown };
  afterEach(async () => {
    delete doc.startViewTransition;
    finish.splice(0).forEach((done) => done());
    await Promise.resolve();
    document.documentElement.removeAttribute("class");
    transitions = [];
  });
  /** jsdom has no View Transitions API: run the update now, record the html classes it ran under. */
  function stubViewTransitions() {
    doc.startViewTransition = (update: () => void) => {
      const classes = [...document.documentElement.classList].filter((name) =>
        name.startsWith("catalog-toast-"),
      );
      transitions.push({
        type: classes.filter((name) => name !== "catalog-toast-reduce-motion"),
        reduce: classes.includes("catalog-toast-reduce-motion"),
      });
      update();
      let done!: () => void;
      const finished = new Promise<void>((resolve) => (done = resolve));
      finish.push(done);
      return { ready: Promise.resolve(), finished };
    };
  }

  it("an add · remove is a view transition typed on the html element; the class goes when it finishes", async () => {
    stubViewTransitions();
    const h = await show([{ title: "one" }]);
    expect(transitions.map((t) => t.type)).toEqual([["catalog-toast-add"]]);
    expect(
      document.documentElement.classList.contains("catalog-toast-add"),
    ).toBe(true);
    await act(async () => {
      finish.splice(0).forEach((done) => done());
    });
    expect(
      document.documentElement.classList.contains("catalog-toast-add"),
    ).toBe(false);
    // Each toast carries its key as its transition name and its classes (the edge it slides from).
    const [toast] = h.toasts();
    expect(toast?.style.getPropertyValue("view-transition-name")).toBeTruthy();
    expect(toast?.style.getPropertyValue("view-transition-class")).toBe(
      "catalog-toast catalog-toast-bottom catalog-toast-end",
    );
    act(() => {
      fireEvent.click(toast!.querySelector("button[slot=close]")!);
    });
    expect(transitions.at(-1)?.type).toEqual(["catalog-toast-remove"]);
    h.view.unmount();
  });

  it("expand · collapse are view transitions; expanded = scroll lock, the page hidden from assistive tech, focus contained", async () => {
    stubViewTransitions();
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.append(outside);
    const h = await show([{ title: "one" }, { title: "two" }]);
    await act(async () => {
      finish.splice(0).forEach((done) => done());
    });
    transitions = [];
    act(() => {
      fireEvent.click(h.button("Show all")!);
    });
    expect(transitions.map((t) => t.type)).toEqual([["catalog-toast-expand"]]);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(outside.closest("[aria-hidden=true]")).not.toBeNull();
    // Focus stays in the region (S2 `FocusScope contain`).
    const region = document.querySelector<HTMLElement>(
      ".catalog-toast-region",
    )!;
    const collapse = h.button("Collapse")!;
    act(() => collapse.focus());
    await act(async () => {
      outside.focus();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(region.contains(document.activeElement)).toBe(true);
    await act(async () => {
      finish.splice(0).forEach((done) => done());
    });
    act(() => {
      fireEvent.click(h.button("Collapse")!);
    });
    expect(transitions.at(-1)?.type).toEqual(["catalog-toast-collapse"]);
    expect(document.documentElement.style.overflow).not.toBe("hidden");
    expect(outside.closest("[aria-hidden=true]")).toBeNull();
    h.view.unmount();
    outside.remove();
  });

  it("a click on the collapsed stack (not a button) expands it", async () => {
    const h = await show([{ title: "one" }, { title: "two" }]);
    act(() => {
      fireEvent.click(h.toasts()[0]!.querySelector(".catalog-toast-title")!);
    });
    expect(h.dialogs()).toHaveLength(2);
    h.view.unmount();
  });

  it("reduced motion: the transition carries it; a sliver's name takes its index (a cross fade)", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      stubViewTransitions();
      const h = await show([{ title: "one" }]);
      act(() => {
        h.add({ title: "two" });
      });
      expect(transitions.at(-1)).toEqual({
        type: ["catalog-toast-add"],
        reduce: true,
      });
      const sliver = document.querySelector<HTMLElement>(
        ".catalog-toast-behind",
      )!;
      expect(sliver.style.getPropertyValue("view-transition-name")).toMatch(
        /-1$/,
      );
      h.view.unmount();
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});

describe("S2 toast action button (295 후속 C8)", () => {
  it("a rule's toast Do carries actionLabel · shouldCloseOnAction; the button runs its nested Dos", async () => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", {
      opcode: "toast",
      message: "Deleted",
      actionLabel: "Undo",
      shouldCloseOnAction: true,
      onAction: [{ opcode: "toast", message: "Restored", variant: "positive" }],
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    expect(h.toasts).toEqual(["Deleted"]);
    const options = h.toastOptions[0] as ToastOptions;
    expect(options).toMatchObject({
      actionLabel: "Undo",
      shouldCloseOnAction: true,
    });
    act(() => options.onAction!());
    expect(h.toasts).toEqual(["Deleted", "Restored"]);
    expect(h.toastOptions[1]).toEqual({ variant: "positive" });
    h.view.unmount();
  });

  it.each([
    [
      { onAction: [{ opcode: "toast", message: "x" }] },
      "TOAST_ACTION_LABEL_REQUIRED",
    ],
    [{ shouldCloseOnAction: true }, "TOAST_ACTION_LABEL_REQUIRED"],
    [{ actionLabel: "Undo", timeout: 6000 }, "INVALID_TOAST_TIMEOUT"],
    [
      {
        actionLabel: "Undo",
        onAction: [{ opcode: "toast", message: "x", variant: "warning" }],
      },
      "INVALID_TOAST_VARIANT",
    ],
    [{ actionLabel: "Undo", onAction: [] }, "ACTIONS_REQUIRED"],
    // (A nested Do's reference is checked as a rule's — the document's reference index walks it.)
    [
      {
        actionLabel: "Undo",
        onAction: [{ opcode: "navigate", pageId: "project:page:gone" }],
      },
      "DANGLING_PAGE",
    ],
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

  it("the region draws S2's action Button (the document Button sheet: secondary · outline · static white); pressing runs onAction, then closes when asked", async () => {
    const onAction = vi.fn();
    const h = await show([
      {
        title: "Deleted",
        actionLabel: "Undo",
        onAction,
        shouldCloseOnAction: true,
      },
    ]);
    const action = h.button("Undo")!;
    expect(action.className).toContain("react-aria-Button");
    expect(action.className).toContain("button-base");
    expect(action.dataset).toMatchObject({
      variant: "secondary",
      fillStyle: "outline",
      staticColor: "white",
      size: "M",
    });
    act(() => {
      fireEvent.click(action);
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(h.toasts()).toHaveLength(0);
    h.view.unmount();
  });

  it("without shouldCloseOnAction the toast stays; an actionable toast has no timeout (S2)", async () => {
    const onAction = vi.fn();
    const h = await show([{ title: "first" }]);
    vi.useFakeTimers();
    act(() => {
      h.add({ title: "Deleted", actionLabel: "Undo", onAction, timeout: 5000 });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    act(() => {
      fireEvent.click(h.button("Show all")!);
    });
    act(() => {
      fireEvent.click(h.button("Undo")!);
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(h.view.container.ownerDocument.body.textContent).toContain(
      "Deleted",
    );
    h.view.unmount();
  });
});

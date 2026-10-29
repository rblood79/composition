// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement as h, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

/**
 * ADR-259 G0 ② — the installed S2 (`@react-spectrum/s2` 1.8.1) and RAC outputs, fixed as the
 * oracle the later Phases compare our DOM against. The values come from mounting the reference
 * components — never from our own bindings.
 *
 *   ADR259_WRITE_ORACLE=1 pnpm -F @composition/builder exec vitest run adr259S2Oracle
 *     (writes apps/builder/tests/fixtures/adr259-s2-oracle.json)
 */
const here = dirname(fileURLToPath(import.meta.url));
const ORACLE = join(here, "../../../../tests/fixtures/adr259-s2-oracle.json");

/** Text alternative of a referenced subtree (accname 2F/2D — `aria-hidden` skipped, `aria-label` wins). */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.getAttribute("aria-hidden") === "true") return "";
  const label = node.getAttribute("aria-label");
  if (label) return label;
  return [...node.childNodes].map(textOf).join("");
}

/** accname for the cases here: `aria-labelledby` ids → self `aria-label` or the subtree's text. */
function nameOf(el: Element): string {
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    return ids
      .split(/\s+/)
      .map((id) => {
        const ref = el.ownerDocument.getElementById(id);
        if (!ref) return "";
        if (ref === el) return el.getAttribute("aria-label") ?? "";
        return textOf(ref)
          .replace(/\u00a0/g, " ")
          .trim();
      })
      .filter(Boolean)
      .join(" ");
  }
  return el.getAttribute("aria-label") ?? "";
}

/** `aria-labelledby` as roles — each id → what it points at (the shape, not the generated ids). */
function labelledByShape(el: Element, roles: Record<string, Element | null>) {
  const ids = el.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
  return ids.map((id) => {
    const ref = el.ownerDocument.getElementById(id);
    if (ref === el) return "self";
    for (const [role, node] of Object.entries(roles)) {
      if (node && ref === node) return role;
    }
    return ref ? `other:${ref.tagName.toLowerCase()}` : "missing";
  });
}

// jsdom has no observers; RAC collections (load-more sentinel) and S2 layout read them.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const observerGlobals = globalThis as Record<string, unknown>;
observerGlobals.IntersectionObserver ??= NoopObserver;
observerGlobals.ResizeObserver ??= NoopObserver;

async function mount(node: ReactNode) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(node));
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

async function contextualHelpOracle() {
  const s2 = await import("@react-spectrum/s2");
  const out: Record<string, unknown> = {};
  for (const [key, variant, headingSlot] of [
    ["help", "help", undefined],
    ["info", "info", undefined],
    ["help:title-slot", "help", "title"],
  ] as const) {
    const help = () =>
      h(
        s2.ContextualHelp as never,
        { variant },
        h(s2.Heading, { slot: headingSlot } as never, "Help title"),
        h(s2.Content, null, "Help body"),
        h(s2.Footer, null, "Help footer"),
      );
    // In a field — the label row.
    const field = await mount(
      h(
        s2.Provider,
        null,
        h(s2.TextField, { label: "Name", contextualHelp: help() }),
      ),
    );
    const label = field.host.querySelector("label")!;
    const button = field.host.querySelector("button")!;
    const row = label.parentElement!;
    const inField = {
      buttonAriaLabel: button.getAttribute("aria-label"),
      buttonLabelledBy: labelledByShape(button, { label }),
      buttonName: nameOf(button),
      buttonSlot: button.getAttribute("slot"),
      buttonType: button.getAttribute("type"),
      buttonHasPopup: button.getAttribute("aria-haspopup"),
      buttonExpandedClosed: button.getAttribute("aria-expanded"),
      labelRowTag: row.tagName.toLowerCase(),
      labelRowChildren: [...row.children].map((c) => c.tagName.toLowerCase()),
      labelRowText: row.textContent?.replace(/\u00a0/g, "␣"),
    };
    // Open it.
    await act(async () => {
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
      button.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }),
      );
      button.click();
    });
    const dialog = document.querySelector('[role="dialog"]');
    const heading = dialog?.querySelector("h1,h2,h3,h4,h5,h6") ?? null;
    const popover = dialog?.closest("[data-trigger]") ?? null;
    const opened = {
      buttonExpandedOpen: button.getAttribute("aria-expanded"),
      dialogRole: dialog?.getAttribute("role") ?? null,
      dialogLabelledBy: dialog ? labelledByShape(dialog, { heading }) : null,
      dialogName: dialog ? nameOf(dialog) : null,
      headingLevel: heading?.tagName.toLowerCase() ?? null,
      popoverTrigger: popover?.getAttribute("data-trigger") ?? null,
      popoverPlacement: popover?.getAttribute("data-placement") ?? null,
      text: dialog?.textContent,
    };
    await field.unmount();
    document.body.innerHTML = "";

    // Standalone (beside a heading — no field label).
    const alone = await mount(h(s2.Provider, null, help()));
    const aloneButton = alone.host.querySelector("button")!;
    const standalone = {
      buttonAriaLabel: aloneButton.getAttribute("aria-label"),
      buttonLabelledBy: aloneButton.getAttribute("aria-labelledby"),
      buttonName: nameOf(aloneButton),
    };
    await alone.unmount();
    document.body.innerHTML = "";
    out[key] = { inField, opened, standalone };
  }
  return out;
}

async function prefixOracle() {
  const s2 = await import("@react-spectrum/s2");
  const fields = {
    TextField: s2.TextField,
    TextArea: s2.TextArea,
    NumberField: s2.NumberField,
    ComboBox: s2.ComboBox,
    ColorField: s2.ColorField,
  } as const;
  const out: Record<string, unknown> = {};
  for (const [type, Field] of Object.entries(fields)) {
    for (const kind of ["text", "icon"] as const) {
      const prefix =
        kind === "text"
          ? "$"
          : h("svg", { "aria-label": "Search", role: "img", "data-icon": "" });
      const children =
        type === "ComboBox"
          ? [h(s2.ComboBoxItem as never, { key: "a", id: "a" }, "A")]
          : undefined;
      const mounted = await mount(
        h(
          s2.Provider,
          null,
          h(
            Field as never,
            { label: "Price", prefix } as never,
            ...(children ?? []),
          ),
        ),
      );
      const control = mounted.host.querySelector("input, textarea")!;
      const label = mounted.host.querySelector("label");
      // S2 `FieldGroup` wraps the prefix in a `CenterBaseline` carrying the prefix id.
      const prefixEl =
        [...mounted.host.querySelectorAll<HTMLElement>("[id]")].find((el) =>
          kind === "text"
            ? el.textContent === "$" && el.tagName !== "LABEL"
            : !!el.querySelector("svg[data-icon]") &&
              !el.querySelector("input, textarea"),
        ) ?? null;
      const group = prefixEl?.parentElement ?? null;
      out[`${type}:${kind}`] = {
        controlTag: control.tagName.toLowerCase(),
        labelledBy: labelledByShape(control, { label, prefix: prefixEl }),
        name: nameOf(control),
        groupRole: group?.getAttribute("role") ?? null,
        prefixFirstInGroup: !!group && group.firstElementChild === prefixEl,
        groupHoldsControl: !!group?.contains(control),
        prefixTag: prefixEl?.tagName.toLowerCase() ?? null,
      };
      // Focus forwarding (S2 FieldGroup `onPointerDown` mouse · `onTouchEnd`).
      if (kind === "text" && prefixEl) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        await act(async () => {
          prefixEl.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              cancelable: true,
              pointerType: "mouse",
            }),
          );
        });
        const mouse = document.activeElement === control;
        (document.activeElement as HTMLElement | null)?.blur?.();
        await act(async () => {
          prefixEl.dispatchEvent(
            new Event("touchend", { bubbles: true, cancelable: true }),
          );
        });
        const touch = document.activeElement === control;
        Object.assign(out[`${type}:${kind}`] as object, {
          focusFromPrefixMouse: mouse,
          focusFromPrefixTouch: touch,
        });
      }
      await mounted.unmount();
      document.body.innerHTML = "";
    }
  }
  return out;
}

async function itemLinkOracle() {
  const rac = await import("react-aria-components");
  const link = { href: "/about", target: "_blank", rel: "noopener" };
  const cases: Record<string, () => ReactNode> = {
    ListBoxItem: () =>
      h(
        rac.ListBox,
        { "aria-label": "L" },
        h(rac.ListBoxItem, { id: "a", ...link }, "A"),
      ),
    Tab: () =>
      h(
        rac.Tabs,
        null,
        h(
          rac.TabList,
          { "aria-label": "T" },
          h(rac.Tab, { id: "a", ...link }, "A"),
        ),
        h(rac.TabPanel, { id: "a" }, "P"),
      ),
    Tag: () =>
      h(
        rac.TagGroup,
        null,
        h(rac.Label, null, "G"),
        h(rac.TagList, null, h(rac.Tag, { id: "a", ...link }, "A")),
      ),
    TreeItem: () =>
      h(
        rac.Tree,
        { "aria-label": "R" },
        h(
          rac.TreeItem as never,
          { id: "a", textValue: "A", ...link },
          h(rac.TreeItemContent, null, "A"),
        ),
      ),
    GridListItem: () =>
      h(
        rac.GridList,
        { "aria-label": "G" },
        h(rac.GridListItem, { id: "a", textValue: "A", ...link }, "A"),
      ),
    Row: () =>
      h(
        rac.Table,
        { "aria-label": "T" },
        h(rac.TableHeader, null, h(rac.Column, { isRowHeader: true }, "C")),
        h(
          rac.TableBody,
          null,
          h(rac.Row, { id: "a", ...link }, h(rac.Cell, null, "A")),
        ),
      ),
    MenuItem: () =>
      h(
        rac.Menu,
        { "aria-label": "M" },
        h(rac.MenuItem, { id: "a", ...link }, "A"),
      ),
  };
  const out: Record<string, unknown> = {};
  for (const [type, render] of Object.entries(cases)) {
    const mounted = await mount(render());
    const item =
      mounted.host.querySelector(`[data-key="a"]`) ??
      mounted.host.querySelector(`[data-href]`) ??
      mounted.host.querySelector("a");
    out[type] = item && {
      tag: item.tagName.toLowerCase(),
      role: item.getAttribute("role"),
      href: item.getAttribute("href"),
      target: item.getAttribute("target"),
      rel: item.getAttribute("rel"),
      dataHref: item.getAttribute("data-href"),
      dataTarget: item.getAttribute("data-target"),
      dataRel: item.getAttribute("data-rel"),
    };
    await mounted.unmount();
    document.body.innerHTML = "";
  }
  return out;
}

async function linkOutOracle() {
  const s2 = await import("@react-spectrum/s2");
  const out: Record<string, unknown> = {};
  const listView = (props: Record<string, unknown>, hide?: boolean) =>
    h(
      s2.ListView,
      { "aria-label": "L", hideLinkOutIcon: hide } as never,
      h(s2.ListViewItem, { id: "a", textValue: "A", ...props } as never, "A"),
    );
  const menu = (props: Record<string, unknown>, hide?: boolean) =>
    h(
      s2.Menu,
      { "aria-label": "M", hideLinkOutIcon: hide } as never,
      h(s2.MenuItem, { id: "a", textValue: "A", ...props } as never, "A"),
    );
  for (const [type, render] of Object.entries({
    ListView: listView,
    Menu: menu,
  })) {
    for (const [label, props, hide] of [
      ["href+_blank", { href: "https://x.test", target: "_blank" }, false],
      ["href only", { href: "https://x.test" }, false],
      [
        "href+_blank hidden",
        { href: "https://x.test", target: "_blank" },
        true,
      ],
      ["no href", {}, false],
    ] as const) {
      const mounted = await mount(h(s2.Provider, null, render(props, hide)));
      const svgs = mounted.host.querySelectorAll("svg").length;
      out[`${type}:${label}`] = { svgCount: svgs };
      await mounted.unmount();
      document.body.innerHTML = "";
    }
  }
  return out;
}

describe("ADR-259 G0 — S2 / RAC oracle", () => {
  it("mounts the reference and matches the fixed oracle", async () => {
    const oracle = {
      source:
        "@react-spectrum/s2 1.8.1 + installed react-aria-components (jsdom)",
      contextualHelp: await contextualHelpOracle(),
      prefix: await prefixOracle(),
      itemLinks: await itemLinkOracle(),
      linkOut: await linkOutOracle(),
    };
    if (process.env.ADR259_WRITE_ORACLE === "1") {
      writeFileSync(ORACLE, `${JSON.stringify(oracle, null, 2)}\n`);
    }
    expect(oracle).toEqual(JSON.parse(readFileSync(ORACLE, "utf8")));
  }, 60_000);
});

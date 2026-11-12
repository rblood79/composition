import { act, fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { createElement } from "react";
import {
  openAdr296,
  BODY,
} from "../../../preview/catalog/__tests__/support/adr296Harness";
import { openAdr280Preview } from "../../../preview/catalog/__tests__/support/adr280Harness";
import { catalogEditContract } from "../editContract";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  AVATAR_SIZE_PRESETS,
  AVATAR_GROUP_SIZES,
  LEGACY_AVATAR_SIZES,
} from "../../../../../../packages/shared/src/catalog/document/avatarSizeValue";
import { AvatarSizeField } from "../../panels/properties/generic/AvatarSizeField";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { scalarFitsType } from "../../../../../../packages/shared/src/catalog/document/valueType";

it("Avatar value contracts distinguish numeric presets, custom sizes and invalid scalars", () => {
  for (const value of [0, 50.5, "1.5lh", ...Object.keys(LEGACY_AVATAR_SIZES)]) {
    expect(scalarFitsType(value, "avatarSize")).toBe(true);
  }
  for (const value of [
    -1,
    NaN,
    Infinity,
    "24",
    "-1lh",
    "Infinitylh",
    "toString",
  ]) {
    expect(scalarFitsType(value, "avatarSize")).toBe(false);
  }
  for (const value of [
    ...AVATAR_GROUP_SIZES,
    ...Object.keys(LEGACY_AVATAR_SIZES),
  ]) {
    expect(scalarFitsType(value, "avatarGroupSize")).toBe(true);
  }
  for (const value of [0, 50.5, "1lh", "24", "constructor"]) {
    expect(scalarFitsType(value, "avatarGroupSize")).toBe(false);
  }
});

it.each([...AVATAR_SIZE_PRESETS, 0, 50, 72.5])(
  "Avatar numeric %s reaches typed storage, Code, Canvas and DOM",
  async (size) => {
    const h = await openAdr280Preview(["Avatar"]);
    try {
      h.declare(h.ids[0], { size });
      const root = h.workspace.root;
      const node = [...root.canvasInputs.values()].find(
        (n) => root.typeOf(n) === "Avatar",
      )!;
      expect(node.props.size).toBe(size);
      const bounds = root.getGeometry([node.id]).get(node.id)!;
      expect(bounds.width).toBeCloseTo(size, 2);
      expect(bounds.height).toBeCloseTo(size, 2);
      expect(h.element(h.ids[0])!.style.width).toBe(`${size / 16}rem`);
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it("Avatar default is numeric 24 and accepts lh plus legacy names through Code", async () => {
  const h = await openAdr296();
  try {
    const id = h.add("Avatar");
    const node = () =>
      [...h.workspace.root.canvasInputs.values()].find(
        (n) => n.sourceId === id,
      )!;
    expect(node().props.size).toBe(24);
    for (const size of [
      64,
      50.5,
      "1.5lh",
      ...Object.keys(LEGACY_AVATAR_SIZES),
    ]) {
      h.declare(id, { size });
      const code = h.code();
      h.apply(code);
      expect(h.node(id).props.size).toEqual({ kind: "set", value: size });
    }
  } finally {
    h.workspace.dispose();
  }
});

it.each(AVATAR_GROUP_SIZES)(
  "AvatarGroup %s sizes its avatars and exposes numeric choices",
  async (size) => {
    const h = await openAdr280Preview(["AvatarGroup"]);
    try {
      h.declare(h.ids[0], { size });
      const root = h.workspace.root;
      const avatars = [...root.canvasInputs.values()].filter(
        (n) => root.typeOf(n) === "Avatar",
      );
      expect(avatars.length).toBe(3);
      for (const avatar of avatars) {
        expect(avatar.props.size).toBe(size);
        expect(root.getGeometry([avatar.id]).get(avatar.id)!.width).toBeCloseTo(
          size,
          2,
        );
      }
      const text = [...root.canvasInputs.values()].find(
        (n) => root.typeOf(n) === "Text",
      )!;
      expect(text.visual.fontSize).toBe(
        [11, 12, 14, 16, 18, 20, 22][AVATAR_GROUP_SIZES.indexOf(size)],
      );
      expect(
        catalogEditContract(h.workspace.runtime.graph, h.workspace.readModel, {
          kind: "node",
          id: h.ids[0],
        }).fields.find((f) => f.key === "size")?.kind,
      ).toBe("avatar-group-size");
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it.each(Object.entries(LEGACY_AVATAR_SIZES))(
  "legacy Avatar %s preserves its %s px geometry",
  async (size, diameter) => {
    const h = await openAdr280Preview(["Avatar"]);
    try {
      h.declare(h.ids[0], { size });
      const root = h.workspace.root;
      const node = [...root.canvasInputs.values()].find(
        (n) => root.typeOf(n) === "Avatar",
      )!;
      expect(root.getGeometry([node.id]).get(node.id)!.width).toBe(diameter);
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it("lh geometry follows authored inherited typography and own width overrides", async () => {
  const h = await openAdr280Preview(["Avatar"]);
  try {
    const root = h.workspace.root;
    act(() =>
      h.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BODY }],
          visual: {
            fontSize: { kind: "set", value: 20 },
            lineHeight: { kind: "set", value: 1.6 },
          },
          label: "Typography",
        }),
      ),
    );
    h.declare(h.ids[0], { size: "1.5lh" });
    const node = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "Avatar",
    )!;
    expect(root.getGeometry([node.id]).get(node.id)!.width).toBeCloseTo(48, 2);
    act(() =>
      h.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BODY }],
          visual: { lineHeight: { kind: "set", value: 2 } },
          label: "Line height",
        }),
      ),
    );
    expect(root.getGeometry([node.id]).get(node.id)!.width).toBeCloseTo(60, 2);
    act(() =>
      h.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BODY }],
          visual: { fontSize: { kind: "set", value: 24 } },
          label: "Font size",
        }),
      ),
    );
    expect(root.getGeometry([node.id]).get(node.id)!.width).toBeCloseTo(72, 2);
    act(() =>
      h.workspace.execute(
        setFields({
          targets: [{ kind: "node", id: h.ids[0] }],
          sizing: { width: { kind: "set", value: 80 } },
          label: "Width",
        }),
      ),
    );
    expect(root.getGeometry([node.id]).get(node.id)!.width).toBe(80);
    expect(
      root.canvasInputs.get(node.id)!.derivedProps?._avatarLineHeight,
    ).toBe(48);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it.each([
  ["Accordion", "XL"],
  ["Disclosure", "XL"],
  ["CardView", "XS"],
  ["CardView", "XL"],
])("%s offers and consumes %s", async (type, size) => {
  const h = await openAdr296();
  try {
    const id = h.add(type);
    const field = catalogEditContract(h.graph(), h.workspace.readModel, {
      kind: "node",
      id,
    }).fields.find((f) => f.key === "size")!;
    expect(field.options?.map((o) => o.value)).toContain(size);
    h.declare(id, { size });
    const root = h.workspace.root;
    for (const node of root.canvasInputs.values())
      if (
        root.typeOf(node) ===
        (type === "Accordion"
          ? "Disclosure"
          : type === "CardView"
            ? "Card"
            : type)
      )
        expect(node.props.size).toBe(size);
  } finally {
    h.workspace.dispose();
  }
});

it("Accordion defaults to single expansion while explicit multiple remains supported", async () => {
  const h = await openAdr280Preview(["Accordion"]);
  try {
    const root = h.workspace.root;
    const group = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "Accordion",
    )!;
    expect(group.props.allowsMultipleExpanded).toBe(false);
    expect(
      h.element(h.ids[0])!.querySelectorAll("[data-expanded]").length,
    ).toBe(1);
    // (ADR-308: with multiple allowed, the group's expanded keys open both.)
    h.declare(h.ids[0], {
      allowsMultipleExpanded: true,
      expandedKeys: ["section-1", "section-2"],
    });
    expect(
      h.element(h.ids[0])!.querySelectorAll("[data-expanded]").length,
    ).toBeGreaterThan(1);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it("Disclosure XL title consumes its header typography on Canvas", async () => {
  const h = await openAdr280Preview(["Disclosure"]);
  try {
    h.declare(h.ids[0], { size: "XL" });
    const root = h.workspace.root;
    const title = [...root.canvasInputs.values()].find(
      (node) =>
        root.typeOf(node) === "Text" && node.props.children === "Section Title",
    )!;
    expect(title.visual.fontSize).toBe(20);
    expect(title.visual.fontWeight).toBe(700);
    expect(title.visual.lineHeight).toBe(1.2);
    act(() => h.workspace.undo());
    expect(root.canvasInputs.get(title.id)!.visual.fontSize).toBe(14);
    act(() => h.workspace.redo());
    expect(root.canvasInputs.get(title.id)!.visual.fontSize).toBe(20);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it("Card target and Popover placement include all inherited literal choices", async () => {
  const h = await openAdr296();
  try {
    for (const [type, key, values] of [
      ["Card", "target", ["_self", "_blank", "_parent", "_top"]],
      [
        "Popover",
        "placement",
        getPrimitiveBinding("Popover")!.props.accepts.placement.options!.map(
          (o) => o.value,
        ),
      ],
    ] as const) {
      const id = h.add(type);
      const f = catalogEditContract(h.graph(), h.workspace.readModel, {
        kind: "node",
        id,
      }).fields.find((f) => f.key === key)!;
      expect(f.options?.map((o) => o.value)).toEqual(values);
      for (const value of values) {
        h.declare(id, { [key]: value });
        h.workspace.undo();
        h.workspace.redo();
      }
      h.apply(h.code());
    }
  } finally {
    h.workspace.dispose();
  }
});

it("Avatar size input preserves numeric and lh scalar types", () => {
  const values: unknown[] = [];
  const view = render(
    createElement(AvatarSizeField, {
      label: "Size",
      value: 24,
      options: AVATAR_SIZE_PRESETS.map((value) => ({
        value: String(value),
        label: String(value),
      })),
      isGroup: false,
      onChange: (value) => values.push(value),
    }),
  );
  try {
    const input = view.getByRole("textbox");
    fireEvent.change(input, { target: { value: "50.5" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "1.5lh" } });
    fireEvent.blur(input);
    expect(values).toContain(50.5);
    expect(values).toContain("1.5lh");
  } finally {
    view.unmount();
  }
});

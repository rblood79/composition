import { describe, expect, it } from "vitest";
import { DEFAULT_SLOT } from "react-aria-components";
import {
  catalogRacSlotProvider,
  predictRacSlot,
  racSlotProps,
  resolveRacSlot,
} from "../racSlot";

// ADR-256 Decision 4 — the four slot paths (RAC 1.21.0 `useSlottedContext`).
const withDefault = {
  slots: { [DEFAULT_SLOT]: {}, label: {}, description: {} },
};
const noDefault = { slots: { description: {}, errorMessage: {} } };
const plain = { isDisabled: true };

describe("resolveRacSlot — live context", () => {
  it("① an explicit detach (`false`) leaves the context", () => {
    expect(resolveRacSlot(withDefault, false)).toEqual({ kind: "detached" });
    expect(racSlotProps({ kind: "detached" })).toEqual({ slot: null });
  });
  it("② a provided name passes as is", () => {
    expect(resolveRacSlot(withDefault, "label")).toEqual({
      kind: "named",
      slot: "label",
    });
  });
  it("③ unset keeps the default slot (passes nothing); an empty name is unset", () => {
    expect(resolveRacSlot(withDefault, undefined)).toEqual({ kind: "default" });
    expect(resolveRacSlot(withDefault, "")).toEqual({ kind: "default" });
    expect(racSlotProps({ kind: "default" })).toEqual({});
  });
  it("④ a context without a slots table (or none) takes the slot as is", () => {
    expect(resolveRacSlot(plain, "label")).toEqual({
      kind: "plain",
      slot: "label",
    });
    // No provider above: nothing to connect, the name is not passed.
    expect(resolveRacSlot(null, "label")).toEqual({ kind: "none" });
    expect(racSlotProps({ kind: "plain", slot: "x" })).toEqual({ slot: "x" });
  });
  it("only a slotted context without the default (unset) or the name is not connected", () => {
    expect(resolveRacSlot(noDefault, undefined)).toEqual({
      kind: "unconnected",
    });
    expect(resolveRacSlot(withDefault, "shortcut")).toEqual({
      kind: "unconnected",
      slot: "shortcut",
    });
    expect(racSlotProps({ kind: "unconnected" })).toEqual({ slot: null });
  });
});

describe("predictRacSlot — the generated provider table", () => {
  it("finds the nearest provider of the part's consumer context", () => {
    expect(catalogRacSlotProvider("Text", ["ListBoxItem", "ListBox"])).toEqual({
      provider: "ListBoxItem",
      provision: { slots: ["label", "description"], hasDefault: true },
    });
    expect(
      predictRacSlot("Button", ["SelectTrigger", "NumberField"], "increment"),
    ).toMatchObject({
      kind: "named",
      slot: "increment",
      provider: "NumberField",
    });
  });
  it("MenuItem has no `shortcut` Text slot · a Tag's label Text is not connected", () => {
    expect(
      predictRacSlot("Text", ["MenuItem", "Menu"], "shortcut"),
    ).toMatchObject({
      kind: "unconnected",
    });
    expect(
      predictRacSlot("Text", ["Tag", "TagList", "TagGroup"], "label"),
    ).toMatchObject({ kind: "unconnected", provider: "TagGroup" });
  });
  it("a clearing part ends the search (Select's Popover) · no provider = plain", () => {
    expect(predictRacSlot("Text", ["Popover", "Select"], undefined)).toEqual({
      kind: "none",
    });
    expect(predictRacSlot("Heading", ["Card"], "title")).toEqual({
      kind: "none",
    });
    // A plain context (Select's trigger Button context) takes the name as is.
    expect(predictRacSlot("Button", ["Select"], "x")).toMatchObject({
      kind: "plain",
      slot: "x",
    });
  });
});

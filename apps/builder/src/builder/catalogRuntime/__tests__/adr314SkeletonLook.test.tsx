// @vitest-environment jsdom
/**
 * ADR-314 Phase 3 (G3) — S2 Skeleton's loading look on its participants, one D3 source
 * (`rule/skeletonLook.ts`) for the two consumers: the Canvas still frame (`canvasBinding.ts`
 * `withSkeletonLook` — a text's line boxes, a wrapped participant's box, a StatusLight's dot) and the
 * DOM marks the generated `CatalogSkeleton.css` draws (S2 `SkeletonText` span · `SkeletonWrapper`
 * element), animated in step (S2 `useLoadingAnimation`). The look moves nothing (HC3) and goes with
 * `isLoading: false`.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveToken } from "@composition/rendering";
import {
  CATALOG_SKELETON_LOOK,
  catalogSkeletonStylesheet,
} from "../../../../../../packages/shared/src/catalog/rule/skeletonLook";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogCanvasNodeData } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { openSkeleton } from "./support/adr314Skeleton";

const PARTICIPANTS = [
  "Text",
  "Link",
  "Icon",
  "Image",
  "Avatar",
  "StatusLight",
  "Badge",
  "Meter",
] as const;

const hex = (ref: string) => {
  const value = String(resolveToken(ref as never, "light"));
  return [1, 3, 5].map((at) =>
    Number((parseInt(value.slice(at, at + 2), 16) / 255).toFixed(3)),
  );
};
const rgb = (color: Float32Array | undefined) =>
  [...(color ?? [])].slice(0, 3).map((channel) => Number(channel.toFixed(3)));
const FILL = hex(CATALOG_SKELETON_LOOK.fill);
const RADIUS = Number(resolveToken(CATALOG_SKELETON_LOOK.radius, "light"));

async function open() {
  const opened = await openSkeleton(PARTICIPANTS);
  const one = (type: string) => opened.ofType(type)[0]!;
  const data = (record: CatalogConsumerNode) =>
    catalogCanvasNodeData(opened.root, record.id);
  return { ...opened, one, data };
}

describe("ADR-314 Phase 3 — the loading look on the Canvas", () => {
  it("a text participant's words become line boxes in the look's fill (S2 SkeletonText)", async () => {
    const s = await open();
    for (const record of [...s.ofType("Text"), s.one("MeterValue")]) {
      const shape = s.data(record);
      const text = shape.text ?? shape.children?.find((c) => c.text)?.text;
      expect(text?.skeleton, s.root.typeOf(record)).toBeDefined();
      expect(rgb(text!.skeleton!.color)).toEqual(FILL);
      expect(text!.skeleton!.radius).toBe(RADIUS);
    }
    s.setLoading(false);
    for (const record of s.ofType("Text"))
      expect(s.data(record).text?.skeleton).toBeUndefined();
  });

  it("a wrapped participant is one box of its own corner, its content dropped", async () => {
    const s = await open();
    const icon = s.data(s.one("Icon"));
    expect(icon.type).toBe("box");
    expect(icon.iconPath).toBeUndefined();
    expect(icon.box?.borderRadius).toBe(RADIUS); // S2 `useSkeletonIcon` — radius sm
    const avatar = s.data(s.one("Avatar"));
    expect(avatar.box?.borderRadius).toBe(avatar.width / 2); // S2 Avatar = Image, full
    expect(avatar.children).toBeUndefined();
    s.setLoading(false);
    const restBadge = s.data(s.one("Badge"));
    s.setLoading(true);
    const badge = s.data(s.one("Badge"));
    expect(badge.box?.borderRadius).toBe(restBadge.box?.borderRadius);
    expect(badge.children).toBeUndefined();
    for (const type of ["Icon", "Avatar", "Badge", "MeterTrack", "Image"])
      expect(rgb(s.data(s.one(type)).box?.fillColor), type).toEqual(FILL);
  });

  it("below a wrapped participant nothing is drawn (S2 `visibility: hidden`), and comes back", async () => {
    const s = await open();
    const fill = s.ofType("MeterFill")[0]!;
    expect(fill.derivedProps?._skeletonHidden).toBe(true);
    expect(s.data(fill).visible).toBe(false);
    s.setLoading(false);
    expect(s.data(s.ofType("MeterFill")[0]!).visible).toBe(true);
  });

  it("a StatusLight's dot is gray-200 and its words line boxes (S2 `StatusLight.tsx:126 · 177`)", async () => {
    const s = await open();
    const light = s.data(s.one("StatusLight"));
    const dot = light.children?.find((c) => c.type === "box" && c.box);
    expect(rgb(dot?.box?.fillColor)).toEqual(
      hex(CATALOG_SKELETON_LOOK.statusLight),
    );
    expect(light.children?.find((c) => c.text)?.text?.skeleton).toBeDefined();
  });

  it("a Link takes the look but stays enabled — S2 Link does not call `useFormProps`", async () => {
    const s = await open();
    const link = s.one("Link");
    expect(link.derivedProps?.isDisabled).toBeUndefined();
    const shape = s.data(link);
    expect(shape.effects ?? []).toEqual([]);
    expect(shape.children?.find((c) => c.text)?.text?.skeleton).toBeDefined();
    expect(s.html()).not.toMatch(/react-aria-Link[^>]*aria-disabled/);
  });

  it("the look moves nothing: every box under the Skeleton is the same loading or not (HC3)", async () => {
    const s = await open();
    const below = (record: CatalogConsumerNode): string[] =>
      record.children.flatMap((id) => [
        id,
        ...below(s.root.domInputs.get(id)!),
      ]);
    const boxes = () =>
      JSON.stringify([
        ...s.root.getGeometry(below(s.skeletonRecord())).entries(),
      ]);
    const loading = boxes();
    s.setLoading(false);
    expect(boxes()).toBe(loading);
  });
});

describe("ADR-314 Phase 3 — the loading look on the DOM", () => {
  it("marks the look elements the generated sheet draws, and none when not loading", async () => {
    const s = await open();
    const html = s.html();
    // S2 `SkeletonText` — the words in an inert inline span (Text · Link · Meter value · StatusLight).
    for (const words of ["Placeholder title", "Link", "0%", "Available"])
      expect(html).toContain(
        `<span data-skeleton-look="text" inert="">${words}</span>`,
      );
    expect(html).toMatch(
      /class="react-aria-Icon"[^>]*data-skeleton-look="icon"/,
    );
    expect(html).toMatch(
      /data-skeleton-look="box"[^>]*class="react-aria-Badge"/,
    );
    expect(html).toMatch(/class="bar"[^>]*data-skeleton-look="box"/);
    expect(html).toMatch(
      /class="react-aria-Image"[^>]*data-skeleton-look="box"/,
    );
    expect(html).toMatch(/data-skeleton-dot="true"/);
    s.setLoading(false);
    expect(s.html()).not.toMatch(/data-skeleton/);
  });

  it("the generated sheet is the catalog's (S2 `loadingStyle` values)", () => {
    const sheet = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/generated/CatalogSkeleton.css",
      ),
      "utf8",
    );
    expect(sheet).toBe(catalogSkeletonStylesheet());
    expect(sheet).toContain(
      "linear-gradient(to right, var(--skeleton) 33%, var(--skeleton-highlight), var(--skeleton) 66%)",
    );
    expect(sheet).toContain("background-size: 300%");
    const index = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/index.css",
      ),
      "utf8",
    );
    expect(index).toContain('@import "./generated/CatalogSkeleton.css";');
  });

  describe("animation (S2 `useLoadingAnimation`)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      delete (Element.prototype as { animate?: unknown }).animate;
    });

    async function mount(reduce: boolean) {
      const started: { startTime: number | null; cancel: () => void }[] = [];
      (Element.prototype as { animate?: unknown }).animate = function () {
        const animation = { startTime: null as number | null, cancel: vi.fn() };
        started.push(animation);
        return animation;
      };
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: reduce && query.includes("reduce"),
      }));
      const s = await open();
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      await act(async () => {
        root.render(renderCatalogDom(s.root, s.skeletonRecord().id));
      });
      const looks = host.querySelectorAll("[data-skeleton-look]").length;
      return { s, started, looks, root, host };
    }

    it("every look element runs one animation from the shared start (startTime 0)", async () => {
      const { started, looks, root, host } = await mount(false);
      expect(looks).toBeGreaterThanOrEqual(9);
      expect(started).toHaveLength(looks);
      expect(started.every((a) => a.startTime === 0)).toBe(true);
      await act(async () => root.unmount());
      expect(
        started.every((a) => vi.mocked(a.cancel).mock.calls.length === 1),
      ).toBe(true);
      host.remove();
    });

    it("none under reduced motion (the look stays)", async () => {
      const { started, looks, root, host } = await mount(true);
      expect(looks).toBeGreaterThanOrEqual(9);
      expect(started).toHaveLength(0);
      await act(async () => root.unmount());
      host.remove();
    });
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import { resolveCanonicalDocument } from "../index";
import {
  createCanonicalImportRegistry,
  fetchCompositionDocumentFromSource,
  getSharedImportRegistry,
  normalizeCompositionImportPayload,
  resolveCompositionImportSource,
  resetSharedImportRegistry,
} from "../importRegistry";

function makeDoc(children: CanonicalNode[] = []): CompositionDocument {
  return { version: "composition-1.0", children };
}

function makeImportedButton(label: string): CompositionDocument {
  return makeDoc([
    {
      id: "round-button",
      type: "Button",
      reusable: true,
      props: { label },
    },
  ]);
}

describe("canonical import registry", () => {
  beforeEach(() => {
    resetSharedImportRegistry();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefetches document imports and exposes them through ImportResolverContext", async () => {
    const fetcher = vi.fn(async () => makeImportedButton("Imported"));
    const registry = createCanonicalImportRegistry(fetcher);
    const hostDoc: CompositionDocument = {
      version: "composition-1.0",
      imports: { kit: "./kit.pen" },
      children: [{ id: "i1", type: "ref", ref: "kit:round-button" } as RefNode],
    };

    const beforePrefetch = resolveCanonicalDocument(
      hostDoc,
      undefined,
      registry,
    );
    expect(beforePrefetch[0]).toEqual(
      expect.objectContaining({ id: "i1", type: "ref" }),
    );

    const result = await registry.prefetchDocumentImports(hostDoc);

    expect(result).toEqual({
      loaded: [{ importKey: "kit", source: "./kit.pen" }],
      failed: [],
    });
    expect(fetcher).toHaveBeenCalledWith("kit", "./kit.pen");
    expect(registry.getStatus("kit", "./kit.pen")).toBe("loaded");

    const afterPrefetch = resolveCanonicalDocument(
      hostDoc,
      undefined,
      registry,
    );
    expect(afterPrefetch[0]).toEqual(
      expect.objectContaining({
        id: "i1",
        type: "Button",
        props: { label: "Imported" },
        _resolvedFrom: "kit:round-button",
      }),
    );
  });

  it("dedupes concurrent prefetches for the same import source", async () => {
    let resolveFetch: (doc: CompositionDocument) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<CompositionDocument>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const registry = createCanonicalImportRegistry(fetcher);

    const first = registry.prefetchImport("kit", "./kit.pen");
    const second = registry.prefetchImport("kit", "./kit.pen");

    expect(registry.getStatus("kit", "./kit.pen")).toBe("loading");
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(makeImportedButton("Shared"));

    await expect(first).resolves.toEqual(makeImportedButton("Shared"));
    await expect(second).resolves.toEqual(makeImportedButton("Shared"));
    expect(registry.getStatus("kit", "./kit.pen")).toBe("loaded");
  });

  it("records failed imports without blocking other import prefetches", async () => {
    const fetcher = vi.fn(async (importKey: string) => {
      if (importKey === "bad") {
        throw new Error("network failed");
      }
      return makeImportedButton("OK");
    });
    const registry = createCanonicalImportRegistry(fetcher);
    const hostDoc: CompositionDocument = {
      version: "composition-1.0",
      imports: {
        bad: "./bad.pen",
        good: "./good.pen",
      },
      children: [],
    };

    const result = await registry.prefetchDocumentImports(hostDoc);

    expect(result.loaded).toEqual([
      { importKey: "good", source: "./good.pen" },
    ]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toEqual(
      expect.objectContaining({
        importKey: "bad",
        source: "./bad.pen",
        error: expect.any(Error),
      }),
    );
    expect(registry.getStatus("bad", "./bad.pen")).toBe("failed");
    expect(registry.getError("bad", "./bad.pen")?.message).toBe(
      "network failed",
    );
    expect(registry.getStatus("good", "./good.pen")).toBe("loaded");
  });

  it("rejects invalid import keys before invoking the fetcher", async () => {
    const fetcher = vi.fn(async () => makeImportedButton("Invalid"));
    const registry = createCanonicalImportRegistry(fetcher);
    const imports = Object.create(null) as Record<string, string>;
    imports["bad:key"] = "./bad.pen";
    imports["__proto__"] = "./proto.pen";
    imports["good-kit"] = "./good.pen";
    const hostDoc: CompositionDocument = {
      version: "composition-1.0",
      imports,
      children: [],
    };

    const result = await registry.prefetchDocumentImports(hostDoc);

    expect(result.loaded).toEqual([
      { importKey: "good-kit", source: "./good.pen" },
    ]);
    expect(result.failed).toEqual([
      expect.objectContaining({
        importKey: "bad:key",
        source: "./bad.pen",
        error: expect.any(Error),
      }),
      expect.objectContaining({
        importKey: "__proto__",
        source: "./proto.pen",
        error: expect.any(Error),
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("good-kit", "./good.pen");
    expect(registry.getStatus("bad:key", "./bad.pen")).toBe("failed");
    expect(registry.getStatus("__proto__", "./proto.pen")).toBe("failed");
    expect(registry.getStatus("good-kit", "./good.pen")).toBe("loaded");
  });

  it("rejects invalid import document payloads", async () => {
    const registry = createCanonicalImportRegistry(
      vi.fn(async () => ({ version: "composition-1.0" }) as never),
    );

    await expect(registry.prefetchImport("kit", "./kit.pen")).rejects.toThrow(
      "Invalid import document",
    );
    expect(registry.getStatus("kit", "./kit.pen")).toBe("failed");
  });

  it("invalidates loaded import documents by import key and source", async () => {
    const registry = createCanonicalImportRegistry(
      vi.fn(async () => makeImportedButton("Cached")),
    );

    await registry.prefetchImport("kit", "./kit.pen");
    expect(registry.resolveImportDocument("kit", "./kit.pen")).toBeDefined();

    registry.invalidateImport("kit", "./kit.pen");

    expect(registry.resolveImportDocument("kit", "./kit.pen")).toBeUndefined();
    expect(registry.getStatus("kit", "./kit.pen")).toBe("idle");
  });

  it("prunes loaded imports that are no longer present in the active document import map", async () => {
    const fetcher = vi.fn(async (_importKey: string, source: string) =>
      makeImportedButton(source),
    );
    const registry = createCanonicalImportRegistry(fetcher);

    await registry.prefetchDocumentImports({
      version: "composition-1.0",
      imports: { kit: "./old.pen" },
      children: [],
    });
    expect(registry.getStatus("kit", "./old.pen")).toBe("loaded");

    await registry.prefetchDocumentImports({
      version: "composition-1.0",
      imports: { kit: "./new.pen" },
      children: [],
    });

    expect(registry.getStatus("kit", "./old.pen")).toBe("idle");
    expect(registry.resolveImportDocument("kit", "./old.pen")).toBeUndefined();
    expect(registry.getStatus("kit", "./new.pen")).toBe("loaded");
  });

  it("does not store an in-flight import after it is pruned from the active document", async () => {
    let resolveFetch: (doc: CompositionDocument) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<CompositionDocument>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const registry = createCanonicalImportRegistry(fetcher);
    const pendingPrefetch = registry.prefetchDocumentImports({
      version: "composition-1.0",
      imports: { kit: "./old.pen" },
      children: [],
    });

    expect(registry.getStatus("kit", "./old.pen")).toBe("loading");

    await registry.prefetchDocumentImports({
      version: "composition-1.0",
      imports: {},
      children: [],
    });
    expect(registry.getStatus("kit", "./old.pen")).toBe("idle");

    resolveFetch(makeImportedButton("Late"));
    await expect(pendingPrefetch).resolves.toEqual({
      loaded: [{ importKey: "kit", source: "./old.pen" }],
      failed: [],
    });

    expect(registry.getStatus("kit", "./old.pen")).toBe("idle");
    expect(registry.resolveImportDocument("kit", "./old.pen")).toBeUndefined();
  });

  it("returns a shared singleton until resetSharedImportRegistry is called", () => {
    const first = getSharedImportRegistry();
    const second = getSharedImportRegistry();

    expect(first).toBe(second);

    resetSharedImportRegistry();

    expect(getSharedImportRegistry()).not.toBe(first);
  });

  it("normalizes import sources against a same-origin base URL", () => {
    const baseUrl = "https://app.example/preview.html?canonical=1";

    expect(resolveCompositionImportSource("./kits/basic.pen", baseUrl)).toBe(
      "https://app.example/kits/basic.pen",
    );
    expect(resolveCompositionImportSource("/kits/basic.pen", baseUrl)).toBe(
      "https://app.example/kits/basic.pen",
    );
    expect(
      resolveCompositionImportSource(
        "https://app.example/kits/basic.pen",
        baseUrl,
      ),
    ).toBe("https://app.example/kits/basic.pen");
  });

  it("rejects cross-origin, unsafe, and empty import sources", () => {
    const baseUrl = "https://app.example/preview.html";

    expect(() =>
      resolveCompositionImportSource("https://cdn.example/kit.pen", baseUrl),
    ).toThrow("same-origin");
    expect(() =>
      resolveCompositionImportSource("javascript:alert(1)", baseUrl),
    ).toThrow("Unsupported import source protocol");
    expect(() => resolveCompositionImportSource("   ", baseUrl)).toThrow(
      "non-empty",
    );
  });

  it("fetches default import sources through the normalized same-origin URL", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => makeImportedButton("Fetched"),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const doc = await fetchCompositionDocumentFromSource(
      "kit",
      "./kit.pen",
      "https://app.example/preview.html",
    );

    expect(fetchMock).toHaveBeenCalledWith("https://app.example/kit.pen");
    expect(doc.children[0]).toEqual(
      expect.objectContaining({
        id: "round-button",
        props: { label: "Fetched" },
      }),
    );
  });

  it("normalizes Pencil-style import payloads to canonical reusable masters", () => {
    const doc = normalizeCompositionImportPayload(
      {
        version: "2.10",
        children: [
          {
            id: "hero",
            type: "rectangle",
            fill: "#fff",
            children: [{ id: "title", type: "text", text: "Hello" }],
          },
        ],
      },
      "https://app.example/kit.pen",
    );

    expect(doc).toEqual({
      version: "composition-1.0",
      _meta: { schemaVersion: "canonical-primary-1.0" },
      children: [
        expect.objectContaining({
          id: "hero",
          type: "frame",
          reusable: true,
          props: { fill: "#fff" },
          metadata: { type: "rectangle", pencilType: "rectangle" },
          children: [
            expect.objectContaining({
              id: "title",
              type: "Text",
              props: { text: "Hello" },
              metadata: { type: "text", pencilType: "text" },
            }),
          ],
        }),
      ],
    });
  });

  it("resolves fetched Pencil-style imports through the default registry backend", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        version: "2.10",
        children: [{ id: "hero", type: "rectangle", fill: "#eee" }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const registry = createCanonicalImportRegistry();
    const hostDoc: CompositionDocument = {
      version: "composition-1.0",
      imports: { kit: "./kit.pen" },
      children: [{ id: "i1", type: "ref", ref: "kit:hero" } as RefNode],
    };

    await registry.prefetchDocumentImports(hostDoc);
    const resolved = resolveCanonicalDocument(hostDoc, undefined, registry);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost(?::3000)?\/kit\.pen$/),
    );
    expect(resolved[0]).toEqual(
      expect.objectContaining({
        id: "i1",
        type: "frame",
        props: { fill: "#eee" },
        _resolvedFrom: "kit:hero",
      }),
    );
  });

  it("keeps the ADR-116 G6-4 import runtime completion contract wired", async () => {
    const [registrySource, resolverSource, previewSource] = await Promise.all([
      readFile(resolve(__dirname, "../importRegistry.ts"), "utf-8"),
      readFile(resolve(__dirname, "../index.ts"), "utf-8"),
      readFile(resolve(__dirname, "../../../preview/App.tsx"), "utf-8"),
    ]);

    expect(registrySource).toContain(
      "normalizeCompositionImportPayload(await response.json(), resolvedSource)",
    );
    expect(registrySource).toContain(
      "resolveCompositionImportSource(source, baseUrl)",
    );
    expect(registrySource).toContain("retainDocumentImports(doc);");
    expect(registrySource).toContain("requestTokens.get(cacheKey) === token");
    expect(resolverSource).toContain("parseCompositionImportReference(refId)");
    expect(previewSource).toContain(
      ".prefetchDocumentImports(canonicalDocument)",
    );
    expect(
      (
        previewSource.match(
          /resolveCanonicalDocument\(\s*canonicalDocument,\s*undefined,\s*canonicalImportRegistry,\s*\)/g,
        ) ?? []
      ).length,
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCatalogProjectJson,
  catalogProjectContent,
} from "../../../../packages/shared/src/catalog/runtime/exchange";
import { buildV2Generation, encodeManifest } from "@composition/shared/assets";
import { publicationFixture } from "./publicationFixture";
import {
  loadCatalogProjectText,
  loadCatalogProjectUrl,
} from "../catalogProject";

describe("Publish catalog 파일 경계", () => {
  it("Builder JSON을 같은 catalog 문서로 열고 구 canonical 파일은 거절한다", async () => {
    const { library, graph } = await publicationFixture();
    const text = await buildCatalogProjectJson(
      catalogProjectContent(graph),
      async () => null,
    );
    const loaded = await loadCatalogProjectText(text, library);
    expect(loaded.document).toEqual(graph.exportDocument());
    loaded.dispose();
    await expect(
      loadCatalogProjectText(
        JSON.stringify({ version: "1.0", document: { children: [] } }),
        library,
      ),
    ).rejects.toThrow("UNSUPPORTED_PROJECT_FORMAT");
  });

  it("v2 디렉토리는 manifest 기준 경로·해시로 열며 손상된 part는 거절한다", async () => {
    const { library, graph } = await publicationFixture();
    const generation = await buildV2Generation(
      catalogProjectContent(graph),
      async () => null,
      { revision: 1, previousRevision: null },
    );
    generation.files.set("manifest.json", encodeManifest(generation.manifest));
    const base = "https://example.test/site/";
    const fetched: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      fetched.push(url);
      const bytes = generation.files.get(url.slice(base.length));
      return new Response(bytes ? (bytes as BodyInit) : null, {
        status: bytes ? 200 : 404,
      });
    };
    const loaded = await loadCatalogProjectUrl(base, library, fetcher);
    expect(loaded.document).toEqual(graph.exportDocument());
    expect(fetched.every((url) => url.startsWith(base))).toBe(true);
    loaded.dispose();
    generation.files.set(
      generation.manifest.parts.document.path,
      new TextEncoder().encode("corrupt"),
    );
    await expect(
      loadCatalogProjectUrl(base, library, fetcher),
    ).rejects.toThrow();
  });
});

it("JSON과 ZIP 자산은 해시 검증 후 설치 후보가 되고 dispose가 URL을 회수한다", async () => {
  const { library, graph } = await publicationFixture();
  const { sha256Hex, refFromHash, packV2Zip } =
    await import("@composition/shared/assets");
  const { loadCatalogProjectFile } = await import("../catalogProject");
  const bytes = new TextEncoder().encode("fixture font bytes");
  const ref = refFromHash(await sha256Hex(bytes));
  const content = catalogProjectContent(graph, {
    fontRegistry: {
      version: 2,
      faces: [
        {
          id: "font",
          family: "Fixture",
          source: { type: "project-asset", url: ref },
          createdAt: "",
          updatedAt: "",
        },
      ],
    },
  });
  const readAsset = async () => ({ bytes, mime: "font/woff2" });
  const text = await buildCatalogProjectJson(content, readAsset);
  const json = await loadCatalogProjectText(text, library);
  const jsonUrl = json.resolver.resolveSync(ref)!;
  expect(new Uint8Array(await (await fetch(jsonUrl)).arrayBuffer())).toEqual(
    bytes,
  );
  json.dispose();
  expect(json.resolver.resolveSync(ref)).toBeNull();
  await expect(fetch(jsonUrl)).rejects.toThrow();
  const zipped = await packV2Zip(
    await buildV2Generation(content, readAsset, {
      revision: 1,
      previousRevision: null,
    }),
  );
  const zip = await loadCatalogProjectFile(
    new File([zipped], "project.zip"),
    library,
  );
  expect(
    new Uint8Array(
      await (await fetch(zip.resolver.resolveSync(ref)!)).arrayBuffer(),
    ),
  ).toEqual(bytes);
  zip.dispose();
  const invalid = JSON.parse(text);
  invalid.assets[ref] = "data:font/woff2;base64,Y29ycnVwdA==";
  await expect(
    loadCatalogProjectText(JSON.stringify(invalid), library),
  ).rejects.toThrow();
});

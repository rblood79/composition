import type {
  CatalogDocument,
  CatalogLibrary,
} from "../../../packages/shared/src/catalog/document/types";
import {
  readCatalogProjectContent,
  readCatalogProjectJson,
  type CatalogProjectFileExtras,
} from "../../../packages/shared/src/catalog/runtime/exchange";
import {
  findAssetRefs,
  hashFromRef,
} from "../../../packages/shared/src/assets/assetBytes";
import type { AssetRef, AssetUrlResolver } from "@composition/shared";
import type { ProjectContentV2 } from "@composition/shared/assets";

export interface LoadedCatalogProject {
  document: CatalogDocument;
  extras: CatalogProjectFileExtras;
  resolver: AssetUrlResolver;
  dispose(): void;
}

/** 파일 전체 검증이 끝나기 전에는 현재 프로젝트나 전역 자산 해석기를 바꾸지 않는다. */
export function loadedCatalogContent(
  content: ProjectContentV2,
  library: CatalogLibrary,
  assets: ReadonlyMap<string, { bytes: Uint8Array; mime: string }>,
): LoadedCatalogProject {
  const { document, extras } = readCatalogProjectContent(content, library);
  for (const key of ["collections", "apiEndpoints", "variables"] as const) {
    const values = extras[key];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.some(
          (item) => !item || typeof item !== "object" || Array.isArray(item),
        ))
    ) {
      throw new Error(`INVALID_PROJECT_DATA:${key}`);
    }
  }
  const fonts = extras.fontRegistry as
    { version?: unknown; faces?: unknown } | undefined;
  if (
    fonts !== undefined &&
    (!fonts ||
      fonts.version !== 2 ||
      !Array.isArray(fonts.faces) ||
      fonts.faces.some(
        (face) =>
          !face ||
          typeof face.family !== "string" ||
          typeof face.source?.url !== "string",
      ))
  ) {
    throw new Error("INVALID_PROJECT_DATA:fontRegistry");
  }
  const refs = findAssetRefs(content);
  for (const ref of refs) {
    if (!assets.has(hashFromRef(ref) ?? ""))
      throw new Error(`MISSING_ASSET:${ref}`);
  }
  const urls = new Map<AssetRef, string>();
  try {
    for (const ref of refs) {
      const asset = assets.get(hashFromRef(ref)!)!;
      urls.set(
        ref as AssetRef,
        URL.createObjectURL(
          new Blob([asset.bytes as BlobPart], { type: asset.mime }),
        ),
      );
    }
  } catch (error) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    throw error;
  }
  return {
    document,
    extras,
    resolver: {
      resolveSync: (ref) => urls.get(ref) ?? null,
      ensure: async () => {},
      subscribe: () => () => {},
    },
    dispose: () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}

export async function loadCatalogProjectText(
  text: string,
  library: CatalogLibrary,
): Promise<LoadedCatalogProject> {
  const { content, assets } = await readCatalogProjectJson(text);
  return loadedCatalogContent(
    content,
    library,
    new Map(assets.map((asset) => [hashFromRef(asset.ref)!, asset])),
  );
}

export async function loadCatalogProjectFile(
  file: File,
  library: CatalogLibrary,
): Promise<LoadedCatalogProject> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { isZipBytes, openV2Zip, readV2Generation } =
    await import("@composition/shared/assets");
  if (!isZipBytes(bytes))
    return loadCatalogProjectText(new TextDecoder().decode(bytes), library);
  const read = await readV2Generation(await openV2Zip(bytes));
  return loadedCatalogContent(read.content, library, read.assets);
}

/** v2 part와 자산은 manifest 위치 기준으로 읽는다. old JSON fallback은 없다. */
export async function loadCatalogProjectUrl(
  url: string,
  library: CatalogLibrary,
  fetcher: typeof fetch = fetch,
): Promise<LoadedCatalogProject> {
  const base = new URL(url, globalThis.location?.href ?? "http://localhost/");
  const target = base.pathname.endsWith("/")
    ? new URL("manifest.json", base)
    : base;
  const response = await fetcher(target.href);
  if (!response.ok) throw new Error(`PROJECT_HTTP_${response.status}`);
  if (response.headers.get("content-type")?.includes("text/html"))
    throw new Error("PROJECT_NOT_FOUND");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { isZipBytes, openV2Zip, readV2Generation } =
    await import("@composition/shared/assets");
  if (isZipBytes(bytes)) {
    const read = await readV2Generation(await openV2Zip(bytes));
    return loadedCatalogContent(read.content, library, read.assets);
  }
  const text = new TextDecoder().decode(bytes);
  if (JSON.parse(text)?.formatVersion === "2.0.0") {
    const read = await readV2Generation({
      async read(path) {
        if (path === "manifest.json") return bytes;
        const result = await fetcher(new URL(path, target).href);
        return result.ok ? new Uint8Array(await result.arrayBuffer()) : null;
      },
    });
    return loadedCatalogContent(read.content, library, read.assets);
  }
  return loadCatalogProjectText(text, library);
}

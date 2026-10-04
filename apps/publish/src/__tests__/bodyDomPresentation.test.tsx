// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { loadedCatalogContent } from "../catalogProject";
import { createPublishedSession } from "../catalogSession";
import { CatalogPreviewView } from "../../../../packages/shared/src/catalog/runtime/domView";
import { catalogProjectContent } from "../../../../packages/shared/src/catalog/runtime/exchange";
import { publicationFixture } from "./publicationFixture";

it("Publish가 catalog Body를 그리고 페이지 layout을 shell에 중복 적용하지 않는다", async () => {
  const { library, graph } = await publicationFixture();
  const project = loadedCatalogContent(
    catalogProjectContent(graph),
    library,
    new Map(),
  );
  const session = createPublishedSession(project, library);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CatalogPreviewView session={session} />));
  const body = host.querySelector("[data-catalog-id]");
  expect(body).not.toBeNull();
  expect(body!.className).toBe("react-aria-Body");
  expect(body!.classList.contains("react-aria-body")).toBe(false);
  expect(document.body.style.display).toBe("");
  expect(document.body.style.width).toBe("");
  expect(document.body.style.padding).toBe("");
  expect(body!.hasAttribute("data-body-viewport-fill")).toBe(false);
  await act(async () => root.unmount());
  host.remove();
  project.dispose();
});

it("Builder가 저장한 Frame backgroundColor를 DOM 배경으로 렌더한다", async () => {
  const { library, graph } = await publicationFixture();
  const documentData = graph.exportDocument();
  const body = documentData.entries[
    "project:node:body"
  ] as import("../../../../packages/shared/src/catalog/document/types").NodeEntry;
  const content = catalogProjectContent(graph);
  content.document = {
    ...documentData,
    entries: {
      ...documentData.entries,
      [body.id]: { ...body, children: ["project:node:frame"] },
      "project:node:frame": {
        ...body,
        id: "project:node:frame",
        definitionId: "lib:definition:type-frame",
        children: [],
        visual: { backgroundColor: { kind: "set", value: "#e0e7ff" } },
      },
    },
  };
  const project = loadedCatalogContent(content, library, new Map());
  const session = createPublishedSession(project, library);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<CatalogPreviewView session={session} />),
    );
    const frame = host.querySelector(
      '[data-catalog-id$="::project:node:frame"]',
    ) as HTMLElement;
    expect(frame.style.backgroundColor).toBe("rgb(224, 231, 255)");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    project.dispose();
  }
});

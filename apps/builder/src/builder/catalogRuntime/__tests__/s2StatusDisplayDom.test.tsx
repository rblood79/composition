// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setNodeAttribute,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { ProgressCircle } from "../../../../../../packages/shared/src/components/ProgressCircle";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nProvider } from "../../../i18n";
import { CatalogAccessibilitySection } from "../../panels/properties/catalog/CatalogAccessibilitySection";
import { CatalogWorkspaceProvider } from "../react";

/**
 * S2 마이그레이션 체크리스트 §3 (2026-11-18) — 상태 표시 두 컴포넌트의 DOM 을 S2 1.8.2 구조로.
 * - ProgressCircle: 루트 = RAC `ProgressBar` (S2 `ProgressCircle.tsx` — `<RACProgressBar>` 안에 svg).
 *   class 는 RAC 기본값 `react-aria-ProgressBar` 가 아니다 — 그 이름의 생성 시트 (`ProgressBar.css`)
 *   가 Preview 에 실려 있어 원이 막대 grid 를 받는다.
 * - StatusLight: 점 = `svg[aria-hidden] > circle` (S2 `StatusLight.tsx` `light` — `span` 아님).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function preview(
  type: string,
  before?: (workspace: CatalogWorkspace) => void,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:status" as EntryId<"project">,
        name: "Status",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `status-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  before?.(workspace);
  const root = workspace.root;
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const id = [...root.domInputs.values()].find((r) => r.sourceId === ROOT)!.id;
  await act(async () => reactRoot.render(renderCatalogDom(root, id)));
  const el = host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!;
  return {
    el,
    workspace,
    done: async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("S2 상태 표시 DOM (2026-11-18)", () => {
  it("ProgressCircle: 루트가 RAC ProgressBar — aria-valuetext, ProgressBar class 없음", async () => {
    const { el, done } = await preview("ProgressCircle");
    expect(el.getAttribute("role")).toBe("progressbar");
    // RAC `useProgressBar` 만 내는 값 (직접 만든 div 는 내지 않았다).
    expect(el.getAttribute("aria-valuetext")).toBe("75%");
    expect(el.getAttribute("aria-valuenow")).toBe("75");
    expect(el.className).not.toContain("react-aria-ProgressBar");
    expect(el.querySelectorAll(":scope > svg > circle")).toHaveLength(2);
    await done();
  });

  it("ProgressCircle: class 를 받지 않는 자리 (Button pending · 목록 로딩) 도 ProgressBar 시트를 받지 않는다", () => {
    const html = renderToStaticMarkup(
      <ProgressCircle isIndeterminate aria-label="Loading…" />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Loading…"');
    expect(html).not.toContain("react-aria-ProgressBar");
    expect(html).not.toContain("aria-valuenow");
  });

  it("StatusLight: 점은 svg circle (S2 light), 글자는 그 뒤", async () => {
    const { el, done } = await preview("StatusLight");
    const svg = el.firstElementChild as SVGSVGElement;
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const circle = svg.querySelector("circle")!;
    expect(circle.getAttribute("r")).toBe("50%");
    expect(circle.getAttribute("cx")).toBe("50%");
    expect(svg.style.fill).toBe("var(--positive-visual)");
    expect(svg.style.width).toBe(
      "calc(var(--catalog-token-size-unit) * 10 / 1)",
    );
    expect(svg.style.height).toBe(svg.style.width);
    expect(svg.style.overflow).toBe("visible");
    expect(el.children[1]!.textContent).toBe("Available");
    await done();
  });

  // S2 ProgressCircle 은 보이는 label 이 없어 `aria-label` 이 필수다 (RAC 가 없으면 경고) — 놓은 원은 S2
  // 예제의 이름 「Loading…」 을 기본으로 갖고, Property 탭 Accessibility 의 Aria Label 칸이 바꾼다.
  it("ProgressCircle: 기본 접근 이름 「Loading…」, Aria Label 칸의 값이 이긴다", async () => {
    const first = await preview("ProgressCircle");
    expect(first.el.getAttribute("aria-label")).toBe("Loading…");
    await first.done();
    const named = await preview("ProgressCircle", (workspace) =>
      workspace.execute(
        setNodeAttribute({ id: ROOT, field: "ariaLabel", value: "Upload" }),
      ),
    );
    expect(named.el.getAttribute("aria-label")).toBe("Upload");
    await named.done();
  });

  it("ProgressCircle: Aria Label 칸은 비어 있을 때 기본 이름을 보여 준다", async () => {
    const { workspace, done } = await preview("ProgressCircle");
    const [item] = workspace.itemsOfNode(ROOT, 1);
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogAccessibilitySection
            target={item!.target}
            identity={item!.identity}
          />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const input = screen
      .getByRole("group", { name: "ARIA label" })
      .querySelector("input")!;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Loading…");
    cleanup();
    await done();
  });
});

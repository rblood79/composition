// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { DataTableEditorPanel } from "./DataTableEditorPanel";
import { DataTableFieldPanel } from "./DataTableFieldPanel";
import { DataTablePanel } from "./DataTablePanel";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";

/**
 * Panels mount before the workspace exists (`CatalogBuilderCore` renders the panel workspace
 * outside the hosts until the project opens). A Data panel left open in the saved layout rendered
 * its list there — `useDataUsageSource` threw and the whole Builder unmounted (2026-10-22 사용자
 * 보고 「Data usage host is not provided」). Like the other catalog panels, they wait behind
 * `CatalogWorkspaceGate`.
 */
afterEach(() => {
  cleanup();
  useDataTableEditorStore.getState().close();
});

const PANELS: [string, ComponentType<{ isActive: boolean }>][] = [
  ["DataTablePanel", DataTablePanel],
  ["DataTableEditorPanel", DataTableEditorPanel],
  ["DataTableFieldPanel", DataTableFieldPanel],
];

describe("Data panels before the workspace exists", () => {
  it.each(PANELS)("%s renders nothing, does not throw", (_name, Panel) => {
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <MemoryRouter initialEntries={["/builder/project-1"]}>
          <Routes>
            <Route path="/builder/:projectId" element={<Panel isActive />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(container.textContent).toBe("");
  });
});

// @vitest-environment jsdom

import { useState, type Key } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabPanel, Tabs } from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n";
import { NodesPanelTabs, type NodesPanelTabType } from "./NodesPanelTabs";

function NodesTabsFixture() {
  const [selectedKey, setSelectedKey] = useState<NodesPanelTabType>("pages");

  const handleSelectionChange = (key: Key): void => {
    setSelectedKey(key as NodesPanelTabType);
  };

  return (
    <I18nProvider initialLocale="en-US">
      <Tabs selectedKey={selectedKey} onSelectionChange={handleSelectionChange}>
        <NodesPanelTabs />
        <TabPanel id="pages">Pages content</TabPanel>
        <TabPanel id="layouts">Frames content</TabPanel>
      </Tabs>
    </I18nProvider>
  );
}

describe("NodesPanelTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps both labels visible and switches the selected panel on press", () => {
    render(<NodesTabsFixture />);

    const pagesTab = screen.getByRole("tab", { name: "Pages" });
    const framesTab = screen.getByRole("tab", { name: "Frames" });

    expect(
      screen.getByRole("tablist", { name: "Navigator tabs" }),
    ).toBeTruthy();
    expect(pagesTab.getAttribute("aria-selected")).toBe("true");
    expect(framesTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText("Pages content")).toBeTruthy();
    expect(screen.queryByText("Frames content")).toBeNull();

    fireEvent.click(framesTab);

    expect(framesTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Frames content")).toBeTruthy();
    expect(screen.queryByText("Pages content")).toBeNull();
  });

  it("moves focus and selection with horizontal arrow keys", () => {
    render(<NodesTabsFixture />);

    const pagesTab = screen.getByRole("tab", { name: "Pages" });
    const framesTab = screen.getByRole("tab", { name: "Frames" });

    pagesTab.focus();
    fireEvent.keyDown(pagesTab, { key: "ArrowRight", code: "ArrowRight" });

    expect(document.activeElement).toBe(framesTab);
    expect(framesTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Frames content")).toBeTruthy();
  });
});

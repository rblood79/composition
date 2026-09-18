// @vitest-environment jsdom

import { useState, type Key } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabPanel, Tabs } from "react-aria-components/Tabs";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n";
import {
  NavigatorPanelTabs,
  type NavigatorPanelTabType,
} from "./NavigatorPanelTabs";

function NavigatorTabsFixture() {
  const [selectedKey, setSelectedKey] =
    useState<NavigatorPanelTabType>("pages");

  const handleSelectionChange = (key: Key): void => {
    setSelectedKey(key as NavigatorPanelTabType);
  };

  return (
    <I18nProvider initialLocale="en-US">
      <Tabs selectedKey={selectedKey} onSelectionChange={handleSelectionChange}>
        <NavigatorPanelTabs />
        <TabPanel id="pages">Pages content</TabPanel>
        <TabPanel id="layouts">Layouts content</TabPanel>
      </Tabs>
    </I18nProvider>
  );
}

describe("NavigatorPanelTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps both labels visible and switches the selected panel on press", () => {
    render(<NavigatorTabsFixture />);

    const pagesTab = screen.getByRole("tab", { name: "Pages" });
    const layoutsTab = screen.getByRole("tab", { name: "Layouts" });

    expect(
      screen.getByRole("tablist", { name: "Navigator tabs" }),
    ).toBeTruthy();
    expect(pagesTab.getAttribute("aria-selected")).toBe("true");
    expect(layoutsTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText("Pages content")).toBeTruthy();
    expect(screen.queryByText("Layouts content")).toBeNull();

    fireEvent.click(layoutsTab);

    expect(layoutsTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Layouts content")).toBeTruthy();
    expect(screen.queryByText("Pages content")).toBeNull();
  });

  it("moves focus and selection with horizontal arrow keys", () => {
    render(<NavigatorTabsFixture />);

    const pagesTab = screen.getByRole("tab", { name: "Pages" });
    const layoutsTab = screen.getByRole("tab", { name: "Layouts" });

    pagesTab.focus();
    fireEvent.keyDown(pagesTab, { key: "ArrowRight", code: "ArrowRight" });

    expect(document.activeElement).toBe(layoutsTab);
    expect(layoutsTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Layouts content")).toBeTruthy();
  });

  it("한국어에서도 Layouts 탭을 레이아웃으로 표시한다", () => {
    render(
      <I18nProvider initialLocale="ko-KR">
        <Tabs selectedKey="pages">
          <NavigatorPanelTabs />
        </Tabs>
      </I18nProvider>,
    );

    expect(screen.getByRole("tab", { name: "레이아웃" })).toBeTruthy();
  });
});

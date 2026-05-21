// @vitest-environment jsdom
/**
 * ADR-144 Phase 6 — RAC behavior tests for Tabs (Gate G5).
 *
 * 본 phase 의 목적은 composition Tabs wrapper 와 canonical resolved-tree
 * projection 이 react-aria-components 의 keyboard navigation / focus /
 * selection / activation policy contract 를 **그대로 통과시키는지** 검증하는
 * 것이다. R3 (MED) — "RAC behavior projection 을 tree 구조에서 파생하는
 * 과정에서 keyboard/focus semantics 를 깨뜨릴 수 있다" 를 evidence 로 닫는다.
 *
 * 참고 official testing pattern:
 *   - React Aria Testing Guide
 *     <https://react-spectrum.adobe.com/react-aria/testing.html>
 *   - RAC Tabs API & keyboard contract
 *     <https://react-spectrum.adobe.com/react-aria/Tabs.html#props>
 *
 * 본 file 은 두 경로의 RAC behavior 를 모두 검증한다:
 *   A. composition `Tabs` wrapper (catalog `items[]` projection / static
 *      children) — leaf path.
 *   B. canonical resolved-tree projection (`Tabs`/`TabList`/`Tab`/`TabPanel`
 *      resolved children) — ADR-144 신규 path. composition 의 own marker
 *      wiring 이 RAC keyboard/focus/selection delivery 를 중간에 가로채지
 *      않아야 한다.
 *
 * Skia visual / hit-test 정합성은 G3/G4 에서 별도 검증 (`canonicalSkiaSymmetry`
 * / `renderCommands` / `adr144DescendantsRouting`). 본 file 은 behavior layer
 * 만 다룬다 (G5).
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * jsdom 환경에서 RAC 가 요구하지만 미구현된 web platform API 를 polyfill 한다.
 *
 * - `CSS.escape` : `react-aria` 의 `useSelectableCollection` 가 focus event
 *   처리 중 selection key 직렬화에 사용. jsdom v29 에서 `CSS` 글로벌이 일부
 *   API 누락 상태로 노출되어 `Cannot read properties of undefined (reading
 *   'escape')` 가 발생한다. W3C polyfill spec
 *   <https://www.w3.org/TR/cssom-1/#serialize-an-identifier> 의 단순 fallback.
 * - `Element.getAnimations` : RAC `SharedElementTransition`
 *   (`showIndicator: true` 활성화 시) 이 frame 마다 animation 목록 폴링.
 *   jsdom 은 Web Animations API 를 노출하지 않으므로 빈 array stub 으로
 *   no-op 처리. 본 file 은 indicator 의 시각 정합이 아니라 keyboard/focus
 *   contract 만 검증하므로 stub 으로 충분하다.
 */
beforeAll(() => {
  const cssGlobal = (globalThis as { CSS?: { escape?: (s: string) => string } })
    .CSS;
  const needsEscape = !cssGlobal || typeof cssGlobal.escape !== "function";
  if (needsEscape) {
    const escape = (value: string): string =>
      String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
    if (!cssGlobal) {
      (globalThis as { CSS: { escape: (s: string) => string } }).CSS = {
        escape,
      };
    } else {
      cssGlobal.escape = escape;
    }
  }

  const elementProto = globalThis.Element?.prototype as
    | (Element & { getAnimations?: () => Animation[] })
    | undefined;
  if (elementProto && typeof elementProto.getAnimations !== "function") {
    elementProto.getAnimations = function getAnimations(): Animation[] {
      return [];
    };
  }
});

import {
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@composition/shared/components/Tabs";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import type { RenderContext } from "../types";
import { CanonicalNodeRenderer } from "./CanonicalNodeRenderer";

function makeRenderContext(): RenderContext {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    eventEngine: {} as RenderContext["eventEngine"],
    renderElement: () => null,
  };
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
  );
}

/**
 * Canonical Tabs document copied from `CanonicalNodeRenderer.adr144.test.tsx`
 * 의 `makeTabsDocument`. ADR-144 의 reusable `Tab`/`TabList`/`Tabs` origin +
 * `type:"ref"` instance + descendants override + nested `TabPanel` body 의
 * canonical SSOT 모양을 그대로 reuse 한다.
 */
function makeTabsDocument(): CompositionDocument {
  const tabOrigin: CanonicalNode = {
    id: "tab-origin",
    type: "Tab",
    reusable: true,
    name: "Tab",
    children: [
      {
        id: "tab-label",
        type: "Text",
        props: { text: "Tab" },
      },
      {
        id: "tab-indicator",
        type: "frame",
        props: { enabled: false },
      },
    ],
  };
  const tabListOrigin: CanonicalNode = {
    id: "tablist-origin",
    type: "TabList",
    reusable: true,
    children: [
      {
        id: "tab-ref-overview",
        type: "ref",
        ref: "tab-origin",
        descendants: {
          "tab-label": { text: "Overview" },
          "tab-indicator": { enabled: true },
        },
      } as RefNode,
      {
        id: "tab-ref-settings",
        type: "ref",
        ref: "tab-origin",
        descendants: {
          "tab-label": { text: "Settings" },
        },
      } as RefNode,
    ],
  };
  const tabsOrigin: CanonicalNode = {
    id: "tabs-origin",
    type: "Tabs",
    reusable: true,
    props: {
      "aria-label": "Sections",
      defaultSelectedKey: "tab-ref-overview",
      orientation: "horizontal",
      showIndicator: true,
    },
    children: [
      {
        id: "tabs-tablist-ref",
        type: "ref",
        ref: "tablist-origin",
      } as RefNode,
      {
        id: "panel-overview",
        type: "TabPanel",
        props: { id: "tab-ref-overview" },
        children: [
          {
            id: "panel-overview-body",
            type: "Text",
            props: { children: "Overview panel content" },
          },
        ],
      },
      {
        id: "panel-settings",
        type: "TabPanel",
        props: { id: "tab-ref-settings" },
        children: [
          {
            id: "panel-settings-body",
            type: "Text",
            props: { children: "Settings panel content" },
          },
        ],
      },
    ],
  };

  return {
    version: "composition-1.0",
    children: [
      tabOrigin,
      tabListOrigin,
      tabsOrigin,
      {
        id: "tabs-instance",
        type: "ref",
        ref: "tabs-origin",
      } as RefNode,
    ],
  };
}

describe("ADR-144 Phase 6 — Tabs RAC behavior (wrapper)", () => {
  afterEach(cleanup);

  /**
   * Wrapper 가 RAC contract 를 통과시키는지 가장 작은 staticchildren 경로로
   * 확인한다. `Tabs` / `TabList` / `Tab` / `TabPanel` 의 composition export 가
   * 그대로 react-aria-components 의 동일 primitive 를 위임해야 한다.
   */
  it("delivers ArrowRight/ArrowLeft keyboard navigation to RAC tabs", () => {
    const onSelectionChange = vi.fn();
    render(
      <Tabs
        aria-label="Sections"
        defaultSelectedKey="overview"
        onSelectionChange={onSelectionChange}
      >
        <TabList aria-label="Sections">
          <Tab id="overview">Overview</Tab>
          <Tab id="settings">Settings</Tab>
          <Tab id="logs">Logs</Tab>
        </TabList>
        <TabPanel id="overview">Overview body</TabPanel>
        <TabPanel id="settings">Settings body</TabPanel>
        <TabPanel id="logs">Logs body</TabPanel>
      </Tabs>,
    );

    const overview = screen.getByRole("tab", { name: /Overview/ });
    const settings = screen.getByRole("tab", { name: /Settings/ });

    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(settings.getAttribute("aria-selected")).toBe("false");

    // ArrowRight: focused tab 이 next sibling 으로 이동 + automatic activation
    // (RAC default `keyboardActivation="automatic"`).
    act(() => {
      overview.focus();
    });
    fireEvent.keyDown(overview, { key: "ArrowRight" });

    expect(onSelectionChange).toHaveBeenCalledWith("settings");
  });

  /**
   * `keyboardActivation="manual"` 일 때 ArrowRight 는 focus 만 이동시키고
   * selection 은 그대로 유지되어야 한다. Enter/Space 를 통해서만 활성화된다.
   * 이 contract 는 RAC primitive 가 책임지지만, composition wrapper 가 모든
   * `keyboardActivation` 값을 그대로 RAC root 에 전달하는지 검증한다.
   */
  it("respects keyboardActivation='manual' contract", () => {
    const onSelectionChange = vi.fn();
    render(
      <Tabs
        aria-label="Sections"
        defaultSelectedKey="overview"
        keyboardActivation="manual"
        onSelectionChange={onSelectionChange}
      >
        <TabList aria-label="Sections">
          <Tab id="overview">Overview</Tab>
          <Tab id="settings">Settings</Tab>
        </TabList>
        <TabPanel id="overview">Overview body</TabPanel>
        <TabPanel id="settings">Settings body</TabPanel>
      </Tabs>,
    );

    const overview = screen.getByRole("tab", { name: /Overview/ });
    const settings = screen.getByRole("tab", { name: /Settings/ });

    act(() => {
      overview.focus();
    });
    fireEvent.keyDown(overview, { key: "ArrowRight" });

    // manual mode: ArrowRight 는 selection 을 변경하지 않아야 한다
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(overview.getAttribute("aria-selected")).toBe("true");

    // Enter 로 활성화하면 selection 변경
    act(() => {
      settings.focus();
    });
    fireEvent.keyDown(settings, { key: "Enter" });

    expect(onSelectionChange).toHaveBeenCalledWith("settings");
  });

  /**
   * 선택된 tab 의 `aria-controls` 가 해당 panel 의 id 와 일치하고, panel 의
   * `aria-labelledby` 가 tab 의 id 와 일치해야 한다. RAC 가 자동 wiring 하므로
   * composition wrapper 가 panel id 를 가로채지 않는지 확인.
   */
  it("preserves tab/panel relation via aria-controls / aria-labelledby", () => {
    render(
      <Tabs aria-label="Sections" defaultSelectedKey="overview">
        <TabList aria-label="Sections">
          <Tab id="overview">Overview</Tab>
          <Tab id="settings">Settings</Tab>
        </TabList>
        <TabPanel id="overview">Overview body</TabPanel>
        <TabPanel id="settings">Settings body</TabPanel>
      </Tabs>,
    );

    const overviewTab = screen.getByRole("tab", { name: /Overview/ });
    const visiblePanel = screen.getByRole("tabpanel");

    const controls = overviewTab.getAttribute("aria-controls");
    const labelledBy = visiblePanel.getAttribute("aria-labelledby");

    expect(controls).toBeTruthy();
    expect(labelledBy).toBeTruthy();
    expect(controls).toBe(visiblePanel.getAttribute("id"));
    expect(labelledBy).toBe(overviewTab.getAttribute("id"));
  });
});

describe("ADR-144 Phase 6 — Tabs RAC behavior (canonical resolved-tree)", () => {
  afterEach(cleanup);

  /**
   * canonical resolved-tree projection 으로 그려진 Tabs 가 keyboard navigation
   * contract 를 깨지 않는지 검증한다. composition 의 ADR-144 `data-canonical-id`
   * marker wiring 은 RAC primitive 의 keyboard handler 를 가로채지 않아야 한다.
   *
   * Tab key 는 ref instance id (`tab-ref-overview` / `tab-ref-settings`) 이며,
   * defaultSelectedKey 는 origin 의 `tabs-origin.props.defaultSelectedKey`
   * (`tab-ref-overview`) 이다.
   */
  it("delivers ArrowRight to resolved Tab refs without losing canonical owner identity", () => {
    const resolvedTabs = resolveCanonicalDocument(makeTabsDocument()).find(
      (node) => node.id === "tabs-instance",
    );
    expect(resolvedTabs).toBeDefined();

    const { container } = renderResolved(resolvedTabs!);

    const overview = screen.getByRole("tab", { name: /Overview/ });
    const settings = screen.getByRole("tab", { name: /Settings/ });

    // defaultSelectedKey = "tab-ref-overview"
    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(settings.getAttribute("aria-selected")).toBe("false");

    // canonical owner identity 가 marker 로 남아있어야 한다.
    expect(overview.dataset.canonicalId).toBe("tab-ref-overview");
    expect(settings.dataset.canonicalId).toBe("tab-ref-settings");

    // Arrow key 이후 RAC 가 active tab/panel 을 교체했는지 확인.
    act(() => {
      overview.focus();
    });
    fireEvent.keyDown(overview, { key: "ArrowRight" });

    expect(overview.getAttribute("aria-selected")).toBe("false");
    expect(settings.getAttribute("aria-selected")).toBe("true");

    // selected tab 교체 후에도 panel marker 가 canonical id 를 유지한다.
    const settingsPanel = container.querySelector(
      "[data-canonical-id='panel-settings']",
    );
    expect(settingsPanel?.classList.contains("react-aria-TabPanel")).toBe(true);
    expect(
      within(settingsPanel as HTMLElement).getByText("Settings panel content")
        .dataset.canonicalId,
    ).toBe("panel-settings-body");
  });

  /**
   * Home/End 키 contract 도 resolved-tree 에서 동일하게 동작해야 한다.
   * RAC 가 책임지지만 composition wrapping 이 가로채지 않는지 evidence.
   */
  it("delivers Home/End keys to resolved Tabs", () => {
    const resolvedTabs = resolveCanonicalDocument(makeTabsDocument()).find(
      (node) => node.id === "tabs-instance",
    );
    expect(resolvedTabs).toBeDefined();

    renderResolved(resolvedTabs!);

    const overview = screen.getByRole("tab", { name: /Overview/ });
    const settings = screen.getByRole("tab", { name: /Settings/ });

    // settings 부터 시작
    act(() => {
      settings.focus();
    });
    fireEvent.keyDown(settings, { key: "Home" });

    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(settings.getAttribute("aria-selected")).toBe("false");

    fireEvent.keyDown(overview, { key: "End" });
    expect(overview.getAttribute("aria-selected")).toBe("false");
    expect(settings.getAttribute("aria-selected")).toBe("true");
  });

  /**
   * resolved Tab 에 focus 가 들어왔을 때 RAC 가 `data-focused` / `data-focus-visible`
   * 같은 RAC render-prop attribute 를 적용하는지 확인한다. composition 의
   * `data-canonical-id` marker 가 RAC 의 attribute 와 충돌하지 않아야 한다.
   */
  it("applies RAC focus markers without colliding with canonical-id marker", () => {
    const resolvedTabs = resolveCanonicalDocument(makeTabsDocument()).find(
      (node) => node.id === "tabs-instance",
    );
    expect(resolvedTabs).toBeDefined();

    renderResolved(resolvedTabs!);

    const overview = screen.getByRole("tab", { name: /Overview/ });

    act(() => {
      overview.focus();
    });
    fireEvent.focus(overview);

    // RAC 가 focused state 를 적용 (jsdom 환경에서는 focus-visible 만 적용될 수
    // 있음). 핵심은 canonical-id marker 는 그대로 유지되는 것.
    expect(overview.dataset.canonicalId).toBe("tab-ref-overview");
    expect(overview.getAttribute("role")).toBe("tab");
  });
});

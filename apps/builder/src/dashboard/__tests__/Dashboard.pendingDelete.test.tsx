// @vitest-environment jsdom

import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPendingProjectDeleteState } from "../pendingProjectDelete";

const mocks = vi.hoisted(() => ({
  location: { pathname: "/dashboard", state: null as unknown },
  navigate: vi.fn(),
  removeProject: vi.fn(async () => {}),
  deleteCollection: vi.fn(async () => {}),
}));

vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock("../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    collections: {
      getByProject: vi.fn(async (id: string) =>
        id === "p-1" ? [{ id: "c-1" }] : [],
      ),
      delete: mocks.deleteCollection,
    },
    api_endpoints: { getByProject: vi.fn(async () => []), delete: vi.fn() },
    variables: { getByProject: vi.fn(async () => []), delete: vi.fn() },
  })),
}));

// ADR-248: the project document lives in the catalog storage.
vi.mock("../../builder/catalogRuntime/storage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  CatalogStorage: class {
    list = vi.fn(async () => []);
    remove = mocks.removeProject;
  },
}));

import Dashboard from "../index";

// 빌더 헤더 "프로젝트 삭제" — 확인은 빌더가 받고, 삭제는 빌더 언마운트 뒤 대시보드가 한다.
describe("Dashboard — 빌더가 넘긴 삭제 요청", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.removeProject.mockClear();
    mocks.deleteCollection.mockClear();
    // StrictMode 재실행에서 RAC SharedElementTransition 이 부른다 — jsdom 에 없음
    Element.prototype.getAnimations ??= () => [];
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    mocks.location.state = null;
  });

  it("state 의 프로젝트를 한 번 지우고 state 를 비운다", async () => {
    mocks.location.state = buildPendingProjectDeleteState("p-1");

    render(
      <React.StrictMode>
        <Dashboard />
      </React.StrictMode>,
    );

    // The route id names the catalog project; the data stores key by the route id.
    await waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("project:project:p-1"),
    );
    expect(mocks.deleteCollection).toHaveBeenCalledWith("c-1");
    expect(mocks.removeProject).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", {
      replace: true,
      state: null,
    });
  });

  it("삭제 요청이 없으면 아무것도 지우지 않는다", async () => {
    render(<Dashboard />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.removeProject).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

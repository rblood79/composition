// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAllProjects = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    projects: {
      getAll: mockGetAllProjects,
    },
  })),
}));

vi.mock("../../env/supabase.client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../builder/stores/history/historyIndexedDB", () => ({
  historyIndexedDB: {
    clearPageHistory: vi.fn(),
  },
}));

import Dashboard from "../index";

describe("Dashboard project creation entry points", () => {
  beforeEach(() => {
    mockGetAllProjects.mockResolvedValue([]);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        window.setTimeout(() => callback(0), 0);
        return 1;
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-builder-theme");
  });

  // "New project" 헤더 버튼은 f94723db1 (2026-08-28) 로 <header> 에서 <main> 의 toolbar 로 옮겨졌다 — 진입점 2곳 유지
  it.each([
    ["toolbar", "toolbar"],
    ["empty state", "empty"],
  ] as const)(
    "shows the project name editor from the %s button when no projects exist",
    async (_entryPoint, surface) => {
      render(<Dashboard />);

      const emptyTitle = await screen.findByText("No projects yet");
      const actionSurface =
        surface === "toolbar"
          ? screen.getByRole("main").querySelector(".dashboard-toolbar")
          : emptyTitle.parentElement;
      if (!actionSurface)
        throw new Error("Project creation surface is required");

      fireEvent.click(
        within(actionSurface).getByRole("button", {
          name: "New project",
        }),
      );

      const projectNameInput = await screen.findByRole("textbox", {
        name: "Project name",
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(projectNameInput);
      });
      expect(screen.queryByText("No projects yet")).toBeNull();
    },
  );
});

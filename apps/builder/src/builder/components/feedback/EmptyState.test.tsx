import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("keeps the DataTable icon-text structure as the shared contract", () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        message="No tables"
        description="Add a new table."
      />,
    );

    const root = container.querySelector(".builder-empty-state");
    expect(root).toBeTruthy();
    expect(
      root
        ?.querySelector(".builder-empty-state-icon")
        ?.contains(screen.getByTestId("empty-icon")),
    ).toBe(true);
    expect(
      screen
        .getByText("No tables")
        .classList.contains("builder-empty-state-message"),
    ).toBe(true);
    expect(
      screen
        .getByText("Add a new table.")
        .classList.contains("builder-empty-state-description"),
    ).toBe(true);
    expect(root?.querySelector(".inspector")).toBeNull();
  });
});

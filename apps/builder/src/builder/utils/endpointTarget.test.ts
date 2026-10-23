import { describe, expect, it } from "vitest";
import type { ApiEndpoint, DataTable } from "../../types/builder/data.types";
import { endpointWithTarget } from "./endpointTarget";

/**
 * 2026-10-24 review: an endpoint linked by id to a deleted collection still sent its stored
 * collection name — a later collection of that name was then loaded by it (the Preview's
 * `reload`, the import's re-pointing). The link is the id: a missing collection is no target.
 */
describe("endpointWithTarget", () => {
  const endpoint = (fields: Partial<ApiEndpoint>) =>
    ({
      id: "e",
      name: "listUsers",
      baseUrl: "https://api.example.test",
      path: "/users",
      method: "GET",
      ...fields,
    }) as ApiEndpoint;
  const collections = new Map([
    ["c-users", { id: "c-users", name: "Users" } as DataTable],
  ]);

  it("names the linked collection and carries its id", () => {
    expect(
      endpointWithTarget(
        endpoint({ targetCollectionId: "c-users", targetCollection: "Old" }),
        collections,
      ),
    ).toMatchObject({ targetCollectionId: "c-users", targetCollection: "Users" });
  });

  it("a link to a deleted collection fills nothing (not the stored name)", () => {
    const sent = endpointWithTarget(
      endpoint({ targetCollectionId: "c-gone", targetCollection: "Users" }),
      collections,
    );
    expect(sent.targetCollection).toBeUndefined();
    expect(sent.targetCollectionId).toBeUndefined();
  });

  it("an endpoint linked by name only keeps the name", () => {
    const sent = endpointWithTarget(
      endpoint({ targetCollection: "Users" }),
      collections,
    );
    expect(sent.targetCollection).toBe("Users");
    expect(sent.targetCollectionId).toBeUndefined();
  });
});

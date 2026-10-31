import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  DataEndpointId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useAsyncList.reload()` — a rule loads an API collection again: the query endpoint that fills it
 * (`targetCollection`) runs after the submits in flight (`await fetch; list.reload()`), its items
 * replace the shown ones and the rules' local edits go. Measurement: jsdom + a `fetch` stub that
 * plays the server (POST appends, GET lists).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;

const warnings = () =>
  (console.warn as unknown as { mock?: { calls: unknown[][] } }).mock?.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]")) ?? [];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

function stubServer(rows: Record<string, unknown>[]) {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    const method = String(init?.method ?? "GET");
    calls.push(method);
    if (method === "POST") {
      // (The server takes a moment: a reload that did not wait would list the old rows.)
      await new Promise((r) => setTimeout(r, 0));
      rows.push({
        id: `u${rows.length + 1}`,
        ...(JSON.parse(String(init?.body)) as object),
      });
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(rows), {
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

const data = (runtimeData: Record<string, unknown>[], useMockData = false) => ({
  type: "CATALOG_DATA",
  version: 1,
  collections: [
    {
      id: "users",
      name: "Users",
      schema: [
        { id: "f-id", key: "id", type: "string" },
        { id: "f-name", key: "name", type: "string" },
      ],
      mockData: [],
      runtimeData,
      useMockData,
    },
  ],
  variables: [],
  apiEndpoints: [
    {
      id: "list",
      name: "listUsers",
      baseUrl: "https://api.example.test",
      path: "/users",
      method: "GET",
      targetCollection: "Users",
    },
    {
      id: "create",
      name: "createUser",
      baseUrl: "https://api.example.test",
      path: "/users",
      method: "POST",
    },
  ],
});

async function reloadPreview(useMockData = false) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "ListBox", "Button"]);
  const [form, list, button] = h.ids as [NodeId, NodeId, NodeId];
  act(() => {
    h.session.receive(data([{ id: "u1", name: "Kim" }], useMockData));
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  const save = (name: string) => {
    const element = h.view.container.querySelector<HTMLFormElement>("form")!;
    const [nameInput, emailInput] = [...element.querySelectorAll("input")];
    act(() => {
      fireEvent.change(nameInput!, { target: { value: name } });
      fireEvent.change(emailInput!, { target: { value: "x@example.test" } });
    });
    act(() => {
      element
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
    });
  };
  const options = () =>
    [...(h.element(list)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.textContent ?? "",
    );
  return { ...h, form, list, button, save, options };
}

describe("reload — useAsyncList.reload", () => {
  it("a Form's submit then reload: the GET runs after the POST settles and the list shows the server's rows", async () => {
    const server = [{ id: "u1", name: "Kim" }];
    const calls = stubServer(server);
    const h = await reloadPreview();
    // (One owner, two rules in order — the Interactions panel's list.)
    const owner = { ownerId: h.form };
    h.workspace.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onSubmit",
            {
              opcode: "callEndpoint",
              endpointId: "data:endpoint:create" as DataEndpointId,
              body: "!event.formData",
            },
            h.workspace.newId,
          ),
          catalogNewInteraction(
            owner,
            "onSubmit",
            { opcode: "reload", collectionId: USERS },
            h.workspace.newId,
          ),
        ],
        "Rules",
      ),
    );
    h.flush();
    h.save("Lee");
    await settle();
    expect(calls).toEqual(["POST", "GET"]);
    expect(h.options()).toEqual([
      expect.stringContaining("Kim"),
      expect.stringContaining("Lee"),
    ]);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("a reload drops the rules' local edits; the Builder's next different items win over it", async () => {
    stubServer([
      { id: "u1", name: "Kim" },
      { id: "u2", name: "Park" },
    ]);
    const h = await reloadPreview();
    act(() => {
      h.session.append("users", { name: "Local" });
    });
    expect(h.options()).toHaveLength(2);
    h.rule(h.button, "onPress", { opcode: "reload", collectionId: USERS });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    await settle();
    expect(h.options()).toEqual([
      expect.stringContaining("Kim"),
      expect.stringContaining("Park"),
    ]);
    act(() => {
      h.session.receive(data([{ id: "u9", name: "Choi" }]));
    });
    expect(h.options()).toEqual([expect.stringContaining("Choi")]);
    h.view.unmount();
  });

  /**
   * 2026-10-24 review: the session found a collection's endpoint by the collection's name — two
   * collections of one name (or a deleted one whose name another took) ran the first endpoint of
   * that name. The endpoint's collection id decides; the name only where the endpoint has no id.
   */
  it("a reload runs the endpoint linked to the collection's id, not the first one of its name", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify([{ id: "u5", name: "Han" }]), {
        headers: { "content-type": "application/json" },
      });
    });
    const h = await reloadPreview();
    const message = data([{ id: "u1", name: "Kim" }]);
    act(() => {
      h.session.receive({
        ...message,
        collections: [
          { ...message.collections[0], id: "users-old" },
          message.collections[0],
        ],
        apiEndpoints: [
          {
            id: "list-old",
            name: "listOldUsers",
            baseUrl: "https://api.example.test",
            path: "/old-users",
            method: "GET",
            targetCollectionId: "users-old",
            targetCollection: "Users",
          },
          { ...message.apiEndpoints[0], targetCollectionId: "users" },
        ],
      });
    });
    h.rule(h.button, "onPress", { opcode: "reload", collectionId: USERS });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    await settle();
    expect(urls).toEqual(["https://api.example.test/users"]);
    expect(h.options()).toEqual([expect.stringContaining("Han")]);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("a mock collection is reported (nothing loads it), with a toast", async () => {
    const calls = stubServer([]);
    const h = await reloadPreview(true);
    h.rule(h.button, "onPress", { opcode: "reload", collectionId: USERS });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    await settle();
    expect(calls).toEqual([]);
    expect(warnings()).toHaveLength(1);
    expect(h.toasts).toHaveLength(1);
    // (ADR-295 후속 C2: a failure the session reports is S2's error toast — `ToastQueue.negative`.)
    expect(h.toastOptions).toEqual([{ variant: "negative" }]);
    h.view.unmount();
  });
});

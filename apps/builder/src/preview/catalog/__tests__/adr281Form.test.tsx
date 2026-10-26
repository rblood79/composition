import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataEndpointId,
  InteractionEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogPreviewRules } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-281 G4 — a Form's submit to an API endpoint (Decision 5, user decisions 3 · 5): the
 * `callEndpoint` action stores an optional `body`, the Preview sends it as JSON with one request
 * per submit (never shared), success is `response.ok`, a failure is reported and toasted.
 * Measurement: jsdom + a `fetch` stub recording each request — the real network is not under test.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const warnings = () =>
  (console.warn as unknown as { mock?: { calls: unknown[][] } }).mock?.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]")) ?? [];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function stubFetch(
  respond: () => Response = () => new Response(null, { status: 204 }),
) {
  const sent: Sent[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    sent.push({
      url: String(input),
      method: String(init?.method),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    });
    return respond();
  });
  return sent;
}

const ENDPOINT = "data:endpoint:signup" as DataEndpointId;

async function formPreview(
  types: readonly string[] = ["Form"],
  method = "POST",
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [],
      variables: [],
      apiEndpoints: [
        {
          id: "signup",
          name: "signup",
          baseUrl: "https://api.example.test",
          path: "/signup",
          method,
          headers: [{ key: "X-Key", value: "k", enabled: true }],
        },
      ],
    });
  });
  const forms = () => [
    ...h.view.container.querySelectorAll<HTMLFormElement>("form"),
  ];
  /**
   * Fill the palette Form's fields (an email field among them — an address fills them all), then
   * name them and make them optional right before the submit (a re-render resets both).
   */
  const fill = (form: HTMLFormElement, value: string) => {
    form.querySelectorAll("input").forEach((input, index) => {
      act(() => {
        fireEvent.change(input, {
          target: { value: `${value}${index}@example.test` },
        });
      });
    });
    form.querySelectorAll("input").forEach((input, index) => {
      input.removeAttribute("required");
      input.setAttribute("name", `field${index}`);
    });
  };
  return { ...h, forms, fill };
}

describe("ADR-281 G4 — storage", () => {
  it("a callEndpoint rule with a body and one without both pass, reopen the same; another key is refused", async () => {
    const h = await formPreview(["Form", "Form"]);
    const [form, other] = h.ids as [NodeId, NodeId];
    h.rule(form, "onSubmit", { opcode: "callEndpoint", endpointId: ENDPOINT });
    h.rule(other, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "!event.formData",
    });
    const graph = h.workspace.runtime.graph;
    const exported = graph.exportDocument();
    const library = await buildCodeCatalogLibrary();
    const reopened = new CatalogGraph(structuredClone(exported), library);
    const actions = (g: CatalogGraph) =>
      Object.values(g.exportDocument().entries)
        .filter(
          (entry): entry is InteractionEntry => entry.kind === "interaction",
        )
        .map((entry) => entry.action);
    expect(actions(reopened)).toEqual(actions(graph));
    expect(actions(reopened)).toContainEqual({
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
    });
    const broken = structuredClone(exported);
    const rule = Object.values(broken.entries).find(
      (entry) => entry.kind === "interaction",
    ) as InteractionEntry;
    (rule.action as unknown as Record<string, unknown>).extra = 1;
    expect(() => new CatalogGraph(broken, library)).toThrow();
    // The Preview rule carries the body (no prefix on the endpoint id).
    const rules = catalogPreviewRules(h.session.graph!, h.session.root!).filter(
      (item) => item.action.kind === "callEndpoint",
    );
    expect(rules.map((item) => item.action)).toEqual([
      { kind: "callEndpoint", endpointId: "signup" },
      { kind: "callEndpoint", endpointId: "signup", body: "!event.formData" },
    ]);
    h.view.unmount();
  });
});

describe("ADR-281 G4 — execution", () => {
  it("the Form's !event.formData goes as JSON — the same body by the submit capability and by the user's submit", async () => {
    const sent = stubFetch();
    const h = await formPreview(["Form", "Button"]);
    const [form, button] = h.ids as [NodeId, NodeId];
    h.rule(form, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "!event.formData",
    });
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: form },
      capabilityId: "submit",
    });
    const [element] = h.forms();
    h.fill(element!, "v");
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    expect(sent).toHaveLength(1);
    element!.querySelectorAll("input").forEach((input, index) => {
      input.removeAttribute("required");
      input.setAttribute("name", `field${index}`);
    });
    act(() => {
      fireEvent.submit(element!);
    });
    await settle();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      url: "https://api.example.test/signup",
      method: "POST",
      headers: { "X-Key": "k", "Content-Type": "application/json" },
    });
    expect(sent[0]!.body).toMatchObject({ field0: "v0@example.test" });
    expect(sent[1]!.body).toEqual(sent[0]!.body);
    expect(warnings()).toEqual([]);
    expect(h.toasts).toEqual([]);
    h.view.unmount();
  });

  it("two Forms submitting to one endpoint send two requests, each its own body (the query shares — control)", async () => {
    const sent = stubFetch();
    const h = await formPreview(["Form", "Form"]);
    const [a, b] = h.ids as [NodeId, NodeId];
    h.rule(a, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "first",
    });
    h.rule(b, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "second",
    });
    const [one, two] = h.forms();
    h.fill(one!, "a");
    h.fill(two!, "b");
    act(() => {
      fireEvent.submit(one!);
      fireEvent.submit(two!);
    });
    await settle();
    expect(sent.map((request) => request.body)).toEqual(["first", "second"]);
    // (Control: the collection query shares one in-flight request per endpoint.)
    sent.length = 0;
    const execute =
      h.session.dataServices.apiEndpointService!.executeApiEndpoint!;
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      sent.push({
        url: String(input),
        method: String(init?.method),
        headers: {},
        body: undefined,
      });
      return new Response("[]", {
        headers: { "content-type": "application/json" },
      });
    });
    await act(async () => {
      await Promise.all([execute("signup"), execute("signup")]);
    });
    expect(sent).toHaveLength(1);
    h.view.unmount();
  });

  it("a GET endpoint is reported, nothing is sent", async () => {
    const sent = stubFetch();
    const h = await formPreview(["Form"], "GET");
    const [form] = h.ids as [NodeId];
    h.rule(form, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "x",
    });
    const [element] = h.forms();
    h.fill(element!, "v");
    act(() => {
      fireEvent.submit(element!);
    });
    await settle();
    expect(sent).toEqual([]);
    expect(warnings()).toHaveLength(1);
    h.view.unmount();
  });

  it("an empty required field: RAC does not submit — no request", async () => {
    const sent = stubFetch();
    const h = await formPreview(["Form", "Button"]);
    const [form, button] = h.ids as [NodeId, NodeId];
    h.rule(form, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "x",
    });
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: form },
      capabilityId: "submit",
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    expect(sent).toEqual([]);
    h.view.unmount();
  });
});

describe("ADR-281 G4 — the response (success = response.ok)", () => {
  const json = { headers: { "content-type": "application/json" } };
  const cases: [string, number, () => Response][] = [
    ["204", 0, () => new Response(null, { status: 204 })],
    ["an empty JSON body", 0, () => new Response("", json)],
    [
      "text/plain",
      0,
      () => new Response("ok", { headers: { "content-type": "text/plain" } }),
    ],
    ["JSON", 0, () => new Response('{"id":1}', json)],
    [
      "500",
      1,
      () => new Response("no", { status: 500, statusText: "Server Error" }),
    ],
  ];
  it.each(cases)("%s → toasts %i", async (_name, failures, respond) => {
    stubFetch(respond);
    const h = await formPreview();
    const [form] = h.ids as [NodeId];
    h.rule(form, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "x",
    });
    const [element] = h.forms();
    h.fill(element!, "v");
    act(() => {
      fireEvent.submit(element!);
    });
    await settle();
    expect(h.toasts).toHaveLength(failures);
    expect(warnings()).toHaveLength(failures);
    h.view.unmount();
  });
});

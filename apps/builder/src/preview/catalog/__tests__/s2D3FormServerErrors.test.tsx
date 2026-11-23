import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataEndpointId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogFinalOutcome,
  executeInteractionRule,
  type DispatchDeps,
} from "../../../../../../packages/shared/src/interactions/dispatcher";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 Form `validationErrors` from a submit's response:
 *   - the endpoint's `responseMapping.errorsPath` names where the response holds its field errors
 *     (each field `name` → a message or messages); a refused (422) or ok response holding them puts
 *     them on the Form that sent it — RAC shows each on its field until the user changes it
 *   - 사용자 결정 1: the Dos after a `callEndpoint` wait for its response and stop when it failed
 *     (the 「saved」 toast never shows over field errors)
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const ENDPOINT = "data:endpoint:signup" as DataEndpointId;
const JSON_HEADERS = { "content-type": "application/json" };

async function signup(respond: () => Response, errorsPath = "errors") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => respond());
  const h = await openAdr280Preview(["Form"]);
  const [formId] = h.ids as [NodeId];
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
          method: "POST",
          headers: [],
          responseMapping: { dataPath: "", errorsPath },
        },
      ],
    });
  });
  // (The Form's first field is `email`; the others are optional — only the server refuses.)
  const inputs = () => [
    ...h.view.container.querySelectorAll<HTMLInputElement>("form input"),
  ];
  const fieldIdOf = (input: HTMLInputElement) =>
    (input.closest(".react-aria-TextField") as HTMLElement)
      .getAttribute("data-catalog-id")!
      .split("::")
      .pop() as NodeId;
  // (The first field is the Form's own node; the others are the template's — not declared.)
  h.declare(fieldIdOf(inputs()[0]!), { name: "email", isRequired: false });
  h.rule(formId, "onSubmit", [
    { opcode: "callEndpoint", endpointId: ENDPOINT, body: "!event.formData" },
    { opcode: "toast", message: "saved" },
  ] as never);
  const submit = async () => {
    inputs().forEach((input) => input.removeAttribute("required"));
    act(() => {
      fireEvent.submit(h.view.container.querySelector("form")!);
    });
    await settle();
  };
  const email = () => inputs()[0]!;
  const field = () => email().closest(".react-aria-TextField") as HTMLElement;
  return { ...h, formId, fetch, submit, email, field };
}

describe("S2 D.3 Form validationErrors — a submit's field errors", () => {
  it("a 422 with errors: the email field shows the server's message, invalid; the Do after it does not run; editing clears it", async () => {
    const h = await signup(
      () =>
        new Response(
          JSON.stringify({ errors: { email: "이미 가입된 주소입니다" } }),
          { status: 422, headers: JSON_HEADERS },
        ),
    );
    await h.submit();
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.field().textContent).toContain("이미 가입된 주소입니다");
    expect(h.email().getAttribute("aria-invalid")).toBe("true");
    // (Field errors are shown on the fields — no failure toast, and 「saved」 waits for an ok.)
    expect(h.toasts).toEqual([]);
    act(() => {
      fireEvent.change(h.email(), { target: { value: "new@example.test" } });
    });
    expect(h.field().textContent).not.toContain("이미 가입된 주소입니다");
    expect(h.email().getAttribute("aria-invalid")).not.toBe("true");
    h.view.unmount();
  });

  it("messages as a list (Zod flatten) — every one is shown", async () => {
    const h = await signup(
      () =>
        new Response(
          JSON.stringify({
            data: {
              fieldErrors: { email: ["형식이 틀립니다", "너무 깁니다"] },
            },
          }),
          { status: 400, headers: JSON_HEADERS },
        ),
      "data.fieldErrors",
    );
    await h.submit();
    expect(h.field().textContent).toContain("형식이 틀립니다");
    expect(h.field().textContent).toContain("너무 깁니다");
    h.view.unmount();
  });

  it("an ok response: no field error, the Do after it runs (once the response came)", async () => {
    const h = await signup(
      () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: JSON_HEADERS,
        }),
    );
    await h.submit();
    expect(h.email().getAttribute("aria-invalid")).not.toBe("true");
    expect(h.toasts).toEqual(["saved"]);
    h.view.unmount();
  });

  it("a refused response without field errors: a failure toast, the Do after it does not run", async () => {
    const h = await signup(
      () => new Response("no", { status: 500, statusText: "Server Error" }),
    );
    await h.submit();
    expect(h.toasts).toEqual(["HTTP 500: Server Error"]);
    h.view.unmount();
  });

  it("aria (the submit is not blocked): an ok response after a refused one clears the field errors", async () => {
    let status = 422;
    const h = await signup(
      () =>
        status === 422
          ? new Response(
              JSON.stringify({ errors: { email: "이미 가입된 주소입니다" } }),
              { status: 422, headers: JSON_HEADERS },
            )
          : new Response(JSON.stringify({ id: 1 }), {
              status: 200,
              headers: JSON_HEADERS,
            }),
    );
    h.declare(h.formId, { validationBehavior: "aria" });
    await h.submit();
    expect(h.field().textContent).toContain("이미 가입된 주소입니다");
    status = 200;
    await h.submit();
    expect(h.field().textContent).not.toContain("이미 가입된 주소입니다");
    expect(h.toasts).toEqual(["saved"]);
    h.view.unmount();
  });

  it("an ok response holding field errors is refused too", async () => {
    const h = await signup(
      () =>
        new Response(JSON.stringify({ errors: { email: "확인 필요" } }), {
          status: 200,
          headers: JSON_HEADERS,
        }),
    );
    await h.submit();
    expect(h.field().textContent).toContain("확인 필요");
    expect(h.toasts).toEqual([]);
    h.view.unmount();
  });
});

describe("S2 D.3 — the Dos after a Do that settles later (사용자 결정 1)", () => {
  const rule = {
    id: "r",
    type: "interaction" as const,
    elementId: "form",
    trigger: "onSubmit",
    actions: [
      { kind: "callEndpoint" as const, endpointId: "signup" },
      {
        kind: "setState" as const,
        variableId: "v",
        op: "set" as const,
        value: 1,
      },
    ],
  };
  const depsWith = (ok: boolean) => {
    let resolve!: (value: { ok: boolean; reason?: string }) => void;
    const writes: unknown[] = [];
    const called: (string | undefined)[] = [];
    const deps: DispatchDeps = {
      getElement: () => undefined,
      updateElementProps: () => {},
      navigate: () => {},
      showToast: () => {},
      callEndpoint: (_endpoint, _body, elementId) => {
        called.push(elementId);
        return {
          ok: true,
          settled: new Promise((r) => {
            resolve = r;
          }),
        };
      },
      writeState: (request) => {
        writes.push(request.value);
        return { ok: true };
      },
    };
    return {
      deps,
      writes,
      called,
      settle: () => resolve({ ok, reason: "422" }),
    };
  };

  it("the next Do runs after the response, with the rule's record as the sender", async () => {
    const { deps, writes, called, settle } = depsWith(true);
    const outcome = executeInteractionRule(rule, deps);
    expect(outcome.ok).toBe(true);
    expect(called).toEqual(["form"]);
    expect(writes).toEqual([]);
    settle();
    const final = await catalogFinalOutcome(outcome);
    expect(final).toMatchObject({ ok: true, kind: "setState" });
    expect(writes).toEqual([1]);
  });

  it("a failed response stops the list — numbered as its Do", async () => {
    const { deps, writes, settle } = depsWith(false);
    const outcome = executeInteractionRule(rule, deps);
    settle();
    const final = await catalogFinalOutcome(outcome);
    expect(final).toEqual({ ok: false, reason: "Do 1: 422" });
    expect(writes).toEqual([]);
  });
});

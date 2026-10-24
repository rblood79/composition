export type EditingSemanticsImpactConfirmationRequest = {
  countDurationMs: number;
  kind?: "origin-impact";
  impactedInstanceIds: string[];
  instanceCount: number;
  originId: string;
  originLabel: string;
};

export type EditingSemanticsDetachConfirmationRequest = {
  instanceId: string;
  instanceLabel: string;
  kind: "detach-instance";
  originId?: string | null;
  originLabel?: string | null;
};

/**
 * ADR-282 Decision 6 · 10: resetting library origins to the library default — how many origins,
 * the instances that follow, and what instances filled only at positions made after an unlock
 * (it goes with the reset).
 */
export type EditingSemanticsResetConfirmationRequest = {
  kind: "origin-reset";
  originCount: number;
  instanceCount: number;
  lostInstanceCount: number;
  lostNodeCount: number;
};

export type EditingSemanticsConfirmationRequest =
  | EditingSemanticsImpactConfirmationRequest
  | EditingSemanticsDetachConfirmationRequest
  | EditingSemanticsResetConfirmationRequest;

type Listener = (request: EditingSemanticsConfirmationRequest | null) => void;

let activeRequest: EditingSemanticsConfirmationRequest | null = null;
let activeResolve: ((confirmed: boolean) => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(activeRequest);
  }
}

function fallbackConfirm(
  request: EditingSemanticsConfirmationRequest,
): boolean {
  const confirmFn = globalThis.window?.confirm;
  if (typeof confirmFn !== "function") return true;
  if (request.kind === "detach-instance") {
    return confirmFn("Detach this instance from its component?");
  }
  if (request.kind === "origin-reset")
    return confirmFn(
      `Reset ${request.originCount} origin(s) to the library default?`,
    );

  const label =
    request.instanceCount === 1
      ? "1 instance"
      : `${request.instanceCount} instances`;
  return confirmFn(`Editing this component will affect ${label}. Continue?`);
}

export function subscribeEditingSemanticsImpactConfirmation(
  listener: Listener,
): () => void {
  listeners.add(listener);
  listener(activeRequest);
  return () => {
    listeners.delete(listener);
  };
}

export function requestEditingSemanticsImpactConfirmation(
  request: EditingSemanticsImpactConfirmationRequest,
): Promise<boolean> {
  return requestEditingSemanticsConfirmation({
    ...request,
    kind: request.kind ?? "origin-impact",
  });
}

export function requestEditingSemanticsResetConfirmation(
  request: Omit<EditingSemanticsResetConfirmationRequest, "kind">,
): Promise<boolean> {
  return requestEditingSemanticsConfirmation({
    ...request,
    kind: "origin-reset",
  });
}

export function requestEditingSemanticsDetachConfirmation(
  request: Omit<EditingSemanticsDetachConfirmationRequest, "kind">,
): Promise<boolean> {
  return requestEditingSemanticsConfirmation({
    ...request,
    kind: "detach-instance",
  });
}

function requestEditingSemanticsConfirmation(
  request: EditingSemanticsConfirmationRequest,
): Promise<boolean> {
  if (listeners.size === 0) {
    return Promise.resolve(fallbackConfirm(request));
  }

  if (activeResolve) {
    activeResolve(false);
  }

  activeRequest = request;
  notify();

  return new Promise<boolean>((resolve) => {
    activeResolve = resolve;
  });
}

export function resolveEditingSemanticsImpactConfirmation(
  confirmed: boolean,
): void {
  const resolve = activeResolve;
  activeResolve = null;
  activeRequest = null;
  notify();
  resolve?.(confirmed);
}

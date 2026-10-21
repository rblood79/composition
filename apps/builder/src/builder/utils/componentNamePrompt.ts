/**
 * ADR-279 Decision 3a — the name a new component gets: Create component opens a small dialog
 * (the default name filled in — the node's name, else its type; Enter confirms, Escape cancels
 * with no step). The same request bus as the component impact dialog: the Builder mounts one
 * host (`ComponentNameDialogHost`); with no host (tests, the AI executor) the default name is
 * taken at once.
 */

export interface ComponentNameRequest {
  defaultName: string;
}

type Listener = (request: ComponentNameRequest | null) => void;

let activeRequest: ComponentNameRequest | null = null;
let activeResolve: ((name: string | null) => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(activeRequest);
}

export function subscribeComponentNameRequest(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeRequest);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ask for the component's name; `null` = cancelled. No host = the default name, at once (the
 * step runs synchronously — the shortcut, the AI executor and the tests see it right away).
 */
export function requestComponentName(
  request: ComponentNameRequest,
): string | Promise<string | null> {
  if (listeners.size === 0) return request.defaultName;
  if (activeResolve) activeResolve(null);
  activeRequest = request;
  notify();
  return new Promise<string | null>((resolve) => {
    activeResolve = resolve;
  });
}

/** The host's answer: the typed name (trimmed, non-empty) or `null` for cancel. */
export function resolveComponentNameRequest(name: string | null): void {
  const resolve = activeResolve;
  activeResolve = null;
  activeRequest = null;
  notify();
  resolve?.(name?.trim() || null);
}

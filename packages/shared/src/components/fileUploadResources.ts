import type { LazyState } from "./FileUpload.runtime";

/** A single in-flight lazy import, with loading and failure snapshots shared by subscribers. */
export class FileUploadModuleResource<T> {
  private snapshot: LazyState<T> = { status: "idle" };
  private listeners = new Set<() => void>();
  constructor(private readonly loader: () => Promise<T | null>) {}
  readonly getSnapshot = (): LazyState<T> => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(snapshot: LazyState<T>): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  load(): void {
    if (this.snapshot.status !== "idle") return;
    this.publish({ status: "loading" });
    try {
      void this.loader().then(
        (mod) =>
          this.publish(
            mod ? { status: "ready", mod } : { status: "unavailable" },
          ),
        () => this.publish({ status: "unavailable" }),
      );
    } catch {
      this.publish({ status: "unavailable" });
    }
  }
}

/** Files await module and endpoint readiness; a blocked endpoint drains this inbox. */
export class FileUploadInbox {
  private files: File[] = [];
  private listeners = new Set<() => void>();
  readonly getSnapshot = (): File[] => this.files;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  add(files: File[]): void {
    this.files = [...this.files, ...files];
    for (const listener of this.listeners) listener();
  }
  drain(): void {
    if (this.files.length === 0) return;
    this.files = [];
    for (const listener of this.listeners) listener();
  }
}

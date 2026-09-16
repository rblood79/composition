/**
 * 업로드 큐 — 동시 N (`parallelUploads`) · pause/resume/cancel · 폴더 트리 평탄화 · command 실행.
 *
 * 상태 전이는 전부 `reduce` (sans-I/O) 가 결정하고, 여기서는 command 만 실행한다:
 * http → adapter.request → driver.send → adapter.response → 다시 reduce.
 */
import { createTusAdapter } from "../adapters/tus";
import {
  DEFAULT_CAPABILITIES,
  type AdapterCapabilities,
  type WireAdapter,
} from "../adapters/types";
import { errorOf } from "../errors";
import type {
  HttpDriver,
  ResumeStorage,
  UploadError,
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "../types";
import { createMemoryStorage, resolveStorage } from "./drivers/storage";
import { createXhrDriver } from "./drivers/xhr";
import { fingerprint } from "./fingerprint";
import { initialState, reduce } from "./protocol";
import type { Command, UploadEvent, UploadState } from "./protocol/types";

const MB = 1024 ** 2;
const MIN_CHUNK = 1 * MB;

/** `webkitRelativePath` 가 없는 File (DataTransfer entry 등) 에 상대 경로를 붙이는 채널 */
const RELATIVE_PATHS = new WeakMap<File, string>();
export function withRelativePath<T extends File>(
  file: T,
  relativePath: string,
): T {
  RELATIVE_PATHS.set(file, relativePath);
  return file;
}
export const relativePathOf = (file: File): string | undefined =>
  (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
  RELATIVE_PATHS.get(file) ||
  undefined;

interface Item {
  state: UploadState;
  file: File;
  ctl?: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  /** abort/pause/cancel 마다 증가 — 늦게 도착한 응답 무시 */
  gen: number;
  /** 사용자가 시작을 요청했고 슬롯을 기다린다 */
  wanted: boolean;
  ready: boolean;
  chunkSize: number;
}

const ACTIVE = new Set(["creating", "uploading"]);

/**
 * driver / adapter 는 지연 로드 — 브라우저 기본 경로 (XHR + tus) 만 초기 청크에 싣고
 * dry-run · fetch (Node/Electron) · multipart 는 옵션이 켜질 때만 `import()` (HC1 core+tus ≤ 6KB gz).
 */
const resolveDriver = (o: UploadQueueOptions): Promise<HttpDriver> =>
  o.driver
    ? Promise.resolve(o.driver)
    : o.dryRun
      ? import("./drivers/dryRun").then((m) => m.createDryRunDriver())
      : typeof XMLHttpRequest !== "undefined"
        ? Promise.resolve(createXhrDriver())
        : import("./drivers/fetch").then((m) => m.createFetchDriver());

export function createUploadQueue(options: UploadQueueOptions): UploadQueue {
  const o = {
    protocol: "tus" as const,
    chunkSize: 8 * MB,
    parallelUploads: 3,
    retryDelays: [0, 1000, 3000, 5000],
    withCredentials: true,
    autoProceed: true,
    checksum: true,
    ...options,
  };
  const single = o.protocol === "multipart";
  const wire: Promise<[HttpDriver, WireAdapter]> = Promise.all([
    resolveDriver(o),
    single
      ? import("../adapters/multipart").then((m) => m.createMultipartAdapter())
      : createTusAdapter({
          overridePatchMethod: o.overridePatchMethod,
          checksum: o.checksum,
        }),
  ]);
  const storage: ResumeStorage = o.dryRun
    ? createMemoryStorage()
    : (o.storage ?? resolveStorage());

  const items = new Map<string, Item>();
  const order: string[] = [];
  const listeners = new Set<(items: UploadItemState[]) => void>();
  let seq = 0;
  const session = Math.random().toString(36).slice(2, 8);
  let destroyed = false;
  let caps: AdapterCapabilities | null = null;
  let capsPromise: Promise<AdapterCapabilities> | null = null;
  let snapshot: UploadItemState[] | null = null;
  let notifyPending = false;

  // --- 알림 (microtask 로 묶음) ---------------------------------------------
  const publicState = (s: UploadState): UploadItemState => {
    const { committed: _c, inflight: _i, expires: _e, ...pub } = s;
    return pub;
  };
  const getItems = (): UploadItemState[] =>
    (snapshot ??= order.map((id) => publicState(items.get(id)!.state)));
  const notify = () => {
    snapshot = null;
    if (notifyPending || destroyed) return;
    notifyPending = true;
    queueMicrotask(() => {
      notifyPending = false;
      if (destroyed) return;
      const list = getItems();
      for (const l of listeners) l(list);
    });
  };

  // --- 능력 (OPTIONS 1회) ----------------------------------------------------
  const resolveHeaders = async (): Promise<Record<string, string>> => ({
    ...o.headers,
    ...((await o.getHeaders?.()) ?? {}),
  });
  const ensureCaps = (): Promise<AdapterCapabilities> =>
    (capsPromise ??= (async () => {
      const [driver, adapter] = await wire;
      const headers = await resolveHeaders();
      const c = adapter.preflight
        ? await adapter.preflight({
            endpoint: o.endpoint,
            headers,
            driver,
            withCredentials: o.withCredentials,
          })
        : { ...DEFAULT_CAPABILITIES };
      caps = c;
      return c;
    })());

  // --- 슬롯 ----------------------------------------------------------------
  const activeCount = () => {
    let n = 0;
    for (const it of items.values()) if (ACTIVE.has(it.state.status)) n++;
    return n;
  };
  const pump = () => {
    if (destroyed) return;
    let free = o.parallelUploads - activeCount();
    for (const id of order) {
      if (free <= 0) break;
      const it = items.get(id)!;
      if (it.wanted && it.ready && !ACTIVE.has(it.state.status)) {
        it.wanted = false;
        dispatch(it, { kind: "start" });
        free--;
      }
    }
  };

  // --- reduce + command 실행 --------------------------------------------------
  const dispatch = (it: Item, event: UploadEvent) => {
    if (destroyed) return;
    const before = it.state;
    const [next, cmds] = reduce(before, event, {
      chunkSize: caps?.chunkClamp ?? it.chunkSize,
      retryDelays: o.retryDelays,
      now: Date.now(),
      terminate: !!caps?.terminate,
      single,
    });
    if (event.kind === "fail" && event.error.code === "E_PROXY_TIMEOUT") {
      // R1 — 프록시 timeout 은 청크가 너무 크다는 신호. 다음 청크부터 절반 (하한 1MB)
      it.chunkSize = Math.max(MIN_CHUNK, Math.floor(it.chunkSize / 2));
    }
    it.state = next;
    for (const cmd of cmds) exec(it, cmd);
    if (next !== before) notify();
    if (before.status !== next.status && !ACTIVE.has(next.status)) pump();
  };

  const fail = (it: Item, err: unknown) => {
    const e = err as Partial<UploadError> | null;
    const error: UploadError =
      e && typeof e.code === "string" && typeof e.retryable === "boolean"
        ? {
            code: e.code,
            message: String(e.message ?? ""),
            retryable: e.retryable,
            status: e.status,
          }
        : errorOf("E_NETWORK", 0, String((err as Error)?.message ?? err));
    dispatch(it, { kind: "fail", error });
  };

  const exec = (it: Item, cmd: Command) => {
    switch (cmd.kind) {
      case "http": {
        const gen = it.gen;
        const op = cmd.op;
        const range = { start: cmd.start ?? 0, end: cmd.end ?? 0 };
        (async () => {
          const c = await ensureCaps();
          const [driver, adapter] = await wire;
          if (gen !== it.gen) return;
          if (
            op === "create" &&
            c.maxSize !== undefined &&
            it.file.size > c.maxSize
          ) {
            throw errorOf(
              "E_TOO_LARGE",
              413,
              `${it.file.size} > Tus-Max-Size ${c.maxSize}`,
            );
          }
          const headers = await resolveHeaders();
          const ctx = {
            endpoint: o.endpoint,
            file: it.file,
            state: cmd.url ? { ...it.state, url: cmd.url } : it.state,
            headers,
            metadata: o.metadata ?? {},
            withCredentials: o.withCredentials,
          };
          const req = await adapter.request(op, ctx, range, c);
          if (gen !== it.gen) return;
          const ctl = new AbortController();
          it.ctl = ctl;
          req.signal = ctl.signal;
          req.withCredentials = o.withCredentials;
          if (o.requestTimeout) req.timeout = o.requestTimeout;
          if (op === "patch" || (op === "create" && single)) {
            req.onProgress = (loaded) => {
              if (gen === it.gen)
                dispatch(it, { kind: "chunk-sent", bytes: loaded });
            };
          }
          const res = await driver.send(req);
          if (gen !== it.gen || op === "delete") return;
          it.ctl = undefined;
          dispatch(it, adapter.response(op, res, ctx, c));
        })().catch((err) => {
          if (gen !== it.gen || op === "delete") return;
          it.ctl = undefined;
          fail(it, err);
        });
        break;
      }
      case "persist":
        void Promise.resolve(
          storage.set(cmd.fingerprint, { url: cmd.url, expires: cmd.expires }),
        ).catch(() => {});
        break;
      case "forget":
        if (cmd.fingerprint)
          void Promise.resolve(storage.remove(cmd.fingerprint)).catch(() => {});
        break;
      case "wait":
        clearTimeout(it.timer);
        it.timer = setTimeout(() => {
          it.timer = undefined;
          dispatch(it, { kind: "retry" });
        }, cmd.ms);
        break;
      case "abort":
        it.gen++;
        it.ctl?.abort();
        it.ctl = undefined;
        clearTimeout(it.timer);
        it.timer = undefined;
        break;
    }
  };

  // --- 공용 API ---------------------------------------------------------------
  const targets = (id: string | undefined): Item[] =>
    id === undefined
      ? order.map((k) => items.get(k)!)
      : items.has(id)
        ? [items.get(id)!]
        : [];

  const add = (files: File[]): UploadItemState[] => {
    const added: Item[] = [];
    for (const file of files) {
      const id = `${session}-${++seq}`;
      const relativePath = relativePathOf(file);
      const state = initialState({
        id,
        fingerprint: "",
        name: file.name,
        size: file.size,
        type: file.type,
        ...(relativePath ? { relativePath } : {}),
      });
      const it: Item = {
        state,
        file,
        gen: 0,
        wanted: false,
        ready: false,
        chunkSize: o.chunkSize,
      };
      if (o.maxFileSize !== undefined && file.size > o.maxFileSize) {
        it.state = {
          ...state,
          status: "error",
          lastError: errorOf(
            "E_TOO_LARGE",
            undefined,
            `${file.size} > maxFileSize ${o.maxFileSize}`,
          ),
        };
        it.ready = true;
      } else {
        it.wanted = o.autoProceed;
        void fingerprint(
          {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            relativePath,
          },
          o.endpoint,
        )
          .then(async (fp) => {
            if (destroyed || !items.has(id)) return;
            it.state = { ...it.state, fingerprint: fp };
            try {
              const rec = await storage.get(fp);
              if (rec && !(rec.expires && Date.now() >= rec.expires)) {
                it.state = { ...it.state, url: rec.url, expires: rec.expires };
              }
            } catch {
              /* 저장소 없음 */
            }
          })
          .finally(() => {
            if (destroyed || !items.has(id)) return;
            it.ready = true;
            notify();
            pump();
          });
      }
      items.set(id, it);
      order.push(id);
      added.push(it);
    }
    notify();
    return added.map((it) => publicState(it.state));
  };

  const start = (id?: string) => {
    for (const it of targets(id)) {
      if (it.state.status === "done" || ACTIVE.has(it.state.status)) continue;
      it.wanted = true;
    }
    pump();
  };
  const pause = (id?: string) => {
    for (const it of targets(id)) {
      it.wanted = false;
      dispatch(it, { kind: "pause" });
    }
  };
  const resume = (id?: string) => {
    for (const it of targets(id)) {
      if (
        it.state.status === "paused" ||
        (it.state.status === "error" &&
          it.state.lastError?.code !== "E_CANCELLED")
      ) {
        it.wanted = true;
      }
    }
    pump();
  };
  const cancel = (id?: string) => {
    for (const it of targets(id)) {
      it.wanted = false;
      dispatch(it, { kind: "cancel" });
    }
  };
  const remove = (id: string) => {
    const it = items.get(id);
    if (!it) return;
    it.wanted = false;
    if (it.state.status !== "done") dispatch(it, { kind: "cancel" });
    items.delete(id);
    order.splice(order.indexOf(id), 1);
    notify();
    pump();
  };
  const subscribe = (listener: (items: UploadItemState[]) => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  const destroy = () => {
    for (const it of items.values()) exec(it, { kind: "abort" });
    listeners.clear();
    destroyed = true;
  };

  return {
    add,
    start,
    pause,
    resume,
    cancel,
    remove,
    getItems,
    subscribe,
    destroy,
  };
}

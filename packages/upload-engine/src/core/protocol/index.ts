/**
 * sans-I/O 업로드 상태기계 (ADR-201 §3-2).
 *
 * `reduce(state, event, config) → [state, commands]` — 순수 함수. 브라우저 API · 타이머 · 네트워크 0.
 * driver/queue 가 `Command` 를 실행하고 결과를 `UploadEvent` 로 되돌린다.
 *
 * 불변 조건:
 * - `committed` 는 서버 `Upload-Offset` 으로만 바뀐다 (`offset` 이벤트). 클라이언트 카운터는 힌트.
 * - 실패 뒤에는 항상 서버에 묻는다 (`head`) — 재전송은 마지막 청크 이하.
 * - 만료(`E_EXPIRED`)·완료·취소 시 `forget` — 저장소에 url 이 남지 않는다.
 */
import type { UploadError } from "../../types";
import type {
  Command,
  ProtocolConfig,
  UploadEvent,
  UploadState,
} from "./types";

export type {
  Command,
  HttpOp,
  ProtocolConfig,
  UploadEvent,
  UploadState,
} from "./types";

type Step = [UploadState, Command[]];

const ACTIVE = new Set(["creating", "uploading"]);

const nextChunk = (s: UploadState, c: ProtocolConfig): Step => {
  const start = s.committed;
  const end = Math.min(start + c.chunkSize, s.size);
  return [
    { ...s, status: "uploading", offset: start, inflight: { start, end } },
    [{ kind: "http", op: "patch", start, end }],
  ];
};

const complete = (s: UploadState): Step => [
  {
    ...s,
    status: "done",
    offset: s.size,
    committed: s.size,
    inflight: undefined,
    lastError: undefined,
  },
  [{ kind: "forget", fingerprint: s.fingerprint }],
];

const create = (
  s: UploadState,
  c: ProtocolConfig,
  pre: Command[] = [],
): Step => [
  {
    ...s,
    status: "creating",
    url: undefined,
    offset: 0,
    committed: 0,
    inflight: undefined,
    expires: undefined,
  },
  [
    ...pre,
    { kind: "http", op: "create", start: 0, end: c.single ? s.size : 0 },
  ],
];

/** 시작·재개·재시도의 공통 진입 — url 이 있으면 HEAD 로 서버 offset 을 묻고, 없으면 생성 */
const begin = (s: UploadState, c: ProtocolConfig): Step => {
  if (s.url && s.expires !== undefined && c.now >= s.expires) {
    return create(s, c, [{ kind: "forget", fingerprint: s.fingerprint }]);
  }
  if (s.url && !c.single) {
    return [
      { ...s, status: "uploading", offset: s.committed, inflight: undefined },
      [{ kind: "http", op: "head" }],
    ];
  }
  return create(s, c);
};

const fail = (s: UploadState, error: UploadError, c: ProtocolConfig): Step => {
  const canRetry = s.attempt < c.retryDelays.length;
  const base: UploadState = {
    ...s,
    inflight: undefined,
    offset: s.committed,
    lastError: error,
    attempt: s.attempt + 1,
  };
  if (error.code === "E_EXPIRED") {
    // 서버가 업로드를 잊었다 — 저장소도 잊고 처음부터
    const forget: Command = { kind: "forget", fingerprint: s.fingerprint };
    return canRetry
      ? create(base, c, [forget])
      : [{ ...base, status: "error", url: undefined, committed: 0 }, [forget]];
  }
  if (error.code === "E_OFFSET_MISMATCH" && s.url && canRetry) {
    return [{ ...base, status: "uploading" }, [{ kind: "http", op: "head" }]];
  }
  if (error.retryable && canRetry) {
    return [base, [{ kind: "wait", ms: c.retryDelays[s.attempt] }]];
  }
  return [{ ...base, status: "error" }, []];
};

export function reduce(
  s: UploadState,
  e: UploadEvent,
  c: ProtocolConfig,
): Step {
  switch (e.kind) {
    case "start":
      if (s.status === "done") return [s, []];
      return begin({ ...s, attempt: 0, lastError: undefined }, c);
    case "retry":
      return ACTIVE.has(s.status) ? begin(s, c) : [s, []];
    case "created": {
      if (s.status !== "creating") return [s, []];
      const committed = Math.min(e.offset ?? 0, s.size);
      const next: UploadState = {
        ...s,
        url: e.url,
        committed,
        offset: committed,
        expires: e.expires,
        attempt: 0,
        lastError: undefined,
      };
      const persist: Command[] = c.single
        ? []
        : [
            {
              kind: "persist",
              fingerprint: s.fingerprint,
              url: e.url,
              expires: e.expires,
            },
          ];
      if (committed >= s.size) {
        const [done, cmds] = complete(next);
        return [done, [...persist, ...cmds]];
      }
      const [st, cmds] = nextChunk(next, c);
      return [st, [...persist, ...cmds]];
    }
    case "chunk-sent": {
      if (!ACTIVE.has(s.status)) return [s, []];
      const offset = s.inflight
        ? Math.min(s.inflight.start + e.bytes, s.inflight.end)
        : Math.min(e.bytes, s.size);
      return [offset === s.offset ? s : { ...s, offset }, []];
    }
    case "offset": {
      if (!ACTIVE.has(s.status)) return [s, []];
      const next: UploadState = {
        ...s,
        committed: e.offset,
        offset: e.offset,
        inflight: undefined,
        attempt: 0,
        lastError: undefined,
        expires: e.expires ?? s.expires,
      };
      return e.offset >= s.size ? complete(next) : nextChunk(next, c);
    }
    case "fail":
      if (!ACTIVE.has(s.status) || e.error.code === "E_ABORTED") return [s, []];
      return fail(s, e.error, c);
    case "pause":
      if (!ACTIVE.has(s.status)) return [s, []];
      return [
        { ...s, status: "paused", inflight: undefined, offset: s.committed },
        [{ kind: "abort" }],
      ];
    case "cancel": {
      if (s.status === "done") return [s, []];
      const cmds: Command[] = [
        { kind: "abort" },
        { kind: "forget", fingerprint: s.fingerprint },
      ];
      if (c.terminate && s.url && !c.single)
        cmds.push({ kind: "http", op: "delete", url: s.url });
      return [
        {
          ...s,
          status: "error",
          inflight: undefined,
          offset: s.committed,
          url: undefined,
          lastError: {
            code: "E_CANCELLED",
            message: "cancelled",
            retryable: false,
          },
        },
        cmds,
      ];
    }
  }
}

export function initialState(
  base: Omit<UploadState, "offset" | "committed" | "status" | "attempt">,
): UploadState {
  return { ...base, offset: 0, committed: 0, status: "queued", attempt: 0 };
}

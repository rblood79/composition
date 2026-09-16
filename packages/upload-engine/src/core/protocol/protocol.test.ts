/**
 * 상태기계 시나리오 corpus (ADR-201 §3-2 — Rust 이식 시 같은 corpus 로 대조).
 * 브라우저·네트워크 0 — 순수 함수만.
 */
import { describe, expect, it } from "vitest";
import { initialState, reduce } from "./index";
import type {
  Command,
  ProtocolConfig,
  UploadEvent,
  UploadState,
} from "./types";

const MB = 1024 ** 2;
const cfg: ProtocolConfig = {
  chunkSize: 8 * MB,
  retryDelays: [0, 1000, 3000, 5000],
  now: 1_000_000,
};

const fresh = (size = 20 * MB): UploadState =>
  initialState({
    id: "u1",
    fingerprint: "fp1",
    name: "a.bin",
    size,
    type: "application/octet-stream",
  });

/** 이벤트 열을 차례로 넣고 마지막 상태 + 누적 command 를 돌려준다 */
function play(
  start: UploadState,
  events: UploadEvent[],
  c: ProtocolConfig = cfg,
): { state: UploadState; commands: Command[]; steps: Command[][] } {
  let state = start;
  const commands: Command[] = [];
  const steps: Command[][] = [];
  for (const e of events) {
    const [next, cmds] = reduce(state, e, c);
    state = next;
    commands.push(...cmds);
    steps.push(cmds);
  }
  return { state, commands, steps };
}

const patch = (start: number, end: number): Command => ({
  kind: "http",
  op: "patch",
  start,
  end,
});

describe("생성 → PATCH 루프 → 완료", () => {
  it("start 는 create, created 는 persist + 첫 청크, offset 은 다음 청크, size 도달 시 done + forget", () => {
    const { state, steps } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/files/1" },
      { kind: "offset", offset: 8 * MB },
      { kind: "offset", offset: 16 * MB },
      { kind: "offset", offset: 20 * MB },
    ]);
    expect(steps[0]).toEqual([
      { kind: "http", op: "create", start: 0, end: 0 },
    ]);
    expect(steps[1]).toEqual([
      {
        kind: "persist",
        fingerprint: "fp1",
        url: "/files/1",
        expires: undefined,
      },
      patch(0, 8 * MB),
    ]);
    expect(steps[2]).toEqual([patch(8 * MB, 16 * MB)]);
    expect(steps[3]).toEqual([patch(16 * MB, 20 * MB)]);
    expect(steps[4]).toEqual([{ kind: "forget", fingerprint: "fp1" }]);
    expect(state.status).toBe("done");
    expect(state.offset).toBe(20 * MB);
    expect(state.url).toBe("/files/1");
  });

  it("chunkSize Infinity 는 단일 PATCH", () => {
    const { steps } = play(
      fresh(),
      [{ kind: "start" }, { kind: "created", url: "/u" }],
      { ...cfg, chunkSize: Infinity },
    );
    expect(steps[1][1]).toEqual(patch(0, 20 * MB));
  });

  it("chunk-sent 는 offset 힌트만 올리고 committed 는 그대로", () => {
    const { state } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      { kind: "offset", offset: 8 * MB },
      { kind: "chunk-sent", bytes: 3 * MB },
    ]);
    expect(state.offset).toBe(11 * MB);
    expect(state.committed).toBe(8 * MB);
    // 청크 범위를 넘는 loaded 는 end 로 clamp
    const [over] = reduce(state, { kind: "chunk-sent", bytes: 99 * MB }, cfg);
    expect(over.offset).toBe(16 * MB);
  });

  it("빈 파일 — created 직후 done", () => {
    const { state, commands } = play(fresh(0), [
      { kind: "start" },
      { kind: "created", url: "/u" },
    ]);
    expect(state.status).toBe("done");
    expect(commands.map((c) => c.kind)).toEqual(["http", "persist", "forget"]);
  });
});

describe("단절 후 HEAD 재개 — 재전송 ≤ chunkSize", () => {
  it("fail(E_NETWORK) → wait → retry → head → offset 이 진실이 되고 다음 청크는 서버 offset 부터", () => {
    const { state, steps } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      { kind: "offset", offset: 8 * MB },
      { kind: "chunk-sent", bytes: 5 * MB }, // 힌트 13MB
      {
        kind: "fail",
        error: { code: "E_NETWORK", message: "x", retryable: true },
      },
      { kind: "retry" },
      { kind: "offset", offset: 10 * MB }, // 서버는 10MB 만 받았다
    ]);
    expect(steps[4]).toEqual([{ kind: "wait", ms: 0 }]);
    expect(steps[5]).toEqual([{ kind: "http", op: "head" }]);
    expect(steps[6]).toEqual([patch(10 * MB, 18 * MB)]);
    expect(state.inflight).toEqual({ start: 10 * MB, end: 18 * MB });
    // 실패 직후 힌트는 committed 로 되돌아간다
    const afterFail = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      { kind: "offset", offset: 8 * MB },
      { kind: "chunk-sent", bytes: 5 * MB },
      {
        kind: "fail",
        error: { code: "E_NETWORK", message: "x", retryable: true },
      },
    ]).state;
    expect(afterFail.offset).toBe(8 * MB);
    expect(afterFail.attempt).toBe(1);
    expect(afterFail.status).toBe("uploading");
    expect(afterFail.lastError?.code).toBe("E_NETWORK");
  });

  it("409 offset 불일치 → 대기 없이 즉시 HEAD 재동기", () => {
    const { steps, state } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      {
        kind: "fail",
        error: {
          code: "E_OFFSET_MISMATCH",
          status: 409,
          message: "x",
          retryable: true,
        },
      },
      { kind: "offset", offset: 4 * MB },
    ]);
    expect(steps[2]).toEqual([{ kind: "http", op: "head" }]);
    expect(steps[3]).toEqual([patch(4 * MB, 12 * MB)]);
    expect(state.attempt).toBe(0);
  });

  it("저장소에서 복원된 url 로 start 하면 create 없이 HEAD 부터", () => {
    const restored: UploadState = { ...fresh(), url: "/u", committed: 0 };
    const { steps } = play(restored, [
      { kind: "start" },
      { kind: "offset", offset: 16 * MB },
    ]);
    expect(steps[0]).toEqual([{ kind: "http", op: "head" }]);
    expect(steps[1]).toEqual([patch(16 * MB, 20 * MB)]);
  });
});

describe("만료 → forget", () => {
  it("E_EXPIRED 는 forget 후 처음부터 create", () => {
    const { state, steps } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u", expires: 5_000_000 },
      { kind: "offset", offset: 8 * MB },
      {
        kind: "fail",
        error: {
          code: "E_EXPIRED",
          status: 410,
          message: "x",
          retryable: true,
        },
      },
    ]);
    expect(steps[3]).toEqual([
      { kind: "forget", fingerprint: "fp1" },
      { kind: "http", op: "create", start: 0, end: 0 },
    ]);
    expect(state.status).toBe("creating");
    expect(state.url).toBeUndefined();
    expect(state.committed).toBe(0);
    expect(state.expires).toBeUndefined();
  });

  it("Upload-Expires 가 지난 url 은 start 시점에 forget + create", () => {
    const restored: UploadState = { ...fresh(), url: "/u", expires: 999 };
    const { steps } = play(restored, [{ kind: "start" }], {
      ...cfg,
      now: 1000,
    });
    expect(steps[0]).toEqual([
      { kind: "forget", fingerprint: "fp1" },
      { kind: "http", op: "create", start: 0, end: 0 },
    ]);
  });

  it("재시도 소진 뒤 E_EXPIRED 는 error + forget", () => {
    const s: UploadState = {
      ...fresh(),
      url: "/u",
      status: "uploading",
      attempt: 4,
    };
    const [next, cmds] = reduce(
      s,
      {
        kind: "fail",
        error: { code: "E_EXPIRED", message: "x", retryable: true },
      },
      cfg,
    );
    expect(next.status).toBe("error");
    expect(cmds).toEqual([{ kind: "forget", fingerprint: "fp1" }]);
  });
});

describe("pause / resume / cancel", () => {
  const uploading = () =>
    play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      { kind: "offset", offset: 8 * MB },
      { kind: "chunk-sent", bytes: 2 * MB },
    ]).state;

  it("pause 는 abort + paused, 힌트는 committed 로", () => {
    const [s, cmds] = reduce(uploading(), { kind: "pause" }, cfg);
    expect(cmds).toEqual([{ kind: "abort" }]);
    expect(s.status).toBe("paused");
    expect(s.offset).toBe(8 * MB);
    expect(s.inflight).toBeUndefined();
  });

  it("paused 상태의 늦은 fail / offset / created 는 무시", () => {
    const [p] = reduce(uploading(), { kind: "pause" }, cfg);
    expect(
      reduce(
        p,
        {
          kind: "fail",
          error: { code: "E_ABORTED", message: "", retryable: false },
        },
        cfg,
      ),
    ).toEqual([p, []]);
    expect(reduce(p, { kind: "offset", offset: 16 * MB }, cfg)).toEqual([
      p,
      [],
    ]);
    expect(reduce(p, { kind: "created", url: "/x" }, cfg)).toEqual([p, []]);
    expect(reduce(p, { kind: "retry" }, cfg)).toEqual([p, []]);
  });

  it("resume(start) 는 HEAD 로 서버 offset 을 다시 묻는다", () => {
    const [p] = reduce(uploading(), { kind: "pause" }, cfg);
    const [r, cmds] = reduce(p, { kind: "start" }, cfg);
    expect(cmds).toEqual([{ kind: "http", op: "head" }]);
    expect(r.status).toBe("uploading");
    expect(r.attempt).toBe(0);
  });

  it("cancel 은 abort + forget (+ termination 시 DELETE), E_CANCELLED", () => {
    const [s, cmds] = reduce(
      uploading(),
      { kind: "cancel" },
      { ...cfg, terminate: true },
    );
    expect(cmds).toEqual([
      { kind: "abort" },
      { kind: "forget", fingerprint: "fp1" },
      { kind: "http", op: "delete", url: "/u" },
    ]);
    expect(s.status).toBe("error");
    expect(s.lastError).toEqual({
      code: "E_CANCELLED",
      message: "cancelled",
      retryable: false,
    });
    expect(s.url).toBeUndefined();
    const [, noTerm] = reduce(uploading(), { kind: "cancel" }, cfg);
    expect(noTerm.map((c) => c.kind)).toEqual(["abort", "forget"]);
  });

  it("done 은 start / cancel 에 반응하지 않는다", () => {
    const done = play(fresh(0), [
      { kind: "start" },
      { kind: "created", url: "/u" },
    ]).state;
    expect(reduce(done, { kind: "start" }, cfg)).toEqual([done, []]);
    expect(reduce(done, { kind: "cancel" }, cfg)).toEqual([done, []]);
    expect(
      reduce(
        done,
        {
          kind: "fail",
          error: { code: "E_NETWORK", message: "", retryable: true },
        },
        cfg,
      ),
    ).toEqual([done, []]);
  });
});

describe("지수 backoff", () => {
  const net = (): UploadEvent => ({
    kind: "fail",
    error: { code: "E_NETWORK", message: "x", retryable: true },
  });

  it("retryDelays 순서대로 wait, 소진 시 error", () => {
    const { steps, state } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      net(),
      { kind: "retry" },
      net(),
      { kind: "retry" },
      net(),
      { kind: "retry" },
      net(),
      { kind: "retry" },
      net(),
    ]);
    expect(steps[2]).toEqual([{ kind: "wait", ms: 0 }]);
    expect(steps[4]).toEqual([{ kind: "wait", ms: 1000 }]);
    expect(steps[6]).toEqual([{ kind: "wait", ms: 3000 }]);
    expect(steps[8]).toEqual([{ kind: "wait", ms: 5000 }]);
    expect(steps[10]).toEqual([]);
    expect(state.status).toBe("error");
    expect(state.attempt).toBe(5);
    expect(state.url).toBe("/u"); // 사용자 start 로 재개 가능
  });

  it("서버 offset 성공은 attempt 를 0 으로 되돌린다", () => {
    const { state } = play(fresh(), [
      { kind: "start" },
      { kind: "created", url: "/u" },
      net(),
      { kind: "retry" },
      net(),
      { kind: "retry" },
      { kind: "offset", offset: 8 * MB },
    ]);
    expect(state.attempt).toBe(0);
    expect(state.lastError).toBeUndefined();
  });

  it("retryable=false 는 즉시 error (E_UNAUTHORIZED · E_TOO_LARGE · E_PATCH_BLOCKED)", () => {
    for (const code of ["E_UNAUTHORIZED", "E_TOO_LARGE", "E_PATCH_BLOCKED"]) {
      const { state, steps } = play(fresh(), [
        { kind: "start" },
        {
          kind: "fail",
          error: { code, status: 403, message: "x", retryable: false },
        },
      ]);
      expect(steps[1]).toEqual([]);
      expect(state.status).toBe("error");
      expect(state.lastError?.code).toBe(code);
    }
  });

  it("error 상태에서 사용자 start 는 attempt 리셋 후 재개 (url 있으면 HEAD)", () => {
    const s: UploadState = {
      ...fresh(),
      status: "error",
      url: "/u",
      committed: 8 * MB,
      attempt: 5,
    };
    const [next, cmds] = reduce(s, { kind: "start" }, cfg);
    expect(cmds).toEqual([{ kind: "http", op: "head" }]);
    expect(next.attempt).toBe(0);
  });
});

describe("단일 요청 어댑터 (multipart)", () => {
  const single = { ...cfg, single: true };
  it("create 가 곧 전송 — persist 없음, 완료는 created(offset=size)", () => {
    const { steps, state } = play(
      fresh(),
      [
        { kind: "start" },
        { kind: "chunk-sent", bytes: 7 * MB },
        { kind: "created", url: "", offset: 20 * MB },
      ],
      single,
    );
    expect(steps[0]).toEqual([
      { kind: "http", op: "create", start: 0, end: 20 * MB },
    ]);
    expect(steps[2]).toEqual([{ kind: "forget", fingerprint: "fp1" }]);
    expect(state.status).toBe("done");
  });
  it("실패 후 재시도는 처음부터 create (재개 없음)", () => {
    const { steps } = play(
      { ...fresh(), url: "/u" },
      [
        { kind: "start" },
        {
          kind: "fail",
          error: { code: "E_NETWORK", message: "", retryable: true },
        },
        { kind: "retry" },
      ],
      single,
    );
    expect(steps[0][0]).toEqual({
      kind: "http",
      op: "create",
      start: 0,
      end: 20 * MB,
    });
    expect(steps[2][0]).toEqual({
      kind: "http",
      op: "create",
      start: 0,
      end: 20 * MB,
    });
  });
});

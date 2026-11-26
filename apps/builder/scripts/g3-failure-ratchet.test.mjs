// G3 실패 ratchet 판정 fixture. `node --test apps/builder/scripts/g3-failure-ratchet.test.mjs`
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  applyAccept,
  applyUpdate,
  baselineFrom,
  groupByKind,
  judge,
  kindOf,
  outcomesOf,
} from "./g3-failure-ratchet.mjs";

const FILE = resolve(
  import.meta.dirname,
  "../tests/adr248-g3/a.browser.test.ts",
);
const ID = (title) => `tests/adr248-g3/a.browser.test.ts › g › ${title}`;

function report(rows, fileStatus = "passed") {
  return {
    testResults: [
      {
        name: FILE,
        status: fileStatus,
        assertionResults: rows.map(([title, status, message = ""]) => ({
          ancestorTitles: ["g"],
          title,
          status,
          failureMessages: message ? [message] : [],
        })),
      },
    ],
  };
}

const BASE = baselineFrom(
  outcomesOf(
    report([
      ["old-1", "failed", "AssertionError: expected 3 to be 4"],
      ["old-2", "failed", "AssertionError: expected 5 to be 6"],
      ["ok", "passed"],
    ]),
  ),
);

test("기준선 = 실패 id 만, 통과 id 는 넣지 않는다", () => {
  assert.deepEqual(
    BASE.failures.map((f) => f.id),
    [ID("old-1"), ID("old-2")],
  );
});

test("기준선 안의 실패는 통과, 기준선 밖의 실패만 새 실패", () => {
  const same = judge(
    BASE,
    outcomesOf(
      report([
        ["old-1", "failed", "x"],
        ["old-2", "failed", "y"],
        ["ok", "passed"],
      ]),
    ),
  );
  assert.deepEqual(same.fresh, []);
  const regressed = judge(
    BASE,
    outcomesOf(
      report([
        ["old-1", "failed", "x"],
        ["old-2", "failed", "y"],
        ["ok", "failed", "z"],
      ]),
    ),
  );
  assert.deepEqual(regressed.fresh, [ID("ok")]);
});

test("통과로 바뀐 id 는 resolved, 돌지 않은 id 는 notRun — update 는 resolved 만 지운다", () => {
  const outcomes = outcomesOf(
    report([
      ["old-1", "passed"],
      ["old-2", "skipped"],
    ]),
  );
  const result = judge(BASE, outcomes);
  assert.deepEqual(result.resolved, [ID("old-1")]);
  assert.deepEqual(result.notRun, [ID("old-2")]);
  assert.deepEqual(
    applyUpdate(BASE, outcomes).failures.map((f) => f.id),
    [ID("old-2")],
  );
});

test("파일 자체가 실패하면 (assertion 실패 없음) 파일 id 하나가 새 실패", () => {
  const outcomes = outcomesOf(
    report(
      [
        ["old-1", "skipped"],
        ["old-2", "skipped"],
      ],
      "failed",
    ),
  );
  assert.deepEqual(judge(BASE, outcomes).fresh, [
    "tests/adr248-g3/a.browser.test.ts › (file)",
  ]);
});

test("종류 = 케이스 이름 · 숫자 · 색 · 따옴표 값을 지운 첫 줄", () => {
  assert.equal(
    kindOf(
      "AssertionError: ComboBox@M: 새 Canvas ↔ DOM 비대칭: expected false to be true\n    at foo (a.ts:1:2)",
    ),
    kindOf(
      "AssertionError: DateField@S: 새 Canvas ↔ DOM 비대칭: expected false to be true",
    ),
  );
  assert.equal(
    kindOf('AssertionError: fill "#ff0000" expected 12.5 to be 13'),
    kindOf('AssertionError: fill "#00f" expected 4 to be -2'),
  );
  assert.notEqual(
    kindOf("AssertionError: expected 3 to be 4"),
    kindOf("TypeError: x is undefined"),
  );
});

test("새 실패는 종류별로 묶여 건수 순", () => {
  const messages = new Map([
    ["a", "AssertionError: A@M: 비대칭"],
    ["b", "AssertionError: B@S: 비대칭"],
    ["c", "TypeError: boom"],
  ]);
  const groups = groupByKind(["a", "b", "c"], messages);
  assert.deepEqual(
    groups.map((g) => g.ids),
    [["a", "b"], ["c"]],
  );
});

test("accept 는 사유가 있어야 하고, 이번 실행에서 실패한 id 만 넣는다", () => {
  const outcomes = outcomesOf(
    report([
      ["old-1", "failed", "x"],
      ["old-2", "failed", "y"],
      ["ok", "failed", "AssertionError: expected 1 to be 2"],
    ]),
  );
  assert.throws(
    () => applyAccept(BASE, outcomes, [ID("ok")], "", "2026-11-27"),
    /--reason/,
  );
  assert.throws(
    () => applyAccept(BASE, outcomes, [ID("nope")], "r", "2026-11-27"),
    /실패하지 않은/,
  );
  const next = applyAccept(
    BASE,
    outcomes,
    [ID("ok")],
    "fixture 갱신 대기",
    "2026-11-27",
  );
  assert.equal(next.failures.length, 3);
  assert.deepEqual(next.failures.find((f) => f.id === ID("ok")).accepted, {
    reason: "fixture 갱신 대기",
    date: "2026-11-27",
  });
});

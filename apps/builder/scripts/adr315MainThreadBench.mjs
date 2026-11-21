// ADR-315 Phase 0 — 화면 스레드 계산 시간 (G0 「10 만 행 화면 스레드 측정」 · Phase 7 Worker 조건의 첫
// 읽기). 제품의 보기 평가기 (`runViewQueries`) 와 정렬 (`viewSortOrder` — Phase 2 부터 보기 · 표 머리글
// 정렬이 같은 함수. Phase 0 의 값은 옛 `catalogTableSortOrder` 로 잰 것) 을 그대로 묶어
// 실제 브라우저의 main thread 에서 돌린다 — `adr315-phase0-mainthread.mjs` 가 CPU 1x · 4x 로 부른다.
// 행은 합성 (규모 전용 — Q1). 불리한 경우 (Q2): 값이 모두 다른 글자 열 정렬 · 한글 검색 (collator
// 경로) · 한 글자 검색 (결과가 거의 전부) · 열 6 개 전부 검색.
import { runViewQueries } from "../../../packages/shared/src/collections/view/evaluate";
import { viewSortOrder } from "../../../packages/shared/src/collections/view/sortOrder";
import { viewRowsPassing } from "../../../packages/shared/src/collections/view/rowFilter";

/** One sort entry over `rows` by a field (no ranks kept — every run reads the values again). */
const by = (rows, key, direction, type) => ({
  valueAt: (i) => rows[i][key],
  direction,
  type,
});

const SCHEMA = [
  { id: "f-name", key: "name", type: "string" },
  { id: "f-dept", key: "dept", type: "string" },
  { id: "f-city", key: "city", type: "string" },
  { id: "f-amount", key: "amount", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  { id: "f-date", key: "date", type: "date" },
  { id: "f-kname", key: "kname", type: "string" },
];
const FAMILY = "김이박최정강조윤장임한오서신권황안송류전";
const GIVEN = "민서준도윤하은지우현수빈영진호성재경아연";

/** The harness's rows (`datagrid-table-vs-tanstack-live.mjs` — mulberry32) plus a Hangul name. */
export function makeRows(count) {
  let a = count;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pad = (n) => String(n).padStart(2, "0");
  const pick = (text) => text[Math.floor(next() * text.length)];
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `Person ${Math.floor(next() * count * 4)}`,
    dept: `Dept ${Math.floor(next() * 12)}`,
    city: `City ${Math.floor(next() * 50)}`,
    amount: Math.floor(next() * 1_000_000) / 100,
    qty: Math.floor(next() * 500),
    date: `2026-${pad(Math.floor(next() * 12) + 1)}-${pad(Math.floor(next() * 28) + 1)}`,
    kname: `${pick(FAMILY)}${pick(GIVEN)}${pick(GIVEN)} ${Math.floor(next() * count)}`,
  }));
}

const input = (queries) => ({
  queries,
  schema: SCHEMA,
  resolve: (value) => ({ value }),
  locale: "ko",
});
const search = (fields, value) => ({
  where: {
    id: "where",
    op: "and",
    items: [
      {
        id: "search",
        fields: fields.map((id) => [`data:field:${id}`]),
        op: "contains",
        value,
      },
    ],
  },
});
const TEXT = ["f-name", "f-dept", "f-city", "f-kname"];
const ALL = [...TEXT, "f-amount", "f-qty", "f-date"];

/** Runs `fn` `reps` times after a warm-up; the ms of each run (its result's size as `size`). */
function time(fn, reps) {
  fn();
  const ms = [];
  let size = 0;
  for (let i = 0; i < reps; i += 1) {
    const start = performance.now();
    const out = fn();
    ms.push(performance.now() - start);
    size = out?.length ?? out?.rows?.length ?? 0;
  }
  return { ms, size };
}

/** The cases over `count` rows — `{ name: { ms: number[], size } }`. */
export function bench(count, reps = 7) {
  const rows = makeRows(count);
  const cases = {
    "검색 「Person 12」 · 글자 열 4": () =>
      runViewQueries(rows, input([search(TEXT, "Person 12")])),
    "검색 「e」 (한 글자 — 거의 전부) · 글자 열 4": () =>
      runViewQueries(rows, input([search(TEXT, "e")])),
    "검색 「1」 · 열 7 전부": () =>
      runViewQueries(rows, input([search(ALL, "1")])),
    "검색 「김민」 (한글) · 글자 열 4": () =>
      runViewQueries(rows, input([search(TEXT, "김민")])),
    "검색 「zzzz」 (없음) · 글자 열 4": () =>
      runViewQueries(rows, input([search(TEXT, "zzzz")])),
    "정렬 — 글자 열 (값이 모두 다름)": () =>
      viewSortOrder(rows.length, [by(rows, "name", "ascending", "string")]),
    "정렬 — 한글 글자 열": () =>
      viewSortOrder(rows.length, [by(rows, "kname", "ascending", "string")]),
    "정렬 — 숫자 열": () =>
      viewSortOrder(rows.length, [by(rows, "amount", "descending", "number")]),
    "정렬 — 두 열 (dept 오름 · amount 내림)": () =>
      viewSortOrder(rows.length, [
        by(rows, "dept", "ascending", "string"),
        by(rows, "amount", "descending", "number"),
      ]),
    "검색 「e」 + 글자 열 정렬 (검색 한 글자마다 다시)": () => {
      const found = runViewQueries(rows, input([search(TEXT, "e")])).rows;
      return viewSortOrder(found.length, [
        by(found, "name", "ascending", "string"),
      ]);
    },
    "묶기 dept + 합계 (보기 집계)": () =>
      runViewQueries(
        rows,
        input([
          {
            where: { id: "where", op: "and", items: [] },
            groupBy: [["data:field:f-dept"]],
            aggregates: [
              { fn: "count", as: "count" },
              { fn: "sum", field: ["data:field:f-amount"], as: "total" },
            ],
          },
        ]),
      ),
  };
  const out = {};
  for (const [name, fn] of Object.entries(cases)) out[name] = time(fn, reps);
  // ADR-315 Phase 7 — the Table's own search (Phase 3 on): a search typed on, key by key, over the
  // rows its sort ordered (`viewRowsPassing` + the kept order — `dataBinding.ts` `keptRowOrder`).
  // Each key's ms across `reps` fresh runs (a fresh rows array — no misses kept from a run before).
  const order = viewSortOrder(rows.length, [
    by(rows, "name", "ascending", "string"),
  ]);
  const typed = (text, match) => {
    const ms = [];
    let size = 0;
    for (let rep = 0; rep <= reps; rep += 1) {
      const source = rows.slice();
      const fields = TEXT.map((id) => {
        const key = id.slice(2);
        return { valueAt: (i) => source[i][key], type: "string", name: key };
      });
      for (let end = 1; end <= text.length; end += 1) {
        const start = performance.now();
        const { pass, rank } = viewRowsPassing(
          source.length,
          [
            {
              fields,
              op: "contains",
              value: text.slice(0, end),
              search: match,
            },
          ],
          { rows: source },
        );
        let count = 0;
        for (let i = 0; i < pass.length; i += 1) count += pass[i];
        const kept = new Uint32Array(count);
        let at = 0;
        for (let place = 0; place < order.length; place += 1)
          if (pass[order[place]]) kept[at++] = order[place];
        void rank;
        if (rep > 0) ms.push(performance.now() - start);
        size = count;
      }
    }
    return { ms, size };
  };
  out["표 검색 이어 치기 「Person 12」 (키마다) · 정렬된 순서"] = typed(
    "Person 12",
    "contains",
  );
  out["표 검색 이어 치기 「김민서」 (한글 — 매번 비교) · 정렬된 순서"] =
    typed("김민서", "contains");
  out["표 유사 검색 이어 치기 「Prsn 12」 · 정렬된 순서"] = typed(
    "Prsn 12",
    "fuzzy",
  );
  return out;
}

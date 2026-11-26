// ADR-324 Phase 0 (G0) — the save request body sizes of the breakdown's two tables, measured again:
// 「본문 크기 기준선」 (1,000 rows × 1,000 columns, two rows' three fields) and 「조건부 요청 압축」
// (the reference batch shape `{updates:[{id, version, set}]}` — one cell · two rows' three cells ·
// N rows × 5 cells of numbers or Korean text). JSON = compact UTF-8 bytes, gzip = zlib level 6.
// The rows are synthetic — sizes only (measurement-validity Q1). Usage: node apps/builder/scripts/adr324-save-body-size.mjs
import { gzipSync } from "node:zlib";

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
const gz = (value) => gzipSync(Buffer.from(JSON.stringify(value), "utf8"), { level: 6 }).length;
const row = (label, value) => ({ label, json: bytes(value), gzip: gz(value) });

// ─── 본문 크기 기준선 (처음 초안의 모양 — 요청 ID + updates[{id, baseVersion, set}]) ──────────────
const wide = [];
for (let i = 0; i < 1000; i += 1) {
  const item = { id: `ord-${i}`, version: "v1" };
  for (let j = 1; j <= 998; j += 1) item[`c${j}`] = i * 1000 + j;
  wide.push(item);
}
const changed = wide.map((item) => ({ ...item }));
changed[17].c2 = 8;
changed[17].c9 = 0;
changed[843].c31 = 5;
const baseline = [
  row("전체 1,000 행 × 1,000 열", changed),
  row("고친 두 행의 모든 열", [changed[17], changed[843]]),
  row("두 행의 세 필드 + 식별 정보", {
    requestId: "req-0001",
    updates: [
      { id: "ord-17", baseVersion: "v1", set: { c2: 8, c9: 0 } },
      { id: "ord-843", baseVersion: "v1", set: { c31: 5 } },
    ],
  }),
  row("한 행의 한 필드 + 식별 정보", {
    requestId: "req-0001",
    updates: [{ id: "ord-17", baseVersion: "v1", set: { c2: 8 } }],
  }),
];

// ─── 조건부 요청 압축 (개정한 참조 모양) ────────────────────────────────────────────────────
const NAMES = ["김민준", "이서연", "박지호", "최수아", "정예준", "강하은", "조도윤", "윤서윤"];
const DEPTS = ["영업부", "개발부", "인사부", "재무부", "기획부"];
const MEMOS = ["확인 필요", "납기 조정", "단가 재협상", "재고 부족", "고객 요청"];
const numeric = (n) => ({
  updates: Array.from({ length: n }, (_, i) => ({
    id: `ord-${i}`,
    version: `v${(i % 7) + 1}`,
    set: { qty: i * 3 + 1, price: 1000 + i * 17, stock: (i * 31) % 997, rate: (i % 100) / 10, level: i % 5 },
  })),
});
const korean = (n) => ({
  updates: Array.from({ length: n }, (_, i) => ({
    id: `ord-${i}`,
    version: `v${(i % 7) + 1}`,
    set: {
      name: NAMES[i % NAMES.length],
      dept: DEPTS[i % DEPTS.length],
      memo: MEMOS[(i * 3) % MEMOS.length],
      active: i % 2 ? "Y" : "N",
      code: `K${String(i).padStart(5, "0")}`,
    },
  })),
});
const compression = [
  row("한 행 한 칸", { updates: [{ id: "ord-42", version: "v17", set: { quantity: 8 } }] }),
  row("두 행 세 칸", {
    updates: [
      { id: "ord-42", version: "v17", set: { quantity: 8, note: "확인" } },
      { id: "ord-91", version: "v4", set: { note: null } },
    ],
  }),
  ...[10, 20, 100, 1000, 10000].flatMap((n) => [row(`${n} 행 × 5 칸 (숫자)`, numeric(n)), row(`${n} 행 × 5 칸 (한글)`, korean(n))]),
];

// ─── 압축 시간 (Node zlib — 브라우저 CompressionStream 은 live 로 따로 잰다) ─────────────────────
const timing = [1000, 10000].map((n) => {
  const text = Buffer.from(JSON.stringify(numeric(n)), "utf8");
  const runs = [];
  for (let k = 0; k < 7; k += 1) {
    const start = process.hrtime.bigint();
    gzipSync(text, { level: 6 });
    runs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  runs.sort((a, b) => a - b);
  return { rows: n, medianMs: Number(runs[3].toFixed(2)) };
});

const pct = (item) => `${Math.round((1 - item.gzip / item.json) * 100)} %`;
console.log(`node ${process.version} · zlib gzip level 6`);
console.log("\n본문 크기 기준선");
for (const item of baseline) console.log(`${item.label}\t${item.json} B\t${item.gzip} B`);
console.log("\n조건부 요청 압축");
for (const item of compression) console.log(`${item.label}\t${item.json} B\t${item.gzip} B\t${pct(item)}`);
console.log("\n압축 시간 (중앙값 7 회)");
for (const item of timing) console.log(`${item.rows} 행\t${item.medianMs} ms`);

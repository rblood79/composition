/**
 * "설명으로 테이블 만들기" 의 구조화 계약 — ADR-213 Phase 6 (AI-1, I3).
 *
 * 모델은 **스키마 + 샘플 행 생성 규칙** 만 낸다 (`TableSpecSchema`, zod 단일 소스 — tool
 * JSON Schema 도 여기서 파생). 샘플 행은 **코드가** 만든다 (`generateSampleRows`) — 모델이
 * 행을 쓰면 스키마에 없는 컬럼 · enum 밖 값 · 깨진 FK 가 섞인다 (리서치 I3). 생성 결과는
 * `validateSampleRows` 가 다시 검사한다 — 생성기가 곧 검증기 (breakdown Phase 6
 * "presets 생성기를 검증기로 승격": 기존 preset 은 규칙이 코드 안에 굳어 있어 모델 출력을
 * 검사할 수 없었다; 여기서는 규칙이 데이터라 같은 규칙으로 생성하고 검증한다).
 *
 * 결정적 생성: seed = 테이블 이름 → 같은 설명이면 같은 미리보기 (재승인 · 테스트 안정).
 */
import { DATA_FIELD_TYPES, type DataFieldShape } from "@composition/shared";
import { z } from "zod";

export const SAMPLE_ROWS_DEFAULT = 5;
export const SAMPLE_ROWS_MAX = 50;
export const TABLE_FIELDS_MAX = 40;

const GenerateRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("enum"),
    values: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    kind: z.literal("sequence"),
    prefix: z.string().max(20).optional(),
    start: z.number().int().min(0).optional(),
  }),
  z.object({ kind: z.literal("name") }),
  z.object({ kind: z.literal("company") }),
  z.object({ kind: z.literal("email") }),
  z.object({ kind: z.literal("url") }),
  z.object({ kind: z.literal("image") }),
  z.object({
    kind: z.literal("sentence"),
    words: z.number().int().min(1).max(40).optional(),
  }),
  z.object({
    kind: z.literal("paragraph"),
    sentences: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    kind: z.literal("integer"),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }),
  z.object({
    kind: z.literal("decimal"),
    min: z.number().optional(),
    max: z.number().optional(),
    precision: z.number().int().min(0).max(6).optional(),
  }),
  z.object({
    kind: z.literal("boolean"),
    trueRatio: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal("date"),
    /** ISO 날짜 (YYYY-MM-DD) — 생략 시 최근 1년 */
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  z.object({
    kind: z.literal("reference"),
    /** 기존 collection 의 id 또는 이름 — 그 행의 `field` (기본 id) 값에서 고른다 (FK 정합) */
    collection: z.string().min(1),
    field: z.string().min(1).optional(),
  }),
  z.object({ kind: z.literal("constant"), value: z.unknown() }),
  z.object({
    kind: z.literal("list"),
    values: z.array(z.string().min(1)).min(1).max(50),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
  }),
]);

export type GenerateRule = z.infer<typeof GenerateRuleSchema>;

const FieldSpecSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "key 는 식별자 형태 (영문 · 숫자 · _)"),
  type: z.enum(DATA_FIELD_TYPES),
  label: z.string().max(80).optional(),
  required: z.boolean().optional(),
  /** 샘플 값 생성 규칙 — 생략 시 type 과 key 로 기본 규칙 */
  generate: GenerateRuleSchema.optional(),
});

export type FieldSpec = z.infer<typeof FieldSpecSchema>;

export const TableSpecSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  fields: z
    .array(FieldSpecSchema)
    .min(1)
    .max(TABLE_FIELDS_MAX)
    .superRefine((fields, ctx) => {
      const seen = new Set<string>();
      fields.forEach((field, index) => {
        if (seen.has(field.key)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "key"],
            message: `필드 key 중복: ${field.key}`,
          });
        }
        seen.add(field.key);
      });
    }),
  sampleCount: z.number().int().min(0).max(SAMPLE_ROWS_MAX).optional(),
});

export type TableSpec = z.infer<typeof TableSpecSchema>;

/** 모델 대면 tool 파라미터 — zod 에서 파생 (손으로 쓴 두 번째 스키마 없음). */
export function tableSpecJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(TableSpecSchema) as Record<string, unknown>;
}

// ---------- 결정적 난수 ----------

function hashSeed(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 생성 ----------

export interface SampleGenerationContext {
  /** `reference` 규칙이 읽는 기존 collection (id 또는 이름 → 행) */
  collections: readonly {
    id: string;
    name: string;
    rows: readonly Record<string, unknown>[];
  }[];
  /** 이름 · 회사 풀 — preset 카탈로그 (`presetData.*`). 생략 시 영문 기본 풀 */
  pools?: { firstNames?: string[]; lastNames?: string[]; companies?: string[] };
}

const DEFAULT_FIRST = ["Ana", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Ida"];
const DEFAULT_LAST = ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho"];
const DEFAULT_COMPANY = ["Acme", "Globex", "Initech", "Umbrella", "Hooli"];
const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(
    " ",
  );

const KEY_HINTS: Array<[RegExp, GenerateRule]> = [
  [/^(id|uuid|_id)$|Id$/, { kind: "sequence" }],
  [/name$|^author$|^owner$|^user$|^assignee$/i, { kind: "name" }],
  [/company|vendor|supplier|org/i, { kind: "company" }],
  [/mail/i, { kind: "email" }],
  [/url|link|href/i, { kind: "url" }],
  [/image|avatar|photo|thumb/i, { kind: "image" }],
  [/^(body|content|description|summary|bio|text)$/i, { kind: "paragraph" }],
  [/^(title|subject|headline)$/i, { kind: "sentence", words: 4 }],
  [/date|_at$|At$|time/i, { kind: "date" }],
  [/price|amount|total|cost|rate/i, { kind: "decimal", min: 1, max: 999 }],
  [/count|qty|quantity|age|score|rank|order|position/i, { kind: "integer", min: 0, max: 100 }],
  [/^(is|has|can)[A-Z]|active|enabled|published|done/i, { kind: "boolean" }],
  [/tags|labels|keywords/i, { kind: "list", values: ["red", "green", "blue", "new", "hot"] }],
];

/** 규칙이 없을 때 — type 이 정하고, string 은 key 이름 힌트를 본다. */
export function defaultRuleFor(field: FieldSpec): GenerateRule {
  switch (field.type) {
    case "number":
      return { kind: "integer", min: 0, max: 100 };
    case "boolean":
      return { kind: "boolean" };
    case "date":
    case "datetime":
      return { kind: "date" };
    case "email":
      return { kind: "email" };
    case "url":
      return { kind: "url" };
    case "image":
      return { kind: "image" };
    case "array":
      return { kind: "list", values: ["alpha", "beta", "gamma", "delta"] };
    case "object":
      return { kind: "constant", value: {} };
    default: {
      for (const [pattern, rule] of KEY_HINTS) {
        if (pattern.test(field.key)) return rule;
      }
      return { kind: "sentence", words: 3 };
    }
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function isoDate(ms: number, withTime: boolean): string {
  const iso = new Date(ms).toISOString();
  return withTime ? iso : iso.slice(0, 10);
}

function resolveReference(
  rule: Extract<GenerateRule, { kind: "reference" }>,
  ctx: SampleGenerationContext,
): unknown[] {
  const target =
    ctx.collections.find((c) => c.id === rule.collection) ??
    ctx.collections.find(
      (c) => c.name.toLowerCase() === rule.collection.toLowerCase(),
    );
  if (!target) return [];
  const field = rule.field ?? "id";
  return target.rows
    .map((row) => row[field])
    .filter((value) => value !== undefined && value !== null);
}

function generateValue(
  field: FieldSpec,
  rule: GenerateRule,
  index: number,
  random: () => number,
  ctx: SampleGenerationContext,
): unknown {
  const first = ctx.pools?.firstNames ?? DEFAULT_FIRST;
  const last = ctx.pools?.lastNames ?? DEFAULT_LAST;
  const companies = ctx.pools?.companies ?? DEFAULT_COMPANY;
  const withTime = field.type === "datetime";
  switch (rule.kind) {
    case "enum":
      return rule.values[index % rule.values.length];
    case "sequence":
      return `${rule.prefix ?? ""}${(rule.start ?? 1) + index}`;
    case "name":
      return `${pick(random, first)} ${pick(random, last)}`;
    case "company":
      return pick(random, companies);
    case "email":
      return `${pick(random, first).toLowerCase()}${index + 1}@example.com`;
    case "url":
      return `https://example.com/${slug(field.key)}/${index + 1}`;
    case "image":
      return `https://picsum.photos/seed/${slug(field.key)}-${index + 1}/200/200`;
    case "sentence": {
      const n = rule.words ?? 5;
      const words = Array.from({ length: n }, () => pick(random, WORDS));
      words[0] = words[0][0].toUpperCase() + words[0].slice(1);
      return words.join(" ");
    }
    case "paragraph": {
      const n = rule.sentences ?? 2;
      return Array.from({ length: n }, () => {
        const words = Array.from({ length: 6 + Math.floor(random() * 6) }, () =>
          pick(random, WORDS),
        );
        words[0] = words[0][0].toUpperCase() + words[0].slice(1);
        return `${words.join(" ")}.`;
      }).join(" ");
    }
    case "integer": {
      const min = rule.min ?? 0;
      const max = rule.max ?? 100;
      return min + Math.floor(random() * (max - min + 1));
    }
    case "decimal": {
      const min = rule.min ?? 0;
      const max = rule.max ?? 100;
      const precision = rule.precision ?? 2;
      return Number((min + random() * (max - min)).toFixed(precision));
    }
    case "boolean":
      return random() < (rule.trueRatio ?? 0.5);
    case "date": {
      const to = rule.to ? Date.parse(rule.to) : Date.UTC(2026, 8, 1);
      const from = rule.from
        ? Date.parse(rule.from)
        : to - 365 * 24 * 3600 * 1000;
      const lo = Number.isNaN(from) ? to - 365 * 24 * 3600 * 1000 : from;
      const hi = Number.isNaN(to) ? Date.UTC(2026, 8, 1) : to;
      return isoDate(lo + random() * Math.max(0, hi - lo), withTime);
    }
    case "reference": {
      const values = resolveReference(rule, ctx);
      return values.length === 0 ? null : values[index % values.length];
    }
    case "constant":
      return rule.value;
    case "list": {
      const min = rule.min ?? 1;
      const max = Math.max(min, rule.max ?? Math.min(3, rule.values.length));
      const n = min + Math.floor(random() * (max - min + 1));
      const start = Math.floor(random() * rule.values.length);
      return Array.from(
        { length: Math.min(n, rule.values.length) },
        (_, i) => rule.values[(start + i) % rule.values.length],
      );
    }
  }
}

export function ruleFor(field: FieldSpec): GenerateRule {
  return field.generate ?? defaultRuleFor(field);
}

export function generateSampleRows(
  spec: TableSpec,
  ctx: SampleGenerationContext,
): Record<string, unknown>[] {
  const count = spec.sampleCount ?? SAMPLE_ROWS_DEFAULT;
  const random = rng(hashSeed(spec.name));
  const rules = spec.fields.map((field) => [field, ruleFor(field)] as const);
  return Array.from({ length: count }, (_, index) => {
    const row: Record<string, unknown> = {};
    for (const [field, rule] of rules) {
      row[field.key] = generateValue(field, rule, index, random, ctx);
    }
    return row;
  });
}

// ---------- 검증 (I3) ----------

export interface SampleRowIssue {
  row: number;
  key: string;
  reason:
    | "unknown-column"
    | "required-missing"
    | "type-mismatch"
    | "enum-violation"
    | "reference-broken";
  value?: unknown;
}

function typeMatches(type: DataFieldShape["type"], value: unknown): boolean {
  if (value === null || value === undefined) return true;
  switch (type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
    case "date":
    case "datetime":
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    case "email":
      return typeof value === "string" && /^[^\s@]+@[^\s@]+$/.test(value);
    case "url":
    case "image":
      return typeof value === "string" && /^https?:\/\//.test(value);
    default:
      return typeof value === "string";
  }
}

/** 행이 스키마 · 규칙과 정합한가 — 생성기 출력도, 모델이 낸 행도 같은 검사를 지난다. */
export function validateSampleRows(
  spec: TableSpec,
  rows: readonly Record<string, unknown>[],
  ctx: SampleGenerationContext,
): SampleRowIssue[] {
  const issues: SampleRowIssue[] = [];
  const fields = new Map(spec.fields.map((field) => [field.key, field]));
  const referenceValues = new Map<string, Set<unknown>>();
  for (const field of spec.fields) {
    const rule = ruleFor(field);
    if (rule.kind === "reference") {
      referenceValues.set(field.key, new Set(resolveReference(rule, ctx)));
    }
  }
  rows.forEach((row, rowIndex) => {
    for (const key of Object.keys(row)) {
      if (!fields.has(key))
        issues.push({ row: rowIndex, key, reason: "unknown-column" });
    }
    for (const field of spec.fields) {
      const value = row[field.key];
      const empty = value === undefined || value === null || value === "";
      if (field.required && empty) {
        issues.push({ row: rowIndex, key: field.key, reason: "required-missing" });
        continue;
      }
      if (empty) continue;
      if (!typeMatches(field.type, value)) {
        issues.push({ row: rowIndex, key: field.key, reason: "type-mismatch", value });
        continue;
      }
      const rule = ruleFor(field);
      if (rule.kind === "enum" && !rule.values.includes(String(value))) {
        issues.push({ row: rowIndex, key: field.key, reason: "enum-violation", value });
      }
      if (rule.kind === "reference" && !referenceValues.get(field.key)?.has(value)) {
        issues.push({ row: rowIndex, key: field.key, reason: "reference-broken", value });
      }
    }
  });
  return issues;
}

/** `create_collection` op 의 schema 로 — label 은 생략 시 key 그대로 (사람 생성 경로와 같다). */
export function tableSpecToSchema(spec: TableSpec): DataFieldShape[] {
  return spec.fields.map((field) => ({
    key: field.key,
    type: field.type,
    ...(field.label ? { label: field.label } : {}),
    ...(field.required !== undefined ? { required: field.required } : {}),
  }));
}

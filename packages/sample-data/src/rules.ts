/**
 * mockaroo 식 필드 규칙 — 컬럼마다 「타입 + 옵션」 을 데이터로 적고 행을 만든다.
 *
 * mockaroo 의 스키마 화면이 이 모양이다: 컬럼 이름 · Type (Row Number / First Name /
 * Credit Card # / Custom List / Formula …) · 타입별 옵션 (min/max · 형식 · 목록 선택 방식
 * random/sequential/weighted) · **Blank %**. 여기서는 `SampleRule` 이 Type+옵션,
 * `SampleColumn.blank` 가 Blank %, `formula` 가 같은 행의 앞 컬럼을 읽는 파생값이다
 * (dummyjson `discountedTotal` · randomuser 의 이름 ↔ 이메일 ↔ 초상 일관성).
 *
 * 규칙이 데이터라 같은 규칙으로 생성하고 검증할 수 있다 — AI tableSpec 이 택한 원칙
 * (`services/ai/data/tableSpec.ts` "생성기가 곧 검증기").
 */

import type { Gender, Generators, PicsumOptions } from "./generators";
import { createGenerators } from "./generators";
import type { SampleLocale } from "./locale";
import type { WeightedOption } from "./random";

export type ListSelection = "random" | "sequential";

/** 행 단위 컨텍스트 — formula · 파생 규칙이 읽는다 */
export interface SampleRowContext {
  index: number;
  /** 지금까지 채운 같은 행의 값 (컬럼 순서대로) */
  row: Record<string, unknown>;
  mock: Generators;
  /** `reference` 규칙이 읽는 외부 값 풀 (FK) */
  references: Readonly<Record<string, readonly unknown[]>>;
  /** 문구 해소기 (i18n `t`) — formula 가 카탈로그 문장 템플릿을 쓸 때. 없으면 키 그대로 */
  t: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
}

export type SampleRule =
  // ---- 식별자 ----
  | { kind: "rowNumber"; start?: number }
  | { kind: "sequence"; prefix?: string; start?: number; pad?: number }
  | { kind: "id"; prefix?: string }
  | { kind: "uuid" }
  // ---- 사람 ----
  | { kind: "gender" }
  | { kind: "firstName"; gender?: Gender; genderKey?: string }
  | { kind: "lastName" }
  | {
      kind: "fullName";
      gender?: Gender;
      genderKey?: string;
      firstKey?: string;
      lastKey?: string;
    }
  | { kind: "jobTitle" }
  | { kind: "jobLevel" }
  | { kind: "birthDate"; minAge?: number; maxAge?: number }
  | { kind: "age"; birthDateKey: string }
  // ---- 인터넷 ----
  | { kind: "email"; firstKey?: string; lastKey?: string; unique?: boolean }
  | { kind: "username"; firstKey?: string; lastKey?: string; unique?: boolean }
  | { kind: "password"; length?: number }
  | { kind: "url"; path?: string }
  | { kind: "ipv4" }
  | { kind: "mac" }
  | { kind: "userAgent" }
  | { kind: "phone"; format?: string }
  | { kind: "cell" }
  // ---- 주소 ----
  | { kind: "street" }
  | { kind: "streetAddress" }
  | { kind: "city" }
  | { kind: "district" }
  | { kind: "region" }
  | { kind: "country" }
  | { kind: "postcode" }
  | { kind: "address" }
  | { kind: "latitude"; precision?: number }
  | { kind: "longitude"; precision?: number }
  | { kind: "timezone" }
  // ---- 회사 ----
  | { kind: "company" }
  | { kind: "department" }
  | { kind: "industry" }
  // ---- 상거래 ----
  | { kind: "productName" }
  | { kind: "productCategory" }
  | { kind: "brand" }
  | { kind: "sku" }
  | { kind: "barcode" }
  | { kind: "price"; min?: number; max?: number; precision?: number }
  | { kind: "availability" }
  | { kind: "reviewComment" }
  // ---- 금융 ----
  | { kind: "amount"; min?: number; max?: number; precision?: number }
  | { kind: "currency" }
  | { kind: "cardType" }
  | { kind: "creditCardNumber"; typeKey?: string; masked?: boolean }
  | { kind: "cardExpiry" }
  | { kind: "accountNumber" }
  | { kind: "merchant" }
  | { kind: "transactionCategory" }
  | { kind: "transactionType" }
  // ---- 수 · 불리언 ----
  | { kind: "int"; min?: number; max?: number }
  | { kind: "decimal"; min?: number; max?: number; precision?: number }
  | { kind: "boolean"; trueRatio?: number }
  // ---- 날짜 ----
  | { kind: "pastDate"; years?: number; days?: number; withTime?: boolean }
  | { kind: "futureDate"; years?: number; days?: number; withTime?: boolean }
  | {
      kind: "dateBetween";
      from: string | number;
      to: string | number;
      withTime?: boolean;
    }
  | { kind: "now" }
  // ---- 목록 ----
  | { kind: "enum"; values: readonly string[]; selection?: ListSelection }
  | { kind: "weighted"; options: readonly WeightedOption<unknown>[] }
  | { kind: "pool"; name: keyof SampleLocale; selection?: ListSelection }
  /** 풀의 i 번째 값을 weights[i] 가중치로 — 풀 문구는 locale, 분포는 규칙 */
  | {
      kind: "weightedPool";
      name: keyof SampleLocale;
      weights: readonly number[];
    }
  | {
      kind: "list";
      values?: readonly string[];
      pool?: keyof SampleLocale;
      min?: number;
      max?: number;
    }
  // ---- 텍스트 ----
  | { kind: "word" }
  | { kind: "words"; count?: number }
  | { kind: "sentence"; words?: number }
  | { kind: "paragraph"; sentences?: number }
  | { kind: "title"; words?: number }
  | { kind: "quote" }
  | { kind: "quoteAuthor" }
  // ---- 이미지 · 색 ----
  | { kind: "image"; picsum?: PicsumOptions; seedKey?: string }
  | {
      kind: "imageList";
      min?: number;
      max?: number;
      picsum?: PicsumOptions;
    }
  | {
      kind: "avatar";
      genderKey?: string;
      size?: "large" | "medium" | "thumbnail";
    }
  | { kind: "colorHex" }
  | { kind: "colorName" }
  // ---- 구조 ----
  | { kind: "constant"; value: unknown }
  | { kind: "object"; fields: readonly SampleColumn[] }
  | {
      kind: "array";
      min?: number;
      max?: number;
      item: SampleRule | readonly SampleColumn[];
    }
  | { kind: "reference"; name: string; selection?: ListSelection }
  | { kind: "formula"; compute: (ctx: SampleRowContext) => unknown }
  | { kind: "template"; template: string };

export interface SampleColumn {
  key: string;
  rule: SampleRule;
  /** 빈 값 비율 0~1 (mockaroo Blank %) — 전역 blankRate 보다 우선 */
  blank?: number;
  /** required 컬럼은 전역 blankRate 를 받지 않는다 */
  required?: boolean;
}

export interface GenerateRowsOptions {
  count: number;
  seed?: number | string | null;
  locale?: SampleLocale;
  /** 전역 빈 값 비율 0~1 — `blank` 미지정·required 아닌 컬럼에 적용 */
  blankRate?: number;
  references?: Readonly<Record<string, readonly unknown[]>>;
  /** 미리 만든 생성기를 이어 쓸 때 (같은 seed 스트림) */
  generators?: Generators;
  /** formula 가 읽는 문구 해소기 */
  t?: SampleRowContext["t"];
}

function readString(
  ctx: SampleRowContext,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  const value = ctx.row[key];
  return typeof value === "string" ? value : undefined;
}

function readGender(
  ctx: SampleRowContext,
  key: string | undefined,
): Gender | undefined {
  const value = readString(ctx, key);
  return value === "male" || value === "female" ? value : undefined;
}

function pickBy<T>(
  items: readonly T[],
  selection: ListSelection | undefined,
  ctx: SampleRowContext,
): T {
  if (items.length === 0) return undefined as T;
  return selection === "sequential"
    ? items[ctx.index % items.length]
    : ctx.mock.random.pick(items);
}

/** 규칙 하나 → 값 하나 */
export function generateValue(
  rule: SampleRule,
  ctx: SampleRowContext,
): unknown {
  const { mock } = ctx;
  switch (rule.kind) {
    case "rowNumber":
      return (rule.start ?? 1) + ctx.index;
    case "sequence":
      return mock.string.sequence(
        rule.prefix ?? "",
        (rule.start ?? 1) + ctx.index,
        rule.pad ?? 4,
      );
    case "id":
      return mock.string.id(rule.prefix);
    case "uuid":
      return mock.string.uuid();

    case "gender":
      return mock.person.gender();
    case "firstName":
      return mock.person.firstName(
        rule.gender ?? readGender(ctx, rule.genderKey),
      );
    case "lastName":
      return mock.person.lastName();
    case "fullName":
      return mock.person.fullName(
        rule.gender ?? readGender(ctx, rule.genderKey),
        readString(ctx, rule.firstKey),
        readString(ctx, rule.lastKey),
      );
    case "jobTitle":
      return mock.person.jobTitle();
    case "jobLevel":
      return mock.person.jobLevel();
    case "birthDate":
      return mock.person.birthDate({
        minAge: rule.minAge,
        maxAge: rule.maxAge,
      });
    case "age": {
      const birth = readString(ctx, rule.birthDateKey);
      return birth ? mock.person.ageOf(birth) : mock.random.int(18, 65);
    }

    case "email":
      return mock.internet.email(
        readString(ctx, rule.firstKey),
        readString(ctx, rule.lastKey),
        rule.unique ? ctx.index + 1 : undefined,
      );
    case "username":
      return mock.internet.username(
        readString(ctx, rule.firstKey),
        readString(ctx, rule.lastKey),
        rule.unique ? ctx.index + 1 : undefined,
      );
    case "password":
      return mock.internet.password(rule.length);
    case "url":
      return mock.internet.url(rule.path);
    case "ipv4":
      return mock.internet.ipv4();
    case "mac":
      return mock.internet.mac();
    case "userAgent":
      return mock.internet.userAgent();
    case "phone":
      return mock.phone.number(rule.format);
    case "cell":
      return mock.phone.cell();

    case "street":
      return mock.location.street();
    case "streetAddress":
      return mock.location.streetAddress();
    case "city":
      return mock.location.city();
    case "district":
      return mock.location.district();
    case "region":
      return mock.location.region();
    case "country":
      return mock.location.country();
    case "postcode":
      return mock.location.postcode();
    case "address":
      return mock.location.address();
    case "latitude":
      return mock.location.latitude(rule.precision);
    case "longitude":
      return mock.location.longitude(rule.precision);
    case "timezone":
      return mock.location.timezone();

    case "company":
      return mock.company.name();
    case "department":
      return mock.company.department();
    case "industry":
      return mock.company.industry();

    case "productName":
      return mock.commerce.productName();
    case "productCategory":
      return mock.commerce.category();
    case "brand":
      return mock.commerce.brand();
    case "sku":
      return mock.commerce.sku();
    case "barcode":
      return mock.commerce.barcode();
    case "price":
      return mock.commerce.price(rule);
    case "availability":
      return mock.commerce.availability();
    case "reviewComment":
      return mock.commerce.reviewComment();

    case "amount":
      return mock.finance.amount(rule);
    case "currency":
      return mock.finance.currency();
    case "cardType":
      return mock.finance.cardType();
    case "creditCardNumber": {
      const type = readString(ctx, rule.typeKey);
      const number = mock.finance.creditCardNumber(
        type === "visa" ||
          type === "mastercard" ||
          type === "amex" ||
          type === "discover"
          ? type
          : undefined,
      );
      return rule.masked ? mock.finance.maskCard(number) : number;
    }
    case "cardExpiry":
      return mock.finance.cardExpiry();
    case "accountNumber":
      return mock.finance.accountNumber();
    case "merchant":
      return mock.finance.merchant();
    case "transactionCategory":
      return mock.finance.transactionCategory();
    case "transactionType":
      return mock.finance.transactionType();

    case "int":
      return mock.random.int(rule.min ?? 0, rule.max ?? 100);
    case "decimal":
      return mock.random.float(
        rule.min ?? 0,
        rule.max ?? 100,
        rule.precision ?? 2,
      );
    case "boolean":
      return mock.random.bool(rule.trueRatio);

    case "pastDate":
      return mock.date.iso(
        mock.date.past({ years: rule.years, days: rule.days }),
        rule.withTime ?? true,
      );
    case "futureDate":
      return mock.date.iso(
        mock.date.future({ years: rule.years, days: rule.days }),
        rule.withTime ?? true,
      );
    case "dateBetween":
      return mock.date.iso(
        mock.date.between(rule.from, rule.to),
        rule.withTime ?? true,
      );
    case "now":
      return new Date().toISOString();

    case "enum":
      return pickBy(rule.values, rule.selection, ctx);
    case "weighted":
      return mock.random.weighted(rule.options);
    case "pool":
      return pickBy(mock.helpers.poolAll(rule.name), rule.selection, ctx);
    case "weightedPool": {
      const values = mock.helpers.poolAll(rule.name);
      if (values.length === 0) return undefined;
      return mock.random.weighted(
        values.map((value, i) => ({ value, weight: rule.weights[i] ?? 1 })),
      );
    }
    case "list": {
      const source =
        rule.values ?? (rule.pool ? mock.helpers.poolAll(rule.pool) : []);
      const min = rule.min ?? 1;
      const max = Math.max(min, rule.max ?? Math.min(3, source.length));
      return mock.helpers.arrayElements(source, [min, max]);
    }

    case "word":
      return mock.lorem.word();
    case "words":
      return mock.lorem.words(rule.count);
    case "sentence":
      return mock.lorem.sentence(rule.words);
    case "paragraph":
      return mock.lorem.paragraph(rule.sentences);
    case "title":
      return mock.lorem.title(rule.words);
    case "quote":
      return pickBy(mock.helpers.poolAll("quotes"), "sequential", ctx);
    case "quoteAuthor":
      return pickBy(mock.helpers.poolAll("quoteAuthors"), "sequential", ctx);

    case "image": {
      const seedFrom = readString(ctx, rule.seedKey);
      return mock.image.picsum({
        ...rule.picsum,
        seed:
          rule.picsum?.seed ??
          (seedFrom ? `${seedFrom}-${ctx.index + 1}` : undefined),
      });
    }
    case "imageList":
      return mock.helpers.multiple(
        () => mock.image.picsum(rule.picsum),
        [rule.min ?? 1, rule.max ?? 3],
      );
    case "avatar":
      return mock.image.avatar(readGender(ctx, rule.genderKey), rule.size);
    case "colorHex":
      return mock.color.hex();
    case "colorName":
      return mock.color.name();

    case "constant":
      return rule.value;
    case "object":
      return generateRow(rule.fields, ctx, undefined);
    case "array": {
      const count = mock.random.int(rule.min ?? 1, rule.max ?? 3);
      return Array.from({ length: count }, (_, i) => {
        const itemCtx: SampleRowContext = { ...ctx, index: i, row: {} };
        return Array.isArray(rule.item)
          ? generateRow(
              rule.item as readonly SampleColumn[],
              itemCtx,
              undefined,
            )
          : generateValue(rule.item as SampleRule, itemCtx);
      });
    }
    case "reference": {
      const values = ctx.references[rule.name] ?? [];
      return values.length === 0 ? null : pickBy(values, rule.selection, ctx);
    }
    case "formula":
      return rule.compute(ctx);
    case "template":
      return mock.helpers.fake(rule.template);
  }
}

/** 컬럼 목록 → 행 하나. blankRate 는 `blank` 없고 required 아닌 컬럼에만 */
export function generateRow(
  columns: readonly SampleColumn[],
  ctx: SampleRowContext,
  blankRate: number | undefined,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const rowCtx: SampleRowContext = { ...ctx, row };
  for (const column of columns) {
    const blank = column.blank ?? (column.required ? 0 : (blankRate ?? 0));
    if (blank > 0 && ctx.mock.random.bool(blank)) {
      row[column.key] = null;
      continue;
    }
    row[column.key] = generateValue(column.rule, rowCtx);
  }
  return row;
}

export interface GeneratedRows {
  rows: Record<string, unknown>[];
  /** 실제 seed — 같은 값으로 다시 만들면 같은 행 */
  seed: number;
}

export function generateRows(
  columns: readonly SampleColumn[],
  options: GenerateRowsOptions,
): GeneratedRows {
  const mock =
    options.generators ??
    createGenerators({ seed: options.seed, locale: options.locale });
  const references = options.references ?? {};
  const t = options.t ?? ((key: string) => key);
  const count = Math.max(0, Math.floor(options.count));
  const rows = Array.from({ length: count }, (_, index) =>
    generateRow(
      columns,
      { index, row: {}, mock, references, t },
      options.blankRate,
    ),
  );
  return { rows, seed: mock.seed };
}

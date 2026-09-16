/**
 * faker.js 식 생성기 — `createGenerators({ seed, locale })` 가 이름공간 객체를 돌려준다.
 *
 * 패턴 출처 (설치 없이 어법만 가져왔다):
 * - faker.js: 이름공간 (`person` · `internet` · `location` · `commerce` · `finance` · `date`
 *   · `lorem` · `helpers`) · seed · locale 풀 · `helpers.fake("{{person.firstName}}")` 템플릿
 * - randomuser.me: 성별 일관 프로필 (이름 ↔ 초상 사진) · `picture` 는 정적 경로
 *   `/api/portraits/{men|women}/{0-99}.jpg` 라 API 없이 URL 만 만든다
 * - picsum.photos: `/seed/{seed}/{w}/{h}` · `/id/{id}` · `?grayscale` · `?blur=1-10`
 * - mockaroo: Luhn 유효 카드 번호 · EAN-13 · 형식 문자열 `#`
 *
 * 외부 요청은 0 — URL 은 문자열로만 만든다.
 */

import { FALLBACK_LOCALE, type SampleLocale } from "./locale";
import { createRandom, type SeededRandom } from "./random";

export type Gender = "male" | "female";

export interface PicsumOptions {
  width?: number;
  height?: number;
  /** 같은 seed 는 같은 사진 — 생략 시 난수 seed */
  seed?: string;
  /** picsum 사진 id (0~1084). seed 보다 우선 */
  id?: number;
  grayscale?: boolean;
  /** 1~10 */
  blur?: number;
  format?: "jpg" | "webp";
}

export interface RangeOptions {
  min?: number;
  max?: number;
  precision?: number;
}

export interface DateRangeOptions {
  /** 기준 시각 — 생략 시 createGenerators 의 refDate (오늘 0시 UTC) */
  refDate?: Date | number | string;
  years?: number;
  days?: number;
}

export interface CreateGeneratorsOptions {
  seed?: number | string | null;
  locale?: SampleLocale;
  /**
   * 날짜 규칙의 기준 시각. 기본은 **오늘 0시 (UTC)** — 같은 seed 가 같은 날 안에서는
   * 같은 행을 내도록 (ms 단위 now 를 쓰면 호출마다 달라져 seed 가 무의미해진다).
   */
  refDate?: Date | number | string;
}

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "mail.test",
  "company.com",
  "webmail.net",
];
const CARD_TYPES = ["visa", "mastercard", "amex", "discover"] as const;
export type CardType = (typeof CARD_TYPES)[number];
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
];

function toMs(
  value: Date | number | string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** 오늘 0시 (UTC) */
function startOfTodayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Luhn 검사 자릿수 */
function luhnCheckDigit(partial: string): string {
  let sum = 0;
  let double = true;
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

/** EAN-13 검사 자릿수 */
function ean13CheckDigit(partial12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(partial12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/** 한글이 섞인 이름은 이메일 로컬파트로 못 쓴다 — 영숫자만 남기고 비면 user */
function asciiLocalPart(text: string): string {
  const ascii = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ascii || "user";
}

export interface Generators {
  readonly random: SeededRandom;
  readonly locale: SampleLocale;
  readonly seed: number;

  person: {
    gender(): Gender;
    firstName(gender?: Gender): string;
    lastName(): string;
    /** locale nameOrder 에 따라 성·이름 순서와 구분자를 정한다 */
    fullName(gender?: Gender, first?: string, last?: string): string;
    jobTitle(): string;
    jobLevel(): string;
    /** ISO 날짜 (YYYY-MM-DD) — 나이 범위로 */
    birthDate(options?: { minAge?: number; maxAge?: number }): string;
    ageOf(birthDate: string, refDate?: Date | number): number;
  };

  internet: {
    domain(): string;
    email(first?: string, last?: string, uniqueSuffix?: number): string;
    username(first?: string, last?: string, uniqueSuffix?: number): string;
    password(length?: number): string;
    url(path?: string): string;
    ipv4(): string;
    mac(): string;
    userAgent(): string;
  };

  phone: {
    /** `#` 을 숫자로 채운다. 형식 생략 시 locale phoneFormat */
    number(format?: string): string;
    cell(): string;
  };

  location: {
    street(): string;
    /** "12 Main St" / "테헤란로 12" — nameOrder 로 번지 위치 */
    streetAddress(): string;
    city(): string;
    district(): string;
    region(): string;
    country(): string;
    postcode(): string;
    latitude(precision?: number): number;
    longitude(precision?: number): number;
    timezone(): string;
    /** 한 줄 주소 */
    address(): string;
  };

  company: {
    name(): string;
    department(): string;
    industry(): string;
  };

  commerce: {
    productName(): string;
    productAdjective(): string;
    productMaterial(): string;
    product(): string;
    category(): string;
    brand(): string;
    price(options?: RangeOptions): number;
    /** 12 자리 + 검사 자릿수 (EAN-13) */
    barcode(): string;
    /** BRD-XXXX-NNNN */
    sku(): string;
    availability(): string;
    reviewComment(): string;
  };

  finance: {
    amount(options?: RangeOptions): number;
    currency(): string;
    cardType(): CardType;
    /** Luhn 유효 번호 (형식은 종류별 prefix·길이) */
    creditCardNumber(type?: CardType): string;
    /** 앞 4·뒤 4 만 남긴다 */
    maskCard(number: string): string;
    /** MM/YY — 미래 1~5년 */
    cardExpiry(): string;
    accountNumber(): string;
    merchant(): string;
    transactionCategory(): string;
    transactionType(): string;
  };

  date: {
    past(options?: DateRangeOptions): Date;
    future(options?: DateRangeOptions): Date;
    recent(days?: number, refDate?: Date | number | string): Date;
    soon(days?: number, refDate?: Date | number | string): Date;
    between(from: Date | number | string, to: Date | number | string): Date;
    /** ISO 문자열 — withTime false 면 YYYY-MM-DD */
    iso(date: Date, withTime?: boolean): string;
  };

  image: {
    picsum(options?: PicsumOptions): string;
    /** picsum `/v2/list` 항목과 같은 모양 */
    picsumInfo(
      index: number,
      options?: PicsumOptions,
    ): {
      id: string;
      author: string;
      width: number;
      height: number;
      url: string;
      download_url: string;
    };
    /** randomuser.me 초상 — 성별별 0~99. size: large 128 · medium 72 · thumbnail 48 */
    avatar(gender?: Gender, size?: "large" | "medium" | "thumbnail"): string;
  };

  lorem: {
    word(): string;
    words(count?: number): string;
    sentence(wordCount?: number): string;
    sentences(count?: number): string;
    paragraph(sentenceCount?: number): string;
    /** 제목 — 첫 글자 대문자, 마침표 없음 */
    title(wordCount?: number): string;
  };

  color: {
    hex(): string;
    rgb(): string;
    name(): string;
  };

  string: {
    uuid(): string;
    alnum(length?: number): string;
    /** 기존 preset `getRandomId("usr_")` 와 같은 모양 — prefix + 영숫자 8~16 */
    id(prefix?: string): string;
    /** 순번 id — prefix + 0 채움 */
    sequence(prefix: string, index: number, pad?: number): string;
  };

  helpers: {
    arrayElement<T>(items: readonly T[]): T;
    arrayElements<T>(
      items: readonly T[],
      count?: number | [number, number],
    ): T[];
    weightedArrayElement<T>(
      options: readonly { value: T; weight: number }[],
    ): T;
    multiple<T>(
      factory: (index: number) => T,
      count: number | [number, number],
    ): T[];
    /** probability 확률로 factory, 아니면 undefined */
    maybe<T>(factory: () => T, probability?: number): T | undefined;
    /** `"{{person.firstName}} {{person.lastName}}"` — 이름공간.메서드 를 호출 결과로 */
    fake(template: string): string;
    /** locale 풀에서 하나 */
    pool(name: keyof SampleLocale): string;
    poolAll(name: keyof SampleLocale): string[];
  };
}

export function createGenerators(
  options: CreateGeneratorsOptions = {},
): Generators {
  const random = createRandom(options.seed);
  const locale = options.locale ?? FALLBACK_LOCALE;
  const refMs = toMs(options.refDate, startOfTodayUtc());

  const poolAll = (name: keyof SampleLocale): string[] => {
    const value = locale[name];
    return Array.isArray(value) ? value : [String(value)];
  };
  const pool = (name: keyof SampleLocale): string => random.pick(poolAll(name));

  const fillFormat = (format: string): string =>
    format.replace(/#/g, () => String(random.int(0, 9)));

  const capitalize = (text: string): string =>
    text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);

  const person: Generators["person"] = {
    gender: () => (random.bool() ? "male" : "female"),
    firstName: (gender) =>
      pool(
        (gender ?? person.gender()) === "male"
          ? "firstNamesMale"
          : "firstNamesFemale",
      ),
    lastName: () => pool("lastNames"),
    fullName: (gender, first, last) => {
      const given = first ?? person.firstName(gender);
      const family = last ?? person.lastName();
      return locale.nameOrder === "family-first"
        ? `${family}${locale.nameSeparator}${given}`
        : `${given}${locale.nameSeparator}${family}`;
    },
    jobTitle: () => pool("jobTitles"),
    jobLevel: () => pool("jobLevels"),
    birthDate: ({ minAge = 18, maxAge = 65 } = {}) => {
      const now = new Date(refMs);
      const to = new Date(now);
      to.setFullYear(now.getFullYear() - minAge);
      const from = new Date(now);
      from.setFullYear(now.getFullYear() - maxAge - 1);
      return date.iso(date.between(from, to), false);
    },
    ageOf: (birthDate, refDate) => {
      const birth = new Date(birthDate);
      const ref = new Date(toMs(refDate, refMs));
      let age = ref.getFullYear() - birth.getFullYear();
      const beforeBirthday =
        ref.getMonth() < birth.getMonth() ||
        (ref.getMonth() === birth.getMonth() &&
          ref.getDate() < birth.getDate());
      if (beforeBirthday) age -= 1;
      return Math.max(0, age);
    },
  };

  const internet: Generators["internet"] = {
    domain: () => random.pick(EMAIL_DOMAINS),
    email: (first, last, uniqueSuffix) => {
      const local = internet.username(first, last, uniqueSuffix);
      return `${local}@${internet.domain()}`;
    },
    username: (first, last, uniqueSuffix) => {
      const a = asciiLocalPart(first ?? random.alnum(5));
      const b = asciiLocalPart(last ?? "");
      const base = b && b !== "user" ? `${a}.${b}` : a;
      const suffix = uniqueSuffix ?? random.int(1, 999);
      return `${base}${suffix}`;
    },
    password: (length = 12) => random.alnum(length),
    url: (path) => `https://${internet.domain()}/${path ?? random.alnum(6)}`,
    ipv4: () => Array.from({ length: 4 }, () => random.int(1, 254)).join("."),
    mac: () =>
      Array.from({ length: 6 }, () => random.hex(2))
        .join(":")
        .toUpperCase(),
    userAgent: () => random.pick(USER_AGENTS),
  };

  const phone: Generators["phone"] = {
    number: (format) => fillFormat(format ?? locale.phoneFormat),
    cell: () => fillFormat(locale.cellFormat),
  };

  const location: Generators["location"] = {
    street: () => pool("streets"),
    streetAddress: () => {
      const number = random.int(1, 299);
      const street = location.street();
      return locale.nameOrder === "family-first"
        ? `${street} ${number}`
        : `${number} ${street}`;
    },
    city: () => pool("cities"),
    district: () => pool("districts"),
    region: () => pool("regions"),
    country: () => locale.country,
    postcode: () => fillFormat(locale.postcodeFormat),
    latitude: (precision = 4) => random.float(-90, 90, precision),
    longitude: (precision = 4) => random.float(-180, 180, precision),
    timezone: () => pool("timezones"),
    address: () => {
      const parts =
        locale.nameOrder === "family-first"
          ? [location.city(), location.district(), location.streetAddress()]
          : [location.streetAddress(), location.city(), location.region()];
      return parts.join(locale.nameOrder === "family-first" ? " " : ", ");
    },
  };

  const company: Generators["company"] = {
    name: () => pool("companies"),
    department: () => pool("departments"),
    industry: () => pool("industries"),
  };

  const commerce: Generators["commerce"] = {
    productAdjective: () => pool("productAdjectives"),
    productMaterial: () => pool("productMaterials"),
    product: () => pool("productNouns"),
    productName: () =>
      [
        commerce.productAdjective(),
        commerce.productMaterial(),
        commerce.product(),
      ].join(" "),
    category: () => pool("productCategories"),
    brand: () => pool("brands"),
    price: ({ min = 1, max = 1000, precision = 2 } = {}) =>
      random.float(min, max, precision),
    barcode: () => {
      const body = random.digits(12);
      return body + ean13CheckDigit(body);
    },
    sku: () =>
      `${random.alnum(3).toUpperCase()}-${random.alnum(4).toUpperCase()}-${random.digits(4)}`,
    availability: () => pool("availabilityStatuses"),
    reviewComment: () => pool("reviewComments"),
  };

  const finance: Generators["finance"] = {
    amount: ({ min = 0, max = 1000, precision = 2 } = {}) =>
      random.float(min, max, precision),
    currency: () => locale.currency,
    cardType: () => random.pick(CARD_TYPES),
    creditCardNumber: (type) => {
      const kind = type ?? finance.cardType();
      const [prefix, length] =
        kind === "visa"
          ? ["4", 16]
          : kind === "mastercard"
            ? [String(random.int(51, 55)), 16]
            : kind === "amex"
              ? [random.pick(["34", "37"]), 15]
              : ["6011", 16];
      const body = prefix + random.digits(length - prefix.length - 1);
      return body + luhnCheckDigit(body);
    },
    maskCard: (number) => {
      const digits = number.replace(/\D/g, "");
      if (digits.length <= 8) return digits;
      return `${digits.slice(0, 4)}${"*".repeat(digits.length - 8)}${digits.slice(-4)}`;
    },
    cardExpiry: () => {
      const expiry = date.future({ years: 5 });
      return `${String(expiry.getMonth() + 1).padStart(2, "0")}/${String(expiry.getFullYear()).slice(-2)}`;
    },
    accountNumber: () =>
      `${random.digits(3)}-${random.digits(6)}-${random.digits(2)}`,
    merchant: () => pool("merchants"),
    transactionCategory: () => pool("transactionCategories"),
    transactionType: () => pool("transactionTypes"),
  };

  const date: Generators["date"] = {
    past: ({ refDate, years, days } = {}) => {
      const ref = toMs(refDate, refMs);
      const span = days !== undefined ? days * DAY : (years ?? 1) * 365 * DAY;
      return new Date(ref - random.next() * span);
    },
    future: ({ refDate, years, days } = {}) => {
      const ref = toMs(refDate, refMs);
      const span = days !== undefined ? days * DAY : (years ?? 1) * 365 * DAY;
      return new Date(ref + random.next() * span);
    },
    recent: (days = 1, refDate) => date.past({ days, refDate }),
    soon: (days = 1, refDate) => date.future({ days, refDate }),
    between: (from, to) => {
      const lo = toMs(from, refMs);
      const hi = toMs(to, refMs);
      const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
      return new Date(a + random.next() * (b - a));
    },
    iso: (value, withTime = true) => {
      const iso = value.toISOString();
      return withTime ? iso : iso.slice(0, 10);
    },
  };

  const image: Generators["image"] = {
    picsum: ({
      width = 200,
      height = width,
      seed,
      id,
      grayscale,
      blur,
      format,
    } = {}) => {
      const ext = format ? `.${format}` : "";
      const base =
        id !== undefined
          ? `https://picsum.photos/id/${id}/${width}/${height}${ext}`
          : `https://picsum.photos/seed/${seed ?? random.alnum(8)}/${width}/${height}${ext}`;
      const query: string[] = [];
      if (grayscale) query.push("grayscale");
      if (blur !== undefined)
        query.push(`blur=${Math.max(1, Math.min(10, blur))}`);
      return query.length > 0 ? `${base}?${query.join("&")}` : base;
    },
    picsumInfo: (index, options = {}) => {
      const id = options.id ?? random.int(0, 1084);
      const width =
        options.width ?? random.pick([1920, 2500, 3000, 4000, 5000]);
      const height =
        options.height ?? random.pick([1080, 1667, 2000, 2667, 3333]);
      return {
        id: String(id),
        author: person.fullName(),
        width,
        height,
        url: `https://picsum.photos/id/${id}/info#${index}`,
        download_url: `https://picsum.photos/id/${id}/${width}/${height}`,
      };
    },
    avatar: (gender, size = "medium") => {
      const folder = (gender ?? person.gender()) === "male" ? "men" : "women";
      const bucket =
        size === "large" ? "" : size === "medium" ? "med/" : "thumb/";
      return `https://randomuser.me/api/portraits/${bucket}${folder}/${random.int(0, 99)}.jpg`;
    },
  };

  const lorem: Generators["lorem"] = {
    word: () => pool("words"),
    words: (count = 3) =>
      Array.from({ length: count }, () => lorem.word()).join(" "),
    sentence: (wordCount) => {
      const n = wordCount ?? random.int(5, 11);
      return `${capitalize(lorem.words(n))}.`;
    },
    sentences: (count = 2) =>
      Array.from({ length: count }, () => lorem.sentence()).join(" "),
    paragraph: (sentenceCount = 3) => lorem.sentences(sentenceCount),
    title: (wordCount) =>
      capitalize(lorem.words(wordCount ?? random.int(3, 6))),
  };

  const color: Generators["color"] = {
    hex: () => `#${random.hex(6)}`,
    rgb: () =>
      `rgb(${random.int(0, 255)}, ${random.int(0, 255)}, ${random.int(0, 255)})`,
    name: () => pool("colorNames"),
  };

  const string: Generators["string"] = {
    uuid: () => random.uuid(),
    alnum: (length = 8) => random.alnum(length),
    id: (prefix = "") =>
      prefix + random.alnum(random.int(8, 16) - prefix.length),
    sequence: (prefix, index, pad = 4) =>
      `${prefix}${String(index).padStart(pad, "0")}`,
  };

  const helpers: Generators["helpers"] = {
    arrayElement: (items) => random.pick(items),
    arrayElements: (items, count) => {
      const n =
        count === undefined
          ? random.int(1, items.length)
          : typeof count === "number"
            ? count
            : random.int(count[0], count[1]);
      return random.sample(items, n);
    },
    weightedArrayElement: (options) => random.weighted(options),
    multiple: (factory, count) => {
      const n =
        typeof count === "number" ? count : random.int(count[0], count[1]);
      return Array.from({ length: n }, (_, index) => factory(index));
    },
    maybe: (factory, probability = 0.5) =>
      random.bool(probability) ? factory() : undefined,
    fake: (template) =>
      template.replace(
        /\{\{\s*([a-zA-Z]+)\.([a-zA-Z]+)\s*\}\}/g,
        (_, ns, fn) => {
          const namespace = (mock as unknown as Record<string, unknown>)[ns];
          const method =
            namespace && typeof namespace === "object"
              ? (namespace as Record<string, unknown>)[fn]
              : undefined;
          return typeof method === "function"
            ? String(method())
            : `{{${ns}.${fn}}}`;
        },
      ),
    pool,
    poolAll,
  };

  const mock: Generators = {
    random,
    locale,
    seed: random.seed,
    person,
    internet,
    phone,
    location,
    company,
    commerce,
    finance,
    date,
    image,
    lorem,
    color,
    string,
    helpers,
  };
  return mock;
}

import { describe, expect, it } from "vitest";
import {
  FALLBACK_LOCALE,
  createGenerators,
  createRandom,
  generateRows,
  hashSeed,
  resolveSampleLocale,
  type SampleColumn,
} from "./index";

const luhnValid = (digits: string): boolean => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

describe("mockData/random — seed 결정성 (faker.seed 어법)", () => {
  it("같은 seed 는 같은 수열, 다른 seed 는 다른 수열", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const c = createRandom(43);
    const seqA = Array.from({ length: 5 }, () => a.int(0, 1000));
    const seqB = Array.from({ length: 5 }, () => b.int(0, 1000));
    const seqC = Array.from({ length: 5 }, () => c.int(0, 1000));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it("문자열 seed 는 FNV-1a 로 접고, 숫자 문자열은 숫자로 읽는다", () => {
    expect(createRandom("abc").seed).toBe(hashSeed("abc"));
    expect(createRandom("123").seed).toBe(123);
    expect(createRandom("").seed).not.toBe(createRandom("").seed);
  });

  it("int 는 양끝 포함, weighted 는 가중치 0 을 뽑지 않는다", () => {
    const r = createRandom(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    for (let i = 0; i < 200; i++) {
      expect(
        r.weighted([
          { value: "a", weight: 0 },
          { value: "b", weight: 1 },
        ]),
      ).toBe("b");
    }
  });

  it("uuid 는 v4 모양", () => {
    expect(createRandom(7).uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("mockData/locale — 카탈로그 풀 → SampleLocale", () => {
  it("해소되지 않은 키는 fallback, 해소된 풀은 쉼표로 자른다", () => {
    const t = (key: string) =>
      key === "presetData.lastNames"
        ? "김, 이, 박"
        : key === "presetData.nameOrder"
          ? "family-first"
          : key === "presetData.firstNames"
            ? "민준, 서연"
            : key;
    const locale = resolveSampleLocale(t);
    expect(locale.lastNames).toEqual(["김", "이", "박"]);
    expect(locale.nameOrder).toBe("family-first");
    expect(locale.nameSeparator).toBe("");
    // 성별 풀이 없으면 기존 unisex 풀을 둘 다에
    expect(locale.firstNamesMale).toEqual(["민준", "서연"]);
    expect(locale.firstNamesFemale).toEqual(["민준", "서연"]);
    expect(locale.words).toEqual(FALLBACK_LOCALE.words);
  });
});

describe("mockData/generators — faker 이름공간", () => {
  const mock = createGenerators({ seed: 2026 });

  it("fullName 은 nameOrder 를 따른다", () => {
    const en = createGenerators({ seed: 1 });
    expect(en.person.fullName("male", "James", "Kim")).toBe("James Kim");
    const ko = createGenerators({
      seed: 1,
      locale: {
        ...FALLBACK_LOCALE,
        nameOrder: "family-first",
        nameSeparator: "",
      },
    });
    expect(ko.person.fullName("male", "민준", "김")).toBe("김민준");
  });

  it("email 은 이름에서 ASCII 로컬파트만, 한글 이름은 user 로 폴백", () => {
    expect(mock.internet.email("James", "Kim", 3)).toMatch(
      /^james\.kim3@[a-z.]+$/,
    );
    expect(mock.internet.email("민준", "김", 3)).toMatch(/^user3@/);
  });

  it("creditCardNumber 는 Luhn 유효 · amex 15 자리 · mask 는 앞4 뒤4", () => {
    for (let i = 0; i < 20; i++) {
      const visa = mock.finance.creditCardNumber("visa");
      expect(visa).toHaveLength(16);
      expect(visa.startsWith("4")).toBe(true);
      expect(luhnValid(visa)).toBe(true);
    }
    const amex = mock.finance.creditCardNumber("amex");
    expect(amex).toHaveLength(15);
    expect(luhnValid(amex)).toBe(true);
    expect(mock.finance.maskCard("4111111111111111")).toBe("4111********1111");
  });

  it("barcode 는 EAN-13 검사 자릿수", () => {
    const code = mock.commerce.barcode();
    expect(code).toHaveLength(13);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
    expect((10 - (sum % 10)) % 10).toBe(Number(code[12]));
  });

  it("picsum URL — seed · id · grayscale · blur (1~10 클램프)", () => {
    expect(mock.image.picsum({ seed: "hero", width: 640, height: 480 })).toBe(
      "https://picsum.photos/seed/hero/640/480",
    );
    expect(
      mock.image.picsum({ id: 237, width: 200, grayscale: true, blur: 12 }),
    ).toBe("https://picsum.photos/id/237/200/200?grayscale&blur=10");
    expect(mock.image.picsum({ seed: "x", format: "webp" })).toBe(
      "https://picsum.photos/seed/x/200/200.webp",
    );
  });

  it("avatar 는 randomuser 정적 초상 경로, 성별 폴더 일치", () => {
    expect(mock.image.avatar("female", "large")).toMatch(
      /^https:\/\/randomuser\.me\/api\/portraits\/women\/\d{1,2}\.jpg$/,
    );
    expect(mock.image.avatar("male", "thumbnail")).toMatch(
      /^https:\/\/randomuser\.me\/api\/portraits\/thumb\/men\/\d{1,2}\.jpg$/,
    );
  });

  it("phone 은 형식의 # 을 숫자로", () => {
    expect(mock.phone.number("010-####-####")).toMatch(/^010-\d{4}-\d{4}$/);
  });

  it("birthDate → ageOf 가 나이 범위 안", () => {
    for (let i = 0; i < 30; i++) {
      const dob = mock.person.birthDate({ minAge: 20, maxAge: 30 });
      const age = mock.person.ageOf(dob);
      expect(age).toBeGreaterThanOrEqual(20);
      expect(age).toBeLessThanOrEqual(30);
    }
  });

  it("helpers.fake 템플릿은 이름공간.메서드 를 치환하고 모르는 건 남긴다", () => {
    const text = mock.helpers.fake(
      "{{person.firstName}} @ {{company.name}} {{nope.x}}",
    );
    expect(text).not.toContain("{{person.firstName}}");
    expect(text).toContain("{{nope.x}}");
  });
});

describe("mockData/rules — mockaroo 식 컬럼 규칙", () => {
  const columns: SampleColumn[] = [
    { key: "id", rule: { kind: "sequence", prefix: "usr_" }, required: true },
    { key: "gender", rule: { kind: "gender" } },
    { key: "first", rule: { kind: "firstName", genderKey: "gender" } },
    { key: "last", rule: { kind: "lastName" } },
    {
      key: "name",
      rule: { kind: "fullName", firstKey: "first", lastKey: "last" },
      required: true,
    },
    {
      key: "email",
      rule: { kind: "email", firstKey: "first", lastKey: "last", unique: true },
    },
    { key: "avatar", rule: { kind: "avatar", genderKey: "gender" } },
    { key: "price", rule: { kind: "price", min: 10, max: 20 } },
    {
      key: "discount",
      rule: { kind: "formula", compute: ({ row }) => Number(row.price) * 0.5 },
    },
    {
      key: "status",
      rule: { kind: "enum", values: ["a", "b", "c"], selection: "sequential" },
    },
    {
      key: "tier",
      rule: {
        kind: "weighted",
        options: [
          { value: "free", weight: 9 },
          { value: "pro", weight: 1 },
        ],
      },
    },
    { key: "note", rule: { kind: "sentence", words: 3 }, blank: 1 },
  ];

  it("같은 seed 면 같은 행 · 행마다 앞 컬럼을 읽어 일관된 프로필", () => {
    const a = generateRows(columns, { count: 5, seed: "profile" });
    const b = generateRows(columns, { count: 5, seed: "profile" });
    expect(a.rows).toEqual(b.rows);
    expect(a.seed).toBe(hashSeed("profile"));
    for (const [i, row] of a.rows.entries()) {
      expect(row.id).toBe(`usr_${String(i + 1).padStart(4, "0")}`);
      expect(String(row.name)).toContain(String(row.first));
      expect(String(row.email)).toMatch(new RegExp(`${i + 1}@`));
      expect(String(row.avatar)).toContain(
        row.gender === "male" ? "/men/" : "/women/",
      );
      expect(row.discount).toBe(Number(row.price) * 0.5);
      expect(row.status).toBe(["a", "b", "c"][i % 3]);
      expect(row.note).toBeNull();
    }
  });

  it("전역 blankRate 는 required 아닌 컬럼만 비운다", () => {
    const { rows } = generateRows(columns, {
      count: 40,
      seed: 5,
      blankRate: 1,
    });
    for (const row of rows) {
      expect(row.id).not.toBeNull();
      expect(row.name).not.toBeNull();
      expect(row.email).toBeNull();
      expect(row.price).toBeNull();
    }
  });

  it("weighted 는 가중치 비율을 대략 따른다", () => {
    const { rows } = generateRows(columns, { count: 400, seed: 9 });
    const pro = rows.filter((r) => r.tier === "pro").length;
    expect(pro).toBeGreaterThan(10);
    expect(pro).toBeLessThan(100);
  });

  it("object · array · reference · template 규칙", () => {
    const { rows } = generateRows(
      [
        {
          key: "dimensions",
          rule: {
            kind: "object",
            fields: [
              { key: "w", rule: { kind: "int", min: 1, max: 9 } },
              { key: "h", rule: { kind: "int", min: 1, max: 9 } },
            ],
          },
        },
        {
          key: "items",
          rule: {
            kind: "array",
            min: 2,
            max: 2,
            item: [
              { key: "qty", rule: { kind: "int", min: 1, max: 3 } },
              {
                key: "productId",
                rule: { kind: "reference", name: "products" },
              },
            ],
          },
        },
        { key: "owner", rule: { kind: "reference", name: "users" } },
        { key: "missing", rule: { kind: "reference", name: "nothing" } },
        {
          key: "greeting",
          rule: { kind: "template", template: "Hi {{person.firstName}}" },
        },
      ],
      {
        count: 3,
        seed: 3,
        references: { products: ["p1", "p2"], users: ["u1"] },
      },
    );
    for (const row of rows) {
      const dims = row.dimensions as { w: number; h: number };
      expect(dims.w).toBeGreaterThanOrEqual(1);
      const items = row.items as { qty: number; productId: string }[];
      expect(items).toHaveLength(2);
      expect(["p1", "p2"]).toContain(items[0].productId);
      expect(row.owner).toBe("u1");
      expect(row.missing).toBeNull();
      expect(String(row.greeting)).toMatch(/^Hi \w+$/);
    }
  });
});

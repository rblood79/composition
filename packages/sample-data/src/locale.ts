/**
 * 생성기 locale — faker.js 의 locale 정의 (`faker/locale/ko`) 에 해당한다.
 *
 * faker 는 locale 데이터를 패키지 안에 들고 있지만 여기서는 **i18n 카탈로그
 * (`presetData.*`)** 가 풀의 정본이다 (ADR-200 후속 — 번역이 아니라 「같은 자리에 오는
 * 다른 값 묶음」). 이 모듈은 카탈로그를 읽어 `SampleLocale` 로 접고, provider 밖(격리
 * 렌더 · 테스트 · AI tableSpec) 에서는 `FALLBACK_LOCALE` 로 동작한다.
 *
 * 풀 계약: 쉼표+공백 구분, 값 안에 쉼표 없음. 형식 문자열의 `#` 은 숫자 한 자리.
 */

export type NameOrder = "family-first" | "given-first";

export interface SampleLocale {
  id: string;
  nameOrder: NameOrder;
  /** 이름 사이 구분 — ko 는 붙여 쓰고 en 은 공백 */
  nameSeparator: string;

  firstNamesMale: string[];
  firstNamesFemale: string[];
  lastNames: string[];

  companies: string[];
  jobTitles: string[];
  departments: string[];
  industries: string[];
  jobLevels: string[];

  /** 주소 — randomuser `location` · mockaroo Street/City/State/Postal */
  streets: string[];
  cities: string[];
  districts: string[];
  regions: string[];
  country: string;
  /** `#####` 같은 자리 형식 */
  postcodeFormat: string;
  phoneFormat: string;
  cellFormat: string;
  timezones: string[];

  /** lorem — ko 는 한국어 낱말 풀, en 은 lorem ipsum */
  words: string[];

  /** 상품 — faker `commerce.productName` 의 형용사 × 소재 × 명사 */
  productAdjectives: string[];
  productMaterials: string[];
  productNouns: string[];
  productCategories: string[];
  brands: string[];
  availabilityStatuses: string[];
  reviewComments: string[];

  /** 레시피 — dummyjson `/recipes` */
  cuisines: string[];
  mealTypes: string[];
  dishes: string[];
  difficulties: string[];

  /** 금융 — mockaroo Money/Credit Card · dummyjson `bank` */
  currency: string;
  merchants: string[];
  transactionCategories: string[];
  transactionTypes: string[];

  /** 콘텐츠 — dummyjson `/posts` `/todos` `/quotes` */
  tags: string[];
  todoTasks: string[];
  priorities: string[];
  quotes: string[];
  quoteAuthors: string[];

  colorNames: string[];

  /** 기존 preset 풀 (users-auth · organization · manufacturing · system) */
  roleNames: string[];
  roleDescriptions: string[];
  permissionNames: string[];
  permissionDescriptions: string[];
  userStatuses: string[];
  projectStatuses: string[];
  orderStatuses: string[];
  plans: string[];
  engineStatuses: string[];
  manufacturers: string[];
  suppliers: string[];
  partStatuses: string[];
  auditActions: string[];
}

/** 카탈로그 값 해소기 — i18n `t` 와 호환 (키를 받아 문구를 돌려준다) */
export type PoolTranslate = (key: string) => string;

/** 어느 풀도 카탈로그가 없을 때 — 영문 최소 풀. 값은 enUS 카탈로그와 같은 것을 짧게 */
export const FALLBACK_LOCALE: SampleLocale = {
  id: "en",
  nameOrder: "given-first",
  nameSeparator: " ",
  firstNamesMale: ["James", "Liam", "Noah", "Ethan", "Lucas", "Owen"],
  firstNamesFemale: ["Emma", "Olivia", "Ava", "Mia", "Chloe", "Zoe"],
  lastNames: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho"],
  companies: ["Acme", "Globex", "Initech", "Umbrella", "Hooli"],
  jobTitles: ["Engineer", "Designer", "Manager", "Analyst", "Architect"],
  departments: ["R&D", "Sales", "HR", "Finance", "Support"],
  industries: ["IT", "Manufacturing", "Finance", "Education", "Healthcare"],
  jobLevels: ["Junior", "Mid", "Senior", "Lead", "Director"],
  streets: ["Main St", "Oak Ave", "Pine Rd", "Maple Dr", "Cedar Ln"],
  cities: ["Springfield", "Riverside", "Fairview", "Franklin", "Clinton"],
  districts: ["North", "South", "East", "West"],
  regions: ["CA", "NY", "TX", "WA", "IL"],
  country: "United States",
  postcodeFormat: "#####",
  phoneFormat: "(###) ###-####",
  cellFormat: "###-###-####",
  timezones: ["-8:00", "-5:00", "+0:00", "+1:00", "+9:00"],
  words:
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(
      " ",
    ),
  productAdjectives: ["Small", "Ergonomic", "Rustic", "Sleek", "Handmade"],
  productMaterials: ["Steel", "Wooden", "Cotton", "Granite", "Rubber"],
  productNouns: ["Chair", "Lamp", "Keyboard", "Bottle", "Bag"],
  productCategories: ["Electronics", "Clothing", "Food", "Furniture", "Books"],
  brands: ["Apex", "Nimbus", "Orion", "Vertex", "Zenith"],
  availabilityStatuses: ["In Stock", "Low Stock", "Out of Stock"],
  reviewComments: ["Great product!", "Works as expected.", "Would buy again."],
  cuisines: ["Korean", "Italian", "Mexican", "Japanese", "Indian"],
  mealTypes: ["Breakfast", "Lunch", "Dinner", "Snack"],
  dishes: ["Bibimbap", "Pasta", "Tacos", "Ramen", "Curry"],
  difficulties: ["Easy", "Medium", "Hard"],
  currency: "USD",
  merchants: ["Coffee House", "Grocery Mart", "Book Store", "Gas Station"],
  transactionCategories: ["Food", "Transport", "Shopping", "Bills"],
  transactionTypes: ["debit", "credit", "refund"],
  tags: ["new", "hot", "sale", "featured", "popular"],
  todoTasks: ["Write report", "Call client", "Review PR", "Plan sprint"],
  priorities: ["low", "medium", "high"],
  quotes: [
    "Simplicity is the ultimate sophistication.",
    "Stay hungry, stay foolish.",
  ],
  quoteAuthors: ["Leonardo da Vinci", "Steve Jobs"],
  colorNames: ["Red", "Blue", "Green", "Yellow", "Purple"],
  roleNames: ["Admin", "Editor", "Viewer", "Guest", "Owner"],
  roleDescriptions: [
    "Full access",
    "Can edit content",
    "Read only",
    "Limited access",
    "Highest privilege",
  ],
  permissionNames: [
    "users.read",
    "users.write",
    "projects.read",
    "projects.write",
    "settings.write",
  ],
  permissionDescriptions: [
    "List users",
    "Create/update/delete users",
    "View projects",
    "Edit projects",
    "Change settings",
  ],
  userStatuses: ["active", "invited", "dormant", "suspended"],
  projectStatuses: ["planned", "active", "on-hold", "done"],
  orderStatuses: ["pending", "processing", "shipped", "delivered", "cancelled"],
  plans: ["free", "pro", "enterprise"],
  engineStatuses: ["design", "build", "test", "production", "retired"],
  manufacturers: ["Mobis", "LG", "Samsung SDI", "Mando"],
  suppliers: ["Wia", "Daewon", "Sewon", "Hwashin"],
  partStatuses: ["ok", "discontinued", "review", "pending"],
  auditActions: ["create", "update", "delete", "grant", "login"],
};

/** 쉼표+공백 풀 → 배열. 카탈로그가 키를 그대로 돌려주면 (미해소) undefined */
function poolOf(t: PoolTranslate, name: string): string[] | undefined {
  const key = `presetData.${name}`;
  const raw = t(key);
  if (!raw || raw === key) return undefined;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function scalarOf(t: PoolTranslate, name: string): string | undefined {
  const key = `presetData.${name}`;
  const raw = t(key);
  return !raw || raw === key ? undefined : raw;
}

const LIST_KEYS = [
  "firstNamesMale",
  "firstNamesFemale",
  "lastNames",
  "companies",
  "jobTitles",
  "departments",
  "industries",
  "jobLevels",
  "streets",
  "cities",
  "districts",
  "regions",
  "timezones",
  "words",
  "productAdjectives",
  "productMaterials",
  "productNouns",
  "productCategories",
  "brands",
  "availabilityStatuses",
  "reviewComments",
  "cuisines",
  "mealTypes",
  "dishes",
  "difficulties",
  "merchants",
  "transactionCategories",
  "transactionTypes",
  "tags",
  "todoTasks",
  "priorities",
  "quotes",
  "quoteAuthors",
  "colorNames",
  "roleNames",
  "roleDescriptions",
  "permissionNames",
  "permissionDescriptions",
  "userStatuses",
  "projectStatuses",
  "orderStatuses",
  "plans",
  "engineStatuses",
  "manufacturers",
  "suppliers",
  "partStatuses",
  "auditActions",
] as const satisfies readonly (keyof SampleLocale)[];

const SCALAR_KEYS = [
  "country",
  "postcodeFormat",
  "phoneFormat",
  "cellFormat",
  "currency",
] as const satisfies readonly (keyof SampleLocale)[];

/**
 * i18n 카탈로그 → SampleLocale. 풀마다 개별 fallback — 카탈로그에 없는 풀만 영문으로.
 * `firstNames` (성별 없는 기존 풀) 만 있고 성별 풀이 없으면 둘 다 그것으로.
 */
export function resolveSampleLocale(t: PoolTranslate): SampleLocale {
  const locale: SampleLocale = { ...FALLBACK_LOCALE };
  for (const key of LIST_KEYS) {
    const values = poolOf(t, key);
    if (values && values.length > 0) locale[key] = values;
  }
  for (const key of SCALAR_KEYS) {
    const value = scalarOf(t, key);
    if (value) locale[key] = value;
  }
  const unisex = poolOf(t, "firstNames");
  if (unisex && unisex.length > 0) {
    if (!poolOf(t, "firstNamesMale")) locale.firstNamesMale = unisex;
    if (!poolOf(t, "firstNamesFemale")) locale.firstNamesFemale = unisex;
  }
  const nameOrder = scalarOf(t, "nameOrder");
  if (nameOrder === "family-first" || nameOrder === "given-first") {
    locale.nameOrder = nameOrder;
    locale.nameSeparator = nameOrder === "family-first" ? "" : " ";
  }
  const cityName = scalarOf(t, "cityName");
  if (cityName && !poolOf(t, "cities")) locale.cities = [cityName];
  const id = scalarOf(t, "localeId");
  if (id) locale.id = id;
  return locale;
}

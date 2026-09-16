/**
 * 자체 Mock 데이터 모듈 — 라이브러리 설치 없이 5 서비스의 어법만 가져왔다.
 *
 * | 출처            | 가져온 패턴                                                    | 자리              |
 * | --------------- | -------------------------------------------------------------- | ----------------- |
 * | faker.js        | seed · locale 풀 · 이름공간 생성기 · `helpers.fake` 템플릿      | random · generators |
 * | mockaroo        | 컬럼 = Type + 옵션 · Blank % · Custom List 선택 방식 · Formula | rules             |
 * | randomuser.me   | 성별 일관 프로필 · 정적 초상 URL · seed · 중첩 location        | generators.image · presets |
 * | dummyjson       | products/carts/posts/comments/todos/recipes 스키마 · FK · 파생 | presets           |
 * | picsum.photos   | `/seed/{s}/{w}/{h}` · `?grayscale` · `?blur` · `/v2/list` 모양  | generators.image  |
 *
 * 외부 요청 0 — 이미지도 URL 문자열만 만든다.
 */

export { createRandom, hashSeed, mulberry32 } from "./random";
export type { MockRandom, WeightedOption } from "./random";
export { FALLBACK_LOCALE, resolveMockLocale } from "./locale";
export type { MockLocale, NameOrder, PoolTranslate } from "./locale";
export { createMock, slugify } from "./generators";
export type {
  CardType,
  CreateMockOptions,
  DateRangeOptions,
  Gender,
  Mock,
  PicsumOptions,
  RangeOptions,
} from "./generators";
export { generateRow, generateRows, generateValue } from "./rules";
export type {
  GeneratedRows,
  GenerateRowsOptions,
  ListSelection,
  MockColumn,
  MockRowContext,
  MockRule,
} from "./rules";

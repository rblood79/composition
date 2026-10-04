/** 구 DB 레코드 보존 검사의 opaque fixture. 실행 문서 모델로 사용할 수 없다. */
export interface LegacyNodeFixture {
  id: string;
  type: string;
  children?: LegacyNodeFixture[];
  props?: Record<string, unknown>;
  [key: string]: any;
}
export interface LegacyDocumentFixture {
  version: string;
  children: LegacyNodeFixture[];
  [key: string]: any;
}

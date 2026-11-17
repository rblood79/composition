/**
 * ADR-313 G0 — 손으로 쓴 Oracle · Java (Spring Boot) 응답 · OpenAPI 표본과 열마다의 정답표.
 *
 * 사용자 결정 1 (2026-11-17 「손으로 쓴 표본」): 고객 환경의 실제 응답이 아니라 Spring Boot 기본 설정
 * (Jackson `WRITE_DATES_AS_TIMESTAMPS` 꺼짐 → `LocalDateTime` 은 offset 없는 ISO 글자) 과 흔한 Oracle 열
 * 관례 (`*_YN` · `*_AMT` 숫자 글자 · `*_DT` 8 자리 · `*_DTM` 14 자리 · epoch 밀리초 · `Long` PK) 를 가정해
 * 손으로 썼다. **형식이 맞는가의 근거로만 쓴다** — 열 종류의 빈도 · 분포의 근거가 아니다
 * (measurement-validity Q1).
 *
 * 정답표 (`SPRING_ANSWERS`) 는 변환기 출력으로 만들지 않았다 (Q5) — epoch 값은 Python `datetime` 으로
 * 따로 계산했다 (`1793928600000` = `2026-11-06T01:30:00Z`).
 */

/**
 * 응답 원문 — 큰 정수 (`USER_ID` 의 2^53 + 1) 가 `JSON.parse` 에서 바뀌므로 글자로 둔다. Spring Data 의
 * `Page<UserDto>` 모양 (`content` · `totalElements`).
 */
export const SPRING_PAGE_RESPONSE_TEXT = `{
  "content": [
    {"USER_ID": 9007199254740993, "USER_NM": "홍길동", "USE_YN": "Y", "ACTIVE_FLAG": 1, "SALARY_AMT": "4500000.00", "JOIN_DT": "20261106", "REG_DTM": "20261106103000", "UPD_TS": 1793928600000, "createdAt": "2026-11-06T10:30:00", "birthDate": [1990, 5, 1], "lastLoginAt": [2026, 11, 6, 10, 30], "ZIP_CD": "01234", "email": "hong@example.com", "DEPT_ID": 10},
    {"USER_ID": 9007199254740995, "USER_NM": "김영희", "USE_YN": "N", "ACTIVE_FLAG": 0, "SALARY_AMT": "3800000.50", "JOIN_DT": "20260102", "REG_DTM": "20260102000000", "UPD_TS": 1794042930000, "createdAt": "2026-11-07T09:15:30", "birthDate": [1988, 12, 24], "lastLoginAt": [2026, 11, 7, 9, 15, 30], "ZIP_CD": "06236", "email": "kim@example.com", "DEPT_ID": 20},
    {"USER_ID": 1001, "USER_NM": "Lee \\"Sam\\" 9007199254740993", "USE_YN": "Y", "ACTIVE_FLAG": 1, "SALARY_AMT": "0", "JOIN_DT": "20260102", "REG_DTM": "20260102000000", "UPD_TS": 1767312000000, "createdAt": "2026-01-02T00:00:00", "birthDate": [2000, 1, 1], "lastLoginAt": [2026, 1, 2, 0, 0], "ZIP_CD": "10001", "email": "lee@example.com", "DEPT_ID": null}
  ],
  "totalElements": 3,
  "totalPages": 1,
  "number": 0,
  "size": 20
}`;

/** 같은 행을 회사 공통 포장 (`{code, message, data}`) 에 실은 응답 — 행 배열 경로 = `data.list`. */
export const SPRING_WRAPPED_RESPONSE_TEXT = `{"code": "0000", "message": "OK", "data": {"list": [
  {"USER_ID": 9007199254740993, "USE_YN": "Y", "SALARY_AMT": "4500000.00"}
], "totalCount": 1}}`;

/** 같은 표를 CSV 로 내려받은 글자 원본 (Oracle SQL Developer 의 내보내기 모양 — 열 이름 대문자). */
export const SPRING_CSV_TEXT = [
  "USER_ID,USER_NM,USE_YN,SALARY_AMT,JOIN_DT,ZIP_CD",
  "9007199254740993,홍길동,Y,4500000.00,20261106,01234",
  "9007199254740995,김영희,N,3800000.50,20260102,06236",
  "1001,이삼,Y,0,20260102,10001",
].join("\n");

/** 정답표의 값 표현 — breakdown §2.1 의 `encoding` 모양 (Phase 1 의 형과 맞춘다). */
export type ExpectedEncoding =
  | { kind: "flag"; true: string | number | boolean; false: string | number | boolean }
  | { kind: "numberText" }
  | { kind: "epochMs"; wire: "number" | "string" }
  | { kind: "epochSec"; wire: "number" | "string" }
  | { kind: "compactDate"; wire: "number" | "string" }
  | { kind: "compactDateTime"; wire: "number" | "string" }
  | { kind: "dateParts"; precision: "date" | "dateTime" }
  | { kind: "bigInt" };

export interface ExpectedColumn {
  key: string;
  /** 표준의 필드 타입. */
  type: "string" | "number" | "boolean" | "date";
  format?: "email" | "url" | "image";
  /** 표준의 값 표현 (없음 = JSON 값 그대로). */
  encoding?: ExpectedEncoding;
  /** 감지가 이 값 표현을 **기본 선택** 으로 하는가 (`bigInt` 만 — breakdown §2.5), 아니면 후보인가. */
  encodingIs?: "default" | "candidate";
  /** key 필드 후보인가 (breakdown §2.5). */
  keyCandidate?: boolean;
  /** 표준의 저장 값 — `content` 행 순서. */
  stored: readonly unknown[];
  /** 되돌린 값 (서버가 같은 값으로 읽는 JSON 표현, HC7) — 원문과 다른 것만 적는다. */
  outgoing?: readonly unknown[];
}

/** `SPRING_PAGE_RESPONSE_TEXT` 의 열마다 정답 (사람이 쓴 것). */
export const SPRING_ANSWERS: readonly ExpectedColumn[] = [
  {
    key: "USER_ID",
    type: "string",
    encoding: { kind: "bigInt" },
    encodingIs: "default",
    keyCandidate: true,
    stored: ["9007199254740993", "9007199254740995", "1001"],
  },
  {
    key: "USER_NM",
    type: "string",
    stored: ["홍길동", "김영희", 'Lee "Sam" 9007199254740993'],
  },
  {
    key: "USE_YN",
    type: "boolean",
    encoding: { kind: "flag", true: "Y", false: "N" },
    encodingIs: "candidate",
    stored: [true, false, true],
  },
  {
    key: "ACTIVE_FLAG",
    type: "boolean",
    encoding: { kind: "flag", true: 1, false: 0 },
    encodingIs: "candidate",
    stored: [true, false, true],
  },
  {
    key: "SALARY_AMT",
    type: "number",
    encoding: { kind: "numberText" },
    encodingIs: "candidate",
    stored: [4500000, 3800000.5, 0],
    outgoing: ["4500000", "3800000.5", "0"],
  },
  {
    key: "JOIN_DT",
    type: "date",
    encoding: { kind: "compactDate", wire: "string" },
    encodingIs: "candidate",
    stored: ["2026-11-06", "2026-01-02", "2026-01-02"],
  },
  {
    key: "REG_DTM",
    type: "date",
    encoding: { kind: "compactDateTime", wire: "string" },
    encodingIs: "candidate",
    stored: [
      "2026-11-06T10:30:00",
      "2026-01-02T00:00:00",
      "2026-01-02T00:00:00",
    ],
  },
  {
    key: "UPD_TS",
    type: "date",
    encoding: { kind: "epochMs", wire: "number" },
    encodingIs: "candidate",
    stored: [
      "2026-11-06T01:30:00Z",
      "2026-11-07T09:15:30Z",
      "2026-01-02T00:00:00Z",
    ],
  },
  {
    key: "createdAt",
    type: "date",
    stored: [
      "2026-11-06T10:30:00",
      "2026-11-07T09:15:30",
      "2026-01-02T00:00:00",
    ],
  },
  {
    key: "birthDate",
    type: "date",
    encoding: { kind: "dateParts", precision: "date" },
    encodingIs: "candidate",
    stored: ["1990-05-01", "1988-12-24", "2000-01-01"],
  },
  {
    key: "lastLoginAt",
    type: "date",
    encoding: { kind: "dateParts", precision: "dateTime" },
    encodingIs: "candidate",
    stored: [
      "2026-11-06T10:30:00",
      "2026-11-07T09:15:30",
      "2026-01-02T00:00:00",
    ],
    // (Jackson 은 0 초를 빼고 5 칸으로 쓴다 — 0 이 아닌 초만 6 칸, breakdown §2.1.)
    outgoing: [
      [2026, 11, 6, 10, 30],
      [2026, 11, 7, 9, 15, 30],
      [2026, 1, 2, 0, 0],
    ],
  },
  // (0 으로 시작하는 숫자 글자 — 숫자 후보에서 뺀다, R6.)
  { key: "ZIP_CD", type: "string", stored: ["01234", "06236", "10001"] },
  {
    key: "email",
    type: "string",
    format: "email",
    stored: ["hong@example.com", "kim@example.com", "lee@example.com"],
  },
  { key: "DEPT_ID", type: "number", stored: [10, 20, null] },
];

/**
 * springdoc 1.x 가 내는 OpenAPI 3.0 — `nullable` · `allOf` 상속 · `$ref` · `int64` · Y/N `enum` · 받지 않는
 * 구성 (`oneOf`) · 저장하지 않는 제약 (`pattern` · `maxLength` · `minimum`).
 */
export const SPRING_OPENAPI_30 = {
  openapi: "3.0.1",
  info: { title: "user-api", version: "v1" },
  paths: {
    "/api/users": {
      get: {
        operationId: "listUsers",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", format: "int32" },
          },
          {
            name: "size",
            in: "query",
            schema: { type: "integer", format: "int32" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "*/*": { schema: { $ref: "#/components/schemas/PageUserDto" } },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      BaseEntity: {
        type: "object",
        properties: {
          REG_DTM: { type: "string", description: "등록 일시" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      UserDto: {
        allOf: [
          { $ref: "#/components/schemas/BaseEntity" },
          {
            type: "object",
            required: ["USER_ID", "USER_NM"],
            properties: {
              USER_ID: {
                type: "integer",
                format: "int64",
                description: "사용자 ID",
              },
              USER_NM: {
                type: "string",
                maxLength: 50,
                description: "사용자명",
              },
              USE_YN: {
                type: "string",
                enum: ["Y", "N"],
                description: "사용 여부",
              },
              SALARY_AMT: { type: "string", pattern: "^\\d+(\\.\\d+)?$" },
              JOIN_DT: { type: "string", description: "입사일" },
              ZIP_CD: { type: "string", nullable: true },
              email: { type: "string", format: "email" },
              DEPT_ID: {
                type: "integer",
                format: "int64",
                nullable: true,
                minimum: 1,
              },
              contact: {
                oneOf: [
                  { $ref: "#/components/schemas/Phone" },
                  { $ref: "#/components/schemas/Address" },
                ],
              },
            },
          },
        ],
      },
      Phone: { type: "object", properties: { number: { type: "string" } } },
      Address: { type: "object", properties: { line1: { type: "string" } } },
      PageUserDto: {
        type: "object",
        properties: {
          content: {
            type: "array",
            items: { $ref: "#/components/schemas/UserDto" },
          },
          totalElements: { type: "integer", format: "int64" },
          totalPages: { type: "integer", format: "int32" },
          number: { type: "integer", format: "int32" },
          size: { type: "integer", format: "int32" },
        },
      },
    },
  },
} as const;

/** springdoc 2.x 가 내는 OpenAPI 3.1 — `type: [T, "null"]` 로 null 허용, 그 밖은 3.0 표본과 같은 뜻. */
export const SPRING_OPENAPI_31 = {
  openapi: "3.1.0",
  info: { title: "user-api", version: "v1" },
  paths: {
    "/api/users": {
      get: {
        operationId: "listUsers",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PageUserDto" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      UserDto: {
        type: "object",
        required: ["USER_ID", "USER_NM"],
        properties: {
          USER_ID: {
            type: "integer",
            format: "int64",
            description: "사용자 ID",
          },
          USER_NM: { type: "string", description: "사용자명" },
          USE_YN: { type: "string", enum: ["Y", "N"] },
          ZIP_CD: { type: ["string", "null"] },
          DEPT_ID: { type: ["integer", "null"], format: "int64" },
          createdAt: { type: "string", format: "date-time" },
          birthDate: { type: "string", format: "date" },
          homepage: { type: "string", format: "uri" },
          tags: { type: "array", items: { type: "string" } },
          meta: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      PageUserDto: {
        type: "object",
        properties: {
          content: {
            type: "array",
            items: { $ref: "#/components/schemas/UserDto" },
          },
          totalElements: { type: "integer", format: "int64" },
        },
      },
    },
  },
} as const;

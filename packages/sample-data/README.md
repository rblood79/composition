# @composition/sample-data

seed 결정성 샘플 데이터 생성기 — faker · mockaroo · randomuser.me · dummyjson · picsum 의 어법만 이식했고 외부 요청 0 · 의존 0 이다 (ADR-220).

- `exports` 가 `./src/index.ts` 를 직접 가리킨다 (빌드 0, `@composition/shared` 와 같은 형태).
- 경계: `tsconfig` `rootDir: "./src"` + `composite` — 저장소의 다른 패키지 (특히 `apps/builder`) 를 상대 경로로 import 하면 TS6059 로 실패한다. `src/boundary.static.test.ts` 가 같은 규칙을 정적으로 검사한다.
- 소비자: `apps/builder` (Data 패널 preset 카탈로그 · AI `create_table_from_description`).

```sh
pnpm -F @composition/sample-data type-check
pnpm -F @composition/sample-data test
```

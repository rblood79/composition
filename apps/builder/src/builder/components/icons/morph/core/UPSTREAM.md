# morphicons vendoring — upstream 기록 (ADR-197 Phase 0)

| 항목        | 값                                                                  |
| ----------- | ------------------------------------------------------------------- |
| upstream    | https://github.com/guillermolg00/morphicons                         |
| 버전        | v1.7.1                                                              |
| commit      | `38d2a7221633a453eeafebd872ee3649b9274b22` (2026-08-28)             |
| 라이선스    | MIT (`core/LICENSE` — upstream 원문 그대로)                         |
| 런타임 의존 | 0                                                                   |
| 복사 범위   | `src/core/*` 8 파일 → `core/` · `src/dom/index.ts` → `dom/index.ts` |

## 왜 파일별 헤더가 아니라 이 문서인가

R1 (vendoring drift) 의 대응이 **"디렉토리 통째 교체"** 다. 파일마다 헤더를 넣으면
교체할 때마다 9개를 다시 붙여야 하고, 한 번 빠뜨리면 그 파일만 upstream 과 갈라진다.
그래서 본문은 **upstream 바이트 그대로** 두고 (Prettier 재포맷은 hook 이 적용),
출처·라이선스·절차를 이 문서와 `core/LICENSE` 한 곳에만 둔다.

`dom/index.ts` 를 `dom.ts` 가 아니라 디렉토리로 둔 이유도 같다 — upstream 의
`../core/*` import 경로가 그대로 맞아떨어져 **경로 수정 0** 으로 교체된다.

## 갱신 절차 (부분 patch 금지)

```bash
# 1) upstream 클론 후 디렉토리 통째 교체
cp <upstream>/src/core/*.ts   apps/builder/src/builder/components/icons/morph/core/
cp <upstream>/src/dom/index.ts apps/builder/src/builder/components/icons/morph/dom/index.ts
cp <upstream>/LICENSE          apps/builder/src/builder/components/icons/morph/core/LICENSE

# 2) 이식 테스트 (본 디렉토리 __tests__) 통과 확인 — 바이트 hash 비교는 무의미
#    (Prettier PostToolUse hook 이 재포맷하고 upstream 은 biome 포맷)
pnpm --filter @composition/builder test -- morph

# 3) 이 문서의 버전·commit 갱신
```

로컬 수정이 필요하면 **upstream 에 PR 을 보내고 버전을 올린다**. 여기서 patch 하면
다음 교체가 그것을 지운다.

## 테스트 이식 (`__tests__/`)

upstream `test/{invariants,closed,dom}.test.ts` + `helpers.ts` 를 그대로 가져오되
두 가지만 치환한다 — `bun:test` → `vitest` (API 동일), `../src/index` 배럴 →
`../core/<module>` 개별 import (vendoring 범위에 패키지 엔트리가 없다).
`dom.test.ts` 는 jsdom 없이 동작한다 (element = `setAttribute` 를 가진 객체,
rAF 는 손으로 pump 하는 fake) — driver 가 전역을 import 시점이 아니라 실행 시점에
읽는다는 것이 이 테스트의 증명 대상이다.

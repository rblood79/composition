# ADR-307 후속 — 문서 읽기 비용 분해

2026-11-11 · 기준 HEAD `162865ffa` (A+B 포함). 검증 내부 계약 계산 재사용 전후 비교.

## 방법과 범위

production harness · headless Chrome · 같은 IndexedDB fixture · 22/66 page · CPU 1x/4x.
각 조건에서 전/후 교대 3쌍, 중앙값. `ready`는 백그라운드 채움 완료를 기다리지 않는
기존 `waitReady(settleMs: 0)`다. 구간 표지 9개를 넣은 측정용 빌드이며 제품 코드에는 남기지 않았다.
구간별 중앙값의 합은 전체 중앙값과 같지 않을 수 있다.

66 page는 문서 entry 10,789개, JSON 배열 UTF-8 4,378,286 bytes, node가 참조하는
고유 definition 54개다. Canvas record 수와 저장 entry 수는 다르다. 합성 문서이며
실사용 문서 분포·메모리·다른 브라우저는 미측정이다. 교대 측정 초반 typecheck와 일부
인접 테스트가 겹쳤으므로 작은 시간 차이의 원인을 이 변경으로 단정하지 않는다.

로컬 재현 스크립트·원자료: `.agent/runs/2026-11-11-adr307-read-cost/`의
`open.mjs`, `matrix.py`, `object-experiment.mjs`, `artifacts/summary.json`,
`artifacts/object-experiment.json`. fixture는 ADR-307 Phase 0 run의 `scripts/st22.json`,
`st66.json`을 사용했다. 구간 표지는 이 run의 `graph.ts`/`storage.ts` 백업과 측정 빌드
(`/private/tmp/adr307-read-measured-before`, `…-after`)로 대조할 수 있다.

## 비용 분해

66 page · CPU 4x · 교대 3쌍 중앙값 (ms).

| 구간                                   |    전 |    후 |
| -------------------------------------- | ----: | ----: |
| DB 열기·읽기·head 확인 (parse 시작 전) |  53.6 |  51.2 |
| JSON.parse·entries 객체 조립           |  71.6 |  74.6 |
| 형식 검사                              |  76.4 |  73.2 |
| migration                              |  27.4 |  26.7 |
| entry freeze                           |  43.8 |  42.2 |
| 참조·소유권·순환 등 전체 view 검사     | 132.4 | 129.5 |
| view 검사 후 색인 구성·생성자 반환     |  45.5 |  45.5 |

`view`에는 owner map과 참조 검사 등을 모두 포함한다. `validateEntryReferences`만의
시간으로 해석하지 않는다. 처음 별도 3회에서 view 116.8 ms, parse 63.7 ms였으며
교대 측정과 차이가 있다. 남은 비용을 참조 검사와 parse 두 종류로만 설명할 수 없다.

## 검증 내부 계약 재사용

같은 view를 검증하는 동안 같은 definition 객체의 `instanceContract` 결과
(accepts·propChoices)를 재사용한다. 캐시는 `validateView` 호출의 지역 Map이고
다음 로드·transaction에는 전달되지 않는다. instance의 prop·변수 가시성·capability
대상·소유권·순환 검사는 계속 수행한다. transaction 검증은 기존 경로를 유지한다.

| page · CPU | ready 전 → 후 (ms) | view 전 → 후 (ms) |
| ---------- | -----------------: | ----------------: |
| 22 · 1x    |      539.5 → 542.1 |       12.0 → 11.7 |
| 66 · 1x    |      657.6 → 660.5 |       29.1 → 26.5 |
| 22 · 4x    |  2,022.4 → 2,021.6 |       50.0 → 47.6 |
| 66 · 4x    |  2,479.6 → 2,430.7 |     132.4 → 129.5 |

전체 열기의 유의한 개선은 입증하지 못했다 (66·4x 범위도 겹침: 전 2,411–2,643,
후 2,379–2,473 ms). 계산 횟수 감소는 회귀 검사로 확인했다. Text instance 3개의
최상위 계약 계산 3→1, 캐시 사용 행 원복 시 RED. 다음 로드에서 계약을 다시 계산하며,
뒤 instance의 잘못된 prop 값은 `PROP_TYPE_MISMATCH`로 거부한다.

## E — JSON 문자열과 객체 저장 비교

별도 브라우저 context의 임시 IndexedDB에서 같은 entry를 두 object store에 저장했다.
JSON은 `{ id, json }`, 객체는 `{ id, entry }`. CPU 4x · 순서 교대 6쌍 중앙값 (ms).
각 읽기 뒤 전체 JSON 동치를 확인했다. DB는 실험 뒤 삭제했다.

| 구간                                  | JSON 문자열 |  객체 |
| ------------------------------------- | ----------: | ----: |
| 쓰기 준비 (JSON 직렬화 포함)          |        29.6 |   0.6 |
| put → transaction 완료                |       220.5 | 359.0 |
| 쓰기 합계                             |       250.6 | 359.3 |
| getAll → transaction 완료             |        50.5 |  63.1 |
| 결과 순회·entry 취득 (JSON이면 parse) |        56.7 |  76.1 |
| 읽기 합계                             |       107.3 | 140.0 |

객체도 복원 비용이 있고, 이 표본에서는 E가 느렸다. 전체 문서 쓰기 실험이므로
일반 편집의 소수 entry autosave 시간으로 일반화하지 않는다. 실제 저장 형식과
`CatalogCommit.changed`의 JSON 계약은 변경하지 않는다. E는 현재 채택하지 않는다.

## 판정과 검증

- C 보류: 현재 로드 결과와 Library의 참조 계약 검사를 유지한다.
- D 보류: 현재 66 page·4x ready가 기존 3초 목표 안이다. 더 큰 문서의 목표가 정해지면
  공용 definition·변수 의존성과 부분 graph의 편집·저장 계약을 포함한 별도 ADR로 판단한다.
- 당장은 전체 page 읽기 기울기가 남아 있음을 수용한다. 추가 캐시는 이득이 확인된 범위에만 둔다.
- 인접 저장·컴포넌트 테스트 24건, 추가 origin·변수 등 16건 통과 (중복 포함).
  RED는 `artifacts/cache-red.txt`, TS 검사는 `artifacts/typecheck.txt`에 기록했다.
- 실제 Chrome·production·66 page: Text 수정 → 저장 → undo → 저장 → 새로고침 뒤
  원래 값 복원, entry 전부 frozen, 수집 오류 0 (`artifacts/object-experiment.json`, `live.png`).

# 편집 경로 레이아웃 서명 계산 축소 — 2026-09-06

## 범위와 방법

가이드 §3의 비용 귀속 → 확인된 계산만 최적화 → production 고정 fixture 재측정 순서를 적용했다. [React Profiler](https://react.dev/reference/react/Profiler)의 production profiling 경로는 진단에만 사용하고, 채택 비교는 일반 production 빌드 + Chrome DevTools trace/CDP threadTicks로 수행했다. 자체 테스트의 실행 시간을 성능 증거로 사용하지 않았다.

기준 HEAD는 `75c73dd1f`이다. 기존 scheduler after edit trace에서 React callback 합계 2.244초, Skia callback 45ms였으며, CPU sample `createElementLayoutSignature` 82ms가 확인됐다. 기존 BuilderCanvas self 219.1ms/33회는 bailout을 제외하지 않은 집계여서 철회한다.

변경은 `layoutCache.ts` 한 경로다. registry 순서대로 값을 확인하되 빈 값의 `key=` 문자열 생성을 생략한다. 값 길이를 기록해 값 내부 구분자와 다음 속성을 혼동하지 않는다. 동일 객체 내부 편집도 매번 읽으며 identity cache를 추가하지 않았다. 기존 null/undefined/빈 문자열 동등성, responsive resolve 이후 서명 생성, layout publish trigger는 유지한다. Spec/CSS/Preview 데이터와 layout engine 입력은 변경하지 않았다.

기존 self 219.1→168.6ms 및 render 33→33회 비교는 [진단 집계 정정](frame-performance-reference-profile-audit-20260906.md)에 따라 철회한다. commit 55→55회와 아래 일반 production A/B는 이 fiber 필터를 사용하지 않았으므로 구분해 보존한다.

## 일반 production 비교

600요소 fixture, 동일 저장 snapshot·50회 폭 편집·복원, GPU timer off, frame capture on, visible Chrome. 순서는 before/after, after/before, before/after로 사전 고정했다. 각 빌드 파일 SHA는 local manifest에 있다. 작업 중 다른 테스트나 빌드는 실행하지 않았다.

| 쌍     | CPU before→after (ms/s) | frame p99 before→after (ms) | long task before→after |
| ------ | ----------------------: | --------------------------: | ---------------------: |
| 1      |       216.123 → 234.550 |                 44.6 → 51.9 |                  1 → 2 |
| 2      |       241.669 → 236.112 |                 54.4 → 51.4 |                 16 → 4 |
| 3      |       241.085 → 234.604 |                 54.3 → 52.0 |                 13 → 3 |
| 중앙값 |       241.085 → 234.604 |                 54.3 → 51.9 |                 13 → 3 |

CPU 중앙값은 **2.69% 감소**, frame p95는 **10.4 → 10.4ms**, renderer RAF는 **51 → 51회**다. 첫 쌍에서는 악화됐으므로 통계적으로 확정된 보편적 성능 개선이나 큰 폭의 edit stall 해소로 해석하지 않는다. 같은 장비 내 상대 비교이고 다른 PC 성능은 미측정이다. 과거 scheduler 비교와 수치를 합산하지 않는다.

## 검증과 판단

- 인접 layout signature / publisher / invalidation registry: 3 files, 15 tests PASS. 동일 객체 폭 변경·삭제·0·빈 값·구분자 충돌과 기존 slot/density/responsive 계약을 포함한다.
- 일반 production live: 237px 폭 편집 → render command bounds 237 → 실제 main submission 증가 → Undo props/bounds 복원 PASS.
- `codex:preflight`, `git diff --check` PASS.
- 모든 비교 구간 page error 0, visibility visible, fixture hash 동일. 기존 시작 시 Pretendard 폰트 404는 양쪽에 남았으며 측정 중 오류는 없다.
- 빈 속성 문자열 할당을 줄이는 작은 변경으로 채택한다. React render 횟수, 전체 구독 fan-out, GPU tail, 모든 기기의 p99 해결을 주장하지 않는다. 롤백은 이 서명 생성 변경만 원복하면 되며 저장 데이터 마이그레이션은 없다.

원본과 재실행 파일은 로컬 `docs/migrations/evidence/frame-performance/reference-edit-20260906/`의 `manifest.json`, `run-comparison.py`, `summary.json`, 각 `pair-*/edit-trace.json`, `react-profile*.json`, `cpu-profile*.json`, `live.json`, `tests.log`, `preflight.log`이다. 인증 storage snapshot은 `/private/tmp`에만 두었다. 해당 evidence 디렉터리는 기존 gitignore 정책을 따른다.

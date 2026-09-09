# 프레임 성능 P0 — 첫 계측 단위

이 문서는 첫 P0 단위의 당시 기록이다. 후속 구현·판정은 [P1 반복 측정](p1-measurements.md), [종결 검증](closure.md)을 따른다. 아래 미착수·미수집 표기는 최초 단위의 상태를 보존한 것이다.

2026-09-06. [실행 설계](../../adr/react-skia-zustand-frame-performance-design.md)의 P0 **진행 중**이며 P0 종료/G0 통과 또는 P1 착수를 의미하지 않는다.

## 반영 범위

- `perfMarks`에 reset 이후 전체 `totalDurationMs`를 추가했다. `count`와 percentile은 최근 1,000개, `totalCount`와 누적 시간은 전체 표본이다.
- `setRecordingEnabled`로 perfMarks 비용 A/B를 지원한다. off에서도 입력·렌더 함수의 실행, 반환, 예외 전달은 유지한다. 기본값은 기존처럼 on이다.
- 하니스 `--instrumentation on|off`는 **perfMarks만** 전환한다. cache/GPU/RAF recorder/longtask observer 비용은 남는다. 전체 계측 off 또는 production opt-in 계측 구현으로 간주하지 않는다.
- JSON에 recorder의 RAF/지연 원시 배열, 전체 label snapshot, CDP task 시간, HEAD/dirty 파일, viewport/DPR/visible/build, fixture checksum을 남긴다. profiler stop 대기 전에 label snapshot을 고정한다.
- `measuredDurations.*.inclusiveMsPerSecond`는 관측 구간의 inclusive 실행 시간이다. 중첩 label을 더하거나 OS thread CPU 사용률로 해석하지 않는다. `mainThread.taskMsPerSecond`는 하니스·driver를 포함한 CDP TaskDuration이며 측정 경계도 별도 CDP Timestamp이다.

## 실행 조건과 결과

| 측정 유효성 질문 | 이번 범위의 답과 판정 한계                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Q1 출처          | 하니스가 생성한 합성 fixture. 규모·실행 비용만 관찰하며 실제 문서 분포를 대표하지 않음                             |
| Q2 불리한 경우   | pan/zoom 1회 smoke만 있음. 편집·가시 집합 변경의 정식 A/B가 없어 최적화 게이트 통과 불가                           |
| Q3 대조군        | perfMarks on/off 대조만 있음. cache/scheduler 변경 전후의 총비용 대조가 아님                                       |
| Q4 가동 경로     | SkiaCanvas observe → perfMarks snapshot → recorder → JSON에서 전체 호출 수 확인. GPU production 수집은 미배선      |
| Q5 독립 oracle   | CDP task 시간·browser RAF timestamp와 내부 label을 분리 기록. 실제 presentation·픽셀·input latency oracle은 미확보 |

HEAD `4ae4ff43b` + 이번 계측 변경. Chrome `152.0.7977.82`, development, headed, visible, viewport 1440×900, DPR 1, canvas device size 1440×900, Navigator/Properties 열림. seed 600 + body = 현재 페이지 element projection 601개. 실제 resolved/render node 수는 미수집이다. RAF 표본은 약 120Hz이며 물리 display Hz·GPU 장치·CPU throttle metadata는 아직 수집하지 않았다.

동일 격리 프로젝트와 IndexedDB snapshot에서 각 run을 새 browser context로 시작했다. 각 10초 idle을 on→off 순서로 5쌍 직렬 실행했다. 10개 run의 fixture SHA-256은 모두 `176cc167dd8d` 접두사로 일치하며 전체 값은 [요약 JSON](../evidence/frame-performance/idle-summary.json)에 있다. pair 1~5 사이 다른 테스트·빌드는 실행하지 않았다. 각 run의 page/console error 및 longtask는 모두 0이다.

| pair | on task ms/s | off task ms/s | on Builder RAF 전체 호출 | on content build ms/s |
| ---- | -----------: | ------------: | -----------------------: | --------------------: |
| 1    |        38.49 |         34.38 |                     1201 |                 11.13 |
| 2    |        36.10 |         36.45 |                     1201 |                 10.76 |
| 3    |        36.36 |         38.04 |                     1200 |                 10.66 |
| 4    |        37.79 |         38.19 |                     1200 |                 11.49 |
| 5    |        39.43 |         39.09 |                     1200 |                 11.14 |

on/off task 중앙값은 37.79/38.04ms/s, paired on-minus-off 중앙값은 -0.35ms/s다. 부호가 일관되지 않으며 계측 절감 효과를 주장하지 않는다. on에서 render.frame inclusive 시간은 13.40–14.34ms/s이고, content build가 10.66–11.49ms/s로 가장 크다. 최근 버퍼의 render.frame p95/p99는 매 run 0.2/0.3ms다. content/plan build는 각각 1,200~1,201회 실행됐다. 이는 CPU 파생물 재사용의 후속 조사 근거이며 실제 cache miss 횟수와 구분한다.

`initial-on/`의 idle/pan/zoom은 하니스 smoke 원시 결과다. 최초 부팅 때 type-check가 겹쳤고 interaction 반복도 1회이므로 정식 기준선/A-B 판정에서 제외한다. pan/zoom을 정상 실행했고 page/console error 0임을 확인한 근거로만 사용한다.

## 재현

```bash
pnpm perf:baseline -- --lane frame --headed --seed-count 600 --duration-ms 10000 --classes idle --instrumentation on --save-storage-state /private/tmp/frame-p0-storage.json
# 출력된 격리 project URL과 저장 상태를 같은 값으로 사용하고 on/off 교대로 5쌍 실행
pnpm perf:baseline -- --lane frame --headed --seed-count 600 --duration-ms 10000 --classes idle --instrumentation off --project-url '<위 run의 URL>' --storage-state /private/tmp/frame-p0-storage.json
```

인증/IndexedDB snapshot은 로컬 tmp에만 보관한다. evidence JSON에는 인증 값을 넣지 않는다. fixture hash는 측정 시작 시 현재 페이지 projection의 id/type/parent/props를 직렬화한 값이며 canonical 전체 문서나 resolved scene checksum으로 부르지 않는다.

## P0 잔여와 다음 단위

1. 기본 production에서 꺼진 명시적 GPU 계측 경로와 raw sample·invalid/unsupported/누락·마지막 query drain을 준비한다. 현재 GPU 축은 **미수집**이며 0ms가 아니다.
2. main submission과 Builder render RAF를 독립 계수로 수집한다. 현재 render.frame 호출은 RAF wrapper 실행 수이며 실제 제출 수가 아니다. flush label 부재를 전체 submission 0의 증거로 쓰지 않는다.
3. 실제 resolved/render node 수, GPU/display/throttle metadata, React commit·domain mutation·input→presentation·자원 생존 수를 확보한다.
4. 60/5,000/ref-heavy/text-heavy fixture, 나머지 상호작용 5회, cold entry 새 context 10회 및 production 기준선을 수집한다. cold font prewarm은 Track A 범위로 유지한다.
5. [wake 생산자 조사](wake-sources.md)의 미확정 자원·writer 경계를 닫고 G1 baseline을 확정한다. 그 전까지 P1/P2는 시작하지 않는다. 전체 main-thread task 30ms/s 초과를 ADR-167의 저사양 **P1 이후 renderer idle CPU** 재개 조건으로 대체하지 않는다.

## 검증

인접 perfMarks Vitest 4/4, 하니스 node 테스트 12/12, type-check baseline 0, `codex:preflight` PASS (registration 14/14 포함), `git diff --check` PASS. 최초 root Vitest 호출은 config의 상대 root 때문에 테스트를 찾지 못했고, repo root에서 `pnpm -F @composition/builder exec vitest run ...`으로 경로를 교정해 통과했다.

`review` 체크리스트를 메인 세션에서 적용했고 scope 내 잔여 HIGH/CRITICAL 발견은 없다. 렌더링 정책·readiness·catalog/spec/factory/CSS/Preview 소비 코드에는 변경이 없어 cross-check의 컴포넌트 대조 대상은 없다. 시각 parity 통과를 주장하지 않으며 실제 하니스 부팅·idle·pan·zoom은 위 smoke/반복 결과로 확인했다.

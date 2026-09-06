# Builder 외부 레퍼런스 우선순위 1–5 실행

2026-09-07. 기준 HEAD `be8276506` (직전 `becb855ba` 대비 외부 감사 문서만 추가되어 제품 소스는 동일). 사용자 승인 범위는 [외부 감사](builder-performance-external-audit-20260907.md)의 우선순위 1–5 전체이다.

## 적용한 방법

| 우선순위 | 구현                                                                                                                                                                                         | 외부 방법과의 관계                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | IndexedDB v21: 문서 header와 각 canonical node를 독립 레코드로 저장. 변경된 레코드만 put, 삭제된 node만 delete. 같은 adapter 호출 순서 보존, 다른 탭과는 readwrite transaction으로 직렬화.   | [Google IndexedDB app-state 권고](https://web.dev/articles/indexeddb-best-practices-app-state): 전체 객체 clone 대신 변경된 레코드 저장.                                                                 |
| 2        | 동일 renderer input/packet/layout/page-position와 깨끗한 renderer 상태에서는 content 결과를 재사용하고 camera만 갱신. frame plan과 실제 render/flush는 계속 실행.                            | [Figma rendering 기술 노트](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/): CPU 제출 준비 비용과 재사용의 중요성. Figma 내부 구현과 같다는 주장은 하지 않는다.                           |
| 3        | 이미지 캐시의 기존 100개 상한에 디코딩 RGBA 추정 128 MiB 예산 추가. 미참조 LRU만 삽입·release 시 정리.                                                                                       | [WebGL 메모리 예산 권고](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#estimate_a_per-pixel_vram_budget): 픽셀 수 기반 추정과 bounded cache.                           |
| 4        | 큰 문서 저장 준비에서 약 8ms 경과 시 기존 `yieldToMain`을 실제 호출. transaction은 모든 준비가 끝난 뒤 연다.                                                                                 | [Google long task 분할](https://web.dev/articles/optimize-long-tasks): scheduler.yield 우선, setTimeout fallback.                                                                                        |
| 5        | Google web-vitals의 INP/LCP/CLS/TTFB 수집. feature-detected LoAF 최근 100개/전체 개수, INP 변경 최근 50개, viewport/DPR/논리 CPU 정보의 로컬 JSON 내보내기. Monitor의 FID 표시를 INP로 교체. | [web-vitals 공식 구현](https://github.com/GoogleChrome/web-vitals), [Chrome LoAF](https://developer.chrome.com/docs/web-platform/long-animation-frames). 자체 percentile 알고리즘을 INP로 부르지 않는다. |

## 저장 호환성과 실패 계약

- 기존 `documents` row는 읽을 수 있다. 첫 정상 저장에서 이전 문서 백업과 v21 레코드 생성 및 기존 row 제거를 한 transaction으로 처리한다.
- node 급감 가드, allowShrink/expectedShrinkNodeCount, 프로젝트별 5세대 백업과 시간 간격을 유지한다. node 수는 새 head에 저장한다.
- 저장 promise는 request success가 아닌 **transaction complete** 후 성공한다. 실패 시 head/parts/백업이 함께 rollback된다. 백업 실패도 이전 문서를 보존하도록 저장 전체를 실패시키는 정책이다.
- adapter가 보관하는 한 프로젝트 snapshot은 DB revision이 같을 때만 재사용한다. 다른 탭의 새로운 revision이면 DB에서 parts를 다시 읽는다.
- IndexedDB v21을 v20 바이너리로 직접 열 수는 없다. 앱 rollback에는 v21 호환 adapter가 필요하다. 기존 전체 문서 row로의 자동 downgrade는 구현하지 않는다.

## 변경 전후 확인

고정된 기존 production artifact와 수정 artifact를 사용한다. 외부 방법을 적용한 결과를 현재 구현과 비교하며, 테스트 통과나 이 PC의 절대 시간을 모든 사용자 환경의 개선 근거로 사용하지 않는다.

실제 populated Builder의 별도 진단:

| 항목                                      |       변경 전 |                       변경 후 |
| ----------------------------------------- | ------------: | ----------------------------: |
| 단일 props 편집의 document 저장 JSON 길이 | 463,643자 × 2 | node 1,075자 + head 193자 × 2 |
| pan 120회 contentBuild                    |           122 |                             3 |
| pan mainSubmission                        |           122 |                           122 |
| zoom 120회 contentBuild                   |           111 |                            32 |
| zoom mainSubmission                       |           111 |                           111 |
| 편집 후 새로고침                          |    188px 복원 |                    188px 복원 |

JSON 길이는 payload 규모 대리지표이며 실제 structured clone byte나 CPU 시간은 아니다. 계측 자체의 직렬화 비용이 있으므로 이 진단은 별도 CPU A/B에 포함하지 않았다.

Production CPU/frame A/B: 600노드, 각 pan/zoom/edit 10초, fixed input, Chrome threadTicks, GPU timer off, 3쌍 순서 before→after / after→before / before→after. 모든 실행에서 fixture SHA가 같고 foreground 상태였으며 측정 구간 page/console 오류는 0이었다. 양쪽 시작 시 알려진 font 404 8건은 남는다.

## 범위와 한계

- 저장 준비의 전체 노드 방문, 큰 root collection 직렬화, 초기 저장, cold read, 백업 세대 생성 비용은 남는다. yield는 CPU 총량을 제거하지 않으며 한 개의 거대한 필드 직렬화를 선점하지 못한다.
- 128 MiB는 원본 이미지 픽셀의 RGBA 추정 예산이다. 실제 GPU 전체 메모리, mipmap/중복 texture/SkPicture/지연 폐기까지 합한 강제 상한이 아니다. live 참조만으로 넘으면 보존하고 마지막 참조 해제 때 정리한다. 화질과 자연 치수는 바꾸지 않는다.
- camera 재사용은 visible root/LOD를 포함한 renderer input이나 무효화 packet이 달라지면 적용하지 않는다. AI/drag/animation/cleanup/context 복원/새 readiness target은 기존 준비·제출 경로를 따른다.
- INP는 click/tap/key 상호작용 지표이며 wheel/scroll/hover의 대표 지표가 아니다. LoAF는 50ms 초과 프레임 진단이며 모든 16.7ms budget 초과를 검출하지 않는다.
- 이 구현은 페이지별 로컬 진단/내보내기이다. 서버 수집이나 여러 기기 사용자의 field p75 집계를 구현·측정했다는 뜻은 아니다.
- Spec/Catalog/Factory/CSS/Preview 스타일과 canonical 의미는 바꾸지 않았다. cross-check는 저장 roundtrip, 같은 카메라 상태의 Skia 출력, 실제 제출/입력 동작을 중심으로 확인한다.

## Production 비교 결과

| 시나리오 | CPU ms/s 중앙값 전→후 | 변화    | RAF gap p95 전→후 | p99 전→후      |
| -------- | --------------------- | ------- | ----------------- | -------------- |
| pan      | 132.820 → 131.792     | -0.77%  | 9.1 → 9.1 ms      | 9.4 → 9.4 ms   |
| zoom     | 240.248 → 240.603     | +0.15%  | 9.4 → 9.4 ms      | 16.5 → 16.5 ms |
| edit     | 219.013 → 189.546     | -13.45% | 9.4 → 9.4 ms      | 47.5 → 46.9 ms |

- edit CPU는 3쌍 모두 감소했다. pan은 3번 쌍 CPU가 증가했고 zoom은 2·3번 쌍이 증가했다. 따라서 camera 준비 호출 감소는 확인했지만 zoom CPU 개선은 확인하지 못했다.
- edit p99는 1·3번 쌍에서 악화했다(45.4→46.9, 47.5→48.6ms). 중앙값 감소만으로 tail 회귀가 없다고 단정하지 않는다.
- 표의 시간은 해당 PC의 상대 비교이며, 서로 다른 기기의 사용자 모집단 효과가 아니다. 개선율을 이전 단계 개선율과 합산하지 않는다.
- 원본/스크립트/manifest/summary: `docs/migrations/evidence/frame-performance/reference-priorities-20260907/`. JSON·trace·PNG는 기존 evidence ignore 정책에 따라 로컬 산출물이며, 이 문서는 추적되는 검증 기록이다.

## 완료 검증

- focused Vitest: **7 files / 51 tests PASS**. 변경 노드 저장, 600노드 roundtrip, 삭제/급감 방지, 호출 순서·프로젝트·다른 adapter revision, 구 row 전환·백업, quota 실패 rollback, transaction 전 yielding, 이미지 live 참조/byte 예산, camera 재사용 차단 조건, observer 단일 등록·구독 해제·bounded LoAF 포함.
- `codex:preflight` PASS: TypeScript baseline 0, agent catalog FAIL 0/WARN 0, engine matrix 3행, text axis 22개. `git diff --check` PASS.
- 실제 Chrome populated Builder: props 편집 후 새로고침 복원, Undo/Redo 3 cycles, WebGL context loss→restore 뒤 실제 mainSubmission 증가, page error 0.
- 같은 카메라의 Canvas screenshot **1440×900, 다른 픽셀 0개**. Catalog/Spec/Factory/CSS/Preview의 시각 값 변경 없음. CPU 준비 재사용과 캐시 수명 변경에 한정한 cross-check 완료.
- 실제 `Control+Alt+M`으로 Monitor 열기, Realtime에서 native click 후 INP/LoAF 로컬 JSON export PASS. 긴 click은 수집 기능 검증용으로만 주입했으며 A/B 성능 수치에 포함하지 않았다. 전체 기기 field 성능 데이터로 해석하지 않는다.
- 최종 판정: 승인한 우선순위 1–5 구현·검증 완료. commit/push 없음. GPU 전체 메모리 계측, 서버 field 집계, Worker/WebGPU 전환은 이번 완료 범위에 포함하지 않는다.

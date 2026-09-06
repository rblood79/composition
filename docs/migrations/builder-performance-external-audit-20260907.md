# Builder 외부 성능 자료 대조 — 2026-09-07

기준: `becb855ba`, 조사 시작 clean. 요청 범위는 외부 자료와 현재 코드의 대조이며 제품 수정·새 성능 측정·기기 일반화는 수행하지 않았다. 아래 우선순위는 구현 차이와 이전 증거를 바탕으로 한 다음 검증 순서이지, 예상 개선율이나 확정된 병목 순위가 아니다.

## 1. 저장 경로의 전체 문서 읽기·복제·쓰기 — 우선 검증

**확인된 코드:** `apps/builder/src/builder/stores/utils/elementUpdate.ts:706`은 props 변경 후 전체 활성 문서를 저장한다. `apps/builder/src/lib/db/indexedDB/adapter.ts:566`의 documents.put은 기존 전체 record를 읽고 양쪽 노드 수를 세며, backup 정책 확인 후 전체 document를 put한다. 비동기 함수라는 이유로 main-thread 비용이 사라지는 구조는 아니다.

**외부 기준:** [Google의 IndexedDB 상태 저장 권고](https://web.dev/articles/indexeddb-best-practices-app-state)는 큰 상태 트리를 변경마다 저장하면 structured clone으로 main thread를 막을 수 있으므로 변경 record/subtree만 저장하는 방식을 설명한다. 자료는 2017년 작성됐으며, 현재 코드에서 해당 사용 패턴이 존재하는지 별도로 확인했다.

**빠진 후보:** 변경 journal/dirty subtree 저장, project별 순서를 보존하는 저장 병합, 노드 수 계산 재사용. 단순 debounce만으로 전체 복제 비용이 없어지지는 않는다. 현재의 소실 방지 guard·backup·Undo·프로젝트 전환·refresh 복원·실패 전달을 유지하는 설계가 먼저다. 저장 단위 변경은 별도 아키텍처 검토가 필요하다.

**판정 방법:** 동일 문서/편집에서 DB read/put 수, 기록 bytes, structured-clone 구간과 main-thread task, crash/refresh 최종 revision을 전후 비교한다. 데이터 크기별로 효과가 달라질 수 있다.

## 2. Camera-only CPU 준비 재사용 — 우선 검증

**확인된 코드:** `SkiaCanvas.tsx:944`의 준비 생략은 `SkiaRenderer.ts:252`를 호출하며, 이 조건은 pan/zoom까지 이전 camera와 같아야 한다. 따라서 camera-only 프레임에도 content/plan 준비 함수로 진입한다. 다만 `skiaFramePipeline.ts:252`에 command stream cache가 이미 있으므로 이것을 매번 전체 scene을 새로 만드는 코드라고 부르면 잘못이다.

**외부 기준:** [Figma의 WebGPU 기술 노트](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)는 GPU submission에도 CPU 비용이 있으며 명령/데이터 재사용과 batch upload를 별도로 다룬다. 이를 현재 CanvasKit 경로에 대입한 **추론**은 document-dependent 준비와 camera-dependent transform/culling을 더 분리할 여지가 있다는 것이다. Figma 구현을 그대로 이식하라는 뜻은 아니다.

**빠진 후보:** camera가 변해도 유지할 수 있는 준비 결과의 범위 정의. 화면 안팎 root 전환, zoom LOD, overlay, effect, snapshot 확대 품질은 무효화 조건에 남겨야 한다.

**판정 방법:** 동일 pan/zoom의 content/plan 전체 CPU, cache hit/miss 이유, main submission, viewport 경계 pixel/hit-test를 비교한다. 기존 GPU content cache와 별개인 CPU 준비 비용만 귀속한다.

## 3. 이미지 캐시의 byte 예산 — 구현 차이 확인

**확인된 코드:** `skia/imageCache.ts:97`은 MAX_CACHE_SIZE=100으로 개수를 제한하고, `:230`은 한도를 넘으면 미참조 LRU를 퇴거한다. 참조 중 이미지는 보존한다. 이 파일에는 이미지 byte 추정에 따른 한도가 없다. 작은 이미지 100개와 큰 이미지 100개를 같은 비용으로 취급한다.

**외부 기준:** [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#estimate_a_per-pixel_vram_budget)는 화면 크기와 resource bytes에 기반한 VRAM 예산을 제안한다.

**빠진 후보:** decode 크기·format 기반 추정 bytes, 큰 이미지의 표시 크기별 decode/업로드 후보, 참조 중 resource를 지우지 않는 eviction 정책. `width×height×4`는 RGBA8 한 장의 추정치일 뿐 실제 GPU/CPU 복제·mipmap 총량은 아니다.

**판정 방법:** 소형/대형 이미지 및 DPR별 자원 증가·회수, context loss, 탭 메모리, pan/zoom 품질을 비교한다. 현재 메모리 누수나 OOM이 입증됐다는 의미는 아니다.

## 4. 장시간 작업 분할의 실제 적용 — 조건부 후보

**확인된 코드:** `builder/utils/scheduleTask.ts:130`에 yieldToMain 구현이 있지만 Builder 검색에서 production 호출자가 확인되지 않았다. `elementUpdate.ts:935` 이후 batch 처리는 동기 반복을 포함한다. helper가 있다는 것과 무거운 경로에 적용됐다는 것은 다르다.

**외부 기준:** [Google의 long task 최적화](https://web.dev/articles/optimize-long-tasks)는 작업 분할과 scheduler.yield를 설명한다.

**빠진 후보:** 큰 import/batch의 사전 변환·검증이나 비긴급 후처리 분할. canonical commit과 matching readiness 사이를 임의로 yield하거나 부분 상태를 노출해서는 안 된다. 짧은 루프마다 yield를 추가하는 것도 권하지 않는다.

**판정 방법:** 큰 import/paste/다중 편집에 입력을 겹쳐 input delay와 최대 task 길이를 비교한다. 이미 빠른 단일 편집에는 적용하지 않는다.

## 5. 실제 사용자 환경 지연과 강제 layout 귀속 — 계측 공백

**확인된 코드:** `panels/monitor/hooks/useWebVitals.ts:19`는 FID 필드를 유지하며 INP가 없다. `collectLocalVitals`는 일부 performance entry 조회 방식이다. Builder src에서 onINP/long-animation-frame 수집은 확인하지 못했다. longtask/perfMarks/CDP harness는 이미 있으므로 계측 전체가 없다는 뜻은 아니다.

**외부 기준:** [INP 최적화 지침](https://web.dev/articles/optimize-inp)은 field data와 input/processing/presentation delay 구분을 권한다. [Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames)는 여러 task·render 작업과 forcedStyleAndLayoutDuration 귀속을 보완한다. [layout thrashing 지침](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)은 geometry 읽기와 DOM 쓰기의 순서 분리를 다룬다.

**빠진 후보:** 클릭/키보드 INP 및 지원 환경의 LoAF, 앱 작업별 지연을 익명 집계하고 문서 크기·DPR·브라우저·기기군별로 비교하는 RUM 설계. 외부 전송을 이번 조사에서 추가하지 않았다. 먼저 로컬 수집/내보내기로 계약을 검증할 수 있다.

**주의:** [INP 정의](https://web.dev/articles/inp)는 wheel zoom/scroll/hover 전체를 포함하지 않는다. Canvas 연속 조작은 기존 RAF/입력→제출/trace 지표가 계속 필요하다. LoAF도 16ms 수준의 모든 프레임 누락을 검출하는 도구가 아니다. geometry read 코드의 존재만으로 forced reflow를 단정하지 않는다.

## 이미 적용됐거나 지금 도입 근거가 부족한 것

- 단일 pending/on-demand RAF, retained content/overlay, command stream cache, Navigator virtualization, 미사용 Canvas 구독 제거, ZoomControls transient DOM 갱신은 이미 있다. [Figma의 React viewport 우회 사례](https://www.figma.com/blog/improving-scrolling-comments-in-figma/)와 방향이 일치하며 같은 최적화를 다시 구현할 이유가 없다.
- 패널 추가 memo는 실제 실행이 없는 DataTablePanel을 대상으로 추진하면 안 된다. 이전 진단 과대집계 정정을 유지한다.
- WebGPU 전환 자체는 개선을 보장하지 않는다. Figma 자료도 인터페이스·uniform upload 최적화와 호환성 작업을 설명한다. CanvasKit backend 지원·동작 정합성·장비 지원을 별도로 확인하기 전 즉시 전환 후보로 삼지 않는다.
- Worker/OffscreenCanvas는 serialization/전달 비용과 ownership·복구 설계가 필요하다. 현 구조의 저장/준비 비용을 귀속하기 전에 렌더러 전체 이전을 최우선으로 제안하지 않는다.
- 반복 관측한 startup font 404는 배포 경로와 측정용 static server 차이를 분리해 확인해야 한다. 이번 조사만으로 모든 배포에서 발생하는 폰트 결함이라고 확정하지 않았다.

## 실행 제안

먼저 저장 경로와 camera-only CPU 준비를 각각 독립된 변경으로 비교하고, 이미지 byte 예산은 대형 이미지 문서로 별도 검증한다. RUM/LoAF는 이 PC의 결과를 다른 사용 환경으로 일반화하지 않기 위한 관측 경로다. 효과가 확인되지 않은 후보는 종료하고, readiness·데이터 복원 계약을 성능을 위해 완화하지 않는다.

제품 코드/배포/외부 전송 변경 없음. 신규 성능 개선 수치 없음. 문서 검토이므로 runtime test와 preflight는 반복하지 않고 diff 형식만 확인했다.

## 후속 실행

2026-09-07 사용자 승인으로 우선순위 1–5 구현·검증 완료. [실행 결과와 상대 비교](builder-performance-priorities-20260907.md): edit CPU 중앙값 -13.45%, pan -0.77%, zoom +0.15%. 구조 개선과 성능 개선 판정을 구분한다.

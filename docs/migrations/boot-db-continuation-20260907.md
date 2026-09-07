# DB 완료 뒤 실행되는 부트 작업 귀속

## 범위와 결론

사용자 지정 1번(DB 완료 뒤 74ms)만 조사했다. 시작 HEAD는 cf5d53e55이며 worktree는 clean이었다. `incrementalDocuments.completion`의 oncomplete는 Promise resolve만 수행한다. 경고 시간은 뒤따르는 React microtask/Effect까지 포함하므로 DB 처리 시간으로 해석할 수 없다.

## 구간 계측

`usePageManager.initializeProject`에 기존 observe로 8개 구간을 추가했다. DEV 동일 프로젝트에서 normalize1.8, canonical publish0.3, page model0.4, elements projection0.4, hydrate0.6, pageList publish0.0, pages publish0.0, activate0.4ms였다. 각각 호출1회이며 합계3.9ms이다. 소수점0.0은 측정 해상도 미만을 포함한다. 중간 DB await 및 후속 React 실행은 포함하지 않는다.

문서 전체 투영 helper가 여러 곳에서 사용되는 것은 코드상 확인되지만 현재 프로젝트에서는 각 구간이1ms 미만이므로 대규모 store 병합/캐시 변경의 근거로 삼지 않았다.

## CPU 귀속

CUA CDP Profiler로 부트를 기록하고 Performance.NavigationStart와 buffered LoAF의 script.startTime을 맞췄다. CPU sample timestamp를 정렬한 뒤 이웃 표본 구간을 대상 이벤트 범위에 clamp했다. 아래는 profiler 포함 DEV 단일 표본 추정이며 nested inclusive 시간을 합산하지 않는다.

- 수정 전 IDBTransaction.oncomplete48.6ms: React 후속 inclusive29.8ms, GC exclusive14.2ms. CommandPalette 경로 inclusive8.8ms였고 행 JSX 생성 스택이 포함됐다.
- 수정 후 같은 invoker54.1ms: CommandPalette inclusive2.5ms. React passive Effect에서 useLayoutPublisher→getCachedPageLayout→calculateFullTreeLayout26.7ms가 포함됐다. 이 프레임의 GC 배치는 수정 전과 달라 총시간 개선율을 산출할 수 없다.
- 따라서 확정한 불필요한 작업은 닫힌 팔레트의 행 JSX 생성이다. 전체 이벤트 시간은 여전히 열려 있는 문제이며 production74ms가 해결됐다고 주장하지 않는다.

## 최소 수정

`filteredCommands.map`으로 ListBoxItem JSX를 부모에서 미리 생성하던 코드를 RAC `items={filteredCommands}`/item render function으로 변경했다. 이전에 철회한 shared scope/단축키 host/컴포넌트 분리는 재도입하지 않았다. ListBox가 mount되지 않은 닫힌 모달에서는 행 표시 계산이 실행되지 않는다. exit 상태와 검색/명령 실행 정책은 기존 RAC와 부모 상태가 계속 담당한다.

## 검증

- 관련3files26tests PASS.
- 신규 회귀를 이전 eager map 코드로 실행하면 닫힌 row hint 번역63회로 실패(RED). 최종 items 코드에서는0회, 열면63행 표시로 PASS.
- 임시 Profiler/Performance domain을 종료했고 buffered observer는 callback에서 disconnect했다.
- 남은 후보는 DB API가 아니라 useLayoutPublisher 초기 계산과 React commit 경계다. 실제 입력이 같을 때의 중복 계산 여부를 확인하기 전에는 batching/지연/Worker를 추가하지 않는다.

- `pnpm run codex:preflight` PASS: type-check baseline0, registration14, catalog FAIL0/WARN0, engine/text matrix 통과.
- 실제 DEV 브라우저: 팔레트63행, Zoom 검색7행, 첫 Escape 검색 초기화, 두 번째 Escape 닫힘 확인.
- production 재측정은 수행하지 않았다. DEV 단일 CPU 표본은 조건을 고정한 반복 A/B가 아니므로 전체 성능 개선의 근거로 사용하지 않는다.


## 후속: useLayoutPublisher 중복 계산 검증

2026-09-07 같은 DEV 프로젝트, Mobile 390×844에서 캐시 조회별 root key, 입력 차이, 소요 시간을 임시 기록했다. Profiler 없이 두 차례 부트를 확인했다.

| 구간 | 부트 A | 부트 B |
| --- | ---: | ---: |
| page-components 최초 계산 | 23.7ms | 24.5ms |
| 다른 페이지 최초 계산 | 0.0ms | 0.1ms |
| 후속 캐시 적중 | 10회 | 10회 |
| 캐시 적중당 최대 시간 | 0.1ms | 0.1ms |
| 동일 입력 전체 재계산 | 0회 | 0회 |

두 최초 miss 사유는 모두 cold였다. 입력 elementById 크기는 각각59이며 페이지별 노드 수가 아닌 공유 lookup 크기다. 후속 입력 차이는 없었고 cache hit로 반환됐다. 따라서 layoutVersion/effect 재실행이 전체 계산을 중복시킨다는 가설은 이 프로젝트에서 기각한다. 캐시 정책·readiness·타이머를 변경하지 않았다.

별도 DEV CPU 표본에서 calculateFullTreeLayout inclusive26.36ms, traversePostOrder16.23ms, enrichWithIntrinsicSize9.58ms, CanvasKit 호출7.52ms, 엔진 buildFull3.33ms, computeLayout3.76ms였다. 표본별 동일 함수의 재귀 ancestor는 한 번만 집계했다. 이 값들은 중첩되므로 합산할 수 없으며 실제 함수 구간의 정밀 계측값도 아니다. 초기 순회/크기 측정/엔진 구성 비용을 가리키며, 중복된 입력 처리 결함의 증거는 아니다.

부트 B의 기존 계측에는 render.frame 최대91.3ms, content record 최대49.8ms, content flush 최대26.2ms가 남았다. 각각의 최대값이 같은 프레임인지까지 연결하지 않았으므로 단순 합산하지 않는다. 다음 우선순위는 이 첫 Skia 프레임의 record/flush 귀속이다. 최초 레이아웃 최적화는 입력 규모별 추가 근거가 필요하다.

임시 전역 배열/기록 코드는 원문과 대조해 전부 제거했다. 이번 단계에는 제품 코드 수정이 없으며 앞 단계 WIP를 보존했다. production 경고 해결 판정은 계속 보류한다.


## 후속: 첫 Skia 프레임 record/flush 귀속

2026-09-07 DEV 같은 프로젝트/Mobile에서 기존 perfMarks의 start/end를 임시 보존하고 CDP CPU 표본과 NavigationStart를 정렬했다. 다음은 **같은 첫 프레임** 안의 함수 구간이며 CPU 프로파일링이 켜진 표본이다.

| 구간 | 시간 |
| --- | ---: |
| render.frame | 96.2ms |
| record.content | 52.4ms |
| flush.content | 27.7ms |
| flush.main | 3.1ms |
| 나머지 프레임 구간 | 약13.0ms |

record 안의 최초 Paragraph layout은17.2ms, FontCollection은1.2ms였다. CPU 표본에서 recordSelfSpan inclusive35.3ms, renderText31.3ms, drawPicture16.2ms가 관측됐다. renderText는 recordSelfSpan 내부이므로 합산하지 않는다. flush 안에는 Surface.flush inclusive25.5ms, getShaderParameter exclusive7.5ms가 관측됐다. 이는 첫 GPU 제출 경로와 셰이더 상태 조회의 동기 비용이며, getShaderParameter 전체를 순수 셰이더 컴파일 시간이나 GPU 실행 시간으로 단정하지 않는다. record라는 라벨도 Picture 생성만이 아니라 실제 canvas.drawPicture 재생까지 포함한다.

### Picture 캐시 우회 대조

CPU Profiler를 끈 뒤 임시로 isNodePictureCacheEnabled를 false로 고정해 부트하고 원래 코드로 복구해 다시 부트했다. 각1회이며 순서를 무작위화한 반복 실험은 아니다.

| 항목 | 캐시 우회 | 기존 캐시 |
| --- | ---: | ---: |
| 첫 record | 49.8ms | 51.5ms |
| 첫 content flush | 25.9ms | 26.2ms |
| 첫 frame | 91.3ms | 93.9ms |
| 후속 record 3회 | 1.4 / 1.1 / 1.4ms | 0.4 / 0.3 / 0.5ms |

캐시 우회에서도 최초 native 그리기/flush 지연이 남는다. 최초 record+replay 구조 제거가 경고를 해소한다는 근거가 없고 후속 재사용 이점이 있으므로 캐시 변경은 채택하지 않았다. 타이머 분할·warmup 이동·셰이더 조회 생략도 적용하지 않았다.

이번 단계는 병목 귀속과 후보 기각까지이며 제품 성능 수정은 없다. 두 임시 코드 변경은 보관한 원문과 정확히 대조해 복구했고, Profiler/Performance를 비활성화했다. 기존 WIP는 보존했다. production 재측정 및 전체 경고 해결은 미완료다.

다음 검증 후보는 실제 렌더 surface까지 Worker가 소유하는 작은 독립 실험이다. 이전 serialized Picture 전송 실험처럼 main에서 deserialize/replay하면 native 비용이 잔존하므로, 이번에 확인한 record+flush 경로까지 경계에 포함해야 한다. 제품 적용 전 전달 비용·실제 WebGL 백엔드·프레임 결과/입력 revision 일치·첫 제출 ack·context loss 및 dispose 경계를 검증해야 하며, 이 문서는 Worker 도입 확정이나 성능 효과의 증거가 아니다.

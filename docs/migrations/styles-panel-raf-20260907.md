# Styles 패널 RAF 조사 이력 — 추정 최적화 철회

> 2026-09-07 사용자 지시에 따라 이 문서의 Styles/단축키/팔레트 변경은 원복했다. 아래는 조사 이력이며 현재 적용 상태가 아니다. 폰트 이름 조회 수정은 유지했고 빌트인 CanvasKit 폰트는 TTF로 변경했다.

## 판정

Styles 열기 경고는 아직 해결 완료가 아니다. 기존 전역 단축키/CommandPalette 수정 뒤에도 사용자 RAF 53ms를 현재 Chrome에서 확인했다. 프로젝트 로딩 경고와 별개다.

## 현재 증거

- buffered LoAF startTime 10854ms: 클릭 dispatchDiscreteEvent 약 30ms, 뒤따르는 panelWorkspaceLayoutCoordinator.flushPendingInput RAF 약 55ms, forced style/layout 3.5ms.
- 별도 visible Styles 재오픈 React 계측: root render 14.5 / 5.1 / 14.5 / 4.9ms. Effect 각각 0.7 / 3.8 / 0.3 / 0ms.
- 첫 렌더 상위는 PanelWorkspace/PanelDock, 표시 복귀는 StylesPanelContent, 그 뒤 큰 렌더는 RAC Tabs CollectionBuilder/CollectionInner/TabsInner였다. 마지막은 ComboBox 등의 collection 갱신이었다.
- 컴포넌트 actualDuration은 자식 포함 시간이다. 중첩 값을 합산하지 않는다. 별도 재오픈 측정과 사용자 53ms 단일 RAF는 같은 샘플이 아니다.
- RAC Activity hide/show가 필드 state를 재생성한다는 가설은 작은 재현 실험에서 확인되지 않아 수정 근거에서 제외했다.

## 이번 보완

- StylesPanelShortcuts를 본문과 형제 경계로 분리해 scope 변경이 본문 렌더로 전파되지 않게 했다. 외부 Activity의 숨김/복귀와 등록 수명은 유지한다.
- StylesPanelViews에 memo 경계를 둬 선택 탭, dirty 그룹, 수정 개수 변화만 Tabs 입력 재구성으로 연결했다. 내부 필드 store 구독과 i18n context 갱신은 그대로 동작한다.
- 탭 선택 state는 원래 본문에 유지해 empty/delegated 분기 전환으로 선택이 초기화되지 않게 했다.
- 회귀 테스트는 실제 RAC Tabs를 사용해 scope/헤더만 바뀔 때 입력 재구성 없음, ArrowRight 탭 전환과 헤더 갱신 후 선택 유지를 확인한다.

## 검증과 한계

- 관련 Vitest 5 files / 32 tests PASS.
- codex:preflight PASS (type baseline 0), git diff --check PASS.
- 추가 보완 후 브라우저 재측정은 사용자 Chrome 조작과 충돌해 두 번 중단됐다. 검증 응답 대기 중이다.
- RAF 경고 제거 또는 production 개선율을 주장하지 않는다. 기존 34.3ms root render 합계는 이전 수정의 비고정 DEV 관측이며 완료 판정 근거로 쓰지 않는다.
- 임시 DevTools hook은 원복했고 PerformanceObserver는 기록 조회 후 disconnect했다. CSS/catalog/Canvas/Preview 렌더 계약에는 변경이 없다.

## 새 프로젝트 CPU trace — 잔존 원인 판정 보완

사용자 새 프로젝트 `ade5bcd8-aa1c-4a5a-a834-bc1b7b4dd993`에서도 React RAF 52ms를 확인했다. 이전 53ms와의 차이는 개선 근거가 아니다.

- DevTools Performance UI에서 Styles 단일 열기를 기록하고 `/private/tmp/styles-open-20260907.json`으로 내보냈다. 이 캡처에서는 FireAnimationFrame 59.957ms, 안쪽 RunMicrotasks 59.830ms였다. 클릭은 21.947ms였다.
- CPU 샘플 timestamp를 정렬하고 인접 sample 간 시간을 RAF 구간에 잘라 귀속했다. 원본 timeDeltas에는 음수가 있어 단순 합산을 사용하지 않았다. 배타적 추정은 native Task.run 32.34ms, createTask 11.06ms, getAnimations 3.33ms, GC 2.02ms였다. 이는 profiler를 켠 단일 DEV 관측이며 production 시간으로 환산하지 않는다.
- runWithFiberInDEV, commitHookEffectListMount, reappearLayoutEffects/reconnectPassiveEffects 호출 스택이 확인됐다. React 개발 task 추적과 Activity Effect 복귀 비용이 컴포넌트 actualDuration 밖에도 있으므로 Tabs collection 렌더 시간만으로 RAF 전체를 설명할 수 없다.
- React 개발 파일은 모듈 초기화 때 console.createTask를 캡처하고 fiber._debugTask.run으로 실행한다. 단순히 나중에 console.createTask를 교체하는 실험은 충분하지 않다.
- 기존 fiber의 task wrapper만 분리하려던 임시 비교는 Chrome 사용자 조작 충돌로 입력 전에 중단됐다. 제품 코드에서 console/React/경고를 끄는 변경은 하지 않았다.
- 따라서 다음 필수 증거는 동일 Styles 동작의 개발용 task 추적 유무 비교 또는 production 비교다. 경고는 여전히 미해결이며, 현재는 새 memo/타이머 변경보다 이 비용 분리가 우선이다.

## 개발 추적 분리 시도와 비프로파일링 반복 측정

- DevTools의 `비동기 스택 트레이스 사용 중지`를 0→1로 변경한 캡처는 `/private/tmp/styles-open-async-off-20260907.json`이다. Styles 열기 RAF 99.172ms 중 microtask 98.711ms였고, Task.run 52.63ms/createTask 20.00ms 추정이 여전히 남았다. 이 설정은 React task 추적 비용을 제거하는 대조군이 아니다. 단일 실행의 증가를 설정 효과로 해석하지 않는다. 캡처 시작의 RAF 519.768ms는 프로파일러 시작 구간이라 Styles 결과에서 제외했다.
- 설정은 0으로 원복 확인했다. `Page.addScriptToEvaluateOnNewDocument`를 통한 초기화 전 비교는 CUA CDP에서 지원하지 않아 적용되지 않았다. 이후 `typeof console.createTask === 'function'`을 확인했다.
- 같은 DEV 프로젝트, body 선택, Mobile 100%, Styles Layout 내용 표시를 확인한 비프로파일링 재오픈 3회: 클릭 22.1/16.1/18.2ms, `flushPendingInput` RAF script 31.9/33.3/30.4ms, 전체 LoAF 65.0/60.7/58.4ms. 각 RAF의 forced style/layout은 2.8/2.8/2.7ms였다. 새로고침 뒤 최초 열기의 전체 LoAF는 92ms였다(이 첫 관찰은 script 상세를 저장하지 않았으므로 RAF 수치를 추정하지 않는다).
- 반복 측정의 30~33ms는 최초 열기 52ms 경고가 해결됐다는 근거가 아니다. DEV 준비 상태와 프로파일러 사용 여부를 통제하지 않은 수치끼리 개선율을 산출하지 않는다. 임시 PerformanceObserver와 window 진단 변수는 제거했다.
- production 빌드는 `/private/tmp/composition-styles-production-20260907`에 성공했다. 기본 배포 경로가 `/composition/`이므로 preview도 `--base /composition/`으로 실행했다. `http://localhost:5175/composition/dashboard`는 Sign In 화면으로, 동일 프로젝트 비교는 사용자 로그인 대기다. 인증 토큰 복사나 인증 우회는 하지 않았다. 원본 문서 스토어는 읽기만 했으며 비교 origin에 복사하지 않았다.
- 이번 단계는 진단과 증거 기록만 진행했다. 제품 코드 추가 변경, production 성능 판정, 프로젝트 오픈의 native Skia 비용 해결은 없다.

## 로그인 후 production 대조 — 2026-09-07

사용자가 production origin에 직접 로그인했다. 비교 DB가 비어 있음을 확인하고 기존 읽기 snapshot의 projects/document_heads/document_parts/documents 레코드를 `localhost:5175`에 추가했다. 인증 정보와 원본 `localhost:5173` DB는 수정하지 않았다.

- 동일 project ID, body 선택, Mobile 100%, Styles Layout, Transform/Layout 펼침, 나머지 패널 닫힘을 화면에서 확인했다. CPU profiler 없이 같은 CUA 클릭과 LoAF observer로 측정했다.
- production: 새로고침 뒤 최초 열기 1회와 반복 열기 5회 모두 LoAF 항목 없음. 이는 50ms 초과 프레임이 관찰되지 않았다는 뜻이며 RAF 0ms나 16.7ms 예산 충족을 의미하지 않는다.
- 직후 DEV 대조: 최초 열기 LoAF 94.7ms, 클릭 29.4ms, `flushPendingInput` RAF script 63.2ms(forced layout 3.8ms). 반복 5회 LoAF 69.3/62.7/71.6/71.4/68.8ms, RAF script 34.6/36.4/34.8/35.3/33.0ms, forced layout 2.8~3.0ms.
- production의 초기 27% 확대율/Transform 접힘 관측(LoAF 53.4ms, RAF 29.1ms)은 조건이 달라 위 대조에서 제외했다.
- 결론: 이 문서의 Styles 열기에서는 DEV 빌드가 긴 프레임을 크게 늘린다. 앞서 관찰한 React DEV task/Effect stack과 일치하지만, production은 minification과 React DEV 제거 등 여러 차이가 있으므로 차이를 `console.createTask` 하나로 귀속하거나 제거 가능한 시간으로 환산하지 않는다. DEV 경고를 없애기 위한 console 차단·React 패치·타이머 이동은 적용하지 않는다. 더 큰 문서나 다른 Styles 탭의 production 예산 충족은 아직 검증하지 않았다.
- 임시 observer/window 변수를 제거하고 DEV 원본 탭의 Styles를 닫았다. production 비교 사본과 100% 화면 내부 viewport 설정은 비교 origin에 남긴다. 제품 코드 추가 변경 없음. 증거 기록의 `git diff --check` PASS.

### 별도 발견: 화면 밖 viewport에서 부트 95% 대기

production에서 확대 메뉴 사용 후 저장된 mobile viewport가 `{x:-2147.8898856186615,y:-340.4291227547038,scale:1}`이었다. 새로고침 2회 모두 visible 문서와 크기가 있는 canvas에서 `Preparing the canvas… 95%`가 지속됐다. 비교 origin의 mobile viewport만 `{x:0,y:0,scale:1}`로 맞춘 뒤 새로고침하니 실제 UI가 나타났다. ready 값이나 타임아웃은 변경하지 않았다.

이는 Styles 성능 결과와 별도 재현이며 아직 코드 원인을 확정하거나 수리하지 않았다. 후속은 화면 밖 content culling 시에도 matching boot target의 실제 surface 제출과 완료 통지가 연결되는지 조사하는 것이다. 저장 viewport 조정은 비교 환경 준비일 뿐 제품 수정으로 간주하지 않는다.

## 프로젝트 오픈 연속 경고 — 실제 호출 순서 확인

사용자의 연속 두 번 보고에 대해 현재 DEV 부트의 buffered LoAF를 조회했다. 임시 observer는 callback에서 즉시 disconnect했다.

| 부트 상대 시작(ms) | 실행 경로               | script 시간(ms) |
| ------------------ | ----------------------- | --------------- |
| 2540.5             | picturePreparation.step | 49.0            |
| 2595.8             | picturePreparation.step | 113.9           |
| 2715.7             | picturePreparation.step | 44.5            |
| 2787.1             | picturePreparation.step | 45.7            |
| 2838.3             | picturePreparation.step | 45.1            |
| 2894.9             | frameScheduler RAF      | 105.1           |

같은 페이지 PERF에서 fontCollection은 총 49.0ms/max49.0ms, prepare.picture max112.3ms, paragraph.layout max108.2ms/p95 44.3ms였다. `render.frame` max91.6ms, overlay max46.6ms, content flush max30.7ms, main flush max8.7ms이며 각 max를 합산하지 않는다. script 시간은 callback 이후 microtask까지 포함될 수 있어 render.frame 값과 동일시하지 않는다.

`prepareColdPictures`는 collection 준비를 먼저 yield하고 각 노드 Picture 기록을 후속 yield한다. `picturePreparation.step`은 동기 작업 하나를 마친 뒤 4ms 예산을 검사한다. 따라서 collection 등록과 최초 paragraph native layout이 각기 긴 timeout을 만들 수 있으며, 이번 기록은 이 경로 및 개별 native 관측과 부합한다. 콜백 경고가 두 번이라는 사실은 동일 작업의 중복 실행을 입증하지 않는다. 단일 native 호출의 시간이 이미 예산을 넘으므로 setTimeout 분할만으로 해결되지 않는다.

또한 이보다 앞선 fontManager IDBRequest.onsuccess 559.8/81.2ms와 loadCustomFontsToSkia Promise 613.1ms도 남아 있다. 후속 수정은 폰트 등록/파싱 중복과 실제 사용 weight별 최초 layout 비용을 귀속하고, 줄일 수 없는 native 작업의 Worker 실행 경계를 검토해야 한다. 이번 단계에서는 제품 코드를 변경하지 않았다.

## 근본 수정 1단계 — 폰트 이름 조회 재파싱 제거

- `loadFont`/`loadFontFromBuffer`는 이미 Typeface를 생성한 뒤 이름을 읽으려고 임시 `FontMgr.FromData(buffer)`를 만들었다. 이를 `typeface.getFamilyName()`으로 교체했다. alias와 내장 이름이 같아도 nameMap에 저장한다. 모든 weight에 대해 이름 조회용 manager를 재생성하던 경로가 사라졌다.
- FontMgr/Paragraph provider 통합도 검토했지만 실제 CanvasKit에서 Pretendard/Inter 400/700/900 weight의 글리프 폭을 비교하니 provider.matchFamilyStyle 결과가 700/900에서 기존 FromData와 달랐다. 이 구현은 철회했고, 기존 manager와 collection 생성·폰트 선택 계약을 유지했다. 중간 실험의 frame47.6ms/collection0ms는 최종 수정 성능으로 인용하지 않는다.
- 최종 수정의 실제 DEV 부트: 준비 완료 UI 표시 확인. fontManager callback 48.8ms, loadCustomFontsToSkia callback613.3ms, picturePreparation50.0/115.4/44.6/46.4/45.4ms, frameScheduler104.1ms가 남았다. 이전 부트와 비고정 관측이므로 개선율을 산출하지 않는다. 구조적으로 제거한 것은 이름 조회 전용 native manager 생성이다.
- focused 3 files / 13 tests PASS. 이름 alias 보존과 로드 시 FromData 미호출, 배치당 manager 구축 1회, warm 캐시 재사용 및 폰트 추가 이후 재구축을 확인했다. 실제 부트 Canvas 표시도 확인했다. CSS/Spec/Preview의 폰트 데이터와 weight 정책은 변경하지 않았다.
- 2단계 조사: `prepareColdPictures`는 이미 visibility·viewport 교차·편집 노드·캐시 hit를 제외한다. 사전 준비와 실제 content 렌더가 같은 padded culling bounds를 사용한다. 더 좁은 범위만 준비하면 나머지가 RAF의 동기 cache miss로 이동할 수 있어 단순 bounds 축소는 적용하지 않았다.
- 3단계 조사: 설치된 CanvasKit API는 `SkPicture.serialize`/`MakePicture`를 제공한다. Worker 결과 전달 후보이나 FontMgr/FontCollection 자체의 이전 API는 없고, 현재 record 경로는 registry·이미지·편집 상태 등 메인 스레드 의존성을 가진다. Worker는 해당 입력 snapshot과 revision 취소, Picture/폰트 자원 수명까지 포함해야 한다. 아직 구현하지 않았으며 1~3단계 전체 완료가 아니다.

# Worker 소유 WebGL surface 독립 검증

> **최종 상태 — 2026-09-07 실제 Builder 적용 후 철회.** 메인 부트 차단은 줄었으나 실제 휠 입력→제출이 악화되어 사용자 유지 조건을 충족하지 못했다. Worker 연결 및 앞 단계의 도입 전용 코드/테스트는 모두 제거했다. 아래 독립 실험·구현1~3은 당시의 이력이며 현재 제품 구현을 뜻하지 않는다. 최종 근거는 문서 끝의 “실제 제품 경로 A/B와 철회”를 참조한다.

## 판정

2026-09-07 사용자 승인 범위는 제품에 연결하지 않은 Worker surface 실험이다. CanvasKit 0.42.0의 WebGL surface를 Worker가 직접 소유하고 record/flush까지 실행하면, 합성 부하의 메인 스레드 차단을 줄일 수 있음을 확인했다. 렌더 처리 시간이나 실제 Builder 프로젝트 오픈 시간이 줄었다는 판정은 아니다.

앞선 `boot-db-continuation-20260907.md`의 첫 프레임 귀속에서 record52.4ms/flush27.7ms가 확인됐고, Picture 우회에서도 지연이 남았다. 이번에는 serialized Picture를 메인으로 보내지 않고 HTMLCanvasElement를 transferControlToOffscreen으로 Worker에 전달했다. Worker의 surface.flush 뒤에 요청 id/revision을 응답했다.

## 환경과 fixture

- 실행 중인 localhost:5173 Builder 탭에서 CUA CDP Runtime.evaluate로 독립 canvas/Blob module Worker를 생성했다. 기존 Builder canvas에는 연결하지 않았다.
- CanvasKit, PretendardVariable.ttf를 메인과 Worker 각각 로드했다. 실제 family 이름은 FontMgr.getFamilyName(0)으로 조회했다.
- 800×600 surface, RGBA8888/Unpremul/sRGB readback. CSS 표시 크기320×240, backing size는 양쪽 동일하다.
- 60항목: 5열×12행, 사각형+한글/Latin 텍스트, 14px, weight Normal/Bold/Black 순환.
- 600항목: 20열×30행, 10px 텍스트. 차단 기준 미만이라 주 판정에는 사용하지 않았다.
- 1200항목: 30열×40행, x=12+column×26, y=12+row×14, 24×13 사각형, 8px `한${i}` 텍스트, Paragraph.layout(24), 세 weight 순환. 독립 합성 부하이며 실제 Builder 59개 lookup 입력을 대체하는 fixture가 아니다.
- 항목마다 ParagraphBuilder/Paragraph를 생성·삭제하고 Paint는 프레임당 하나를 사용한다. 한 프레임 전체 draw 후 surface.flush한다. 노드 Picture 캐시나 Builder overlay/ping-pong은 이 fixture에 없다.
- 메인/Worker 모두 MakeWebGLCanvasSurface를 사용했다. 세 번째 메인 surface 및 별도 동일 초기화 Worker surface의 reportBackendTypeIsGPU()가 true임을 확인했다.

초기 실험의 스타일 객체 구문 오류와 ParagraphStyle 생성 누락은 실험 코드 오류였다. 정식 new CanvasKit.ParagraphStyle 경로로 수정했고, 실패한 RAF 관찰자는 페이지 reload로 정리한 뒤 성공 표본을 수집했다. 제품 결함으로 분류하지 않는다.

## 측정 방법과 한계

WASM/폰트 다운로드·초기화는 측정 밖이다. 렌더 호출 전 RAF 두 번을 기다린 뒤 실행했고, 종료 후120ms 동안 callback/LongTask 통지를 수집했다. 1200항목 측정은 RAF가 전달한 명목 timestamp가 아닌 callback 내부 performance.now() 도착 시각의 간격을 사용한다. 60/600항목의 초기 RAF 명목 timestamp 결과는 차단 판정에서 제외했다.

각 쌍은 새 Worker와 새 메인 CanvasKit/surface를 만들고 Worker→메인 순서로 실행했다. 브라우저 프로세스/드라이버 캐시는 초기화하지 않았으며 순서를 무작위화하지 않았다. 프로파일러는 꺼져 있었다. CPU 사용률, GPU 실행 시간, 첫 픽셀 presentation 완료, production 프로젝트 오픈 시간을 측정한 것이 아니다.

## 1200항목 결과

| 반복 | 메인 render+flush | 메인 실행 중 RAF 최대 간격 | 메인 long task | Worker render+flush | Worker 요청 왕복 | Worker 실행 중 메인 RAF 최대 간격 | Worker 실행 중 메인 long task |
| ---- | ----------------: | -------------------------: | -------------: | ------------------: | ---------------: | --------------------------------: | ----------------------------: |
| 1    |            53.6ms |                     54.4ms |       54ms 1회 |              74.6ms |           75.7ms |                            20.9ms |                           0회 |
| 2    |            52.6ms |                     53.7ms |       53ms 1회 |              72.7ms |           73.8ms |                            20.1ms |                           0회 |
| 3    |            52.1ms |                     53.0ms |       52ms 1회 |              69.7ms |           70.5ms |                            20.4ms |                           0회 |

Worker flush는9.0~~9.3ms, 메인 flush는7.6~~8.1ms였다. Worker의 렌더 자체는 더 느렸으나 그 동안 메인 이벤트 루프가 긴 동기 렌더에 묶이지 않았다. 효과를 전체 렌더 속도 개선으로 표현하지 않는다.

60항목은 메인15.1ms/Worker22.5ms, 600항목은 메인34.5ms/Worker47.7ms였고 양쪽 모두 메인 long task가 없었다. 작은 fixture만으로는 차단 감소를 판정할 수 없었다.

## 정합성과 생명주기

- 60항목과 1200항목 각각1회에서 메인/Worker readPixels1,920,000바이트를 비교했다. 다른 채널0, 최대 채널 차이0이었다. readback/픽셀 전송은 성능 측정 밖의 검증 전용이다.
- revision1 요청은 flush 뒤 submitted/revision1로 응답했다. 동일 revision1 재요청은 stale로 응답하고 그리지 않았다.
- revision2 요청은 submitted/revision2로 응답했다.
- dispose는 surface/FontMgr 삭제 뒤 응답했으며, 후속 revision3 렌더 요청은 disposed 오류로 거부했다.
- flush 응답은 제출 완료 계약이다. compositor presentation 완료나 GPU fence 완료와 같다고 해석하지 않는다.
- Worker terminate, Blob URL revoke, 실험 canvas 제거, 메인 surface/FontMgr 삭제, 전역 실험 변수 제거를 완료했다. 측정 observer/RAF는 각 정상 측정 종료 시 해제했다.

## 제품 적용 전 남은 검증

1. 실제 Builder render command와 자산을 Worker가 소비할 수 있는 직렬화 경계 확인. CanvasKit 객체/DOM 참조/store를 그대로 전달할 수 없다. Paragraph/Picture/이미지의 native 소유권도 Worker 안에 두어야 한다.
2. 실제 초기 scene으로 프로젝트 오픈 A/B. 이번 합성 fixture에는 Builder의 카메라·overlay·damage·hit-test·ping-pong 구조가 없다.
3. projectId/boot target/scene revision을 묶은 제출 응답, 오래된 결과 폐기, 최신 요청 우선 처리, 자산 버전 및 전환 중 취소. 실험의 단일 revision 비교만으로 이 계약을 충족하지 않는다.
4. context loss/recovery, resize/DPR, 폰트/이미지 실패, 재마운트·종료 경합. 이번 실험에서는 미검증이다.
5. production과 입력 반응성·총 로딩 시간·메모리 비용을 함께 비교한 뒤 제품 적용 여부를 결정한다.

제품 코드는 이번 단계에서 변경하지 않았다. 독립 검증/문서 변경이므로 제품 테스트·preflight는 재실행하지 않았으며 git diff --check를 수행했다. 기존 readiness goal/guard/stop과 앞 단계 변경을 보존한다.

## 후속: 실제 Builder 전달/소유권 경계 검토

2026-09-07 현재 코드와 실행 중인 CanvasKit 객체를 조사했다. 이번 단계는 경계 검토이며 제품 코드의 Worker 연결은 수행하지 않았다.

### 그대로 넘길 수 없는 것

| 현재 경로                                                  | 확인한 결합                                                                 | 필요한 경계                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `renderCommands.ts:235` DrawCmd.skiaData                   | SkiaNodeData 전체 참조, image.skImage 및 text.align Embind enum 가능        | native-free draw 데이터와 asset id/version, 명시 enum 값                           |
| `nodeRendererTypes.ts:164` children / presentation targets | 자식 트리 및 같은 배열/객체를 직접 수정하는 presentation slot 참조          | 명령별 필요한 필드만 인코딩, presentation patch는 node id+revision으로 적용        |
| `skiaFramePipeline.ts:303` contentNode                     | CanvasKit/FontMgr/stream을 캡처한 renderSkia/renderDamageSkia 함수          | Worker 내부에서 실행 객체 구성; 함수 자체를 전달하지 않음                          |
| `renderCommands.ts:2088,2128,2532` 실행부                  | editing id, drag/sibling offset, registry 및 page/camera snapshot 외부 읽기 | 해당 프레임의 명시 snapshot 또는 Worker 소유 runtime 조회                          |
| `fontManager.ts:452`, `initCanvasKit.ts:33`                | window 싱글톤을 직접 사용                                                   | 환경별 runtime 소유권 주입; window를 Worker에 가짜로 만드는 우회 금지              |
| `nodeRendererText.ts:19`, `textMeasure.ts:74`              | DOM Canvas2D/document.fonts 측정 경로. Worker에서는 getMeasureCtx가 null    | Worker text 측정/폰트 준비 계약과 DOM 측정 parity 검증                             |
| `imageCache.ts:379`, `StoreRenderBridge.ts:1784`           | main에서 URL→SkImage decode 후 노드에 연결                                  | Worker에서 decode/cache/evict; 메시지는 asset id/version 및 URL 또는 encoded bytes |
| `SkiaRenderer.ts:199,344`                                  | 콘텐츠·오버레이를 같은 main surface에 합성                                  | surface 소유 Worker가 최종 합성도 담당하는 경계 우선 검증                          |

`renderCommands.ts`는 명령 생성과 실행을 한 모듈에 두고 있으며, 실행 중에도 `getSkiaNode`, `getEditingElementId`, `getDragVisualOffset`, `getSiblingOffset`, page/camera presentation 조회를 사용한다. 따라서 commands 배열만 clone해도 실행 입력이 완결되지 않는다.

### 실제 structuredClone 검증

실행 중인 CanvasKit 인스턴스로 만든 독립2×2 surface/image를 사용했다. 실험 후 native 객체를 삭제했다.

- `{image:{skImage}}`의 structuredClone은 **성공했지만**, 복제본 skImage.width는 undefined였다. 성공한 메시지 복제를 native 자원 전달 성공으로 판단할 수 없다.
- `CanvasKit.TextAlign.Left` 원본 value는0인데 clone은 own key가 없는 빈 객체였고 value도 사라졌다.
- `{renderSkia(){}}`는 DataCloneError였다.
- Float32Array와 Map을 포함한 순수 데이터는 clone됐다. Map/typed array라는 이유만으로 JSON으로 바꿀 필요는 없다. 단, 현재 registry의 살아 있는 typed-array buffer를 transfer하면 main 소유 배열이 detach되므로 전달용 snapshot의 소유권을 분리해야 한다.

### 소유권 제안

Main에는 React/Zustand/canonical mutation, 입력/IME/접근성, 기존 레이아웃 발행과 hit-test 데이터 생산을 남기는 경계를 먼저 검증한다. Worker에는 렌더용 CanvasKit/FontMgr/Typeface/Paragraph/Picture/Image/Paint/Shader, content/standby/main surface와 deferred disposal을 함께 둔다. 이 제안이 main의 모든 CanvasKit 사용을 제거한다는 뜻은 아니다. 레이아웃/DOM 측정용 폰트 경로는 별도이며, font provider를 무작정 통합하지 않는다.

문서 전체와 DOM 상태를 Worker에서 재조회하는 방식은 채택하지 않는다. 명령 생성 이후 필요한 draw 데이터와 camera/DPR/viewport/clip/scroll/drag/editing 상태를 같은 프레임 envelope에 담는 후보가 현재 병목(record/flush)에 가장 직접적이다. 빌드된 raw SkiaNodeData 전체를 전송하는 방식은 자식 트리 중복 및 mutable presentation 계약 때문에 피한다.

오버레이를 기존 canvas에서 main이 계속 그리면서 그 canvas를 Worker에 넘기는 방식은 소유권이 충돌한다. 별도 overlay canvas를 추가하는 대안은 합성/좌표/시각 계약 변경이므로 이번 단계에서 도입하지 않는다. 최종 같은 surface 합성을 Worker에 두는 후보를 먼저 검증한다.

### readiness와 전환 경계

현재 `SkiaCanvas.tsx:1114`는 동기 renderer.render 성공 직후 현재 projectId와 입력 documentRevision으로 acknowledgePresentedFrame을 호출한다. `canvasLifecycle.ts:85`는 project 일치와 target 이상 revision을 검사한다. 이 동기 경로를 비동기 응답 처리에 그대로 복사하면, 응답 시점의 현재 프로젝트를 이전 프레임에 잘못 붙일 수 있다.

Worker 요청에는 생성 시점의 projectId, boot/session generation, requestId, documentRevision, presentationRevision, viewportRevision, asset generation을 고정해야 한다. 응답은 요청의 값을 그대로 돌려주고, main은 활성 session/target/자산 상태와 맞는 실제 surface flush만 인정한다. 같은 프로젝트 재진입도 구분해야 한다. 이 검토에서는 기존 lifecycle 계약을 수정하지 않았다.

최신 요청 하나로 합칠 수 있는 것은 전체 snapshot이다. 이전 base revision에 의존하는 incremental patch를 중간에서 버리면 안 된다. patch를 합칠 때에는 base/revision 연속성을 보장하거나 최신 전체 snapshot으로 다시 시작해야 한다. 제출 ack는 초기 readiness/복구 경계에서만 Zustand에 반영하며 RAF마다 store를 갱신하지 않는다.

### 적용 순서와 완료 기준

1. **실행부의 runtime 의존성을 명시하고 전송용 명령 codec을 연결한다.** 생성부의 store/registry 조회와 실행부를 분리한다. native 객체/함수/Embind enum을 누락 없이 치환하고 실제 명령의 clone→decode roundtrip 및 main 재생 픽셀을 검증한다. 이미지 asset id/version, nested children 생략, presentation patch 정합성을 포함한다. 사용되지 않는 인터페이스만 먼저 추가하지 않는다.
2. **검증된 동일 명령을 독립 Worker surface에서 재생한다.** 실제 Builder 초기 scene의 텍스트·이미지·clip/effect와 overlay를 포함하고 serialize/decode/asset 준비/record/flush/메인 callback gap을 각각 측정한다. 실패한 명령을 조용히 생략하지 않는다.
3. **session/boot target과 최종 제출 응답을 연결한다.** 프로젝트 전환·같은 프로젝트 재진입·stale ack·asset 실패·context loss/resize/DPR·dispose 경합 테스트 후 실제 Builder에 적용한다.

현재까지 검증된 것은 독립 Worker surface의 차단 분리와 raw 명령 전달의 부적합성이다. 실제 프로젝트 오픈 경고 해결, 전송 비용, 제품 렌더 parity는 아직 검증되지 않았다. 검토/실험만 수행했으므로 제품 테스트·preflight를 반복하지 않았다.

## 구현 1: 명령 실행 runtime과 전송 codec

2026-09-07 사용자 다음 우선순위 승인으로 다음을 구현했다.

- `renderCommands.ts`: 편집 id, drag/sibling offset, page position snapshot, node registry, mask image 조회/로딩을 `RenderCommandRuntime`으로 받는다. 기존 호출부는 `mainRenderCommandRuntime`을 기본 사용한다. Picture miss의 내부 재기록에도 같은 runtime을 전달한다. 기존 프레임에 codec/전체 snapshot 복사를 추가하지 않는다.
- `renderCommandCodec.ts`: 명령의 native-free snapshot 생성, structuredClone, native 재연결, 같은 실행기로 단발 재생하는 진입점을 제공한다. native image와 image fill은 `{id, version}` 자산 참조로 치환하고 TextAlign/TileMode/FilterMode는 이름으로 전송한 뒤 수신 CanvasKit의 enum으로 복원한다. expanded children 및 mutable presentation target 참조는 제거한다.
- 예상하지 못한 native class/함수는 거부한다. 자산 참조를 resolver가 찾지 못하면 오류로 처리한다. 살아 있는 main Float32Array를 transfer하지 않고 snapshot으로 복제한다. 단발 재생이 생성한 Paragraph는 기존 지연 폐기 큐로 반환하며 이미지 자산은 resolver 소유로 유지한다.

### 검증

- 관련 Vitest3파일32tests PASS. native 자산/enum roundtrip, 원본 buffer 비분리, scrollbar 노드 정규화, children/presentation slot 생략, 누락 자산/비데이터/잘못된 버전 거부, 전역 drag와 다른 주입 runtime으로 direct/decoded 재생이 같은 좌표를 사용하는 회귀를 포함한다.
- 실제 Builder 초기 stream325명령/57개 bounds 노드를 가져와 원본과 codec roundtrip을 별도1000×1000 software surface에서 재생했다. 4,000,000바이트의 다른 채널0/최대 차이0, painted pixels425,784였다. 공백 이미지끼리 비교한 결과가 아니다. Paragraph 수는35→35였다. 실제 stream에는 image 자산이0개였다.
- 이를 보완한 별도 native image+pattern image fill fixture는64×64/16,384바이트 비교에서 다른 채널0, painted pixels4096이었다. roundtrip 후에도 빌려 쓴 원본 image.width()가2로 유효했다. 검증 surface/image를 정리했다.
- `codex:preflight` PASS: type-check baseline0, registration14, catalog FAIL0/WARN0, engine/text matrix 통과.
- `gate:visual-parity` 첫 실행은 테스트 서버의 CanvasKit dynamic import/Preview handshake 실패로 완료하지 못했다. 재실행은 smoke101 PASS였다. 실패 이력을 성능/픽셀 통과 결과로 바꾸어 기록하지 않는다.
- `git diff --check` PASS. 임시 stream 캡처 코드는 제거했고 실행 중 전역 참조도 삭제했다. 실제 명령 캡처는 기존 getCachedCommandStreamSnapshot으로도 가능하므로 후속 검증은 이 API를 우선 사용한다.

### 아직 완료하지 않은 경계

이 구현은 명령 실행 중 **상태/이미지 조회**의 주입 경계다. 파일 전체를 Worker에서 import해도 안전한 순수 executor로 분리한 것은 아니다. 폰트 관리자/window 초기화, DOM 기반 text measure, native 캐시 및 damage spatial index의 소유권은 아직 기존 환경에 있다. mask image URL의 자산 세대 manifest도 후속 Worker envelope에서 연결해야 한다. codec 자체에 project/boot/session ack를 섞지 않았다.

다음은 font/CanvasKit/text-measure runtime의 환경 결합을 분리하고 실제325명령을 Worker에서 재생하는 단계다. native singleton에 가짜 window를 주거나 main의 SkImage/Picture를 clone해 전달하는 방식은 사용하지 않는다. 기존 readiness/프로젝트 전환 계약은 변경하지 않았고 제품 Worker 연결 및 로딩 성능 개선은 아직 판정하지 않는다.

## 구현 2: CanvasKit·폰트·텍스트 측정의 실행 환경 분리

2026-09-07 사용자 다음 우선순위 승인으로 환경 결합을 제거했다.

- CanvasKit 초기화 캐시와 SkiaFontManager의 HMR 인스턴스를 실제 `globalThis`에 둔다. main과 Worker는 서로 다른 realm이므로 native 인스턴스를 공유하지 않는다. 가짜 window를 만들지 않는다.
- `initCanvasKit(wasmBaseUrl?)`로 Worker의 WASM 기준 URL을 명시한다. 기존 Builder의 인자 없는 BASE_URL 경로는 유지한다. FontManager에는 CanvasKit 조회 함수를 주입할 수 있다.
- Canvas2D 폰트 확인·비동기 로드·ready/loadingdone 무효화는 해당 realm의 FontFaceSet을 사용한다. textMeasure는 document가 없을 때 OffscreenCanvas2D로 측정한다. Worker에서 DOM의 폰트 로딩 상태를 공유한다고 가정하지 않는다.

### 재현과 실제 Worker 검증

1. DEV 소스 직접 module Worker import는 React HMR `$RefreshSig$` 오류로 실패했다. 동일 실행 경로를 별도 production 번들로 만들고 재검증했다.
2. 수정 전 production Worker import는 `getOrCreateFontManager`의 `window is not defined`로 실패했다. 변경 후 동일 방식 import 및 CanvasKit 초기화가 성공했다.
3. 실제 열려 있는 Builder의 `getCachedCommandStreamSnapshot()`에서 **543명령**을 확보했다. 실행 중인 Vite 모듈 URL을 사용했고, 별도 query 없는 import의 빈 캐시를 실제 scene으로 취급하지 않았다.
4. main과 독립 module Worker의 WebGL surface에서 같은 명령을 1000×1000으로 재생했다. Worker는 Pretendard/Inter TTF를 CanvasKit 및 자체 FontFaceSet에 각각 로드했다. family alias도 실제 내장 이름으로 등록했다.
5. RGBA 4,000,000바이트 비교: **다른 채널 0 / 최대 차이 0 / painted pixels 384,114**. Worker GPU backend=true, revision1 submitted, flush 후 deferred disposal을 비운 retained Paragraph=0. 이미지 자산 없는 실제 장면이었다.
6. Worker replay+flush 단일 표본은53.7ms였다. 초기화·전송·readback을 포함하지 않으므로 부트 성능 개선율이나 메인 차단 감소 수치로 사용하지 않는다. main 대응 시간/RAF gap은 이 실험에서 수집하지 않았다.
7. main 검증 surface는 즉시 삭제했다. 이후 소스 HMR reload로 진단 전역과 Worker realm이 사라졌음을 확인했다. 이번 단계는 명시 dispose ack 검증으로 기록하지 않는다. 임시 번들/진입점/config는 저장소에서 제거했다.

### 회귀와 잔여 범위

- Node 환경에서 window 없이 CanvasKit 초기화/중복 요청/HMR 인스턴스 재사용, DOM/Worker FontFaceSet 선택, OffscreenCanvas 실제 폰트 메트릭 및 loadingdone 캐시 무효화를 테스트한다.
- 관련 Vitest6파일102tests PASS. 기존 main 텍스트 측정·segment cache·FontManager·codec 회귀 포함.
- `gate:visual-parity` smoke101 PASS. 기존 DOM/Canvas/Preview 검증을 유지한다.
- 실제 장면의 image/mask/effect/overlay 모든 종류, resize/DPR/context loss와 세대별 asset lifecycle은 아직 미검증이다. 렌더 모듈의 transitive import가 Worker production 번들에 들어가지만 React/store 의존성 전체를 제거한 경량 entry라고 주장하지 않는다.
- 다음 우선순위는 자산·효과·오버레이를 포함한 Worker 재생 및 전송/준비/flush/메인 callback gap 계측이다. 이어서 session/boot/revision의 stale ack·전환·실패 계약을 고정한 뒤 제품 연결한다. 현재 제품은 기존 main renderer를 사용한다.

최종 `codex:preflight` PASS(type-check baseline0, registration14, catalog FAIL0/WARN0, engine/text matrix). `git diff --check` PASS. 커밋·푸시하지 않았다.

## 구현 3: 마스크 자산 누락 수정과 복합 Worker 재생

2026-09-07 다음 우선순위 승인으로 이미지·효과·오버레이의 전송 경계를 검증했다.

### 발견한 결함과 수정

일반 image/image fill은 codec의 id/version resolver를 사용하지만, ELEMENT_BEGIN의 image mask는 URL만 전달됐다. Worker runtime에 같은 URL 이미지가 없으면 기존 실행기는 비동기 load를 시작하고 해당 프레임을 마스크 없이 그린다. 전송 경계에서는 잘못된 제출을 성공으로 취급할 위험이다.

`RenderCommandPacket.maskImages`에 URL→id/version 참조 목록을 추가했다. 인코딩 시 URL 및 자산 참조가 없으면 거부하고, 디코딩 시 모든 사용 마스크의 manifest와 native 자산 존재를 확인한다. `replayRenderCommandPacket`은 검증한 자산을 runtime의 마스크 조회에 연결한다. 직접 `decodeRenderCommands` 결과를 실행하는 소비자는 별도 mask runtime 연결이 필요하므로 전송 재생에는 replay 진입점을 사용한다. 일반 main 렌더의 비동기 이미지 정책은 바꾸지 않았다.

회귀는 중복 URL의 단일 참조, 정확한 version resolver 전달, manifest/자산 누락, 누락 시 canvas.save 이전 실패를 고정한다. 실제 Worker 검증에서는 외부 runtime.getImage를 호출하면 즉시 throw하도록 설정해 manifest 경유를 확인했다.

### 실제 WebGL 비교

- 별도 800×600 scene, 30명령: image, repeat/mirror image fill, alpha/luminance image mask, gradient mask, circle clip, layer blur, drop shadow, opacity, multiply blend.
- 같은 surface에 실제 선택 박스·코너 핸들·치수 텍스트 라벨·lasso 함수를 합성했다. Pretendard와 32×32 PNG 자산을 Worker가 직접 native 객체로 생성했다.
- 원본 명령 main 실행과 codec Worker 재생을 **3회 비교하여 1,920,000 RGBA 바이트 차이0/최대차0**. 매회 흰색 아닌 픽셀112,213, 각10개 내용 영역에서도 실제 칠해진 픽셀을 확인했다. 양쪽 GPU backend=true.
- Worker의 자산/overlay font 정리 후 disposed ack를 확인하고 terminate했다. 각 surface는 finally에서 삭제한다. 기존 Builder 문서/화면에는 fixture를 쓰지 않았다.

### 비용 분해와 관측 한계

최종 표시 중인 Builder에서 다른 품질 게이트 종료 후 측정했다. serialize0.3ms, 작은 PNG 인코딩2.9ms/145B, 명령 JSON4688자, Worker 초기화90.9ms, 첫 자산 디코드2.3ms, 별도 packet 검증/디코드0.2ms. 이는 작은 fixture이고 대형 이미지 업로드 비용을 대표하지 않는다. postMessage enqueue는0~0.1ms이며 전체 전송 지연을 의미하지 않는다.

픽셀 readback을 끈6쌍은 main-first/worker-first를 교대로 실행했다. RAF timestamp가 아니라 callback 진입의 performance.now 차이를 사용한다.

| 쌍  | 순서         | 직접 렌더 메인 callback gap | Worker 중 메인 callback gap | 직접 flush | Worker flush |
| --- | ------------ | --------------------------: | --------------------------: | ---------: | -----------: |
| 1   | main-first   |                        25.6 |                        20.0 |       17.8 |         17.0 |
| 2   | worker-first |                        34.4 |                        20.0 |       26.4 |         91.8 |
| 3   | main-first   |                        32.9 |                        20.8 |       25.0 |         19.7 |
| 4   | worker-first |                        29.1 |                        20.7 |       19.2 |         18.2 |
| 5   | main-first   |                        28.6 |                        20.1 |       18.7 |         18.1 |
| 6   | worker-first |                        30.8 |                        20.1 |       19.8 |         20.2 |

단위 ms. Worker flush91.8ms 표본을 제외하지 않는다. 렌더 가속이 아니라 메인 차단 분리의 근거다. 매회 surface 생성이 포함되며 같은 surface를 유지하는 제품 성능과 다르다. observed wall 값은 종료 RAF 대기까지 포함하므로 제출 latency로 쓰지 않는다. 별도 decode 계측은 추가 검증 호출이고 contentMs도 replay decode를 포함한다. GPU timer/OS CPU/longtask 개수를 수집하지 않았다.

첫 탐색에서는 main 최초 flush466.9ms와 readback 약20ms를 관측했다. cold shader/context 차이가 있어 개선율로 쓰지 않았다. 후속 실행 하나는 페이지 reload로 결과가 사라졌고, 초기 RAF timestamp 기반 탐색 값도 최종 callback gap 근거에서 제외했다.

### 재현 파일과 검증

[최종 수치](evidence/worker-assets-20260907/result.json), [진단 source](evidence/worker-assets-20260907/probe.ts.txt), [Vite config](evidence/worker-assets-20260907/vite.config.mts.txt)를 보존했다. source/config를 각각 `.agent/worker-assets-probe.ts`, `.agent/worker-assets.config.mts`로 복사한 뒤 root에서 `pnpm -F @composition/builder exec vite build --config ../../.agent/worker-assets.config.mts`를 실행한다. config의 절대 경로는 로컬 checkout에 맞춘다. 출력 probe.js를 `.agent/worker-assets-bundle.js`로 복사하고 표시 중 Builder에서 해당 `/@fs/` module의 `runProbe(location.origin, 동일 module URL)`을 호출한다. HMR reload가 끝난 후 실행하고 품질 게이트와 측정은 겹치지 않게 한다. fixture는 사용자 문서를 변경하지 않는다. 실행 중 생성한 .agent 파일들은 제거했다.

- focused6파일103tests PASS; `codex:preflight` PASS; `gate:visual-parity` smoke101 PASS.
- Spec/catalog/CSS/Preview 변경 없음. 이번 검증은 Worker와 동일 main 실행기의 정합성이며 DOM↔Canvas 모든 효과 정합성을 새로 입증하지 않는다.
- 이번에 검증한 overlay는 선택 박스/핸들/치수/lasso이며 AI·snap·모든 편집 overlay나 대형 자산 부하까지 확대 해석하지 않는다.
- 다음 우선순위: project/session/boot/document/presentation/viewport/asset revision을 가진 요청과 실제 flush 응답의 일치 계약, stale ack·재진입·실패·dispose·resize/DPR/context loss 경합 검증. 이 계약 전에 제품 Worker 연결이나 readiness 변경을 하지 않는다.


## 실제 제품 경로 A/B와 철회

### 적용한 경로와 검증 범위

사용자 “적용해”와 “실제 효과가 없으면 제거” 조건으로 현재 Builder의 SkiaCanvas 진입점에 Worker 소유 SkiaRenderer를 연결했다. 사용자 화면의 HTML canvas를 OffscreenCanvas로 이전하고, 기존 content/standby/main surface·캐시·최종 합성/flush를 Worker에서 실행했다. 명령/이미지/폰트는 snapshot 전송, 오버레이 명령 생성과 Picture 직렬화는 main에 남긴 적용안이다. projectId/documentRevision/boot generation/session을 요청에 고정하고 실제 flush 응답에서 readiness를 처리했다. readiness를 timeout이나 가짜 수치로 통과시키지 않았다.

DEV Worker import는 React Fast Refresh의 `$RefreshSig$` 오류로 실패했다. 동일 Worker 소스를 별도 production 형식 번들로 빌드하여 DEV Builder의 실제 화면에 연결했다. SkiaRenderer의 개발용 snapshot policy가 window를 직접 읽는 추가 결합을 수정한 후 실제 제출이 성공했다. 이것은 **전체 production 앱 A/B가 아니라 DEV 앱 + 별도 번들 Worker** 검증이다. 실패한 초기화 시도는 아래 성공 표본에 포함하지 않는다.

테스트 URL의 `renderWorker=1/0`은 실제 화면 소유자를 바꾸는 임시 A/B 분기였다. 테스트 종료 후 이 분기와 번들 경로는 제거했다. context loss/resize/모든 편집 상태의 제품 승격 게이트까지 완결한 릴리스 구현으로 주장하지 않는다. 부트/기본 화면/휠 단계에서 채택 기준이 실패해 범위 확장을 중단했다.

### 실제 프로젝트 부트3쌍

동일 `ade5bcd8-aa1c-4a5a-a834-bc1b7b4dd993` 프로젝트, 표시 중 Chrome, viewport2349×1234, zoom53%. Worker→main 순서로 세 쌍을 실행했다. 브라우저/드라이버 캐시는 초기화하지 않았다. 준비 시간은 navigation time origin→matching flush로 readiness가 성공한 main mark이며, GPU presentation 완료나 scanout 시간이 아니다. perfMarks의 render.frame은 메인 JS 실행 구간이고 Worker 비용은 포함하지 않는다.

| 쌍 | main 준비(ms) | Worker 준비(ms) | main render.frame 최대(ms) | Worker 중 main render.frame 최대(ms) | main 렌더 귀속 long task(ms) |
|---|---:|---:|---:|---:|---:|
| 1 | 1514.6 | 1642.6 | 106.2 | 21.7 | 126 |
| 2 | 1389.3 | 1507.4 | 107.2 | 23.7 | 124 |
| 3 | 1497.9 | 1597.7 | 106.7 | 21.6 | 125 |

Worker 모드에는 이 render 귀속 long task가 없었지만 unclassified long task는 남았다. main draw 최대는103.1/104.0/101.6ms, Worker 중 main draw 최대는18.8/18.8/18.7ms였다. **메인 차단 감소 자체는 실제 효과**이며 이를 효과0이라고 기록하지 않는다.

초기 연결안은 준비 시간이 각쌍에서128.0/118.1/99.8ms 늦었다. Worker WASM 초기화를 main WASM/font 초기화와 중첩시킨 후에는1532.5/1501.6ms 두 표본을 추가 관측했다. 이를 초기3쌍과 섞어 최종 개선율로 계산하지 않는다. 초기화 조정 후에도 아래 휠 반응 악화가 확인되어 현재 적용안을 철회했다.

### 실제 화면 비교

main 첫 표본과 Worker 두 번째 표본의 Page.captureScreenshot을 browser ImageBitmap/Canvas2D로 디코드해 비교했다. 전체2349×1234×4 = **11,594,664바이트, 다른 채널0, 최대차0**. 실제 페이지 콘텐츠·선택 프레임·치수 라벨·헤더/도구 UI가 포함된 화면이다. 한 쌍의 정적 화면 검증이며 모든 애니메이션/이벤트/자산 정합성 증명으로 확대하지 않는다.

### 초기화 조정 후 실제 휠 입력6회씩

CDP Input.dispatchMouseEvent의 실제 mouseWheel을 Canvas 좌표1050,650에 전달했다. deltaY +80/-80 교대, 입력 사이1.6초, 입력 후0.3초에 제출 기록을 수집했다. synthetic DOM dispatchEvent로 대체하지 않았다. 관찰용 wheel capture listener가 입력 시작을 기록했다.

main은 실제 renderer.render가 flush 성공을 반환한 때, Worker는 실제 flush 뒤 submitted 응답을 main이 수신한 때를 기록했다. 따라서 Worker 값은 응답 전달 지연을 포함하며 Worker 내부 flush 시간과 같지 않다. 화면 scanout/INP를 측정한 것은 아니다. Worker6회 후 main6회 순서로 실행했으므로 랜덤 교차 통계라고 하지 않는다.

| 입력 | main 입력→제출(ms) | Worker 입력→제출 응답(ms) |
|---|---:|---:|
| 1 | 43.0 | 60.9 |
| 2 | 40.5 | 77.6 |
| 3 | 46.1 | 67.7 |
| 4 | 45.8 | 61.9 |
| 5 | 42.6 | 70.0 |
| 6 | 45.7 | 65.6 |

중앙값44.35→66.65ms(+22.30ms, 약50.3%). Worker main 전송 구간에는 codec snapshot·오버레이 기록/직렬화가 포함되고, 비동기 준비/합성/응답 경로가 추가된다. 이번 측정은 이 전체 경로의 반응 지연 증가를 입증하지만 각 비용의 독립 기여율까지 확정하지는 않는다. 성능이 더 나쁜 표본을 숨기거나 입력 반응이 개선됐다고 판단하지 않았다.

### 최종 판정과 제거 범위

현재 Worker 적용안은 “부트의 메인 차단 감소”에는 효과가 있었지만 “실제 입력 반응성 개선” 조건은 실패했다. 사용자 조건에 따라 제품 연결을 유지하지 않고 **Worker host/entry/protocol, commandSource 전송 메타데이터, codec/마스크 manifest/runtime 주입, Worker 전용 CanvasKit/font/Canvas2D 환경 분리 및 해당 테스트**를 제거했다. 생성 번들·임시 config·계측 mark도 제거했다. 제품 코드에서 관련 이름의 잔존 참조가0임을 검색했다.

기존 main SkiaRenderer, Picture/ping-pong 캐시, matching flush readiness, WOFF2→TTF 경로 및 Typeface 이름 직접 조회 최적화는 보존한다. 적용 직전 snapshot과 HEAD의 해당 파일 diff를 대조하여 도입 전용 변경만 되돌렸다. 현재 root의 제품 source diff는0이며 실험/철회 문서와 Changelog만 남는다. 이전 evidence의 source txt는 이력용 fixture이며 실행/제품 import 경로가 아니다.

Worker라는 기술 전반이 무효라는 결론이 아니다. 새 실측 근거와 더 작은 전송 경계 없이 같은 구조를 반복 도입하지 않는다. 현재 프로젝트 오픈 경고 전체가 해결됐다는 주장도 하지 않는다.

철회 후 검증: focused7파일134tests PASS, codex:preflight PASS, visual smoke101 PASS, git diff --check PASS. 기본 URL에서 준비 화면 종료·실제 콘텐츠/Styles 패널 표시·Worker 관련 resource0을 확인했다. main draw max101.8ms가 다시 관측되어 기존 렌더 지연은 남아 있다. 커밋/푸시하지 않았다.

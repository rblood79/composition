# ADR-203 — headed GPU 및 WebGL 조회 확인

- 날짜: 2026-09-05. 기존 Phase 1 + 일반 행 content memo 로컬 상태.
- 결과: **headed 3회에서 큰 stall은 재현되지 않았다.** 이전 `Surface.flush → getProgramParameter` 대기의 정확한 pname·셰이더 컴파일 원인은 미확정이다.
- 이번 작업은 측정·문서만 수행했다. 제품 코드·하니스 정본 수정, G1 승격, 캐시 예열·삭제는 하지 않았다.
- [측정·GPU·조회 근거 JSON](203-phase1/headed-gpu-probe.json), [이전 지연 귀속](203-repeated-raf-analysis.md).

## 환경과 방법

각 run마다 새 headed Chrome 152.0.7977.82 세션과 격리 프로젝트를 생성했다. 개발 서버 localhost:5173, viewport 1440×900, 60요소, Navigator+Properties, ID-only 선택 100ms 간격 20초다. Chrome 탭을 foreground로 이동했고 종료 시 document.visibilityState는 모두 visible이었다. CPU throttle은 적용하지 않았다. 측정끼리는 직렬 실행했다.

브라우저 `SystemInfo.getInfo`와 실제 WebGL context의 unmasked renderer가 모두 **Apple M4 Pro / ANGLE Metal**을 확인했다. RAF cadence는 약 **120Hz**였다. 새 브라우저 세션은 OS·GPU driver 셰이더 캐시까지 cold임을 보장하지 않는다.

임시 `/private/tmp/adr203-headed-gpu.mjs`에서 WebGL1/2의 `getProgramParameter`, `getShaderParameter`, `linkProgram`, `compileShader`를 감싸 호출 횟수와 2ms 초과 호출의 pname·결과·stack을 기록했다. 반환값은 원래 호출 결과를 그대로 전달했다. CDP GPU/timeline/V8 trace는 별도 수집했다. 2·3회차는 선택 측정 전 호출 수를 snapshot해 부팅과 선택 중 호출을 분리했다. 관찰 코드·trace 오버헤드가 있어 G1 하니스와 동일한 성능 조건은 아니다.

## 결과

| run | callback p95 / max | RAF timestamp p95 / max | 기존 >25ms 비율 | longtask | 2ms 초과 GL 호출 |
| --- | -----------------: | ----------------------: | --------------: | -------: | ---------------: |
| 1   |      12.1 / 20.8ms |            9.2 / 16.9ms |              0% |        0 |                0 |
| 2   |      12.0 / 21.4ms |            9.2 / 16.6ms |              0% |        0 |                0 |
| 3   |      12.7 / 21.3ms |            9.2 / 17.1ms |              0% |        0 |                0 |

page/console 오류는 세 run 모두 0이었다. 25ms는 기존 60Hz 하니스 기준을 보존한 값이다. 현재 120Hz에서 timestamp 최대가 약 17ms이므로 **25ms 초과 0을 프레임 누락 0으로 바꾸어 읽지 않는다.** GPU presentation 시각 자체를 측정한 결과도 아니다.

WebGL probe의 전체 호출 수는 각 run에서 프로그램 링크 33회, LINK_STATUS 조회 33회였다. 2·3회차의 선택 전 snapshot은 각각 32회로, **20초 선택 구간에서 추가 링크와 LINK_STATUS 조회는 각각 1회**였다. 셰이더 컴파일과 COMPILE_STATUS 조회는 각각 2회 증가했다. 매 선택마다 프로그램을 다시 링크한다는 근거는 없다.

첫 run GPU trace에서 `GLES2DecoderPassthroughImpl::DoLinkProgram`은 0.015ms, 두 `GLES2Implementation::GetShaderiv` 이벤트는 0.679/0.448ms였다. 이 fast path의 이벤트와 pname은 확인했지만, **과거 느린 getProgramParameter 호출도 LINK_STATUS였다고 소급할 수 없다.** 원래 느린 호출의 인자가 없고 이번 run에서는 느린 호출이 발생하지 않았다.

## headless 환경 해석 정정

측정 종료 후 동일 launch 옵션의 현재 headless Chrome에서도 `SystemInfo.getInfo`가 **M4 Pro / ANGLE Metal**을 보고했다. 따라서 `headless = SwiftShader`라는 일반화는 이 머신의 현재 조건에서 성립하지 않는다. 과거 stall run의 GPU 정보를 수집하지 않았으므로 과거 renderer를 확정할 수 없고, 이번 재현 실패를 소프트웨어→하드웨어 렌더러 전환 효과로 설명할 수도 없다. headed/headless 및 실제 GPU 정보·cadence를 각각 기록해야 한다.

## 판정과 다음 조사 경계

- 이전 큰 stall의 귀속은 **CanvasKit flush 내부 동기 WebGL 조회 대기**까지 유지한다. 셰이더 컴파일·링크가 그 대기의 원인이었는지는 아직 확정하지 못했다.
- 3개 새 세션의 20초 측정에서 미재현이므로, 지금 단계에서 CanvasKit 교체·강제 예열·캐시 리셋을 적용할 근거는 없다. 새 큰 stall이 재현될 때 느린 조회의 pname과 GPU 작업을 같은 구간에서 확보해야 한다.
- 이 결과로 기존 60Hz headless G1 실패 이력을 덮어쓰지 않는다. G1과 기존 DnD focus 등 parity 미종결 항목은 계속 열림이다.
- 반복해서 남는 짧은 callback 지연은 별도 React 작업이다. 기존 근거에 따라 Action Bar 모델 갱신·RAC context 작업의 남은 비용을 조사할 수 있으며, GPU stall 해결과 혼합하지 않는다.

원본 trace와 임시 driver는 `/private/tmp/adr203-headed-gpu*`에 있다. 장기 보존 산출물은 linked JSON의 run별 측정·probe·GPU 이벤트·trace SHA-256이다. 제품 코드 변경이 없어 제품 테스트는 재실행하지 않았으며 문서 포맷·guard·diff 검사를 수행했다.

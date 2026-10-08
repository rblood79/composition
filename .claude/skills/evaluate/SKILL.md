---
name: evaluate
description: 실행 중인 Builder의 사용자 흐름과 시각·상태 동기화를 브라우저로 검증할 때 사용.
argument-hint: [검증 대상 기능 + 완료 기준 (한 줄씩)]
---

# Builder 실동작 검증

요청한 완료 기준을 실제 브라우저에서 확인하고 PASS/FAIL과 재현 근거를 보고합니다.
기준이 없으면 변경에서 영향을 받는 사용자 흐름을 도출합니다.

현재 dev 서버와 대상 탭을 확인합니다. 포트나 특정 호스트의 MCP 도구 이름을
고정하지 않고 사용 가능한 브라우저 도구의 계약을 따릅니다. 로컬 실행이 요청 범위에
포함되면 기존 설정으로 서버를 실행해 확인합니다. 실행할 수 없으면 이유와 미검증 범위를 남깁니다.

## 진입과 입력

- 저장된 인증 세션으로 `/dashboard` 에 바로 들어갑니다. `/signin` 코드 입력은 하지 않습니다.
- 요소는 사용자 경로 (팔레트 클릭 · Properties 편집) 로 심습니다. store 를 직접 건드려 넣은
  요소는 문서에 실리지 않아 검증이 비어 버립니다.
- 스크립트로 반복할 흐름은 headed Playwright 하니스 `apps/builder/scripts/<주제>-live.mjs`
  (`BUILDER_URL` 로 대상 서버 지정) 에 둡니다.
- Compare Mode 에서는 축소된 Preview 의 좌표 클릭이 Builder 헤더에 막히므로 요소에
  직접 click 이벤트를 보냅니다. Preview 에서 누른 노드는 Builder 선택이 되어 다음 팔레트 추가가
  그 안으로 들어가고, Compare Mode 를 토글하면 iframe 이 교체되어 붙잡아 둔 참조가 죽습니다.

## 관찰

- Canvas·시각 결과는 foreground 또는 활성 RAF가 확인된 환경에서 측정합니다.
  hidden 탭의 stale overlay를 시각 근거로 사용하지 않습니다. Skia 캔버스 픽셀은 페이지 안에서
  읽을 수 없으므로 스크린샷을 찍어 분석하고, 픽셀 측정은 Compare Mode 를 끄고 합니다 (반폭 축소).
- 상태 변경은 Inspector·Canvas·Preview 반영과 Undo/Redo를 관련 범위에서 확인합니다.
- 컴포넌트 자식·slot·조건부 표시가 바뀌면 [RAC 조립 계약](../composition-patterns/rules/domain-rac-composition.md)의
  변경 범위 검증을 적용합니다. DOM 구조·상태 연결과 Canvas↔Preview 시각 판정을 구분합니다.
- 저장 관련 변경은 새로고침 후 hydration도 확인합니다.
- 시각 정합성은 `cross-check`를 사용하고, 동작 중 콘솔 오류와 키보드·focus도 살핍니다.

## 보고

관찰한 행동 → 결과 → 증거 경로를 남깁니다. 임의 가중 점수로 기능 실패를 상쇄하지 않습니다.
재시도는 실행별 증거 폴더를 사용해 첫 실패의 로그·결과·스크린샷을 덮어쓰지 않습니다.

결과는 ADR 의 `### Live Exercise` 절에 그대로 옮길 수 있는 형태로 적습니다 — 날짜 · 시나리오 ·
결과 (PASS/FAIL 수) · 수단 (Chrome MCP / Playwright / 사용자 confirm) · 콘솔 오류 수 ·
CPU throttle 상태 (사용자 Chrome 은 4x 가 걸려 있어 체감 수치가 하니스의 약 4배).
검증만 요청되면 보고하고, 수정까지 요청되면 발견한 범위의 문제도 해결합니다.

# Skia 폰트 형식 수정과 추정 최적화 철회

## 최종 변경

- 이번 세션의 미커밋 StylesPanel memo/shortcut 분리, shared useActiveScope, global shortcut host, CommandPalette 본문 재구성을 원복했다. 전용 Styles 회귀 파일도 제거했다.
- e53484739의 Picture timeout 분할과 전용 iterator/culling bridge/cache helper/tests를 제거했다. 같은 커밋에 섞인 ADR/연구 문서 변경은 되돌리지 않았다. Paragraph·overlay·surface 계측과 기존 readiness/캐시/RAF scheduler는 유지했다.
- 이름 조회 전용 FontMgr 재파싱을 Typeface.getFamilyName으로 대체한 수정은 유지했다.
- CanvasKit의 빌트인 Pretendard/Inter 입력은 동일 Variable 폰트의 TTF로 변경했다. DOM/CSS의 WOFF2는 유지한다. 기존 IDB의 동일 key/다른 URL은 getFromCache의 URL 비교로 교체된다.
- Worker 구현은 없으며 미확정 Worker 연결 계약 문서는 제거했다. 이전 조사 문서는 적용 상태가 아닌 이력으로 명시했다.

## 형식 대조

동일 브라우저/CanvasKit에서 원본 WOFF2와 이를 해제한 TTF를 순서대로 로드했다. 프로젝트 전체 A/B나 냉각 순서 무작위 반복 측정은 아니다.

| 폰트                | 형식  | FontMgr(ms) | provider 등록(ms) | Paragraph 400/700/900(ms) |
| ------------------- | ----- | ----------: | ----------------: | ------------------------- |
| Pretendard Variable | WOFF2 |       531.1 |              44.5 | 90.8 / 46.0 / 45.9        |
| Pretendard Variable | TTF   |         1.0 |               0.4 | 1.0 / 0.9 / 0.7           |
| Inter Variable      | WOFF2 |        77.6 |               6.4 | 13.9 / 7.0 / 7.0          |
| Inter Variable      | TTF   |         0.4 |               0.2 | 0.6 / 0.3 / 0.3           |

이 차이는 폰트 내용·굵기를 바꾸지 않은 컨테이너 형식 비교다. 변환 전후 head를 제외한 모든 폰트 테이블의 바이트가 같다. 실제 CanvasKit 회귀 테스트는 정식 FontWeight enum과 wght variation을 함께 사용해 400/700/900의 glyph width, paragraph width/height, 120px 줄바꿈 line metrics를 비교한다.

## 실제 부트와 한계

- DEV: collection max1.0ms, paragraph max17.2ms/p95 0.9ms, overlay max3.6ms. timeout 준비 경로는 삭제됐고 긴 fontManager/loadCustomFonts 콜백도 이 부트의 40ms 초과 기록에서 사라졌다.
- DEV의 첫 frame script90.6ms는 남았다. record content max39.7ms와 content flush max32.8ms가 관측됐지만 서로 다른 최대값을 합산하지 않는다.
- production `/private/tmp/composition-ttf-production` 빌드 성공, 같은 프로젝트 사본 부트 완료. IDBTransaction.oncomplete74.0ms, FrameRequestCallback102.8ms가 남았다. production에는 DEV label 분해가 없어 해당 전체 시간을 폰트나 GPU 단독으로 귀속하지 않는다.
- UI와 문서 폰트의 추가 분리 및 Worker는 적용하지 않았다. 먼저 해결해야 할 형식 비용을 제거한 뒤 남은 최초 record/flush와 React microtask를 재귀속해야 한다. 경고 전체 해결이 아니다.
- TTF 합계7,619,028 bytes, WOFF2 합계2,409,928 bytes. 네트워크 전송량 증가는 실제 배포의 HTTP 압축·첫 다운로드 조건에서 별도 검증해야 한다. 기존 폰트 binary cache는 유지한다.
- 미리 존재한 `compositionEngineWasm.ts`의 동시 사용자 변경은 보존했다.

## 검증

- focused4files33tests PASS; enum 타입 보정 뒤 실제 font parity2tests 재실행 PASS.
- 최종 codex:preflight PASS(type baseline0), production build PASS, diff-check PASS.
- text-axis gate가 git index에 남은 삭제 파일을 읽다가 실패해 현재 파일이 존재하는 소스만 읽도록 보정했다. 축22개 drift없음 확인.
- 재생성 도구: `scripts/prepare-skia-fonts.py` (fonttools4.64.0/brotli1.2.0, recalcTimestamp=False).
- 커밋/푸시 없음. DEV 원본 탭으로 복귀했고 임시 관찰자는 해제했다.

# 최초 Skia Picture 준비 분할 — 2026-09-07

상태: 구현·회귀 검증 완료, 최초 native long task와 RAF 경고는 잔존.
기준 소스: `3f439a793`. 측정은 Chrome foreground의 기존 localhost:5173 Builder 개발 모드다.
제품 성능의 production A/B 또는 모든 기기의 개선율로 일반화하지 않는다.

## 원인과 변경

`frameScheduler`는 단일 pending RAF를 합치는 정상 진입점이다. 최초 콘텐츠 렌더가
Picture miss 130건을 동기로 생성했다. 원래 세션의 record 4회 합계 365.1ms 중
최대 1회가 362.9ms였고, cache cold 130 / hit 390 / eviction 0이었다.

- `prepareColdPictures`: 기존 selfSpan record 경로로 cold 노드만 준비한다. 기존 캐시를
  퇴거시키지 않으며 content와 같은 padded viewport의 노드를 대상으로 한다.
- `createPicturePreparation`: 첫 작업부터 별도 task, 노드 사이 4ms 예산. FontCollection
  등록과 첫 Picture도 별도 작업이다. 단일 CanvasKit native 호출의 선점은 불가능하다.
- `SkiaCanvas`: 최초 제출·새 boot target·폰트 교체·context 복구에만 준비한다.
  camera-only/edit hot path에는 캐시 순회를 추가하지 않는다.
- 준비 key: renderer input/packet, registry/layout, font manager, page presentation,
  camera, surface 크기. task 재개 전에 현재 값과 비교하며 stale 작업은 취소하고 새 frame을 요청한다.
- hidden/context loss/unmount 취소. 실패한 native 작업은 완료로 위장하지 않으며,
  pending을 해제해 후속 복구 요청을 허용한다.
- 준비 완료가 readiness는 아니다. 기존 matching project/revision 실제 main surface
  flush 뒤 acknowledgment를 그대로 유지한다. renderer의 store 비의존도 유지한다.

## 실제 관측

아래는 CUA로 현재 DevTools의 `__composition_PERF__.snapshotAll()`을 읽은 값이다.
각 label의 최대값이므로 합산하지 않는다. 원본 세션과 수정 후 새로고침은 고정 A/B 쌍이 아니다.

| 구간                         | 원본 세션 최대 ms | 최종 새로고침 최대 ms | 최종 호출 수 |
| ---------------------------- | ----------------: | --------------------: | -----------: |
| render.frame                 |             461.0 |                 128.1 |            8 |
| render.content.build         |               2.4 |                   2.6 |            8 |
| render.plan.build            |               0.3 |                   0.3 |            8 |
| render.skia.draw             |             457.8 |                 127.8 |            2 |
| render.skia.record.content   |             362.9 |                  20.2 |            1 |
| render.skia.flush.content    |              32.0 |                  38.7 |            1 |
| render.skia.flush.main       |               5.7 |                   7.5 |            2 |
| render.prepare.picture       |            미계측 |                 118.0 |          130 |
| render.text.fontCollection   |            미계측 |                  51.8 |           67 |
| render.text.paragraph.build  |            미계측 |                   0.1 |           64 |
| render.text.paragraph.layout |            미계측 |                 114.5 |           64 |
| render.skia.surface.init     |            미계측 |                   0.6 |            1 |
| render.skia.overlay          |            미계측 |                  56.2 |            2 |

중간 구현에서 새로고침 RAF는 115/119/122.5ms였다. FontCollection과 Picture를
분리하기 전 task는 166~174ms였고, 최종 콘솔은 task 51/119ms, RAF 128ms였다.
이 값은 경고 완전 제거 또는 총 CPU 감소의 증거가 아니다.

## 검증

- 최종 focused 6파일 46 tests PASS, type-check baseline 0 PASS, diff-check PASS.
- 인접 회귀: task 예산, 최초 RAF 밖 실행, stale revision/font 취소, 교체/unmount 취소,
  warm fast path, native 실패 복구, prewarm 후 같은 Picture replay, viewport/volatile 제외,
  1024 capacity 보호, font/picture 별도 작업. 기존 scheduler·text·readiness 회귀 포함.
- `codex:preflight`: PASS (type baseline 0, registration 14, catalog FAIL/WARN 0,
  engine/text matrix drift 0). 이후 최종 변경은 scoped format/typecheck와 focused test 재검증.
- live: target project 일치, documentRevision 1, isCanvasReady=true, phase=ready.
  줌 33→50→33, compare mode의 Home CSS/Skia 화면과 Styles 390×844 확인.
  비교 종료 후 기존 Skia 모드·Styles 패널·33% 복원.
- context loss/restore: `{lost:true, restored:true, ready:true, newFlushes:1}`.
  복구 이후 새 main surface flush가 실제 발생했다.
- cross-check: catalog/spec·factory·CSS·Preview 스타일 입력은 변경 없음. Skia는 같은
  recordSelfSpan을 재생하며, Home의 버튼/텍스트/스피너 배치와 스타일을 양쪽 화면에서 육안 확인.
  전체 컴포넌트 pixel-diff 또는 production 측정은 수행하지 않았다.

## 잔여 병목과 재진입 조건

1. 첫 paragraph.layout의 약 115ms native 동기 호출은 노드 간 task 분할로 끊을 수 없다.
   화면 의미를 바꾸는 폰트/variation 제거는 하지 않았다. 동일 실제 문서의 production
   cold trace에서도 재현되면 font shaping/CanvasKit 실행을 Worker 소유로 옮기는 설계를 검토한다.
   단순 setTimeout 이동은 해결로 간주하지 않는다.
2. 첫 overlay 약 56ms와 content flush 약 39ms가 RAF에 남는다. overlay 내부 원인과
   제출 CPU/native 비용을 더 분해한 뒤 준비 단계 분리 또는 backend 변경 범위를 결정해야 한다.
   flush 측정은 GPU 완료 시간이 아니다.
3. capacity를 넘는 cold scene은 기존 동기 fallback이 남는다. 무제한 캐시 확장이나
   선준비 중 LRU thrash로 숨기지 않는다. 큰 문서에서는 viewport/retained surface 분할이 별도 과제다.

커밋·push 없음. 작업 중 외부에서 변경된 ADR-015/문서 이동은 이번 수정 범위에 포함하지 않는다.

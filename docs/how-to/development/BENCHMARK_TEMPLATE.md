# 스타일 패널 성능 벤치마크 기준선

> 이 문서는 스타일 패널 최적화의 성능 기준선(baseline)을 기록합니다.
> Phase 0에서 측정된 값을 기준으로 이후 최적화 효과를 비교합니다.

## 측정 환경

| 항목            | 값                  |
| --------------- | ------------------- |
| **측정 일자**   | YYYY-MM-DD          |
| **브라우저**    | Chrome XXX          |
| **OS**          | macOS / Windows     |
| **CPU**         | Apple M1 / Intel i7 |
| **RAM**         | 16GB                |
| **화면 해상도** | 2560x1440           |
| **요소 수**     | 100개               |

---

## 1. 스타일 패널 메트릭

### 1.1 리렌더링 횟수

| 시나리오                | 리렌더링 횟수 | 목표   |
| ----------------------- | ------------- | ------ |
| 요소 선택               | XX회          | < 10회 |
| width 속성 변경         | XX회          | < 5회  |
| backgroundColor 변경    | XX회          | < 5회  |
| 섹션 토글 (접기/펼치기) | XX회          | < 3회  |

### 1.2 스타일 계산 시간

| 메트릭   | 값 (ms) | SLO    |
| -------- | ------- | ------ |
| **평균** | XX.XX   | < 10ms |
| **P50**  | XX.XX   | < 8ms  |
| **P95**  | XX.XX   | < 16ms |
| **P99**  | XX.XX   | < 30ms |

### 1.3 섹션별 렌더링 시간

| 섹션              | 평균 (ms) | P95 (ms) |
| ----------------- | --------- | -------- |
| TransformSection  | XX.XX     | XX.XX    |
| LayoutSection     | XX.XX     | XX.XX    |
| AppearanceSection | XX.XX     | XX.XX    |
| TypographySection | XX.XX     | XX.XX    |

---

## 2. FPS 메트릭

| 메트릭                  | 값   | SLO    |
| ----------------------- | ---- | ------ |
| **평균 FPS**            | XX   | > 55   |
| **최소 FPS**            | XX   | > 30   |
| **최대 FPS**            | XX   | -      |
| **프레임 드롭 횟수**    | XX   | < 5%   |
| **Long Frame (> 33ms)** | XX회 | < 10회 |

---

## 3. 메모리 메트릭

| 메트릭                     | 값      | SLO          |
| -------------------------- | ------- | ------------ |
| **시작 시 힙 사용량**      | XX MB   | -            |
| **피크 힙 사용량**         | XX MB   | < 100MB 증가 |
| **측정 종료 시 힙 사용량** | XX MB   | -            |
| **메모리 증가량**          | XX MB   | < 50MB       |
| **메모리 증가율**          | XX MB/s | < 1MB/s      |
| **추정 GC 횟수**           | XX회    | -            |

---

## 4. 캔버스 동기화

| 메트릭   | 값 (ms) | SLO    |
| -------- | ------- | ------ |
| **평균** | XX.XX   | < 16ms |
| **P95**  | XX.XX   | < 32ms |

---

## 5. 입력 반응 시간

| 시나리오                      | 값 (ms) | SLO    |
| ----------------------------- | ------- | ------ |
| 텍스트 입력 → UI 반영         | XX      | < 16ms |
| 슬라이더 드래그 → 캔버스 반영 | XX      | < 32ms |
| 색상 선택 → 캔버스 반영       | XX      | < 50ms |

---

## 6. SLO 위반 사항

- [ ] 항목 1: 설명
- [ ] 항목 2: 설명

---

## 7. 측정 방법

### 7.1 콘솔 명령

> **2026-08-17 정정** — 종전에 여기 적혀 있던 `window.__perfTools.*` 절차는
> **동작하지 않는 상태로 남아 있었다**. 그 전역을 등록하던 `utils/performance/index.ts`
> 배럴을 아무 모듈도 import 하지 않아 파일 자체가 평가된 적이 없다 (실행 중인
> 빌더 실측: `__perfTools` / `__fpsMonitor` / `__memoryMonitor` /
> `__stylePanelMetrics` 전부 `undefined`). 해당 배럴과 모니터 3종은 삭제됐고,
> 아래가 현재 살아 있는 경로다.

```javascript
// 라벨별 duration 통계 (p50/p95/p99 + violation) — perfMarks.ts / ADR-069
window.__composition_PERF__.snapshot("input.pointerdown");
window.__composition_PERF__.snapshotAll();

// long task (browser task-level) 통계
window.__composition_PERF__.snapshotLongTasks();

// 시나리오 사이 초기화
window.__composition_PERF__.reset();
window.__composition_PERF__.resetLongTasks();
```

측정 지점은 `PERF_LABEL` 상수(`builder/utils/perfMarks.ts`)로 고정돼 있고,
새 지점은 `observe(PERF_LABEL.X, fn)` 로 감싸면 같은 버퍼에 들어간다.

FPS · 메모리 · Web Vitals · 컴포넌트별 메모리는 콘솔이 아니라 **Monitor 패널**이
담당한다 (`builder/panels/monitor/` — `useFPSMonitor` / `useMemoryStats` /
`useWebVitals` / `useComponentMemory`).

### 7.2 테스트 시나리오

1. **요소 선택 테스트**: 10개 요소를 순차적으로 선택
2. **속성 변경 테스트**: 각 섹션에서 5개 속성씩 변경
3. **드래그 테스트**: 슬라이더 10초간 연속 드래그
4. **섹션 토글 테스트**: 각 섹션 5회씩 접기/펼치기

---

## 8. 원시 데이터

<details>
<summary>JSON 보고서 (클릭하여 펼치기)</summary>

```json
{
  "generatedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "stylePanel": {
    "totalRenders": 0,
    "rendersBySection": {},
    "avgStyleCalcTime": 0,
    "p95StyleCalcTime": 0,
    "avgRenderTime": 0,
    "p95RenderTime": 0
  },
  "fps": {
    "avgFps": 0,
    "minFps": 0,
    "maxFps": 0,
    "frameDrops": 0,
    "longFrames": 0
  },
  "memory": {
    "currentMB": 0,
    "peakMB": 0,
    "baselineMB": null,
    "deltaMB": null,
    "estimatedGCCount": 0,
    "growthRateMBPerSec": 0
  },
  "duration": 0,
  "sloViolations": []
}
```

</details>

---

## 9. 비교 이력

| 날짜       | Phase    | 평균 FPS | 스타일 계산 P95 | 리렌더링 횟수 | 메모리 증가 |
| ---------- | -------- | -------- | --------------- | ------------- | ----------- |
| YYYY-MM-DD | Baseline | XX       | XX ms           | XX            | XX MB       |
| YYYY-MM-DD | Phase 1  | XX       | XX ms           | XX            | XX MB       |
| YYYY-MM-DD | Phase 2  | XX       | XX ms           | XX            | XX MB       |

---

## 10. 참고 사항

- Chrome DevTools Performance 탭에서 추가 프로파일링 권장
- React DevTools Profiler로 컴포넌트별 렌더링 시간 확인
- Memory 탭에서 힙 스냅샷 비교로 메모리 누수 확인

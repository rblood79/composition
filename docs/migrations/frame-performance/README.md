# 프레임 성능 조사 — 보존된 분석 노트 (2026-09-06 ~ 09-07)

> **원시 산출물은 2026-09-09 에 삭제했다** — `docs/migrations/evidence/` 아래 631MB / 539 파일
> (JSON trace 641MB 상당 · log · PNG · 일회성 하니스 스크립트 29종). gitignore 대상 로컬 파일이라
> 저장소 이력에는 없었다. 아래 5건은 결론을 담고 있어 추적 대상으로 옮겨 보존한다.

| 문서 | 내용 |
| --- | --- |
| [baseline.md](baseline.md) | 최초 기준선 |
| [wake-sources.md](wake-sources.md) | 입력·자원 경계 (wake 원인 분해) |
| [p1-measurements.md](p1-measurements.md) | P1 반복 실측 |
| [closure.md](closure.md) | 종결 검증 |
| [review-verification-findings.md](review-verification-findings.md) | 판독 검증 결과 |

## 지금 다시 재려면

일회성 하니스 대신 추적되는 정본을 쓴다.

```bash
pnpm perf:baseline -- --lane leak|frame     # apps/builder/scripts/perf-baseline.mjs
```

기준선 해석과 레버 순위는
[BUILDER_PERF_BASELINE_2026-09](../../explanation/research/BUILDER_PERF_BASELINE_2026-09.md) 가 정본이다.
설계 문서는 [react-skia-zustand-frame-performance-design](../../adr/react-skia-zustand-frame-performance-design.md).

## 원시 경로를 언급하는 문서

`docs/adr/evidence/frame-performance-*.md` 8건과
[builder-performance-priorities-20260907.md](../builder-performance-priorities-20260907.md) 는 본문에
`docs/migrations/evidence/frame-performance/<run>/` 경로를 적고 있다. 그 디렉토리는 더 이상 없다 —
각 문서에 남은 수치와 결론이 그 자리의 정본이다.

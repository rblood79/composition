# SaveService 리팩토링

**날짜**: 2025-10-09
**최종 업데이트**: 2025-12-29
**작업**: 서비스 레이어 구조 개선 및 로컬 우선 아키텍처 전환

## 개요

`SaveService`는 composition의 데이터 저장을 담당하는 핵심 서비스입니다.

### 아키텍처 변경 (2025-12-29)

**이전**: cloud 실시간 동기화 + 수동 저장 모드 지원
**현재**: IndexedDB 로컬 저장 전용 (Local-first)

## 현재 구조

```
src/
└── services/
    ├── save/
    │   ├── saveService.ts    # 로컬 저장 서비스
    │   └── index.ts
    └── index.ts
```

## SaveService API

### 핵심 메서드

```typescript
class SaveService {
  // 싱글톤 인스턴스
  static getInstance(): SaveService;

  // 속성 변경 저장 (IndexedDB 즉시 저장)
  async savePropertyChange(
    payload: SavePayload,
    options?: SaveOptions,
  ): Promise<void>;

  // 검증 오류 관리
  getValidationErrors(): ValidationError[];
  clearValidationErrors(): void;

  // 성능 메트릭
  getPerformanceMetrics(): PerformanceMetrics;
  getDetailedReport(): { metrics; validationErrors; summary };
  resetMetrics(): void;
}
```

### 타입 정의

```typescript
interface SavePayload {
  table: "elements" | "pages" | "projects";
  id: string;
  data: Record<string, unknown>;
}

interface SaveOptions {
  shouldSave?: boolean; // 저장 여부 (기본: true)
  source?: string; // 상호작용 소스
  recordHistory?: boolean; // 히스토리 기록 여부
  allowPreviewSaves?: boolean; // 프리뷰 저장 허용
  validateSerialization?: boolean; // 직렬화 검증
}
```

## 데이터 흐름

```
Inspector 속성 변경
    ↓
useSyncWithBuilder (debounce 100ms)
    ↓
updateElement() - Zustand 업데이트
    ↓
saveService.savePropertyChange()
    ↓
IndexedDB 즉시 저장 ✅
```

## 사용 예시

```typescript
import { saveService } from "../../services/save";

// 요소 속성 저장
await saveService.savePropertyChange({
  table: "elements",
  id: elementId,
  data: { props: newProps },
});

// 성능 메트릭 확인
const report = saveService.getDetailedReport();
console.log(report.summary);
```

## 개발자 도구

브라우저 콘솔에서 사용 가능:

```javascript
// 성능 보고서
window.saveServiceUtils.getReport();

// 메트릭 조회
window.saveServiceUtils.getMetrics();

// 검증 오류 조회
window.saveServiceUtils.getValidationErrors();

// 메트릭 리셋
window.saveServiceUtils.resetMetrics();
```

## 제거된 기능 (2025-12-29)

### 실시간/수동 모드

- `isRealtimeMode` 속성 제거
- `pendingChanges` Map 제거
- `saveAllPendingChanges()` 메서드 제거
- `syncToCloud()` 메서드 제거

### 관련 삭제 파일

- `src/builder/stores/saveMode.ts` - Save Mode 상태 관리

### Settings Panel 변경

- Save Mode 섹션 제거 (Auto/Manual 토글)

## 아키텍처 결정 배경

### Local-first 전환 이유

1. **오프라인 지원**: 네트워크 연결 없이도 작업 가능
2. **성능 향상**: 네트워크 지연 없이 즉시 저장
3. **단순화**: 실시간/수동 모드 분기 로직 제거
4. **신뢰성**: 로컬 저장 실패 가능성 최소화

### 향후 동기화

클라우드 동기화가 필요한 경우:

- 별도의 `SyncService` 구현 예정
- 명시적인 "클라우드에 업로드" 액션으로 제공
- 백그라운드 동기화 옵션 고려

## 관련 문서

- [CHANGELOG.md](../../CHANGELOG.md) - 변경 이력
- [DATA_ARCHITECTURE.md](../../explanation/architecture/DATA_ARCHITECTURE.md) - 데이터 아키텍처

## 마이그레이션 가이드

기존 코드에서 `saveMode` 관련 코드를 사용하고 있다면:

```typescript
// ❌ 제거됨
import { useSaveModeStore } from "../stores/saveMode";
const isRealtime = useSaveModeStore((s) => s.isRealtimeMode);

// ✅ 더 이상 필요 없음
// 모든 저장은 자동으로 IndexedDB에 즉시 저장됩니다
```

## 검증

- ✅ TypeScript 컴파일 에러 없음
- ✅ 모든 저장 작업 IndexedDB에 즉시 반영
- ✅ 성능 메트릭 정상 작동

# 프로젝트별 파일 모드 + 웹 브라우저 하이브리드 아키텍처

> **폐기 (2026-09-09)**: Electron 파일 모드를 전제한 2025-11 설계다. Electron 은 채택되지 않았고 ([ELECTRON_SETUP](ELECTRON_SETUP.md)), 인용된 `dashboard/` · `dialogs/` · `services/database/` 계층도 존재하지 않는다. 현행 저장 구조는 IndexedDB canonical + Cloud 인증 전용 ([ADR-128](../adr/completed/128-cloud-backend-decommission.md)). 기록 보존용.

**작성일**: 2025-11-07
**목적**: Electron 파일 모드와 웹 브라우저 접근의 완벽한 통합

---

## 🎯 아키텍처 개요

### 플랫폼별 동작 방식

```
┌─────────────────────────────────────────────────────────────────┐
│                        composition Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────┐        ┌────────────────────────┐   │
│  │   Electron Desktop     │        │    Web Browser         │   │
│  │  (파일 모드 + 동기화)  │        │  (클라우드 직접 접근)  │   │
│  └───────────┬────────────┘        └───────────┬────────────┘   │
│              │                                  │                │
│              │                                  │                │
│  ┌───────────▼────────────┐        ┌───────────▼────────────┐   │
│  │  Local .composition Files  │        │    (No Local Files)    │   │
│  │  ┌──────────────────┐  │        │                        │   │
│  │  │ MyWebsite.composition│  │        │    Direct Connection   │   │
│  │  │   (PGlite DB)    │◄─┼────────┼───────────┐            │   │
│  │  └──────────────────┘  │        │           │            │   │
│  │           │             │        │           │            │   │
│  │           │ Sync ☁️    │        │           │            │   │
│  │           │             │        │           │            │   │
│  └───────────┼─────────────┘        └───────────┼────────────┘   │
│              │                                  │                │
│              └──────────────┬───────────────────┘                │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Cloud        │
                    │   (Cloud DB)      │
                    │                   │
                    │  projects         │
                    │  pages            │
                    │  elements         │
                    │  design_tokens    │
                    └───────────────────┘
```

---

## ✅ 시나리오별 동작

### 시나리오 1: Electron → 웹 브라우저

```
1️⃣ Electron (사무실 PC)
   - MyWebsite.composition 생성
   - 페이지/컴포넌트 추가
   - Settings > Enable Cloud Sync ✅
   - 저장 → Cloud에 자동 업로드

2️⃣ 웹 브라우저 (집 또는 다른 PC)
   - https://composition.app 접속
   - 로그인
   - 프로젝트 목록에서 "MyWebsite" 확인 ✅
   - 웹에서 직접 편집 가능
   - 저장 → Cloud에 직접 저장

3️⃣ Electron (다음날)
   - MyWebsite.composition 열기
   - "Cloud version is newer. Sync now?" 알림
   - 동기화 → 웹에서 작업한 내용 다운로드 ✅
```

---

### 시나리오 2: 웹 브라우저 → Electron

```
1️⃣ 웹 브라우저
   - https://composition.app 접속
   - New Project 클릭
   - "Portfolio" 프로젝트 생성
   - 페이지/컴포넌트 추가
   - 저장 → Cloud에 직접 저장

2️⃣ Electron (나중에)
   - File > Open from Cloud
   - "Portfolio" 프로젝트 선택
   - 저장 위치 선택: ~/Documents/Portfolio.composition
   - 다운로드 → 로컬 파일 생성 ✅
   - 이후 Electron에서 작업 가능
```

---

### 시나리오 3: 폐쇄망 전용 (웹 접근 불가)

```
1️⃣ Electron (폐쇄망 PC)
   - MyProject.composition 생성
   - 동기화 비활성화 (기본값)
   - 완전 오프라인 작업
   - 로컬 파일로만 저장

2️⃣ 웹 브라우저
   - 접근 불가 ❌ (클라우드에 데이터 없음)
```

---

## 🏗️ 구현 세부사항

### 1. 프로젝트 식별자 (Project ID)

#### 1.1. Electron 파일 모드

```typescript
// MyWebsite.composition 파일 내부

// _project_metadata 테이블
{
  project_id: "abc-123-def-456",     // Cloud project.id와 동일
  sync_enabled: true,
  last_sync_at: "2025-11-07T10:30:00Z",
  local_updated_at: "2025-11-07T11:00:00Z",
  cloud_updated_at: "2025-11-07T10:30:00Z"
}

// projects 테이블
{
  id: "abc-123-def-456",             // 동일한 ID
  name: "MyWebsite",
  created_at: "2025-11-07T09:00:00Z",
  updated_at: "2025-11-07T11:00:00Z"
}
```

#### 1.2. Cloud (클라우드)

```typescript
// projects 테이블
{
  id: "abc-123-def-456",             // Electron과 동일한 ID
  name: "MyWebsite",
  created_by: "user-id",
  created_at: "2025-11-07T09:00:00Z",
  updated_at: "2025-11-07T10:30:00Z"
}

// pages, elements, design_tokens 등도 동일하게 매핑
```

**핵심: `project_id`가 양쪽에서 동일하므로 동기화 가능**

---

### 2. 웹 브라우저 구현 (기존 유지)

```typescript
// src/services/database/index.ts (웹 브라우저)

export async function getDatabase(): Promise<DbAdapter> {
  const envInfo = await detectEnvironment();

  if (envInfo.environment === "web") {
    // 웹 브라우저: Cloud 직접 연결
    return new CloudAdapter({
      url: import.meta.env.VITE_CLOUD_URL,
      anonKey: import.meta.env.VITE_CLOUD_ANON_KEY,
    });
  }

  // Electron: PGlite 파일 모드
  return currentProjectFile.getDb();
}
```

**웹 브라우저는 기존 방식 그대로 유지:**

- ✅ Cloud에 직접 연결
- ✅ 모든 프로젝트 목록 조회
- ✅ 실시간 협업 가능 (Cloud Realtime)

---

### 3. Electron + 웹 통합 시나리오

#### 3.1. 웹 프로젝트 목록에서 Electron 프로젝트 표시

```tsx
// Web: src/dashboard/ProjectList.tsx

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const db = await getDatabase();

    // Cloud에서 모든 프로젝트 조회
    const allProjects = await db.select("projects", {
      orderBy: [{ column: "updated_at", ascending: false }],
    });

    setProjects(allProjects);
  };

  return (
    <div className="project-list">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={() => openProject(project.id)}
        />
      ))}
    </div>
  );
}
```

**결과:**

- ✅ Electron에서 동기화한 프로젝트가 웹 목록에 표시됨
- ✅ 웹에서 생성한 프로젝트도 Electron에서 다운로드 가능

---

#### 3.2. Electron에서 웹 프로젝트 다운로드

```typescript
// Electron: File > Open from Cloud

ipcMain.handle("project:openFromCloud", async () => {
  // 1. 클라우드 프로젝트 목록 표시
  const cloudProjects = await CloudProjectsService.getAll();

  // 2. 사용자가 프로젝트 선택
  const selectedProject = await showProjectSelectionDialog(cloudProjects);

  if (!selectedProject) return { success: false };

  // 3. 저장 위치 선택
  const result = await dialog.showSaveDialog({
    title: "Download Project",
    defaultPath: `${selectedProject.name}.composition`,
    filters: [{ name: "composition Project", extensions: ["composition"] }],
  });

  if (result.canceled) return { success: false };

  // 4. 클라우드에서 다운로드
  const projectFile = await CloudProjectsService.download(
    selectedProject.id,
    result.filePath,
  );

  // 5. 프로젝트 열기
  const info = await projectFile.getInfo();

  return {
    success: true,
    projectInfo: info,
  };
});
```

---

#### 3.3. 웹에서 Electron 프로젝트 확인

```tsx
// Web: src/dashboard/ProjectCard.tsx

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="project-card">
      <h3>{project.name}</h3>
      <p>Last updated: {formatRelative(project.updated_at)}</p>

      {/* 동기화 상태 표시 */}
      <div className="sync-status">
        {project.sync_source === "electron" && (
          <span>💻 Synced from Desktop</span>
        )}
        {project.sync_source === "web" && <span>🌐 Created on Web</span>}
      </div>

      <button onClick={() => openProject(project.id)}>Open in Web</button>
    </div>
  );
}
```

---

### 4. 동기화 충돌 해결

#### 4.1. 충돌 감지

```typescript
// 충돌 시나리오:
// - Electron에서 11:00에 수정
// - 웹에서 11:05에 수정
// - Electron에서 11:10에 동기화 시도

export async function checkSyncConflict(
  projectId: string,
  localUpdatedAt: Date,
): Promise<SyncConflict | null> {
  const cloud = await getCloudClient();

  const { data: project } = await cloud
    .from("projects")
    .select("updated_at")
    .eq("id", projectId)
    .single();

  const cloudUpdatedAt = new Date(project.updated_at);

  // 양쪽 모두 수정됨 (1분 이상 차이)
  if (Math.abs(cloudUpdatedAt.getTime() - localUpdatedAt.getTime()) > 60000) {
    return {
      type: "conflict",
      localUpdatedAt,
      cloudUpdatedAt,
      message: "Both local and cloud versions have been modified",
    };
  }

  return null;
}
```

#### 4.2. 충돌 해결 전략

```typescript
export enum ConflictResolution {
  KEEP_LOCAL = "keep-local", // 로컬 우선 (클라우드 덮어쓰기)
  KEEP_CLOUD = "keep-cloud", // 클라우드 우선 (로컬 덮어쓰기)
  CREATE_COPY = "create-copy", // 복사본 생성
  MANUAL = "manual", // 수동 병합
}

export async function resolveConflict(
  projectFile: ProjectFile,
  resolution: ConflictResolution,
): Promise<void> {
  switch (resolution) {
    case ConflictResolution.KEEP_LOCAL:
      // 로컬 → 클라우드 강제 업로드
      await projectFile.syncToCloud();
      break;

    case ConflictResolution.KEEP_CLOUD:
      // 클라우드 → 로컬 강제 다운로드
      await projectFile.syncFromCloud();
      break;

    case ConflictResolution.CREATE_COPY:
      // 로컬 파일을 "MyProject (Conflict Copy).composition"로 저장
      const info = await projectFile.getInfo();
      const copyPath = info.filePath.replace(
        ".composition",
        " (Conflict Copy).composition",
      );
      fs.copyFileSync(info.filePath, copyPath);

      // 원본은 클라우드 버전으로 교체
      await projectFile.syncFromCloud();
      break;

    case ConflictResolution.MANUAL:
      // UI에서 사용자가 직접 병합
      // TODO: 구현 필요
      break;
  }
}
```

#### 4.3. 충돌 UI (Electron)

```tsx
// src/dialogs/SyncConflictDialog.tsx

export function SyncConflictDialog({ conflict }: { conflict: SyncConflict }) {
  return (
    <dialog>
      <h2>⚠️ Sync Conflict Detected</h2>
      <p>This project has been modified in multiple locations:</p>

      <div className="conflict-info">
        <div className="local-version">
          <h3>💻 Local Version</h3>
          <p>Last modified: {formatDateTime(conflict.localUpdatedAt)}</p>
        </div>

        <div className="cloud-version">
          <h3>☁️ Cloud Version</h3>
          <p>Last modified: {formatDateTime(conflict.cloudUpdatedAt)}</p>
        </div>
      </div>

      <div className="actions">
        <button onClick={() => resolve(ConflictResolution.KEEP_LOCAL)}>
          Use Local Version
        </button>
        <button onClick={() => resolve(ConflictResolution.KEEP_CLOUD)}>
          Use Cloud Version
        </button>
        <button onClick={() => resolve(ConflictResolution.CREATE_COPY)}>
          Keep Both (Create Copy)
        </button>
      </div>
    </dialog>
  );
}
```

---

## 📊 플랫폼별 기능 비교

| 기능                 | Electron (파일 모드) | 웹 브라우저      |
| -------------------- | -------------------- | ---------------- |
| **프로젝트 생성**    | ✅ .composition 파일 | ✅ Cloud 직접    |
| **프로젝트 열기**    | ✅ 파일 선택         | ✅ 목록 선택     |
| **오프라인 작업**    | ✅ 완전 지원         | ❌ 인터넷 필수   |
| **파일 공유**        | ✅ USB/이메일        | ❌ 링크만 가능   |
| **동기화**           | ✅ 선택적            | ✅ 항상 (실시간) |
| **협업**             | ⚠️ 동기화 필요       | ✅ 실시간        |
| **백업**             | ✅ 파일 복사         | ✅ 클라우드 자동 |
| **버전 관리**        | ✅ Git 가능          | ❌ 불가능        |
| **프로젝트 간 전환** | ⚠️ 파일 열기         | ✅ 빠름          |

---

## 🎯 통합 데이터 흐름

### 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 시나리오                       │
└─────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
           ▼                                 ▼
┌─────────────────────┐         ┌─────────────────────┐
│  Electron Desktop   │         │   Web Browser       │
│  (파일 모드)        │         │   (클라우드 모드)   │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │ 1. Create Project             │ 1. Create Project
           │    MyWebsite.composition          │    "Portfolio"
           │                               │
           │ 2. Enable Sync ✅             │ 2. Auto Saved to
           │                               │    Cloud ✅
           │ 3. Sync to Cloud              │
           │    (Upload)                   │
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │    Cloud DB        │
           │                       │
           │  - MyWebsite (abc-123)│
           │  - Portfolio (def-456)│
           └───────────┬───────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐
│  Electron           │ │  Web                │
│  (다른 PC)          │ │  (어디서나)         │
│                     │ │                     │
│  Open from Cloud ✅ │ │  Project List ✅    │
│  → Download         │ │  → Open & Edit      │
│  → Edit Locally     │ │  → Auto Save        │
│  → Sync Back        │ │                     │
└─────────────────────┘ └─────────────────────┘
```

---

## ✅ 구현 체크리스트

### Phase 1: 프로젝트 파일 시스템 (1-2일)

- [ ] ProjectFile 클래스 구현
- [ ] Local-only 모드 (동기화 비활성화)
- [ ] File > New, Open, Save 메뉴

### Phase 2: 클라우드 동기화 (1-2일)

- [ ] Enable/Disable Sync 기능
- [ ] syncToCloud() / syncFromCloud() 구현
- [ ] 충돌 감지 로직

### Phase 3: 웹 브라우저 통합 (1일)

- [ ] 웹에서 프로젝트 목록 조회 (기존 유지)
- [ ] Electron 동기화 프로젝트 표시
- [ ] 프로젝트 메타데이터 표시

### Phase 4: Cross-Platform 기능 (1-2일)

- [ ] Electron: Open from Cloud
- [ ] Electron: Upload to Cloud
- [ ] 충돌 해결 UI
- [ ] 동기화 상태 표시

### Phase 5: 테스트 (1-2일)

- [ ] Electron → 웹 동기화 테스트
- [ ] 웹 → Electron 다운로드 테스트
- [ ] 충돌 시나리오 테스트
- [ ] 오프라인/온라인 전환 테스트

**총 예상 시간: 5-8일**

---

## 🎉 최종 결론

### ✅ 웹 브라우저 접근 100% 가능

**프로젝트별 파일 모드를 구현해도 웹 브라우저 접근은 완벽하게 작동합니다:**

1. **Electron 전용 프로젝트** (동기화 비활성화)
   - ❌ 웹 접근 불가 (로컬 전용)
   - ✅ 폐쇄망 환경에 적합

2. **Electron + 웹 공유 프로젝트** (동기화 활성화)
   - ✅ Electron에서 .composition 파일로 작업
   - ✅ 웹에서 클라우드 직접 작업
   - ✅ 양방향 동기화

3. **웹 전용 프로젝트**
   - ✅ 웹에서 생성
   - ✅ 필요 시 Electron으로 다운로드

### 🎯 최고의 조합

이 아키텍처는 **두 가지 장점을 모두 제공**합니다:

- ✅ Electron: 파일 기반 관리 (오프라인, 공유, 백업)
- ✅ 웹: 클라우드 직접 접근 (협업, 접근성)

---

**작성자**: Claude Code
**작성일**: 2025-11-07
**버전**: 1.0.0

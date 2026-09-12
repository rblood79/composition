# 프로젝트별 파일 모드 + 온라인 동기화 아키텍처

**작성일**: 2025-11-07
**목적**: composition의 프로젝트별 파일 시스템과 온라인 동기화 구현 가이드

---

## 🎯 아키텍처 개요

### 프로젝트 파일 구조

```
사용자 PC (로컬)                     클라우드 (Cloud)
├── Documents/                        ├── projects
│   ├── MyWebsite.composition            │   ├── project-1 (MyWebsite)
│   │   ├── project_id: abc-123      │   ├── project-2 (Portfolio)
│   │   ├── pages (5개)              │   └── project-3 (EcommerceStore)
│   │   ├── elements (100개)         │
│   │   └── design_tokens (50개)     ├── pages (project-1의 페이지)
│   │                                 ├── elements (project-1의 요소)
│   ├── Portfolio.composition            └── design_tokens (project-1의 토큰)
│   │   └── project_id: def-456
│   │
│   └── EcommerceStore.composition
│       └── project_id: ghi-789
```

---

## 📁 프로젝트 파일 구조 (.composition)

### .composition 파일 = PGlite 데이터베이스

```typescript
// .composition 파일의 메타데이터 테이블
interface ProjectMetadata {
  project_id: string; // Cloud project ID (동기화용)
  sync_status: "local-only" | "synced" | "conflict";
  last_sync_at: Date | null;
  cloud_updated_at: Date | null;
  local_updated_at: Date;
  sync_enabled: boolean; // 사용자가 온라인 동기화 활성화 여부
}
```

---

## 🔄 동기화 시나리오

### 시나리오 1: 폐쇄망 (완전 오프라인)

```
사용자 작업:
1. File > New Project
2. MyWebsite.composition 파일 생성
3. 페이지/컴포넌트 추가
4. 저장 (Cmd+S) → 로컬 파일만 업데이트

동기화: ❌ 비활성화
파일: ✅ 로컬에만 존재
```

---

### 시나리오 2: 인터넷 연결 + 동기화 활성화

```
사용자 작업:
1. File > New Project
2. MyWebsite.composition 파일 생성
3. Settings > Enable Cloud Sync ✅
4. 페이지/컴포넌트 추가
5. 저장 (Cmd+S) → 로컬 + 클라우드 동시 저장

동기화: ✅ 활성화
파일: ✅ 로컬 + 클라우드 모두 존재
```

---

### 시나리오 3: 여러 PC에서 동일 프로젝트 작업

```
PC 1 (사무실):
1. MyWebsite.composition 작업
2. 저장 → 클라우드 동기화

PC 2 (집):
1. File > Open from Cloud
2. MyWebsite 프로젝트 선택
3. MyWebsite.composition 다운로드
4. 작업 후 저장 → 클라우드 동기화

PC 1 (다음날):
1. MyWebsite.composition 열기
2. "Cloud version is newer. Sync now?" 알림
3. 클라우드 → 로컬 동기화
```

---

## 🏗️ 구현 아키텍처

### 1. 프로젝트 파일 시스템

#### 1.1. ProjectFile 클래스

```typescript
// src/services/database/projectFile.ts

export interface ProjectFileInfo {
  filePath: string; // /Users/name/Documents/MyWebsite.composition
  projectId: string; // abc-123 (Cloud project ID)
  projectName: string; // MyWebsite
  lastModified: Date;
  fileSize: number;
  syncStatus: "local-only" | "synced" | "conflict" | "pending";
  syncEnabled: boolean;
}

export class ProjectFile {
  private db: PGlite | null = null;
  private filePath: string;
  private metadata: ProjectMetadata | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Create new project file
   */
  static async create(
    filePath: string,
    projectName: string,
  ): Promise<ProjectFile> {
    const projectFile = new ProjectFile(filePath);

    // PGlite 인스턴스 생성
    projectFile.db = new PGlite(filePath);

    // 스키마 초기화
    await projectFile.initializeSchema();

    // 프로젝트 생성
    const projectId = uuidv4();
    await projectFile.db.insert("projects", {
      id: projectId,
      name: projectName,
    });

    // 메타데이터 생성
    await projectFile.db.insert("_project_metadata", {
      project_id: projectId,
      sync_status: "local-only",
      sync_enabled: false,
      local_updated_at: new Date(),
    });

    console.log(`✅ Project file created: ${filePath}`);

    return projectFile;
  }

  /**
   * Open existing project file
   */
  static async open(filePath: string): Promise<ProjectFile> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project file not found: ${filePath}`);
    }

    const projectFile = new ProjectFile(filePath);
    projectFile.db = new PGlite(filePath);
    await projectFile.db.initialize();

    // 메타데이터 로드
    projectFile.metadata = await projectFile.loadMetadata();

    // 클라우드 동기화 체크 (백그라운드)
    if (projectFile.metadata.sync_enabled) {
      projectFile.checkCloudSync();
    }

    return projectFile;
  }

  /**
   * Save project (local only)
   */
  async save(): Promise<void> {
    // 모든 변경사항 커밋
    await this.db!.query("VACUUM");

    // 메타데이터 업데이트
    await this.db!.query("UPDATE _project_metadata SET local_updated_at = $1", [
      new Date(),
    ]);

    console.log(`✅ Project saved: ${this.filePath}`);
  }

  /**
   * Get project info
   */
  async getInfo(): Promise<ProjectFileInfo> {
    const stats = fs.statSync(this.filePath);
    const project = await this.db!.select("projects", { limit: 1 });

    return {
      filePath: this.filePath,
      projectId: this.metadata!.project_id,
      projectName: project[0].name,
      lastModified: stats.mtime,
      fileSize: stats.size,
      syncStatus: this.metadata!.sync_status,
      syncEnabled: this.metadata!.sync_enabled,
    };
  }

  /**
   * Enable cloud sync
   */
  async enableSync(): Promise<void> {
    if (!(await hasInternetAccess())) {
      throw new Error("No internet connection");
    }

    // 메타데이터 업데이트
    await this.db!.query("UPDATE _project_metadata SET sync_enabled = $1", [
      true,
    ]);

    this.metadata!.sync_enabled = true;

    // 초기 동기화
    await this.syncToCloud();

    console.log("✅ Cloud sync enabled");
  }

  /**
   * Disable cloud sync
   */
  async disableSync(): Promise<void> {
    await this.db!.query("UPDATE _project_metadata SET sync_enabled = $1", [
      false,
    ]);

    this.metadata!.sync_enabled = false;

    console.log("✅ Cloud sync disabled");
  }

  /**
   * Sync to cloud (push)
   */
  async syncToCloud(): Promise<void> {
    if (!this.metadata!.sync_enabled) {
      throw new Error("Cloud sync is disabled");
    }

    console.log("🔄 Syncing to cloud...");

    // 프로젝트 데이터 조회
    const project = await this.db!.select("projects", { limit: 1 });
    const pages = await this.db!.select("pages");
    const elements = await this.db!.select("elements");
    const themes = await this.db!.select("design_themes");
    const tokens = await this.db!.select("design_tokens");

    // Cloud에 업로드
    const cloud = await getCloudClient();

    await cloud.from("projects").upsert(project);
    await cloud.from("pages").upsert(pages);
    await cloud.from("elements").upsert(elements);
    await cloud.from("design_themes").upsert(themes);
    await cloud.from("design_tokens").upsert(tokens);

    // 메타데이터 업데이트
    await this.db!.query(
      `UPDATE _project_metadata SET
       sync_status = $1,
       last_sync_at = $2,
       cloud_updated_at = $2`,
      ["synced", new Date()],
    );

    console.log("✅ Synced to cloud");
  }

  /**
   * Sync from cloud (pull)
   */
  async syncFromCloud(): Promise<void> {
    if (!this.metadata!.sync_enabled) {
      throw new Error("Cloud sync is disabled");
    }

    console.log("🔄 Syncing from cloud...");

    const cloud = await getCloudClient();
    const projectId = this.metadata!.project_id;

    // 클라우드 데이터 조회
    const { data: pages } = await cloud
      .from("pages")
      .select("*")
      .eq("project_id", projectId);

    const pageIds = pages.map((p) => p.id);
    const { data: elements } = await cloud
      .from("elements")
      .select("*")
      .in("page_id", pageIds);

    const { data: themes } = await cloud
      .from("design_themes")
      .select("*")
      .eq("project_id", projectId);

    const themeIds = themes.map((t) => t.id);
    const { data: tokens } = await cloud
      .from("design_tokens")
      .select("*")
      .in("theme_id", themeIds);

    // 로컬 데이터 교체
    await this.db!.transaction(async (tx) => {
      await tx.query("DELETE FROM design_tokens");
      await tx.query("DELETE FROM design_themes");
      await tx.query("DELETE FROM elements");
      await tx.query("DELETE FROM pages");

      if (pages.length > 0) await tx.insert("pages", pages);
      if (elements.length > 0) await tx.insert("elements", elements);
      if (themes.length > 0) await tx.insert("design_themes", themes);
      if (tokens.length > 0) await tx.insert("design_tokens", tokens);
    });

    // 메타데이터 업데이트
    await this.db!.query(
      `UPDATE _project_metadata SET
       sync_status = $1,
       last_sync_at = $2`,
      ["synced", new Date()],
    );

    console.log("✅ Synced from cloud");
  }

  /**
   * Check if cloud version is newer
   */
  async checkCloudSync(): Promise<{
    cloudNewer: boolean;
    localNewer: boolean;
    conflict: boolean;
  }> {
    if (!this.metadata!.sync_enabled) {
      return { cloudNewer: false, localNewer: false, conflict: false };
    }

    const cloud = await getCloudClient();
    const { data: project } = await cloud
      .from("projects")
      .select("updated_at")
      .eq("id", this.metadata!.project_id)
      .single();

    if (!project) {
      return { cloudNewer: false, localNewer: false, conflict: false };
    }

    const cloudUpdatedAt = new Date(project.updated_at);
    const localUpdatedAt = this.metadata!.local_updated_at;

    const cloudNewer = cloudUpdatedAt > localUpdatedAt;
    const localNewer = localUpdatedAt > cloudUpdatedAt;
    const conflict =
      Math.abs(cloudUpdatedAt.getTime() - localUpdatedAt.getTime()) > 60000; // 1분 이상 차이

    return { cloudNewer, localNewer, conflict };
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    // 기존 migrations.ts의 스키마 사용
    const { MIGRATIONS } = await import("./migrations");

    for (const migration of MIGRATIONS) {
      await this.db!.query(migration.sql);
    }

    // 프로젝트 메타데이터 테이블 추가
    await this.db!.query(`
      CREATE TABLE IF NOT EXISTS _project_metadata (
        project_id UUID PRIMARY KEY,
        sync_status TEXT DEFAULT 'local-only',
        sync_enabled BOOLEAN DEFAULT FALSE,
        last_sync_at TIMESTAMPTZ,
        cloud_updated_at TIMESTAMPTZ,
        local_updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  /**
   * Load metadata
   */
  private async loadMetadata(): Promise<ProjectMetadata> {
    const result = await this.db!.query(
      "SELECT * FROM _project_metadata LIMIT 1",
    );

    if (result.length === 0) {
      throw new Error("Project metadata not found");
    }

    return result[0] as ProjectMetadata;
  }

  /**
   * Close project file
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
```

---

### 2. Recent Projects 관리

```typescript
// src/services/database/recentProjects.ts

interface RecentProject {
  filePath: string;
  projectName: string;
  lastOpened: Date;
  projectId?: string;
  syncEnabled?: boolean;
}

export class RecentProjectsService {
  private static STORAGE_KEY = "composition-recent-projects";
  private static MAX_RECENT = 10;

  /**
   * Add project to recent list
   */
  static add(filePath: string, projectName: string, projectId?: string): void {
    const recent = this.getAll();

    // 중복 제거
    const filtered = recent.filter((p) => p.filePath !== filePath);

    // 맨 앞에 추가
    filtered.unshift({
      filePath,
      projectName,
      lastOpened: new Date(),
      projectId,
    });

    // 최대 개수 제한
    const limited = filtered.slice(0, this.MAX_RECENT);

    // 저장
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limited));
  }

  /**
   * Get all recent projects
   */
  static getAll(): RecentProject[] {
    const data = localStorage.getItem(this.STORAGE_KEY);

    if (!data) {
      return [];
    }

    const recent = JSON.parse(data) as RecentProject[];

    // 파일 존재 여부 확인
    return recent.filter((p) => fs.existsSync(p.filePath));
  }

  /**
   * Remove project from recent list
   */
  static remove(filePath: string): void {
    const recent = this.getAll();
    const filtered = recent.filter((p) => p.filePath !== filePath);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Clear all recent projects
   */
  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
```

---

### 3. Cloud Projects 관리

```typescript
// src/services/database/cloudProjects.ts

export interface CloudProject {
  id: string;
  name: string;
  updated_at: Date;
  page_count: number;
  element_count: number;
  hasLocalCopy: boolean;
  localFilePath?: string;
}

export class CloudProjectsService {
  /**
   * Get all projects from cloud
   */
  static async getAll(): Promise<CloudProject[]> {
    const cloud = await getCloudClient();

    // 프로젝트 목록 조회
    const { data: projects } = await cloud
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    // 각 프로젝트의 페이지/요소 개수 조회
    const cloudProjects: CloudProject[] = [];

    for (const project of projects) {
      const { count: pageCount } = await cloud
        .from("pages")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);

      const { data: pages } = await cloud
        .from("pages")
        .select("id")
        .eq("project_id", project.id);

      const pageIds = pages.map((p) => p.id);

      const { count: elementCount } = await cloud
        .from("elements")
        .select("*", { count: "exact", head: true })
        .in("page_id", pageIds);

      // 로컬 복사본 확인
      const recent = RecentProjectsService.getAll();
      const localCopy = recent.find((r) => r.projectId === project.id);

      cloudProjects.push({
        id: project.id,
        name: project.name,
        updated_at: new Date(project.updated_at),
        page_count: pageCount || 0,
        element_count: elementCount || 0,
        hasLocalCopy: !!localCopy,
        localFilePath: localCopy?.filePath,
      });
    }

    return cloudProjects;
  }

  /**
   * Download project from cloud
   */
  static async download(
    projectId: string,
    filePath: string,
  ): Promise<ProjectFile> {
    const cloud = await getCloudClient();

    // 프로젝트 조회
    const { data: project } = await cloud
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      throw new Error("Project not found in cloud");
    }

    // 로컬 프로젝트 파일 생성
    const projectFile = await ProjectFile.create(filePath, project.name);

    // 클라우드에서 데이터 가져오기
    const { data: pages } = await cloud
      .from("pages")
      .select("*")
      .eq("project_id", projectId);

    const pageIds = pages.map((p) => p.id);
    const { data: elements } = await cloud
      .from("elements")
      .select("*")
      .in("page_id", pageIds);

    const { data: themes } = await cloud
      .from("design_themes")
      .select("*")
      .eq("project_id", projectId);

    const themeIds = themes.map((t) => t.id);
    const { data: tokens } = await cloud
      .from("design_tokens")
      .select("*")
      .in("theme_id", themeIds);

    // 로컬 파일에 데이터 저장
    await projectFile.db!.transaction(async (tx) => {
      if (pages.length > 0) await tx.insert("pages", pages);
      if (elements.length > 0) await tx.insert("elements", elements);
      if (themes.length > 0) await tx.insert("design_themes", themes);
      if (tokens.length > 0) await tx.insert("design_tokens", tokens);
    });

    // 동기화 활성화
    await projectFile.enableSync();

    console.log(`✅ Project downloaded: ${filePath}`);

    return projectFile;
  }

  /**
   * Upload project to cloud
   */
  static async upload(projectFile: ProjectFile): Promise<void> {
    await projectFile.enableSync();
    await projectFile.syncToCloud();
  }

  /**
   * Delete project from cloud
   */
  static async delete(projectId: string): Promise<void> {
    const cloud = await getCloudClient();

    // CASCADE로 모든 관련 데이터 삭제
    await cloud.from("projects").delete().eq("id", projectId);

    console.log(`✅ Project deleted from cloud: ${projectId}`);
  }
}
```

---

## 🖥️ Electron 메뉴 통합

```typescript
// electron/main.ts

import { ProjectFile } from "../src/services/database/projectFile";
import { RecentProjectsService } from "../src/services/database/recentProjects";
import { CloudProjectsService } from "../src/services/database/cloudProjects";

let currentProject: ProjectFile | null = null;

// ============================================
// File Menu Handlers
// ============================================

// File > New Project
ipcMain.handle("project:new", async () => {
  const result = await dialog.showSaveDialog({
    title: "Create New Project",
    defaultPath: "MyProject.composition",
    filters: [{ name: "composition Project", extensions: ["composition"] }],
  });

  if (!result.canceled) {
    // 기존 프로젝트 닫기
    if (currentProject) {
      await currentProject.close();
    }

    // 새 프로젝트 생성
    currentProject = await ProjectFile.create(result.filePath, "My Project");

    // 최근 목록 추가
    const info = await currentProject.getInfo();
    RecentProjectsService.add(
      result.filePath,
      info.projectName,
      info.projectId,
    );

    return { success: true, projectInfo: info };
  }

  return { success: false };
});

// File > Open Project
ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open Project",
    filters: [{ name: "composition Project", extensions: ["composition"] }],
    properties: ["openFile"],
  });

  if (!result.canceled) {
    // 기존 프로젝트 닫기
    if (currentProject) {
      await currentProject.close();
    }

    // 프로젝트 열기
    currentProject = await ProjectFile.open(result.filePaths[0]);

    // 최근 목록 추가
    const info = await currentProject.getInfo();
    RecentProjectsService.add(
      result.filePaths[0],
      info.projectName,
      info.projectId,
    );

    // 클라우드 동기화 체크
    const syncCheck = await currentProject.checkCloudSync();

    return {
      success: true,
      projectInfo: info,
      syncCheck,
    };
  }

  return { success: false };
});

// File > Open Recent
ipcMain.handle("project:openRecent", async (_event, filePath: string) => {
  // 기존 프로젝트 닫기
  if (currentProject) {
    await currentProject.close();
  }

  // 프로젝트 열기
  currentProject = await ProjectFile.open(filePath);

  // 최근 목록 업데이트
  const info = await currentProject.getInfo();
  RecentProjectsService.add(filePath, info.projectName, info.projectId);

  return { success: true, projectInfo: info };
});

// File > Save
ipcMain.handle("project:save", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  await currentProject.save();

  // 자동 동기화 (옵션)
  const info = await currentProject.getInfo();
  if (info.syncEnabled) {
    await currentProject.syncToCloud();
  }

  return { success: true };
});

// File > Save As
ipcMain.handle("project:saveAs", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  const result = await dialog.showSaveDialog({
    title: "Save Project As",
    defaultPath: "MyProject.composition",
    filters: [{ name: "composition Project", extensions: ["composition"] }],
  });

  if (!result.canceled) {
    // 파일 복사
    const currentInfo = await currentProject.getInfo();
    fs.copyFileSync(currentInfo.filePath, result.filePath);

    // 새 파일 열기
    await currentProject.close();
    currentProject = await ProjectFile.open(result.filePath);

    // 최근 목록 추가
    const newInfo = await currentProject.getInfo();
    RecentProjectsService.add(
      result.filePath,
      newInfo.projectName,
      newInfo.projectId,
    );

    return { success: true, projectInfo: newInfo };
  }

  return { success: false };
});

// File > Close Project
ipcMain.handle("project:close", async () => {
  if (currentProject) {
    await currentProject.save();
    await currentProject.close();
    currentProject = null;
  }

  return { success: true };
});

// ============================================
// Cloud Menu Handlers
// ============================================

// Cloud > Enable Sync
ipcMain.handle("project:enableSync", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  await currentProject.enableSync();

  return { success: true };
});

// Cloud > Disable Sync
ipcMain.handle("project:disableSync", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  await currentProject.disableSync();

  return { success: true };
});

// Cloud > Sync Now
ipcMain.handle("project:syncNow", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  const syncCheck = await currentProject.checkCloudSync();

  if (syncCheck.cloudNewer) {
    // 클라우드가 최신
    const choice = await dialog.showMessageBox({
      type: "question",
      title: "Cloud Sync",
      message: "The cloud version is newer. What would you like to do?",
      buttons: ["Download from Cloud", "Upload to Cloud", "Cancel"],
      defaultId: 0,
    });

    if (choice.response === 0) {
      await currentProject.syncFromCloud();
      return { success: true, action: "downloaded" };
    } else if (choice.response === 1) {
      await currentProject.syncToCloud();
      return { success: true, action: "uploaded" };
    }
  } else {
    // 로컬이 최신
    await currentProject.syncToCloud();
    return { success: true, action: "uploaded" };
  }

  return { success: false };
});

// Cloud > Download Project
ipcMain.handle(
  "project:downloadFromCloud",
  async (_event, projectId: string) => {
    const result = await dialog.showSaveDialog({
      title: "Download Project",
      defaultPath: "MyProject.composition",
      filters: [{ name: "composition Project", extensions: ["composition"] }],
    });

    if (!result.canceled) {
      // 기존 프로젝트 닫기
      if (currentProject) {
        await currentProject.close();
      }

      // 클라우드에서 다운로드
      currentProject = await CloudProjectsService.download(
        projectId,
        result.filePath,
      );

      // 최근 목록 추가
      const info = await currentProject.getInfo();
      RecentProjectsService.add(
        result.filePath,
        info.projectName,
        info.projectId,
      );

      return { success: true, projectInfo: info };
    }

    return { success: false };
  },
);

// Cloud > Upload Project
ipcMain.handle("project:uploadToCloud", async () => {
  if (!currentProject) {
    throw new Error("No project is open");
  }

  await CloudProjectsService.upload(currentProject);

  return { success: true };
});

// Cloud > View All Projects
ipcMain.handle("project:listCloud", async () => {
  const projects = await CloudProjectsService.getAll();
  return projects;
});

// ============================================
// Recent Projects
// ============================================

ipcMain.handle("project:getRecent", async () => {
  return RecentProjectsService.getAll();
});

ipcMain.handle("project:clearRecent", async () => {
  RecentProjectsService.clear();
  return { success: true };
});
```

---

## 🎨 UI 구현

### Welcome Screen

```tsx
// src/welcome/WelcomeScreen.tsx

export function WelcomeScreen() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);

  useEffect(() => {
    loadRecent();
    loadCloud();
  }, []);

  const loadRecent = async () => {
    const projects = await window.electron.project.getRecent();
    setRecentProjects(projects);
  };

  const loadCloud = async () => {
    if (await hasInternetAccess()) {
      const projects = await window.electron.project.listCloud();
      setCloudProjects(projects);
    }
  };

  return (
    <div className="welcome-screen">
      <header>
        <h1>Welcome to composition</h1>
        <p>Create beautiful websites with ease</p>
      </header>

      <section className="actions">
        <button onClick={handleNewProject}>
          <FileIcon /> New Project
        </button>
        <button onClick={handleOpenProject}>
          <FolderOpenIcon /> Open Project
        </button>
      </section>

      <section className="recent-projects">
        <h2>Recent Projects</h2>
        {recentProjects.map((project) => (
          <div
            key={project.filePath}
            className="project-card"
            onClick={() => handleOpenRecent(project.filePath)}
          >
            <FileIcon />
            <div>
              <h3>{project.projectName}</h3>
              <p>{project.filePath}</p>
              <small>Last opened: {formatRelative(project.lastOpened)}</small>
            </div>
            {project.syncEnabled && <CloudIcon />}
          </div>
        ))}
      </section>

      <section className="cloud-projects">
        <h2>Cloud Projects</h2>
        {cloudProjects.map((project) => (
          <div key={project.id} className="project-card">
            <CloudIcon />
            <div>
              <h3>{project.name}</h3>
              <p>
                {project.page_count} pages · {project.element_count} elements
              </p>
              <small>Updated: {formatRelative(project.updated_at)}</small>
            </div>
            {project.hasLocalCopy ? (
              <button onClick={() => handleOpenRecent(project.localFilePath!)}>
                Open Local
              </button>
            ) : (
              <button onClick={() => handleDownloadProject(project.id)}>
                Download
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
```

### Project Settings

```tsx
// src/builder/settings/ProjectSettings.tsx

export function ProjectSettings() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState("local-only");

  const handleToggleSync = async () => {
    if (syncEnabled) {
      await window.electron.project.disableSync();
      setSyncEnabled(false);
    } else {
      await window.electron.project.enableSync();
      setSyncEnabled(true);
    }
  };

  const handleSyncNow = async () => {
    const result = await window.electron.project.syncNow();
    if (result.success) {
      alert(`Sync completed: ${result.action}`);
    }
  };

  return (
    <div className="project-settings">
      <h2>Project Settings</h2>

      <section>
        <h3>Cloud Sync</h3>
        <label>
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={handleToggleSync}
          />
          Enable Cloud Sync
        </label>
        {syncEnabled && (
          <>
            <p>Status: {syncStatus}</p>
            <button onClick={handleSyncNow}>Sync Now</button>
          </>
        )}
      </section>
    </div>
  );
}
```

---

## 📊 동기화 전략 비교

| 전략               | 장점                   | 단점                     | 추천     |
| ------------------ | ---------------------- | ------------------------ | -------- |
| **수동 동기화**    | 사용자 제어, 충돌 최소 | 동기화 잊을 수 있음      | ⭐⭐⭐   |
| **자동 동기화**    | 편리, 항상 최신        | 충돌 위험, 네트워크 비용 | ⭐⭐     |
| **저장 시 동기화** | 균형적                 | 저장 속도 느려질 수 있음 | ⭐⭐⭐⭐ |

**권장: 저장 시 동기화 + 수동 동기화 옵션**

---

## ✅ 최종 구현 체크리스트

- [ ] ProjectFile 클래스 구현 (1-2일)
- [ ] RecentProjectsService 구현 (4-6시간)
- [ ] CloudProjectsService 구현 (1일)
- [ ] Electron 메뉴 통합 (1일)
- [ ] Welcome Screen UI (1일)
- [ ] Project Settings UI (4-6시간)
- [ ] 동기화 충돌 해결 UI (1일)
- [ ] 테스트 (1-2일)

**총 예상 시간: 5-7일**

---

## 🎯 다음 단계

1. ProjectFile 클래스 구현
2. 기본 메뉴 통합 (New, Open, Save)
3. Recent Projects 구현
4. Cloud Sync 구현 (옵션)

구현을 시작하시겠습니까?

---

**작성자**: Claude Code
**작성일**: 2025-11-07
**버전**: 1.0.0

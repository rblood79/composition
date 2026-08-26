import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { getDB } from "../lib/db";
import { getDefaultProps } from "../types/builder/unified.types";
import { ElementProps } from "../types/integrations/supabase.types";
import { ElementUtils } from "../utils/element/elementUtils";
import { supabase } from "../env/supabase.client";
import {
  Button,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import {
  Button as AriaButton,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import type { Key } from "react-aria-components";
import { useAsyncMutation } from "../builder/hooks/useAsyncMutation";
import { useKeyboardShortcutsRegistry } from "../builder/hooks/useKeyboardShortcutsRegistry";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  LayoutTemplate,
  List as ListIcon,
  Moon,
  MoreHorizontal,
  Monitor,
  Search,
  Sun,
} from "lucide-react";
import { historyIndexedDB } from "../builder/stores/history/historyIndexedDB";
import { useUiStore, type ThemeMode } from "../stores/uiStore";
import { createInitialProjectDocument } from "./createInitialProjectDocument";
import type { ProjectListItem } from "../types/dashboard.types";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";
import "./index.css";
import { ACTION_ICONS } from "../builder/config/actionIcons";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

// (ADR-128) cloud `projects` row schema 의 잔재. local-only dashboard 가
// IndexedDB project 를 표현할 때만 사용.
interface LocalProject {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateProjectRequest {
  name: string;
}

type ScopeKey = "recents" | "all";
type ViewKey = "grid" | "list";
type SortKey = "edited" | "created" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  edited: "Last edited",
  created: "Created",
  name: "Name",
};

/** Recents 창 — 이 기간 안에 편집된 프로젝트만 Recents 스코프에 남는다. */
const RECENTS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function formatRelativeTime(date: Date | undefined | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function formatAbsoluteDate(date: Date | undefined | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw new Error(`Session error: ${error.message}`);
  if (!session?.user) throw new Error("No authenticated user found");
  return session.user.id;
}

/**
 * 프로젝트 썸네일 자리.
 *
 * 실제 캔버스 렌더 썸네일은 Skia 오프스크린 캡처 경로가 있어야 만들 수 있다.
 * 그전까지는 **중립 플레이스홀더**를 그린다 — 그럴듯한 가짜 미리보기를 그리면
 * 프로젝트마다 다른 내용이 있는 것처럼 읽혀서 목록을 잘못 훑게 된다.
 */
function ProjectThumbPlaceholder({ size = 32 }: { size?: number }) {
  return <LayoutTemplate size={size} strokeWidth={1.25} aria-hidden />;
}

/** 카드/행 공통 오버플로 메뉴 — 상시 노출되던 파괴적 버튼을 여기로 모았다. */
function ProjectOverflowMenu({
  projectName,
  isDisabled,
  onOpen,
  onDelete,
}: {
  projectName: string;
  isDisabled: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <MenuTrigger>
      <AriaButton
        className="react-aria-Button project-card-menu"
        aria-label={`Actions for ${projectName}`}
        isDisabled={isDisabled}
      >
        <MoreHorizontal size={14} aria-hidden />
      </AriaButton>
      <Popover
        className="header-menu-popover"
        placement="bottom end"
        offset={4}
        containerPadding={0}
      >
        <Menu
          className="header-menu"
          onAction={(key: Key) => {
            if (key === "open") onOpen();
            if (key === "delete") onDelete();
          }}
        >
          <MenuItem id="open" className="header-menu-item">
            <ExternalLink size={14} />
            <span>Open</span>
          </MenuItem>
          <MenuItem
            id="delete"
            className="header-menu-item project-menu-item-delete"
          >
            <DeleteIcon size={14} />
            <span>Delete</span>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** 프로젝트 카드 — 카드 전체가 열기 액션, 오버플로 메뉴는 버튼 밖 형제. */
function ProjectCard({
  project,
  loading,
  onOpen,
  onDelete,
}: {
  project: ProjectListItem;
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="project-card">
      <AriaButton
        className="react-aria-Button project-card-open"
        isDisabled={loading}
        onPress={() => onOpen(project.id)}
      >
        <span className="project-card-thumb">
          <ProjectThumbPlaceholder />
        </span>
        <span className="project-card-body">
          <span className="project-card-title">{project.name}</span>
          <span className="project-card-meta">
            {formatRelativeTime(project.lastModified)}
          </span>
        </span>
      </AriaButton>

      <ProjectOverflowMenu
        projectName={project.name}
        isDisabled={loading}
        onOpen={() => onOpen(project.id)}
        onDelete={() => onDelete(project.id)}
      />
    </div>
  );
}

/** 리스트 뷰 행 — 그리드와 같은 데이터의 두 번째 뷰. */
function ProjectRow({
  project,
  loading,
  onOpen,
  onDelete,
}: {
  project: ProjectListItem;
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="projects-row">
      <AriaButton
        className="react-aria-Button projects-row-open"
        isDisabled={loading}
        onPress={() => onOpen(project.id)}
      >
        <span className="projects-row-name">
          <span className="projects-row-glyph">
            <ProjectThumbPlaceholder size={14} />
          </span>
          <span>{project.name}</span>
        </span>
        <span className="projects-row-cell">
          {formatAbsoluteDate(project.createdAt)}
        </span>
        <span className="projects-row-cell">
          {formatRelativeTime(project.lastModified)}
        </span>
      </AriaButton>

      <ProjectOverflowMenu
        projectName={project.name}
        isDisabled={loading}
        onOpen={() => onOpen(project.id)}
        onDelete={() => onDelete(project.id)}
      />
    </div>
  );
}

/** 로딩 스켈레톤 — 카드 그리드와 같은 형상. */
function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton" aria-hidden>
      <div className="project-card-skeleton-thumb" />
      <div className="project-card-skeleton-body">
        <div className="project-card-skeleton-line" />
        <div className="project-card-skeleton-line is-short" />
      </div>
    </div>
  );
}

/**
 * 생성 진입점 — 그리드 첫 칸.
 *
 * 시안에는 이름 입력이 없지만 이름 없이 만들면 되돌릴 방법이 없다 (rename 기능 없음).
 * 그래서 타일을 누르면 그 자리에서 입력으로 바뀌는 형태로 둔다 — 별도 다이얼로그 없이
 * 기존 생성 흐름을 그대로 유지한다.
 */
function CreateProjectTile({
  isEditing,
  value,
  isBusy,
  inputRef,
  onStart,
  onChange,
  onSubmit,
  onCancel,
}: {
  isEditing: boolean;
  value: string;
  isBusy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onStart: () => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  if (!isEditing) {
    return (
      <AriaButton
        className="react-aria-Button project-create-tile"
        onPress={onStart}
        isDisabled={isBusy}
      >
        <span className="project-create-tile-icon">
          <AddIcon size={18} aria-hidden />
        </span>
        <span className="project-create-tile-label">New project</span>
        <span className="project-create-tile-hint">
          Starts with a blank page
        </span>
      </AriaButton>
    );
  }

  return (
    <form
      className="project-create-tile is-editing"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="project-create-tile-label" htmlFor="new-project-name">
        Project name
      </label>
      <input
        id="new-project-name"
        ref={inputRef}
        className="project-create-input"
        value={value}
        placeholder="Untitled"
        autoComplete="off"
        disabled={isBusy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="project-create-actions">
        <Button
          type="button"
          variant="secondary"
          fillStyle="outline"
          size="sm"
          onPress={onCancel}
          isDisabled={isBusy}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="sm"
          isDisabled={isBusy || !value.trim()}
          isLoading={isBusy}
        >
          Create
        </Button>
      </div>
    </form>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  // 목록을 읽은 시각. Recents 창을 렌더 중 `Date.now()` 로 계산하면 리렌더마다
  // 경계가 흔들려 순수성 규칙을 깬다 — 로드 시점에 한 번 고정한다.
  const [listedAt, setListedAt] = useState(0);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeKey>("recents");
  const [view, setView] = useState<ViewKey>("grid");
  const [sort, setSort] = useState<SortKey>("edited");

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // 빌더와 같은 테마 설정을 쓴다 (`stores/uiStore` — localStorage 영속).
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);

  // 빌더 chrome 테마.
  //
  // `data-builder-theme` 는 색 선택 외에 **"빌더 chrome 이 mount 중"** 이라는 뜻도 겸한다 —
  // builder-system.css 의 portal fallback(`#root` 밖 body 자식)이 이걸 게이트로 쓴다.
  // 대시보드도 이제 빌더 chrome 이므로 여기서 세우고 unmount 시 지운다 (BuilderCore 와 동형).
  // auth 라우트는 세우지 않으므로 종전대로 빌더 팔레트를 받지 않는다.
  useEffect(() => {
    const apply = (theme: "light" | "dark") => {
      document.documentElement.setAttribute("data-builder-theme", theme);
    };
    const clear = () => {
      document.documentElement.removeAttribute("data-builder-theme");
    };

    if (themeMode !== "auto") {
      apply(themeMode);
      return clear;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      apply(e.matches ? "dark" : "light");
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      clear();
    };
  }, [themeMode]);

  // ⌘K / Ctrl+K — 검색으로 이동. (전체 커맨드 팔레트는 별도 작업)
  useKeyboardShortcutsRegistry([
    {
      key: "k",
      modifier: "cmd",
      allowInInput: true,
      handler: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
    },
  ]);

  const fetchProjects = useCallback(async (): Promise<ProjectListItem[]> => {
    const db = await getDB();
    const localProjectsRaw = await db.projects.getAll();
    return localProjectsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      storage: { local: true, cloud: false },
      sync: { status: "local-only" },
      createdAt: new Date(p.created_at ?? Date.now()),
      lastModified: new Date(p.updated_at ?? Date.now()),
    }));
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await fetchProjects());
      setListedAt(Date.now());
    } catch (error) {
      console.error("[Dashboard] 프로젝트 로드 실패:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [fetchProjects]);

  useEffect(() => {
    let cancelled = false;
    void fetchProjects()
      .then((loadedProjects) => {
        if (cancelled) return;
        setProjects(loadedProjects);
        setListedAt(Date.now());
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("[Dashboard] 프로젝트 로드 실패:", error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProjects]);

  const createProjectMutation = useAsyncMutation<
    LocalProject,
    CreateProjectRequest
  >(
    async ({ name }) => {
      const db = await getDB();
      const userId = await getCurrentUserId();

      const newProject: LocalProject = {
        id: ElementUtils.generateId(),
        name: name.trim(),
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.projects.insert(newProject);

      const homePageId = ElementUtils.generateId();
      const homePage = {
        id: homePageId,
        project_id: newProject.id,
        title: "Home",
        slug: "/",
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const bodyElement = {
        id: ElementUtils.generateId(),
        type: "body",
        props: getDefaultProps("body") as ElementProps,
        parent_id: null,
        page_id: homePageId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const initialDocument = createInitialProjectDocument(
        homePage,
        bodyElement,
      );

      await db.documents.put(newProject.id, initialDocument);

      return newProject;
    },
    {
      onSuccess: (newProject) => {
        setNewProjectName("");
        setIsCreating(false);
        setIsLoadingProjects(true);
        void loadProjects();
        navigate(`/builder/${newProject.id}`);
      },
    },
  );

  const deleteProjectMutation = useAsyncMutation<void, string>(
    async (id) => {
      const db = await getDB();
      const document = await db.documents.get(id);
      const pages = document
        ? deriveProjectRenderModelFromDocument(document, id).pages
        : [];

      for (const page of pages) {
        await historyIndexedDB.clearPageHistory(page.id);
      }

      const collections = await db.collections.getByProject(id);
      for (const dataTable of collections) {
        await db.collections.delete(dataTable.id);
      }

      const apiEndpoints = await db.api_endpoints.getByProject(id);
      for (const endpoint of apiEndpoints) {
        await db.api_endpoints.delete(endpoint.id);
      }

      const variables = await db.variables.getByProject(id);
      for (const variable of variables) {
        await db.variables.delete(variable.id);
      }

      await db.documents.delete(id);
      await db.projects.delete(id);
    },
    {
      onSuccess: () => {
        setIsLoadingProjects(true);
        void loadProjects();
      },
    },
  );

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    void createProjectMutation.execute({ name: newProjectName }).catch((err) => {
      console.error("프로젝트 생성 에러:", err);
    });
  };

  const startCreating = () => {
    setIsCreating(true);
    window.requestAnimationFrame(() => createInputRef.current?.focus());
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm("정말로 이 프로젝트를 삭제하시겠습니까?")) return;
    void deleteProjectMutation.execute(id).catch((err) => {
      console.error("프로젝트 삭제 에러:", err);
    });
  };

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = listedAt - RECENTS_WINDOW_MS;
    return projects
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (scope === "recents" && p.lastModified.getTime() < cutoff)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "created")
          return b.createdAt.getTime() - a.createdAt.getTime();
        return b.lastModified.getTime() - a.lastModified.getTime();
      });
  }, [projects, query, scope, sort, listedAt]);

  const loading =
    isLoadingProjects ||
    createProjectMutation.isLoading ||
    deleteProjectMutation.isLoading;

  const error = createProjectMutation.error || deleteProjectMutation.error;
  const isBusy = createProjectMutation.isLoading;
  const hasNoProjectsAtAll = !isLoadingProjects && projects.length === 0;
  const openProject = (id: string) => navigate(`/builder/${id}`);

  const createTile = (
    <CreateProjectTile
      isEditing={isCreating}
      value={newProjectName}
      isBusy={isBusy}
      inputRef={createInputRef}
      onStart={startCreating}
      onChange={setNewProjectName}
      onSubmit={handleCreateProject}
      onCancel={() => {
        setIsCreating(false);
        setNewProjectName("");
      }}
    />
  );

  return (
    // `data-context="builder"` — 대시보드는 빌더 chrome 이다. 이 속성이 없으면
    // builder-system 토큰이 안 걸리고 preview-system 의 tint 팔레트로 렌더된다.
    <div className="dashboard" data-context="builder">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="dashboard-logo">
            <img src="/appIcon.svg" alt="" aria-hidden />
          </span>
          <h1 className="dashboard-title">composition</h1>
        </div>

        <div className="builder-viewport-controls">
          <div className="dashboard-search">
            <Search size={14} aria-hidden />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              placeholder="Search projects"
              aria-label="Search projects"
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="dashboard-kbd">⌘K</kbd>
          </div>
        </div>

        <div className="dashboard-actions">
          <div className="builder-viewport-controls">
            <ToggleButtonGroup
              className="builder-control-group"
              aria-label="Builder theme"
              selectionMode="single"
              disallowEmptySelection
              indicator
              selectedKeys={new Set([themeMode])}
              onSelectionChange={(keys: Set<Key>) => {
                const next = Array.from(keys)[0];
                if (next) setThemeMode(next as ThemeMode);
              }}
            >
              <ToggleButton id="light" aria-label="Light theme">
                <Sun size={16} aria-hidden />
              </ToggleButton>
              <ToggleButton id="dark" aria-label="Dark theme">
                <Moon size={16} aria-hidden />
              </ToggleButton>
              <ToggleButton id="auto" aria-label="Match system theme">
                <Monitor size={16} aria-hidden />
              </ToggleButton>
            </ToggleButtonGroup>
          </div>

          <Button
            className="dashboard-create-button"
            variant="accent"
            size="md"
            isDisabled={loading}
            onPress={startCreating}
          >
            <AddIcon size={16} aria-hidden />
            New project
          </Button>
        </div>
      </header>

      <div className="dashboard-body">
        <nav className="dashboard-rail">
          <ToggleButtonGroup
            className="builder-control-group"
            aria-label="Project scope"
            orientation="vertical"
            selectionMode="single"
            disallowEmptySelection
            indicator
            selectedKeys={new Set([scope])}
            onSelectionChange={(keys: Set<Key>) => {
              const next = Array.from(keys)[0];
              if (next) setScope(next as ScopeKey);
            }}
          >
            <ToggleButton id="recents" aria-label="Recents">
              <Clock size={16} aria-hidden />
            </ToggleButton>
            <ToggleButton id="all" aria-label="All projects">
              <FolderOpen size={16} aria-hidden />
            </ToggleButton>
          </ToggleButtonGroup>
        </nav>

        <main className="dashboard-main">
          <div className="dashboard-toolbar">
            <div className="dashboard-scope">
              <h2 className="dashboard-scope-title">
                {scope === "recents" ? "Recents" : "All projects"}
              </h2>
              <span className="dashboard-scope-meta">
                {visibleProjects.length} project
                {visibleProjects.length === 1 ? "" : "s"}
                {scope === "recents" ? " edited in the last 30 days" : ""}
              </span>
            </div>

            <div className="dashboard-toolbar-controls">
              <div className="builder-viewport-controls">
                <MenuTrigger>
                  <AriaButton
                    className="react-aria-Button dashboard-sort-trigger"
                    aria-label="Sort projects"
                  >
                    <span className="dashboard-sort-label">Sort</span>
                    <span className="dashboard-sort-value">
                      {SORT_LABEL[sort]}
                    </span>
                    <ChevronDown size={12} aria-hidden />
                  </AriaButton>
                  <Popover
                    className="header-menu-popover"
                    placement="bottom end"
                    offset={4}
                    containerPadding={0}
                  >
                    <Menu
                      className="header-menu"
                      onAction={(key: Key) => setSort(key as SortKey)}
                    >
                      <MenuItem id="edited" className="header-menu-item">
                        <span>{SORT_LABEL.edited}</span>
                      </MenuItem>
                      <MenuItem id="created" className="header-menu-item">
                        <span>{SORT_LABEL.created}</span>
                      </MenuItem>
                      <MenuItem id="name" className="header-menu-item">
                        <span>{SORT_LABEL.name}</span>
                      </MenuItem>
                    </Menu>
                  </Popover>
                </MenuTrigger>
              </div>

              <div className="builder-viewport-controls">
                <ToggleButtonGroup
                  className="builder-control-group"
                  aria-label="View"
                  selectionMode="single"
                  disallowEmptySelection
                  indicator
                  selectedKeys={new Set([view])}
                  onSelectionChange={(keys: Set<Key>) => {
                    const next = Array.from(keys)[0];
                    if (next) setView(next as ViewKey);
                  }}
                >
                  <ToggleButton id="grid" aria-label="Grid view">
                    <LayoutGrid size={16} aria-hidden />
                  </ToggleButton>
                  <ToggleButton id="list" aria-label="List view">
                    <ListIcon size={16} aria-hidden />
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </div>
          </div>

          {error && (
            <div className="dashboard-error">
              <Badge variant="negative" size="md" fillStyle="subtle">
                {error.message}
              </Badge>
            </div>
          )}

          {isLoadingProjects && projects.length === 0 ? (
            <div className="projects-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : hasNoProjectsAtAll ? (
            <div className="dashboard-empty">
              <FolderOpen size={48} strokeWidth={1} aria-hidden />
              <p className="dashboard-empty-title">No projects yet</p>
              <p className="dashboard-empty-description">
                Create your first project to get started
              </p>
              <Button
                className="dashboard-create-button"
                variant="accent"
                size="md"
                onPress={startCreating}
              >
                <AddIcon size={16} aria-hidden />
                New project
              </Button>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="dashboard-empty">
              <Search size={48} strokeWidth={1} aria-hidden />
              <p className="dashboard-empty-title">No matching projects</p>
              <p className="dashboard-empty-description">
                {query
                  ? `Nothing matches “${query}” in this scope`
                  : "Nothing was edited in the last 30 days"}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="projects-grid">
              {createTile}
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  loading={loading}
                  onOpen={openProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          ) : (
            <>
              {isCreating && (
                <div className="projects-create-strip">{createTile}</div>
              )}
              <div className="projects-table">
                <div className="projects-table-head">
                  <span>Name</span>
                  <span>Created</span>
                  <span>Last edited</span>
                  <span />
                </div>
                {visibleProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    loading={loading}
                    onOpen={openProject}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;

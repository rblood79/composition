import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  projectsApi,
  pagesApi,
  elementsApi,
  type Project,
} from "../services/api";
import { getDB } from "../lib/db";
import { ElementProps } from "../types/integrations/supabase.types";
import { getDefaultProps } from "../types/builder/unified.types";
import { ElementUtils } from "../utils/element/elementUtils";
import {
  Button,
  TextField,
  Badge,
  Card,
  Skeleton,
  Separator,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import { TooltipTrigger } from "react-aria-components";
import { useAsyncQuery } from "../builder/hooks/useAsyncQuery";
import { useAsyncMutation } from "../builder/hooks/useAsyncMutation";
import {
  SquarePlus,
  Cloud,
  HardDrive,
  Download,
  Settings,
  Plus,
  Package,
  CloudUpload,
  Trash,
  FolderOpen,
  Layers,
} from "lucide-react";
import {
  mergeProjects,
  getStorageBadge,
  getAvailableActions,
  formatRelativeTime,
} from "../utils/projectMerger";
import {
  syncProjectToCloud,
  downloadProjectFromCloud,
} from "../utils/projectSync";
import { historyIndexedDB } from "../builder/stores/history/historyIndexedDB";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingsPanel } from "./SettingsPanel";
import { createInitialProjectDocument } from "./createInitialProjectDocument";
import type { ProjectListItem, ProjectFilter } from "../types/dashboard.types";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";
import "./index.css";

interface CreateProjectRequest {
  name: string;
}

/** Badge variant 매핑 */
function getBadgeVariant(
  className: string,
): "informative" | "positive" | "accent" | "notice" | "neutral" {
  switch (className) {
    case "badge-local":
      return "informative";
    case "badge-cloud":
      return "positive";
    case "badge-synced":
      return "accent";
    case "badge-conflict":
      return "notice";
    default:
      return "neutral";
  }
}

/** 프로젝트 카드 컴포넌트 */
function ProjectCard({
  project,
  loading,
  onOpen,
  onSync,
  onDownload,
  onDelete,
}: {
  project: ProjectListItem;
  loading: boolean;
  onOpen: (id: string) => void;
  onSync: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const badge = getStorageBadge(project);
  const actions = getAvailableActions(project);

  return (
    <Card
      orientation="horizontal"
      variant="secondary"
      size="sm"
      className="project-card"
      structuralChildren
    >
      <div className="project-card-icon">
        <Layers size={16} />
      </div>

      <div className="project-card-content">
        <div className="project-card-header">
          <span className="project-card-title">{project.name}</span>
          <Badge
            variant={getBadgeVariant(badge.className)}
            size="sm"
            fillStyle="subtle"
          >
            {badge.label}
          </Badge>
        </div>

        <span className="project-card-meta">
          {formatRelativeTime(project.lastModified)}
          {project.sync.lastSyncAt && (
            <> &middot; Synced {formatRelativeTime(project.sync.lastSyncAt)}</>
          )}
        </span>
      </div>

      <div className="project-card-actions">
        {actions.canOpen && (
          <TooltipTrigger delay={300}>
            <Button
              variant="primary"
              size="xs"
              onPress={() => onOpen(project.id)}
              isDisabled={loading}
              aria-label="Open project"
            >
              <Package size={14} />
            </Button>
            <Tooltip>Open</Tooltip>
          </TooltipTrigger>
        )}

        {actions.canSync && (
          <TooltipTrigger delay={300}>
            <Button
              variant="secondary"
              fillStyle="outline"
              size="xs"
              onPress={() => onSync(project.id)}
              isDisabled={loading}
              aria-label="Sync to cloud"
            >
              <CloudUpload size={14} />
            </Button>
            <Tooltip>Sync to Cloud</Tooltip>
          </TooltipTrigger>
        )}

        {actions.canDownload && (
          <TooltipTrigger delay={300}>
            <Button
              variant="secondary"
              fillStyle="outline"
              size="xs"
              onPress={() => onDownload(project.id)}
              isDisabled={loading}
              aria-label="Download from cloud"
            >
              <Download size={14} />
            </Button>
            <Tooltip>Download</Tooltip>
          </TooltipTrigger>
        )}

        <TooltipTrigger delay={300}>
          <Button
            variant="negative"
            fillStyle="outline"
            size="xs"
            onPress={() => onDelete(project.id)}
            isDisabled={loading}
            aria-label="Delete project"
          >
            <Trash size={14} />
          </Button>
          <Tooltip>Delete</Tooltip>
        </TooltipTrigger>
      </div>
    </Card>
  );
}

/** 로딩 스켈레톤 */
function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton">
      <Skeleton componentVariant="card-horizontal" size="sm" />
      <Skeleton componentVariant="card-horizontal" size="sm" />
      <Skeleton componentVariant="card-horizontal" size="sm" />
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [newProjectName, setNewProjectName] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [mergedProjects, setMergedProjects] = useState<ProjectListItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const projectCreation = useSettingsStore((state) => state.projectCreation);

  // Fetch cloud projects
  const cloudProjectsQuery = useAsyncQuery<Project>(
    async () => await projectsApi.fetchProjects(),
  );

  // Load and merge local + cloud projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const db = await getDB();
        const localProjectsRaw = await db.projects.getAll();

        const localProjects: Project[] = localProjectsRaw.map((p) => ({
          id: p.id,
          name: p.name,
          created_by: p.created_by || "",
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        }));

        const cloudProjects = cloudProjectsQuery.data || [];
        const merged = mergeProjects(localProjects, cloudProjects);
        setMergedProjects(merged);
      } catch (error) {
        console.error("[Dashboard] 프로젝트 로드 실패:", error);
      }
    };

    if (!cloudProjectsQuery.isLoading) {
      loadProjects();
    }
  }, [cloudProjectsQuery.data, cloudProjectsQuery.isLoading]);

  // Create project mutation
  const createProjectMutation = useAsyncMutation<Project, CreateProjectRequest>(
    async ({ name }) => {
      const db = await getDB();
      const user = await projectsApi.getCurrentUser();

      let newProject: Project;

      if (projectCreation === "local") {
        newProject = {
          id: ElementUtils.generateId(),
          name: name.trim(),
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.projects.insert(newProject);
      } else if (projectCreation === "cloud") {
        newProject = await projectsApi.createProject({
          name: name.trim(),
          created_by: user.id,
        });
      } else {
        newProject = await projectsApi.createProject({
          name: name.trim(),
          created_by: user.id,
        });
        await db.projects.insert(newProject);
      }

      // 기본 페이지 + body 요소 생성
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

      if (projectCreation === "local") {
        // local project state persists through the canonical document only.
      } else if (projectCreation === "cloud") {
        await pagesApi.createPage({
          id: homePageId,
          project_id: newProject.id,
          title: "Home",
          slug: "/",
        });
        await elementsApi.createElement(bodyElement);
      } else {
        await pagesApi.createPage({
          id: homePageId,
          project_id: newProject.id,
          title: "Home",
          slug: "/",
        });
        await elementsApi.createElement(bodyElement);
      }

      await db.documents.put(
        newProject.id,
        createInitialProjectDocument(homePage, bodyElement),
      );

      return newProject;
    },
    {
      onSuccess: (newProject) => {
        cloudProjectsQuery.reload();
        setNewProjectName("");
        navigate(`/builder/${newProject.id}`);
      },
    },
  );

  // Delete project mutation
  const deleteProjectMutation = useAsyncMutation<void, string>(
    async (id) => {
      let deleteLocation: "local" | "cloud" | "both";

      if (filter === "local") {
        deleteLocation = "local";
      } else if (filter === "cloud") {
        deleteLocation = "cloud";
      } else {
        deleteLocation = "both";
      }

      // 로컬 삭제
      if (deleteLocation === "local" || deleteLocation === "both") {
        const db = await getDB();
        const document = await db.documents.get(id);
        const pages = document
          ? deriveProjectRenderModelFromDocument(document, id).pages
          : [];

        for (const page of pages) {
          await db.history.clear(page.id);
          await historyIndexedDB.clearPageHistory(page.id);
        }

        const tokens = await db.designTokens.getByProject(id);
        for (const token of tokens) {
          await db.designTokens.delete(token.id);
        }

        const themes = await db.themes.getByProject(id);
        for (const theme of themes) {
          await db.themes.delete(theme.id as string);
        }

        const dataTables = await db.data_tables.getByProject(id);
        for (const dataTable of dataTables) {
          await db.data_tables.delete(dataTable.id);
        }

        const apiEndpoints = await db.api_endpoints.getByProject(id);
        for (const endpoint of apiEndpoints) {
          await db.api_endpoints.delete(endpoint.id);
        }

        const variables = await db.variables.getByProject(id);
        for (const variable of variables) {
          await db.variables.delete(variable.id);
        }

        const transformers = await db.transformers.getByProject(id);
        for (const transformer of transformers) {
          await db.transformers.delete(transformer.id);
        }

        await db.documents.delete(id);
        await db.projects.delete(id);
      }

      // 클라우드 삭제
      if (deleteLocation === "cloud" || deleteLocation === "both") {
        try {
          await projectsApi.deleteProject(id);
        } catch (error) {
          console.warn("[Dashboard] Supabase 삭제 실패:", error);
        }
      }
    },
    {
      onSuccess: () => {
        cloudProjectsQuery.reload();
      },
    },
  );

  // Sync project mutation
  const syncProjectMutation = useAsyncMutation<void, string>(
    async (projectId) => {
      await syncProjectToCloud(projectId);
    },
    {
      onSuccess: () => {
        cloudProjectsQuery.reload();
      },
    },
  );

  // Download project mutation
  const downloadProjectMutation = useAsyncMutation<void, string>(
    async (projectId) => {
      await downloadProjectFromCloud(projectId);
    },
    {
      onSuccess: () => {
        cloudProjectsQuery.reload();
      },
    },
  );

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await createProjectMutation.execute({ name: newProjectName });
    } catch (err) {
      console.error("프로젝트 생성 에러:", err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("정말로 이 프로젝트를 삭제하시겠습니까?")) return;

    try {
      await deleteProjectMutation.execute(id);
    } catch (err) {
      console.error("프로젝트 삭제 에러:", err);
    }
  };

  const handleSyncProject = async (id: string) => {
    try {
      await syncProjectMutation.execute(id);
    } catch (err) {
      console.error("[Dashboard] Sync 에러:", err);
    }
  };

  const handleDownloadProject = async (id: string) => {
    try {
      await downloadProjectMutation.execute(id);
    } catch (err) {
      console.error("[Dashboard] Download 에러:", err);
    }
  };

  // 필터링
  const filteredProjects = useMemo(
    () =>
      mergedProjects.filter((project) => {
        if (filter === "local") return project.storage.local;
        if (filter === "cloud") return project.storage.cloud;
        return true;
      }),
    [mergedProjects, filter],
  );

  const loading =
    cloudProjectsQuery.isLoading ||
    createProjectMutation.isLoading ||
    deleteProjectMutation.isLoading ||
    syncProjectMutation.isLoading ||
    downloadProjectMutation.isLoading;

  const error =
    cloudProjectsQuery.error ||
    createProjectMutation.error ||
    deleteProjectMutation.error ||
    syncProjectMutation.error ||
    downloadProjectMutation.error;

  const counts = {
    all: mergedProjects.length,
    local: mergedProjects.filter((p) => p.storage.local).length,
    cloud: mergedProjects.filter((p) => p.storage.cloud).length,
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <SquarePlus size={18} />
          <h1>composition</h1>
        </div>

        <div className="dashboard-header-right">
          <ToggleButtonGroup
            selectionMode="single"
            selectedKeys={new Set([filter])}
            onSelectionChange={(keys) => {
              const selected = [...keys][0] as ProjectFilter;
              if (selected) setFilter(selected);
            }}
            size="sm"
          >
            <ToggleButton id="all" size="sm">
              All ({counts.all})
            </ToggleButton>
            <ToggleButton id="local" size="sm">
              <HardDrive size={12} /> Local ({counts.local})
            </ToggleButton>
            <ToggleButton id="cloud" size="sm">
              <Cloud size={12} /> Cloud ({counts.cloud})
            </ToggleButton>
          </ToggleButtonGroup>

          <Separator orientation="vertical" />

          <TooltipTrigger delay={300}>
            <Button
              variant="secondary"
              fillStyle="outline"
              size="sm"
              onPress={() => setShowSettings(true)}
              aria-label="Settings"
            >
              <Settings size={14} />
            </Button>
            <Tooltip>Settings</Tooltip>
          </TooltipTrigger>
        </div>
      </header>

      <Separator />

      {/* Error */}
      {error && (
        <div className="dashboard-error">
          <Badge variant="negative" size="md" fillStyle="subtle">
            {error.message}
          </Badge>
        </div>
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        {/* New Project Form */}
        <form onSubmit={handleAddProject} className="new-project-form">
          <TextField
            value={newProjectName}
            onChange={setNewProjectName}
            isDisabled={loading}
            placeholder="New project name..."
            size="md"
            aria-label="New project name"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            isDisabled={loading || !newProjectName.trim()}
            isLoading={createProjectMutation.isLoading}
          >
            <Plus size={14} />
          </Button>
        </form>

        {/* Projects Grid */}
        {cloudProjectsQuery.isLoading && mergedProjects.length === 0 ? (
          <ProjectCardSkeleton />
        ) : filteredProjects.length === 0 ? (
          <div className="dashboard-empty">
            <FolderOpen size={48} strokeWidth={1} />
            <p className="dashboard-empty-title">No projects yet</p>
            <p className="dashboard-empty-description">
              Create your first project to get started
            </p>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                loading={loading}
                onOpen={(id) => navigate(`/builder/${id}`)}
                onSync={handleSyncProject}
                onDownload={handleDownloadProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <span>composition — Local-first Web Builder</span>
      </footer>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default Dashboard;

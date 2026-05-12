import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { getDB } from "../lib/db";
import { getDefaultProps } from "../types/builder/unified.types";
import { ElementProps } from "../types/integrations/supabase.types";
import { ElementUtils } from "../utils/element/elementUtils";
import { supabase } from "../env/supabase.client";
import {
  Button,
  TextField,
  Badge,
  Card,
  Skeleton,
  Separator,
  Tooltip,
} from "@composition/shared/components";
import { TooltipTrigger } from "react-aria-components";
import { useAsyncMutation } from "../builder/hooks/useAsyncMutation";
import {
  SquarePlus,
  Settings,
  Plus,
  Package,
  Trash,
  FolderOpen,
  Layers,
} from "lucide-react";
import { historyIndexedDB } from "../builder/stores/history/historyIndexedDB";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingsPanel } from "./SettingsPanel";
import { createInitialProjectDocument } from "./createInitialProjectDocument";
import type { ProjectListItem } from "../types/dashboard.types";
import { deriveProjectRenderModelFromDocument } from "@composition/shared";
import "./index.css";

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

async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw new Error(`Session error: ${error.message}`);
  if (!session?.user) throw new Error("No authenticated user found");
  return session.user.id;
}

/** 프로젝트 카드 컴포넌트 */
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
          <Badge variant="informative" size="sm" fillStyle="subtle">
            Local
          </Badge>
        </div>

        <span className="project-card-meta">
          {formatRelativeTime(project.lastModified)}
        </span>
      </div>

      <div className="project-card-actions">
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
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const projectCreation = useSettingsStore((state) => state.projectCreation);

  void projectCreation; // (ADR-128) cloud option 제거됨. settings 자체는 보존.

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const db = await getDB();
      const localProjectsRaw = await db.projects.getAll();
      const merged: ProjectListItem[] = localProjectsRaw.map((p) => ({
        id: p.id,
        name: p.name,
        storage: { local: true, cloud: false },
        sync: { status: "local-only" },
        createdAt: new Date(p.created_at ?? Date.now()),
        lastModified: new Date(p.updated_at ?? Date.now()),
      }));
      setProjects(merged);
    } catch (error) {
      console.error("[Dashboard] 프로젝트 로드 실패:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
    },
    {
      onSuccess: () => {
        void loadProjects();
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

  const filteredProjects = useMemo(() => projects, [projects]);

  const loading =
    isLoadingProjects ||
    createProjectMutation.isLoading ||
    deleteProjectMutation.isLoading;

  const error = createProjectMutation.error || deleteProjectMutation.error;

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <SquarePlus size={18} />
          <h1>composition</h1>
        </div>

        <div className="dashboard-header-right">
          <Badge variant="informative" size="sm" fillStyle="subtle">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </Badge>

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
        {isLoadingProjects && projects.length === 0 ? (
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

import { openCatalogPublish } from "./openCatalogPublish";
import { useCallback, useEffect, useRef, useState } from "react";
import { toExportCollection, toRuntimeApiEndpoint } from "@composition/shared";
import type { ProjectContentV2 } from "@composition/shared/assets";
import type { EntryId } from "../../../../../packages/shared/src/catalog/document/types";
import { useI18n } from "../../i18n";
import { loadFontRegistry, saveRegistryAndNotify } from "../fonts/customFonts";
import type { CatalogWorkspace } from "../catalogRuntime/workspace";
import { CatalogStorage, CatalogStorageError } from "../catalogRuntime/storage";
import { getProjectVariableDefinitions, useDataStore } from "../stores/data";
import { useToastStore } from "../stores/toast";
import { importDataParts } from "../utils/importCollectionEnvelope";
import DirectoryLinkButton from "./DirectoryLinkButton";

// Cold paths: the file formats and the folder link load on first use (ADR-235 HC2).
const exchangeModule = () => import("../catalogRuntime/exchange");
const projectFileModule = () => import("../../lib/assets/assetProjectFile");
const linkModule = () => import("../../lib/assets/projectDirectoryLink");

const DIRECTORY_LINK_EVENT = "composition:directory-link";
const DOCUMENT_PERSISTED_EVENT = "composition:document-persisted";
const linkFlagKey = (routeId: string) => `composition.dir-link.${routeId}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function readStoredAsset(hash: string) {
  const { readAssetRecords } = await import("../../lib/assets/assetDb");
  const record = (await readAssetRecords([hash])).get(hash);
  return record
    ? {
        bytes: new Uint8Array(await record.blob.arrayBuffer()),
        mime: record.mime,
      }
    : null;
}

/**
 * ADR-248 Phase 4e-6: the header's project file actions over the open catalog project — export
 * (the ADR-235 v2 zip, or one JSON file with its asset bytes), import (either, into this project:
 * the file's document replaces this one's, its data parts go into the data store by name, then the
 * project reopens with a fresh history) and the folder link (the v2 container written after each
 * durable save; "open from folder" is an import). The data store keys the project by the route id,
 * as the folder link and the local file do.
 */
export function useCatalogProjectFiles(options: {
  workspace: CatalogWorkspace | undefined;
  routeId: string;
  /** Reopen the project from storage, then show `pageId` (after an import replaced it). */
  reopen: (pageId: string | undefined) => void;
}) {
  const { workspace, routeId, reopen } = options;
  const { t } = useI18n();
  const toast = useCallback(
    (
      kind: "success" | "error" | "warning",
      message: string,
      duration?: number,
    ) =>
      useToastStore
        .getState()
        .showToast(kind, message, duration ? { duration } : undefined),
    [],
  );

  /** This project's content, or null unless it is open here with its data store loaded. */
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const collectContent = useCallback((): ProjectContentV2 | null => {
    const open = workspaceRef.current;
    const data = useDataStore.getState();
    if (!open || data.currentProjectId !== routeId || !data.isInitialized)
      return null;
    const graph = open.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    return {
      project: {
        id: graph.projectId,
        name: project?.kind === "project" ? project.name : routeId,
      },
      document: graph.exportDocument(),
      currentPageId: open.session.getSnapshot().pageId ?? null,
      fontRegistry: loadFontRegistry(),
      collections: [...data.collections.values()].map(toExportCollection),
      apiEndpoints: [...data.apiEndpoints.values()].map(toRuntimeApiEndpoint),
      variables: getProjectVariableDefinitions(),
    };
  }, [routeId]);

  const fileName = (content: ProjectContentV2) =>
    content.project.name || "project";
  const exportFailed = useCallback(
    (error: unknown) =>
      toast(
        "error",
        t("header.exportProjectFailed", {
          message: error instanceof Error ? error.message : String(error),
        }),
        8000,
      ),
    [t, toast],
  );

  const openPublish = useCallback(async () => {
    const content = collectContent();
    if (!content) {
      toast("error", t("header.projectFileUnavailable"));
      return;
    }
    try {
      await openCatalogPublish(content, readStoredAsset);
    } catch (error) {
      exportFailed(error);
    }
  }, [collectContent, exportFailed, t, toast]);

  const exportZip = useCallback(async () => {
    const content = collectContent();
    if (!content) {
      toast("error", t("header.projectFileUnavailable"));
      return;
    }
    try {
      const { exportProjectV2Zip } = await projectFileModule();
      download(
        await exportProjectV2Zip(content),
        `${fileName(content)}.composition.zip`,
      );
      toast("success", t("header.exportProjectSuccess"));
    } catch (error) {
      exportFailed(error);
    }
  }, [collectContent, exportFailed, t, toast]);

  const exportJson = useCallback(async () => {
    const content = collectContent();
    if (!content) {
      toast("error", t("header.projectFileUnavailable"));
      return;
    }
    try {
      const { buildCatalogProjectJson } = await exchangeModule();
      const text = await buildCatalogProjectJson(content, readStoredAsset);
      download(
        new Blob([text], { type: "application/json" }),
        `${fileName(content)}.composition.json`,
      );
      toast("success", t("header.exportProjectSuccess"));
    } catch (error) {
      exportFailed(error);
    }
  }, [collectContent, exportFailed, t, toast]);

  /** Apply a file's content to this project (a local file, or the linked folder's generation). */
  const applyContent = useCallback(
    async (content: ProjectContentV2) => {
      const open = workspaceRef.current;
      if (!open) throw new CatalogStorageError("PROJECT_NOT_FOUND");
      const { importCatalogProjectContent } = await exchangeModule();
      const result = await importCatalogProjectContent({
        content,
        projectId: open.runtime.graph.projectId as EntryId<"project">,
        name: (() => {
          const project = open.runtime.graph.getEntry(
            open.runtime.graph.projectId,
          );
          return project?.kind === "project" ? project.name : undefined;
        })(),
        library: open.runtime.graph.library,
        replace: (document) =>
          new CatalogStorage().replace(document, open.runtime.graph.library),
        importData: (extras) =>
          importDataParts(
            routeId,
            extras as Parameters<typeof importDataParts>[1],
            useDataStore.getState(),
          ),
      });
      if (result.extras.fontRegistry)
        saveRegistryAndNotify(
          result.extras.fontRegistry as Parameters<
            typeof saveRegistryAndNotify
          >[0],
        );
      reopen(result.pageId);
      if (result.pageMissing)
        toast("warning", t("header.importCurrentPageMissing"));
      toast("success", t("header.importProjectSuccess"));
    },
    [reopen, routeId, t, toast],
  );

  const importFailed = useCallback(
    (error: unknown) =>
      toast(
        "error",
        error instanceof CatalogStorageError &&
          error.code === "UNSUPPORTED_PROJECT_FORMAT"
          ? t("catalogProject.formatUnsupported")
          : t("header.importProjectFailed", {
              message: error instanceof Error ? error.message : String(error),
            }),
        8000,
      ),
    [t, toast],
  );

  const importFile = useCallback(
    async (file: File) => {
      if (!workspaceRef.current) {
        toast("error", t("header.projectFileUnavailable"));
        return;
      }
      try {
        const projectFile = await projectFileModule();
        if (await projectFile.isProjectZipFile(file)) {
          const read = await projectFile.readProjectV2Zip(file);
          if (read.recovered)
            toast("warning", t("header.importRecoveredGeneration"), 8000);
          await applyContent(read.data as ProjectContentV2);
          return;
        }
        const { readCatalogProjectJson } = await exchangeModule();
        const { content, assets } = await readCatalogProjectJson(
          await file.text(),
        );
        const [{ storeAssetBytes }, { installIndexedDbAssetUrlResolver }] =
          await Promise.all([
            import("../../lib/assets/assetStore"),
            import("../../lib/assets/assetUrlResolver"),
          ]);
        const resolver = installIndexedDbAssetUrlResolver();
        for (const asset of assets) {
          const stored = await storeAssetBytes(asset);
          if (stored.ref !== asset.ref)
            throw new Error(`CORRUPT_ASSET:${asset.ref}`);
          resolver.register(stored.ref, stored.blob);
        }
        await applyContent(content);
      } catch (error) {
        importFailed(error);
      }
    },
    [applyContent, importFailed, t, toast],
  );

  // Folder link (Chromium File System Access): the v2 container written after durable saves.
  const [folderLinked, setFolderLinked] = useState(false);
  useEffect(() => {
    if (!routeId) return;
    const linked = localStorage.getItem(linkFlagKey(routeId)) === "1";
    setFolderLinked(linked);
    if (!linked) return;
    void linkModule().then((m) =>
      m.resumeProjectDirectoryLink(routeId, { collectContent }),
    );
    const onLink = (event: Event) => {
      const detail = (
        event as CustomEvent<{ projectId?: string; unlinked?: boolean }>
      ).detail;
      if (detail?.projectId === routeId && detail.unlinked)
        setFolderLinked(false);
    };
    window.addEventListener(DIRECTORY_LINK_EVENT, onLink);
    return () => window.removeEventListener(DIRECTORY_LINK_EVENT, onLink);
  }, [routeId, collectContent]);

  // A durable save of this project tells the link to write (the old document store's event).
  useEffect(() => {
    if (!workspace) return;
    let saved = workspace.autosave.getSnapshot().durableRevision;
    return workspace.autosave.subscribe(() => {
      const status = workspace.autosave.getSnapshot();
      if (status.state !== "saved" || status.durableRevision === saved) return;
      saved = status.durableRevision;
      window.dispatchEvent(
        new CustomEvent(DOCUMENT_PERSISTED_EVENT, {
          detail: { projectId: routeId, revision: String(saved) },
        }),
      );
    });
  }, [workspace, routeId]);

  const connectFolder = useCallback(async () => {
    if (!routeId) return;
    const state = await (
      await linkModule()
    ).pickAndConnectProjectDirectory(routeId, { collectContent });
    if (state) setFolderLinked(true);
  }, [routeId, collectContent]);

  // DEV: the live harness connects an OPFS handle without the picker (the old app's hook).
  useEffect(() => {
    if (!import.meta.env.DEV || !routeId) return;
    const hooks = window as unknown as Record<string, unknown>;
    hooks.__composition_CONNECT_FOLDER__ = async (
      handle: FileSystemDirectoryHandle,
    ) => {
      const m = await linkModule();
      setFolderLinked(true);
      return m.connectProjectDirectory(routeId, handle, { collectContent });
    };
    return () => {
      delete hooks.__composition_CONNECT_FOLDER__;
    };
  }, [routeId, collectContent]);

  const onLinkAction = useCallback(
    async (
      action: "permission" | "open" | "overwrite" | "restore" | "disconnect",
    ) => {
      if (!routeId) return;
      try {
        await (
          await linkModule()
        ).runDirectoryLinkAction(routeId, action, (data) =>
          applyContent(data as ProjectContentV2),
        );
      } catch (error) {
        importFailed(error);
      }
      if (action === "disconnect") setFolderLinked(false);
    },
    [routeId, applyContent, importFailed],
  );

  const directoryLink =
    folderLinked && routeId ? (
      <DirectoryLinkButton
        projectId={routeId}
        onAction={(action) => void onLinkAction(action)}
      />
    ) : null;

  return {
    openPublish,
    exportZip,
    exportJson,
    importFile,
    connectFolder,
    directoryLink,
    collectContent,
  };
}

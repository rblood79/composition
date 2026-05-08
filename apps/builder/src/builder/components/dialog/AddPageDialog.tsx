/**
 * Add Page Dialog
 *
 * 페이지 생성 다이얼로그.
 * title, slug, layout, parent를 선택할 수 있음.
 *
 * ⭐ Nested Routes & Slug System: Page 생성 시 계층 구조 설정
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DialogTrigger,
  Modal,
  Dialog,
  Heading,
  Button,
  Label,
  Input,
  TextField,
} from "react-aria-components";
import {
  CirclePlus,
  FolderTree,
  Layout,
  Link,
  AlertCircle,
} from "lucide-react";
import { useStore } from "../../stores";
import { useCanonicalReusableFrameLayouts } from "../../stores/canonical/canonicalFrameStore";
import {
  generateSlugFromTitle,
  validateSlug,
} from "../../../utils/slugValidator";
import { generatePageUrl } from "../../../utils/urlGenerator";
import {
  iconProps,
  iconEditProps,
  iconSmall,
} from "../../../utils/ui/uiConstants";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../../adapters/canonical/frameMirror";
import type { Page } from "../../../types/builder/unified.types";
import "./AddPageDialog.css";

export interface AddPageDialogResult {
  title: string;
  slug: string;
  layoutId: string | null;
  parentId: string | null;
}

interface AddPageDialogProps {
  onSubmit: (result: AddPageDialogResult) => Promise<void>;
  existingPagesCount: number;
}

function toUrlPage(page: Page) {
  return withPageFrameBinding(
    {
      id: page.id,
      title: page.title,
      slug: page.slug || "",
      project_id: page.project_id || "",
      parent_id: page.parent_id,
    },
    getNullablePageFrameBindingId(page),
  );
}

export function AddPageDialog({
  onSubmit,
  existingPagesCount,
}: AddPageDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store data
  const pages = useStore((state) => state.pages);
  const layouts = useCanonicalReusableFrameLayouts();

  // Default values
  const defaultTitle = `Page ${existingPagesCount + 1}`;
  const defaultSlug = `/page-${existingPagesCount + 1}`;

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setTitle(defaultTitle);
        setSlug(defaultSlug);
        setLayoutId(null);
        setParentId(null);
        setSlugError(null);
        setIsSubmitting(false);
      });
    }
  }, [isOpen, defaultTitle, defaultSlug]);

  // Auto-generate slug from title
  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    // Only auto-generate if slug hasn't been manually edited
    const generatedSlug = `/${generateSlugFromTitle(value)}`;
    setSlug(generatedSlug);

    // Validate
    const validation = validateSlug(generatedSlug);
    setSlugError(validation.valid ? null : validation.error || null);
  }, []);

  // Handle slug change
  const handleSlugChange = useCallback((value: string) => {
    setSlug(value);
    const validation = validateSlug(value);
    setSlugError(validation.valid ? null : validation.error || null);
  }, []);

  // Handle parent change with circular reference check
  const handleParentChange = useCallback((value: string) => {
    const newParentId = value || null;
    setParentId(newParentId);
  }, []);

  // Preview URL
  const previewUrl = useMemo(() => {
    const layout = layoutId ? layouts.find((l) => l.id === layoutId) : null;

    // Create a temporary page object for URL generation
    const tempPage = withPageFrameBinding(
      {
        id: "temp",
        title,
        slug,
        project_id: "",
        parent_id: parentId,
      },
      layoutId,
    );

    return generatePageUrl({
      page: tempPage,
      layout: layout
        ? {
            id: layout.id,
            name: layout.name,
            project_id: layout.project_id,
            slug: layout.slug || undefined,
          }
        : null,
      allPages: pages.map(toUrlPage),
    });
  }, [title, slug, layoutId, parentId, layouts, pages]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    // Validate
    const validation = validateSlug(slug);
    if (!validation.valid) {
      setSlugError(validation.error || "Invalid slug");
      return;
    }

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        title: title.trim(),
        slug,
        layoutId,
        parentId,
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create page:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, slug, layoutId, parentId, onSubmit]);

  // Parent options (exclude circular references)
  const parentOptions = useMemo(() => {
    return pages.map((p) => ({
      value: p.id,
      label: p.title,
    }));
  }, [pages]);

  // Layout options
  const layoutOptions = useMemo(() => {
    return layouts.map((l) => ({
      value: l.id,
      label: l.slug ? `${l.name} (${l.slug})` : l.name,
    }));
  }, [layouts]);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button className="iconButton" aria-label="Add Page">
        <CirclePlus
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
          size={iconProps.size}
        />
      </Button>

      <Modal className="add-page-modal">
        <Dialog className="add-page-dialog">
          <Heading slot="title" className="add-page-title">
            <CirclePlus size={iconProps.size} />
            Add New Page
          </Heading>

          <div className="add-page-form">
            {/* Title */}
            <TextField className="add-page-field">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={defaultTitle}
              />
            </TextField>

            {/* Slug */}
            <TextField className="add-page-field" isInvalid={!!slugError}>
              <Label>
                <Link size={iconEditProps.size} />
                URL Slug
              </Label>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={defaultSlug}
              />
              {slugError && (
                <div className="add-page-error">
                  <AlertCircle size={iconSmall.size} />
                  <span>{slugError}</span>
                </div>
              )}
              <div className="add-page-hint">
                Auto-generated from title. Edit if needed.
              </div>
            </TextField>

            {/* Layout (Optional) */}
            <div className="add-page-field">
              <Label>
                <Layout size={iconEditProps.size} />
                Layout (Optional)
              </Label>
              <select
                value={layoutId || ""}
                onChange={(e) => setLayoutId(e.target.value || null)}
                className="add-page-select"
              >
                <option value="">None</option>
                {layoutOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Parent Page (Optional) */}
            <div className="add-page-field">
              <Label>
                <FolderTree size={iconEditProps.size} />
                Parent Page (Optional)
              </Label>
              <select
                value={parentId || ""}
                onChange={(e) => handleParentChange(e.target.value)}
                className="add-page-select"
              >
                <option value="">None (Root Level)</option>
                {parentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* URL Preview */}
            <div className="add-page-preview">
              <span className="add-page-preview-label">Preview URL:</span>
              <code className="add-page-preview-url">{previewUrl}</code>
            </div>
          </div>

          {/* Actions */}
          <div className="add-page-actions">
            <Button
              className="add-page-cancel"
              onPress={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="add-page-submit"
              onPress={handleSubmit}
              isDisabled={isSubmitting || !title.trim() || !!slugError}
            >
              {isSubmitting ? "Creating..." : "Create Page"}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}

export default AddPageDialog;

import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";

export interface CanonicalFullLayoutPublication {
  readonly kind: "canonical-full";
  readonly version: number;
}

export interface PresentationTargetedLayoutPublication<T = ComputedLayout> {
  readonly kind: "presentation-targeted";
  readonly rootKey: string;
  readonly roots: readonly string[];
  readonly affectedNodeIds: ReadonlySet<string>;
  /** affected node만 보유한다. canonical base map을 복사하지 않는다. */
  readonly layoutDelta: ReadonlyMap<string, T>;
  readonly presentationRevision: number;
  readonly baseCanonicalRevision: number;
  /** 같은 계획에서 분할된 root publication을 함께 적용하기 위한 sequence. */
  readonly planSequence: number;
}

export type LayoutPublication<T = ComputedLayout> =
  CanonicalFullLayoutPublication | PresentationTargetedLayoutPublication<T>;

export interface LayoutOverlay<T> {
  readonly base: ReadonlyMap<string, T>;
  readonly delta: ReadonlyMap<string, T>;
  resolve(nodeId: string): T | undefined;
  has(nodeId: string): boolean;
}

export interface PresentationLayoutPlanSnapshot {
  readonly roots: readonly string[];
  readonly affectedNodeIds: ReadonlySet<string>;
}

export interface CreatePresentationPublicationsInput<T> {
  readonly plan: PresentationLayoutPlanSnapshot;
  readonly layoutDelta: ReadonlyMap<string, T>;
  readonly rootKeyForNode: (nodeId: string) => string | undefined;
  readonly baseCanonicalRevision: number;
  readonly planSequence: number;
  readonly presentationRevisionByRootKey: ReadonlyMap<string, number>;
}

export type CreatePresentationPublicationsResult<T> =
  | {
      readonly ok: true;
      readonly publications: readonly PresentationTargetedLayoutPublication<T>[];
    }
  | {
      readonly ok: false;
      readonly reason:
        | "invalid-revision"
        | "unknown-root-key"
        | "cross-root-plan"
        | "delta-outside-affected"
        | "missing-root-revision";
    };

function isValidRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function resolveValidRootKey(
  rootKeyForNode: (nodeId: string) => string | undefined,
  nodeId: string,
): string | undefined {
  const rootKey = rootKeyForNode(nodeId);
  return typeof rootKey === "string" && rootKey.length > 0
    ? rootKey
    : undefined;
}

/**
 * 하나의 layout plan을 rootKey 단위 publication으로 분할한다.
 * root 경계를 확인할 수 없는 node가 하나라도 있으면 전체 계획을 거부한다.
 */
export function createPresentationTargetedPublications<T>(
  input: CreatePresentationPublicationsInput<T>,
): CreatePresentationPublicationsResult<T> {
  if (
    !isValidRevision(input.baseCanonicalRevision) ||
    !isValidRevision(input.planSequence)
  ) {
    return { ok: false, reason: "invalid-revision" };
  }

  const rootsByRootKey = new Map<string, string[]>();
  const affectedByRootKey = new Map<string, Set<string>>();
  const deltaByRootKey = new Map<string, Map<string, T>>();

  for (const rootId of input.plan.roots) {
    const rootKey = resolveValidRootKey(input.rootKeyForNode, rootId);
    if (!rootKey) return { ok: false, reason: "unknown-root-key" };
    const roots = rootsByRootKey.get(rootKey);
    if (roots) roots.push(rootId);
    else rootsByRootKey.set(rootKey, [rootId]);
  }

  for (const nodeId of input.plan.affectedNodeIds) {
    const rootKey = resolveValidRootKey(input.rootKeyForNode, nodeId);
    if (!rootKey) return { ok: false, reason: "unknown-root-key" };
    if (!rootsByRootKey.has(rootKey)) {
      return { ok: false, reason: "cross-root-plan" };
    }
    const affected = affectedByRootKey.get(rootKey);
    if (affected) affected.add(nodeId);
    else affectedByRootKey.set(rootKey, new Set([nodeId]));
  }

  for (const [nodeId, layout] of input.layoutDelta) {
    if (!input.plan.affectedNodeIds.has(nodeId)) {
      return { ok: false, reason: "delta-outside-affected" };
    }
    const rootKey = resolveValidRootKey(input.rootKeyForNode, nodeId);
    if (!rootKey) return { ok: false, reason: "unknown-root-key" };
    if (!rootsByRootKey.has(rootKey)) {
      return { ok: false, reason: "cross-root-plan" };
    }
    const delta = deltaByRootKey.get(rootKey);
    if (delta) delta.set(nodeId, layout);
    else deltaByRootKey.set(rootKey, new Map([[nodeId, layout]]));
  }

  const publications: PresentationTargetedLayoutPublication<T>[] = [];
  for (const [rootKey, roots] of rootsByRootKey) {
    const presentationRevision =
      input.presentationRevisionByRootKey.get(rootKey);
    if (
      presentationRevision === undefined ||
      !isValidRevision(presentationRevision)
    ) {
      return { ok: false, reason: "missing-root-revision" };
    }
    publications.push(
      Object.freeze({
        kind: "presentation-targeted" as const,
        rootKey,
        roots: Object.freeze([...roots]),
        affectedNodeIds: new Set(affectedByRootKey.get(rootKey) ?? []),
        layoutDelta: deltaByRootKey.get(rootKey) ?? new Map<string, T>(),
        presentationRevision,
        baseCanonicalRevision: input.baseCanonicalRevision,
        planSequence: input.planSequence,
      }),
    );
  }

  return { ok: true, publications: Object.freeze(publications) };
}

export function createCanonicalFullLayoutPublication(
  version: number,
): CanonicalFullLayoutPublication {
  if (!isValidRevision(version)) {
    throw new RangeError(
      "canonical layout publication version must be a safe integer",
    );
  }
  return Object.freeze({ kind: "canonical-full" as const, version });
}

/** base map을 읽기 전용으로 참조하고 delta만 우선 조회한다. */
export function createLayoutOverlay<T>(
  base: ReadonlyMap<string, T>,
  delta: ReadonlyMap<string, T>,
): LayoutOverlay<T> {
  return Object.freeze({
    base,
    delta,
    resolve: (nodeId: string): T | undefined =>
      delta.has(nodeId) ? delta.get(nodeId) : base.get(nodeId),
    has: (nodeId: string): boolean => delta.has(nodeId) || base.has(nodeId),
  });
}

export interface PresentationLayoutPublicationStoreOptions<T> {
  readonly getCanonicalBase: (
    rootKey: string,
  ) => ReadonlyMap<string, T> | undefined;
  readonly rootKeyForNode: (nodeId: string) => string | undefined;
  readonly initialCanonicalRevision?: number;
}

/**
 * targeted publication의 revision과 overlay를 보유한다.
 * applyTargetedGroup은 모든 검사를 끝낸 뒤에만 내부 상태를 변경한다.
 */
export class PresentationLayoutPublicationStore<T = ComputedLayout> {
  readonly #options: PresentationLayoutPublicationStoreOptions<T>;
  #canonicalRevision: number;
  readonly #overlays = new Map<string, LayoutOverlay<T>>();
  readonly #revisions = new Map<string, number>();

  constructor(options: PresentationLayoutPublicationStoreOptions<T>) {
    this.#options = options;
    this.#canonicalRevision = options.initialCanonicalRevision ?? 0;
    if (!isValidRevision(this.#canonicalRevision)) {
      throw new RangeError("initial canonical layout revision is invalid");
    }
  }

  get canonicalRevision(): number {
    return this.#canonicalRevision;
  }

  getRevision(rootKey: string): number | undefined {
    return this.#revisions.get(rootKey);
  }

  getOverlay(rootKey: string): LayoutOverlay<T> | undefined {
    return this.#overlays.get(rootKey);
  }

  applyCanonicalFull(publication: CanonicalFullLayoutPublication): boolean {
    if (
      publication.kind !== "canonical-full" ||
      !isValidRevision(publication.version) ||
      publication.version <= this.#canonicalRevision
    ) {
      return false;
    }
    this.#canonicalRevision = publication.version;
    this.#overlays.clear();
    this.#revisions.clear();
    return true;
  }

  applyTargetedGroup(
    publications: readonly PresentationTargetedLayoutPublication<T>[],
  ): boolean {
    if (publications.length === 0) return false;
    const planSequence = publications[0].planSequence;
    if (!isValidRevision(planSequence)) return false;

    const nextOverlays = new Map<string, LayoutOverlay<T>>();
    const nextRevisions = new Map<string, number>();
    const seenRootKeys = new Set<string>();

    for (const publication of publications) {
      if (
        publication.kind !== "presentation-targeted" ||
        publication.planSequence !== planSequence ||
        !isValidRevision(publication.presentationRevision) ||
        publication.baseCanonicalRevision !== this.#canonicalRevision ||
        seenRootKeys.has(publication.rootKey) ||
        publication.roots.length === 0 ||
        publication.affectedNodeIds.size === 0 ||
        publication.rootKey.length === 0
      ) {
        return false;
      }
      seenRootKeys.add(publication.rootKey);

      const previousRevision = this.#revisions.get(publication.rootKey) ?? -1;
      if (publication.presentationRevision <= previousRevision) return false;

      const base = this.#options.getCanonicalBase(publication.rootKey);
      if (!base) return false;

      for (const rootId of publication.roots) {
        if (
          this.#options.rootKeyForNode(rootId) !== publication.rootKey ||
          !base.has(rootId)
        ) {
          return false;
        }
      }
      for (const nodeId of publication.affectedNodeIds) {
        if (
          this.#options.rootKeyForNode(nodeId) !== publication.rootKey ||
          !base.has(nodeId)
        ) {
          return false;
        }
      }
      for (const nodeId of publication.layoutDelta.keys()) {
        if (
          !publication.affectedNodeIds.has(nodeId) ||
          this.#options.rootKeyForNode(nodeId) !== publication.rootKey
        ) {
          return false;
        }
      }

      nextOverlays.set(
        publication.rootKey,
        createLayoutOverlay(base, publication.layoutDelta),
      );
      nextRevisions.set(publication.rootKey, publication.presentationRevision);
    }

    for (const [rootKey, overlay] of nextOverlays) {
      this.#overlays.set(rootKey, overlay);
      this.#revisions.set(rootKey, nextRevisions.get(rootKey)!);
    }
    return true;
  }
}

export interface LayoutPublicationChannelOptions<T> {
  readonly getCanonicalBase: (
    rootKey: string,
  ) => ReadonlyMap<string, T> | undefined;
  readonly rootKeyForNode: (nodeId: string) => string | undefined;
  readonly initialCanonicalRevision?: number;
}

type CanonicalPublicationListener = (
  publication: CanonicalFullLayoutPublication,
) => void;
type TargetedPublicationListener<T> = (
  publications: readonly PresentationTargetedLayoutPublication<T>[],
) => void;

/** canonical/full과 presentation/targeted event를 서로 다른 listener lane으로 분리한다. */
export class LayoutPublicationChannel<T = ComputedLayout> {
  readonly #store: PresentationLayoutPublicationStore<T>;
  readonly #canonicalListeners = new Set<CanonicalPublicationListener>();
  readonly #targetedListeners = new Set<TargetedPublicationListener<T>>();

  constructor(options: LayoutPublicationChannelOptions<T>) {
    this.#store = new PresentationLayoutPublicationStore(options);
  }

  get canonicalRevision(): number {
    return this.#store.canonicalRevision;
  }

  getOverlay(rootKey: string): LayoutOverlay<T> | undefined {
    return this.#store.getOverlay(rootKey);
  }

  getRevision(rootKey: string): number | undefined {
    return this.#store.getRevision(rootKey);
  }

  publishCanonicalFull(version: number): CanonicalFullLayoutPublication | null {
    let publication: CanonicalFullLayoutPublication;
    try {
      publication = createCanonicalFullLayoutPublication(version);
    } catch {
      return null;
    }
    if (!this.#store.applyCanonicalFull(publication)) return null;
    for (const listener of this.#canonicalListeners) listener(publication);
    return publication;
  }

  publishPresentationTargeted(
    publications: readonly PresentationTargetedLayoutPublication<T>[],
  ): boolean {
    if (!this.#store.applyTargetedGroup(publications)) return false;
    for (const listener of this.#targetedListeners) listener(publications);
    return true;
  }

  onCanonicalFull(listener: CanonicalPublicationListener): () => void {
    this.#canonicalListeners.add(listener);
    return () => this.#canonicalListeners.delete(listener);
  }

  onPresentationTargeted(listener: TargetedPublicationListener<T>): () => void {
    this.#targetedListeners.add(listener);
    return () => this.#targetedListeners.delete(listener);
  }
}

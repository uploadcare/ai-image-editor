import type { UploadcareFile } from '@uploadcare/upload-client';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { AspectRatioValue } from '../../entities/aspect-ratio';
import type { AiEditorMode } from '../../entities/mode';
import type { HistoryEntry } from '../../features/generation';

/**
 * A persisted generation. Each result is one node, parent-linked to the image it
 * was derived from (`source`). A pure generate has no parent (`source: null`); an
 * edit points at the image that produced it. Following the parent links upward
 * (and child links downward) reconstructs a result's whole lineage — a tree, since
 * re-editing an older result branches it. The full {@link UploadcareFile} is kept
 * so the strip can rebuild its url/thumbnail offline, without re-fetching file info.
 */
export type HistoryNode = {
  /** Result file uuid — the node's identity (the storage map key). */
  uuid: string;
  /** Parent image uuid this result was derived from; `null` for a pure generate. */
  source: string | null;
  /** Raw CDN url of the result (secure-delivery signing happens at render time). */
  url: string;
  prompt: string;
  mode: AiEditorMode;
  /** Ratio selection that produced the result (incl. the "Original" sentinel). */
  ratio: AspectRatioValue | null;
  file: UploadcareFile;
  /** Epoch ms the node was recorded — drives newest-first ordering and eviction. */
  createdAt: number;
};

type NodeMap = Record<string, HistoryNode>;

/** Storage key prefix; the active pubkey is appended so projects don't share history. */
const KEY_PREFIX = 'uc-ai-image-editor/history';

/** Hard cap on persisted nodes (per pubkey). At ~1.5KB/node this stays well under
 *  localStorage's ~5MB budget; the oldest nodes are evicted past this. */
const MAX_NODES = 200;

/** Nodes older than this are dropped on the next write (7 days). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Persists generation history to `localStorage` so the result strip survives
 * reloads (standalone) and the activity unmounting (plugin). History is keyed by
 * file uuid, independent of which entry point opened the editor: when the editor
 * opens on a `source` uuid, {@link lineage} restores every result that shares that
 * image's lineage — so both flows rehydrate the same way.
 *
 * Reads/writes the store on demand (history changes are infrequent — only on open
 * and on each successful generation), so there's no in-memory mirror to keep in
 * sync. Every access is guarded: a throwing or absent `localStorage` (private mode,
 * SSR, quota) degrades to an in-memory-only session rather than an error.
 */
export class HistoryStorageController implements ReactiveController {
  /** Storage key for the active pubkey, or `null` when no pubkey is set (the
   *  editor is disabled without one, so history is neither read nor written). */
  private _key: string | null = null;

  public constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  public hostDisconnected(): void {}

  /** Namespace the store by pubkey. Passing an empty key disables persistence. */
  public setNamespace(pubkey: string): void {
    this._key = pubkey ? `${KEY_PREFIX}/${pubkey}` : null;
  }

  /** Upsert the result as a node and persist (evicting expired/overflowing nodes). */
  public record(input: Omit<HistoryNode, 'createdAt'>): void {
    const key = this._key;
    if (!key) return;
    const map = this._read(key);
    map[input.uuid] = { ...input, createdAt: Date.now() };
    this._write(key, this._evict(map));
  }

  /**
   * Persist the original source image as a root node (`source: null`), so it
   * survives reloads as the base of its lineage. Idempotent: keeps an existing
   * node untouched (preserving its ordering). New nodes are dated just before the
   * lineage's oldest entry so the source always sorts last (the base of the strip).
   */
  public recordSource(input: Omit<HistoryNode, 'createdAt' | 'source'>): void {
    const key = this._key;
    if (!key) return;
    const map = this._read(key);
    if (map[input.uuid]) return; // already stored — leave its ordering intact
    const oldest = Object.values(map).reduce((min, n) => Math.min(min, n.createdAt), Date.now());
    map[input.uuid] = { ...input, source: null, createdAt: oldest - 1 };
    this._write(key, this._evict(map));
  }

  /**
   * The history strip for `uuid`'s lineage, newest-first: every stored result
   * connected to it by parent/child links (so branches off an older result are
   * included). Returns `[]` when persistence is off or nothing is connected — incl.
   * the common case of opening on a freshly uploaded image with no prior edits.
   */
  public lineage(uuid: string | null): HistoryEntry[] {
    const key = this._key;
    if (!key || !uuid) return [];
    return this._component(this._read(key), uuid)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toEntry);
  }

  /** Nodes in `start`'s connected component, walking both parent and child edges.
   *  `start` may be a node itself or only a parent uuid (a source not yet edited). */
  private _component(map: NodeMap, start: string): HistoryNode[] {
    const childrenBySource = new Map<string, HistoryNode[]>();
    for (const node of Object.values(map)) {
      if (!node.source) continue;
      const siblings = childrenBySource.get(node.source);
      if (siblings) siblings.push(node);
      else childrenBySource.set(node.source, [node]);
    }

    const included: HistoryNode[] = [];
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      const node = map[id];
      if (node) {
        included.push(node);
        if (node.source) queue.push(node.source);
      }
      for (const child of childrenBySource.get(id) ?? []) queue.push(child.uuid);
    }
    return included;
  }

  /** Drop expired nodes, then the oldest beyond {@link MAX_NODES}. Dropping a
   *  middle node just orphans its descendants (their lineage walk stops early). */
  private _evict(map: NodeMap): NodeMap {
    const now = Date.now();
    let nodes = Object.values(map).filter((n) => now - n.createdAt < TTL_MS);
    if (nodes.length > MAX_NODES) {
      nodes = nodes.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_NODES);
    }
    const next: NodeMap = {};
    for (const node of nodes) next[node.uuid] = node;
    return next;
  }

  private _read(key: string): NodeMap {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as NodeMap) : {};
    } catch {
      return {};
    }
  }

  private _write(key: string, map: NodeMap): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(map));
    } catch {
      // Quota exceeded, disabled storage, etc. — keep the session in memory only.
    }
  }
}

/** A stored node as a strip entry. The result uuid is a stable, idempotent key
 *  (re-hydrating the same lineage yields identical ids). */
function toEntry(node: HistoryNode): HistoryEntry {
  return {
    id: node.uuid,
    prompt: node.prompt,
    mode: node.mode,
    url: node.url,
    file: node.file,
    ratio: node.ratio,
  };
}

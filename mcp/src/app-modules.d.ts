declare module "../../src/lib/syncRemote" {
  export const SYNC_URL: string;
  export const PUBLIC_KEY: string;
  export interface RemoteSessionInfo {
    userId: string;
    email: string;
  }
  export interface SyncCheckpoint {
    owner: string;
    revision: number;
    document: import("./types").SyncDocument;
  }
  export interface SyncRemoteInstance {
    login(email: string, password: string, keepSession?: boolean): Promise<{ id: string; email: string }>;
    restore(): Promise<{ id: string; email: string } | null>;
    logout(): Promise<void>;
    getSession(): RemoteSessionInfo | null;
    read(
      progress?: (done: number, total: number) => void,
      checkpoint?: SyncCheckpoint | null
    ): Promise<{ revision: number; document: import("./types").SyncDocument }>;
    commit(
      document: import("./types").SyncDocument,
      revision: number,
      progress?: (done: number, total: number) => void
    ): Promise<{ ok: boolean; revision: number }>;
  }
  export function createSyncRemote(options?: {
    fetcher?: typeof fetch;
    store?: {
      readRefreshToken(): Promise<string | null>;
      readRememberSession(): Promise<boolean>;
      saveRefreshToken(token: string | null, remember: boolean): Promise<void>;
    };
    hash?: (text: string) => Promise<string>;
    uuid?: () => string;
    url?: string;
    publicKey?: string;
    onSession?: ((info: { userId: string; email: string; refreshToken: string } | null) => Promise<void> | void) | null;
  }): SyncRemoteInstance;
}

declare module "../../src/lib/syncDocument" {
  export const COLUMNS: Record<string, string[]>;
  export const canonical: (value: unknown) => string;
  export const same: (a: unknown, b: unknown) => boolean;
  export function emptyDocument(): import("./types").SyncDocument;
  export function validateDocument(doc: unknown): import("./types").SyncDocument;
}

declare module "../../src/lib/folderTree" {
  export interface FolderLike {
    id: string;
    name: string;
    parent_id?: string | null;
  }
  export function folderPath<T extends FolderLike>(folders: T[], id: string | null | undefined): T[];
  export function canMoveFolder(folders: FolderLike[], id: string, parentId: string | null): boolean;
  export function validateFolderTree(folders: FolderLike[]): void;
  export function flattenFolders<T extends FolderLike>(folders: T[], parentId?: string | null, depth?: number): (T & { depth: number })[];
}

declare module "../../src/lib/queue" {
  export function startOfDay(date?: Date | string | number): Date;
  export function endOfDay(date?: Date | string | number): Date;
  export function buildDailyQueue<T extends { id: string; deck_id: string; due: string; state: number; suspended?: number }>(
    cards: T[],
    options?: {
      deckPriorities?: Record<string, number>;
      now?: Date;
      retryIds?: string[];
      limits?: { maxReviews?: number; maxNew?: number } | null;
    }
  ): T[];
}

declare module "../../src/lib/streak" {
  export function countStreak(datesDesc: string[], now?: Date): { days: number; activeToday: boolean };
}

declare module "../../src/lib/scheduler" {
  export interface FsrsState {
    due: string;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    learning_steps: number;
    state: number;
    last_review: string | null;
  }
  export function newCardState(now?: Date): FsrsState;
}

declare module "../../src/lib/search" {
  export function normalizeSearch(value?: string): string;
}

declare module "../../src/lib/richtext" {
  export function toPlainText(text?: string): string;
  export function hasRichContent(text?: string): boolean;
}

declare module "../../src/lib/generatedCardFormat" {
  export function compileGeneratedBack(value: unknown, depth?: number): string;
}

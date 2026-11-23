export interface FolderRow {
  name: string;
  created_at: string;
  parent_id: string | null;
}

export interface DeckRow {
  name: string;
  created_at: string;
  priority: number;
  icon: string | null;
  folder_id: string | null;
}

export interface TagRow {
  name: string;
}

export interface CardRow {
  deck_id: string;
  front: string;
  back: string;
  source: "manual" | "ai" | "hybrid";
  origin_card_id: string | null;
  created_at: string;
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
  starred: number;
  position: number | null;
  suspended: number;
}

export interface ReviewLogRow {
  card_id: string;
  rating: "again" | "hard" | "good";
  mode: "daily" | "quizlet";
  reviewed_at: string;
}

export interface ConnectionRow {
  card_id: string;
  final_text: string;
  transcript: string | null;
  hybrid_card_id: string | null;
  created_at: string;
}

export interface GymChatRow {
  title: string;
  origin_card_id: string | null;
  draft_text: string;
  created_at: string;
  updated_at: string;
}

export interface GymMessageRow {
  chat_id: string;
  role: "user" | "assistant" | "system";
  text: string;
  metadata: string | null;
  created_at: string;
}

export interface NoteRow {
  title: string;
  description: string;
  body: string;
  excerpt: string;
  icon: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface StudyPreferencesRow {
  max_reviews: number;
  max_new: number;
}

export type LinkPair = [string, string];

export interface SyncDocument {
  schema: 1;
  study_preferences: Record<string, StudyPreferencesRow>;
  folders: Record<string, FolderRow>;
  decks: Record<string, DeckRow>;
  tags: Record<string, TagRow>;
  cards: Record<string, CardRow>;
  review_logs: Record<string, ReviewLogRow>;
  connections: Record<string, ConnectionRow>;
  gym_chats: Record<string, GymChatRow>;
  gym_messages: Record<string, GymMessageRow>;
  notes: Record<string, NoteRow>;
  deck_tags: LinkPair[];
  note_decks: LinkPair[];
  note_folders: LinkPair[];
  note_tags: LinkPair[];
}

export interface RemoteSessionInfo {
  userId: string;
  email: string;
}

export interface SyncCheckpoint {
  owner: string;
  revision: number;
  document: SyncDocument;
}

export interface SyncRemoteInstance {
  login(email: string, password: string, keepSession?: boolean): Promise<{ id: string; email: string }>;
  restore(): Promise<{ id: string; email: string } | null>;
  logout(): Promise<void>;
  getSession(): RemoteSessionInfo | null;
  read(
    progress?: (done: number, total: number) => void,
    checkpoint?: SyncCheckpoint | null
  ): Promise<{ revision: number; document: SyncDocument }>;
  commit(
    document: SyncDocument,
    revision: number,
    progress?: (done: number, total: number) => void
  ): Promise<{ ok: boolean; revision: number }>;
}

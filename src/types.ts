export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  coupleId?: string;
}

export interface Couple {
  id: string;
  userIds: string[];
  createdAt: any;
  inviteCode: string;
  settings?: {
    coupleMode: boolean;
    persona: 'default' | 'spiritual';
  };
  featuredWallpaperId?: string;
}

export interface JournalEntry {
  id: string;
  coupleId: string;
  authorId: string;
  authorName: string;
  content: string;
  mood?: string;
  reflection?: string;
  audioData?: string; // Base64 audio for "Listen" feature
  conflictDetected?: boolean;
  coolingPrompt?: string | null;
  sentimentScore?: number;
  suggestedImagePrompt?: string | null;
  generatedImageUrl?: string | null;
  createdAt: any;
}

export interface Insight {
  id: string;
  coupleId: string;
  emotionalTemperature: string;
  heartbeat: string;
  activitySuggestion: string;
  patterns: string[];
  reflection: string;
  createdAt: any;
}

export interface Milestone {
  id: string;
  coupleId: string;
  title: string;
  date: string;
  type: 'anniversary' | 'first_date' | 'resolved_conflict' | 'other';
}

export interface TimeCapsule {
  id: string;
  coupleId: string;
  authorId: string;
  content: string;
  openDate: any;
  createdAt: any;
}

export interface MemoryWallpaper {
  id: string;
  coupleId: string;
  entryId: string;
  imageUrl: string;
  prompt: string;
  createdAt: any;
}

export interface DailyStory {
  id: string;
  coupleId: string;
  imageUrl: string;
  prompt: string;
  reflection: string;
  date: string;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

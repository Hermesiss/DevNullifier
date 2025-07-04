export interface Category {
  name: string;
  detectionFiles: string[];
  cachePatterns: string[];
}

export interface CacheMatch {
  path: string;
  relativePath: string;
  size: number;
  selected: boolean;
  categories: string[];
  patterns: string[];
}

export interface PatternGroup {
  pattern: string;
  category: string;
  matches: CacheMatch[];
  totalSize: number;
  selectedSize: number;
  expanded: boolean;
}

export interface Project {
  path: string;
  type: string;
  caches: PatternGroup[];
  totalCacheSize: number;
  lastModified: string | null;
}

export interface WorkerMessage {
  basePaths: string[];
  enabledCategories: Category[];
}

export type WorkerResponse =
  | { type: "current-path"; path: string }
  | { type: "project-found"; project: Project }
  | { type: "done"; projects: Project[] }
  | { type: "error"; error: string };

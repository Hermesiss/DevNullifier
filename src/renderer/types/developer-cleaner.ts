// Types for Developer Cleaner module

export interface CacheMatch {
  path: string;
  relativePath: string;
  size: number;
  selected: boolean;
}

export interface CacheGroup {
  pattern: string;
  category: CacheCategory;
  matches: CacheMatch[];
  totalSize: number;
  selectedSize: number;
  expanded: boolean;
}

export interface ProjectCache {
  projectPath: string;
  projectName: string;
  caches: CacheGroup[];
  totalSize: number;
  selectedSize: number;
}

// Category types for better type safety
export type CacheCategory =
  | "Python"
  | "Node.js / JS / TS"
  | "Rust"
  | "Java / Kotlin / Android"
  | ".NET / C#"
  | "C/C++"
  | "Xcode / iOS / macOS"
  | "Unity"
  | "Unreal Engine"
  | "PHP / Laravel"
  | "Symfony"
  | "ML / Data Science"
  | "Docker / DevOps"
  | "Static Site Generators"
  | "Testing Tools"
  | "IDEs / Editors";

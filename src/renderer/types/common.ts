export interface FolderItem {
  path: string;
  size: number;
}

export interface TreeItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  itemCount?: number;
  children: TreeItem[];
}

export interface FlatTreeItem {
  item: TreeItem;
  depth: number;
  isExpanded: boolean;
}

export interface DeleteResult {
  path: string;
  success: boolean | "partial";
}

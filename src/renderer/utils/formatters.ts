import { filesize } from "filesize";

export const formatSize = (bytes: number): string =>
  filesize(bytes, { base: 2, standard: "jedec" });

export const formatDate = (dateString: string): string => {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid Date";
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

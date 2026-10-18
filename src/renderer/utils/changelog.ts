export type ChangelogItem = {
  text: string;
  depth: number;
};

export type ChangelogSection = {
  title: string;
  items: ChangelogItem[];
};

export type ChangelogRelease = {
  version: string;
  label: string | null;
  sections: ChangelogSection[];
};

const RELEASE_HEADING = /^##\s+\[(\d+\.\d+\.\d+)\](?:\s*-\s*(.+))?$/;
const SECTION_HEADING = /^###\s+(.+)$/;
const BULLET = /^(\s*)[-*]\s+(.+)$/;

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const releaseMatch = RELEASE_HEADING.exec(line);
    if (releaseMatch) {
      release = {
        version: releaseMatch[1],
        label: releaseMatch[2]?.trim() || null,
        sections: []
      };
      releases.push(release);
      section = null;
      continue;
    }
    if (!release) continue;

    const sectionMatch = SECTION_HEADING.exec(line);
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }

    const bulletMatch = BULLET.exec(line);
    if (!bulletMatch || !section) continue;
    const text = bulletMatch[2].replace(/\*\*/g, "").trim();
    if (!text) continue;
    const indent = bulletMatch[1].replace(/\t/g, "  ").length;
    section.items.push({ text, depth: Math.floor(indent / 2) });
  }

  return releases
    .map(entry => ({
      ...entry,
      sections: entry.sections.filter(part => part.items.length > 0)
    }))
    .filter(entry => entry.sections.length > 0);
}

export function releasesForLocale(
  english: ChangelogRelease[],
  localized: ChangelogRelease[],
  locale: string
): ChangelogRelease[] {
  if (locale === "en") return english;
  const byVersion = new Map(localized.map(entry => [entry.version, entry]));
  return english.map(entry => byVersion.get(entry.version) ?? entry);
}

export function expandedReleaseIndex(releases: ChangelogRelease[], appVersion: string): number {
  if (releases.length === 0) return -1;
  const index = releases.findIndex(entry => entry.version === appVersion);
  return index >= 0 ? index : 0;
}

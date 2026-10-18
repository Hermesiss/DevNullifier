import { describe, expect, it } from "vitest";
import changelogEn from "../../../../CHANGELOG.md?raw";
import changelogRu from "../../../../CHANGELOG.ru.md?raw";
import pkg from "../../../../package.json";
import {
  expandedReleaseIndex,
  parseChangelog,
  releasesForLocale
} from "../changelog";

const sample = `
Intro stays out of the list.

## [1.7.2]

### Added

- About dialog

## [1.2.4] - Update Service

### Added

- **Update Service**: Check for updates
  - blockmaps

## [1.0.0] - Empty

### Added
`;

describe("parseChangelog", () => {
  it("reads versions, labels, sections, and nested items", () => {
    expect(parseChangelog(sample)).toEqual([
      {
        version: "1.7.2",
        label: null,
        sections: [{ title: "Added", items: [{ text: "About dialog", depth: 0 }] }]
      },
      {
        version: "1.2.4",
        label: "Update Service",
        sections: [
          {
            title: "Added",
            items: [
              { text: "Update Service: Check for updates", depth: 0 },
              { text: "blockmaps", depth: 1 }
            ]
          }
        ]
      }
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(parseChangelog("no releases here")).toEqual([]);
  });

  it("reads the same versions from both changelog files", () => {
    const english = parseChangelog(changelogEn).map(release => release.version);
    const russian = parseChangelog(changelogRu).map(release => release.version);
    expect(english[0]).toBe(pkg.version);
    expect(russian).toEqual(english);
  });
});

describe("releasesForLocale", () => {
  const english = parseChangelog(sample);

  it("keeps English when the locale is English", () => {
    const russian = parseChangelog("## [1.7.2]\n\n### Добавлено\n\n- Окно\n");
    expect(releasesForLocale(english, russian, "en")).toEqual(english);
  });

  it("uses a translated release and keeps English for the rest", () => {
    const russian = parseChangelog("## [1.7.2]\n\n### Добавлено\n\n- Окно\n");
    const merged = releasesForLocale(english, russian, "ru");
    expect(merged[0].sections[0].title).toBe("Добавлено");
    expect(merged[1]).toEqual(english[1]);
  });
});

describe("expandedReleaseIndex", () => {
  const releases = parseChangelog(sample);

  it("opens the installed version", () => {
    expect(expandedReleaseIndex(releases, "1.2.4")).toBe(1);
  });

  it("opens the newest release when the installed version has no notes", () => {
    expect(expandedReleaseIndex(releases, "9.9.9")).toBe(0);
  });

  it("opens nothing when the changelog is empty", () => {
    expect(expandedReleaseIndex([], "1.7.2")).toBe(-1);
  });
});

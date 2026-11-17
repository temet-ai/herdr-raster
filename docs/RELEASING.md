# Releasing Raster

Raster has nothing to build, but it is released the way
[radar](https://github.com/temet-ai/radar) is: one version, a changelog written for
the people who use it, a tag, and a GitHub release whose notes come from that
changelog. A release gives users a version to install, read about and go back to.

## Version

`mods/raster/mod.json`'s `version` is the one version, SemVer: a new feature raises
the minor (`0.2.0`), fixes alone the patch (`0.2.1`). Herdr shows it, and the release
workflow refuses a tag that disagrees with it. Tags are `v<version>` on `main`. Never
move a released tag or replace its assets; release the next version instead.

## What a release carries

- **Notes**: the version's section of `CHANGELOG.md`, then install and upgrade steps
  and the comparison link with the release before. `scripts/release-notes <version>`
  prints exactly what the release will say.
- **`raster-<version>.zip`**: `scripts/package` builds it with `git archive` from the
  tagged commit: `mods/raster`, `layouts/`, `keys.json`, the licences, README and
  CHANGELOG. Untracked local files (project logos, `gpui-kit.d.ts`, `*.error`) can't
  get in.
- **`checksums.txt`**: its SHA-256.

`.github/workflows/release.yml` runs on a `v*` tag: it checks the tag against
`mod.json`, writes the notes (stopping when the changelog has no section), checks
`main.js` parses, packages and publishes. `gh workflow run release.yml --ref main`
does all of that but the publish.

## Changelog

Each change a user would notice gets a line under `## Unreleased` as it lands, under
**New**, **Changed**, **Fixed**, **Security** or **Upgrading** (anything to do by
hand), leaving out empty headings. Write what they will see and anything they must
do, not the commit list: a bold lead sentence, then a sentence or two.

## Publishing checklist

1. On `main`: rename `## Unreleased` to `## <version> (<date>)` and open a new empty
   `## Unreleased` above it. Set `version` in `mods/raster/mod.json`, and the version
   the README's Install names. Run `scripts/release-notes <version>` and read it.
2. Check the mod in Herdr: copy `mods/raster/` into `~/.config/herdr-app/mods/raster/`,
   `herdr-app check ~/.config/herdr-app/mods/raster` ends in `check passed`, and
   `herdr-app shot` shows the sidebar as it should be.
3. Commit (`Raster <version>`), push, then tag and push the tag:
   `git tag -a v<version> -m "Raster <version>" && git push origin v<version>`.
4. Wait for the Release workflow, then open the release and read its notes.

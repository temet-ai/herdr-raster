# Changelog

What changed in each Raster release, for people who use it. Every release has a
section here before it is tagged; the release workflow publishes that section as the
release's notes and refuses a tag without one. Commit-level detail is in the
comparison link at the end of each release's notes.

Sections use these headings, leaving out any with nothing in them: **New**,
**Changed**, **Fixed**, **Security**, **Upgrading** (anything to do by hand).

## Unreleased

## 0.2.0 (2026-11-17)

### New

- **Agents in one tab are grouped.** When two or more agents share a tab, a bracket
  in the project's colour joins them under the tab's name. It breathes while any of
  them is working and rests when they're all idle.
- **Rename a tab from the sidebar.** Click the tab's name over its agents to edit it
  in place. Enter or clicking away keeps it, Escape drops it, and an empty name gives
  the tab its number back. It is Herdr's own rename, so the name shows wherever Herdr
  shows tabs.

### Fixed

- **Agents in a shared tab show what they're doing.** A named tab used to label
  every agent in it, so two agents in "tab 3" both read "tab 3". Now each shows its
  own title (Claude Code names itself after its task), and an agent with no title
  yet shows its program. A named tab still labels an agent that is alone in it.

### Upgrading

- Copy the new `mods/raster/` over the old one (see the README's Install); your
  project logos in `mods/raster/projects/` are kept.

## 0.1.0 (2026-11-16)

### New

- **First release.** One sidebar list with a card per machine, projects as headings
  with their logos and git state, and each project's agents and terminals under it,
  with their state and how long they've been in it. Alt+↑/↓ walk the list; machine
  cards reorder by drag; projects and machines fold.

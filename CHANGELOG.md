# Changelog

What changed in each Raster release, for people who use it. Every release has a
section here before it is tagged; the release workflow publishes that section as the
release's notes and refuses a tag without one. Commit-level detail is in the
comparison link at the end of each release's notes.

Sections use these headings, leaving out any with nothing in them: **New**,
**Changed**, **Fixed**, **Security**, **Upgrading** (anything to do by hand).

## Unreleased

### New

- **Agents that never titled themselves can show their session's name.** A Claude
  Code session started by a script often keeps the title "Claude Code". Point the
  new `statusDir` setting at a folder of its status-line JSON and Raster shows the
  session's `session_name` instead.

### Fixed

- **Machine cards no longer get stuck mid-drag.** A press on a card's header became a
  drag at once, and a release outside the sidebar never ended it, so the card stayed
  faded with a drop line following the pointer, and the shown machine's card filled
  with its rainbow. A drag now starts only once the pointer moves, ends when the
  pointer leaves the sidebar or you click elsewhere, and a dragged card is drawn
  without its rainbow.
- **Alt+↑/↓ follows the machine cards as drawn.** With more than one machine, the
  keys walked spaces in Herdr's own order, so after reordering the cards they jumped
  between machines and skipped some. They now go card by card, top to bottom.
- **A worktree's agents sit under its heading.** They were indented as far as the
  main checkout's agents, so they looked like part of the project above. They now
  step in as far as the worktree's heading does.
- **A worktree's branch isn't repeated beside its name.** A folder named
  `wright-fixes-2026-11-20` on branch `wright/fixes-2026-11-20` counted as a different name,
  so the branch showed next to it. Names that differ only in `/`, `-` or case now
  count as the same.
- **A project heading takes one line when it has no branch to show.** Its fold
  chevron sat on a second line under the rule by itself; it now ends the rule's line.

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

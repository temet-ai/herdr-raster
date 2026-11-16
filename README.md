# Herdr Raster

Raster shows which of your coding agents is working, waiting on you or done, on every
machine, in one sidebar list. It is a mod for the [Herdr](https://herdr.dev) desktop app,
for Herdr users with more than a couple of agents going at once. Herdr's own sidebar lists
spaces in one place and agents in another. Raster shows a card per machine, the projects
on it as headings, and each project's agents and terminals under it, with their state and
how long they've been in it. On one computer it is the same list without the machine cards.

![Herdr with Raster in the sidebar, using demo data: four machine cards (teapot, biscuit, gnome-garden and marmalade), each with its icon; projects such as MOON-CHEESE and SOCK-ORACLE as headings with their logos and branches; agents under them with a spinner, a "Needs you" pill or a done dot and the time in that state. On the right, the shown space's two agents: Claude Code counting craters, and Codex below it asking whether to accept the mice's treaty, which is the row tinted and marked "Needs you" in the sidebar](preview.png)

## How it differs from Herdr's sidebar

Herdr's own layout splits the sidebar in two: Spaces on top, Agents underneath. To know
which project an agent belongs to you look across both lists. Raster was made to put spaces and agents in one list, so you can see
where you are and move between agent sessions without hunting.

| | Herdr's sidebar | Raster |
| --- | --- | --- |
| Spaces and agents | Two lists, each scrolled on its own | One list: each agent and terminal sits under its project |
| Where you are | The shown space is highlighted | The machine's card has a moving rainbow edge, the project's line runs into it, and the focused agent's row is tinted in the project's colour |
| Moving between sessions | Alt+↑/↓ go to the previous or next agent in the Agents list, apart from the spaces | Alt+↑/↓ go one agent or terminal at a time, down the list as you see it, across projects and machines, skipping what you've folded; Herdr's next/previous-agent commands follow the same order |
| Machines | A group of spaces per machine | A card per machine, with an icon and colour for its OS, in the order you drag them into |
| One project, several spaces | One entry per space | One heading per checkout; a worktree sits under its checkout |
| A project at a glance | The space's letter | The repo's logo, its branch, and green or red when there's work to push or pull |

## What you can do with it

- **See which agent needs you.** Each agent is listed under its project, with its sub-agents
  under it: a spinner while it works, a "Needs you" pill when it is waiting on you, a dot
  when it's done, and the time in that state (`<1m`, `14m`, `3h`, `2d`). The states are the
  ones Herdr reports for each agent. Plain terminals (shells, editors, servers) follow, in
  a quieter grey.
- **See every machine as a card.** Each machine added to Herdr (`hc machine add`) gets a
  card with an icon and colour for what it is: Omarchy, macOS, Raspberry Pi, Windows (WSL),
  a container, FreeBSD, sixteen Linux distributions, or any other Linux. The card of the
  machine you're looking at has a slowly moving rainbow edge. A machine that is away says
  why ("unreachable", or "needs a login" with the `hc machine login` command to copy).
- **Put the cards in your order.** Drag a machine's header onto another card: the top half
  puts it above, the bottom half below. The order is kept.
- **See projects, not just spaces.** A project heading shows the repo's own logo in place of
  the space's letter. Two spaces in one checkout share one heading; a worktree's space sits
  under its checkout's heading. The branch shows when it isn't `main` or `master`, or when
  there is work to push (green) or pull (red).
- **Click to get there.** Click a project heading to show its space, an agent or terminal to
  focus its pane, a sub-agent to peek at it. Right-click a heading for Herdr's space menu.
  Click a machine's header to fold its card, or a project's chevron to fold the project; a
  folded project shows how many terminals it has and its most urgent state. The **+** on a
  machine's header starts a new space on that machine.
- **Walk the list with keys.** Alt+↑ and Alt+↓ move one agent or terminal at a time, in the
  order the list shows, and wrap at the ends. Herdr's own next/previous-agent commands
  (`agent.next`, `agent.prev`) follow the same order.
- **Narrow it to a rail.** Drag the sidebar under 160px wide and each space becomes a
  numbered cell, with a `●` when something in it is done or needs you.

## Install

Raster 0.1.0 is built from the Spaces mod of Herdr 0.1.15 and was checked on the Herdr
desktop app 0.1.16. It runs `git`, a one-off probe of each machine and a few other programs; see
[What it runs on your machines](#what-it-runs-on-your-machines) before you add it.

```sh
git clone https://github.com/temet-ai/herdr-raster.git
cp -r herdr-raster/mods/raster ~/.config/herdr-app/mods/
cp herdr-raster/layouts/main-raster.json ~/.config/herdr-app/layouts/
herdr-app check ~/.config/herdr-app/mods/raster
herdr-app do layout.switch '{"name":"main-raster"}'
```

`herdr-app check` should end with `check passed`. After the switch, the sidebar shows the
"Spaces" header and your spaces as project headings with their agents underneath.
`main-raster` is Herdr's own `main` layout with the spaces and agents lists replaced by
Raster; `ctrl-shift-l` switches back to any other layout.

For Alt+↑ and Alt+↓, merge the `layout:main-raster` section of this repository's
`keys.json` into `~/.config/herdr-app/keys.json` (Herdr's own keys file; edit it by hand):

```json
"layout:main-raster": { "alt-up": "raster.prev", "alt-down": "raster.next" }
```

## Use it in your own layout

Point your layout's spaces block at the mod:

```json
{ "id": "spaces", "type": "block", "size": { "weight": 1 }, "min": 90, "content": { "mod": "raster" } }
```

and give `keys.json` the same two keys in a section named after your layout,
`layout:<name>`.

## Layout settings

Both settings go in the block's `props`.

`cloneRoots` sets where Raster looks for clones on this computer, which it uses to find the
logo of a project that runs on another machine. The default is `~/projects`, `~/code`,
`~/src`, `~/dev`, `~/Developer`, `~/git`, `~/repos`, `~/work` and `~/Documents/github.com`.
Relative paths are under your home folder:

```json
"props": { "cloneRoots": ["/srv/src", "code"] }
```

`kinds` sets a machine's icon instead of detecting it. Give the machine's name (`local` for
this computer) and a kind, or `{ "kind": …, "host": … }` to also change the name this
computer shows under:

```json
"props": { "kinds": { "local": { "kind": "omarchy", "host": "teapot" }, "biscuit": "pi", "build-box": "ubuntu" } }
```

The kinds are `omarchy pi mac wsl docker freebsd ubuntu debian fedora arch endeavouros
manjaro nixos alpine opensuse linuxmint gentoo rocky almalinux centos rhel kali linux`.
Anything else gets Herdr's plain server icon.

## Project logos

The first time a repo shows, Raster looks in it for `.herdr/icon.svg` or `.herdr/icon.png`,
then an `icon` or `logo` file in the repo's root, `assets/`, `docs/assets/`, `.github/` or
`docs/`, then a favicon in the usual web folders. It keeps a 64px copy in
`~/.config/herdr-app/mods/raster/projects/<repo>.png`. To choose a logo yourself, put your
own PNG at that path; it wins over any found one.

## What it needs

- `git` on every machine whose spaces it shows.
- ImageMagick (`magick`) on this computer, for project logos. Without it, headings keep the
  space's letter.

## What it runs on your machines

Herdr asks you to know this before adding a mod. Raster runs programs and reads files
outside its own folder:

- **git, on the space's machine**: `rev-parse`, `symbolic-ref` and `rev-list` in each
  space's folder, to read the repo, branch and ahead/behind counts. It reads only refs, not
  the working tree. It looks again when a command or an agent's turn ends in that space,
  when a local repo's `.git` changes, when a machine comes back, and otherwise once a minute
  while the window is in front.
- **One probe per machine**, once: `uname`, `/proc/device-tree/model` and `/etc/os-release`,
  to tell what kind of machine it is.
- **One `find` on this computer**, once per run: it lists git repos up to five folders deep
  under the clone folders above and reads each one's `origin` URL.
- **A logo search and `magick`**, once per repo, writing the PNG into
  `~/.config/herdr-app/mods/raster/projects/`.
- **Herdr's `hc machine`**: `ls` every 15 seconds; `rm` and `add` only when you click
  **Connect** on a machine that was rebuilt.

Nothing reaches the internet. Commands on other machines go through Herdr's own connection
to them.

## Optional: "NEEDS YOU" from another mod

The "Needs you" pill works on its own, from Herdr's agent states. Separately, if another mod shares `fleet.live` in the form
`{ "<any>": { "seats": { "<terminal address>": { "needs": true } } } }`, those agents' rows
say "NEEDS YOU" in place of their time. Without it nothing changes.

## Licence

MIT (`LICENSE`). Raster started as a copy of the Spaces mod that ships with Herdr (0.1.15);
that code keeps Herdr's Apache License 2.0 (`LICENSE-APACHE`). Machine icons are from
[Simple Icons](https://simpleicons.org) (CC0), except the Omarchy mark, which is Omarchy's
own, and the four-pane Windows icon, drawn for this repo. The brands belong to their owners.

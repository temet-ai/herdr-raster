# Raster

The sidebar of the Herdr desktop app as one list of everything you run: a card per
machine, the projects on it as headings, and every agent and terminal under its
project with its state and how long it has been in it. The machine you're looking at
gets a slowly moving rainbow edge. Alt+↑/↓ walk the list agent by agent.

![Raster](preview.png)

## What you see

The mod fills the `spaces` block of the sidebar (268px wide in `main-raster`), on the
`chrome` background, top to bottom:

- **Header**, 31px: "Spaces" in 11.5px `dim` on the left, a 26px **+** (new space) on
  the right.
- **Machine cards**, 8px apart, inside 8px side padding. Each card has a 10px radius,
  4px padding, a 1px border in the machine's colour (`50` alpha, `c0` when the shown
  space is on it, `border` when the machine is away) and a fill of its colour at `0a`.
  Only once a second machine exists; with one computer the list has no cards.
  - **Machine header**, 32px: a 24px tile (radius 7, the machine's colour at `24`)
    holding a 14px icon of what the machine is, its name (12.5px medium), a **+**
    (new space there), a 6px dot (`ansi2` connected, `dim` away) and a fold chevron.
    Away machines say why ("unreachable", "needs login" with a copyable
    `hc machine login <name>`, or "rebuilt · Connect").
  - **Machine kinds**, each with its icon and colour: Omarchy (`accent`), Raspberry Pi
    `#d6336c`, macOS `#b4bcc6`, Windows/WSL `#3b8eea`, container `#2496ed`, FreeBSD
    `#c0392b`, Ubuntu `#e95420`, Debian `#d70a53`, Fedora `#51a2da`, Arch `#1793d1`,
    EndeavourOS `#7f7fff`, Manjaro `#35bf5c`, NixOS `#7eb6ff`, Alpine `#3a8fd6`,
    openSUSE `#73ba25`, Mint `#87cf3e`, Gentoo `#9c8fd8`, Rocky `#10b981`, AlmaLinux
    `#ff4649`, CentOS `#a14f8c`, Red Hat `#ee0000`, Kali `#557cf2`, any other Linux
    (Tux) `#e8b923`; anything else gets Herdr's server icon in `muted`.
  - **The shown space's card** has a rainbow edge instead of a border: 1.5px of a hue
    strip showing round an opaque inner card (radius 8.5).
- **Project headings**, 28px, 5px above each: an 18px tile (the repo's own logo, else
  the space's first letter in white bold 10.5px on the space's colour, radius 4), the
  name in capitals (monospace 11px semibold, at most 150px, `foreground` when shown
  else `muted`), then a 1.5px line in the space's colour along the top of the rest of
  the row: full colour and running on into the card's frame for the shown space, at
  `73` alpha and stopping short for the others. Under the line's right end, in
  monospace 10px: the branch when it isn't `main`/`master` or has work to push or pull
  (`ansi2` ahead, `ansi1` behind, `dim` in step), and the fold chevron.
  - A worktree's space sits under its checkout's heading, with a branch icon in place
    of the tile.
  - Several spaces in one checkout are one project: one heading, all their terminals
    under it.
- **Agent rows**, at least 24px, 16px in: the program's 14px icon, what the agent is
  doing (a tab name someone typed, else the agent's own title, else its program; its
  folder first when it's outside the project), wrapping to more lines rather than
  hiding; then the time in its state (monospace 10px `dim`: `<1m`, `14m`, `3h`, `2d`)
  and its status mark. Sub-agents follow under it with tree lines, 11px.
- **Terminal rows** (shells, editors, servers), 24px, quieter: icon, title in `muted`.
- **The selected terminal** gets a flat tint of its space's colour (`2b` alpha) from
  card frame to card frame; as the card's last row it fills to the card's bottom.

Narrower than 160px, the list becomes a rail: one 32px cell per space with its number
and a `●` when something in it is done or needs you.

## How it behaves

- **Agent status marks:** working is a 12px spinner in `working` turning every 0.9s;
  blocked is a "Needs you" pill (18px, 10.5px semibold `blocked` on `blocked` at
  15%); done is a 7px `done` dot; idle is a 7px ring (1.5px, `idle`). Done and idle
  share one clock for the time shown, kept across restarts.
- **Clicks:** a heading selects its space; an agent or terminal row focuses its pane;
  a sub-agent opens a peek of it; a chevron folds a space (a folded one shows its count
  and its most urgent state) or a machine; right-click a heading for Herdr's space
  menu; **+** makes a new space there.
- **Drag:** a heading onto another on the same machine moves the space (an accent line
  shows where). A machine's header onto another card puts the machine above it (top
  half) or below it (bottom half); the order is kept.
- **Keys:** `raster.next` / `raster.prev` move one row down or up: each agent and
  terminal is a stop, an empty or folded space is one, folded machines are skipped,
  it wraps. Herdr's own next/previous-agent keys follow the same order. `pane.go`
  left from the leftmost pane gives the list the keyboard (a 2px `accent` right edge);
  ↑/↓ walk it there, Enter, → or Esc go back to the pane.
- **What moves:** the rainbow strip slides (16s, linear, back and forth), spinners
  turn. Nothing else animates.
- **Git** is read when a space appears or moves, when a command or an agent's turn
  ends in it, when a machine comes back, when its `.git` changes (local repos), and
  otherwise once a minute while the window is in front.

## Built from

- `mods/raster/` (`main.js`, `mod.json` with `focusable: true`, `icons/`), cloned from
  Herdr's shipped `spaces` mod 0.1.15 with the agent rows of the shipped `agents` mod.
- `layouts/main-raster.json`: Herdr's `main` with the `spaces` and `agents` blocks
  replaced by one `spaces` block (`weight: 1`, `min: 90`) holding `{"mod": "raster"}`.
  Optional prop `cloneRoots`: folders searched for local clones (default `projects`,
  `code`, `src`, `dev`, `Developer`, `git`, `repos`, `work`, `Documents/github.com`
  under home).
- Shipped mods it borrows art from: `workspace-chrome` (`plus`, `chevron-*`,
  `spinner`, `branch`, `server`, `monitor` SVGs); `menu` for the right-click menu.
- `herdr` functions: `spaces machines panes agents terminals focused setAgentOrder run
  nextCommand openOverlay settings exec hc theme shared setShared watchFolder window
  layout appHome home`. Commands run: `space.select space.move space.new pane.focus
  pane.go terminal.peek app.settings`. `hc machine ls|rm|add`.
- Programs it runs: `git` (rev-parse, symbolic-ref, rev-list, on the space's machine),
  `sh` with `uname`, `cat`, `/etc/os-release` once per machine (to tell its kind),
  `find` once (local clones), `magick` (ImageMagick) to turn a found logo into a 64px
  PNG.
- Art: `icons/rainbow.png` (1200×1400 hue strip), `icons/corner-{tl,tr,bl,br}.svg`
  (10px corner masks), machine icons (Simple Icons, CC0; `omarchy.svg`,
  `raspberry-pi.svg`, `windows.svg` drawn here).

## Watch out

- **The rainbow edge:** GPUI clips square, so the strip shows at the corners. Paint
  10px corner masks in `chrome` over them. The strip is an `image` 1200px wide moved
  with `.loop("left", {from: -600, to: 0, period: 16000})`: no timer, and it stops
  when hidden.
- **The selected tint** is an absolute layer behind the row reaching 2.5px past the
  card's padding. A negative bottom margin instead collapses the card.
- **Project logos** are looked for once per run per repo: `.herdr/icon.{svg,png}`,
  then `icon`/`logo` in the root, `assets/`, `docs/assets/`, `.github/`, `docs/`, then
  favicons in the usual web folders. They're kept in `mods/raster/projects/<repo>.png`;
  a PNG put there by hand wins. A space on another machine uses the logo of the clone
  of the same repo on this one, matched by folder name or `origin`'s repo name.
- **Space order** is written back to Herdr (`space.move`) so the list, Herdr's own
  order and next/previous agent agree. Moves can lose a sync race with a remote
  machine; wait for its echo (1s) before trying again.
- **Machine kinds** are cached in the mod's `localStorage` (`machines.kinds`) by the
  machine's core id, so a machine rebuilt under the same name is asked again.
- **Optional:** if another mod shares `fleet.live` as `{ [any]: { seats: { [terminal
  address]: { needs: true } } } }`, those agent rows say "NEEDS YOU" in `blocked` in
  place of their time. Without it nothing shows.
- Assumes one sidebar copy; the keyboard commands reach shown copies only.

## Done when

- `herdr-app check mods/raster` passes and `layout.switch {"name": "main-raster"}`
  shows the list with no `*.error` file.
- With a remote machine connected, each machine is a card with its own icon and
  colour, and the shown space's card has the moving rainbow edge.
- A repo with a logo shows the logo on its heading; another shows its letter.
- An agent's row changes from spinner to "Needs you" to dot as it works, asks and
  finishes, and its time restarts at each change.
- Alt+↓ from the first row visits each agent and terminal in list order and wraps.
- Dragging a machine's header below another card moves it there and the order
  survives a restart.
- Narrowed under 160px, the sidebar shows numbered cells.

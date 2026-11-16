# Making the preview

`preview.png` is taken from a throwaway Herdr with pretend machines, repos and agents, so
no real work shows. The two scripts here make the pretend parts:

- `make-projects <dir>` makes nine whimsical repos in `<dir>` (moon-cheese, sock-oracle,
  goose-tax, dragon-dentistry, …), each pushed to a bare remote in `<dir>/.remotes`. Some
  have an `icon.svg` logo; sock-oracle and dragon-dentistry are on a branch ahead of their
  remote, cloud-knitting is one commit behind, and moon-cheese has a worktree on
  `crater-survey`. Keep `<dir>` out of any path containing `/.claude/`: Raster's clone
  search skips those.
- `fake-agent [--screen <file>] <app> <title> <state>[:<seconds>]…` names its terminal
  `<title>`, draws `<file>` as its screen (from `screens/`; colours written as bare `[…m`
  codes), and reports each state in turn with OSC 7501
  (`ESC]7501;state=working:app=<app> BEL`), holding the last one forever, so Herdr treats
  it as that agent.
- `screens/` holds the two sessions in the shot: Claude Code counting craters, and Codex
  asking whether to accept the mice's treaty (shown in a split below it, `pane.split`).

Around them:

- A Herdr core of its own: `HC_SESSION`, `XDG_*`, `HERDR_APP_HOME` and `HOME` pointed at a
  scratch folder with a short path (socket paths must stay under 107 bytes), so folders read
  `~/projects/…`. Set `"frame.welcomed": "finished"` in its `shared.json` before the first
  start, or the welcome covers the window.
- Pretend machines: more cores on the same computer, added with
  `hc machine add --via "env HC_SESSION=<s> XDG_RUNTIME_DIR=<dir> … sh -c" --name biscuit`.
  The layout's `kinds` prop gives each its look: teapot is Omarchy, biscuit a Raspberry Pi,
  gnome-garden Ubuntu, marmalade a Mac.
- Spaces made with `herdr-app do space.new` (`machine`, `folder`, `argv` running
  `fake-agent`, `focus: false`), the window opened where it won't be seen at 1720×1340,
  then `herdr-app shot`. The times are the age of each state as Raster saved it; a fresh
  demo shows `<1m` everywhere, so the shot waits until they've grown.

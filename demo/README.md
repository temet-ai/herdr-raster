# Making the preview

`preview.png` is taken from a throwaway Herdr with pretend machines, repos and agents, so
no real work shows. The two scripts here make the pretend parts:

- `make-projects <dir>` makes nine whimsical repos in `<dir>` (moon-cheese, sock-oracle,
  goose-tax, dragon-dentistry, …), each pushed to a bare remote in `<dir>/.remotes`. Some
  have an `icon.svg` logo; sock-oracle and dragon-dentistry are on a branch ahead of their
  remote, cloud-knitting is one commit behind, and moon-cheese has a worktree on
  `crater-survey`. Keep `<dir>` out of any path containing `/.claude/`: Raster's clone
  search skips those.
- `fake-agent <app> <title> <state>[:<seconds>]…` names its terminal `<title>` and reports
  each state in turn with OSC 7501 (`ESC]7501;state=working:app=<app> BEL`), holding the
  last one forever, so Herdr treats it as that agent.

Around them:

- A Herdr core of its own: `HC_SESSION`, `XDG_*` and `HERDR_APP_HOME` pointed at a scratch
  folder with a short path (socket paths must stay under 107 bytes).
- Pretend machines: more cores on the same computer, added with
  `hc machine add --via "env HC_SESSION=<s> XDG_RUNTIME_DIR=<dir> … sh -c" --name biscuit`.
  The layout's `kinds` prop gives each its look: teapot is Omarchy, biscuit a Raspberry Pi,
  gnome-garden Ubuntu, marmalade a Mac.
- Spaces made with `herdr-app do space.new` (`machine`, `folder`, `argv` running
  `fake-agent`, `focus: false`), the window opened where it won't be seen, then
  `herdr-app shot` and the sidebar cropped out.

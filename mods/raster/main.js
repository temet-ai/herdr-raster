// Raster: spaces with their agents in one sidebar list, a card per machine. Each space
// (its repo's logo or a colored tile, worktrees under their checkout) lists the agents
// working in it underneath, with their sub-agents, status and how long they've been in
// it. Click a space to switch, an agent to focus it; the chevron folds a space's agents.
// Right-click a space for its menu, drag to reorder; drag a machine's header to move
// its card. Cloned from Herdr's `spaces` mod (0.1.15); the agent rows come from `agents`.
// https://github.com/temet-ai/herdr-raster

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, agents, terminals, focused, setAgentOrder, run, nextCommand, openOverlay, settings, exec, hc, theme, shared, setShared, watchFolder, window, layout, appHome, home, props } from "herdr";

// Project icons: a repo's own logo in place of its letter. Kept as a 64px PNG in
// projects/<repo>.png here; put your own file there to choose one (it wins). Found in
// the repo the first time it shows: an icon or logo, else a favicon. A space on another
// machine uses the logo of the clone of the same repo (by name) on this one.
const MOD = "mods/raster";
const PROJECTS = `${MOD}/projects`;
const FIND_ICON = `cd "$1" 2>/dev/null || exit 1
for f in .herdr/icon.svg .herdr/icon.png icon.svg icon.png logo.svg logo.png \\
  assets/icon.svg assets/icon.png assets/logo.svg assets/logo.png docs/assets/*logo*.svg docs/assets/*logo*.png \\
  .github/*logo*.svg .github/*logo*.png .github/*icon*.png docs/*logo*.svg docs/*logo*.png \\
  favicon.svg favicon.png static/favicon.svg static/favicon.png public/favicon.svg public/favicon.png \\
  frontend/static/favicon.svg frontend/static/favicon.png frontend/public/favicon.svg frontend/public/favicon.png \\
  web/public/favicon.svg web/public/favicon.png app/icon.png; do
  [ -f "$f" ] && { printf '%s' "$f"; exit 0; }
done
exit 3`;
// Where local clones are looked for, for spaces on other machines: folders under home
// unless absolute. The layout can set its own with the prop `cloneRoots`.
const CLONE_ROOTS = ["projects", "code", "src", "dev", "Developer", "git", "repos", "work", "Documents/github.com"];
const safeName = (s) => s.replace(/[^\w.-]+/g, "_");

// What kind of computer a machine is, asked of it once (see detectKinds) and kept:
// its icon (icons/<icon>.svg) and color (a theme color name or #hex). Anything else
// gets Tux (Linux) or a plain server. Brand icons from Simple Icons (CC0).
const KINDS = {
  omarchy: { icon: "omarchy", color: "accent", label: "Omarchy" },
  pi: { icon: "raspberry-pi", color: "#d6336c", label: "Raspberry Pi" },
  mac: { icon: "apple", color: "#b4bcc6", label: "macOS" },
  wsl: { icon: "windows", color: "#3b8eea", label: "Windows (WSL)" },
  docker: { icon: "docker", color: "#2496ed", label: "Container" },
  freebsd: { icon: "freebsd", color: "#c0392b", label: "FreeBSD" },
  ubuntu: { icon: "ubuntu", color: "#e95420", label: "Ubuntu" },
  debian: { icon: "debian", color: "#d70a53", label: "Debian" },
  fedora: { icon: "fedora", color: "#51a2da", label: "Fedora" },
  arch: { icon: "archlinux", color: "#1793d1", label: "Arch Linux" },
  endeavouros: { icon: "endeavouros", color: "#7f7fff", label: "EndeavourOS" },
  manjaro: { icon: "manjaro", color: "#35bf5c", label: "Manjaro" },
  nixos: { icon: "nixos", color: "#7eb6ff", label: "NixOS" },
  alpine: { icon: "alpinelinux", color: "#3a8fd6", label: "Alpine" },
  opensuse: { icon: "opensuse", color: "#73ba25", label: "openSUSE" },
  linuxmint: { icon: "linuxmint", color: "#87cf3e", label: "Linux Mint" },
  gentoo: { icon: "gentoo", color: "#9c8fd8", label: "Gentoo" },
  rocky: { icon: "rockylinux", color: "#10b981", label: "Rocky Linux" },
  almalinux: { icon: "almalinux", color: "#ff4649", label: "AlmaLinux" },
  centos: { icon: "centos", color: "#a14f8c", label: "CentOS" },
  rhel: { icon: "redhat", color: "#ee0000", label: "Red Hat" },
  kali: { icon: "kalilinux", color: "#557cf2", label: "Kali" },
  linux: { icon: "linux", color: "#e8b923", label: "Linux" },
};
// os-release IDs that aren't a kind's own name.
const IDS = { "opensuse-tumbleweed": "opensuse", "opensuse-leap": "opensuse", raspbian: "pi" };
// One line each, always: system, host name, board model (Raspberry Pis), os-release ID,
// kernel release (WSL says "microsoft"), and whether it's a container.
const PROBE = 'uname -s; uname -n; cat /proc/device-tree/model 2>/dev/null | tr -d "\\000"; echo; if [ -r /etc/os-release ]; then (. /etc/os-release; echo "${ID:--}"); else echo -; fi; uname -r; [ -f /.dockerenv ] || [ -f /run/.containerenv ] && echo container || echo -';
function kindOf(out) {
  const [os = "", host = "", model = "", id = "-", release = "", box = "-"] = out.split("\n").map((s) => s.trim());
  const kind = os === "Darwin" ? "mac" : /raspberry pi/i.test(model) ? "pi" : /microsoft/i.test(release) ? "wsl"
    : box === "container" ? "docker" : os === "FreeBSD" ? "freebsd"
    : KINDS[IDS[id] ?? id] ? (IDS[id] ?? id) : os === "Linux" ? "linux" : "other";
  return { kind, host: host.replace(/\.local$/, ""), model, id: id === "-" ? null : id, os };
}
const machineMark = (m, info, size) => svg(info.icon ? `${MOD}/icons/${info.icon}.svg` : `mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(size).flex_none();

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. Never done: its parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function statusMark(t, status) {
  if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
  if (status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
  return div().size(7).mx(3).flex_none().rounded(4).bg(status === "done" ? t.done : t.dim + "00");
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const RAIL_CELL = 32;
const railCell = (el) => h_flex().flex_none().justify_center().child(el);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
// A space's color as drawn on its tile, its line and its selected agent.
const spaceFill = (w, t) => {
  const c = (shared("space.colors") ?? {})[w.id] ?? "ansi6";
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
};
const mono = () => settings().font_family ?? "JetBrains Mono";
// The machine card's inner padding: a selected agent's tint reaches past it to the frame.
const CARD_PAD = 2.5;

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    // A layout block's props come through props(), not init's argument.
    const given = props() ?? {};
    this.cloneRoots = Array.isArray(given.cloneRoots) ? given.cloneRoots : CLONE_ROOTS;
    // Machines whose kind (and, for this computer, name) you set rather than detect:
    // { "<machine>" | "local": "<kind>" | { kind, host } }.
    this.setKinds = given.kinds ?? {};
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
    for (const state of Object.values(this.reconnecting)) state.busy = false;
    this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    // Machine order, set by dragging a machine's card ("" is this computer); null: never set.
    this.machineOrder = JSON.parse(localStorage.getItem("machines.order") ?? "null");
    this.mPressed = undefined; // the machine being dragged (null is this computer)
    this.mOver = undefined;
    this.projectIcons = {}; // repo name -> its icon's path here, null: none (or looking)
    this.kinds = JSON.parse(localStorage.getItem("machines.kinds") ?? "{}");
    this.detecting = new Set();
    this.foldedSpaces = new Set(JSON.parse(localStorage.getItem("spaces.folded") ?? "[]"));
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.bySpace = new Map();
    this.shellsBySpace = new Map();
    this.ps = [];
    cx.timer.every(30000, (cx) => cx.notify());
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // Refresh only when the refs could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
    this.rows = [];
    this.collapsed = false;
    // Alt Left from the leftmost pane gives the list the keyboard ("focus", see
    // mod.json); Up/Down then walk it, Enter, Right or Escape go back to the pane.
    this.handle = cx.focus_handle();
    // raster.next / .prev (Alt Down / Up): one step down or up the list.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next" || c === "prev") this.step(c === "next" ? 1 : -1);
        if (c === "focus") this.handle.focus();
        cx.notify();
      }
    });
  }

  // The list as the keyboard walks it: each agent and terminal under an open space,
  // else the space itself. Folded machines are skipped.
  stops() {
    const remote = this.rows.some((r) => r.w.machine) || this.machines.length;
    return this.rows.filter((r) => !remote || !this.folded.has(r.w.machine ?? null)).flatMap((r) => {
      const under = this.collapsed || this.foldedSpaces.has(r.head?.id ?? r.w.id) ? [] : [
        ...(this.bySpace.get(r.w.id) ?? []).map((a) => a.pane),
        ...(this.shellsBySpace.get(r.w.id) ?? []).map((p) => p.pane),
      ];
      if (r.head && !this.collapsed) return under.map((pane) => ({ space: r.w.id, pane }));
      return under.length ? under.map((pane) => ({ space: r.w.id, pane })) : [{ space: r.w.id, pane: null }];
    });
  }

  step(by) {
    const list = this.stops();
    if (!list.length) return;
    const f = focused();
    let i = list.findIndex((s) => s.pane && s.pane === f?.pane);
    if (i === -1) i = list.findIndex((s) => s.space === f?.space);
    const next = list[(i + by + list.length) % list.length];
    if (next.pane) run("pane.focus", { pane: next.pane });
    else run("space.select", { id: next.space });
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
    for (const g of Object.values(this.git)) if (g && !g.linked && !(g.name in this.projectIcons)) this.findIcon(g, cx);
  }

  // A repo's icon: the one kept here, else found in the repo (or this machine's clone
  // of it) and kept. Asked once per run; null: none.
  findIcon(g, cx) {
    this.projectIcons[g.name] = null;
    cx.spawn(async (cx) => {
      try {
        const rel = `${PROJECTS}/${safeName(g.name)}.png`, dest = `${appHome()}/${rel}`;
        const ok = async () => (await exec("test", ["-s", dest])).code === 0;
        if (!(await ok())) {
          const [on, common] = JSON.parse(g.repo);
          const root = !on ? common.replace(/\/\.git\/?$/, "") : (await this.localClones())[g.name];
          if (!root) return;
          const found = await exec("sh", ["-c", FIND_ICON, "sh", root]);
          if (found.code !== 0 || !found.stdout) return;
          const src = `${root}/${found.stdout}`;
          await exec("mkdir", ["-p", `${appHome()}/${PROJECTS}`]);
          await exec("magick", [...(src.endsWith(".svg") ? ["-background", "none", "-density", "384"] : []), src,
            "-resize", "64x64", "-background", "none", "-gravity", "center", "-extent", "64x64", dest]);
          if (!(await ok())) return;
        }
        this.projectIcons[g.name] = rel;
        cx.notify();
      } catch {}
    });
  }

  // Repos cloned on this computer, by folder name and by their origin's repo name
  // (temet-proxy is temet-ai/mike); folder names win, then the first found.
  localClones() {
    this.clones ??= (async () => {
      const roots = this.cloneRoots.map((r) => (r.startsWith("/") ? r : `${home()}/${r}`));
      // -H: a clone folder that is itself a symlink (~/projects -> /data/projects) is followed.
      const script = `find -H "$@" -maxdepth 5 -name .git -prune -print 2>/dev/null | grep -v '/\\.claude/' | while read -r g; do
  r=\${g%/.git}; o=$(git -C "$r" remote get-url origin 2>/dev/null); printf '%s\\t%s\\n' "$r" "$o"; done`;
      const r = await exec("sh", ["-c", script, "sh", ...roots], { timeout: 30000 });
      const byFolder = {}, byOrigin = {};
      for (const line of r.stdout.split("\n")) {
        const [root, origin = ""] = line.split("\t");
        const name = root?.split("/").pop();
        if (!name) continue;
        byFolder[name] ??= root;
        const remote = origin.replace(/\/+$/, "").replace(/\.git$/, "").split(/[/:]/).pop();
        if (remote) byOrigin[remote] ??= root;
      }
      return { ...byOrigin, ...byFolder };
    })();
    return this.clones;
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      this.detectKinds(cx);
      cx.notify();
    });
  }

  // Asks each connected machine not yet known what it is, once; kept across restarts.
  // A machine replaced under the same name is asked again (its core id changes).
  detectKinds(cx) {
    const wanted = [{ key: "local", on: null, id: null }, ...this.machines.filter((m) => m.state === "connected").map((m) => ({ key: m.name, on: m.name, id: m.id }))];
    for (const { key, on, id } of wanted) {
      if ((this.kinds[key] && this.kinds[key].core === id) || this.detecting.has(key)) continue;
      this.detecting.add(key);
      cx.spawn(async (cx) => {
        try {
          const r = await exec("sh", ["-c", PROBE], { on, timeout: 10000 });
          if (r.code === 0) {
            this.kinds[key] = { ...kindOf(r.stdout), core: id };
            localStorage.setItem("machines.kinds", JSON.stringify(this.kinds));
            cx.notify();
          }
        } catch {}
        this.detecting.delete(key);
      });
    }
  }

  // How a machine shows: its name (this computer: its host name), icon, color, and
  // what it is (for the tooltip).
  machineInfo(m) {
    const set = this.setKinds[m ?? "local"];
    const found = set ? { ...this.kinds[m ?? "local"], ...(typeof set === "string" ? { kind: set } : set) } : this.kinds[m ?? "local"];
    const look = KINDS[found?.kind] ?? { icon: null, color: "muted", label: found?.id ?? found?.os ?? "Server" };
    return { ...look, name: m ?? found?.host ?? "This computer", about: found?.model || look.label };
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        await Promise.all(keys.map((key) => this.check(key, cx)));
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // Ref-only reads avoid scanning the worktree or waking its index watch.
      // Two reads: a folder name may itself contain a newline.
      const [r, common] = await Promise.all([
        exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel"], { cwd, on }),
        exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on }),
      ]);
      if (r.code !== 0 || common.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.code !== 0 ? r.stderr : common.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = r.stdout.replace(/\n$/, ""), repo = common.stdout.replace(/\n$/, "");
      const [branch, counts] = await Promise.all([
        exec("git", ["symbolic-ref", "-q", "HEAD"], { cwd, on }),
        exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on }),
      ]);
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
      const info = { name, branch: branch.code === 0 ? branch.stdout.trim().replace(/^refs\/heads\//, "") : "(detached)", ahead, behind, repo: JSON.stringify([on, repo]), linked: repo !== `${top}/.git` };
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose spaces are listed (after the first of its spaces)
    for (const r of list) {
      if (nested(r) || (r.g && !r.g.linked && placed.has(r.g.repo))) continue;
      // Other spaces in the same checkout are the same project: their terminals go
      // under this space's heading (`head`), with no heading of their own.
      const same = r.g && !r.g.linked ? list.filter((k) => k !== r && k.g && !k.g.linked && k.g.repo === r.g.repo) : [];
      out.push({ ...r, tree: null, members: same.map((k) => k.w) });
      if (!r.g || r.g.linked) continue;
      placed.add(r.g.repo);
      same.forEach((k) => out.push({ ...k, tree: null, head: r.w }));
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    // Simulate the batch so later indexes include earlier moves. An attempted
    // write can lose a sync conflict: allow the echo to settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < out.length; i++) {
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // Machines in the order dragged into; any not placed yet go after, by name. Until
  // a machine is first dragged: this computer, connected machines, then the rest.
  sortMachines(names) {
    const saved = this.machineOrder;
    const rank = (m) => {
      if (saved) { const i = saved.indexOf(m ?? ""); return i === -1 ? 1e6 : i; }
      return m === null ? 0 : this.machines.find((k) => k.name === m)?.state === "connected" ? 1 : 2;
    };
    return [...names].sort((a, b) => rank(a) - rank(b) || String(a ?? "").localeCompare(String(b ?? "")));
  }

  moveMachine(names, src, dest, after) {
    const list = names.filter((m) => m !== src);
    const at = list.indexOf(dest) + (after ? 1 : 0);
    list.splice(at, 0, src);
    this.machineOrder = list.map((m) => m ?? "");
    localStorage.setItem("machines.order", JSON.stringify(this.machineOrder));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    this.rows = rows;
    this.collapsed = collapsed;
    setAgentOrder(rows.flatMap((r) => (this.bySpace.get(r.w.id) ?? []).map((a) => a.address)));
    // `end`: the card's last space, whose last row fills to the card's bottom when selected.
    const draw = (r, end) => (collapsed ? [this.compact(r, t)]
      : r.head ? (this.foldedSpaces.has(r.head.id) ? [] : this.agentRows(r.w, t, end))
      : [this.row(r, t), ...this.agentRows(r.w, t, end && !r.members?.length)]);
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => h_flex().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).items_center().when(collapsed, el => el.justify_center()).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) return loading(null) && !rows.length ? [loadingRow(null)] : rows.flatMap((r) => draw(r, false));
    const machineNames = this.sortMachines([null, ...remote]);
    return machineNames.flatMap((m, mi) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const login = machine?.state === "needs_login" ? `hc machine login ${m}` : null;
      const folded = this.folded.has(m);
      const info = this.machineInfo(m);
      const tint = info.color.startsWith("#") ? info.color : (t[info.color] ?? t.muted);
      const label = info.name;
      const icon = machineMark(m, info, 13).text_color(connected ? tint : t.dim);
      const tile = h_flex().size(24).flex_none().rounded(7).items_center().justify_center()
        .bg((connected ? tint : t.dim) + "24").child(machineMark(m, info, 14).text_color(connected ? tint : t.dim));
      const badge = div().absolute().right(-3).bottom(-2).size(6).rounded(3).border_1().border_color(t.chrome).bg(connected ? t.ansi2 : t.dim);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(collapsed ? 26 : 32).flex_none().px(collapsed ? 0 : 6).gap(collapsed ? 7 : 9).items_center().text_size(11).text_color(t.dim)
        .when(!collapsed, el => el.rounded(7).tooltip(info.about))
        .when(collapsed, el => el.mt(4).w(RAIL_CELL).justify_center().rounded(6).tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : `${label} · ${info.about}${m ? ` · ${connected ? "connected" : (machine?.state ?? "asleep").replace(/_/g, " ")}` : ""}`))
        .cursor_pointer().hover(s => s.bg(t.hover))
        .when(!collapsed, el => el.on_mouse_down("left", () => { this.mPressed = m; this.mOver = m; }))
        .on_click((_e, cx) => {
          if (collapsed && login) { run("app.settings", { section: "machines" }); return; }
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .when(!collapsed, el => el.child(tile))
        .when(collapsed, el => el.child(div().relative().flex_none().child(icon).when(Boolean(m), el => el.child(badge))))
        .when(!collapsed, el => el.child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(connected ? t.foreground : t.muted).child(label))
          .when(!connected && !rebuilt && !login, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
            .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect"))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => run("space.new", { machine: m ?? "" }))
        .when(collapsed, el => el.w(RAIL_CELL).rounded(6).justify_center().tooltip(`New space on ${m ?? "this computer"}`)
          .child(h_flex().size(18).rounded(5).border_1().border_color(t.dim).items_center().justify_center()
            .child(svg("mods/workspace-chrome/plus.svg").size(10))))
        .when(!collapsed, el => el.child(svg("mods/workspace-chrome/plus.svg").size(12)).child("New space there"));
      // Wide, each machine is a card edged in its color: strongest around the shown
      // space's machine, faint when the machine isn't connected.
      const here = mine.some((r) => r.w.active);
      const edge = !connected ? t.border : here ? tint + "c0" : tint + "50";
      const plain = (kids) => [v_flex().id(`machine-card-${m ?? "local"}`).flex_none().mt(8).p(4).gap(1)
        .rounded(10).border_1().border_color(edge).bg(connected ? tint + "0a" : t.foreground + "05").children(kids)];
      // The shown space's machine gets a rainbow edge instead: a wide hue strip slides
      // back and forth natively (`loop`, no timer) behind an opaque inner card, and the
      // 1.5px gap between them is the border.
      const rainbow = (kids) => [div().id(`machine-card-${m ?? "local"}`).relative().flex_none().mt(8).p(1.5)
        .rounded(10).overflow_hidden()
        .child(image(`${MOD}/icons/rainbow.png`).absolute().top(0).left(-600).w(1200).h(1400)
          .loop("left", { from: -600, to: 0, period: 16000, easing: "linear" }))
        .child(v_flex().relative().rounded(8.5).bg(t.chrome).child(v_flex().p(2.5).gap(1).rounded(8.5).bg(tint + "0a").children(kids)))
        // The clip is square, so each corner is painted over in the sidebar's color.
        .children(["tl", "tr", "bl", "br"].map((c) => svg(`${MOD}/icons/corner-${c}.svg`).absolute().size(10)
          .text_color(t.chrome).when(c[0] === "t", (el) => el.top(0)).when(c[0] === "b", (el) => el.bottom(0))
          .when(c[1] === "l", (el) => el.left(0)).when(c[1] === "r", (el) => el.right(0))))];
      // Drag a machine's header onto another card to move it there: above it from the
      // card's top half, below it from the bottom half. A lavender line shows where.
      const drag = (cards) => [div().id(`machine-drop-${m ?? "local"}`).relative().flex_none().mt(8)
        .when(this.mPressed === m && this.mOver !== m, (el) => el.opacity(0.5))
        .when(this.mPressed !== undefined && this.mOver === m && this.mPressed !== m, (el) => el.child(
          div().absolute().left(4).right(4).h(2).rounded(1).bg(t.accent)
            .when(this.mAfter, (line) => line.bottom(-5)).when(!this.mAfter, (line) => line.top(-5))))
        .on_mouse_move((e, cx) => {
          if (this.mPressed === undefined) return;
          const after = e.local_position.y > e.bounds.height / 2;
          if (this.mOver !== m || this.mAfter !== after) { this.mOver = m; this.mAfter = after; cx.notify(); }
        })
        .on_mouse_up("left", (_e, cx) => {
          const src = this.mPressed;
          this.mPressed = this.mOver = undefined;
          if (src !== undefined && src !== m) this.moveMachine(machineNames, src, m, this.mAfter);
          cx.notify();
        })
        .children(cards.map((c) => c.mt(0)))];
      const card = (kids) => collapsed ? kids : drag(connected && here ? rainbow(kids) : plain(kids));
      if (!collapsed && rebuilt) return card([head]);
      const cell = collapsed ? railCell : (el) => el;
      const guidance = !collapsed && login ? [v_flex().px(8).pb(6).gap(3).flex_none()
        .child(div().text_size(11).text_color(t.blocked).child("needs a login: run"))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1().min_w(0).truncate().tooltip(login).text_size(11).text_color(t.muted).child(login))
          .child(div().id(`machine-login-copy-${m}`).flex_none().px(5).py(2).rounded(4)
            .text_size(11).text_color(t.foreground).bg(t.raised).cursor_pointer().hover(s => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); this.copiedLogin = login; cx.notify(); })
            .child(this.copiedLogin === login ? "Copied" : "Copy")))] : [];
      return card([cell(head), ...guidance, ...(folded ? [] : mine.length ? mine.flatMap((r, i) => draw(r, i === mine.length - 1)) : [loading(m) ? loadingRow(m) : cell(empty)])]);
    });
  }

  // The branch under the space's line: shown off main/master (and when the space's name
  // isn't already it, as a worktree's is), or on it when there's work to push or pull.
  // No counts: its color is the state. Green, unpushed work; red, behind; grey, in step.
  branchOf(g, name, t) {
    if (!g) return null;
    const b = g.branch ?? "detached";
    const plain = b === "main" || b === "master" || b.toLowerCase() === name.toLowerCase();
    if (plain && !(g.ahead > 0) && !(g.behind > 0)) return null;
    return { b, color: g.ahead > 0 ? t.ansi2 : g.behind > 0 ? t.ansi1 : t.dim };
  }

  row({ w, i, g, tree, members = [] }, t) {
    const on = w.active || members.some((m) => m.active);
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const fill = spaceFill(w, t);
    const br = this.branchOf(g, w.name, t);
    const fold = [w, ...members].some((m) => this.bySpace.has(m.id) || this.shellsBySpace.has(m.id));
    // A heading, not a row: tile, name in capitals, and a line along the top. The shown
    // space's line is its color and runs into the card's frame; the rest stop short, dim.
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .mt(5)
      .pt(3)
      .h(28)
      .flex_none()
      .rounded(6)
      .hover((s) => s.bg(t.hover))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, line => line.bottom(0))
          .when(fromIndex > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex()
          .items_start()
          .when(Boolean(tree), el => el.pl(22).child(h_flex().size(18).flex_none().items_center().justify_center()
            .child(svg("mods/workspace-chrome/branch.svg").size(13).text_color(t.dim))))
          .when(!tree && Boolean(this.projectIcons[g?.name]), el => el.child(div().size(18).flex_none().rounded(4).overflow_hidden()
            .child(image(this.projectIcons[g.name]).size(18))))
          .when(!tree && !this.projectIcons[g?.name], el => el.child(h_flex().size(18).flex_none().rounded(4).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...w.name][0]?.toUpperCase() ?? "?")))
          .child(div().ml(7).mr(8).flex_none().max_w(150).truncate().font_family(mono()).text_size(11).font_semibold()
            .text_color(on ? t.foreground : t.muted).child(w.name.toUpperCase()))
          .child(v_flex().flex_1().min_w(12).gap(3)
            // The shown space's line carries on past the row's padding into the frame.
            .child(div().relative().h(1.5).bg(on ? fill : fill + "73")
              .when(on, (el) => el.child(div().absolute().top(0).right(-8 - CARD_PAD).w(8 + CARD_PAD).h(1.5).bg(fill))))
            .child(h_flex().min_w(0).gap(6).justify_end().items_center().font_family(mono()).text_size(10)
              .when(Boolean(br), (el) => el.child(div().min_w(0).truncate().text_color(br.color).child(br.b)))
              .when(fold, (el) => el.child(this.spaceFold(w, t, members))))),
      );
  }

  // The chevron that folds a space's agents. Folded, it says how many and shows
  // the most urgent one's state.
  spaceFold(w, t, members = []) {
    const open = !this.foldedSpaces.has(w.id);
    const list = [w, ...members].flatMap((m) => [...(this.bySpace.get(m.id) ?? []), ...(this.shellsBySpace.get(m.id) ?? [])]);
    return h_flex().id(`space-fold-${w.id}`).flex_none().h(18).px(3).gap(4).items_center().rounded(4)
      .text_size(11).text_color(t.dim).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(open ? "Hide its terminals" : `Show ${list.length} terminal${list.length === 1 ? "" : "s"}`)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_up("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        open ? this.foldedSpaces.add(w.id) : this.foldedSpaces.delete(w.id);
        localStorage.setItem("spaces.folded", JSON.stringify([...this.foldedSpaces]));
        cx.notify();
      })
      .when(!open && w.status && w.status !== "idle", (el) => el.child(statusMark(t, w.status === "blocked" ? "done" : w.status)
        .when(w.status === "blocked", (m) => m.bg(t.blocked))))
      .when(!open, (el) => el.child(String(list.length)))
      .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none());
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(addr, lead = []) {
    const kids = this.all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [{ t: k, lines: [...lead, last ? "└" : "├"] }, ...this.tree(k.address, [...lead, last ? "" : "│"])];
    });
  }

  // What an agent is doing, in a few words: a tab someone named, else the agent's
  // own title (Claude Code titles itself after the task), else its program. Its
  // folder goes in front when it isn't the space's. A tab's name speaks for an agent
  // only when it is the tab's one agent: two agents in one named tab each showed the
  // tab's name and nothing of their own (2026-11-17).
  agentLabel(a, w) {
    const tab = (w.tabs ?? []).find((x) => x.id === a.tab);
    const p = this.paneByTerminal.get(a.address);
    const prog = a.program?.name ?? "";
    const live = clean(p?.title ?? a.title);
    const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== a.program?.key;
    const alone = (this.bySpace.get(w.id) ?? []).filter((x) => x.tab === a.tab).length < 2;
    const what = tab?.named && (alone || !telling) ? tab.name : telling ? live : prog || a.title || a.address;
    return { what, folder: this.elsewhere(p?.cwd, w), cwd: p?.cwd ?? "" };
  }

  // A terminal's folder, named only when it is outside where its space is (its first
  // terminal's folder): a subfolder of the space isn't news.
  elsewhere(cwd, w) {
    const trim = (s) => (s ?? "").replace(/\/+$/, "");
    const at = trim(cwd), home = trim(place(w, this.ps));
    if (!at || !home || at === home || at.startsWith(home + "/")) return null;
    return base(at) || at;
  }

  // Under a space: its agents (with their sub-agents), then its other terminals.
  // `end`: these are the card's last rows, so the very last one meets the card's bottom.
  agentRows(w, t, end) {
    const list = this.bySpace.get(w.id) ?? [];
    const shells = this.shellsBySpace.get(w.id) ?? [];
    if ((!list.length && !shells.length) || this.foldedSpaces.has(w.id)) return [];
    const items = [
      ...list.flatMap((a) => [{ a }, ...this.tree(a.address).map((s) => ({ s }))]),
      ...shells.map((p) => ({ p })),
    ];
    return items.map((it, i) => {
      const last = end && i === items.length - 1;
      return it.a ? this.agentRow(it.a, w, t, last) : it.s ? this.subRow(it.s, t) : this.shellRow(it.p, w, t, last);
    });
  }

  // The selected terminal: an even tint of its space's color from frame to frame; as
  // the card's last row it also fills down to the card's bottom edge. Drawn as a layer
  // behind the row, not with negative margins: a negative bottom margin collapses the
  // card (seen 2026-11-11). Called before the row's own children so it paints first.
  selected(el, w, t, last) {
    return el.relative().rounded(0).child(div().absolute().top(0).left(-CARD_PAD).right(-CARD_PAD)
      .bottom(last ? -CARD_PAD : 0).bg(spaceFill(w, t) + "2b").when(last, (e) => e.rounded_b(8.5)));
  }

  // A terminal that isn't an agent: a shell, an editor, a server. Quieter than agents.
  shellRow(p, w, t, last) {
    const pic = icon(p.program, 14, t.muted);
    const prog = p.program?.name ?? "";
    const live = clean(p.title);
    const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== p.program?.key;
    const folder = this.elsewhere(p.cwd, w);
    return h_flex()
      .id(`term-${p.pane}`)
      .h(24).pl(16).pr(8).flex_none().rounded(6).items_center().gap(9).text_size(11.5)
      .when(p.focused, (el) => this.selected(el, w, t, last))
      .hover((s) => s.bg(t.hover))
      .cursor_pointer()
      .tooltip([p.cwd, prog].filter(Boolean).join("\n"))
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      // Somewhere else than its space, the folder is the news: it leads, the program follows.
      .child(h_flex().flex_1().min_w(0).gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().text_color(p.focused ? t.foreground : t.muted)
          .child(folder ?? (telling ? live : prog || "terminal")))
        .when(Boolean(folder), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(telling ? live : prog))));
  }

  agentRow(a, w, t, last) {
    const pic = icon(a.program, 14, t.foreground);
    const { what, folder, cwd } = this.agentLabel(a, w);
    const when = this.changed[a.address]?.at;
    const quiet = a.status === "idle" && !a.focused;
    const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
    return h_flex()
      .id(`ag-${a.address}`)
      // The icon sits under the space's avatar; the name gets the width and wraps to a
      // second line rather than lose itself behind the time and status.
      // Everything lines up with the name's first line, however many lines it takes.
      // Indented a step in from the space's tile (8): 16, then the icon and the text.
      .min_h(24).py(3).pl(16).pr(8).flex_none().rounded(6).items_start().gap(9).text_size(11.5)
      .when(a.focused, (el) => this.selected(el, w, t, last))
      .hover((s) => s.bg(t.hover))
      .cursor_pointer()
      .tooltip([cwd, `${a.program?.name ?? ""} · ${machine ? `${machine} · ` : ""}tab ${a.tab_name}`].filter(Boolean).join("\n"))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .when(Boolean(pic), (el) => el.child(h_flex().h(18).flex_none().items_center().child(pic)))
      .child(div().flex_1().min_w(0).whitespace_normal()
        .text_color(quiet ? t.muted : t.foreground)
        .child(folder ? `${folder} · ${what}` : what))
      .child(h_flex().h(18).flex_none().gap(5).items_center()
        // A fleet seat with an ask for you says so in place of its time.
        .when(Boolean(this.fleetSeats?.[a.address]?.needs), (el) => el.child(div().font_family(mono()).text_size(10).text_color(t.blocked).child("NEEDS YOU")))
        .when(Boolean(when) && !this.fleetSeats?.[a.address]?.needs, (el) => el.child(div().font_family(mono()).text_size(10).text_color(t.dim).child(duration(Date.now() - when))))
        .child(statusMark(t, a.status)));
  }

  subRow(s, t) {
    const k = s.t;
    const pic = icon(k.program, 13, t.foreground);
    const on = k.address === this.shownAgent;
    return h_flex()
      .id(`sub-${k.address}`)
      .h(24).pl(16).pr(8).flex_none().rounded(7).items_center().text_size(11)
      .when(on, (el) => el.bg(t.raised))
      .hover((x) => x.bg(t.hover))
      .cursor_pointer()
      .on_click(() => run("terminal.peek", { terminal: k.address }))
      .children(s.lines.map((l) => div().self_start().mt(-4).w(9).h(16).mr(4).flex_none()
        .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", (el) => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), (el) => el.child(div().mr(7).child(pic)))
      .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .child(statusMark(t, kidStatus(k, this.listed)));
  }

  compact({ w, i }, t) {
    return railCell(h_flex()
      .id(`space-${w.id}`)
      .relative()
      .w(RAIL_CELL)
      .h(26)
      .rounded(6)
      .justify_center()
      .items_center()
      .when(w.active, (el) => el.bg(t.selected))
      .when(!w.active, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => run("space.select", { id: w.id }))
      .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
      .child(div().absolute().right(5).text_color(tone(t, w.status)).child(glyph(w.status))));
  }

  render() {
    const t = theme();
    // Optional: terminals some other mod says need you, in shared `fleet.live`
    // ({ [any]: { seats: { [terminal address]: { needs: true } } } }); none, nothing shows.
    this.fleetSeats = Object.assign({}, ...Object.values(shared("fleet.live") ?? {}).map((f) => f.seats ?? {}));
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    // Agents by space, in model order (space, tab, pane), read once per render.
    const list = agents();
    this.track(list, Date.now());
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    this.all = terminals();
    this.shownAgent = focused()?.agent;
    this.ps = panes();
    this.paneByTerminal = new Map(this.ps.filter((p) => p.terminal).map((p) => [p.terminal, p]));
    this.bySpace = new Map();
    for (const a of list) {
      if (!this.bySpace.has(a.space)) this.bySpace.set(a.space, []);
      this.bySpace.get(a.space).push(a);
    }
    // Terminals that aren't agents, by space, in tab and pane order.
    const agentPanes = new Set(list.map((a) => a.pane));
    const spaceOfTab = new Map(sp.flatMap((s) => (s.tabs ?? []).map((tb) => [tb.id, s.id])));
    this.shellsBySpace = new Map();
    for (const p of this.ps) {
      const s = spaceOfTab.get(p.tab);
      if (!p.terminal || !s || agentPanes.has(p.pane) || p.status) continue;
      if (!this.shellsBySpace.has(s)) this.shellsBySpace.set(s, []);
      this.shellsBySpace.get(s).push(p);
    }
    return v_flex().id("raster").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().min_h(0).bg(t.chrome).text_size(13)
      .when(this.handle.is_focused(), (el) => el.border_r_2().border_color(t.accent))
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, el => el.pl(0).pr(0).justify_center())
        .when(!collapsed, el => el.child("Spaces"))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new")).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(14).overflow_y_scrollbar().mode("always")
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.mPressed = this.mOver = undefined; cx.notify(); })
        .children(this.grouped(t, collapsed)));
  }

  key(e, cx) {
    if (e.key === "up" || e.key === "down") {
      this.step(e.key === "down" ? 1 : -1);
      this.handle.focus();
    } else if (e.key === "enter" || e.key === "right" || e.key === "escape") {
      const f = focused();
      if (f?.pane) run("pane.focus", { pane: f.pane });
      else run("pane.go", { direction: "right" });
    } else return;
    cx.stop_propagation();
    cx.notify();
  }
}

---
name: diagram
description: Draw a diagram the user can actually see — architecture, flow, sequence, state, dependency or ER — by writing d2 and rendering it as an image in a split below the session. Use whenever explaining a system, a data flow, a request path, a state machine, or a layout would be clearer as a picture than as prose, and whenever the user asks to see, show, draw, render, sketch or visualise something. Also use to display an existing .d2, .svg, .png or .pdf in the terminal.
---

# Diagram

You cannot print a picture. Your stdout is captured by the harness, so graphics
escape codes never reach the terminal. `herdr` can print one, and
`~/.config/herdr/bin/diagram.ts` is how you ask it to: write a `.d2` file, run
the script, and the terminal opens a vertical split under the pane you are
working in and draws the diagram there as a real image.

Two steps, always in this order.

## 1. Write the source

Write a `.d2` file. Put it where it belongs — next to the code it describes if
it is worth keeping, otherwise in a scratch directory. Never write it to the
render cache under `~/.cache/herdr-diagrams`.

## 2. Render it

```bash
~/.config/herdr/bin/diagram.ts path/to/arch.d2
```

That splits the current pane vertically — the diagram stacked under the work,
at full width — and draws the PNG with the kitty graphics protocol, scaled up to
fill the pane. Focus stays where it was, so the user keeps typing uninterrupted.

The split is sized to the diagram, up to three quarters of the screen, and the
image is drawn at the pane's full width. The layout engine is tala unless the
source pins its own with `layout-engine` (dagre and elk are the alternatives);
the same goes for `theme-id` and `pad` — a key set in `vars.d2-config` is left
off d2's command line, where it would otherwise be overruled.

Call it again after every edit. The split is reused, one per tab, and
re-rendered in place, so iterating never piles up panes. Other useful forms:

```bash
~/.config/herdr/bin/diagram.ts                  # newest .d2 or image in the repo
~/.config/herdr/bin/diagram.ts out.svg          # show an svg/png/jpg/gif/pdf directly
~/.config/herdr/bin/diagram.ts arch.d2 --ascii  # print ASCII to stdout — you can read this
~/.config/herdr/bin/diagram.ts --close          # close the split
```

Use `--ascii` when you need to check the diagram yourself: it is the one form
that comes back as text you can read. Render it as an image too — the ASCII
version is your check, not the user's diagram.

## Writing d2

```d2
direction: right                    # right | down | left | up

user: User { shape: person }
api: API Gateway
db: Postgres { shape: cylinder }
queue: Jobs { shape: queue }

user -> api: HTTP
api -> db: SQL
api -> queue: enqueue
queue -> api: result

# Grouping: a container is just a nested block.
backend: {
  api2: API
  worker: Worker
  api2 -> worker
}

# Styling, when it carries meaning — a failure path, a hot path, a boundary.
api -> db: timeout { style.stroke: "#e06c75"; style.stroke-dash: 3 }
```

Shapes worth knowing: `rectangle` (default), `person`, `cylinder` (stores),
`queue`, `hexagon`, `cloud`, `package`, `step`, `diamond` (decisions), `oval`,
`document`, `class`, `sql_table`, `image`.

For sequence diagrams set `shape: sequence_diagram` on a container; for state
machines, draw plain nodes and edges and let the layout sort it out.

Check the source compiles with `d2 validate arch.d2` if a render fails; the
script reports d2's own error either way.

## Shape it to the screen

This is the difference between a diagram the user can read and a strip of text
four rows tall. The pane is about two and a half times wider than it is tall, so
**aim for a diagram roughly twice as wide as it is tall**. An image wider than
that can only grow until it hits the edges of the screen, and then it stops —
the extra height goes blank and nothing the script does can recover it.

A straight chain of six nodes in `direction: right` comes out five times wider
than tall, and renders half the size it could. Fix it by giving the graph some
height:

- Group related nodes into containers; a container stacks its contents.
- Break one long chain into two shorter rows and join them.
- Draw the branches. Most systems are not chains — if yours looks like one,
  the fan-out (caches, queues, stores, failure paths) is usually missing.
- Switch `direction` to `down` when the thing really is a hierarchy or a
  layer stack.

## Judgment

A diagram earns its place by showing a mechanism — what talks to what, what
happens in which order, where the state lives. Five to fifteen nodes is the
range where one helps. Do not draw a picture of a list, and do not draw a box
per file. Label the edges: an unlabelled arrow says two things are related and
nothing more.

Prefer `direction: right` for pipelines and request paths, `down` for
hierarchies and layer stacks.

If the user wants a closer look, they can focus the split and zoom it to the
whole tab with `prefix+z`. Mention that once, not every time.

## A diagram.d2 already open

The user has a workbench of their own — a live d2 preview over vim, in its own
tab — and it works on a file called `diagram.d2` in the directory it was
launched from. If you find one, it is probably on screen in front of them: edit
it and they see the change on save, without you rendering anything. Say what you
changed rather than opening a second view of it.

## When this is not available

`diagram.ts` needs `herdr` running with `d2` and `timg` installed (`just
install-diagrams` in the user's config repo). If the script is missing or
reports no focused pane, fall back to `d2 --ascii-mode extended --stdout-format
ascii arch.d2 -` and print that, or write the `.d2` and tell the user how to
render it.

#!/usr/bin/env python3
import json
from pathlib import Path
from types import SimpleNamespace

# ══════════════════════════════════════════════════════════════════════════════
#  EDIT HERE — define your dark and light palettes
# ══════════════════════════════════════════════════════════════════════════════

# 10 shades: g0 (darkest) → g9 (lightest), cool slate blue-gray
g = [
    "#1a1e24",  # g0 — background
    "#282e38",  # g1
    "#343c48",  # g2
    "#444e5c",  # g3
    "#566070",  # g4
    "#6e7d90",  # g5
    "#8e9db0",  # g6
    "#aebdce",  # g7
    "#c8d6e4",  # g8
    "#dce4ee",  # g9
]

dark = SimpleNamespace(
    # ── Shades (for reference and reuse)
    g0=g[0],
    g1=g[1],
    g2=g[2],
    g3=g[3],
    g4=g[4],
    g5=g[5],
    g6=g[6],
    g7=g[7],
    g8=g[8],
    g9=g[9],
    # ── Base
    background=g[0],
    foreground=g[7],  # default text
    cursor=g[9],
    selection_bg=g[3],
    selection_fg="#1e2a3a",
    # ── ANSI 0-7
    black=g[1],
    red="#c46060",
    green="#5a9960",
    yellow="#d4925a",  # amber — same as syn_string
    blue="#d4925a",  # amber — was gray, rendered as blue in Ghostty
    magenta=g[7],
    cyan=g[7],
    white=g[8],
    # ── ANSI 8-15 (bright)
    bright_black=g[3],
    bright_red="#d47070",
    bright_green="#6aaa70",
    bright_yellow="#e8a86e",  # amber lifted
    bright_blue="#e8a86e",
    bright_magenta=g[8],
    bright_cyan=g[8],
    bright_white=g[9],
    # ── Syntax (brighter = more important)
    syn_function=g[9],  # brightest — what's being called
    syn_type=g[8],  # second — what data looks like
    syn_constant=g[7],  # third — literal values
    syn_number=g[7],
    syn_keyword=g[6],  # structural but not data
    syn_string="#d4925a",  # amber — warm contrast against cool slate
    syn_property=g[5],
    syn_variable=g[6],
    syn_operator=g[5],
    syn_attribute=g[5],
    syn_tag=g[5],
    syn_punctuation=g[6],
    syn_comment=g[4],  # least prominent — recedes into bg
)

# 10 shades: s0 (darkest) → s9 (lightest), warm brown-gray
s = [
    "#1e1a17",  # s0 — background
    "#2b2520",  # s1
    "#37302a",  # s2
    "#463e36",  # s3
    "#574e45",  # s4
    "#6e6358",  # s5
    "#8d8070",  # s6
    "#ad9e8e",  # s7
    "#c8baa8",  # s8
    "#ddd2c2",  # s9
]

stone = SimpleNamespace(
    # ── Shades
    g0=s[0], g1=s[1], g2=s[2], g3=s[3], g4=s[4],
    g5=s[5], g6=s[6], g7=s[7], g8=s[8], g9=s[9],
    # ── Base
    background=s[0],
    foreground=s[7],
    cursor=s[9],
    selection_bg=s[3],
    selection_fg=s[0],
    # ── ANSI 0-7
    black=s[1],
    red="#b85c50",      # terracotta
    green="#7a9960",    # olive
    yellow="#c87941",   # copper — same as syn_string
    blue="#c87941",     # copper — rendered as blue in Ghostty
    magenta=s[7],
    cyan=s[7],
    white=s[8],
    # ── ANSI 8-15 (bright)
    bright_black=s[3],
    bright_red="#cc6e62",
    bright_green="#8aaa70",
    bright_yellow="#d98e55",  # copper lifted
    bright_blue="#d98e55",
    bright_magenta=s[8],
    bright_cyan=s[8],
    bright_white=s[9],
    # ── Syntax (brighter = more important)
    syn_function=s[9],   # brightest — what's being called
    syn_type=s[8],       # second — what data looks like
    syn_constant=s[7],   # third — literal values
    syn_number=s[7],
    syn_keyword=s[6],    # structural but not data
    syn_string="#c87941",  # copper — warm contrast against stone
    syn_property=s[5],
    syn_variable=s[6],
    syn_operator=s[5],
    syn_attribute=s[5],
    syn_tag=s[5],
    syn_punctuation=s[6],
    syn_comment=s[4],    # least prominent — recedes into bg
)

# 10 shades: n0 (darkest) → n9 (lightest), deep navy blue
n = [
    "#161921",  # n0 — background
    "#22273a",  # n1
    "#2e3449",  # n2
    "#3c4460",  # n3
    "#4e5878",  # n4
    "#677090",  # n5
    "#8792ab",  # n6
    "#a8b2c4",  # n7
    "#c4cedc",  # n8
    "#d8e0ea",  # n9
]

navy = SimpleNamespace(
    # ── Shades
    g0=n[0], g1=n[1], g2=n[2], g3=n[3], g4=n[4],
    g5=n[5], g6=n[6], g7=n[7], g8=n[8], g9=n[9],
    # ── Base
    background=n[0],
    foreground=n[7],
    cursor=n[9],
    selection_bg=n[3],
    selection_fg=n[0],
    # ── ANSI 0-7
    black=n[1],
    red="#c46060",      # muted red
    green="#5a9960",    # muted green
    yellow="#c9a84c",   # gold — same as syn_string
    blue="#c9a84c",     # gold — rendered as blue in Ghostty
    magenta=n[7],
    cyan=n[7],
    white=n[8],
    # ── ANSI 8-15 (bright)
    bright_black=n[3],
    bright_red="#d47070",
    bright_green="#6aaa70",
    bright_yellow="#d9b85e",  # gold lifted
    bright_blue="#d9b85e",
    bright_magenta=n[8],
    bright_cyan=n[8],
    bright_white=n[9],
    # ── Syntax (brighter = more important)
    syn_function=n[9],
    syn_type=n[8],
    syn_constant=n[7],
    syn_number=n[7],
    syn_keyword=n[6],
    syn_string="#c9a84c",   # gold — warm contrast against cool navy
    syn_property=n[5],
    syn_variable=n[6],
    syn_operator=n[5],
    syn_attribute=n[5],
    syn_tag=n[5],
    syn_punctuation=n[6],
    syn_comment=n[4],
)

# 10 shades: f0 (darkest) → f9 (lightest), dark desaturated green
f = [
    "#171e1a",  # f0 — background
    "#222e27",  # f1
    "#2e3c33",  # f2
    "#3c4e42",  # f3
    "#4e6155",  # f4
    "#65796b",  # f5
    "#839688",  # f6
    "#a2b4a6",  # f7
    "#beccbf",  # f8
    "#d2e0d5",  # f9
]

forest = SimpleNamespace(
    g0=f[0], g1=f[1], g2=f[2], g3=f[3], g4=f[4],
    g5=f[5], g6=f[6], g7=f[7], g8=f[8], g9=f[9],
    background=f[0],
    foreground=f[7],
    cursor=f[9],
    selection_bg=f[3],
    selection_fg=f[0],
    black=f[1],
    red="#b85c50",
    green="#7a9960",
    yellow="#d4895a",   # amber-orange — same as syn_string
    blue="#d4895a",
    magenta=f[7],
    cyan=f[7],
    white=f[8],
    bright_black=f[3],
    bright_red="#cc6e62",
    bright_green="#8aaa70",
    bright_yellow="#e09a6a",
    bright_blue="#e09a6a",
    bright_magenta=f[8],
    bright_cyan=f[8],
    bright_white=f[9],
    syn_function=f[9],
    syn_type=f[8],
    syn_constant=f[7],
    syn_number=f[7],
    syn_keyword=f[6],
    syn_string="#d4895a",   # amber-orange — warm pop against cool green
    syn_property=f[5],
    syn_variable=f[6],
    syn_operator=f[5],
    syn_attribute=f[5],
    syn_tag=f[5],
    syn_punctuation=f[6],
    syn_comment=f[4],
)

# 10 shades: m0 (darkest) → m9 (lightest), smoked purple-gray
m = [
    "#1c1820",  # m0 — background
    "#282430",  # m1
    "#33303f",  # m2
    "#433e52",  # m3
    "#554f65",  # m4
    "#6e677e",  # m5
    "#8c8498",  # m6
    "#aca3b4",  # m7
    "#c8c0ce",  # m8
    "#ddd8e2",  # m9
]

mauve = SimpleNamespace(
    g0=m[0], g1=m[1], g2=m[2], g3=m[3], g4=m[4],
    g5=m[5], g6=m[6], g7=m[7], g8=m[8], g9=m[9],
    background=m[0],
    foreground=m[7],
    cursor=m[9],
    selection_bg=m[3],
    selection_fg=m[0],
    black=m[1],
    red="#b85c6e",
    green="#5a9970",
    yellow="#4ab5a8",   # teal — same as syn_string
    blue="#4ab5a8",
    magenta=m[7],
    cyan=m[7],
    white=m[8],
    bright_black=m[3],
    bright_red="#cc6e80",
    bright_green="#6aaa80",
    bright_yellow="#5ac5b8",
    bright_blue="#5ac5b8",
    bright_magenta=m[8],
    bright_cyan=m[8],
    bright_white=m[9],
    syn_function=m[9],
    syn_type=m[8],
    syn_constant=m[7],
    syn_number=m[7],
    syn_keyword=m[6],
    syn_string="#4ab5a8",   # teal — cool/cool contrast, pops hard
    syn_property=m[5],
    syn_variable=m[6],
    syn_operator=m[5],
    syn_attribute=m[5],
    syn_tag=m[5],
    syn_punctuation=m[6],
    syn_comment=m[4],
)

# 10 shades: o0 (darkest) → o9 (lightest), near-neutral warm dark
o = [
    "#1b1a1c",  # o0 — background
    "#282629",  # o1
    "#343236",  # o2
    "#434044",  # o3
    "#545156",  # o4
    "#6c696e",  # o5
    "#8b888e",  # o6
    "#aaa8ac",  # o7
    "#c4c2c6",  # o8
    "#d8d6da",  # o9
]

obsidian = SimpleNamespace(
    g0=o[0], g1=o[1], g2=o[2], g3=o[3], g4=o[4],
    g5=o[5], g6=o[6], g7=o[7], g8=o[8], g9=o[9],
    background=o[0],
    foreground=o[7],
    cursor=o[9],
    selection_bg=o[3],
    selection_fg=o[0],
    black=o[1],
    red="#c96b7a",
    green="#5a9960",
    yellow="#c96b7a",   # rose — same as syn_string
    blue="#c96b7a",
    magenta=o[7],
    cyan=o[7],
    white=o[8],
    bright_black=o[3],
    bright_red="#d97e8c",
    bright_green="#6aaa70",
    bright_yellow="#d97e8c",
    bright_blue="#d97e8c",
    bright_magenta=o[8],
    bright_cyan=o[8],
    bright_white=o[9],
    syn_function=o[9],
    syn_type=o[8],
    syn_constant=o[7],
    syn_number=o[7],
    syn_keyword=o[6],
    syn_string="#c96b7a",   # rose — distinct without screaming
    syn_property=o[5],
    syn_variable=o[6],
    syn_operator=o[5],
    syn_attribute=o[5],
    syn_tag=o[5],
    syn_punctuation=o[6],
    syn_comment=o[4],
)

# ── Theme registry: (filename, zed appearance, palette)
THEMES = [
    ("user-theme", "dark", dark),
    ("warm-stone", "dark", stone),
    ("midnight-navy", "dark", navy),
    ("deep-forest", "dark", forest),
    ("smoked-mauve", "dark", mauve),
    ("obsidian-rose", "dark", obsidian),
]


def _mix(a, b, t):
    """Interpolate between two hex colors. t=0 → a, t=1 → b."""
    ca = [int(a.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)]
    return "#{:02x}{:02x}{:02x}".format(
        *[round(ca[i] + (cb[i] - ca[i]) * t) for i in range(3)]
    )


def _sx(p, attr, fallback):
    return getattr(p, attr, None) or fallback


def ghostty(name, p):
    return (
        "\n".join(
            [
                f"# {name} — generated by colors.py",
                "",
                f"background           = {p.background}",
                f"foreground           = {p.foreground}",
                f"cursor-color         = {p.cursor}",
                f"selection-background = {p.selection_bg}",
                f"selection-foreground = {p.selection_fg}",
                "",
                "# ANSI palette",
                f"palette = 0={p.black}",
                f"palette = 1={p.red}",
                f"palette = 2={p.green}",
                f"palette = 3={p.yellow}",
                f"palette = 4={p.blue}",
                f"palette = 5={p.magenta}",
                f"palette = 6={p.cyan}",
                f"palette = 7={p.white}",
                f"palette = 8={p.bright_black}",
                f"palette = 9={p.bright_red}",
                f"palette = 10={p.bright_green}",
                f"palette = 11={p.bright_yellow}",
                f"palette = 12={p.bright_blue}",
                f"palette = 13={p.bright_magenta}",
                f"palette = 14={p.bright_cyan}",
                f"palette = 15={p.bright_white}",
            ]
        )
        + "\n"
    )


def zed(name, appearance, p):
    dark_mode = appearance == "dark"
    bg, fg = p.background, p.foreground
    hi = "#ffffff" if dark_mode else "#000000"
    surface = _mix(bg, hi, 0.1)
    elevated = _mix(bg, hi, 0.05)
    border = _mix(bg, hi, 0.32)
    subtle = _mix(fg, bg, 0.05)  # closer to fg — readable in menus/popups

    style = {
        "background": bg,
        "surface.background": surface,
        "elevated_surface.background": elevated,
        "panel.background": surface,
        "status_bar.background": surface,
        "title_bar.background": surface,
        "toolbar.background": bg,
        "tab_bar.background": surface,
        "tab.inactive_background": surface,
        "tab.active_background": bg,
        "drop_target.background": _mix(p.blue, bg, 0.8),
        "border": border,
        "border.variant": border,
        "border.focused": p.blue,
        "border.selected": p.blue,
        "border.transparent": "#00000000",
        "border.disabled": border,
        "text": fg,
        "text.muted": subtle,
        "text.placeholder": subtle,
        "text.disabled": subtle,
        "text.accent": p.blue,
        "element.background": "#00000000",
        "element.hover": _mix(p.blue, bg, 0.9),
        "element.active": _mix(p.blue, bg, 0.8),
        "element.selected": _mix(p.blue, bg, 0.85),
        "element.disabled": border,
        "ghost_element.hover": _mix(fg, bg, 0.8),
        "ghost_element.active": _mix(fg, bg, 0.8),
        "ghost_element.selected": _mix(fg, bg, 0.8),
        "editor.foreground": fg,
        "editor.background": bg,
        "editor.gutter.background": bg,
        "editor.line_number": subtle,
        "editor.active_line_number": fg,
        # "editor.active_line.background": _mix(fg, bg, 0.05),
        "editor.wrap_guide": border,
        "editor.active_wrap_guide": subtle,
        "editor.invisible": border,
        "editor.indent_guide": border,
        "editor.indent_guide_active": subtle,
        "editor.document_highlight.read_background": _mix(p.yellow, bg, 0.85),
        "editor.document_highlight.write_background": _mix(p.yellow, bg, 0.75),
        "search.match_background": _mix(p.yellow, bg, 0.7),
        "search.active_match_background": _mix(p.yellow, bg, 0.5),
        "selection": p.selection_bg,
        "scrollbar.thumb.background": _mix(fg, bg, 0.2),
        "scrollbar.thumb.hover_background": _mix(fg, bg, 0.35),
        "scrollbar.thumb.border": border,
        "scrollbar.track.background": "#00000000",
        "scrollbar.track.border": border,
        "error": p.red,
        "error.background": _mix(p.red, bg, 0.85),
        "error.border": _mix(p.red, bg, 0.6),
        "warning": p.yellow,
        "warning.background": _mix(p.yellow, bg, 0.85),
        "warning.border": _mix(p.yellow, bg, 0.6),
        "info": p.blue,
        "info.background": _mix(p.blue, bg, 0.85),
        "info.border": _mix(p.blue, bg, 0.6),
        "hint": subtle,
        "hint.background": _mix(fg, bg, 0.08),
        "hint.border": border,
        "success": p.green,
        "success.background": _mix(p.green, bg, 0.85),
        "success.border": _mix(p.green, bg, 0.6),
        "created": p.green,
        "created.background": _mix(p.green, bg, 0.88),
        "created.border": _mix(p.green, bg, 0.7),
        "modified": p.blue,
        "modified.background": _mix(p.blue, bg, 0.88),
        "modified.border": _mix(p.blue, bg, 0.7),
        "deleted": p.red,
        "deleted.background": _mix(p.red, bg, 0.88),
        "deleted.border": _mix(p.red, bg, 0.7),
        "conflict": p.yellow,
        "conflict.background": _mix(p.yellow, bg, 0.88),
        "conflict.border": _mix(p.yellow, bg, 0.7),
        "hidden": subtle,
        "hidden.background": bg,
        "hidden.border": border,
        "ignored": _mix(fg, bg, 0.5),
        "ignored.background": bg,
        "ignored.border": border,
        "renamed": p.cyan,
        "renamed.background": _mix(p.cyan, bg, 0.88),
        "renamed.border": _mix(p.cyan, bg, 0.7),
        "link_text.hover": p.blue,
        "terminal.background": bg,
        "terminal.foreground": fg,
        "terminal.bright_foreground": p.bright_white,
        "terminal.dim_foreground": subtle,
        "terminal.ansi.black": p.black,
        "terminal.ansi.red": p.red,
        "terminal.ansi.green": p.green,
        "terminal.ansi.yellow": p.yellow,
        "terminal.ansi.blue": p.blue,
        "terminal.ansi.magenta": p.magenta,
        "terminal.ansi.cyan": p.cyan,
        "terminal.ansi.white": p.white,
        "terminal.ansi.bright_black": p.bright_black,
        "terminal.ansi.bright_red": p.bright_red,
        "terminal.ansi.bright_green": p.bright_green,
        "terminal.ansi.bright_yellow": p.bright_yellow,
        "terminal.ansi.bright_blue": p.bright_blue,
        "terminal.ansi.bright_magenta": p.bright_magenta,
        "terminal.ansi.bright_cyan": p.bright_cyan,
        "terminal.ansi.bright_white": p.bright_white,
        "terminal.ansi.dim_black": _mix(p.black, bg, 0.4),
        "terminal.ansi.dim_red": _mix(p.red, bg, 0.4),
        "terminal.ansi.dim_green": _mix(p.green, bg, 0.4),
        "terminal.ansi.dim_yellow": _mix(p.yellow, bg, 0.4),
        "terminal.ansi.dim_blue": _mix(p.blue, bg, 0.4),
        "terminal.ansi.dim_magenta": _mix(p.magenta, bg, 0.4),
        "terminal.ansi.dim_cyan": _mix(p.cyan, bg, 0.4),
        "terminal.ansi.dim_white": _mix(p.white, bg, 0.4),
        "syntax": {
            "keyword": {"color": _sx(p, "syn_keyword", p.red)},
            "keyword.operator": {"color": _sx(p, "syn_operator", fg)},
            "string": {"color": _sx(p, "syn_string", p.green)},
            "string.escape": {"color": _sx(p, "syn_string", p.green)},
            "string.regex": {"color": _sx(p, "syn_string", p.green)},
            "string.special": {"color": _sx(p, "syn_string", p.green)},
            "comment": {
                "color": _sx(p, "syn_comment", p.bright_black),
                "font_style": "italic",
            },
            "comment.doc": {
                "color": _sx(p, "syn_comment", p.bright_black),
                "font_style": "italic",
            },
            "function": {"color": _sx(p, "syn_function", p.blue)},
            "function.builtin": {"color": _sx(p, "syn_function", p.blue)},
            "function.method": {"color": _sx(p, "syn_function", p.blue)},
            "type": {"color": _sx(p, "syn_type", p.yellow)},
            "type.builtin": {"color": _sx(p, "syn_type", p.yellow)},
            "constant": {"color": _sx(p, "syn_constant", p.blue)},
            "constant.builtin": {"color": _sx(p, "syn_constant", p.blue)},
            "number": {"color": _sx(p, "syn_number", p.blue)},
            "boolean": {"color": _sx(p, "syn_constant", p.blue)},
            "operator": {"color": _sx(p, "syn_operator", fg)},
            "property": {"color": _sx(p, "syn_property", p.blue)},
            "variable": {"color": _sx(p, "syn_variable", fg)},
            "variable.special": {"color": _sx(p, "syn_variable", p.magenta)},
            "tag": {"color": _sx(p, "syn_tag", p.red)},
            "attribute": {"color": _sx(p, "syn_attribute", p.yellow)},
            "constructor": {"color": _sx(p, "syn_type", p.yellow)},
            "preproc": {"color": _sx(p, "syn_keyword", p.red)},
            "punctuation": {"color": _sx(p, "syn_punctuation", fg)},
            "punctuation.bracket": {"color": _sx(p, "syn_punctuation", fg)},
            "punctuation.delimiter": {"color": _sx(p, "syn_punctuation", fg)},
            "punctuation.special": {"color": _sx(p, "syn_punctuation", fg)},
            "enum": {"color": _sx(p, "syn_type", p.yellow)},
            "text.literal": {"color": _sx(p, "syn_string", p.green)},
        },
        "players": [
            {"cursor": p.cursor, "background": bg, "selection": p.selection_bg},
            {
                "cursor": p.magenta,
                "background": bg,
                "selection": _mix(p.magenta, bg, 0.8),
            },
            {"cursor": p.green, "background": bg, "selection": _mix(p.green, bg, 0.8)},
            {
                "cursor": p.yellow,
                "background": bg,
                "selection": _mix(p.yellow, bg, 0.8),
            },
            {"cursor": p.cyan, "background": bg, "selection": _mix(p.cyan, bg, 0.8)},
            {"cursor": p.red, "background": bg, "selection": _mix(p.red, bg, 0.8)},
        ],
        "accents": [p.blue, p.magenta, p.green, p.yellow, p.cyan, p.red],
    }

    return {
        "$schema": "https://zed.dev/schema/themes/v0.2.0.json",
        "name": name,
        "author": "colors.py",
        "themes": [{"name": name, "appearance": appearance, "style": style}],
    }


def main():
    root = Path(__file__).parent
    (root / "ghostty" / "themes").mkdir(parents=True, exist_ok=True)
    (root / "themes").mkdir(parents=True, exist_ok=True)

    for name, appearance, palette in THEMES:
        (root / "ghostty" / "themes" / name).write_text(ghostty(name, palette))
        (root / "themes" / f"{name}.json").write_text(
            json.dumps(zed(name, appearance, palette), indent=2) + "\n"
        )
        print(f"  {name}")

    print(f"\nGenerated {len(THEMES)} themes.")
    print("Ghostty: Cmd+Shift+,   Zed: automatic")


if __name__ == "__main__":
    main()

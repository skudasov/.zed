// Schedule. One mod, two copies:
// - the layout's "schedule" footer block (zed.json): one line for the whole day, 0:00 to 24:00,
//   each interval a colored segment, a ▼ marks the time of day now;
// - the dialog (launcher, cmd-e: "Schedule"): type "1000 1200 deep work" (10:00 12:00 / 1000-1200 work too)
//   + enter to add, j/k select, x removes the selected one, esc closes.
// Intervals are a daily plan: minutes of the day, repeating every day until x removes them.
// They live in shared("schedule") (saved by Herdr, so they survive restarts).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { shared, setShared, notify, theme, props, run } from "herdr";

const DAY_START = 0; // hours shown on the line
const DAY_END = 24;
const COLORS = ["ansi1", "ansi2", "ansi3", "ansi4", "ansi5", "ansi6"];
const KEY = "schedule";

const items = () => shared(KEY) ?? [];
// Saves the list; the footer block (zed.json "schedule") shows only while intervals exist.
// A hidden block's mod doesn't run, so whoever changes the list toggles it.
function save(list) {
  setShared(KEY, list);
  run(list.length ? "layout.show" : "layout.hide", { id: "schedule" });
}

const today = (h, m = 0) => new Date().setHours(h, m, 0, 0);
// Where a timestamp sits on the day line, 0..1 (clamped).
const pos = (ts) => Math.min(1, Math.max(0, (ts - today(DAY_START)) / (today(DAY_END) - today(DAY_START))));
const hhmm = (ts) => new Date(ts).toTimeString().slice(0, 5);
const mins = (ms) => Math.max(0, Math.ceil(ms / 60000));
// Today's timestamps of an interval stored as minutes of the day.
const startOf = (x) => today(0, x.from);
const endOf = (x) => today(0, x.to);
const dayKey = () => new Date().toDateString();
function status(x, now = Date.now()) {
  if (now < startOf(x)) return `in ${mins(startOf(x) - now)}m`;
  if (now < endOf(x)) return `${mins(endOf(x) - now)}m left`;
  return "done";
}

// "1000 1200 deep work" / "9:30 10:15 standup" / "1000-1200 x" -> {from, to, name} in minutes of the day; else null.
function parse(text) {
  const m = text.trim().match(/^(\d{1,2}):?(\d{2})(?:\s+|\s*-\s*)(\d{1,2}):?(\d{2})\s*(.*)$/);
  if (!m) return null;
  const [h1, m1, h2, m2] = m.slice(1, 5).map(Number);
  if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  const from = h1 * 60 + m1;
  const to = h2 * 60 + m2;
  if (to <= from || to > 24 * 60) return null;
  return { from, to, name: m[5] || `${m[1]}${m[2]}-${m[3]}${m[4]}` };
}

export default class Schedule extends View {
  init(_props, cx) {
    this.dialog = Boolean(props()?.overlay);
    this.q = "";
    this.at = 0;
    if (this.dialog) {
      this.handle = cx.focus_handle();
      this.handle.focus();
      cx.timer.after(50, () => this.handle.focus());
    } else {
      // ponytail: footer repaints every 15s, minute resolution is all it shows.
      cx.timer.every(15000, (cx) => {
        this.tick();
        cx.notify();
      });
    }
  }

  // Footer only: toast once a day when an interval starts and when it ends.
  // The end toast needs that day's start toast, so a plan added late doesn't toast its past.
  tick() {
    const now = Date.now();
    const day = dayKey();
    let changed = false;
    const next = items().map((x) => {
      if (now >= endOf(x) && x.startedOn === day && x.endedOn !== day) {
        notify({ title: `✅ ${x.name} done`, body: `${hhmm(startOf(x))}–${hhmm(endOf(x))}`, level: "success" });
        changed = true;
        return { ...x, endedOn: day };
      }
      if (now >= startOf(x) && now < endOf(x) && x.startedOn !== day) {
        notify({ title: `▶ ${x.name}`, body: `until ${hhmm(endOf(x))}`, level: "info" });
        changed = true;
        return { ...x, startedOn: day };
      }
      return x;
    });
    if (changed) save(next);
  }

  add(cx) {
    const t = parse(this.q);
    if (!t) {
      this.err = "use from to name, e.g. 1000 1200 focus (end after start)";
      cx.notify();
      return;
    }
    const all = items();
    const used = all.map((x) => x.color);
    const color = COLORS.find((c) => !used.includes(c)) ?? COLORS[all.length % COLORS.length];
    const item = { ...t, color };
    const list = [...all, item].sort((a, b) => a.from - b.from);
    save(list);
    this.q = "";
    this.at = list.indexOf(item);
    cx.notify();
  }

  key(e, cx) {
    const k = e.keystroke;
    const all = items();
    const typed = e.key_char >= " " && !e.modifiers?.platform && !e.modifiers?.control ? e.key_char : "";
    if (k !== "enter") this.err = "";
    if (k === "enter") this.add(cx);
    else if (k === "backspace" && this.q) this.q = this.q.slice(0, -1);
    else if (k === "escape" && this.q) this.q = "";
    else if (!this.q && (k === "j" || k === "down")) this.at = Math.min(this.at + 1, all.length - 1);
    else if (!this.q && (k === "k" || k === "up")) this.at = Math.max(this.at - 1, 0);
    else if (!this.q && k === "x" && all[this.at]) {
      save(all.filter((_, i) => i !== this.at));
      this.at = Math.max(0, Math.min(this.at, all.length - 2));
    } else if (typed) this.q += typed;
    else return; // escape on empty input: Herdr closes the dialog
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    return this.dialog ? this.renderDialog() : this.renderFooter();
  }

  renderFooter() {
    const t = theme();
    const now = Date.now();
    const all = items();
    const current = all.find((x) => startOf(x) <= now && now < endOf(x));
    const inDay = now >= today(DAY_START) && now <= today(DAY_END);
    return h_flex()
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .border_t(1)
      .border_color(t.border)
      .text_size(11)
      .child(div().flex_none().text_color(t.dim).child(`${DAY_START}`))
      .child(
        div()
          .relative()
          .flex_1()
          .h(16)
          .rounded(3)
          .overflow_hidden()
          .bg(t.border)
          .children(
            all.map((x) => {
              const left = pos(startOf(x));
              const width = pos(endOf(x)) - left;
              const fill = x === current ? "99" : "44";
              return div()
                .absolute()
                .top_0()
                .h_full()
                .left(`${left * 100}%`)
                .w(`${width * 100}%`)
                .flex()
                .items_center()
                .overflow_hidden()
                .border_l(1)
                .border_color(t.background)
                .bg(t[x.color] + fill)
                .child(div().px(4).truncate().text_size(10).text_color(t.foreground).child(x.name));
            }),
          )
          // Now: ▼ pinned at the time of day; zero-width anchor so the glyph centers on it.
          .when(inDay, (el) =>
            el.child(
              div()
                .absolute()
                .top_0()
                .h_full()
                .w(0)
                .left(`${pos(now) * 100}%`)
                .child(div().absolute().top(-2).left(-4).text_size(10).text_color(t.foreground).child("▼")),
            ),
          ),
      )
      .child(div().flex_none().text_color(t.dim).child(`${DAY_END}`))
      .child(
        div()
          .flex_none()
          .text_color(current ? t[current.color] : t.foreground)
          .child(current ? `${hhmm(now)} · ${status(current, now)}` : hhmm(now)),
      );
  }

  renderDialog() {
    const t = theme();
    const all = items();
    if (this.at >= all.length) this.at = Math.max(0, all.length - 1);
    return v_flex()
      .id("schedule")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .size_full()
      .p(12)
      .gap(4)
      .bg(t.popover)
      .text_size(13)
      .child(
        div()
          .px(8)
          .py(4)
          .mb(6)
          .rounded(6)
          .border_1()
          .border_color(this.q ? t.accent : t.border)
          .text_color(this.q ? t.foreground : t.dim)
          .child(`${this.q || "from to name, e.g. 1000 1200 focus"}▏`),
      )
      .when(Boolean(this.err), (el) => el.child(div().px(8).text_size(11).text_color(t.ansi1).child(this.err)))
      // Rows grow with their name (it wraps, never truncates); the list scrolls past the dialog.
      .child(
        v_flex()
          .id("schedule-rows")
          .flex_1()
          .min_h(0)
          .gap(4)
          .overflow_y_scroll()
          .children(
            all.map((x, i) =>
              h_flex()
                .items_start()
                .px(8)
                .py(3)
                .gap(8)
                .rounded(6)
                .bg(i === this.at ? t.selected : t.popover)
                .child(div().flex_none().mt(5).w(8).h(8).rounded(4).bg(t[x.color]))
                .child(div().flex_none().text_color(t.dim).child(`${hhmm(startOf(x))}–${hhmm(endOf(x))}`))
                .child(div().flex_1().min_w(0).text_color(t.foreground).child(x.name))
                .child(div().flex_none().text_color(t[x.color]).child(status(x))),
            ),
          ),
      )
      .when(!all.length, (el) => el.child(div().px(8).text_color(t.muted).child("Nothing scheduled")))
      .child(div().mt_auto().px(8).text_size(11).text_color(t.dim).child("enter add · j/k select · x remove · esc close"));
  }
}

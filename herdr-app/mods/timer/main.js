// Timers. One mod, two copies:
// - the layout's "timer" footer block (zed.json): a bar of up to 6 colored slots,
//   each filling with its timer's time left, minutes left on the right;
// - the dialog (launcher, cmd-e: "Timer"): type "25 focus" + enter to
//   start a 25 min timer, j/k select, x cancels the selected one, esc closes.
// Timers live in shared("timers") (saved by Herdr, so they survive restarts).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { shared, setShared, notify, theme, props, run } from "herdr";

const MAX = 6;
const COLORS = ["ansi1", "ansi2", "ansi3", "ansi4", "ansi5", "ansi6"];
const KEY = "timers";

const timers = () => shared(KEY) ?? [];
// Saves the list; the footer block (zed.json "timer") shows only while timers run.
// A hidden block's mod doesn't run, so whoever changes the list toggles it.
function save(list) {
  setShared(KEY, list);
  run(list.length ? "layout.show" : "layout.hide", { id: "timer" });
}
const minsLeft = (x) => Math.max(0, Math.ceil((x.start + x.min * 60000 - Date.now()) / 60000));
const fraction = (x) => Math.max(0, 1 - (Date.now() - x.start) / (x.min * 60000));

// "25 focus" -> {min: 25, name: "focus"}; anything without a leading number is null.
function parse(text) {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  return m && +m[1] > 0 ? { min: +m[1], name: m[2] || `${m[1]}m` } : null;
}

export default class Timer extends View {
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
        this.expire();
        cx.notify();
      });
    }
  }

  // Footer only: finished timers toast and drop out.
  expire() {
    const all = timers();
    const done = all.filter((x) => fraction(x) === 0);
    if (!done.length) return;
    done.forEach((x) => notify({ title: `🍅 ${x.name} done`, body: `${x.min} min`, level: "success", }));
    save(all.filter((x) => !done.includes(x)));
  }

  add(cx) {
    const t = parse(this.q);
    const all = timers();
    if (!t || all.length >= MAX) return;
    const used = all.map((x) => x.color);
    const color = COLORS.find((c) => !used.includes(c));
    save([...all, { ...t, color, start: Date.now() }]);
    this.q = "";
    this.at = all.length;
    cx.notify();
  }

  key(e, cx) {
    const k = e.keystroke;
    const all = timers();
    const typed = e.key_char >= " " && !e.modifiers?.platform && !e.modifiers?.control ? e.key_char : "";
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
    const all = timers();
    const slots = Array.from({ length: MAX }, (_, i) => all[i]);
    return h_flex()
      .size_full()
      .px(10)
      .gap(10)
      .items_center()
      .border_t(1)
      .border_color(t.border)
      .text_size(11)
      .child(
        h_flex()
          .flex_1()
          .h(16)
          .gap(2)
          .children(
            slots.map((x) =>
              div()
                .relative()
                .flex()
                .items_center()
                .flex_1()
                .min_w(0)
                .h_full()
                .rounded(3)
                .overflow_hidden()
                .bg(x ? t[x.color] + "33" : t.border)
                .when(Boolean(x), (el) =>
                  el
                    // Fill sits behind, the timer's name on top of it.
                    .child(div().absolute().top_0().left_0().h_full().w(`${fraction(x) * 100}%`).bg(t[x.color] + "99"))
                    .child(div().relative().px(6).truncate().text_size(10).text_color(t.foreground).child(x.name)),
                ),
            ),
          ),
      )
      .child(
        h_flex()
          .gap(8)
          .flex_none()
          .children(all.map((x) => div().text_color(t[x.color]).child(`${minsLeft(x)}m`))),
      );
  }

  renderDialog() {
    const t = theme();
    const all = timers();
    if (this.at >= all.length) this.at = Math.max(0, all.length - 1);
    const full = all.length >= MAX;
    return v_flex()
      .id("timer")
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
          .child(full ? `${MAX} timers running, x cancels one` : `${this.q || "minutes name, e.g. 25 focus"}▏`),
      )
      .children(
        all.map((x, i) =>
          h_flex()
            .px(8)
            .py(3)
            .gap(8)
            .rounded(6)
            .bg(i === this.at ? t.selected : t.popover)
            .child(div().w(8).h(8).rounded(4).bg(t[x.color]))
            .child(div().flex_1().truncate().text_color(t.foreground).child(x.name))
            .child(div().text_color(t[x.color]).child(`${minsLeft(x)}m / ${x.min}m`)),
        ),
      )
      .when(!all.length, (el) => el.child(div().px(8).text_color(t.muted).child("No timers")))
      .child(div().mt_auto().px(8).text_size(11).text_color(t.dim).child("enter start · j/k select · x cancel · esc close"));
  }
}

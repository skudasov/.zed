// Firefox user.js — matches Zed "Ultimate Dark Neo" + Ghostty Breeze
// Install: `just install-firefox` from ~/.config/zed
// Loaded on startup; overwrites prefs.js entries below.

// Enable userChrome.css / userContent.css loading (required for styling)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// ── Theme / appearance ────────────────────────────────────────────────────
user_pref("browser.theme.content-theme", 0);
user_pref("browser.theme.toolbar-theme", 0);
user_pref("layout.css.prefers-color-scheme.content-override", 0);
user_pref("browser.uidensity", 0);

// Content background for pages without their own bg — matches #303135
user_pref("browser.display.background_color", "#303135");
user_pref("browser.display.use_system_colors", false);

// Titlebar / tabs
user_pref("browser.tabs.drawInTitlebar", true);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.tabs.tabMinWidth", 120);

// Smooth scrolling + WebRender
user_pref("general.smoothScroll", true);
user_pref("gfx.webrender.all", true);
user_pref("apz.overscroll.enabled", true);

// New tab page blank (matches Zed's clean start)
user_pref("browser.newtabpage.enabled", false);
user_pref("browser.startup.homepage", "about:blank");

// ── Telemetry / data collection ───────────────────────────────────────────
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("browser.discovery.enabled", false);

// ── Pocket / sponsored content ────────────────────────────────────────────
user_pref("extensions.pocket.enabled", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);

// ── Password manager (use external manager instead) ───────────────────────
user_pref("signon.rememberSignons", false);
user_pref("signon.autofillForms", false);
user_pref("extensions.fxmonitor.enabled", false);

// ── UI behavior ───────────────────────────────────────────────────────────
user_pref("toolkit.cosmeticAnimations.enabled", false);
user_pref("browser.search.openintab", false);
user_pref("browser.backspace_action", 2);
user_pref("reader.parse-on-load.enabled", false);
user_pref("browser.tabs.firefox-view", false);
user_pref("browser.urlbar.trimURLs", false);
user_pref("browser.warnOnQuit", false);
user_pref("browser.showQuitWarning", false);

// ── Downloads ─────────────────────────────────────────────────────────────
user_pref("browser.download.manager.showWhenStarting", false);
user_pref("browser.download.manager.showAlertOnComplete", false);

// ── Startup: restore previous session ─────────────────────────────────────
user_pref("browser.startup.page", 3);

// ── Container tabs (site isolation) ───────────────────────────────────────
user_pref("privacy.userContext.enabled", true);
user_pref("privacy.userContext.ui.enabled", true);

// ── Fingerprinting resistance ─────────────────────────────────────────────
user_pref("privacy.resistFingerprinting", true);
user_pref("privacy.resistFingerprinting.letterboxing", false);

// ── PDF.js as default viewer ──────────────────────────────────────────────
user_pref("pdfjs.disabled", false);

// Firefox user.js — matches Zed "Ultimate Dark Neo" + Ghostty Breeze
// Install: `just install-firefox` from ~/.config/zed
// Loaded on startup; overwrites prefs.js entries below.

// Enable userChrome.css / userContent.css loading (required for styling)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Dark theme everywhere
user_pref("browser.theme.content-theme", 0);
user_pref("browser.theme.toolbar-theme", 0);
user_pref("layout.css.prefers-color-scheme.content-override", 0);

// Compact UI density
user_pref("browser.uidensity", 0);

// Content background for pages without their own bg — matches #303135
user_pref("browser.display.background_color", "#303135");
user_pref("browser.display.use_system_colors", false);

// Titlebar / tabs
user_pref("browser.tabs.drawInTitlebar", true);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.tabs.tabMinWidth", 120);

// Bookmarks bar always visible
user_pref("browser.toolbars.bookmarks.visibility", "always");

// Smooth scrolling + WebRender
user_pref("general.smoothScroll", true);
user_pref("gfx.webrender.all", true);
user_pref("apz.overscroll.enabled", true);

// New tab page blank (matches Zed's clean start)
user_pref("browser.newtabpage.enabled", false);
user_pref("browser.startup.homepage", "about:blank");

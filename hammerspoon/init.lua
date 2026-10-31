require("hs.ipc")

-- herdr-app (~/Applications/Herdr.app), matched by bundle ID: its name
-- "Herdr" is shared with other Herdr builds.
local HERDR = "dev.herdr.app"

-- name: an app name, or a bundle ID (contains a dot).
local function focusApp(name)
    local byID = name:find("%.") ~= nil
    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        local app = win:application()
        if (byID and app:bundleID() or app:name()) == name then
            win:focus()
            return
        end
    end

    -- No window on current space: launch or switch to it. herdr-app's own
    -- binary does both, and opens a window when the app runs without one.
    if name == HERDR then
        hs.task.new(os.getenv("HOME") .. "/Applications/Herdr.app/Contents/MacOS/Herdr", nil):start()
    elseif byID then
        hs.application.launchOrFocusByBundleID(name)
    else
        hs.application.launchOrFocus(name)
    end
end

local function frontIs(id)
    return hs.application.frontmostApplication():bundleID() == id
end

hs.hotkey.bind({ "cmd" }, "i", function()
    hs.window.animationDuration = 0
    local zedWins = {}
    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        if win:application():name() == "Zed" then
            table.insert(zedWins, win)
        end
    end
    if #zedWins == 0 then
        hs.application.launchOrFocus("Zed")
        return
    end
    local focused = hs.window.focusedWindow()
    local idx = 1
    for i, win in ipairs(zedWins) do
        if win:id() == (focused and focused:id()) then
            idx = i % #zedWins + 1
            break
        end
    end
    local win = zedWins[idx]
    win:focus()
end)

-- cmd+u : focus herdr-app; when already there, next tab (its cmd-shift-]).
hs.hotkey.bind({ "cmd" }, "u", function()
    if frontIs(HERDR) then
        hs.eventtap.keyStroke({ "cmd", "shift" }, "]", 10000)
    else
        focusApp(HERDR)
    end
end)

hs.hotkey.bind({ "cmd" }, "p", function()
    if hs.application.frontmostApplication():name() == "Google Chrome" then
        hs.eventtap.keyStroke({ "ctrl" }, "tab", 10000)
    else
        focusApp("Google Chrome")
    end
end)

hs.hotkey.bind({ "cmd", "shift" }, "u", function()
    if frontIs(HERDR) then
        hs.eventtap.keyStroke({ "cmd", "shift" }, "[", 10000)
    else
        focusApp(HERDR)
    end
end)

hs.hotkey.bind({ "cmd", "shift" }, "p", function()
    if hs.application.frontmostApplication():name() == "Google Chrome" then
        hs.eventtap.keyStroke({ "ctrl", "shift" }, "tab", 10000)
    else
        focusApp("Google Chrome")
    end
end)

hs.hotkey.bind({ "cmd" }, "b", function() focusApp("Slack") end)

-- cmd+' : split focused app (left) + Chrome (right) on the current screen.
-- Switch between windows with cmd+i/u/p.
hs.hotkey.bind({ "cmd" }, "'", function()
    hs.window.animationDuration = 0
    local focused = hs.window.focusedWindow()
    if not focused then return end

    local chrome = hs.application.get("Google Chrome")
    local chromeWin = chrome and chrome:mainWindow()
    if not chromeWin then
        hs.application.launchOrFocus("Google Chrome")
        return
    end
    if focused:id() == chromeWin:id() then return end

    local f = focused:screen():frame()
    local mid = f.x + f.w / 2
    focused:setFrame({ x = f.x, y = f.y, w = f.w / 2, h = f.h })
    chromeWin:setFrame({ x = mid, y = f.y, w = f.w / 2, h = f.h })
    focused:focus()
end)

-- cmd+; : maximize Chrome / Zed / Herdr to full size on the current screen.
hs.hotkey.bind({ "cmd" }, ";", function()
    hs.window.animationDuration = 0
    local focused = hs.window.focusedWindow()
    local screen = (focused and focused:screen()) or hs.screen.mainScreen()
    local f = screen:frame()
    local apps = { ["Google Chrome"] = true, ["Zed"] = true, ["Herdr"] = true }
    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        if apps[win:application():name()] then
            win:setFrame(f)
        end
    end
    if focused then focused:focus() end
end)


local function sleep(t) coroutine.applicationYield(t) end

hs.hotkey.bind({ "ctrl", "option" }, "w", function()
    local origSpace = hs.spaces.activeSpaceOnScreen(hs.screen.mainScreen())
    hs.execute("open -na Ghostty")
    hs.execute("/bin/zsh -l -c 'zed -n'")
    hs.application.launchOrFocus("Google Chrome")
    hs.eventtap.keyStroke({ "cmd" }, "n", 100000)
    sleep(0.5)
    hs.spaces.gotoSpace(origSpace)
    sleep(0.5)
    hs.application.launchOrFocus("Zed")
end)
require("hs.ipc")

local function focusApp(name)
    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        if win:application():name() == name then
            win:focus()
            return
        end
    end

    -- No window on current space: launch or switch to it
    hs.application.launchOrFocus(name)
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

hs.hotkey.bind({ "cmd" }, "u", function() 
    if hs.application.frontmostApplication():name() == "Ghostty" then
        hs.eventtap.keyStroke({ "ctrl" }, "tab", 10000)
    else
        focusApp("Ghostty")
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
    if hs.application.frontmostApplication():name() == "Ghostty" then
        hs.eventtap.keyStroke({ "ctrl", "shift" }, "tab", 10000)
    else
        focusApp("Ghostty")
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

-- cmd+; : maximize Chrome / Zed / Ghostty to full size on the current screen.
hs.hotkey.bind({ "cmd" }, ";", function()
    hs.window.animationDuration = 0
    local focused = hs.window.focusedWindow()
    local screen = (focused and focused:screen()) or hs.screen.mainScreen()
    local f = screen:frame()
    local apps = { ["Google Chrome"] = true, ["Zed"] = true, ["Ghostty"] = true }
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
require("hs.ipc")

local function maximizeApp(name)
    local attempts = 0
    local timer
    timer = hs.timer.doEvery(0.1, function()
        attempts = attempts + 1
        local app = hs.application.get(name)
        local win = app and app:mainWindow()
        if win then
            win:setFrame(win:screen():fullFrame())
            timer:stop()
        elseif attempts > 30 then
            timer:stop()
        end
    end)
end

local function focusFull(name)
    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        if win:application():name() == name then
            win:focus()
            win:setFrame(win:screen():fullFrame())
            return
        end
    end

    -- No window on current space: launch, then maximize once window appears
    hs.application.launchOrFocus(name)
    maximizeApp(name)
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
    win:setFrame(win:screen():fullFrame())
end)

hs.hotkey.bind({ "cmd" }, "u", function() 
    if hs.application.frontmostApplication():name() == "Ghostty" then
        hs.eventtap.keyStroke({ "ctrl" }, "tab", 10000)
    else
        focusFull("Ghostty")
    end
end)

hs.hotkey.bind({ "cmd" }, "p", function()
    if hs.application.frontmostApplication():name() == "Firefox" then
        hs.eventtap.keyStroke({ "ctrl" }, "tab", 10000)
    else
        focusFull("Firefox")
    end
end)

hs.hotkey.bind({ "cmd", "shift" }, "u", function()
    if hs.application.frontmostApplication():name() == "Ghostty" then
        hs.eventtap.keyStroke({ "ctrl", "shift" }, "tab", 10000)
    else
        focusFull("Ghostty")
    end
end)

hs.hotkey.bind({ "cmd", "shift" }, "p", function()
    if hs.application.frontmostApplication():name() == "Firefox" then
        hs.eventtap.keyStroke({ "ctrl", "shift" }, "tab", 10000)
    else
        focusFull("Firefox")
    end
end)

hs.hotkey.bind({ "cmd" }, "b", function() focusFull("Slack") end)

--
local snapLeft = nil
local snapRight = nil

hs.hotkey.bind({ "cmd" }, "'", function()
    hs.window.animationDuration = 0
    local f = hs.screen.mainScreen():fullFrame()
    local focused = hs.window.focusedWindow()
    if not focused then return end

    -- Toggle focus if both snap windows still alive and focused is one of them
    if snapLeft and snapRight
       and snapLeft:isVisible() and snapRight:isVisible()
       and (focused:id() == snapLeft:id() or focused:id() == snapRight:id()) then
        if focused:id() == snapLeft:id() then
            snapRight:focus()
        else
            snapLeft:focus()
        end
        return
    end

    -- Snap current window → left, Firefox → right
    local firefox = hs.application.get("Firefox")
    local firefoxWin = firefox and firefox:mainWindow()
    if not firefoxWin then
        hs.application.launchOrFocus("Firefox")
        return
    end
    if firefoxWin:id() == focused:id() then return end

    focused:setFrame({ x = f.x, y = f.y, w = f.w / 2, h = f.h })
    firefoxWin:setFrame({ x = f.x + f.w / 2, y = f.y, w = f.w / 2, h = f.h })
    snapLeft = focused
    snapRight = firefoxWin
    firefoxWin:focus()
end)


local function sleep(t) coroutine.applicationYield(t) end

hs.hotkey.bind({ "ctrl", "option" }, "w", function()
    local origSpace = hs.spaces.activeSpaceOnScreen(hs.screen.mainScreen())
    hs.execute("open -na Ghostty")
    hs.execute("/bin/zsh -l -c 'zed -n'")
    hs.application.launchOrFocus("Firefox")
    hs.eventtap.keyStroke({ "cmd" }, "n", 100000)
    maximizeApp("Firefox")
    sleep(0.5)
    hs.spaces.gotoSpace(origSpace)
    sleep(0.5)
    hs.application.launchOrFocus("Zed")
end)

hs.hotkey.bind({ "option", "ctrl" }, "k", function()
    coroutine.wrap(function()
        hs.execute("open -na Ghostty")
        sleep(1)
        -- auth
        hs.eventtap.keyStrokes("aws sso login --profile epic")
        -- run flux9s
        hs.eventtap.keyStrokes("flux9s")
        hs.eventtap.keyStroke({}, "return")
        sleep(1)

        -- split and run k9s
        hs.eventtap.keyStroke({ "cmd", "shift" }, "d")
        sleep(1)
        hs.eventtap.keyStrokes("k9s")
        hs.eventtap.keyStroke({}, "return")
    end)()
end)
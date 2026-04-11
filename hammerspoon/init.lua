local function focusFull(name)
    hs.window.animationDuration = 0

    for _, win in ipairs(hs.window.filter.defaultCurrentSpace:getWindows()) do
        if win:application():name() == name then
            win:focus()
            win:setFrame(win:screen():fullFrame())
            return
        end
    end

    -- No window on current space: launch or switch to it
    hs.application.launchOrFocus(name)
end

hs.hotkey.bind({ "cmd" }, "i", function()
    hs.window.animationDuration = 0
    local focused = hs.window.focusedWindow()
    local focusedApp = focused and focused:application():name()
    if focusedApp == "Zed" then
        focusFull("Ghostty")
    else
        focusFull("Zed")
    end
end)
hs.hotkey.bind({ "cmd" }, "b", function() focusFull("Google Chrome") end)

hs.hotkey.bind({ "cmd", "shift" }, "g", function() hs.execute("open -na Ghostty") end)
hs.hotkey.bind({ "cmd", "shift" }, "i", function() hs.execute("/bin/zsh -l -c 'zed -n'") end)
hs.hotkey.bind({ "cmd", "shift" }, "b", function()
    hs.application.launchOrFocus("Google Chrome")
    hs.eventtap.keyStroke({ "cmd" }, "n", 100000)
end)
hs.hotkey.bind({ "cmd" }, "p", function() focusFull("Slack") end)
--
hs.hotkey.bind({ "cmd" }, "'", function()
    hs.window.animationDuration = 0
    local f = hs.screen.mainScreen():fullFrame()

    local zed = hs.application.get("Zed")
    if zed and zed:mainWindow() then
        zed:mainWindow():setFrame({ x = f.x, y = f.y, w = f.w / 2, h = f.h })
    end

    local chrome = hs.application.get("Google Chrome")
    if chrome and chrome:mainWindow() then
        chrome:mainWindow():setFrame({ x = f.x + f.w / 2, y = f.y, w = f.w / 2, h = f.h })
        chrome:activate()
    end
end)

-- Chrome tabs (create modal to isolate key bindings)
local chromeMod = hs.hotkey.modal.new()

chromeMod:bind({ "cmd" }, "]", function()
    hs.eventtap.keyStroke({ "ctrl" }, "tab", 0)
end)

chromeMod:bind({ "cmd" }, "[", function()
    hs.eventtap.keyStroke({ "ctrl", "shift" }, "tab", 0)
end)

local appWatcher = hs.application.watcher.new(function(name, event, app)
    if event == hs.application.watcher.activated then
        if name == "Google Chrome" then
            chromeMod:enter()
        else
            chromeMod:exit()
        end
    end
end)

appWatcher:start()

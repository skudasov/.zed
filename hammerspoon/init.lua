local function focusFull(name)
    hs.window.animationDuration = 0
    hs.application.launchOrFocus(name)
    local app = hs.application.get(name)
    if app and app:mainWindow() then
        app:mainWindow():setFrame(hs.screen.mainScreen():fullFrame())
    end
end

hs.hotkey.bind({ "cmd" }, "i", function() focusFull("Zed") end)
hs.hotkey.bind({ "cmd" }, "b", function() focusFull("Google Chrome") end)
hs.hotkey.bind({ "cmd" }, "p", function() focusFull("Slack") end)

hs.hotkey.bind({ "cmd" }, "'", function()
    hs.window.animationDuration = 0
    local f = hs.screen.mainScreen():fullFrame()

    local zed = hs.application.get("Zed")
    if zed and zed:mainWindow() then
        zed:mainWindow():setFrame({x=f.x, y=f.y, w=f.w/2, h=f.h})
    end

    local chrome = hs.application.get("Google Chrome")
    if chrome and chrome:mainWindow() then
        chrome:mainWindow():setFrame({x=f.x + f.w/2, y=f.y, w=f.w/2, h=f.h})
        chrome:activate()
    end
end)

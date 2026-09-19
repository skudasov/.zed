-- Managed by ~/.config/zed — `just install-configs` overwrites this file.
--
-- LazyVim loads its own autocmds first, then this file, so everything here is
-- additive.

-- Used only as an editor to preview diagram code (d2)
local group = vim.api.nvim_create_augroup("diagram_autosave", { clear = true })

vim.opt.updatetime = 400

vim.api.nvim_create_autocmd({ "InsertLeave", "TextChanged", "CursorHold", "CursorHoldI", "FocusLost" }, {
  group = group,
  pattern = "*.d2",
  desc = "Write d2 sources so the diagram preview redraws",
  callback = function(event)
    local buf = event.buf
    -- A scratch, help or terminal buffer has nowhere to be written to, and an
    -- unmodified one would only churn the file's mtime and re-render for nothing.
    if vim.bo[buf].buftype ~= "" or not vim.bo[buf].modified or vim.api.nvim_buf_get_name(buf) == "" then
      return
    end
    vim.api.nvim_buf_call(buf, function()
      vim.cmd("silent! noautocmd write")
    end)
  end,
})


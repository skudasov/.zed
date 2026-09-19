-- Managed by ~/.config/zed — `just install-configs` overwrites this file.

-- d2 is whitespace-indented and two spaces is what the language's own examples
-- use, so a diagram edited here stays diffable against one written anywhere else.
vim.api.nvim_create_autocmd("FileType", {
  pattern = "d2",
  desc = "Two-space indentation for d2 sources",
  callback = function()
    vim.bo.shiftwidth = 2
    vim.bo.tabstop = 2
    vim.bo.expandtab = true
    vim.bo.commentstring = "# %s"
  end,
})

-- Neovim has no d2 filetype of its own yet.
vim.filetype.add({ extension = { d2 = "d2" } })

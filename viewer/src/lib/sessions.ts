import { readdirSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

// ── types ─────────────────────────────────────────────────────────────────────

export type TextBlock = {
  type: 'text'
  text: string
}

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: string; text?: string }>
}

export type OtherBlock = {
  type: string
  [key: string]: unknown
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | OtherBlock

export type Message = {
  role: 'user' | 'assistant'
  content: ContentBlock[] | string
  timestamp: string
}

export type SessionMeta = {
  id: string
  project: string
  date: string
  preview: string
}

export type Session = SessionMeta & {
  messages: Message[]
}

// ── parsing ───────────────────────────────────────────────────────────────────

const TRUNCATE = 10000

export function trimContent(content: unknown): ContentBlock[] | string {
  if (typeof content === 'string') return content.slice(0, TRUNCATE)
  if (!Array.isArray(content)) return ''

  return content
    .filter((block): block is Record<string, unknown> => block != null && typeof block === 'object')
    .map((block) => {
    if (block.type === 'tool_use') {
      const raw = JSON.stringify(block.input ?? {})
      return {
        type: 'tool_use',
        id: block.id ?? '',
        name: block.name ?? '',
        input: raw.length > TRUNCATE ? { __output: raw.slice(0, TRUNCATE) + '…' } : block.input,
      } as ToolUseBlock
    }

    if (block.type === 'tool_result') {
      const c = block.content
      let trimmed: ToolResultBlock['content']
      if (typeof c === 'string') {
        trimmed = c.slice(0, TRUNCATE)
      } else if (Array.isArray(c)) {
        trimmed = c.map((b: Record<string, unknown>) => ({
          type: String(b.type ?? 'text'),
          text: typeof b.text === 'string' ? b.text.slice(0, TRUNCATE) : '',
        }))
      } else {
        trimmed = ''
      }
      return { type: 'tool_result', tool_use_id: String(block.tool_use_id ?? ''), content: trimmed } as ToolResultBlock
    }

    return block as ContentBlock
  })
}

export function parseMessages(jsonlPath: string): Message[] {
  const messages: Message[] = []

  for (const raw of readFileSync(jsonlPath, 'utf-8').split('\n')) {
    if (!raw.trim()) continue
    try {
      const entry = JSON.parse(raw)
      if ('attachment' in entry) continue
      const msg = entry.message
      if (!msg?.content || !['user', 'assistant'].includes(msg.role)) continue
      messages.push({ role: msg.role, content: trimContent(msg.content), timestamp: entry.timestamp ?? '' })
    } catch {
      // skip malformed lines
    }
  }

  return messages
}

function firstUserText(messages: Message[]): string {
  for (const msg of messages) {
    if (msg.role !== 'user') continue
    if (typeof msg.content === 'string') return msg.content.slice(0, 240)
    for (const block of msg.content) {
      if (block.type === 'text') return (block as TextBlock).text.slice(0, 240)
    }
  }
  return ''
}

// ── public API ────────────────────────────────────────────────────────────────

export function listSessions(): SessionMeta[] {
  const files: Array<{ project: string; id: string; path: string; mtime: number }> = []

  for (const entry of readdirSync(PROJECTS_DIR)) {
    if (entry === 'sessions') continue
    const dirPath = join(PROJECTS_DIR, entry)
    try {
      if (!statSync(dirPath).isDirectory()) continue
      for (const file of readdirSync(dirPath)) {
        if (!file.endsWith('.jsonl')) continue
        const path = join(dirPath, file)
        files.push({ project: entry, id: basename(file, '.jsonl'), path, mtime: statSync(path).mtimeMs })
      }
    } catch {
      // skip unreadable dirs
    }
  }

  files.sort((a, b) => b.mtime - a.mtime)

  return files.map(({ project, id, path }) => {
    const messages = parseMessages(path)
    return {
      id,
      project,
      date: messages[0]?.timestamp.slice(0, 10) ?? '',
      preview: firstUserText(messages)
    }
  })
}

export function getSession(id: string): Session | null {
  for (const entry of readdirSync(PROJECTS_DIR)) {
    const path = join(PROJECTS_DIR, entry, `${id}.jsonl`)
    try {
      statSync(path)
      const messages = parseMessages(path)
      return {
        id,
        project: entry,
        date: messages[0]?.timestamp.slice(0, 10) ?? '',
        preview: firstUserText(messages),
        messages
      }
    } catch {
      // not in this dir
    }
  }
  return null
}

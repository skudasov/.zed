import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { trimContent, parseMessages } from './sessions'

// ── trimContent ───────────────────────────────────────────────────────────────

describe('trimContent', () => {
  it('passes through plain string', () => {
    expect(trimContent('hello')).toBe('hello')
  })

  it('truncates long plain string', () => {
    const long = 'x'.repeat(15000)
    const result = trimContent(long)
    expect(typeof result).toBe('string')
    expect((result as string).length).toBeLessThanOrEqual(10000)
  })

  it('returns empty string for non-array non-string', () => {
    expect(trimContent(null)).toBe('')
    expect(trimContent(42)).toBe('')
    expect(trimContent({})).toBe('')
  })

  it('handles text block unchanged', () => {
    const blocks = [{ type: 'text', text: 'hello world' }]
    const result = trimContent(blocks) as Array<{ type: string; text: string }>
    expect(result[0].type).toBe('text')
    expect(result[0].text).toBe('hello world')
  })

  it('handles null element inside content array without throwing', () => {
    const blocks = [null, { type: 'text', text: 'ok' }, undefined]
    expect(() => trimContent(blocks)).not.toThrow()
  })

  it('truncates large tool_use input', () => {
    const bigInput = { command: 'x'.repeat(15000) }
    const blocks = [{ type: 'tool_use', id: '1', name: 'Bash', input: bigInput }]
    const result = trimContent(blocks) as Array<{ type: string; input: Record<string, unknown> }>
    expect(result[0].type).toBe('tool_use')
    const inputStr = JSON.stringify(result[0].input)
    expect(inputStr.length).toBeLessThanOrEqual(10100) // 10000 + small overhead
  })

  it('keeps small tool_use input intact', () => {
    const input = { command: 'ls -la' }
    const blocks = [{ type: 'tool_use', id: '1', name: 'Bash', input }]
    const result = trimContent(blocks) as Array<{ type: string; name: string; input: unknown }>
    expect(result[0].name).toBe('Bash')
    expect(result[0].input).toEqual(input)
  })

  it('truncates tool_result string content', () => {
    const blocks = [{ type: 'tool_result', tool_use_id: 'abc', content: 'y'.repeat(15000) }]
    const result = trimContent(blocks) as Array<{ type: string; content: string }>
    expect(result[0].type).toBe('tool_result')
    expect(result[0].content.length).toBeLessThanOrEqual(10000)
  })

  it('truncates tool_result array content', () => {
    const blocks = [{
      type: 'tool_result',
      tool_use_id: 'abc',
      content: [{ type: 'text', text: 'z'.repeat(15000) }]
    }]
    const result = trimContent(blocks) as Array<{ type: string; content: Array<{ text: string }> }>
    expect(result[0].content[0].text.length).toBeLessThanOrEqual(10000)
  })

  it('handles tool_result with null/missing content', () => {
    const blocks = [{ type: 'tool_result', tool_use_id: 'abc', content: null }]
    expect(() => trimContent(blocks)).not.toThrow()
  })

  it('handles unknown block type passthrough', () => {
    const blocks = [{ type: 'image', source: { type: 'base64', data: 'abc' } }]
    const result = trimContent(blocks) as Array<{ type: string }>
    expect(result[0].type).toBe('image')
  })
})

// ── parseMessages ─────────────────────────────────────────────────────────────

function writeTmp(lines: object[]): string {
  const dir = join(tmpdir(), `sessions-test-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'test.jsonl')
  writeFileSync(path, lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  return path
}

function userMsg(text: string, ts = '2024-01-01T00:00:00.000Z') {
  return {
    message: { role: 'user', content: [{ type: 'text', text }] },
    timestamp: ts
  }
}

function assistantMsg(content: unknown, ts = '2024-01-01T00:01:00.000Z') {
  return {
    message: { role: 'assistant', content },
    timestamp: ts
  }
}

function hookEntry() {
  return { attachment: { type: 'hook_success' }, timestamp: '2024-01-01T00:00:00.000Z' }
}

describe('parseMessages', () => {
  let tmpPath: string

  afterEach(() => {
    if (tmpPath) rmSync(tmpPath, { force: true })
  })

  it('parses basic user + assistant messages', () => {
    tmpPath = writeTmp([userMsg('hello'), assistantMsg([{ type: 'text', text: 'world' }])])
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })

  it('skips attachment/hook entries', () => {
    tmpPath = writeTmp([hookEntry(), userMsg('hello')])
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
  })

  it('skips malformed JSON lines without throwing', () => {
    const dir = join(tmpdir(), `sessions-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    tmpPath = join(dir, 'test.jsonl')
    writeFileSync(tmpPath, [
      JSON.stringify(userMsg('before')),
      '{bad json{{',
      JSON.stringify(userMsg('after'))
    ].join('\n'))
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(2)
  })

  it('skips empty lines', () => {
    const dir = join(tmpdir(), `sessions-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    tmpPath = join(dir, 'test.jsonl')
    writeFileSync(tmpPath, '\n\n' + JSON.stringify(userMsg('hi')) + '\n\n')
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(1)
  })

  it('handles tool_use + tool_result in assistant messages', () => {
    tmpPath = writeTmp([assistantMsg([
      { type: 'tool_use', id: '1', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_result', tool_use_id: '1', content: 'file.txt\n' }
    ])])
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(1)
    const content = msgs[0].content as Array<{ type: string }>
    expect(content[0].type).toBe('tool_use')
    expect(content[1].type).toBe('tool_result')
  })

  it('truncates large tool output so total payload stays small', () => {
    const bigOutput = 'x'.repeat(100_000)
    tmpPath = writeTmp([
      userMsg('run something'),
      assistantMsg([
        { type: 'tool_use', id: '1', name: 'Bash', input: { command: 'cat big.txt' } },
        { type: 'tool_result', tool_use_id: '1', content: bigOutput }
      ])
    ])
    const msgs = parseMessages(tmpPath)
    const serialized = JSON.stringify(msgs)
    expect(serialized.length).toBeLessThan(50_000)
  })

  it('handles string content (not array)', () => {
    tmpPath = writeTmp([{ message: { role: 'user', content: 'plain string' }, timestamp: '' }])
    const msgs = parseMessages(tmpPath)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('plain string')
  })

  it('handles null elements inside content array', () => {
    tmpPath = writeTmp([assistantMsg([null, { type: 'text', text: 'hi' }, null])])
    expect(() => parseMessages(tmpPath)).not.toThrow()
  })

  it('preserves timestamps', () => {
    tmpPath = writeTmp([userMsg('hi', '2025-03-15T12:34:56.000Z')])
    const msgs = parseMessages(tmpPath)
    expect(msgs[0].timestamp).toBe('2025-03-15T12:34:56.000Z')
  })

  it('parses large file (1000 messages) without error', () => {
    const lines = Array.from({ length: 1000 }, (_, i) =>
      i % 2 === 0 ? userMsg(`question ${i}`) : assistantMsg([{ type: 'text', text: `answer ${i}` }])
    )
    tmpPath = writeTmp(lines)
    expect(() => parseMessages(tmpPath)).not.toThrow()
    expect(parseMessages(tmpPath)).toHaveLength(1000)
  })
})

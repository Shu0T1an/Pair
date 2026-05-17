import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { readSessionHeader, listAllSessions, findSessionFile } from '../session-scanner'

describe('SessionScanner', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-scanner-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createSessionFile(
    dir: string,
    fileName: string,
    lines: string[]
  ): string {
    const filePath = path.join(dir, fileName)
    const content = lines.join('\n') + '\n'
    fs.writeFileSync(filePath, content, 'utf-8')
    return filePath
  }

  describe('readSessionHeader', () => {
    it('should parse a valid session file', async () => {
      const filePath = createSessionFile(tmpDir, 'session-abc.jsonl', [
        JSON.stringify({ type: 'session', id: 'session-abc', cwd: '/test/project', timestamp: '2026-05-16T10:00:00.000Z' }),
        JSON.stringify({ type: 'session_info', name: '测试会话' }),
        JSON.stringify({ type: 'message', message: { role: 'user', content: '你好' } }),
        JSON.stringify({ type: 'message', message: { role: 'assistant', content: '你好！' } }),
      ])

      const result = await readSessionHeader(filePath)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('session-abc')
      expect(result!.cwd).toBe('/test/project')
      expect(result!.name).toBe('测试会话')
      expect(result!.messageCount).toBe(2)
      expect(result!.firstMessage).toBe('你好')
    })

    it('should return null for non-existent file', async () => {
      const result = await readSessionHeader(path.join(tmpDir, 'nonexistent.jsonl'))
      expect(result).toBeNull()
    })

    it('should return null for invalid content', async () => {
      const filePath = createSessionFile(tmpDir, 'invalid.jsonl', ['not json'])
      const result = await readSessionHeader(filePath)
      expect(result).toBeNull()
    })

    it('should return null when header has no id', async () => {
      const filePath = createSessionFile(tmpDir, 'no-id.jsonl', [
        JSON.stringify({ type: 'session' }),
      ])
      const result = await readSessionHeader(filePath)
      expect(result).toBeNull()
    })

    it('should parse model_change', async () => {
      const filePath = createSessionFile(tmpDir, 'session-model.jsonl', [
        JSON.stringify({ type: 'session', id: 'session-1' }),
        JSON.stringify({ type: 'model_change', modelId: 'gpt-4o' }),
      ])
      const result = await readSessionHeader(filePath)
      expect(result!.model).toBe('gpt-4o')
    })

    it('should extract first user message from array content', async () => {
      const filePath = createSessionFile(tmpDir, 'session-array.jsonl', [
        JSON.stringify({ type: 'session', id: 'session-1' }),
        JSON.stringify({
          type: 'message',
          message: {
            role: 'user',
            content: [{ type: 'text', text: '第一条消息' }],
          },
        }),
      ])
      const result = await readSessionHeader(filePath)
      expect(result!.firstMessage).toBe('第一条消息')
    })
  })

  describe('listAllSessions', () => {
    it('should return empty array when directory does not exist', async () => {
      const result = await listAllSessions(path.join(tmpDir, 'nonexistent'))
      expect(result).toEqual([])
    })

    it('should scan flat structure', async () => {
      createSessionFile(tmpDir, 'session-1.jsonl', [
        JSON.stringify({ type: 'session', id: 's1', cwd: '/project/a' }),
        JSON.stringify({ type: 'message', message: { role: 'user', content: 'hi' } }),
      ])
      createSessionFile(tmpDir, 'session-2.jsonl', [
        JSON.stringify({ type: 'session', id: 's2', cwd: '/project/b' }),
        JSON.stringify({ type: 'message', message: { role: 'user', content: 'hello' } }),
      ])

      const projects = await listAllSessions(tmpDir)
      // 两个不同 cwd 的项目，各自独立
      const projectPaths = projects.map(p => p.projectPath).sort()
      expect(projectPaths).toEqual(['/project/a', '/project/b'])
    })

    it('should scan nested directory structure', async () => {
      const subDir = path.join(tmpDir, 'encoded-path')
      fs.mkdirSync(subDir)
      createSessionFile(subDir, 'session-1.jsonl', [
        JSON.stringify({ type: 'session', id: 's1', cwd: '/project/a' }),
      ])
      createSessionFile(subDir, 'session-2.jsonl', [
        JSON.stringify({ type: 'session', id: 's2', cwd: '/project/a' }),
      ])

      const projects = await listAllSessions(tmpDir)
      expect(projects).toHaveLength(1)
      expect(projects[0].sessions).toHaveLength(2)
    })

    it('should sort sessions by modified time descending', async () => {
      createSessionFile(tmpDir, 'session-old.jsonl', [
        JSON.stringify({ type: 'session', id: 's1' }),
      ])
      await new Promise(r => setTimeout(r, 100))
      createSessionFile(tmpDir, 'session-new.jsonl', [
        JSON.stringify({ type: 'session', id: 's2' }),
      ])

      const projects = await listAllSessions(tmpDir)
      // 全部在根目录，cwd 为空，应该合并到一个 project 中
      expect(projects[0].sessions[0].id).toBe('s2')
    })
  })

  describe('findSessionFile', () => {
    it('should find session file in flat structure', async () => {
      const filePath = createSessionFile(tmpDir, 'session-abc123.jsonl', [
        JSON.stringify({ type: 'session', id: 'abc123' }),
      ])
      const result = await findSessionFile(tmpDir, 'abc123')
      expect(result).toBe(filePath)
    })

    it('should return null when session not found', async () => {
      const result = await findSessionFile(tmpDir, 'nonexistent')
      expect(result).toBeNull()
    })

    it('should return null when root does not exist', async () => {
      const result = await findSessionFile(path.join(tmpDir, 'no-dir'), 'abc')
      expect(result).toBeNull()
    })
  })
})

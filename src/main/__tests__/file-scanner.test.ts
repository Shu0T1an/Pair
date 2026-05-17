import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { searchProjectFiles, readFileContent, isTextFile } from '../file-scanner'

describe('FileScanner', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-scanner-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('searchProjectFiles', () => {
    it('should find files matching single query part', () => {
      fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'Button.tsx'), '')
      fs.writeFileSync(path.join(tmpDir, 'src', 'utils.ts'), '')

      const results = searchProjectFiles(tmpDir, 'Button')
      expect(results).toHaveLength(1)
      expect(results[0].relativePath).toBe(path.join('src', 'components', 'Button.tsx'))
    })

    it('should match multi-part query path', () => {
      fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'Button.tsx'), '')

      // "src/comp" should match because the relative path contains "src" then later "comp"
      const results = searchProjectFiles(tmpDir, 'src/components/Button')
      expect(results).toHaveLength(1)
    })

    it('should ignore node_modules directory', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), '')

      const results = searchProjectFiles(tmpDir, 'index')
      expect(results).toHaveLength(0)
    })

    it('should ignore binary file extensions', () => {
      fs.writeFileSync(path.join(tmpDir, 'image.png'), 'fake png')
      fs.writeFileSync(path.join(tmpDir, 'archive.zip'), 'fake zip')

      const results = searchProjectFiles(tmpDir, 'image')
      expect(results).toHaveLength(0)
    })

    it('should return empty array when project path does not exist', () => {
      const results = searchProjectFiles(path.join(tmpDir, 'nonexistent'), 'test')
      expect(results).toEqual([])
    })

    it('should limit results to maxResults', () => {
      for (let i = 0; i < 30; i++) {
        fs.writeFileSync(path.join(tmpDir, `file-${i}.ts`), '')
      }
      const results = searchProjectFiles(tmpDir, 'file-', 5)
      expect(results).toHaveLength(5)
    })
  })

  describe('readFileContent', () => {
    it('should read text file content', () => {
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello world')
      const content = readFileContent(path.join(tmpDir, 'test.txt'))
      expect(content).toBe('hello world')
    })

    it('should return null for non-existent file', () => {
      const content = readFileContent(path.join(tmpDir, 'nonexistent.txt'))
      expect(content).toBeNull()
    })

    it('should return oversized message for large files', () => {
      const largeContent = 'x'.repeat(200 * 1024)
      fs.writeFileSync(path.join(tmpDir, 'large.txt'), largeContent)
      const content = readFileContent(path.join(tmpDir, 'large.txt'))
      expect(content).toContain('[文件过大')
    })
  })

  describe('isTextFile', () => {
    it('should identify TypeScript files as text', () => {
      expect(isTextFile('file.ts')).toBe(true)
      expect(isTextFile('file.tsx')).toBe(true)
    })

    it('should identify Python files as text', () => {
      expect(isTextFile('file.py')).toBe(true)
    })

    it('should not identify image files as text', () => {
      expect(isTextFile('file.png')).toBe(false)
      expect(isTextFile('file.jpg')).toBe(false)
    })
  })
})

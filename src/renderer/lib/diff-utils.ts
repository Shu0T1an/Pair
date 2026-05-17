// SDK diff 格式: +NN content / -NN content /  NN content

type DiffEntry = { type: 'add' | 'del' | 'ctx'; oldLine?: number; newLine?: number; content: string }

function buildHunkFromEntries(entries: DiffEntry[]): string[] {
  if (entries.length === 0) return []

  const oldStart = entries.find(e => e.oldLine !== undefined)?.oldLine ?? 1
  const newStart = entries.find(e => e.newLine !== undefined)?.newLine ?? 1

  const ctxCount = entries.filter(e => e.type === 'ctx').length
  const delCount = entries.filter(e => e.type === 'del').length
  const addCount = entries.filter(e => e.type === 'add').length

  const oldCount = ctxCount + delCount
  const newCount = ctxCount + addCount

  const body = entries.map(e => {
    if (e.type === 'ctx') return ` ${e.content}`
    if (e.type === 'del') return `-${e.content}`
    return `+${e.content}`
  })

  return [`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`, ...body]
}

export function customDiffToUnifiedPatch(diff: string, filePath: string): string {
  if (!diff) return ''

  const lines = diff.split('\n')
  const result: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ]

  let currentHunk: DiffEntry[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) continue

    if (line.trim() === '...') {
      if (currentHunk.length > 0) {
        result.push(...buildHunkFromEntries(currentHunk))
        currentHunk = []
      }
      continue
    }

    const prefix = line[0]
    if (prefix !== '+' && prefix !== '-' && prefix !== ' ') continue

    const rest = line.slice(1).trimStart()

    const match = rest.match(/^(\d+)\s+(.*)$/)
    let content: string
    let oldLine: number | undefined
    let newLine: number | undefined

    if (match) {
      const lineNum = parseInt(match[1], 10)
      content = match[2]
      if (prefix === '+') {
        newLine = lineNum
      } else if (prefix === '-') {
        oldLine = lineNum
      } else {
        oldLine = lineNum
        newLine = lineNum
      }
    } else {
      content = rest
    }

    const type = prefix === '+' ? 'add' as const : prefix === '-' ? 'del' as const : 'ctx' as const
    currentHunk.push({ type, oldLine, newLine, content })
  }

  if (currentHunk.length > 0) {
    result.push(...buildHunkFromEntries(currentHunk))
  }

  return result.join('\n')
}

export function countDiffLinesFromPatch(diff: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    const trimmed = line.trimEnd()
    if (trimmed.startsWith('+') && !trimmed.startsWith('+++')) additions++
    if (trimmed.startsWith('-') && !trimmed.startsWith('---')) deletions++
  }
  return { additions, deletions }
}

export function buildWriteDiff(filePath: string, content: string): string {
  if (!content) {
    return `--- a/${filePath}\n+++ b/${filePath}\n@@ -0,0 +1,0 @@\n`
  }
  const lines = content.split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  const body = lines.map(line => `+${line}`).join('\n')
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lines.length || 0} @@`,
    body,
  ].join('\n')
}

export function getToolFilePath(args: Record<string, unknown>): string {
  return String(args?.filePath ?? args?.path ?? args?.file ?? '')
}

export function getWriteContent(result: string | undefined): string {
  if (!result) return ''
  try {
    const parsed = JSON.parse(result)
    if (typeof parsed.content === 'string') return parsed.content
    if (typeof parsed.text === 'string') return parsed.text
  } catch {
  }
  return result
}

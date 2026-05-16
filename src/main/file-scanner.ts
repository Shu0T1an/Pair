import fs from 'fs';
import path from 'path';

/**
 * 搜索结果项
 */
export interface FileSearchResult {
  /** 相对项目根目录的路径 */
  relativePath: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 是否是目录 */
  isDirectory: boolean;
}

const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.pair',
  '.pi',
  '.agents',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '__pycache__',
  '.cache',
  'target',
  'build',
  'release',
  'out',
]);

const DEFAULT_IGNORE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib',
  '.map', '.min.js', '.min.css',
]);

const MAX_SCAN_DEPTH = 5;
const MAX_RESULTS = 25;

/**
 * 扫描工作区文件，按查询关键词模糊匹配
 */
export function searchProjectFiles(
  projectPath: string,
  query: string,
  maxResults: number = MAX_RESULTS
): FileSearchResult[] {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return [];
  }

  const results: FileSearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  const queryParts = lowerQuery.split(/[/\\]/).filter(Boolean);

  function scan(dir: string, depth: number = 0) {
    if (depth > MAX_SCAN_DEPTH || results.length >= maxResults) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.isDirectory() && DEFAULT_IGNORE_DIRS.has(entry.name)) continue;

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (DEFAULT_IGNORE_EXTENSIONS.has(ext)) continue;
        if (entry.name.endsWith('.d.ts')) continue;
      }

      if (matchesQuery(relativePath, queryParts)) {
        results.push({
          relativePath,
          absolutePath: fullPath,
          isDirectory: entry.isDirectory(),
        });
      }

      if (entry.isDirectory()) {
        scan(fullPath, depth + 1);
      }
    }
  }

  scan(projectPath);
  return results;
}

/**
 * 判断路径是否匹配查询词（多段模糊匹配）
 * "src/comp" → 匹配 "src/components/Button.tsx"
 */
function matchesQuery(relativePath: string, queryParts: string[]): boolean {
  if (queryParts.length === 0) return false;

  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();

  let searchFrom = 0;
  for (const part of queryParts) {
    const index = normalizedPath.indexOf(part, searchFrom);
    if (index < 0) return false;
    searchFrom = index + part.length;
  }
  return true;
}

/**
 * 读取文件内容（限制大小，防止大文件阻塞）
 */
export function readFileContent(
  filePath: string,
  maxSize: number = 1024 * 100
): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    if (stat.size > maxSize) {
      return `[文件过大 (${(stat.size / 1024).toFixed(1)}KB)，已跳过]`;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 判断文件是否为文本文件（用于预览过滤）
 */
export function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const textExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.json', '.jsonc', '.yaml', '.yml', '.toml',
    '.md', '.mdx', '.txt', '.html', '.css', '.scss', '.less',
    '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
    '.c', '.h', '.cpp', '.hpp', '.cs',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.xml', '.svg', '.plist',
    '.env', '.gitignore', '.dockerignore',
    '.sql', '.graphql', '.prisma',
    '.vue', '.svelte', '.astro',
  ]);
  return textExtensions.has(ext);
}

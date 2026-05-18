import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServerRegistry } from '../mcp/mcp-server-registry.js';
import type { McpServerConfig } from '../../shared/types.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

const { mockClient, mockStdioTransport } = vi.hoisted(() => {
  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [], nextCursor: undefined }),
    callTool: vi.fn(),
    on: vi.fn(),
  };
  const Transport = vi.fn().mockImplementation(() => ({
    onerror: null,
    onclose: null,
    stderr: null,
    start: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  }));
  return { mockClient: client, mockStdioTransport: Transport };
  return { mockClient: client, mockStdioTransport: Transport };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: function () { return mockClient; },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: function StdioClientTransport() {
    return mockStdioTransport();
  },
}));

// ── Helpers ──

function makeConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: 'test-server',
    name: 'Test Server',
    command: 'node',
    args: ['server.js'],
    autoStart: false,
    disabled: false,
    ...overrides,
  };
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pair-mcp-test-'));
}

describe('McpServerRegistry', () => {
  let registry: McpServerRegistry;
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    configPath = path.join(tempDir, 'mcp-servers.json');
    registry = new McpServerRegistry(configPath);

    vi.clearAllMocks();
    mockStdioTransport.mockClear();
    mockClient.listTools.mockResolvedValue({ tools: [], nextCursor: undefined });
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.close.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ── 配置管理 ──

  describe('配置管理', () => {
    it('初始状态配置列表应为空', () => {
      expect(registry.getAllConfigs()).toEqual([]);
    });

    it('添加服务器配置后应能获取到', () => {
      const config = makeConfig();
      const result = registry.addServer(config);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'test-server', name: 'Test Server' });
    });

    it('重复添加相同 id 的服务器应覆盖', () => {
      registry.addServer(makeConfig({ name: 'Original' }));
      registry.addServer(makeConfig({ name: 'Updated' }));
      const configs = registry.getAllConfigs();
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe('Updated');
    });

    it('删除服务器配置', () => {
      registry.addServer(makeConfig());
      registry.removeServer('test-server');
      expect(registry.getAllConfigs()).toEqual([]);
    });

    it('删除不存在的 id 不应报错', () => {
      registry.addServer(makeConfig());
      registry.removeServer('non-existent');
      expect(registry.getAllConfigs()).toHaveLength(1);
    });

    it('添加多个服务器应全部列出', () => {
      registry.addServer(makeConfig({ id: 's1', name: 'Server 1' }));
      registry.addServer(makeConfig({ id: 's2', name: 'Server 2' }));
      registry.addServer(makeConfig({ id: 's3', name: 'Server 3' }));
      expect(registry.getAllConfigs()).toHaveLength(3);
    });

    it('配置应持久化到文件系统', () => {
      registry.addServer(makeConfig());
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.servers).toHaveLength(1);
      expect(parsed.servers[0].id).toBe('test-server');
    });

    it('从文件系统加载配置', () => {
      registry.addServer(makeConfig());
      const registry2 = new McpServerRegistry(configPath);
      expect(registry2.getAllConfigs()).toHaveLength(1);
    });

    it('加载损坏的 JSON 应返回空数组', () => {
      fs.writeFileSync(configPath, 'not-json', 'utf-8');
      expect(registry.getAllConfigs()).toEqual([]);
    });
  });

  // ── 连接管理 ──

  describe('连接管理', () => {
    it('连接服务器成功时应更新状态为 connected', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [{ name: 'tool1', inputSchema: { type: 'object', properties: {} } }] });

      registry.addServer(makeConfig());
      await registry.connectServer(makeConfig());

      const status = registry.getServerStatus('test-server');
      expect(status).toBeDefined();
      expect(status!.status).toBe('connected');
      expect(status!.toolCount).toBe(1);
    });

    it('连接失败时应抛出错误并更新状态为 error', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection refused'));

      registry.addServer(makeConfig());

      await expect(registry.connectServer(makeConfig())).rejects.toThrow('Connection refused');

      const status = registry.getServerStatus('test-server');
      expect(status).toBeDefined();
      expect(status!.status).toBe('error');
    });

    it('断开连接后状态应为 disconnected', async () => {
      registry.addServer(makeConfig());
      await registry.connectServer(makeConfig());
      await registry.disconnectServer('test-server');

      const status = registry.getServerStatus('test-server');
      expect(status!.status).toBe('disconnected');
      expect(status!.toolCount).toBe(0);
    });

    it('断开不存在的连接不应报错', async () => {
      await expect(registry.disconnectServer('non-existent')).resolves.toBeUndefined();
    });

    it('重新连接已连接的服务器应先断开再连接', async () => {
      registry.addServer(makeConfig());
      await registry.connectServer(makeConfig());

      // 重新连接
      await registry.connectServer(makeConfig());

      // close 被调用了一次（旧连接被关闭）
      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });

    it('获取不存在的服务器状态应返回 undefined', () => {
      expect(registry.getServerStatus('non-existent')).toBeUndefined();
    });

    it('已配置但未连接的服务器状态应为 disconnected', () => {
      registry.addServer(makeConfig({ id: 's1' }));
      const status = registry.getServerStatus('s1');
      expect(status).toBeDefined();
      expect(status!.status).toBe('disconnected');
    });
  });

  // ── 工具查询 ──

  describe('工具查询', () => {
    beforeEach(async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
          { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
        ],
      });

      registry.addServer(makeConfig({ id: 'fs-server', name: 'FileSystem' }));
      await registry.connectServer(makeConfig({ id: 'fs-server', name: 'FileSystem' }));
    });

    it('获取所有工具', () => {
      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(2);
      expect(allTools[0].serverId).toBe('fs-server');
      expect(allTools[0].tool.name).toBe('read_file');
      expect(allTools[1].tool.name).toBe('write_file');
    });

    it('获取指定服务器的工具', () => {
      const tools = registry.getServerTools('fs-server');
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('read_file');
      expect(tools[1].name).toBe('write_file');
    });

    it('未连接的服务器返回空工具列表', () => {
      registry.addServer(makeConfig({ id: 'offline' }));
      expect(registry.getServerTools('offline')).toEqual([]);
    });

    it('调用工具应返回结果', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'file content' }],
        isError: false,
      });

      const result = await registry.callTool('fs-server', 'read_file', { path: '/test.txt' });
      expect(result).toBe('file content');
      expect(mockClient.callTool).toHaveBeenCalledWith(
        { name: 'read_file', arguments: { path: '/test.txt' } },
        undefined,
        expect.objectContaining({ timeout: 60_000 })
      );
    });

    it('工具执行错误应抛出', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'File not found' }],
        isError: true,
      });

      await expect(registry.callTool('fs-server', 'read_file', { path: '/missing.txt' }))
        .rejects.toThrow('工具执行错误: File not found');
    });

    it('未连接服务器调用工具应报错', async () => {
      registry.addServer(makeConfig({ id: 'offline' }));
      await expect(registry.callTool('offline', 'any', {}))
        .rejects.toThrow('MCP 服务器 "offline" 未连接');
    });

    it('不存在的服务器调用工具应报错', async () => {
      await expect(registry.callTool('ghost', 'any', {}))
        .rejects.toThrow('MCP 服务器 "ghost" 未连接');
    });

    it('分页获取工具应合并结果', async () => {
      // 模拟分页
      mockClient.listTools
        .mockResolvedValueOnce({ tools: [{ name: 'tool_a', inputSchema: { type: 'object', properties: {} } }], nextCursor: 'page2' })
        .mockResolvedValueOnce({ tools: [{ name: 'tool_b', inputSchema: { type: 'object', properties: {} } }], nextCursor: undefined });

      registry.addServer(makeConfig({ id: 'paginated' }));
      await registry.connectServer(makeConfig({ id: 'paginated' }));

      const tools = registry.getServerTools('paginated');
      expect(tools).toHaveLength(2);
    });
  });

  // ── 自动连接 ──

  describe('自动连接', () => {
    it('应自动连接所有 autoStart 的服务器', async () => {
      registry.addServer(makeConfig({ id: 'auto1', autoStart: true }));
      registry.addServer(makeConfig({ id: 'auto2', autoStart: true }));
      registry.addServer(makeConfig({ id: 'manual', autoStart: false }));

      await registry.connectAllAutoStart();

      // 只有 autoStart 的服务器被连接
      const statuses = registry.getAllServerStatuses();
      const connected = statuses.filter(s => s.status === 'connected');
      expect(connected).toHaveLength(2);
    });

    it('autoStart 但 disabled 的服务器不应自动连接', async () => {
      registry.addServer(makeConfig({ id: 'auto-disabled', autoStart: true, disabled: true }));
      await registry.connectAllAutoStart();

      const status = registry.getServerStatus('auto-disabled');
      expect(status!.status).toBe('disconnected');
    });

    it('自动连接部分失败不应影响其他', async () => {
      mockClient.connect
        .mockResolvedValueOnce(undefined) // s1 成功
        .mockRejectedValueOnce(new Error('Failed')) // s2 失败
        .mockResolvedValueOnce(undefined); // s3 成功

      registry.addServer(makeConfig({ id: 's1', autoStart: true }));
      registry.addServer(makeConfig({ id: 's2', autoStart: true }));
      registry.addServer(makeConfig({ id: 's3', autoStart: true }));

      await registry.connectAllAutoStart();

      const s1 = registry.getServerStatus('s1');
      const s2 = registry.getServerStatus('s2');
      const s3 = registry.getServerStatus('s3');
      expect(s1!.status).toBe('connected');
      expect(s2!.status).toBe('error');
      expect(s3!.status).toBe('connected');
    });
  });

  // ── 断开全部 ──

  describe('断开全部', () => {
    it('应断开所有活动的连接', async () => {
      registry.addServer(makeConfig({ id: 's1' }));
      registry.addServer(makeConfig({ id: 's2' }));
      await registry.connectServer(makeConfig({ id: 's1' }));
      await registry.connectServer(makeConfig({ id: 's2' }));

      await registry.disconnectAll();

      expect(mockClient.close).toHaveBeenCalledTimes(2);
      expect(registry.getAllServerStatuses().every(s => s.status === 'disconnected')).toBe(true);
    });

    it('无连接时不应报错', async () => {
      await expect(registry.disconnectAll()).resolves.toBeUndefined();
    });
  });

  // ── 状态查询 ──

  describe('状态查询', () => {
    it('getAllServerStatuses 应包含所有配置的服务器', () => {
      registry.addServer(makeConfig({ id: 's1', name: 'Server 1' }));
      registry.addServer(makeConfig({ id: 's2', name: 'Server 2' }));
      const statuses = registry.getAllServerStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.id).sort()).toEqual(['s1', 's2']);
    });

    it('getAllServerStatuses 应反映连接状态', async () => {
      registry.addServer(makeConfig({ id: 's1', autoStart: false }));
      registry.addServer(makeConfig({ id: 's2', autoStart: false }));
      await registry.connectServer(makeConfig({ id: 's1' }));

      const statuses = registry.getAllServerStatuses();
      const s1 = statuses.find(s => s.id === 's1');
      const s2 = statuses.find(s => s.id === 's2');
      expect(s1!.status).toBe('connected');
      expect(s2!.status).toBe('disconnected');
    });

    it('已连接的服务器状态应包含工具数量', async () => {
      await registry.connectServer(makeConfig({ id: 's1' }));
      const status = registry.getServerStatus('s1');
      expect(status).toBeDefined();
      expect(status).toHaveProperty('toolCount');
    });
  });

  // ── 事件 ──

  describe('事件', () => {
    it('连接状态变化应触发 status_changed 事件', async () => {
      const statusHandler = vi.fn();
      registry.on('status_changed', statusHandler);

      registry.addServer(makeConfig());
      await registry.connectServer(makeConfig());

      // 连接成功应触发 status_changed (connected)
      const connectedEvent = statusHandler.mock.calls.find(
        (c: any[]) => c[0]?.status === 'connected'
      );
      expect(connectedEvent).toBeDefined();
      expect(connectedEvent![0]).toMatchObject({
        serverId: 'test-server',
        status: 'connected',
      });
    });

    it('工具列表变化应触发 tools_changed 事件', async () => {
      const toolsHandler = vi.fn();
      registry.on('tools_changed', toolsHandler);

      registry.addServer(makeConfig());
      await registry.connectServer(makeConfig());

      expect(toolsHandler).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: 'test-server' })
      );
    });
  });
});

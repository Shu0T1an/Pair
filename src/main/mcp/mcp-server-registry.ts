import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import type { McpServerConfig, McpServerStatus } from '../../shared/types.js';

interface McpConnection {
  client: Client;
  transport: StdioClientTransport;
  config: McpServerConfig;
  tools: Tool[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: Error;
  stderrBuffer: string[];
  cwd?: string;
  projectPath?: string;
}

const MCP_CONFIG_FILENAME = 'mcp-servers.json';

function getGlobalConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const pairDir = path.join(homeDir, '.pair');
  return path.join(pairDir, MCP_CONFIG_FILENAME);
}

function getProjectConfigPath(projectPath: string): string {
  return path.join(projectPath, '.pair', MCP_CONFIG_FILENAME);
}

function loadConfigFile(configPath: string): McpServerConfig[] {
  try {
    if (!fs.existsSync(configPath)) return [];
    const data = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.servers) ? parsed.servers : [];
  } catch (error) {
    console.error(`[McpRegistry] 加载配置失败 (${configPath}):`, error);
    return [];
  }
}

function saveConfigFile(configPath: string, servers: McpServerConfig[]): void {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ servers }, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[McpRegistry] 保存配置失败 (${configPath}):`, error);
  }
}

export class McpServerRegistry extends EventEmitter {
  private connections = new Map<string, McpConnection>();
  private globalConfigPath: string;

  constructor(configPath?: string) {
    super();
    this.globalConfigPath = configPath || getGlobalConfigPath();
  }

  // ── 全局配置管理 ──

  getGlobalConfigPath(): string {
    return this.globalConfigPath;
  }

  loadGlobalConfig(): McpServerConfig[] {
    return loadConfigFile(this.globalConfigPath);
  }

  saveGlobalConfig(servers: McpServerConfig[]): void {
    saveConfigFile(this.globalConfigPath, servers);
  }

  addServer(config: McpServerConfig): McpServerConfig[] {
    const servers = this.loadGlobalConfig();
    const idx = servers.findIndex(s => s.id === config.id);
    if (idx >= 0) {
      servers[idx] = { ...config, scope: 'global' };
    } else {
      servers.push({ ...config, scope: 'global' });
    }
    this.saveGlobalConfig(servers);
    return servers;
  }

  removeServer(id: string): McpServerConfig[] {
    const servers = this.loadGlobalConfig().filter(s => s.id !== id);
    this.saveGlobalConfig(servers);
    return servers;
  }

  getAllConfigs(): McpServerConfig[] {
    return this.loadGlobalConfig();
  }

  // ── 项目级配置管理 ──

  getProjectConfigPath(projectPath: string): string {
    return getProjectConfigPath(projectPath);
  }

  loadProjectConfig(projectPath: string): McpServerConfig[] {
    const configPath = getProjectConfigPath(projectPath);
    const configs = loadConfigFile(configPath);
    return configs.map(c => ({ ...c, scope: 'project' as const }));
  }

  saveProjectConfig(projectPath: string, servers: McpServerConfig[]): void {
    const configPath = getProjectConfigPath(projectPath);
    saveConfigFile(configPath, servers);
  }

  loadAllConfigs(projectPath?: string): McpServerConfig[] {
    const global = this.loadGlobalConfig().map(c => ({ ...c, scope: 'global' as const }));
    if (!projectPath) return global;
    const project = this.loadProjectConfig(projectPath);
    return [...global, ...project];
  }

  // ── 连接管理 ──

  async connectServer(config: McpServerConfig, cwd?: string): Promise<void> {
    if (this.connections.has(config.id)) {
      await this.disconnectServer(config.id);
    }

    const resolvedCwd = cwd || undefined;

    const transportParams: StdioServerParameters = {
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
      cwd: resolvedCwd,
      stderr: 'pipe',
    };

    const transport = new StdioClientTransport(transportParams);

    const client = new Client(
      { name: 'Pair', version: '1.0.0' },
      {
        capabilities: {},
        listChanged: {
          tools: {
            onChanged: (error, tools) => {
              if (error) {
                console.error(`[McpRegistry][${config.name}] 工具列表刷新失败:`, error);
                return;
              }
              const conn = this.connections.get(config.id);
              if (conn) {
                conn.tools = tools ?? [];
                this.emit('tools_changed', { serverId: config.id, tools: conn.tools });
              }
            },
          },
        },
      }
    );

    const connection: McpConnection = {
      client,
      transport,
      config,
      tools: [],
      status: 'connecting',
      stderrBuffer: [],
      cwd: resolvedCwd,
      projectPath: config.scope === 'project' ? resolvedCwd : undefined,
    };

    transport.onerror = (error) => {
      connection.status = 'error';
      connection.error = error;
      console.error(`[McpRegistry][${config.name}] 传输层错误:`, error.message);
      this.emit('status_changed', { serverId: config.id, status: 'error', error: error.message });
    };

    transport.onclose = () => {
      connection.status = 'disconnected';
      console.warn(`[McpRegistry][${config.name}] 连接已关闭`);
      this.emit('status_changed', { serverId: config.id, status: 'disconnected' });
    };

    const stderr = transport.stderr;
    if (stderr) {
      stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        connection.stderrBuffer.push(text);
        if (connection.stderrBuffer.length > 100) {
          connection.stderrBuffer.shift();
        }
      });
    }

    this.connections.set(config.id, connection);

    try {
      await client.connect(transport, { timeout: 15_000 });

      connection.status = 'connected';

      const allTools: Tool[] = [];
      let cursor: string | undefined;
      do {
        const result = await client.listTools(
          { cursor },
          { timeout: 15_000 }
        );
        allTools.push(...result.tools);
        cursor = result.nextCursor;
      } while (cursor);

      connection.tools = allTools;
      this.emit('status_changed', { serverId: config.id, status: 'connected', toolCount: allTools.length });
      this.emit('tools_changed', { serverId: config.id, tools: allTools });
    } catch (error) {
      connection.status = 'error';
      connection.error = error as Error;
      const stderrLog = connection.stderrBuffer.join('').slice(-2000);
      this.emit('status_changed', {
        serverId: config.id,
        status: 'error',
        error: (error as Error).message + (stderrLog ? `\nstderr: ${stderrLog}` : ''),
      });
      throw error;
    }
  }

  async disconnectServer(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;

    try {
      await conn.client.close();
    } catch (error) {
      console.error(`[McpRegistry][${id}] 关闭连接时出错:`, error);
    } finally {
      this.connections.delete(id);
      this.emit('status_changed', { serverId: id, status: 'disconnected', toolCount: 0 });
    }
  }

  async connectAllAutoStart(): Promise<void> {
    const configs = this.loadGlobalConfig().filter(s => s.autoStart && !s.disabled);
    const results = await Promise.allSettled(
      configs.map(config =>
        this.connectServer(config).catch(err =>
          console.error(`[McpRegistry][${config.name}] 自动连接失败:`, err.message)
        )
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[McpRegistry] 自动连接完成: ${succeeded}/${configs.length}`);
  }

  async connectProjectServers(projectPath: string): Promise<void> {
    const configs = this.loadProjectConfig(projectPath).filter(s => !s.disabled);
    if (configs.length === 0) return;

    const results = await Promise.allSettled(
      configs.map(config =>
        this.connectServer(config, projectPath).catch(err =>
          console.error(`[McpRegistry][${config.name}] 项目连接失败:`, err.message)
        )
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[McpRegistry] 项目 MCP 连接完成: ${succeeded}/${configs.length} (${projectPath})`);
  }

  async disconnectProjectServers(projectPath: string): Promise<void> {
    const ids: string[] = [];
    for (const [id, conn] of this.connections) {
      if (conn.projectPath === projectPath) {
        ids.push(id);
      }
    }
    await Promise.allSettled(ids.map(id => this.disconnectServer(id)));
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.allSettled(ids.map(id => this.disconnectServer(id)));
  }

  async reconnectServer(id: string): Promise<void> {
    const configs = this.loadAllConfigs();
    const config = configs.find(s => s.id === id);
    if (!config) throw new Error(`服务器配置不存在: ${id}`);
    await this.connectServer(config);
  }

  // ── 工具查询 ──

  getAllTools(): Array<{ serverId: string; tool: Tool }> {
    const result: Array<{ serverId: string; tool: Tool }> = [];
    for (const [id, conn] of this.connections) {
      if (conn.status === 'connected') {
        for (const tool of conn.tools) {
          result.push({ serverId: id, tool });
        }
      }
    }
    return result;
  }

  getServerTools(serverId: string): Tool[] {
    const conn = this.connections.get(serverId);
    return conn?.tools ?? [];
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<string> {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCP 服务器 "${serverId}" 未连接`);
    }

    const result = await conn.client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { signal, timeout: 60_000, maxTotalTimeout: 600_000 }
    ) as { content: Array<{ type: string; text?: string; [key: string]: unknown }>; isError?: boolean; structuredContent?: Record<string, unknown> };

    if (result.isError) {
      const errorText = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      throw new Error(`工具执行错误: ${errorText}`);
    }

    if ('structuredContent' in result && result.structuredContent) {
      return JSON.stringify(result.structuredContent);
    }

    return result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }

  // ── 状态查询 ──

  getServerStatus(id: string): McpServerStatus | undefined {
    const conn = this.connections.get(id);
    if (!conn) {
      const configs = this.loadAllConfigs();
      const config = configs.find(s => s.id === id);
      if (!config) return undefined;
      return { id: config.id, name: config.name, status: 'disconnected', toolCount: 0 };
    }
    return {
      id: conn.config.id,
      name: conn.config.name,
      status: conn.status,
      toolCount: conn.tools.length,
      error: conn.error?.message,
    };
  }

  getAllServerStatuses(projectPath?: string): McpServerStatus[] {
    const configs = this.loadAllConfigs(projectPath);
    const statusMap = new Map<string, McpServerStatus>();

    for (const config of configs) {
      statusMap.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'disconnected',
        toolCount: 0,
      });
    }

    for (const [id, conn] of this.connections) {
      statusMap.set(id, {
        id: conn.config.id,
        name: conn.config.name,
        status: conn.status,
        toolCount: conn.tools.length,
        error: conn.error?.message,
      });
    }

    return Array.from(statusMap.values());
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertMcpToolToAgentTool, getAllMcpAgentTools, getMcpAgentToolSchemas } from '../mcp/mcp-tool-converter.js';
import { McpServerRegistry } from '../mcp/mcp-server-registry.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Mock pi-coding-agent's defineTool
const mockDefineTool = vi.fn((def: any) => def);
vi.mock('@earendil-works/pi-coding-agent', () => ({
  defineTool: (def: any) => mockDefineTool(def),
}));

// Mock @sinclair/typebox (jsonSchemaToTypeBox uses it internally)
// We test via the exported functions that call it
vi.mock('@sinclair/typebox', () => {
  const T = {
    Object: (props: any, opts?: any) => ({ type: 'object', properties: props, ...opts }),
    String: () => ({ type: 'string' }),
    Number: () => ({ type: 'number' }),
    Integer: () => ({ type: 'integer' }),
    Boolean: () => ({ type: 'boolean' }),
    Array: (item: any) => ({ type: 'array', items: item }),
    Unknown: () => ({ type: 'unknown' }),
    Record: (_key: any, val: any) => ({ type: 'object', additionalProperties: val }),
    Unsafe: (schema: any) => schema,
  };
  return { Type: T };
});

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    ...overrides,
  } as Tool;
}

describe('mcp-tool-converter', () => {
  let registry: McpServerRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new McpServerRegistry('/tmp/test-mcp-config.json');
  });

  describe('convertMcpToolToAgentTool', () => {
    it('应生成包含 serverId 前缀的工具名称', () => {
      const tool = makeTool({ name: 'read_file' });
      const result = convertMcpToolToAgentTool(tool, 'filesystem', 'FileSystem', registry);

      expect(result.name).toBe('filesystem__read_file');
    });

    it('应生成带服务器名称标签的工具', () => {
      const tool = makeTool({ name: 'write_file' });
      const result = convertMcpToolToAgentTool(tool, 'fs', 'FileSystem', registry);

      expect(result.label).toContain('[FileSystem]');
      expect(result.label).toContain('write_file');
    });

    it('没有 description 时应生成默认描述', () => {
      const tool = makeTool({ description: undefined });
      const result = convertMcpToolToAgentTool(tool, 's1', 'Server1', registry);

      expect(result.description).toBe('Server1 提供的 MCP 工具');
    });

    it('有 description 时应保留', () => {
      const tool = makeTool({ description: 'Read file from disk' });
      const result = convertMcpToolToAgentTool(tool, 'fs', 'FS', registry);

      expect(result.description).toBe('Read file from disk');
    });

    it('应生成包含参数的 schema', () => {
      const tool = makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            recursive: { type: 'boolean' },
            limit: { type: 'integer' },
          },
          required: ['path'],
        },
      });
      const result = convertMcpToolToAgentTool(tool, 'fs', 'FS', registry);

      expect(result.parameters).toBeDefined();
      expect(result.execute).toBeDefined();
    });

    it('execute 应调用 registry.callTool', async () => {
      const tool = makeTool({ name: 'read' });
      const result = convertMcpToolToAgentTool(tool, 'fs', 'FS', registry);

      const callToolSpy = vi.spyOn(registry, 'callTool').mockResolvedValue('result ok');

      const execResult = await result.execute('call-1', { path: '/test.txt' }, undefined as any, undefined as any, {} as any);

      expect(callToolSpy).toHaveBeenCalledWith('fs', 'read', { path: '/test.txt' }, undefined);
      expect(execResult).toEqual({ content: [{ type: 'text', text: 'result ok' }], details: {} });
    });

    it('空 properties 应生成空对象 schema', () => {
      const tool = makeTool({
        inputSchema: { type: 'object', properties: {} },
      });
      const result = convertMcpToolToAgentTool(tool, 's1', 'S1', registry);
      expect(result.parameters).toBeDefined();
    });

    it('无 inputSchema 属性时应生成空对象 schema', () => {
      const tool = makeTool({
        inputSchema: { type: 'object' } as any,
      });
      const result = convertMcpToolToAgentTool(tool, 's1', 'S1', registry);
      expect(result.parameters).toBeDefined();
    });

    it('数组类型属性应正确处理', () => {
      const tool = makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      const result = convertMcpToolToAgentTool(tool, 's1', 'S1', registry);
      expect(result.parameters).toBeDefined();
    });

    it('对象类型属性应正确处理', () => {
      const tool = makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            metadata: { type: 'object' },
          },
        },
      });
      const result = convertMcpToolToAgentTool(tool, 's1', 'S1', registry);
      expect(result.parameters).toBeDefined();
    });

    it('enum 类型属性应正确处理', () => {
      const tool = makeTool({
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['read', 'write', 'delete'] },
          },
          required: ['mode'],
        },
      });
      const result = convertMcpToolToAgentTool(tool, 's1', 'S1', registry);
      expect(result.parameters).toBeDefined();
    });
  });

  describe('getAllMcpAgentTools', () => {
    it('无工具时应返回空数组', () => {
      const tools = getAllMcpAgentTools(registry);
      expect(tools).toEqual([]);
    });

    it('有工具时应全部转换', async () => {
      // Directly add mock connections
      const mockConn = {
        client: {} as any,
        transport: {} as any,
        config: { id: 'fs', name: 'FileSystem', command: 'node', args: ['s.js'] },
        tools: [
          { name: 'read', description: 'Read file', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
          { name: 'write', description: 'Write file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
        ] as Tool[],
        status: 'connected' as const,
        stderrBuffer: [],
      };
      (registry as any).connections.set('fs', mockConn);

      const tools = getAllMcpAgentTools(registry);
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('fs__read');
      expect(tools[1].name).toBe('fs__write');
    });
  });

  describe('getMcpAgentToolSchemas', () => {
    it('无工具时应返回空数组', () => {
      const schemas = getMcpAgentToolSchemas(registry);
      expect(schemas).toEqual([]);
    });

    it('应提取格式化的 schemas', async () => {
      const mockConn = {
        client: {} as any,
        transport: {} as any,
        config: { id: 'fs', name: 'FileSystem', command: 'node', args: ['s.js'] },
        tools: [
          { name: 'read', description: 'Read file', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'The file path' } }, required: ['path'] } },
        ] as Tool[],
        status: 'connected' as const,
        stderrBuffer: [],
      };
      (registry as any).connections.set('fs', mockConn);

      const schemas = getMcpAgentToolSchemas(registry);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('fs__read');
      expect(schemas[0].inputSchema).toBeDefined();
      expect((schemas[0].inputSchema as any).properties.path.description).toBe('The file path');
    });
  });
});

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { McpServerRegistry } from './mcp-server-registry.js';

function jsonSchemaToTypeBox(inputSchema: Tool['inputSchema']): any {
  const props = (inputSchema as any)?.properties;
  const required = (inputSchema as any)?.required ?? [];

  if (!props || Object.keys(props).length === 0) {
    return Type.Object({});
  }

  const typeBoxProps: Record<string, any> = {};
  for (const [key, schema] of Object.entries(props)) {
    const s = schema as any;
    if (s.type === 'string') {
      typeBoxProps[key] = s.enum
        ? Type.Unsafe<string>({ type: 'string', enum: s.enum })
        : Type.String();
    } else if (s.type === 'number' || s.type === 'integer') {
      typeBoxProps[key] = s.type === 'integer' ? Type.Integer() : Type.Number();
    } else if (s.type === 'boolean') {
      typeBoxProps[key] = Type.Boolean();
    } else if (s.type === 'array') {
      typeBoxProps[key] = Type.Array(Type.Unknown());
    } else if (s.type === 'object') {
      typeBoxProps[key] = Type.Record(Type.String(), Type.Unknown());
    } else {
      typeBoxProps[key] = Type.Unknown();
    }
  }

  const requiredProps: Record<string, any> = {};
  for (const key of required) {
    if (typeBoxProps[key]) {
      requiredProps[key] = typeBoxProps[key];
    }
  }

  if (Object.keys(requiredProps).length === Object.keys(typeBoxProps).length) {
    return Type.Object(typeBoxProps);
  }

  const optionalKeys = Object.keys(typeBoxProps).filter(k => !required.includes(k));
  let schema = Type.Object(typeBoxProps, { additionalProperties: false });

  return schema;
}

function formatSchemaForAgent(inputSchema: Tool['inputSchema']): Record<string, unknown> {
  const props = (inputSchema as any)?.properties;
  const required = (inputSchema as any)?.required ?? [];

  if (!props) {
    return { type: 'object', properties: {}, required: [] };
  }

  const formattedProps: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) {
    const v = val as any;
    const prop: Record<string, unknown> = { type: v.type || 'string' };
    if (v.description) prop.description = v.description;
    if (v.enum) prop.enum = v.enum;
    if (v.default !== undefined) prop.default = v.default;
    formattedProps[key] = prop;
  }

  return { type: 'object', properties: formattedProps, required };
}

export function convertMcpToolToAgentTool(
  mcpTool: Tool,
  serverId: string,
  serverName: string,
  registry: McpServerRegistry
): ToolDefinition {
  const toolName = `${serverId}__${mcpTool.name}`;

  const inputSchema = mcpTool.inputSchema;
  const parameters = jsonSchemaToTypeBox(inputSchema);

  return defineTool({
    name: toolName,
    label: `[${serverName}] ${mcpTool.name}`,
    description: mcpTool.description || `${serverName} 提供的 MCP 工具`,
    parameters,
    renderShell: 'default',
    execute: async (toolCallId, params, signal, _onUpdate, _ctx) => {
      const result = await registry.callTool(
        serverId,
        mcpTool.name,
        params as Record<string, unknown>,
        signal
      );

      return {
        content: [{ type: 'text' as const, text: result }],
        details: {},
      };
    },
  });
}

export function getAllMcpAgentTools(
  registry: McpServerRegistry
): ToolDefinition[] {
  return registry.getAllTools().map(({ serverId, tool }) => {
    const configs = registry.getAllConfigs();
    const config = configs.find(c => c.id === serverId);
    return convertMcpToolToAgentTool(tool, serverId, config?.name || serverId, registry);
  });
}

export function getMcpAgentToolSchemas(
  registry: McpServerRegistry
): Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }> {
  return registry.getAllTools().map(({ serverId, tool }) => {
    const configs = registry.getAllConfigs();
    const config = configs.find(c => c.id === serverId);
    return {
      name: `${serverId}__${tool.name}`,
      description: tool.description || `${config?.name || serverId} 提供的 MCP 工具`,
      inputSchema: formatSchemaForAgent(tool.inputSchema),
    };
  });
}

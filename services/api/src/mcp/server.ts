import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import {
  callExternalMcpTool,
  listExternalMcpTools
} from "./external-mcp-server-transport.js";

const server = new Server(
  {
    name: "swingops-external-readonly-mcp-server",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const response = listExternalMcpTools();

  return {
    tools: response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations
    }))
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return callExternalMcpTool({
    name: request.params.name,
    ...(request.params.arguments === undefined
      ? {}
      : { arguments: request.params.arguments })
  });
});

const transport = new StdioServerTransport();

await server.connect(transport);

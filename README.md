# SwingOps AI

Agentic golf retail workflow platform for intake, workflow orchestration, structured equipment records, review queues, model routing, retrieval grounding, and MCP-compatible connector execution.

## Local external MCP server

SwingOps exposes a first local external MCP server transport for development.

Run it with:

    pnpm --filter @swingops/api mcp:dev

The server is stdio-based and intentionally thin. It wraps the existing API-owned connector surface instead of defining a second tool registry.

Current behavior:

- tools/list exposes the existing SwingOps tool contracts from listMcpCompatibleTools().
- tools/call delegates to callMcpCompatibleTool().
- Allowed low-risk read-only tools execute through the existing read-only executor.
- Disabled or high-risk mutation tools remain visible for governance but are blocked before execution.
- Successful calls preserve sanitized output metadata.
- Successful, failed, and blocked calls still persist ToolCallLog records.

This local transport does not claim production OAuth, hosted deployment, tenant isolation, or remote MCP access. The existing REST adapter remains available for the web UI and API tests.

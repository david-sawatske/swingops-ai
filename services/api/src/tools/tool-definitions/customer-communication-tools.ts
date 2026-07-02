import type { AgentToolDefinition } from "../tool-registry.types.js";

export const customerCommunicationAgentTools: AgentToolDefinition[] = [
{
    name: "swingops.customerMessage.send",
    displayName: "Send customer message",
    description:
      "Send a customer message after approval. Disabled on the read-only connector surface.",
    category: "CUSTOMER_COMMUNICATION",
    inputShape: {
      type: "object",
      fields: [
        {
          name: "messageId",
          type: "string",
          required: true,
          description: "Message ID or draft ID that would be sent."
        }
      ]
    },
    riskLevel: "HIGH",
    requiresHumanApproval: true,
    mutatesData: true,
    enabled: false,
    implementationStatus: "DISABLED_PREVIEW_ONLY",
    statusReason:
      "Mutation tool is intentionally visible for governance planning but disabled on the read-only connector surface.",
    outputSummary:
      "Mutation output is intentionally unavailable because customer messaging is blocked in read-only mode.",
    auditBehavior: "PERSIST_TOOL_CALL_LOG",
    redactionNotes:
      "No message content or mutation output is exposed; blocked attempts persist policy metadata only."
  }
];

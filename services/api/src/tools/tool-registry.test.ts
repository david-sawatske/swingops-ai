import { describe, expect, it } from "vitest";

import { getAgentTool, listAgentTools } from "./tool-registry.js";

describe("agent tool registry", () => {
  it("registers read-only tools for existing intake, workflow, and review capabilities", () => {
    const tools = listAgentTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "swingops.intakeBatches.list",
      "swingops.intakeBatches.get",
      "swingops.clubReference.search",
      "swingops.knowledgeBase.search",
      "swingops.inventory.lookupProduct",
      "swingops.inventory.findSimilarProducts",
      "swingops.tradeInValuation.estimate",
      "swingops.tradeInValuation.explainAdjustments",
      "swingops.inventory.createSku",
      "swingops.tradeInOffer.create",
      "swingops.customerMessage.send",
      "swingops.workflowRuns.list",
      "swingops.workflowRuns.get",
      "swingops.reviewQueueItems.list",
      "swingops.reviewQueueItems.get",
      "swingops.reviewQueueItems.resolve",
      "swingops.reviewQueueItems.dismiss"
    ]);

    expect(
      tools.filter((tool) => tool.enabled).map((tool) => tool.name)
    ).toEqual([
      "swingops.intakeBatches.list",
      "swingops.intakeBatches.get",
      "swingops.clubReference.search",
      "swingops.knowledgeBase.search",
      "swingops.inventory.lookupProduct",
      "swingops.inventory.findSimilarProducts",
      "swingops.tradeInValuation.estimate",
      "swingops.tradeInValuation.explainAdjustments",
      "swingops.workflowRuns.list",
      "swingops.workflowRuns.get",
      "swingops.reviewQueueItems.list",
      "swingops.reviewQueueItems.get"
    ]);
  });

  it("registers knowledge base search as a low-risk route-backed connector", () => {
    const knowledgeTool = getAgentTool("swingops.knowledgeBase.search");

    expect(knowledgeTool).toMatchObject({
      name: "swingops.knowledgeBase.search",
      category: "WORKFLOW",
      riskLevel: "LOW",
      requiresHumanApproval: false,
      mutatesData: false,
      enabled: true,
      implementationStatus: "ROUTE_BACKED",
      existingHttpRoute: {
        method: "POST",
        path: "/knowledge/search"
      }
    });
    expect(knowledgeTool?.inputShape.fields.map((field) => field.name)).toEqual([
      "query",
      "sourceName",
      "brand",
      "category",
      "chunkType",
      "maxResults"
    ]);
    expect(knowledgeTool).toMatchObject({
      displayName: "Search knowledge base",
      outputSummary: expect.stringContaining("scoreBreakdown"),
      auditBehavior: "PERSIST_TOOL_CALL_LOG",
      redactionNotes: expect.stringContaining("sanitized")
    });
  });

  it("registers inventory and valuation read-only tools", () => {
    const inventoryLookupTool = getAgentTool("swingops.inventory.lookupProduct");
    const valuationTool = getAgentTool("swingops.tradeInValuation.estimate");

    expect(inventoryLookupTool).toMatchObject({
      category: "INVENTORY",
      riskLevel: "LOW",
      requiresHumanApproval: false,
      mutatesData: false,
      enabled: true,
      implementationStatus: "REGISTERED"
    });
    expect(inventoryLookupTool?.inputShape.fields.map((field) => field.name)).toEqual([
      "brand",
      "productLine",
      "category",
      "year",
      "shaftBrand",
      "shaftModel",
      "rawText"
    ]);

    expect(valuationTool).toMatchObject({
      category: "VALUATION",
      riskLevel: "LOW",
      requiresHumanApproval: false,
      mutatesData: false,
      enabled: true,
      implementationStatus: "REGISTERED",
      outputSummary: expect.stringContaining("demo valuation range")
    });
    expect(valuationTool?.redactionNotes).toContain("seeded demo valuation ranges");
  });

  it("marks review and internal mutation tools as high-risk, approval-required, and disabled for execution", () => {
    const resolveTool = getAgentTool("swingops.reviewQueueItems.resolve");
    const dismissTool = getAgentTool("swingops.reviewQueueItems.dismiss");
    const createSkuTool = getAgentTool("swingops.inventory.createSku");
    const createOfferTool = getAgentTool("swingops.tradeInOffer.create");
    const sendMessageTool = getAgentTool("swingops.customerMessage.send");

    expect(resolveTool).toMatchObject({
      riskLevel: "HIGH",
      requiresHumanApproval: true,
      mutatesData: true,
      enabled: false,
      implementationStatus: "DISABLED_PREVIEW_ONLY",
      existingHttpRoute: {
        method: "POST",
        path: "/review-queue-items/:id/resolve"
      }
    });

    expect(dismissTool).toMatchObject({
      riskLevel: "HIGH",
      requiresHumanApproval: true,
      mutatesData: true,
      enabled: false,
      implementationStatus: "DISABLED_PREVIEW_ONLY",
      existingHttpRoute: {
        method: "POST",
        path: "/review-queue-items/:id/dismiss"
      }
    });

    for (const tool of [createSkuTool, createOfferTool, sendMessageTool]) {
      expect(tool).toMatchObject({
        riskLevel: "HIGH",
        requiresHumanApproval: true,
        mutatesData: true,
        enabled: false,
        implementationStatus: "DISABLED_PREVIEW_ONLY"
      });
    }
  });

  it("filters tools by category and enabled status", () => {
    const enabledReviewTools = listAgentTools({
      category: "REVIEW_QUEUE",
      enabled: true
    });

    expect(enabledReviewTools.map((tool) => tool.name)).toEqual([
      "swingops.reviewQueueItems.list",
      "swingops.reviewQueueItems.get"
    ]);
  });

  it("filters tools by data mutation and approval requirements", () => {
    const approvalRequiredMutationTools = listAgentTools({
      mutatesData: true,
      requiresHumanApproval: true
    });

    expect(approvalRequiredMutationTools.map((tool) => tool.name)).toEqual([
      "swingops.inventory.createSku",
      "swingops.tradeInOffer.create",
      "swingops.customerMessage.send",
      "swingops.reviewQueueItems.resolve",
      "swingops.reviewQueueItems.dismiss"
    ]);
  });

  it("returns cloned tool definitions so callers cannot mutate registry state", () => {
    const firstLookup = getAgentTool("swingops.workflowRuns.get");

    expect(firstLookup).not.toBeNull();

    firstLookup!.inputShape.fields[0]!.name = "changed";

    const secondLookup = getAgentTool("swingops.workflowRuns.get");

    expect(secondLookup?.inputShape.fields[0]?.name).toBe("id");
  });
});

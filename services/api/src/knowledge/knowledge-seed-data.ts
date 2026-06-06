import type { KnowledgeChunkType, KnowledgeSourceType } from "@prisma/client";

export type KnowledgeSeedChunk = {
  chunkType: KnowledgeChunkType;
  text: string;
  brand?: string;
  productLine?: string;
  category?: string;
  aliases?: string[];
  conditionFlags?: string[];
};

export type KnowledgeSeedDocument = {
  sourceType: KnowledgeSourceType;
  title: string;
  sourceName: string;
  rawText: string;
  chunks: KnowledgeSeedChunk[];
};

export const DEMO_KNOWLEDGE_SOURCE_NAME = "swingops-demo-golf-trade-in-knowledge-v1";

export const DEMO_KNOWLEDGE_DOCUMENTS: KnowledgeSeedDocument[] = [
  {
    sourceType: "FREE_TEXT",
    title: "Messy driver and fairway wood alias notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      TM stealth2 drv 10.5 stiff, no HC, light sky mark.
      Cally AiSmoke 3w reg sometimes written Ai Smoke FW or AI smoke fairway.
      Ping g430 max 9 deg xstiff and G430 MAX driver are same retail family.
      Titleist TSR2 10* Tensei blue, sometimes TSR 2 drv, not TS2.
      Qi10 driver aliases: TM Qi 10, Taylormade QI10, Qi10 Max.
    `,
    chunks: [
      {
        chunkType: "BRAND_ALIAS",
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        aliases: ["TM stealth2 drv", "Stealth2", "TaylorMade Stealth 2", "Stealth two driver"],
        text:
          "TaylorMade Stealth 2 driver is often abbreviated as TM stealth2 drv, Stealth2, or Stealth two driver in trade-in notes. Driver listings often include loft like 9, 10.5, or 12 degrees and shaft flex."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "TaylorMade",
        productLine: "Qi10",
        category: "DRIVER",
        aliases: ["TM Qi10", "TM Qi 10", "TaylorMade QI10", "Qi10 Max"],
        text:
          "TaylorMade Qi10 driver aliases include TM Qi10, TM Qi 10, TaylorMade QI10, Qi10 Max, and Qi10 LS. Confirm exact head model when Max or LS is present."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Callaway",
        productLine: "Ai Smoke",
        category: "FAIRWAY_WOOD",
        aliases: ["Cally AiSmoke 3w", "Ai Smoke FW", "AI smoke fairway", "Callaway Ai Smoke 3 wood"],
        text:
          "Callaway Paradym Ai Smoke fairway wood may appear as Cally AiSmoke 3w, Ai Smoke FW, AI smoke fairway, or Callaway Ai Smoke 3 wood. 3w usually means fairway wood."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "PING",
        productLine: "G430 Max",
        category: "DRIVER",
        aliases: ["Ping g430 max", "PING G430 MAX", "G430 Max driver", "g430 max 9 deg"],
        text:
          "PING G430 Max driver is commonly written as Ping g430 max, G430 MAX, or g430 max 9 deg. Driver loft and x-stiff shaft shorthand can appear in the same note."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Titleist",
        productLine: "TSR2",
        category: "DRIVER",
        aliases: ["Titleist TSR2", "TSR 2 drv", "TSR2 10*", "TSR2 Tensei blue"],
        text:
          "Titleist TSR2 driver may appear as TSR2, TSR 2 drv, TSR2 10*, or TSR2 Tensei blue. Distinguish TSR2 from older TS2 when the R is missing or unclear."
      }
    ]
  },
  {
    sourceType: "POLICY_NOTE",
    title: "Trade-in condition and human review policy notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Sky marks, crown scratches, cracked crowns, missing headcovers, worn grips.
      Missing serial number or uncertain model should go to human review.
      High-value current generation drivers should be reviewed when condition is ambiguous.
      no HC means no headcover. worn grip affects condition notes but may not block intake.
    `,
    chunks: [
      {
        chunkType: "CONDITION_GUIDE",
        category: "DRIVER",
        conditionFlags: ["sky mark", "crown scratch", "missing headcover", "no hc"],
        text:
          "Condition shorthand: sky mark means a visible mark on the crown or topline. no HC means missing headcover. Crown scratches, sky marks, and missing headcovers should be captured in condition notes."
      },
      {
        chunkType: "TRADE_IN_POLICY",
        conditionFlags: ["missing serial number", "uncertain model", "cracked crown", "high value", "mismatched shaft"],
        text:
          "Human review is required when serial number is missing, model is uncertain, crown is cracked, shaft appears mismatched, or the club is high-value with ambiguous condition."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["stiff", "regular", "x-stiff", "senior", "ladies"],
        text:
          "Shaft flex shorthand: reg means regular, stiff means stiff, x or xstiff means x-stiff, sr or senior means senior, L or ladies means ladies flex."
      }
    ]
  },
  {
    sourceType: "CSV",
    title: "Poorly formed CSV-like trade-in examples",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      brand-ish,model-ish,cat,notes
      TM,stealth2,drv,"10.5 stiff / no hc / sky"
      Cally,AiSmoke,3w,"reg shaft"
      Ping,g430 max,driver,"9 deg x"
      Titleist,TSR2,driver,"10* tensei blue"
    `,
    chunks: [
      {
        chunkType: "CLUB_REFERENCE",
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        aliases: ["TM stealth2 drv 10.5 stiff", "stealth2 driver no hc"],
        conditionFlags: ["missing headcover", "sky mark"],
        text:
          "Example normalized record: TM stealth2 drv 10.5 stiff no hc sky maps to TaylorMade Stealth 2 driver, 10.5 degree loft, stiff shaft, missing headcover, and possible sky mark condition note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Callaway",
        productLine: "Ai Smoke",
        category: "FAIRWAY_WOOD",
        aliases: ["Cally AiSmoke 3w reg", "AiSmoke 3 wood regular"],
        text:
          "Example normalized record: Cally AiSmoke 3w reg maps to Callaway Paradym Ai Smoke fairway wood, likely 3 wood, regular shaft flex."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "PING",
        productLine: "G430 Max",
        category: "DRIVER",
        aliases: ["Ping g430 max xstiff 9", "g430 max 9 deg x"],
        text:
          "Example normalized record: Ping g430 max xstiff 9 maps to PING G430 Max driver, 9 degree loft, x-stiff shaft flex."
      }
    ]
  }
];

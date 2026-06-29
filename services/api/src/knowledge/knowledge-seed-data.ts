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
    title: "Driver and fairway wood alias notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Demo/local alias notes for messy golf trade-in intake.
      TaylorMade Stealth 2, Qi10, SIM2, M6, Callaway Paradym Ai Smoke,
      Rogue ST, Epic Speed, PING G430 Max, G425 Max, G410, Titleist TSR2,
      TSi2, TS2, and 917 shorthand appear often in trade-in notes.
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
        productLine: "Stealth 2",
        category: "FAIRWAY_WOOD",
        aliases: ["TM stealth2 3w", "Stealth 2 FW", "Stealth two fairway", "stealth2 fairway"],
        text:
          "TaylorMade Stealth 2 fairway woods may appear as TM stealth2 3w, Stealth 2 FW, Stealth two fairway, or stealth2 fairway. 3w usually indicates a fairway wood rather than driver."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "TaylorMade",
        productLine: "Qi10",
        category: "DRIVER",
        aliases: ["TM Qi10", "TM Qi 10", "TaylorMade QI10", "Qi10 Max", "Qi10 LS"],
        text:
          "TaylorMade Qi10 driver aliases include TM Qi10, TM Qi 10, TaylorMade QI10, Qi10 Max, and Qi10 LS. Confirm exact head model when Max or LS is present."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "TaylorMade",
        productLine: "SIM2",
        category: "DRIVER",
        aliases: ["TM sim2 drv", "SIM 2 driver", "Taylormade SIM2 Max", "sim2 max 10.5"],
        text:
          "TaylorMade SIM2 driver notes may say TM sim2 drv, SIM 2 driver, SIM2 Max, or sim2 max 10.5. Do not confuse SIM2 with Stealth 2 when both notes use TM shorthand."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "TaylorMade",
        productLine: "M6",
        category: "FAIRWAY_WOOD",
        aliases: ["TM M6 3w", "M6 fairway", "M6 FW", "taylormade m6 wood"],
        text:
          "TaylorMade M6 fairway wood may appear as TM M6 3w, M6 fairway, M6 FW, or taylormade m6 wood. Older TaylorMade models should be checked for model-year ambiguity."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Callaway",
        productLine: "Ai Smoke",
        category: "DRIVER",
        aliases: ["Cally AiSmoke drv", "AI Smoke driver", "Paradym Ai Smoke driver", "Ai Smoke Max D"],
        text:
          "Callaway Paradym Ai Smoke driver may appear as Cally AiSmoke drv, AI Smoke driver, Paradym Ai Smoke driver, Ai Smoke Max, or Ai Smoke Max D."
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
        brand: "Callaway",
        productLine: "Rogue ST",
        category: "DRIVER",
        aliases: ["Cally Rogue ST drv", "Rogue ST Max", "Rogue ST Max driver", "Callaway Rogue ST"],
        text:
          "Callaway Rogue ST driver notes may say Cally Rogue ST drv, Rogue ST Max, Rogue ST Max driver, or Callaway Rogue ST. Confirm Max, LS, or Triple Diamond when present."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Callaway",
        productLine: "Epic Speed",
        category: "FAIRWAY_WOOD",
        aliases: ["Epic Speed 3w", "Cally Epic Speed FW", "Epic Speed fairway", "Callaway epic wood"],
        text:
          "Callaway Epic Speed fairway woods may appear as Epic Speed 3w, Cally Epic Speed FW, Epic Speed fairway, or Callaway epic wood. Older fairway entries often omit loft."
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
        brand: "PING",
        productLine: "G430 Max",
        category: "FAIRWAY_WOOD",
        aliases: ["Ping g430 max 3w", "G430 Max FW", "G430 fairway", "PING G430 5w"],
        text:
          "PING G430 Max fairway wood can appear as Ping g430 max 3w, G430 Max FW, G430 fairway, or PING G430 5w. Confirm whether the note says driver, 3w, 5w, or fairway."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "PING",
        productLine: "G425 Max",
        category: "DRIVER",
        aliases: ["Ping g425 max", "G425 Max driver", "G425 drv", "ping 425 max"],
        text:
          "PING G425 Max driver notes may say Ping g425 max, G425 Max driver, G425 drv, or ping 425 max. G425 and G430 are different generations."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "PING",
        productLine: "G410",
        category: "FAIRWAY_WOOD",
        aliases: ["Ping g410 3w", "G410 fairway", "G410 FW", "ping 410 wood"],
        text:
          "PING G410 fairway wood may appear as Ping g410 3w, G410 fairway, G410 FW, or ping 410 wood. Older model notes may need human review if condition is vague."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET",
        aliases: ["PING G425 irons", "G425 iron set", "G425 irons", "Ping g425 5-PW", "PING G425 5-PW set"],
        conditionFlags: ["regular", "worn grip"],
        text:
          "PING G425 iron set notes may appear as PING G425 irons, G425 iron set, G425 5-PW, or Ping g425 5-PW set. Treat G425 iron set separately from G425 Max driver records."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Cleveland",
        productLine: "RTX 6 ZipCore",
        category: "WEDGE",
        aliases: ["Cleveland RTX 6 ZipCore", "RTX 6 ZipCore", "RTX6 ZipCore", "RTX ZipCore", "Cleveland RTX6 wedge"],
        conditionFlags: ["tour x-stiff", "groove wear", "wedge"],
        text:
          "Cleveland RTX 6 ZipCore wedge may appear as RTX 6 ZipCore, RTX6 ZipCore, RTX ZipCore, or Cleveland RTX6 wedge. Groove wear should be preserved as a condition note while the normalized grade stays in the fixed condition-grade scale."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER",
        aliases: ["Odyssey White Hot OG", "White Hot OG", "WH OG", "Odyssey WH OG", "White Hot OG putter"],
        conditionFlags: ["regular", "headcover included"],
        text:
          "Odyssey White Hot OG putter may appear as Odyssey White Hot OG, White Hot OG, WH OG, or Odyssey WH OG. Putter records may include headcover status as accessory evidence."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Mizuno",
        productLine: "JPX 923 Hot Metal",
        category: "IRON_SET",
        aliases: ["Mizuno JPX 923 Hot Metal", "JPX 923 Hot Metal", "JPX923 Hot Metal", "Hot Metal", "JPX 923 irons"],
        conditionFlags: ["regular", "5-PW", "iron set"],
        text:
          "Mizuno JPX 923 Hot Metal iron set may appear as JPX 923 Hot Metal, JPX923 Hot Metal, Hot Metal, or JPX 923 irons. Set makeup such as 5-PW should be preserved as structured evidence."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Titleist",
        productLine: "TSR2",
        category: "DRIVER",
        aliases: ["Titleist TSR2", "TSR 2 drv", "TSR2 10*", "TSR2 Tensei blue", "titleist tsr two driver no cover crown scratch"],
        conditionFlags: ["missing headcover", "no cover", "crown scratch"],
        text:
          "Titleist TSR2 driver may appear as TSR2, TSR 2 drv, TSR2 10*, TSR2 Tensei blue, or titleist tsr two driver no cover crown scratch. Distinguish TSR2 driver from older TS2 or ambiguous TSR fairway notes when the R or model number is unclear."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Titleist",
        productLine: "TSR2",
        category: "FAIRWAY_WOOD",
        aliases: ["TSR2 3w", "TSR 2 fairway", "Titleist TSR2 FW", "tsr2 wood"],
        text:
          "Titleist TSR2 fairway wood may appear as TSR2 3w, TSR 2 fairway, Titleist TSR2 FW, or tsr2 wood. Confirm fairway versus driver when only TSR2 is written."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Titleist",
        productLine: "TSi2",
        category: "DRIVER",
        aliases: ["TSi2 driver", "Titleist TSi 2", "TSI2 drv", "tsi2 10 deg"],
        text:
          "Titleist TSi2 driver notes may say TSi2 driver, Titleist TSi 2, TSI2 drv, or tsi2 10 deg. TSi2 is newer than TS2 but older than TSR2."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Titleist",
        productLine: "TS2",
        category: "FAIRWAY_WOOD",
        aliases: ["TS2 3w", "Titleist TS2 fairway", "TS 2 FW", "ts2 wood"],
        text:
          "Titleist TS2 fairway wood may be written TS2 3w, Titleist TS2 fairway, TS 2 FW, or ts2 wood. Distinguish TS2 from TSR2 when handwriting or OCR is unclear."
      }
    ]
  },
  {
    sourceType: "POLICY_NOTE",
    title: "Trade-in condition and human review policy notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Demo/local condition notes for trade-in intake. Sky marks, crown scratches,
      face wear, dents, missing headcovers, worn grips, missing serial numbers,
      uncertain model families, and newer high-value drivers should be handled
      consistently by the agent and escalated when ambiguity is high.
    `,
    chunks: [
      {
        chunkType: "CONDITION_GUIDE",
        category: "DRIVER",
        conditionFlags: ["sky mark", "crown mark", "topline mark", "paint mark"],
        text:
          "Sky mark means a visible mark on the crown or topline, often from striking under the ball. Record sky marks in condition notes and consider review if the crown mark is large."
      },
      {
        chunkType: "CONDITION_GUIDE",
        category: "DRIVER",
        conditionFlags: ["crown scratch", "crown scratches", "paint wear", "cosmetic crown wear"],
        text:
          "Crown scratches are cosmetic marks on the top of a driver or fairway head. Light crown scratches can be noted, while deep scratches or cracks should be reviewed."
      },
      {
        chunkType: "CONDITION_GUIDE",
        conditionFlags: ["missing headcover", "no hc", "no cover", "headcover missing"],
        text:
          "Missing headcover shorthand includes no HC, no headcover, no cover, or headcover missing. Missing headcover should be captured as an accessory note but does not automatically block intake."
      },
      {
        chunkType: "CONDITION_GUIDE",
        conditionFlags: ["face wear", "worn face", "impact wear", "ball marks"],
        text:
          "Face wear means visible ball impact marks or finish wear on the club face. Heavy face wear can lower condition and should be preserved in structured condition notes."
      },
      {
        chunkType: "CONDITION_GUIDE",
        conditionFlags: ["dent", "dented", "sole dent", "crown dent"],
        text:
          "Dents on the crown, sole, face, or topline require careful review. Dented heads should usually go to human review because structural condition may affect trade-in eligibility."
      },
      {
        chunkType: "CONDITION_GUIDE",
        conditionFlags: ["grip wear", "worn grip", "slick grip", "needs grip"],
        text:
          "Grip wear may appear as worn grip, slick grip, needs grip, or grip worn. Worn grips affect condition notes but usually do not block intake by themselves."
      },
      {
        chunkType: "TRADE_IN_POLICY",
        conditionFlags: ["missing serial number", "serial missing", "no serial", "uncertain serial"],
        text:
          "Human review is required when the serial number is missing, removed, unreadable, or uncertain. Serial ambiguity should not be auto-resolved by the agent."
      },
      {
        chunkType: "TRADE_IN_POLICY",
        conditionFlags: ["uncertain model", "model ambiguity", "older newer ambiguity", "unclear generation"],
        text:
          "Human review is required when the model generation is uncertain, such as TS2 versus TSR2, G425 versus G430, or Stealth versus Stealth 2."
      },
      {
        chunkType: "TRADE_IN_POLICY",
        conditionFlags: ["high value", "current generation", "ambiguous condition", "newer driver"],
        text:
          "High-value current generation drivers and fairway woods should be reviewed when condition is ambiguous, especially for current TaylorMade, Callaway, PING, and Titleist models."
      },
      {
        chunkType: "TRADE_IN_POLICY",
        conditionFlags: ["mismatched shaft", "wrong shaft", "aftermarket shaft", "shaft mismatch"],
        text:
          "Human review is recommended when the shaft appears mismatched, aftermarket, incorrectly labeled, or inconsistent with the listed head model."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["regular", "reg", "r flex", "r-flex"],
        text:
          "Shaft flex shorthand: reg, r, r flex, or r-flex usually means regular flex. Preserve regular flex in structured shaft fields when the note is clear."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["stiff", "s flex", "s-flex", "stf"],
        text:
          "Shaft flex shorthand: stiff, s, s flex, s-flex, or stf usually means stiff flex. Do not confuse S for senior unless the note says sr or senior."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["x-stiff", "xstiff", "x flex", "x-flex", "extra stiff"],
        text:
          "Shaft flex shorthand: x, xstiff, x-stiff, x flex, x-flex, or extra stiff means x-stiff flex. This often appears with low-loft driver notes."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["senior", "sr", "a flex", "lite flex"],
        text:
          "Shaft flex shorthand: sr, senior, a flex, lite, or lite flex usually means senior flex. Confirm when the note only says S because S more often means stiff."
      },
      {
        chunkType: "SHAFT_FLEX_GUIDE",
        conditionFlags: ["ladies", "lady", "l flex", "women"],
        text:
          "Shaft flex shorthand: L, ladies, lady, l flex, or women usually means ladies flex. Preserve the original wording in notes when the abbreviation could be ambiguous."
      }
    ]
  },
  {
    sourceType: "CSV",
    title: "Poorly formed CSV-like trade-in examples",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Demo/local normalized examples.
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
        aliases: ["TM stealth2 drv 10.5 stiff", "stealth2 driver no hc", "stealth two ten five stiff no cover crown mark"],
        conditionFlags: ["missing headcover", "no cover", "sky mark", "crown mark"],
        text:
          "Example normalized record: TM stealth2 drv 10.5 stiff no hc sky maps to TaylorMade Stealth 2 driver, 10.5 degree loft, stiff shaft, missing headcover, and possible sky mark or crown mark condition note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "TaylorMade",
        productLine: "Qi10",
        category: "DRIVER",
        aliases: ["TM qi10 max 9 x", "qi ten max driver xstiff", "TaylorMade Qi10 no cover"],
        conditionFlags: ["missing headcover", "x-stiff"],
        text:
          "Example normalized record: TM qi10 max 9 x maps to TaylorMade Qi10 Max driver, 9 degree loft, x-stiff shaft, with accessory notes such as no cover if present."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "TaylorMade",
        productLine: "M6",
        category: "FAIRWAY_WOOD",
        aliases: ["TM M6 3w reg worn grip", "m6 fairway regular", "M6 FW grip worn"],
        conditionFlags: ["regular", "worn grip", "grip wear"],
        text:
          "Example normalized record: TM M6 3w reg worn grip maps to TaylorMade M6 fairway wood, likely 3 wood, regular shaft, with worn grip condition note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Callaway",
        productLine: "Ai Smoke",
        category: "FAIRWAY_WOOD",
        aliases: ["Cally AiSmoke 3w reg", "AiSmoke 3 wood regular", "AI smoke fairway reg"],
        conditionFlags: ["regular"],
        text:
          "Example normalized record: Cally AiSmoke 3w reg maps to Callaway Paradym Ai Smoke fairway wood, likely 3 wood, regular shaft flex."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Callaway",
        productLine: "Rogue ST",
        category: "DRIVER",
        aliases: ["Cally Rogue ST Max drv stiff", "rogue st driver s flex", "Callaway rogue st no hc"],
        conditionFlags: ["stiff", "missing headcover"],
        text:
          "Example normalized record: Cally Rogue ST Max drv stiff no hc maps to Callaway Rogue ST Max driver, stiff shaft, and missing headcover accessory note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Callaway",
        productLine: "Epic Speed",
        category: "FAIRWAY_WOOD",
        aliases: ["Epic Speed 5w sr", "Cally Epic Speed fairway senior", "epic speed wood lite"],
        conditionFlags: ["senior", "face wear"],
        text:
          "Example normalized record: Epic Speed 5w sr face wear maps to Callaway Epic Speed fairway wood, likely 5 wood, senior flex, with face wear condition note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "PING",
        productLine: "G430 Max",
        category: "DRIVER",
        aliases: ["Ping g430 max xstiff 9", "g430 max 9 deg x", "PING G430 Max driver x-flex"],
        conditionFlags: ["x-stiff"],
        text:
          "Example normalized record: Ping g430 max xstiff 9 maps to PING G430 Max driver, 9 degree loft, x-stiff shaft flex."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "PING",
        productLine: "G410",
        category: "FAIRWAY_WOOD",
        aliases: ["Ping g410 3w dent", "G410 fairway dented", "ping 410 wood sole dent"],
        conditionFlags: ["dent", "sole dent", "human review"],
        text:
          "Example normalized record: Ping g410 3w dent maps to PING G410 fairway wood with dent condition. Dented fairway heads should be routed to human review."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Titleist",
        productLine: "TSR2",
        category: "DRIVER",
        aliases: ["Titleist TSR2 10 tensei blue", "TSR 2 drv stiff", "TSR2 no cover crown scratch", "titleist tsr two driver no cover crown scratch"],
        conditionFlags: ["stiff", "missing headcover", "no cover", "crown scratch"],
        text:
          "Example normalized record: Titleist TSR2 10* Tensei blue stiff no cover crown scratch, including the written phrase titleist tsr two driver no cover crown scratch, maps to Titleist TSR2 driver, stiff shaft, missing headcover, and crown scratch note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Titleist",
        productLine: "TS2",
        category: "FAIRWAY_WOOD",
        aliases: ["Titleist TS2 3w reg", "TS 2 fairway regular", "ts2 wood no hc"],
        conditionFlags: ["regular", "missing headcover", "older model"],
        text:
          "Example normalized record: Titleist TS2 3w reg no hc maps to Titleist TS2 fairway wood, regular shaft, missing headcover, and older model generation context."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "TaylorMade",
        productLine: "Stealth 2",
        category: "DRIVER",
        aliases: ["TM stealth2 drv 10.5 Ventus stiff", "Stealth2 driver Ventus stiff no hc", "TaylorMade Stealth 2 driver sky mark"],
        conditionFlags: ["Ventus", "stiff", "missing headcover", "sky mark", "crown mark"],
        text:
          "Agentic demo example: TM stealth2 drv 10.5 Ventus stiff, no hc, sky mark on crown maps to TaylorMade Stealth 2 driver, 10.5 degree loft, Fujikura Ventus stiff shaft, missing headcover, and sky mark condition note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Titleist",
        productLine: "TSR",
        category: "FAIRWAY_WOOD",
        aliases: ["Titleist TSR maybe TS2 3w 15 deg Tensei s flex", "TSR 3 wood Tensei stiff face wear", "Titleist TSR fairway hc included"],
        conditionFlags: ["Tensei", "stiff", "face wear", "headcover included", "model uncertain"],
        text:
          "Agentic demo example: Titleist TSR maybe TS2 3w 15 deg Tensei s flex, face wear, hc included should be parsed as a Titleist TSR fairway wood match with 15 degree loft, Mitsubishi Tensei stiff shaft, face wear, headcover included, and model uncertainty because the note mentions maybe TS2."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Callaway",
        productLine: "Rogue ST Max",
        category: "DRIVER",
        aliases: ["Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff", "Rogue ST Max driver HZRDUS x stiff", "Callaway Rogue ST Max paint wear no wrench"],
        conditionFlags: ["Project X", "HZRDUS", "x-stiff", "paint wear", "missing wrench"],
        text:
          "Agentic demo example: Cally Rogue ST Max driver 9 Project X HZRDUS x-stiff, paint wear, no wrench maps to Callaway Rogue ST Max driver, 9 degree loft, Project X HZRDUS x-stiff shaft, paint wear condition note, and missing wrench accessory note."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "PING",
        productLine: "G425",
        category: "IRON_SET",
        aliases: ["PING G425 irons 5-PW reg", "G425 iron set regular", "Ping g425 5-PW worn grips"],
        conditionFlags: ["regular", "worn grip", "iron set"],
        text:
          "Guided demo example: PING G425 irons 5-PW reg maps to a PING G425 iron set with regular shaft flex and set makeup evidence."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Cleveland",
        productLine: "RTX 6 ZipCore",
        category: "WEDGE",
        aliases: ["Cleveland RTX 6 ZipCore wedge Tour X-Stiff", "RTX6 ZipCore wedge tour x", "RTX ZipCore groove wear"],
        conditionFlags: ["tour x-stiff", "groove wear", "7.0 Below Average"],
        text:
          "Guided demo example: Cleveland RTX 6 ZipCore wedge, Tour X-Stiff, 7.0 Below Average, groove wear noted maps to Cleveland RTX 6 ZipCore wedge with Tour X-Stiff shaft flex and groove wear evidence."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER",
        aliases: ["Odyssey White Hot OG putter regular", "White Hot OG putter headcover included", "WH OG putter"],
        conditionFlags: ["regular", "headcover included", "8.0 Average"],
        text:
          "Guided demo example: Odyssey White Hot OG putter, Regular, 8.0 Average, headcover included maps to Odyssey White Hot OG putter with regular shaft flex and headcover accessory evidence."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Mizuno",
        productLine: "JPX 923 Hot Metal",
        category: "IRON_SET",
        aliases: ["Mizuno JPX 923 Hot Metal iron set regular", "JPX923 Hot Metal 5-PW", "Hot Metal iron set"],
        conditionFlags: ["regular", "5-PW", "9.0 Above Average"],
        text:
          "Guided demo example: Mizuno JPX 923 Hot Metal iron set, Regular, 9.0 Above Average, 5-PW set maps to Mizuno JPX 923 Hot Metal iron set with regular shaft flex and set makeup evidence."
      }
    ]
  }
];

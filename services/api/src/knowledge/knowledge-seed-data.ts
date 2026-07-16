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
    title: "Golf product alias and category notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Demo/local alias notes for messy golf trade-in intake.
      Golf product aliases, generation distinctions and category evidence
      appear frequently in messy trade-in notes. Coverage includes drivers,
      fairway woods, hybrids, iron sets, wedges and putters.
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
        aliases: ["Cleveland RTX 6 ZipCore", "RTX 6 ZipCore", "RTX6 ZipCore", "Cleveland RTX6 wedge"],
        conditionFlags: ["tour x-stiff", "groove wear", "wedge"],
        text:
          "Cleveland RTX 6 ZipCore wedge may appear as RTX 6 ZipCore, RTX6 ZipCore, or Cleveland RTX6 wedge. Groove wear should be preserved as a condition note while the normalized grade stays in the fixed condition-grade scale."
      },
      {
        chunkType: "BRAND_ALIAS",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER",
        aliases: ["Odyssey White Hot OG", "White Hot OG", "WH OG", "Odyssey WH OG", "White Hot OG putter"],
        conditionFlags: ["headcover included"],
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
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "Stealth",
        "category": "DRIVER",
        "aliases": [
          "TM Stealth driver",
          "TaylorMade Stealth drv",
          "Stealth driver 2022"
        ],
        "text": "TaylorMade Stealth driver is a separate generation from Stealth 2. A note containing only Stealth should not be upgraded to Stealth 2 without explicit generation evidence."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "Stealth 2 Rescue",
        "category": "HYBRID",
        "aliases": [
          "TM Stealth2 rescue",
          "Stealth 2 hybrid",
          "TaylorMade Stealth2 hy"
        ],
        "conditionFlags": [
          "stiff",
          "regular",
          "hybrid",
          "rescue"
        ],
        "text": "TaylorMade Stealth 2 Rescue is a hybrid. Rescue, hybrid, and hy identify the hybrid category rather than a fairway wood."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "Qi10 Rescue",
        "category": "HYBRID",
        "aliases": [
          "TM Qi10 rescue",
          "Qi10 hybrid",
          "TaylorMade Qi 10 hy"
        ],
        "text": "TaylorMade Qi10 Rescue may appear as TM Qi10 rescue, Qi10 hybrid, or TaylorMade Qi 10 hy. Rescue terminology maps to the hybrid category."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "PING",
        "productLine": "G430 Hybrid",
        "category": "HYBRID",
        "aliases": [
          "PING G430 hybrid",
          "G430 hy",
          "PING 430 rescue"
        ],
        "text": "PING G430 Hybrid must remain distinct from G430 Max driver, G430 Max fairway wood, and G430 iron set records. Hybrid, hy, or rescue supplies category evidence."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "PING",
        "productLine": "G425 Hybrid",
        "category": "HYBRID",
        "aliases": [
          "PING G425 hybrid",
          "G425 hy",
          "PING 425 rescue"
        ],
        "conditionFlags": [
          "regular",
          "senior",
          "hybrid",
          "rescue"
        ],
        "text": "PING G425 Hybrid may appear as G425 hy or PING 425 rescue. Do not confuse it with the G425 iron set or G425 Max fairway wood."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Callaway",
        "productLine": "Paradym Hybrid",
        "category": "HYBRID",
        "aliases": [
          "Callaway Paradym hybrid",
          "Cally Paradym hy",
          "Paradym rescue"
        ],
        "text": "Callaway Paradym Hybrid may use hybrid, hy, or rescue terminology. It is distinct from Paradym Ai Smoke driver and fairway products."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "PING",
        "productLine": "G430",
        "category": "IRON_SET",
        "aliases": [
          "PING G430 irons",
          "G430 iron set",
          "G430 5-PW"
        ],
        "text": "PING G430 iron set notes commonly include irons, iron set, or set makeup such as 5-PW. Category evidence distinguishes it from G430 woods and hybrids."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Mizuno",
        "productLine": "JPX 921 Hot Metal",
        "category": "IRON_SET",
        "aliases": [
          "Mizuno JPX 921 Hot Metal",
          "JPX921 Hot Metal irons",
          "JPX 921 iron set"
        ],
        "text": "Mizuno JPX 921 Hot Metal is an older iron generation than JPX 923 Hot Metal. Preserve the explicit 921 or 923 generation number."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "P790",
        "category": "IRON_SET",
        "aliases": [
          "TaylorMade P790 irons",
          "TM P790 iron set",
          "P790 4-PW"
        ],
        "text": "TaylorMade P790 notes may include P790 irons, P790 iron set, or set makeup such as 4-PW."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Titleist",
        "productLine": "T200",
        "category": "IRON_SET",
        "aliases": [
          "Titleist T200 irons",
          "T200 iron set",
          "Titleist T 200 5-PW"
        ],
        "text": "Titleist T200 is an iron set. Irons, iron set, and set makeup such as 5-PW provide category evidence."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Cleveland",
        "productLine": "RTX ZipCore",
        "category": "WEDGE",
        "aliases": [
          "Cleveland RTX ZipCore",
          "RTX ZipCore wedge",
          "Cleveland ZipCore wedge"
        ],
        "conditionFlags": [
          "groove wear",
          "wedge",
          "older generation"
        ],
        "text": "Cleveland RTX ZipCore is an older wedge generation than RTX 6 ZipCore. Do not infer the number 6 unless it is explicitly present."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Titleist",
        "productLine": "Vokey SM9",
        "category": "WEDGE",
        "aliases": [
          "Titleist Vokey SM9",
          "Vokey SM 9 wedge",
          "SM9 56 degree"
        ],
        "text": "Titleist Vokey SM9 is a wedge. A two-digit loft such as 52, 54, 56, 58, or 60 degrees can support wedge category evidence."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Callaway",
        "productLine": "Jaws Raw",
        "category": "WEDGE",
        "aliases": [
          "Callaway Jaws Raw",
          "Cally Jaws Raw wedge",
          "Jaws Raw 54 degree"
        ],
        "text": "Callaway Jaws Raw is a wedge family. Preserve loft and groove-wear details as evidence rather than placing them in the normalized condition-grade field."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "MG4",
        "category": "WEDGE",
        "aliases": [
          "TaylorMade MG4",
          "TM MG 4 wedge",
          "Milled Grind 4 wedge"
        ],
        "text": "TaylorMade MG4 may be written MG 4 or Milled Grind 4. Explicit wedge or loft evidence confirms the wedge category."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Odyssey",
        "productLine": "White Hot Versa",
        "category": "PUTTER",
        "aliases": [
          "Odyssey White Hot Versa",
          "White Hot Versa putter",
          "Odyssey Versa putter"
        ],
        "text": "Odyssey White Hot Versa is distinct from White Hot OG. Putter records do not require shaft-flex data."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "Scotty Cameron",
        "productLine": "Special Select Newport 2",
        "category": "PUTTER",
        "aliases": [
          "Scotty Cameron Newport 2",
          "Special Select Newport 2",
          "Scotty NP2 putter"
        ],
        "text": "Scotty Cameron Special Select Newport 2 is a putter and may be shortened to Newport 2 or NP2. Shaft flex is not applicable."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "PING",
        "productLine": "Anser 2",
        "category": "PUTTER",
        "aliases": [
          "PING Anser 2",
          "Anser2 putter",
          "PING Anser two"
        ],
        "text": "PING Anser 2 is a putter. Spacing variants such as Anser2 should normalize to Anser 2 without requiring shaft flex."
      },
      {
        "chunkType": "BRAND_ALIAS",
        "brand": "TaylorMade",
        "productLine": "Spider Tour",
        "category": "PUTTER",
        "aliases": [
          "TaylorMade Spider Tour",
          "TM Spider Tour putter",
          "Spider Tour mallet"
        ],
        "text": "TaylorMade Spider Tour is a putter family. Mallet wording can support putter category evidence, and shaft flex is not applicable."
      }
    ]
  },
  {
    sourceType: "POLICY_NOTE",
    title: "Trade-in condition and human review policy notes",
    sourceName: DEMO_KNOWLEDGE_SOURCE_NAME,
    rawText: `
      Demo/local condition notes for trade-in intake. Sky marks, crown scratches,
      face wear, dents, missing headcovers, worn grips, uncertain model
      families and newer high-value products should be handled consistently.
      Serial-number text is outside the demo workflow and should be ignored.
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
        conditionFlags: ["serial number", "serial present", "serial missing", "serial unreadable"],
        text:
          "Serial numbers are outside the SwingOps demo normalization workflow. Ignore serial-number text whether it is present, missing, unreadable, or uncertain, and do not create a review issue for it."
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
        aliases: ["Cleveland RTX 6 ZipCore wedge Tour X-Stiff", "RTX6 ZipCore wedge tour x"],
        conditionFlags: ["tour x-stiff", "groove wear", "7.0 Below Average"],
        text:
          "Guided demo example: Cleveland RTX 6 ZipCore wedge, Tour X-Stiff, 7.0 Below Average, groove wear noted maps to Cleveland RTX 6 ZipCore wedge with Tour X-Stiff shaft flex and groove wear evidence."
      },
      {
        chunkType: "CLUB_REFERENCE",
        brand: "Odyssey",
        productLine: "White Hot OG",
        category: "PUTTER",
        aliases: ["Odyssey White Hot OG putter", "White Hot OG putter headcover included", "WH OG putter"],
        conditionFlags: ["headcover included", "8.0 Average"],
        text:
          "Guided demo example: Odyssey White Hot OG putter, 8.0 Average, headcover included maps to Odyssey White Hot OG putter with no shaft-flex requirement and headcover accessory evidence."
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

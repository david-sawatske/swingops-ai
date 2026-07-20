import type {
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../../types/workflow";

export const SAMPLE_SOURCE_BY_TYPE: Record<
  MultiSourceIntakeSourceType,
  MultiSourceIntakeSourceInput
> = {
  FREE_TEXT: {
    sourceType: "FREE_TEXT",
    sourceName: "Weekend counter trade notes",
    rawContent: [
      "Weekend counter trade pile",
      "1) Cleveland RTX 6 ZipCore wedge, senior flex, condition 9.0 Above Average, trade value $72, store 104.",
      "2) TaylorMade Stealth 2 driver, shaft firm, condition 9.0 Above Average, trade value $155, store 104.",
      "3) Odyssey White Hot OG putter, cosmetics poor, trade value $85, store 207.",
      "4) Titleist TSR fairway wood, generation unclear, stiff flex, condition 8.0 Average, trade value $135, store 104.",
      "5) Callaway mystery driver, shaft unknown, condition unclear, value pending, store 207.",
    ].join("\n"),
  },
  POORLY_FORMED_CSV: {
    sourceType: "POORLY_FORMED_CSV",
    sourceName: "Regional trade export with irregular rows",
    rawContent: [
      "brand | model | category | shaft | condition_grade | trade_value | store_id | notes",
      "PING| G430 Max |driver|Tour X-Stiff|9.5 Mint|$240|207|",
      "Callaway |Rogue ST Max| driver |shaft firm|7.0 Below Average|190|207|needs flex review",
      "Odyssey|White Hot OG|putter||cosmetics poor|85|104|counter inspection",
      "Titleist | TSR |fairway wood|Stiff|8.0 Average|135|104|generation unclear",
      "TaylorMade|mystery fairway wood|fairway wood|unknown|unclear|pending|104|manual review",
    ].join("\n"),
  },
  EMAIL: {
    sourceType: "EMAIL",
    sourceName: "Five-club trade estimate email",
    rawContent: [
      "From: Morgan Ellis <morgan.ellis@example.com>",
      "To: tradeins@swingops.example",
      "Subject: Trade estimate for five clubs",
      "",
      "Hi team,",
      "",
      "1. Mizuno JPX 923 Hot Metal iron set with regular flex, condition 9.0 Above Average, estimated value $390, store 104.",
      "2. PING G425 iron set with shaft firm, condition 7.0 Below Average, estimated value $260, store 104.",
      "3. Odyssey White Hot OG putter with cosmetics poor, estimated value $85, store 207.",
      "4. Titleist TSR fairway wood. The generation is unclear, but it has stiff flex, condition 8.0 Average and an estimated value of $135, store 207.",
      "5. Callaway unidentified driver with unknown shaft, unclear condition and value still pending, store 104.",
      "",
      "Thanks,",
      "Morgan",
    ].join("\n"),
  },
  LOG: {
    sourceType: "LOG",
    sourceName: "Nightly trade import review log",
    rawContent: [
      "2026-07-20T02:14:03Z INFO trade_record brand=Callaway model='Rogue ST Max' cat=driver shaft='X-Stiff' condition='7.0 Below Average' value=190 store=207",
      "2026-07-20T02:14:07Z WARN trade_record brand=TaylorMade model='Stealth 2' cat=driver shaft='shaft firm' condition='9.0 Above Average' value=155 store=104",
      "2026-07-20T02:14:11Z WARN trade_record brand=Odyssey model='White Hot OG' cat=putter condition='cosmetics poor' value=85 store=207",
      "2026-07-20T02:14:15Z WARN trade_record brand=Titleist model=TSR cat='fairway wood' generation='unclear' shaft=Stiff condition='8.0 Average' value=135 store=104",
      "2026-07-20T02:14:19Z ERROR trade_record brand=PING model='mystery hybrid' cat=hybrid shaft=unknown condition=unclear value=pending store=207",
    ].join("\n"),
  },
};

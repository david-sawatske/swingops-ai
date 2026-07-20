import type { MultiSourceIntakeSourceInput } from "../../../types/workflow";

export function createGoldenDemonstrationSources(): MultiSourceIntakeSourceInput[] {
  return [
    {
      sourceType: "FREE_TEXT",
      sourceName: "Golden counter intake",
      rawContent: [
        "Golden demonstration counter notes",
        "Cleveland RTX 6 ZipCore wedge shaft senior condition 9.0 Above Average trade value $72 store 104",
        "TaylorMade Stealth 2 driver shaft firm condition 9.0 Above Average trade value $155 store 104",
      ].join("\n"),
    },
    {
      sourceType: "POORLY_FORMED_CSV",
      sourceName: "Golden putter export",
      rawContent: [
        "brand|model|category|shaft|condition|value|store",
        "Odyssey|White Hot OG|putter||cosmetics poor|85|207",
      ].join("\n"),
    },
    {
      sourceType: "EMAIL",
      sourceName: "Golden ambiguity email",
      rawContent: [
        "From: intake@example.com",
        "To: tradeins@swingops.example",
        "Subject: Titleist fairway trade",
        "",
        "Titleist TSR fairway wood generation unclear shaft stiff condition 8.0 Average trade value $135 store 104",
      ].join("\n"),
    },
    {
      sourceType: "LOG",
      sourceName: "Golden import exception log",
      rawContent:
        "2026-07-18T16:48:11Z WARN review payload brand=Callaway model='mystery driver' cat=driver shaft=unknown condition=unclear value=pending store=207",
    },
  ];
}

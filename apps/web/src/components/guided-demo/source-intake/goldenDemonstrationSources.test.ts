import { describe, expect, it } from "vitest";

import { createGoldenDemonstrationSources } from "./goldenDemonstrationSources";

describe("createGoldenDemonstrationSources", () => {
  it("returns the canonical four-source, five-record corpus", () => {
    const sources = createGoldenDemonstrationSources();

    expect(sources).toHaveLength(4);
    expect(sources.map((source) => source.sourceType)).toEqual([
      "FREE_TEXT",
      "POORLY_FORMED_CSV",
      "EMAIL",
      "LOG",
    ]);

    expect(sources.map((source) => source.sourceName)).toEqual([
      "Golden counter intake",
      "Golden putter export",
      "Golden ambiguity email",
      "Golden import exception log",
    ]);

    expect(sources[0]?.rawContent).toContain(
      "Cleveland RTX 6 ZipCore wedge shaft senior condition 9.0 Above Average trade value $72 store 104",
    );
    expect(sources[0]?.rawContent).toContain(
      "TaylorMade Stealth 2 driver shaft firm condition 9.0 Above Average trade value $155 store 104",
    );
    expect(sources[1]?.rawContent).toContain(
      "Odyssey|White Hot OG|putter||cosmetics poor|85|207",
    );
    expect(sources[2]?.rawContent).toContain(
      "Titleist TSR fairway wood generation unclear",
    );
    expect(sources[3]?.rawContent).toContain(
      "brand=Callaway model='mystery driver'",
    );

    const expectedRecordMarkers = [
      "Cleveland RTX 6 ZipCore",
      "TaylorMade Stealth 2",
      "Odyssey|White Hot OG",
      "Titleist TSR fairway wood",
      "model='mystery driver'",
    ];

    for (const marker of expectedRecordMarkers) {
      expect(
        sources.some((source) => source.rawContent.includes(marker)),
      ).toBe(true);
    }

    expect(
      sources.some((source) => String(source.sourceType).includes("PDF")),
    ).toBe(false);
  });

  it("returns fresh objects so one browser run cannot mutate the next", () => {
    const firstRun = createGoldenDemonstrationSources();
    const secondRun = createGoldenDemonstrationSources();

    firstRun[0]!.sourceName = "Edited locally";
    firstRun[0]!.rawContent = "Edited locally";

    expect(secondRun[0]?.sourceName).toBe("Golden counter intake");
    expect(secondRun[0]?.rawContent).toContain(
      "Cleveland RTX 6 ZipCore wedge",
    );
  });
});

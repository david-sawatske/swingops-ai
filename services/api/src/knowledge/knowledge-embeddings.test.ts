import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_EMBEDDING_DIMENSION,
  buildDeterministicKnowledgeEmbedding,
} from "./knowledge-embeddings.js";

describe("deterministic knowledge embeddings", () => {
  it("does not tie the hashing sign to the bucket index", () => {
    const signsByBucketParity = {
      even: new Set<number>(),
      odd: new Set<number>(),
    };

    // A single-token text puts all of its weight in one signed bucket.
    for (let tokenIndex = 0; tokenIndex < 500; tokenIndex += 1) {
      const { vector } = buildDeterministicKnowledgeEmbedding(
        `token${tokenIndex}`,
      );
      const bucket = vector.findIndex((value) => value !== 0);

      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(KNOWLEDGE_EMBEDDING_DIMENSION);

      signsByBucketParity[bucket % 2 === 0 ? "even" : "odd"].add(
        Math.sign(vector[bucket]!),
      );
    }

    expect([...signsByBucketParity.even].sort()).toEqual([-1, 1]);
    expect([...signsByBucketParity.odd].sort()).toEqual([-1, 1]);
  });

  it("is deterministic and unit-normalized", () => {
    const first = buildDeterministicKnowledgeEmbedding(
      "TaylorMade Stealth 2 driver stiff",
    );
    const second = buildDeterministicKnowledgeEmbedding(
      "TaylorMade Stealth 2 driver stiff",
    );
    const magnitude = Math.sqrt(
      first.vector.reduce((sum, value) => sum + value * value, 0),
    );

    expect(second.vector).toEqual(first.vector);
    expect(magnitude).toBeCloseTo(1, 5);
  });
});

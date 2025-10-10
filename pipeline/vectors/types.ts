export interface GlobalStyleVec {
  interpretable: Float32Array;  // 53D
  fontEmbedding: Float32Array;  // 256D
  combined: Float32Array;        // 309D (53D + 256D)
  metadata: {
    featureNames: string[];
    nonZeroCount: number;
    fontDescription: string;
  };
}

export interface PrimaryCtaVec {
  interpretable: Float32Array;  // 26D (was 24D - now includes circular hue encoding)
  visual: Float32Array;          // Empty array (visual features removed)
  combined: Float32Array;        // 26D (just interpretable)
  metadata: {
    featureNames: string[];
    nonZeroCount: number;
    buttonIndex: number;         // Which button variant was used
  };
}

export interface VectorResult {
  runId: string;
  globalStyleVec: GlobalStyleVec;
  primaryCtaVec: PrimaryCtaVec;
}

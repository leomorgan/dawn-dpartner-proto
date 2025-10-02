export interface GlobalStyleVec {
  interpretable: Float32Array;  // 64D
  visual: Float32Array;          // 128D (zero-padded for MVP)
  combined: Float32Array;        // 192D
  metadata: {
    featureNames: string[];      // For debugging
    nonZeroCount: number;        // Sparsity metric
  };
}

export interface PrimaryCtaVec {
  interpretable: Float32Array;  // 24D
  visual: Float32Array;          // 40D (zero-padded for MVP)
  combined: Float32Array;        // 64D
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

export interface GroundingSource {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  factualClaim: string;
  citationId: string;
  proposedToolCall?: string;
  proposedToolArgs?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  critique: string;
  actionableError?: string;
}

export type NLIEvaluatorFn = (
  claim: string,
  premise: string
) => Promise<{
  entailmentScore: number; // A float between 0.0 and 1.0
  reasoning?: string;
}>;

export interface ZGuardOptions {
  nliThreshold?: number; // threshold below which NLI is rejected (default: 0.8)
  customNLI?: NLIEvaluatorFn; // custom NLI evaluator callback
}

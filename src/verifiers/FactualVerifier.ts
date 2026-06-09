import { GroundingSource, AgentResponse, ValidationResult, ZGuardOptions } from './BaseVerifier.js';

export class FactualVerifier {
  private sources: Map<string, string>;
  private nliThreshold: number;
  private customNLI?: ZGuardOptions['customNLI'];

  constructor(sources: GroundingSource[], options: ZGuardOptions = {}) {
    this.sources = new Map(sources.map((src) => [src.id, src.content]));
    this.nliThreshold = options.nliThreshold ?? 0.8;
    this.customNLI = options.customNLI;
  }

  /**
   * Verifies if a single claim is grounded in the cited source document.
   */
  async verifyCitation(response: AgentResponse): Promise<ValidationResult> {
    const { factualClaim, citationId } = response;

    // 1. Verify source document exists
    const sourceContent = this.sources.get(citationId);
    if (!sourceContent) {
      return {
        isValid: false,
        critique: `Hallucination Detected: Citation ID '${citationId}' does not exist in reference sources.`,
        actionableError: `Use a valid citation ID from the following list: ${Array.from(this.sources.keys()).join(', ')}`
      };
    }

    // 2. Perform NLI Entailment / Grounding Verification
    if (this.customNLI) {
      try {
        const { entailmentScore, reasoning } = await this.customNLI(factualClaim, sourceContent);
        if (entailmentScore < this.nliThreshold) {
          return {
            isValid: false,
            critique: `Factual Inconsistency: Claim is not supported by the cited document (Entailment Score: ${entailmentScore.toFixed(2)}).`,
            actionableError: reasoning ?? `Revise the claim to be directly supported by the context of document '${citationId}'.`
          };
        }
        return {
          isValid: true,
          critique: `Factual consistency verified via NLI (Score: ${entailmentScore.toFixed(2)}).`
        };
      } catch (err: any) {
        return {
          isValid: false,
          critique: `NLI Verification failed: ${err.message}`,
          actionableError: 'Check the connectivity of the NLI model or fallback to keyword heuristics.'
        };
      }
    }

    // 3. Fallback: Heuristic Token Overlap Check
    return this.runHeuristicCheck(factualClaim, sourceContent, citationId);
  }

  /**
   * Evaluates multiple responses and returns overall status.
   */
  async verifyAll(responses: AgentResponse[]): Promise<{
    isValid: boolean;
    results: { response: AgentResponse; validation: ValidationResult }[];
  }> {
    const results: { response: AgentResponse; validation: ValidationResult }[] = [];
    let allValid = true;

    for (const response of responses) {
      const validation = await this.verifyCitation(response);
      if (!validation.isValid) {
        allValid = false;
      }
      results.push({ response, validation });
    }

    return {
      isValid: allValid,
      results
    };
  }

  /**
   * Simple tokenizer heuristic check to evaluate ground truth alignment.
   * Compares significant tokens between claim and cited text.
   */
  private runHeuristicCheck(claim: string, premise: string, citationId: string): ValidationResult {
    const cleanPremise = premise.toLowerCase();
    const cleanClaim = claim.toLowerCase();

    // Tokenize and extract keywords (length > 4 characters OR contains digits)
    const keywords = cleanClaim
      .split(/[\s,.;:!?()]+/)
      .filter((word) => {
        const hasDigits = /\d/.test(word);
        return (word.length > 4 || hasDigits) && !this.isStopWord(word);
      });

    if (keywords.length === 0) {
      return {
        isValid: true,
        critique: 'Factuality verified (Claim contains no significant descriptive keywords to check).'
      };
    }

    // Count keyword matches in premise
    const matchedCount = keywords.filter((word) => cleanPremise.includes(word)).length;
    const matchRatio = matchedCount / keywords.length;

    // If less than 70% of keywords are in premise, flag as potential hallucination
    if (matchRatio < 0.7) {
      return {
        isValid: false,
        critique: `Factual Inconsistency (Heuristic): Grounding similarity ratio is too low (${(matchRatio * 100).toFixed(0)}%).`,
        actionableError: `Ensure the claim '${claim}' is based only on the facts present in source '${citationId}'.`
      };
    }

    return {
      isValid: true,
      critique: `Factuality verified via heuristic check (Overlap: ${(matchRatio * 100).toFixed(0)}%).`
    };
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'about', 'above', 'after', 'again', 'against', 'along', 'around', 'before',
      'below', 'between', 'doing', 'during', 'first', 'house', 'other', 'their',
      'there', 'these', 'those', 'under', 'where', 'which', 'while', 'would'
    ]);
    return stopWords.has(word);
  }
}

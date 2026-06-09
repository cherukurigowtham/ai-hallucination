import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ==========================================
// 1. Types and Interfaces
// ==========================================

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

// ==========================================
// 2. Parsers
// ==========================================

export class ZGuardParser {
  /**
   * Parses raw text output from an agent to extract factual claims and citation attachments.
   * Supports two formats:
   * 1. XML-style: <claim citation="doc_01">Acme revenue was $15.4M</claim>
   * 2. Inline brackets: Acme revenue was $15.4M [doc_01]
   */
  static parseClaims(text: string): AgentResponse[] {
    const claims: AgentResponse[] = [];

    // 1. XML tag parser: <claim citation="id">claim text</claim>
    const xmlRegex = /<claim\s+citation="([^"]+)"\s*>([\s\S]*?)<\/claim>/gi;
    let xmlMatch;
    while ((xmlMatch = xmlRegex.exec(text)) !== null) {
      claims.push({
        citationId: xmlMatch[1].trim(),
        factualClaim: xmlMatch[2].trim()
      });
    }

    if (claims.length > 0) {
      return claims;
    }

    // 2. Bracket-style parser: matches sentences ending with [id] or [id:lines]
    const sentences = text.split(/(?<=[.!?])\s+|\n+/);
    const bracketRegex = /([\s\S]+?)\s*\[([a-zA-Z0-9_-]+)(?::[0-9a-zA-Z_-]+)?\][.!?]?\s*$/i;

    for (const sentence of sentences) {
      const match = sentence.trim().match(bracketRegex);
      if (match) {
        claims.push({
          citationId: match[2].trim(),
          factualClaim: match[1].trim()
        });
      }
    }

    return claims;
  }

  /**
   * Parses a tool call from the text if it is represented in a tag structure:
   * <tool name="toolName">{ "param": "value" }</tool>
   */
  static parseToolCall(text: string): { toolCall?: string; toolArgs?: Record<string, any> } {
    const toolRegex = /<tool\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool>/i;
    const match = text.match(toolRegex);

    if (match) {
      const toolCall = match[1].trim();
      const rawArgs = match[2].trim();
      try {
        const toolArgs = JSON.parse(rawArgs);
        return { toolCall, toolArgs };
      } catch (err) {
        return {
          toolCall,
          toolArgs: { _raw: rawArgs, _error: 'JSON parsing failed' }
        };
      }
    }

    return {};
  }
}

// ==========================================
// 3. Verifiers
// ==========================================

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

    const sourceContent = this.sources.get(citationId);
    if (!sourceContent) {
      return {
        isValid: false,
        critique: `Hallucination Detected: Citation ID '${citationId}' does not exist in reference sources.`,
        actionableError: `Use a valid citation ID from the following list: ${Array.from(this.sources.keys()).join(', ')}`
      };
    }

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
   */
  private runHeuristicCheck(claim: string, premise: string, citationId: string): ValidationResult {
    const cleanPremise = premise.toLowerCase();
    const cleanClaim = claim.toLowerCase();

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

    const matchedCount = keywords.filter((word) => cleanPremise.includes(word)).length;
    const matchRatio = matchedCount / keywords.length;

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

export class SymbolicVerifier {
  /**
   * Verifies a tool call's structure against a Zod schema definition.
   */
  verifyToolCall(response: AgentResponse, schema: z.ZodTypeAny): ValidationResult {
    const { proposedToolCall, proposedToolArgs } = response;

    if (!proposedToolCall) {
      return {
        isValid: true,
        critique: 'No tool execution requested.'
      };
    }

    if (!proposedToolArgs) {
      return {
        isValid: false,
        critique: `Symbolic Error: Missing arguments for tool call '${proposedToolCall}'.`,
        actionableError: 'Provide a structured arguments object conforming to the required schema.'
      };
    }

    const result = schema.safeParse(proposedToolArgs);

    if (!result.success) {
      const errorDetails = result.error.errors
        .map((err) => {
          const path = err.path.join('.');
          return `'${path || 'root'}': ${err.message}`;
        })
        .join(', ');

      return {
        isValid: false,
        critique: `Symbolic Error: Schema violation in tool arguments for '${proposedToolCall}': ${errorDetails}`,
        actionableError: `Adjust arguments to conform to schema: ${errorDetails}`
      };
    }

    return {
      isValid: true,
      critique: `Symbolic verification passed for tool call '${proposedToolCall}'.`
    };
  }
}

// ==========================================
// 4. Streaming Parser
// ==========================================

export type ClaimCallback = (claim: AgentResponse) => Promise<void> | void;
export type ToolCallCallback = (tool: { toolCall: string; toolArgs: Record<string, any> }) => Promise<void> | void;

export class ZGuardStreamParser {
  private buffer: string = '';
  private onClaimParsed?: ClaimCallback;
  private onToolCallParsed?: ToolCallCallback;
  private parsedIndex: number = 0;

  constructor(callbacks: {
    onClaim?: ClaimCallback;
    onToolCall?: ToolCallCallback;
  }) {
    this.onClaimParsed = callbacks.onClaim;
    this.onToolCallParsed = callbacks.onToolCall;
  }

  /**
   * Append a new chunk of text from the LLM stream.
   */
  async appendChunk(chunk: string): Promise<void> {
    this.buffer += chunk;
    await this.processBuffer();
  }

  private async processBuffer(): Promise<void> {
    // 1. Process XML claims
    const claimRegex = /<claim\s+citation="([^"]+)"\s*>([\s\S]*?)<\/claim>/gi;
    claimRegex.lastIndex = this.parsedIndex;
    
    let claimMatch;
    while ((claimMatch = claimRegex.exec(this.buffer)) !== null) {
      const citationId = claimMatch[1].trim();
      const factualClaim = claimMatch[2].trim();
      
      if (this.onClaimParsed) {
        await this.onClaimParsed({ citationId, factualClaim });
      }
      
      this.parsedIndex = claimRegex.lastIndex;
    }

    // 2. Process XML tool calls
    const toolRegex = /<tool\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool>/gi;
    toolRegex.lastIndex = this.parsedIndex;
    
    let toolMatch;
    while ((toolMatch = toolRegex.exec(this.buffer)) !== null) {
      const toolCall = toolMatch[1].trim();
      const rawArgs = toolMatch[2].trim();
      
      let toolArgs: Record<string, any>;
      try {
        toolArgs = JSON.parse(rawArgs);
      } catch (err) {
        toolArgs = { _raw: rawArgs, _error: 'JSON parsing failed' };
      }

      if (this.onToolCallParsed) {
        await this.onToolCallParsed({ toolCall, toolArgs });
      }

      this.parsedIndex = toolRegex.lastIndex;
    }
  }

  /**
   * Flush any remaining text at the end of the stream.
   */
  async finalize(): Promise<void> {
    const remainingText = this.buffer.substring(this.parsedIndex);
    const bracketClaims = ZGuardParser.parseClaims(remainingText);
    
    for (const claim of bracketClaims) {
      if (this.onClaimParsed) {
        await this.onClaimParsed(claim);
      }
    }
    this.parsedIndex = this.buffer.length;
  }
}

// ==========================================
// 5. Express Middleware
// ==========================================

export interface ZGuardRequestExtensions {
  zGuard: {
    verify: (
      agentOutputText: string,
      toolSchema?: z.ZodTypeAny
    ) => Promise<{
      isValid: boolean;
      critiques: string[];
      actionableErrors: string[];
    }>;
  };
}

declare global {
  namespace Express {
    interface Request extends ZGuardRequestExtensions {}
  }
}

/**
 * Z-Guard Express Middleware
 */
export function zGuardMiddleware(
  getSources: (req: Request) => Promise<GroundingSource[]> | GroundingSource[],
  options: ZGuardOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sources = await getSources(req);
      const factualVerifier = new FactualVerifier(sources, options);
      const symbolicVerifier = new SymbolicVerifier();

      req.zGuard = {
        verify: async (agentOutputText: string, toolSchema?: z.ZodTypeAny) => {
          const critiques: string[] = [];
          const actionableErrors: string[] = [];
          let overallValid = true;

          const checkTasks: Promise<void>[] = [];

          const claims = ZGuardParser.parseClaims(agentOutputText);
          if (claims.length > 0) {
            checkTasks.push(
              factualVerifier.verifyAll(claims).then((factualResult) => {
                if (!factualResult.isValid) {
                  overallValid = false;
                  for (const res of factualResult.results) {
                    if (!res.validation.isValid) {
                      critiques.push(res.validation.critique);
                      if (res.validation.actionableError) {
                        actionableErrors.push(res.validation.actionableError);
                      }
                    }
                  }
                }
              })
            );
          }

          if (toolSchema) {
            const parsedTool = ZGuardParser.parseToolCall(agentOutputText);
            if (parsedTool.toolCall) {
              const mockResponse = {
                factualClaim: '',
                citationId: '',
                proposedToolCall: parsedTool.toolCall,
                proposedToolArgs: parsedTool.toolArgs
              };
              
              checkTasks.push(
                Promise.resolve(symbolicVerifier.verifyToolCall(mockResponse, toolSchema)).then((symbolicResult) => {
                  if (!symbolicResult.isValid) {
                    overallValid = false;
                    critiques.push(symbolicResult.critique);
                    if (symbolicResult.actionableError) {
                      actionableErrors.push(symbolicResult.actionableError);
                    }
                  }
                })
              );
            }
          }

          await Promise.all(checkTasks);

          return {
            isValid: overallValid,
            critiques,
            actionableErrors
          };
        }
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

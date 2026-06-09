import { AgentResponse } from '../verifiers/BaseVerifier.js';
import { ZGuardParser } from './parser.js';

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

  /**
   * Process the accumulated buffer and detect fully closed tags.
   */
  private async processBuffer(): Promise<void> {
    // 1. Process XML-style claims
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

    // 2. Process XML-style tool calls
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
   * Flush any remaining text at the end of the stream
   * (e.g. to parse final bracket-style annotations like "[doc_01]").
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

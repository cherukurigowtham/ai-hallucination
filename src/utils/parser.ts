import { AgentResponse } from '../verifiers/BaseVerifier.js';

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

    // If XML matches are found, we prioritize them
    if (claims.length > 0) {
      return claims;
    }

    // 2. Bracket-style parser: matches sentences ending with [id] or [id:lines]
    // Matches: "Any text before the bracket [doc_01]" or "Any text [doc_02:10-15]"
    // Splitting sentences based on period/newline, then matching brackets
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

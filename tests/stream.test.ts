import { describe, it, expect, vi } from 'vitest';
import { ZGuardStreamParser } from '../src/utils/stream.js';
import { AgentResponse } from '../src/verifiers/BaseVerifier.js';

describe('ZGuardStreamParser', () => {
  it('should parse streaming XML claims in real-time', async () => {
    const claimsParsed: AgentResponse[] = [];
    
    const parser = new ZGuardStreamParser({
      onClaim: (claim) => {
        claimsParsed.push(claim);
      }
    });

    await parser.appendChunk('Thinking...');
    await parser.appendChunk('\n<claim citation="doc_01">Revenue was ');
    expect(claimsParsed).toHaveLength(0); // Not closed yet

    await parser.appendChunk('$15.4M</claim>\nSome other text...');
    expect(claimsParsed).toHaveLength(1); // Closed and parsed!
    expect(claimsParsed[0]).toEqual({
      citationId: 'doc_01',
      factualClaim: 'Revenue was $15.4M'
    });
  });

  it('should parse streaming XML tool calls in real-time', async () => {
    const toolsParsed: { toolCall: string; toolArgs: Record<string, any> }[] = [];
    
    const parser = new ZGuardStreamParser({
      onToolCall: (tool) => {
        toolsParsed.push(tool);
      }
    });

    await parser.appendChunk('Let us invoke a tool:');
    await parser.appendChunk('\n<tool name="sendEmail">\n{\n  "to": "test@');
    expect(toolsParsed).toHaveLength(0); // Not closed yet

    await parser.appendChunk('example.com",\n  "subject": "Hi"\n}\n</tool>');
    expect(toolsParsed).toHaveLength(1); // Closed and parsed!
    expect(toolsParsed[0].toolCall).toBe('sendEmail');
    expect(toolsParsed[0].toolArgs.to).toBe('test@example.com');
    expect(toolsParsed[0].toolArgs.subject).toBe('Hi');
  });

  it('should fallback to parsing bracket claims on finalize', async () => {
    const claimsParsed: AgentResponse[] = [];
    
    const parser = new ZGuardStreamParser({
      onClaim: (claim) => {
        claimsParsed.push(claim);
      }
    });

    await parser.appendChunk('Acme Q1 revenue was 15.4 million [doc_01].');
    expect(claimsParsed).toHaveLength(0); // Bracket parsing only happens on finalize

    await parser.finalize();
    expect(claimsParsed).toHaveLength(1);
    expect(claimsParsed[0]).toEqual({
      citationId: 'doc_01',
      factualClaim: 'Acme Q1 revenue was 15.4 million'
    });
  });
});

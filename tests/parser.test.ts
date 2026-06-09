import { describe, it, expect } from 'vitest';
import { ZGuardParser } from '../src/utils/parser.js';

describe('ZGuardParser', () => {
  describe('parseClaims', () => {
    it('should parse XML-style claims and extract citation references', () => {
      const text = `
        We had a great quarter.
        <claim citation="doc_01">Q1 Revenue grew by 12%.</claim>
        Also, our headcount is stable.
        <claim citation="doc_02">We have 250 active employees.</claim>
      `;

      const results = ZGuardParser.parseClaims(text);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        citationId: 'doc_01',
        factualClaim: 'Q1 Revenue grew by 12%.'
      });
      expect(results[1]).toEqual({
        citationId: 'doc_02',
        factualClaim: 'We have 250 active employees.'
      });
    });

    it('should fall back to parsing inline bracket annotations', () => {
      const text = `
        The total Q1 earnings reached $15.4M [doc_01].
        Our customer support satisfaction rating was 98% [doc_02].
      `;

      const results = ZGuardParser.parseClaims(text);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        citationId: 'doc_01',
        factualClaim: 'The total Q1 earnings reached $15.4M'
      });
      expect(results[1]).toEqual({
        citationId: 'doc_02',
        factualClaim: 'Our customer support satisfaction rating was 98%'
      });
    });

    it('should ignore text lines without citations', () => {
      const text = `
        This is a random statement.
        The revenue was $5.4M [doc_01].
        Another statement here.
      `;

      const results = ZGuardParser.parseClaims(text);

      expect(results).toHaveLength(1);
      expect(results[0].citationId).toBe('doc_01');
      expect(results[0].factualClaim).toBe('The revenue was $5.4M');
    });
  });

  describe('parseToolCall', () => {
    it('should extract a tool call block and parse its JSON arguments', () => {
      const text = `
        I need to execute a database query now.
        <tool name="queryDatabase">
          {
            "query": "SELECT * FROM users LIMIT 10",
            "readOnly": true
          }
        </tool>
      `;

      const result = ZGuardParser.parseToolCall(text);

      expect(result.toolCall).toBe('queryDatabase');
      expect(result.toolArgs).toEqual({
        query: 'SELECT * FROM users LIMIT 10',
        readOnly: true
      });
    });

    it('should return a JSON parse error in args if the parameters block is malformed', () => {
      const text = `
        <tool name="queryDatabase">
          { malformed json
        </tool>
      `;

      const result = ZGuardParser.parseToolCall(text);

      expect(result.toolCall).toBe('queryDatabase');
      expect(result.toolArgs?._error).toBe('JSON parsing failed');
    });

    it('should return empty if no tool call tag is present', () => {
      const text = `Just standard chat conversation text.`;
      const result = ZGuardParser.parseToolCall(text);

      expect(result.toolCall).toBeUndefined();
      expect(result.toolArgs).toBeUndefined();
    });
  });
});

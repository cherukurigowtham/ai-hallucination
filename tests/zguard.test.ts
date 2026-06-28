import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Mock Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        entailmentScore: 0.9,
        reasoning: 'The claim is supported.'
      })
    }
  });

  const getGenerativeModelMock = vi.fn().mockReturnValue({
    generateContent: generateContentMock
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: getGenerativeModelMock
      };
    })
  };
});

import {
  FactualVerifier,
  SymbolicVerifier,
  ZGuardParser,
  ZGuardStreamParser,
  GeminiNLIVerifier,
  OpenAINLIVerifier,
  AnthropicNLIVerifier,
  verify,
  GroundingSource
} from '../src/index.js';

describe('Z-Guard Core Suite', () => {
  const sources: GroundingSource[] = [
    { id: 'doc_01', content: 'Acme Corp Q1 revenue was 15.4 million dollars, representing a 12 percent growth year-over-year.' }
  ];

  // ==========================================
  // 1. FactualVerifier Tests
  // ==========================================
  describe('FactualVerifier', () => {
    it('should verify a valid claim under keyword heuristics', async () => {
      const verifier = new FactualVerifier(sources);
      const result = await verifier.verifyCitation({
        factualClaim: 'Acme Corp Q1 revenue was 15.4 million.',
        citationId: 'doc_01'
      });
      
      expect(result.isValid).toBe(true);
      expect(result.critique).toContain('verified via heuristic check');
    });

    it('should reject a claim citing a non-existent document ID', async () => {
      const verifier = new FactualVerifier(sources);
      const result = await verifier.verifyCitation({
        factualClaim: 'Acme Corp Q1 revenue was 15.4 million.',
        citationId: 'doc_99'
      });

      expect(result.isValid).toBe(false);
      expect(result.critique).toContain('does not exist');
      expect(result.actionableError).toContain('Use a valid citation ID');
    });

    it('should reject a claim that contradicts/exceeds the context details', async () => {
      const verifier = new FactualVerifier(sources);
      const result = await verifier.verifyCitation({
        factualClaim: 'Acme Corp Q1 revenue was 25.4 billion euros.',
        citationId: 'doc_01'
      });

      expect(result.isValid).toBe(false);
      expect(result.critique).toContain('similarity ratio is too low');
    });

    it('should invoke and respect custom NLI callbacks', async () => {
      const customNLI = vi.fn().mockResolvedValue({
        entailmentScore: 0.95,
        reasoning: 'Entailment confirmed.'
      });

      const verifier = new FactualVerifier(sources, { customNLI, nliThreshold: 0.9 });
      const result = await verifier.verifyCitation({
        factualClaim: 'Acme revenue grew by 12%.',
        citationId: 'doc_01'
      });

      expect(customNLI).toHaveBeenCalledWith('Acme revenue grew by 12%.', sources[0].content);
      expect(result.isValid).toBe(true);
      expect(result.critique).toContain('verified via NLI');
    });

    it('should reject claims below the custom NLI threshold', async () => {
      const customNLI = vi.fn().mockResolvedValue({
        entailmentScore: 0.5,
        reasoning: 'The claim discusses net income, which is not mentioned in source.'
      });

      const verifier = new FactualVerifier(sources, { customNLI, nliThreshold: 0.8 });
      const result = await verifier.verifyCitation({
        factualClaim: 'Acme Corp net income was positive.',
        citationId: 'doc_01'
      });

      expect(result.isValid).toBe(false);
      expect(result.critique).toContain('Claim is not supported by the cited document');
      expect(result.actionableError).toBe('The claim discusses net income, which is not mentioned in source.');
    });
  });

  // ==========================================
  // 2. SymbolicVerifier Tests
  // ==========================================
  describe('SymbolicVerifier', () => {
    const schema = z.object({
      recipientEmail: z.string().email(),
      amount: z.number().positive(),
      message: z.string().min(5)
    });

    it('should pass if no tool call is requested', () => {
      const verifier = new SymbolicVerifier();
      const result = verifier.verifyToolCall({
        factualClaim: 'Hello World',
        citationId: 'doc_01'
      }, schema);

      expect(result.isValid).toBe(true);
      expect(result.critique).toBe('No tool execution requested.');
    });

    it('should pass validation with correct tool arguments', () => {
      const verifier = new SymbolicVerifier();
      const result = verifier.verifyToolCall({
        factualClaim: '',
        citationId: '',
        proposedToolCall: 'sendPayment',
        proposedToolArgs: {
          recipientEmail: 'test@example.com',
          amount: 250,
          message: 'Invoice payment for Q1'
        }
      }, schema);

      expect(result.isValid).toBe(true);
      expect(result.critique).toContain('Symbolic verification passed');
    });

    it('should fail validation when args are missing entirely', () => {
      const verifier = new SymbolicVerifier();
      const result = verifier.verifyToolCall({
        factualClaim: '',
        citationId: '',
        proposedToolCall: 'sendPayment'
      }, schema);

      expect(result.isValid).toBe(false);
      expect(result.critique).toContain('Missing arguments');
    });

    it('should fail validation and list path details on schema violations', () => {
      const verifier = new SymbolicVerifier();
      const result = verifier.verifyToolCall({
        factualClaim: '',
        citationId: '',
        proposedToolCall: 'sendPayment',
        proposedToolArgs: {
          recipientEmail: 'not-an-email',
          amount: -5,
          message: 'hi'
        }
      }, schema);

      expect(result.isValid).toBe(false);
      expect(result.critique).toContain('recipientEmail');
      expect(result.critique).toContain('amount');
      expect(result.critique).toContain('message');
    });
  });

  // ==========================================
  // 3. ZGuardParser Tests
  // ==========================================
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
    });
  });

  // ==========================================
  // 4. ZGuardStreamParser Tests
  // ==========================================
  describe('ZGuardStreamParser', () => {
    it('should parse streaming XML claims in real-time', async () => {
      const claimsParsed: any[] = [];
      const parser = new ZGuardStreamParser({
        onClaim: (claim) => {
          claimsParsed.push(claim);
        }
      });

      await parser.appendChunk('Thinking...');
      await parser.appendChunk('\n<claim citation="doc_01">Revenue was ');
      expect(claimsParsed).toHaveLength(0);

      await parser.appendChunk('$15.4M</claim>\nSome other text...');
      expect(claimsParsed).toHaveLength(1);
      expect(claimsParsed[0]).toEqual({
        citationId: 'doc_01',
        factualClaim: 'Revenue was $15.4M'
      });
    });

    it('should parse streaming XML tool calls in real-time', async () => {
      const toolsParsed: any[] = [];
      const parser = new ZGuardStreamParser({
        onToolCall: (tool) => {
          toolsParsed.push(tool);
        }
      });

      await parser.appendChunk('Let us invoke a tool:');
      await parser.appendChunk('\n<tool name="sendEmail">\n{\n  "to": "test@');
      expect(toolsParsed).toHaveLength(0);

      await parser.appendChunk('example.com",\n  "subject": "Hi"\n}\n</tool>');
      expect(toolsParsed).toHaveLength(1);
      expect(toolsParsed[0].toolCall).toBe('sendEmail');
      expect(toolsParsed[0].toolArgs.to).toBe('test@example.com');
    });
  });

  // ==========================================
  // 5. GeminiNLIVerifier Tests
  // ==========================================
  describe('GeminiNLIVerifier', () => {
    it('should successfully compile the prompt and parse structured JSON responses', async () => {
      const verifier = new GeminiNLIVerifier('mock-api-key');
      const evaluator = verifier.createEvaluator();

      const result = await evaluator('Acme revenue is $15.4M', 'Acme Corp Q1 revenue was 15.4 million dollars.');

      expect(result.entailmentScore).toBe(0.9);
      expect(result.reasoning).toBe('The claim is supported.');
    });
  });

  // ==========================================
  // 6. verify Utility Tests
  // ==========================================
  describe('verify utility', () => {
    it('should run end-to-end checks in a single function call', async () => {
      const result = await verify('Acme Corp Q1 revenue was 15.4 million dollars [doc_01].', {
        sources
      });
      expect(result.isValid).toBe(true);
      expect(result.critiques).toHaveLength(0);
    });

    it('should catch factual discrepancies and validation errors in a single call', async () => {
      const result = await verify('Acme Corp Q1 revenue was 900 billion dollars [doc_01].', {
        sources
      });
      expect(result.isValid).toBe(false);
      expect(result.critiques[0]).toContain('similarity ratio is too low');
    });
  });

  // ==========================================
  // 7. OpenAINLIVerifier Tests
  // ==========================================
  describe('OpenAINLIVerifier', () => {
    it('should successfully post chat completion and parse JSON responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"entailmentScore": 0.85, "reasoning": "OpenAI match."}' } }]
        })
      });
      global.fetch = mockFetch;

      const verifier = new OpenAINLIVerifier('mock-api-key');
      const evaluator = verifier.createEvaluator();
      const result = await evaluator('claim', 'premise');

      expect(result.entailmentScore).toBe(0.85);
      expect(result.reasoning).toBe('OpenAI match.');
    });
  });

  // ==========================================
  // 8. AnthropicNLIVerifier Tests
  // ==========================================
  describe('AnthropicNLIVerifier', () => {
    it('should successfully post message completion and parse JSON responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '{"entailmentScore": 0.92, "reasoning": "Claude match."}' }]
        })
      });
      global.fetch = mockFetch;

      const verifier = new AnthropicNLIVerifier('mock-api-key');
      const evaluator = verifier.createEvaluator();
      const result = await evaluator('claim', 'premise');

      expect(result.entailmentScore).toBe(0.92);
      expect(result.reasoning).toBe('Claude match.');
    });
  });
});

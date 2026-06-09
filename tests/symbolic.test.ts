import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SymbolicVerifier } from '../src/verifiers/SymbolicVerifier.js';

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
      // proposedToolArgs is undefined
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
        recipientEmail: 'not-an-email', // invalid format
        amount: -5, // violates positive restriction
        message: 'hi' // violates min(5)
      }
    }, schema);

    expect(result.isValid).toBe(false);
    expect(result.critique).toContain('recipientEmail');
    expect(result.critique).toContain('amount');
    expect(result.critique).toContain('message');
    expect(result.actionableError).toBeDefined();
  });
});

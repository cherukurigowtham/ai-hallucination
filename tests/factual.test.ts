import { describe, it, expect, vi } from 'vitest';
import { FactualVerifier } from '../src/verifiers/FactualVerifier.js';
import { GroundingSource } from '../src/verifiers/BaseVerifier.js';

describe('FactualVerifier', () => {
  const sources: GroundingSource[] = [
    { id: 'doc_01', content: 'Acme Corp Q1 revenue was 15.4 million dollars, representing a 12 percent growth year-over-year.' }
  ];

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

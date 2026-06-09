# Z-Guard Core 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/badge/npm-v1.0.0-blue)](https://www.npmjs.com/)

**Z-Guard** is a standalone, lightweight, neuro-symbolic validation and hallucination mitigation library designed for **Agentic AI** workflows.

Standard LLMs are probabilistic next-token predictors. Hallucinations are mathematically inevitable at the model level. **Z-Guard** resolves this by shifting the responsibility of factuality and execution safety away from the generative model into a rigid, deterministic, and verifiable sandbox pipeline.

---

## 🚀 Key Features

*   **Dual-Path Verification (DPV)**:
    *   *Factual Path*: Natural Language Inference (NLI) checks validating that agent claims are logically entailed by retrieved context documents.
    *   *Symbolic Path*: Strict compiler-like schema safety checks validating proposed tool calls and arguments before execution.
*   **Cryptographic Context-Attribution**: Forces agents to cite source hashes and line numbers, parsing and validating them deterministically.
*   **Universal Citations Parser**: Supports bracket-style inline annotations (`claim [source_01]`) and strict HTML/XML tag structures (`<claim citation="source_01">claim</claim>`).
*   **Express.js Middleware**: First-class integration to intercept agent responses and enforce validation gates at the routing layer.
*   **Provider Agnostic**: Seamlessly plug in Gemini, OpenAI, or local HuggingFace NLI models.

---

## 📦 Installation

Install the package and its peer dependencies via npm:

```bash
npm install @z-guard/core zod
```

---

## 🛠️ Quick Start

### 1. Factual Grounding Check (NLI & Overlap Heuristics)

Set up a verifier with grounding context documents. If no custom NLI model is configured, Z-Guard falls back to token-overlap heuristics.

```typescript
import { FactualVerifier, GroundingSource } from '@z-guard/core';

// 1. Define grounding context
const sources: GroundingSource[] = [
  { id: 'doc_01', content: 'Acme Corp Q1 revenue was $15.4M, growing 12% YoY.' }
];

// 2. Initialize verifier
const verifier = new FactualVerifier(sources);

// 3. Verify agent response claims
const result = await verifier.verifyCitation({
  citationId: 'doc_01',
  factualClaim: 'Acme Corp Q1 revenue was $15.4M.'
});

console.log(result.isValid); // true
console.log(result.critique); // "Factuality verified via heuristic check..."
```

### 2. Custom NLI Integration (e.g. Gemini / LLM-as-a-judge)

For production systems, pass a custom NLI function to compute exact semantic entailment scores.

```typescript
import { FactualVerifier } from '@z-guard/core';
import { GoogleGenAI } from '@google/generative-ai'; // Optional

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

const verifier = new FactualVerifier(sources, {
  nliThreshold: 0.85,
  customNLI: async (claim, premise) => {
    // LLM-as-a-judge prompt
    const response = await model.generateContent({
      contents: `Premise: ${premise}\nHypothesis: ${claim}\nDoes the premise entail the hypothesis? Return a score between 0.0 and 1.0.`
    });
    const entailmentScore = parseFloat(response.text.trim());
    return { entailmentScore };
  }
});
```

### 3. Symbolic Tool-Call Validation (Zod)

Ensure the agent does not invoke tools with hallucinated keys, incorrect types, or dangerous arguments.

```typescript
import { SymbolicVerifier } from '@z-guard/core';
import { z } from 'zod';

const verifier = new SymbolicVerifier();

// Define expected schema for a payment tool
const SendPaymentSchema = z.object({
  recipient: z.string().email(),
  amount: z.number().positive(),
});

// Response containing a proposed tool invocation
const agentResponse = {
  factualClaim: '',
  citationId: '',
  proposedToolCall: 'sendPayment',
  proposedToolArgs: {
    recipient: 'not-an-email', // Schema Violation!
    amount: -100 // Schema Violation!
  }
};

const validation = verifier.verifyToolCall(agentResponse, SendPaymentSchema);

console.log(validation.isValid); // false
console.log(validation.critique); // "Symbolic Error: Schema violation..."
console.log(validation.actionableError); // Specific Zod path tracebacks
```

---

## 🌐 Express Middleware Integration

Z-Guard integrates into Express routes to intercept outbound agent responses and validation gates.

```typescript
import express from 'express';
import { z } from 'zod';
import { zGuardMiddleware } from '@z-guard/core';

const app = express();
app.use(express.json());

// Target tool arguments schema
const SearchQuerySchema = z.object({
  query: z.string().min(3),
  limit: z.number().max(50).default(10)
});

// Middleware configuration
app.post(
  '/api/agent/chat',
  zGuardMiddleware(async (req) => {
    // Gather reference sources dynamically (e.g. database rows, vector search hits)
    return [
      { id: 'policies', content: 'Our refund policy allows returns within 30 days.' }
    ];
  }),
  async (req, res) => {
    const agentOutput = req.body.text; // Text from LLM generator

    // Verify both citations (NLI) and tool arguments (Zod)
    const verification = await req.zGuard.verify(agentOutput, SearchQuerySchema);

    if (!verification.isValid) {
      return res.status(422).json({
        error: 'Hallucination Detected',
        critiques: verification.critiques,
        suggestedCorrections: verification.actionableErrors
      });
    }

    res.json({ success: true, output: agentOutput });
  }
);
```

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

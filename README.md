# Z-Guard 🛡️

> Keep your AI agents from lying to users or sending garbage parameters to your APIs.

Let's be real: LLMs are great, but they hallucinate. They will confidently invent database keys, try to call payment APIs with negative numbers, or cite documents that don't exist.

**Z-Guard** is a tiny, zero-dependency TypeScript library that acts as a runtime firewall for your AI agents. It intercepts whatever your LLM generates, validates the facts against your grounding documents, checks proposed tool arguments against strict schemas, and blocks hallucinations *before* they escape to your users or execute on your servers.

And best of all: **Z-Guard is a single file**. You can install it via npm, or literally just copy-paste [src/index.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/src/index.ts) directly into your project. No bloat, no complex setups.

---

## 📦 Install

```bash
npm install @z-guard/core zod
```

---

## 🛠️ How to Use It

Z-Guard operates on two paths:

1.  **Factual Check**: Did the LLM make up statements that aren't in the cited sources?
2.  **Symbolic Check**: Did the LLM output valid tool arguments?

Here is how you use them.

### 1. Spotting Factual Hallucinations

Give Z-Guard your grounding context documents. It will check if the claims in the AI response match the facts. If you don't supply a custom NLI model, Z-Guard uses a basic keyword-matching fallback.

```typescript
import { FactualVerifier } from '@z-guard/core';

// Your ground truth facts (from a DB or Vector search)
const documents = [
  { id: 'policy_01', content: 'Refunds are allowed within 30 days. Max refund is $500.' }
];

const verifier = new FactualVerifier(documents);

// Case A: Valid claim
const check1 = await verifier.verifyCitation({
  citationId: 'policy_01',
  factualClaim: 'You can get a refund up to $500.'
});
console.log(check1.isValid); // true

// Case B: AI started hallucinating numbers
const check2 = await verifier.verifyCitation({
  citationId: 'policy_01',
  factualClaim: 'Refunds are allowed for up to 90 days.'
});
console.log(check2.isValid); // false (Similarity check rejected it)
```

> **Note**: For production, plug in a proper NLI model or an LLM-as-a-judge (like Gemini-Flash) via the `customNLI` option in `ZGuardOptions` to get accurate semantic checks.

### 2. Blocking Bad API Calls (Zod)

If your agent is running tools, you don't want it sending string fields where numbers are expected, or bypassing validation constraints.

```typescript
import { SymbolicVerifier } from '@z-guard/core';
import { z } from 'zod';

const verifier = new SymbolicVerifier();

// Define exactly what the tool arguments should look like
const RefundSchema = z.object({
  customerId: z.string().min(5),
  amount: z.number().positive().max(500)
});

// The AI output requested a tool call with garbage args
const aiResponse = {
  factualClaim: '',
  citationId: '',
  proposedToolCall: 'processRefund',
  proposedToolArgs: {
    customerId: '123', // Too short!
    amount: -100 // Negative!
  }
};

const check = verifier.verifyToolCall(aiResponse, RefundSchema);
if (!check.isValid) {
  console.log(check.critique); // "Symbolic Error: Schema violation..."
  // 🛑 Block execution and tell the LLM to try again with the error details
}
```

### 3. Integrating into Express (API Middleware)

You can run these checks automatically on your HTTP endpoints using the built-in middleware:

```typescript
import express from 'express';
import { z } from 'zod';
import { zGuardMiddleware } from '@z-guard/core';

const app = express();
app.use(express.json());

const SearchSchema = z.object({
  query: z.string().min(3)
});

app.post(
  '/api/chat',
  zGuardMiddleware(async (req) => {
    // 1. Grab reference files dynamically based on request query
    return [{ id: 'refund_faq', content: 'Returns allowed within 30 days.' }];
  }),
  async (req, res) => {
    const aiOutputText = await runLLM(req.body.prompt);

    // 2. Validate facts and tool parameters concurrently in parallel
    const verification = await req.zGuard.verify(aiOutputText, SearchSchema);

    if (!verification.isValid) {
      // 3. Intercepted!
      return res.status(422).json({
        error: 'Hallucination Blocked',
        critiques: verification.critiques,
        fixes: verification.actionableErrors
      });
    }

    res.json({ success: true, text: aiOutputText });
  }
);
```

### 4. Validating Streamed Tokens

If you are streaming LLM output to a client via Server-Sent Events, you don't have to wait for the whole paragraph to finish to validate. Use `ZGuardStreamParser` to catch and validate claims or tool calls as soon as their tags close:

```typescript
import { ZGuardStreamParser } from '@z-guard/core';

const parser = new ZGuardStreamParser({
  onClaim: (claim) => {
    console.log('Claim finished streaming. Validating:', claim);
  },
  onToolCall: (tool) => {
    console.log('Tool call tags closed. Running schema check:', tool);
  }
});

// Feed LLM chunks into the parser as they arrive
await parser.appendChunk('Response: ');
await parser.appendChunk('<claim citation="policy_01">Refund takes 5 days.</claim>');
await parser.finalize();
```

---

## 📄 License

MIT. Go ahead and use it for whatever you want.

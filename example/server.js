import express from 'express';
import { z } from 'zod';
import { zGuardMiddleware } from '@z-guard/core'; // Loaded via local dependency link

const app = express();
app.use(express.json());

// 1. Define expected tool arguments schema
const OrderDetailsSchema = z.object({
  customerId: z.string().min(5),
  orderId: z.string().min(8),
  refundAmount: z.number().positive()
});

// 2. Define static grounding sources for context
const MOCK_GROUNDING_CONTEXT = [
  {
    id: 'refund_policy_doc',
    content: 'Refunds are allowed within 30 days of purchase. The maximum refundable amount is $500. Processing takes 5-7 business days.'
  }
];

// 3. Mount Z-Guard Middleware
app.post(
  '/api/chat',
  zGuardMiddleware(async () => {
    // Return our grounding documents
    return MOCK_GROUNDING_CONTEXT;
  }),
  async (req, res) => {
    const { agentOutput } = req.body;

    if (!agentOutput) {
      return res.status(400).json({ error: 'Missing agentOutput in request body.' });
    }

    console.log(`\n[Real-time Audit] Intercepted Agent Output:\n"""\n${agentOutput}\n"""`);

    // Verify both citations (NLI/Overlap) and tool parameters (Zod) in parallel
    const verification = await req.zGuard.verify(agentOutput, OrderDetailsSchema);

    if (!verification.isValid) {
      console.log(`[Validation Failed] Hallucinations detected:`, verification.critiques);
      return res.status(422).json({
        success: false,
        error: 'Hallucination Detected',
        critiques: verification.critiques,
        suggestedCorrections: verification.actionableErrors
      });
    }

    console.log(`[Validation Passed] Response is clean and secure!`);
    res.json({
      success: true,
      message: 'Verification passed.',
      output: agentOutput
    });
  }
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Z-Guard Live Example running on http://localhost:${PORT}`);
  console.log(`\nTry testing a VALID response:`);
  console.log(`curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d '{\n  "agentOutput": "Customers can request refunds within 30 days [refund_policy_doc]."\n}'`);
  console.log(`\nTry testing an INVALID (hallucinated) response:`);
  console.log(`curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d '{\n  "agentOutput": "Refunds are allowed up to 100 days [refund_policy_doc]."\n}'`);
  console.log(`\nTry testing a proposed TOOL CALL that violates the schema:`);
  console.log(`curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d '{\n  "agentOutput": "<tool name=\\"processRefund\\\">{\\"refundAmount\\": -50, \\"customerId\\": \\"123\\"}</tool>"\n}'`);
});

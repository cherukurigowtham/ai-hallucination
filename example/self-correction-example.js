// ===================================================
// Z-Guard Agent Self-Correction Example (ES Module)
// ===================================================

import { z } from 'zod';
import { verify } from '../dist/index.mjs';

const TransferFundsSchema = z.object({
  to_account: z.string().regex(/^ACC-[0-9]{4}$/, 'Account must be ACC- followed by 4 digits'),
  amount: z.number().positive().max(10000)
});

const sources = [{ id: 'doc_01', content: 'Owner account ACC-1234 has a balance of $500.' }];

async function simulateSelfCorrection() {
  console.log('🤖 Agent starts task: Transfer $100 to ACC-1234...');

  // Simulation Step 1: Agent generates a hallucinated account number (missing a digit)
  const firstLLMAttempt = '<tool name="TransferFunds">{"to_account": "ACC-123", "amount": 100.0}</tool>';
  console.log(`Agent Attempt 1: ${firstLLMAttempt}`);

  const check1 = await verify(firstLLMAttempt, { sources, schema: TransferFundsSchema });

  if (!check1.isValid) {
    console.log(`🛡️ Z-Guard Intercepted: ${check1.critiques[0]}`);
    const feedback = check1.actionableErrors[0];
    console.log(`🛡️ Z-Guard Feedback: ${feedback}`);

    // Simulation Step 2: Agent corrects the payload based on the feedback
    console.log('\n🤖 Agent corrects parameters using Z-Guard feedback...');
    const secondLLMAttempt = '<tool name="TransferFunds">{"to_account": "ACC-1234", "amount": 100.0}</tool>';
    console.log(`Agent Attempt 2: ${secondLLMAttempt}`);

    const check2 = await verify(secondLLMAttempt, { sources, schema: TransferFundsSchema });
    if (check2.isValid) {
      console.log('✅ Z-Guard Verification Passed: Funds successfully transferred!');
    }
  }
}

simulateSelfCorrection();

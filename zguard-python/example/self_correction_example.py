# ===================================================
# Z-Guard Agent Self-Correction Example (Python)
# ===================================================

import asyncio
from pydantic import BaseModel, Field
from zguard import verify, GroundingSource

# 1. Define symbolic validation schema
class TransferFundsSchema(BaseModel):
    to_account: str = Field(..., pattern=r"^ACC-[0-9]{4}$")  # Must be ACC- followed by 4 digits
    amount: float = Field(..., gt=0, lt=10000)

sources = [{"id": "doc_01", "content": "Owner account ACC-1234 has a balance of $500."}]

async def simulate_self_correction_agent():
    print("🤖 Agent starts task: Transfer $100 to ACC-1234...")
    
    # Simulation Step 1: Agent generates a hallucinated account number (missing a digit)
    first_llm_attempt = '<tool name="TransferFunds">{"to_account": "ACC-123", "amount": 100.0}</tool>'
    print(f"Agent Attempt 1: {first_llm_attempt}")
    
    # Validate using Z-Guard
    check1 = await verify(first_llm_attempt, sources, schema=TransferFundsSchema)
    
    if not check1["isValid"]:
        print(f"🛡️ Z-Guard Intercepted: {check1['critiques'][0]}")
        actionable_feedback = check1["actionableErrors"][0]
        print(f"🛡️ Z-Guard Feedback: {actionable_feedback}")
        
        # Simulation Step 2: Agent corrects the payload based on the feedback
        print("\n🤖 Agent corrects parameters using Z-Guard feedback...")
        second_llm_attempt = '<tool name="TransferFunds">{"to_account": "ACC-1234", "amount": 100.0}</tool>'
        print(f"Agent Attempt 2: {second_llm_attempt}")
        
        check2 = await verify(second_llm_attempt, sources, schema=TransferFundsSchema)
        if check2["isValid"]:
            print("✅ Z-Guard Verification Passed: Funds successfully transferred!")

if __name__ == "__main__":
    asyncio.run(simulate_self_correction_agent())

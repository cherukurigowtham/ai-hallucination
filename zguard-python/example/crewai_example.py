# ==========================================
# CrewAI Integration Example for Z-Guard
# ==========================================

import asyncio
from typing import List
from zguard import verify, GroundingSource

# Mock grounding sources (Knowledge Base)
sources: List[GroundingSource] = [
    {
        "id": "doc_01",
        "content": "Acme Corp Q1 revenue was 15.4 million dollars, representing a 12 percent growth year-over-year."
    }
]

def zguard_crew_callback(task_output) -> str:
    """
    CrewAI Task Callback handler to validate the final output against knowledge sources.
    If a hallucination is detected, it raises a ValueError, allowing the agent loop 
    to intercept and correct it or fail safely.
    """
    raw_output = task_output.raw
    
    # Run Z-Guard validation synchronously inside callback
    result = asyncio.run(verify(
        text=raw_output,
        sources=sources
    ))
    
    if not result["isValid"]:
        error_msg = (
            f"❌ Hallucination Blocked by Z-Guard!\n"
            f"Critiques: {'; '.join(result['critiques'])}\n"
            f"Please revise your response based on the grounding documents."
        )
        raise ValueError(error_msg)
        
    print("✅ Output successfully verified by Z-Guard. Proceeding.")
    return raw_output

if __name__ == "__main__":
    # Mocking task output interface for demonstration
    class MockTaskOutput:
        def __init__(self, raw: str):
            self.raw = raw

    print("🛡️ Testing Z-Guard Callback with a valid claim...")
    valid_output = MockTaskOutput("Acme Corp Q1 revenue was 15.4 million [doc_01].")
    zguard_crew_callback(valid_output)

    print("\n🛡️ Testing Z-Guard Callback with a hallucinated claim...")
    invalid_output = MockTaskOutput("Acme Corp Q1 revenue was 900 billion [doc_01].")
    try:
        zguard_crew_callback(invalid_output)
    except ValueError as e:
        print(f"✅ Success! ValueError correctly raised:\n{str(e)}")

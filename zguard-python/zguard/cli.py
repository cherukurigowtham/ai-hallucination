import argparse
import sys
import os
import json
import asyncio
from zguard import verify

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "init":
        server_code = """from fastapi import FastAPI, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import json
import os
from zguard import zguard_middleware, ZGuardContext, GroundingSource

app = FastAPI(title="Z-Guard Safety Server")

# Load grounding sources
if not os.path.exists("sources.json"):
    with open("sources.json", "w", encoding="utf-8") as f:
        json.dump([{"id": "doc_01", "content": "Acme Corp Q1 revenue was 15.4 million dollars."}], f, indent=2)

with open("sources.json", "r", encoding="utf-8") as f:
    sources = json.load(f)

# Define schema for tools
class SendEmailSchema(BaseModel):
    to: str = Field(..., pattern=r"^.+@.+\\..+$")
    subject: str
    body: Optional[str] = None

# Inject middleware route dependency
zguard_dep = zguard_middleware(sources=sources)

@app.post("/verify")
async def verify_output(request: Request, body: dict, zguard: ZGuardContext = Depends(zguard_dep)):
    text = body.get("text", "")
    result = await zguard.verify(text, schema=SendEmailSchema)
    
    if not result["isValid"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Hallucination Blocked",
                "critiques": result["critiques"],
                "actionableErrors": result["actionableErrors"]
            }
        )
    return {"status": "success", "message": "Outputs successfully verified."}
"""
        sources_code = """[
  {
    "id": "doc_01",
    "content": "Acme Corp Q1 revenue was 15.4 million dollars."
  }
]
"""
        with open("zguard_server.py", "w", encoding="utf-8") as f:
            f.write(server_code)
            
        with open("sources.json", "w", encoding="utf-8") as f:
            f.write(sources_code)
            
        print("🛡️ Z-Guard successfully scaffolded!")
        print("  - Generated: zguard_server.py")
        print("  - Generated: sources.json")
        print("\nRun your safety server:")
        print("  uvicorn zguard_server:app --reload")
        sys.exit(0)

    parser = argparse.ArgumentParser(description="🛡️ Z-Guard CLI Tool - Hallucination Mitigation Engine")
    parser.add_argument("--text", "-t", required=True, help="Raw text to verify or path to a text file.")
    parser.add_argument("--sources", "-s", required=True, help="Path to a JSON file containing grounding sources.")
    parser.add_argument("--gemini-key", help="Gemini API Key.")
    parser.add_argument("--openai-key", help="OpenAI API Key.")
    parser.add_argument("--anthropic-key", help="Anthropic API Key.")
    parser.add_argument("--threshold", "-th", type=float, default=0.8, help="NLI entailment threshold (default: 0.8).")

    args = parser.parse_args()

    # Load text content
    text_content = args.text
    if os.path.exists(text_content):
        with open(text_content, "r", encoding="utf-8") as f:
            text_content = f.read()

    # Load grounding sources
    if not os.path.exists(args.sources):
        print(f"❌ Error: Sources file not found at {args.sources}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.sources, "r", encoding="utf-8") as f:
            sources = json.load(f)
    except Exception as e:
        print(f"❌ Error parsing sources JSON file: {str(e)}", file=sys.stderr)
        sys.exit(1)

    # Run the verification
    async def run_verification():
        return await verify(
            text=text_content,
            sources=sources,
            gemini_api_key=args.gemini_key,
            openai_api_key=args.openai_key,
            anthropic_api_key=args.anthropic_key,
            nli_threshold=args.threshold
        )

    try:
        result = asyncio.run(run_verification())
    except Exception as e:
        print(f"❌ Unexpected verification error: {str(e)}", file=sys.stderr)
        sys.exit(1)

    if result["isValid"]:
        print("✅ Z-Guard Verification Passed: No hallucinations detected.")
        sys.exit(0)
    else:
        print("❌ Z-Guard Verification Failed: Hallucinations detected!", file=sys.stderr)
        for critique in result["critiques"]:
            print(f"  - Critique: {critique}", file=sys.stderr)
        for err in result["actionableErrors"]:
            print(f"  - Actionable Correction: {err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

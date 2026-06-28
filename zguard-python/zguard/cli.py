import argparse
import sys
import os
import json
import asyncio
from zguard import verify

def main():
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

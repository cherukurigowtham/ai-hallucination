import asyncio
from typing import List, Optional, Type, Dict, Any, Union
from pydantic import BaseModel
from .types import GroundingSource, NLIEvaluatorFn
from .parser import ZGuardParser
from .factual import FactualVerifier
from .symbolic import SymbolicVerifier
from .gemini import GeminiNLIVerifier

async def verify(
    text: str,
    sources: List[GroundingSource],
    schema: Optional[Type[BaseModel]] = None,
    gemini_api_key: Optional[str] = None,
    nli_threshold: float = 0.8,
    custom_nli: Optional[NLIEvaluatorFn] = None,
) -> Dict[str, Any]:
    """
    High-level utility to verify factual consistency and symbolic tool arguments in one call.
    """
    claims = ZGuardParser.parse_claims(text)
    tool_call = ZGuardParser.parse_tool_call(text)

    nli_eval = custom_nli
    if not nli_eval and gemini_api_key:
        gemini = GeminiNLIVerifier(api_key=gemini_api_key)
        nli_eval = gemini.create_evaluator()

    factual_verifier = FactualVerifier(sources, nli_threshold, nli_eval)
    symbolic_verifier = SymbolicVerifier()

    check_tasks = []
    overall_valid = True
    critiques = []
    actionable_errors = []

    # 1. Claims validation task
    async def verify_claims_task():
        nonlocal overall_valid
        factual_result = await factual_verifier.verify_all(claims)
        if not factual_result["isValid"]:
            overall_valid = False
            for item in factual_result["results"]:
                val = item["validation"]
                if not val.get("isValid", True):
                    critiques.append(val.get("critique", ""))
                    if val.get("actionableError"):
                        actionable_errors.append(val["actionableError"])

    check_tasks.append(verify_claims_task())

    # 2. Tool validation task
    if tool_call and schema:
        async def verify_tool_task():
            nonlocal overall_valid
            mock_response = {
                "factualClaim": "",
                "citationId": "",
                "proposedToolCall": tool_call.get("toolCall"),
                "proposedToolArgs": tool_call.get("toolArgs")
            }
            symbolic_result = symbolic_verifier.verify_tool_call(mock_response, schema)
            if not symbolic_result.get("isValid", True):
                overall_valid = False
                critiques.append(symbolic_result.get("critique", ""))
                if symbolic_result.get("actionableError"):
                    actionable_errors.append(symbolic_result["actionableError"])

        check_tasks.append(verify_tool_task())

    await asyncio.gather(*check_tasks)

    return {
        "isValid": overall_valid,
        "critiques": critiques,
        "actionableErrors": actionable_errors
    }

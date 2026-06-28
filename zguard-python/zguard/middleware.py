import asyncio
from typing import List, Type, Optional, Callable, Dict, Any
from fastapi import Request
from pydantic import BaseModel
from .types import GroundingSource, AgentResponse, ValidationResult
from .factual import FactualVerifier
from .symbolic import SymbolicVerifier
from .parser import ZGuardParser

class ZGuardContext:
    def __init__(self, sources: List[GroundingSource], nli_threshold: float = 0.8, custom_nli: Optional[Callable] = None):
        self.factual_verifier = FactualVerifier(sources, nli_threshold, custom_nli)
        self.symbolic_verifier = SymbolicVerifier()

    async def verify(self, text: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        claims = ZGuardParser.parse_claims(text)
        tool_call = ZGuardParser.parse_tool_call(text)

        check_tasks = []
        overall_valid = True
        critiques = []
        actionable_errors = []

        # 1. Verification of claims
        async def verify_claims_task():
            nonlocal overall_valid
            factual_result = await self.factual_verifier.verify_all(claims)
            if not factual_result["isValid"]:
                overall_valid = False
                for item in factual_result["results"]:
                    val = item["validation"]
                    if not val.get("isValid", True):
                        critiques.append(val.get("critique", ""))
                        if val.get("actionableError"):
                            actionable_errors.append(val["actionableError"])

        check_tasks.append(verify_claims_task())

        # 2. Verification of tool call
        if tool_call and schema:
            async def verify_tool_task():
                nonlocal overall_valid
                mock_response = AgentResponse(
                    factualClaim="",
                    citationId="",
                    proposedToolCall=tool_call.get("toolCall"),
                    proposedToolArgs=tool_call.get("toolArgs")
                )
                symbolic_result = self.symbolic_verifier.verify_tool_call(mock_response, schema)
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

def zguard_middleware(sources: List[GroundingSource], nli_threshold: float = 0.8, custom_nli: Optional[Callable] = None):
    """
    FastAPI Route Dependency to inject a ZGuardContext.
    Usage:
        @app.post("/chat")
        async def chat(request: Request, zguard: ZGuardContext = Depends(zguard_middleware(sources))):
            ...
    """
    def dependency(request: Request) -> ZGuardContext:
        context = ZGuardContext(sources, nli_threshold, custom_nli)
        request.state.zguard = context
        return context
    return dependency

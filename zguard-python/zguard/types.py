from typing import TypedDict, Optional, Callable, Awaitable

class GroundingSource(TypedDict, total=False):
    id: str
    content: str
    metadata: Optional[dict]

class AgentResponse(TypedDict, total=False):
    factualClaim: str
    citationId: str
    proposedToolCall: Optional[str]
    proposedToolArgs: Optional[dict]

class ValidationResult(TypedDict, total=False):
    isValid: bool
    critique: str
    actionableError: Optional[str]

# NLI evaluator return signature: Dict with entailmentScore and optional reasoning
class NLIEvaluatorResult(TypedDict, total=False):
    entailmentScore: float
    reasoning: Optional[str]

# Evaluator function type
NLIEvaluatorFn = Callable[[str, str], Awaitable[NLIEvaluatorResult]]

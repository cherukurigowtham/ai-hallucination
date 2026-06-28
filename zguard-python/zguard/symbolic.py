from typing import Type
from pydantic import BaseModel, ValidationError
from .types import AgentResponse, ValidationResult

class SymbolicVerifier:
    """
    Verifies a tool call's structure against a Pydantic BaseModel schema definition.
    """
    def verify_tool_call(self, response: AgentResponse, schema: Type[BaseModel]) -> ValidationResult:
        proposed_tool_call = response.get("proposedToolCall")
        proposed_tool_args = response.get("proposedToolArgs")

        if not proposed_tool_call:
            return {
                "isValid": True,
                "critique": "No tool execution requested."
            }

        if proposed_tool_args is None:
            return {
                "isValid": False,
                "critique": f"Symbolic Error: Missing arguments for tool call '{proposed_tool_call}'.",
                "actionableError": "Provide a structured arguments object conforming to the required schema."
            }

        try:
            # Validate proposed tool args against Pydantic schema
            schema.model_validate(proposed_tool_args)
            return {
                "isValid": True,
                "critique": f"Symbolic execution check passed for tool '{proposed_tool_call}'."
            }
        except ValidationError as e:
            # Generate clean actionable traceback messages
            errors = []
            for err in e.errors():
                loc_path = " -> ".join(str(loc) for loc in err["loc"])
                errors.append(f"[{loc_path}]: {err['msg']}")

            return {
                "isValid": False,
                "critique": f"Symbolic Error: Argument validation failed for tool '{proposed_tool_call}'.",
                "actionableError": f"Validation Details: {'; '.join(errors)}"
            }

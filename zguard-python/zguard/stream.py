import inspect
import re
import json
from typing import Callable, Union, Awaitable, Optional, Dict, Any
from .types import AgentResponse
from .parser import ZGuardParser

# Define callback types
ClaimCallback = Callable[[AgentResponse], Union[None, Awaitable[None]]]
ToolCallCallback = Callable[[Dict[str, Any]], Union[None, Awaitable[None]]]

class ZGuardStreamParser:
    def __init__(self, on_claim: Optional[ClaimCallback] = None, on_tool_call: Optional[ToolCallCallback] = None):
        self.buffer = ""
        self.on_claim = on_claim
        self.on_tool_call = on_tool_call
        self.parsed_index = 0

    async def append_chunk(self, chunk: str) -> None:
        """
        Append a new chunk of text from the LLM stream.
        """
        self.buffer += chunk
        await self._process_buffer()

    async def _invoke_callback(self, callback: Callable, *args) -> None:
        if not callback:
            return
        if inspect.iscoroutinefunction(callback):
            await callback(*args)
        else:
            callback(*args)

    async def _process_buffer(self) -> None:
        # 1. Process XML claims
        claim_regex = re.compile(r'<claim\s+citation="([^"]+)"\s*>([\s\S]*?)</claim>', re.IGNORECASE)
        start_offset = self.parsed_index
        text_to_parse = self.buffer[start_offset:]
        
        for match in claim_regex.finditer(text_to_parse):
            citation_id = match.group(1).strip()
            factual_claim = match.group(2).strip()
            
            if self.on_claim:
                await self._invoke_callback(self.on_claim, {
                    "citationId": citation_id,
                    "factualClaim": factual_claim
                })
            
            self.parsed_index = start_offset + match.end()

        # 2. Process XML tool calls
        start_offset = self.parsed_index
        text_to_parse = self.buffer[start_offset:]
        tool_regex = re.compile(r'<tool\s+name="([^"]+)"\s*>([\s\S]*?)</tool>', re.IGNORECASE)
        for match in tool_regex.finditer(text_to_parse):
            tool_call = match.group(1).strip()
            raw_args = match.group(2).strip()
            
            try:
                tool_args = json.loads(raw_args)
            except Exception:
                tool_args = {"_raw": raw_args, "_error": "JSON parsing failed"}
                
            if self.on_tool_call:
                await self._invoke_callback(self.on_tool_call, {
                    "toolCall": tool_call,
                    "toolArgs": tool_args
                })
                
            self.parsed_index = start_offset + match.end()

    async def finalize(self) -> None:
        """
        Flush any remaining text at the end of the stream.
        """
        remaining_text = self.buffer[self.parsed_index:]
        bracket_claims = ZGuardParser.parse_claims(remaining_text)
        
        for claim in bracket_claims:
            if self.on_claim:
                await self._invoke_callback(self.on_claim, claim)
                
        self.parsed_index = len(self.buffer)

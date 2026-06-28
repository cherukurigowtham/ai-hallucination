import re
import json
from typing import List, Dict, Any
from .types import AgentResponse

class ZGuardParser:
    """
    Parses raw text output from an agent to extract factual claims and citation attachments.
    Supports two formats:
    1. XML-style: <claim citation="doc_01">Acme revenue was $15.4M</claim>
    2. Inline brackets: Acme revenue was $15.4M [doc_01]
    """

    @staticmethod
    def parse_claims(text: str) -> List[AgentResponse]:
        claims: List[AgentResponse] = []

        # 1. XML tag parser: <claim citation="id">claim text</claim>
        xml_regex = re.compile(r'<claim\s+citation="([^"]+)"\s*>([\s\S]*?)</claim>', re.IGNORECASE)
        for match in xml_regex.finditer(text):
            claims.append({
                "citationId": match.group(1).strip(),
                "factualClaim": match.group(2).strip()
            })

        if claims:
            return claims

        # 2. Bracket-style parser: matches sentences ending with [id] or [id:lines]
        sentences = re.split(r'(?<=[.!?])\s+|\n+', text)
        bracket_regex = re.compile(r'([\s\S]+?)\s*\[([a-zA-Z0-9_-]+)(?::[0-9a-zA-Z_-]+)?\][.!?]?\s*$', re.IGNORECASE)

        for sentence in sentences:
            sentence_str = sentence.strip()
            if not sentence_str:
                continue
            match = bracket_regex.match(sentence_str)
            if match:
                claims.append({
                    "citationId": match.group(2).strip(),
                    "factualClaim": match.group(1).strip()
                })

        return claims

    @staticmethod
    def parse_tool_call(text: str) -> Dict[str, Any]:
        """
        Parses a tool call from the text if it is represented in a tag structure:
        <tool name="toolName">{ "param": "value" }</tool>
        """
        tool_regex = re.compile(r'<tool\s+name="([^"]+)"\s*>([\s\S]*?)</tool>', re.IGNORECASE)
        match = tool_regex.search(text)

        if match:
            tool_call = match.group(1).strip()
            raw_args = match.group(2).strip()
            try:
                tool_args = json.loads(raw_args)
                return {"toolCall": tool_call, "toolArgs": tool_args}
            except Exception:
                return {
                    "toolCall": tool_call,
                    "toolArgs": {"_raw": raw_args, "_error": "JSON parsing failed"}
                }

        return {}

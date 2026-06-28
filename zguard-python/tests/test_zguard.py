import pytest
import asyncio
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel, Field
from zguard import (
    GroundingSource,
    AgentResponse,
    ZGuardParser,
    FactualVerifier,
    SymbolicVerifier,
    ZGuardStreamParser,
    GeminiNLIVerifier,
    verify,
)

class SendEmailSchema(BaseModel):
    to: str = Field(..., pattern=r"^.+@.+\..+$")
    subject: str
    body: Optional[str] = None

# Mock sources
sources = [
    {
        "id": "doc_01",
        "content": "Acme Corp Q1 revenue was 15.4 million dollars, representing a 12 percent growth year-over-year."
    }
]

def test_parse_claims_xml():
    text = '<claim citation="doc_01">Acme revenue was $15.4M</claim>'
    claims = ZGuardParser.parse_claims(text)
    assert len(claims) == 1
    assert claims[0]["citationId"] == "doc_01"
    assert claims[0]["factualClaim"] == "Acme revenue was $15.4M"

def test_parse_claims_bracket():
    text = 'Acme revenue was $15.4M [doc_01]'
    claims = ZGuardParser.parse_claims(text)
    assert len(claims) == 1
    assert claims[0]["citationId"] == "doc_01"
    assert claims[0]["factualClaim"] == "Acme revenue was $15.4M"

def test_parse_tool_call_valid():
    text = '<tool name="sendEmail">\n{\n  "to": "support@acme.com",\n  "subject": "Greetings"\n}\n</tool>'
    parsed = ZGuardParser.parse_tool_call(text)
    assert parsed["toolCall"] == "sendEmail"
    assert parsed["toolArgs"]["to"] == "support@acme.com"

def test_parse_tool_call_invalid():
    text = '<tool name="sendEmail">\n{\n  invalid json\n}\n</tool>'
    parsed = ZGuardParser.parse_tool_call(text)
    assert parsed["toolCall"] == "sendEmail"
    assert "_error" in parsed["toolArgs"]

@pytest.mark.asyncio
async def test_factual_verifier_heuristic_valid():
    verifier = FactualVerifier(sources)
    result = await verifier.verify_citation({
        "factualClaim": "Acme Corp Q1 revenue was 15.4 million.",
        "citationId": "doc_01"
    })
    assert result["isValid"] is True
    assert "heuristic" in result["critique"]

@pytest.mark.asyncio
async def test_factual_verifier_heuristic_invalid():
    verifier = FactualVerifier(sources)
    result = await verifier.verify_citation({
        "factualClaim": "Acme Corp Q1 revenue was 900 billion.",
        "citationId": "doc_01"
    })
    assert result["isValid"] is False
    assert "similarity ratio" in result["critique"]

@pytest.mark.asyncio
async def test_factual_verifier_nonexistent_citation():
    verifier = FactualVerifier(sources)
    result = await verifier.verify_citation({
        "factualClaim": "Acme Corp Q1 revenue was 15.4 million.",
        "citationId": "doc_99"
    })
    assert result["isValid"] is False
    assert "does not exist" in result["critique"]

@pytest.mark.asyncio
async def test_factual_verifier_custom_nli_success():
    async def mock_nli(claim, premise):
        return {"entailmentScore": 0.95, "reasoning": "Claim matches premise."}

    verifier = FactualVerifier(sources, custom_nli=mock_nli)
    result = await verifier.verify_citation({
        "factualClaim": "Acme Corp revenue was 15.4 million.",
        "citationId": "doc_01"
    })
    assert result["isValid"] is True
    assert "Score: 0.95" in result["critique"]

@pytest.mark.asyncio
async def test_factual_verifier_custom_nli_failure():
    async def mock_nli(claim, premise):
        return {"entailmentScore": 0.30, "reasoning": "Claim is unsupported."}

    verifier = FactualVerifier(sources, custom_nli=mock_nli)
    result = await verifier.verify_citation({
        "factualClaim": "Acme Corp revenue was 900 billion.",
        "citationId": "doc_01"
    })
    assert result["isValid"] is False
    assert "not supported" in result["critique"]
    assert result["actionableError"] == "Claim is unsupported."

def test_symbolic_verifier_empty():
    verifier = SymbolicVerifier()
    result = verifier.verify_tool_call({}, SendEmailSchema)
    assert result["isValid"] is True

def test_symbolic_verifier_missing_args():
    verifier = SymbolicVerifier()
    result = verifier.verify_tool_call({"proposedToolCall": "sendEmail"}, SendEmailSchema)
    assert result["isValid"] is False
    assert "Missing arguments" in result["critique"]

def test_symbolic_verifier_valid_args():
    verifier = SymbolicVerifier()
    result = verifier.verify_tool_call({
        "proposedToolCall": "sendEmail",
        "proposedToolArgs": {"to": "hello@world.com", "subject": "Test"}
    }, SendEmailSchema)
    assert result["isValid"] is True

def test_symbolic_verifier_invalid_args():
    verifier = SymbolicVerifier()
    result = verifier.verify_tool_call({
        "proposedToolCall": "sendEmail",
        "proposedToolArgs": {"to": "invalid-email", "subject": "Test"}
    }, SendEmailSchema)
    assert result["isValid"] is False
    assert "validation failed" in result["critique"]
    assert "to" in result["actionableError"]

@pytest.mark.asyncio
async def test_stream_parser_claims():
    claims_parsed = []
    def on_claim(claim):
        claims_parsed.append(claim)

    parser = ZGuardStreamParser(on_claim=on_claim)
    await parser.append_chunk("Thinking...")
    await parser.append_chunk('\n<claim citation="doc_01">Revenue was ')
    assert len(claims_parsed) == 0

    await parser.append_chunk("$15.4M</claim>\nSome other text...")
    assert len(claims_parsed) == 1
    assert claims_parsed[0]["citationId"] == "doc_01"
    assert claims_parsed[0]["factualClaim"] == "Revenue was $15.4M"

@pytest.mark.asyncio
async def test_stream_parser_tools():
    tools_parsed = []
    def on_tool(tool):
        tools_parsed.append(tool)

    parser = ZGuardStreamParser(on_tool_call=on_tool)
    await parser.append_chunk("Let us invoke a tool:")
    await parser.append_chunk('\n<tool name="sendEmail">\n{\n  "to": "test@')
    assert len(tools_parsed) == 0

    await parser.append_chunk('example.com",\n  "subject": "Hi"\n}\n</tool>')
    assert len(tools_parsed) == 1
    assert tools_parsed[0]["toolCall"] == "sendEmail"
    assert tools_parsed[0]["toolArgs"]["to"] == "test@example.com"

@pytest.mark.asyncio
@patch("google.generativeai.GenerativeModel")
async def test_gemini_nli_verifier(mock_generative_model):
    mock_model_instance = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"entailmentScore": 0.95, "reasoning": "Claim matched."}'
    
    # Configure mock responses for async generate_content
    mock_model_instance.generate_content_async = AsyncMock(return_value=mock_response)
    mock_generative_model.return_value = mock_model_instance

    verifier = GeminiNLIVerifier(api_key="mock-key")
    evaluator = verifier.create_evaluator()
    
    result = await evaluator("Acme revenue is $15.4M", "Acme Corp Q1 revenue was 15.4 million dollars.")
    assert result["entailmentScore"] == 0.95
    assert result["reasoning"] == "Claim matched."

@pytest.mark.asyncio
async def test_verify_utility_valid():
    result = await verify("Acme Corp Q1 revenue was 15.4 million dollars [doc_01].", sources)
    assert result["isValid"] is True
    assert len(result["critiques"]) == 0

@pytest.mark.asyncio
async def test_verify_utility_invalid():
    result = await verify("Acme Corp Q1 revenue was 900 billion dollars [doc_01].", sources)
    assert result["isValid"] is False
    assert any("similarity ratio" in critique for critique in result["critiques"])


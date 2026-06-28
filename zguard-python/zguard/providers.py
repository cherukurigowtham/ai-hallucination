import json
import urllib.request
import urllib.error
import re
import asyncio
from typing import Dict, Any, Optional
from .types import NLIEvaluatorResult, NLIEvaluatorFn

class OpenAINLIVerifier:
    def __init__(self, api_key: str, base_url: str = 'https://api.openai.com/v1', model_name: str = 'gpt-4o-mini'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name

    def create_evaluator(self) -> NLIEvaluatorFn:
        async def evaluator(claim: str, premise: str) -> NLIEvaluatorResult:
            prompt = f"""
            You are an objective factual verification judge.
            Analyze if the following Premise logically entails the Hypothesis (i.e. the claim is fully supported by the premise without any external extrapolation or contradictions).

            Premise: "{premise}"
            Hypothesis: "{claim}"

            Respond with a JSON object containing:
            - entailmentScore: a float between 0.0 (contradictory/unsupported) and 1.0 (fully supported/entailed)
            - reasoning: a brief explanation of the score.
            """

            url = f"{self.base_url}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            data = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }

            def make_request():
                req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"), method="POST")
                with urllib.request.urlopen(req) as resp:
                    return resp.read().decode("utf-8")

            try:
                loop = asyncio.get_running_loop()
                response_text = await loop.run_in_executor(None, make_request)
            except RuntimeError:
                response_text = make_request()

            result_data = json.loads(response_text)
            content = result_data.get("choices", [{}])[0].get("message", {}).get("content", "")

            try:
                parsed = json.loads(content)
                return {
                    "entailmentScore": float(parsed.get("entailmentScore", 0.0)),
                    "reasoning": parsed.get("reasoning", "")
                }
            except Exception:
                score_match = re.search(r'"entailmentScore"\s*:\s*([0-9.]+)', content)
                entailment_score = float(score_match.group(1)) if score_match else 0.0
                return {
                    "entailmentScore": entailment_score,
                    "reasoning": "Failed to parse JSON response, extracted score."
                }

        return evaluator


class AnthropicNLIVerifier:
    def __init__(self, api_key: str, model_name: str = 'claude-3-5-sonnet-latest'):
        self.api_key = api_key
        self.model_name = model_name

    def create_evaluator(self) -> NLIEvaluatorFn:
        async def evaluator(claim: str, premise: str) -> NLIEvaluatorResult:
            prompt = f"""
            You are an objective factual verification judge.
            Analyze if the following Premise logically entails the Hypothesis (i.e. the claim is fully supported by the premise without any external extrapolation or contradictions).

            Premise: "{premise}"
            Hypothesis: "{claim}"

            Respond with a JSON object containing:
            - entailmentScore: a float between 0.0 (contradictory/unsupported) and 1.0 (fully supported/entailed)
            - reasoning: a brief explanation of the score.
            """

            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01"
            }
            data = {
                "model": self.model_name,
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}]
            }

            def make_request():
                req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"), method="POST")
                with urllib.request.urlopen(req) as resp:
                    return resp.read().decode("utf-8")

            try:
                loop = asyncio.get_running_loop()
                response_text = await loop.run_in_executor(None, make_request)
            except RuntimeError:
                response_text = make_request()

            result_data = json.loads(response_text)
            content = result_data.get("content", [{}])[0].get("text", "")

            try:
                parsed = json.loads(content)
                return {
                    "entailmentScore": float(parsed.get("entailmentScore", 0.0)),
                    "reasoning": parsed.get("reasoning", "")
                }
            except Exception:
                score_match = re.search(r'"entailmentScore"\s*:\s*([0-9.]+)', content)
                entailment_score = float(score_match.group(1)) if score_match else 0.0
                return {
                    "entailmentScore": entailment_score,
                    "reasoning": "Failed to parse JSON response, extracted score."
                }

        return evaluator

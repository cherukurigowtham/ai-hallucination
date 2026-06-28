import os
import json
import re
from typing import Dict, Any, Optional
import google.generativeai as genai
from .types import NLIEvaluatorResult, NLIEvaluatorFn

class GeminiNLIVerifier:
    def __init__(self, api_key: str, model_name: str = 'gemini-1.5-flash'):
        genai.configure(api_key=api_key)
        self.model_name = model_name

    def create_evaluator(self) -> NLIEvaluatorFn:
        async def evaluator(claim: str, premise: str) -> NLIEvaluatorResult:
            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config={"response_mime_type": "application/json"}
            )

            prompt = f"""
            You are an objective factual verification judge.
            Analyze if the following Premise logically entails the Hypothesis (i.e. the claim is fully supported by the premise without any external extrapolation or contradictions).

            Premise: "{premise}"
            Hypothesis: "{claim}"

            Respond with a JSON object containing:
            - entailmentScore: a float between 0.0 (contradictory/unsupported) and 1.0 (fully supported/entailed)
            - reasoning: a brief explanation of the score.
            """

            try:
                # Use async call for non-blocking I/O
                response = await model.generate_content_async(prompt)
                text = response.text
            except AttributeError:
                # Fallback to sync if async is not implemented in standard class definition
                response = model.generate_content(prompt)
                text = response.text

            try:
                parsed = json.loads(text)
                return {
                    "entailmentScore": float(parsed.get("entailmentScore", 0.0)),
                    "reasoning": parsed.get("reasoning", "")
                }
            except Exception:
                score_match = re.search(r'"entailmentScore"\s*:\s*([0-9.]+)', text)
                entailment_score = float(score_match.group(1)) if score_match else 0.0
                return {
                    "entailmentScore": entailment_score,
                    "reasoning": "Failed to parse JSON response, extracted score from text."
                }

        return evaluator

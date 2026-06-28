import re
from typing import List, Dict, Any, Optional
from .types import GroundingSource, AgentResponse, ValidationResult, NLIEvaluatorFn

class FactualVerifier:
    def __init__(self, sources: List[GroundingSource], nli_threshold: float = 0.8, custom_nli: Optional[NLIEvaluatorFn] = None):
        self.sources = {src["id"]: src["content"] for src in sources}
        self.nli_threshold = nli_threshold
        self.custom_nli = custom_nli

    async def verify_citation(self, response: AgentResponse) -> ValidationResult:
        factual_claim = response.get("factualClaim", "")
        citation_id = response.get("citationId", "")

        source_content = self.sources.get(citation_id)
        if not source_content:
            return {
                "isValid": False,
                "critique": f"Hallucination Detected: Citation ID '{citation_id}' does not exist in reference sources.",
                "actionableError": f"Use a valid citation ID from the following list: {', '.join(self.sources.keys())}"
            }

        if self.custom_nli:
            try:
                res = await self.custom_nli(factual_claim, source_content)
                entailment_score = res.get("entailmentScore", 0.0)
                reasoning = res.get("reasoning", "")
                if entailment_score < self.nli_threshold:
                    return {
                        "isValid": False,
                        "critique": f"Factual Inconsistency: Claim is not supported by the cited document (Entailment Score: {entailment_score:.2f}).",
                        "actionableError": reasoning or f"Revise the claim to be directly supported by the context of document '{citation_id}'."
                    }
                return {
                    "isValid": True,
                    "critique": f"Factual consistency verified via NLI (Score: {entailment_score:.2f})."
                }
            except Exception as e:
                return {
                    "isValid": False,
                    "critique": f"NLI Verification failed: {str(e)}",
                    "actionableError": "Check the connectivity of the NLI model or fallback to keyword heuristics."
                }

        return self._run_heuristic_check(factual_claim, source_content, citation_id)

    async def verify_all(self, responses: List[AgentResponse]) -> Dict[str, Any]:
        results = []
        all_valid = True

        for response in responses:
            validation = await self.verify_citation(response)
            if not validation.get("isValid", False):
                all_valid = False
            results.append({"response": response, "validation": validation})

        return {
            "isValid": all_valid,
            "results": results
        }

    def _run_heuristic_check(self, claim: str, premise: str, citation_id: str) -> ValidationResult:
        clean_premise = premise.lower()
        clean_claim = claim.lower()

        # Tokenize by punctuation/whitespace
        tokens = re.split(r'[\s,.;:!?()]+', clean_claim)
        keywords = []
        for word in tokens:
            if not word:
                continue
            has_digits = any(char.isdigit() for char in word)
            if (len(word) > 4 or has_digits) and not self._is_stop_word(word):
                keywords.append(word)

        if not keywords:
            return {
                "isValid": True,
                "critique": "Factuality verified (Claim contains no significant descriptive keywords to check)."
            }

        matched_count = sum(1 for word in keywords if word in clean_premise)
        match_ratio = matched_count / len(keywords)

        if match_ratio < 0.7:
            return {
                "isValid": False,
                "critique": f"Factual Inconsistency (Heuristic): Grounding similarity ratio is too low ({int(match_ratio * 100)}%).",
                "actionableError": f"Ensure the claim '{claim}' is based only on the facts present in source '{citation_id}'."
            }

        return {
            "isValid": True,
            "critique": f"Factuality verified via heuristic check (Overlap: {int(match_ratio * 100)}%)."
        }

    def _is_stop_word(self, word: str) -> bool:
        stop_words = {
            'about', 'above', 'after', 'again', 'against', 'along', 'around', 'before',
            'below', 'between', 'doing', 'during', 'first', 'house', 'other', 'their',
            'there', 'these', 'those', 'under', 'where', 'which', 'while', 'would'
        }
        return word in stop_words

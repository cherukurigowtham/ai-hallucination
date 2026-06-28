# Z-Guard (Python)

The Open-Source Runtime Factual Grounding and Symbolic Verification Engine for Python-based Agentic AI.

Z-Guard is a lightweight, neuro-symbolic safety and compliance layer designed for autonomous AI agent workflows (such as CrewAI, AutoGen, or custom LangChain setups). It intercepts generative outputs at runtime to guarantee factual alignment with grounding contexts and execution safety for tool invocations before they reach end users or backend APIs.

---

## Key Capabilities

*   **Dual-Path Verification (DPV)**: Validates natural language claims and structured tool calls in parallel to minimize response latency.
*   **Factual Entailment (NLI)**: Evaluates if agent assertions are logically entailed by retrieved grounding context documents, featuring a built-in Gemini-powered NLI verifier and a fallback token-overlap heuristic.
*   **Symbolic Validation (Pydantic)**: Enforces strict schema compliance for proposed tool calls and arguments using Pydantic models to block parameter-level hallucinations.
*   **Real-Time Token Streaming Parser**: Processes streamed token outputs on-the-fly, allowing validation checks to execute as soon as tag closures are detected.
*   **FastAPI Route Dependency**: Integrates seamlessly as a dependency for FastAPI route handlers to validate outputs inline.

---

## Getting Started

### Installation

Install the package via requirements:

`pip install -r requirements.txt`

### Integration and Examples

To keep documentation clean, all integration guides, class declarations, and test patterns are located directly within the repository files:

*   For complete type definitions, options interfaces, and class structures, read the consolidated source code inside the [zguard/](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard-python/zguard/) package directory.
*   For test assertions covering validation rules and mocks, refer to [tests/test_zguard.py](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard-python/tests/test_zguard.py).

---

## Contributing

We welcome community contributions. For guidelines on setting up local environments, running pytest suites, and opening Pull Requests, please review our [CONTRIBUTING.md](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/CONTRIBUTING.md) guide.

---

## License

Z-Guard is open-source software licensed under the [MIT License](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/LICENSE).

# Z-Guard

The Open-Source Runtime Factual Grounding and Symbolic Verification Engine for Agentic AI.

Z-Guard is a lightweight, neuro-symbolic safety and compliance layer designed for autonomous AI agent workflows. It intercepts generative outputs at runtime to guarantee factual alignment with grounding contexts and execution safety for tool invocations before they reach end users or backend APIs.

Z-Guard is available for both **Node.js (TypeScript/JavaScript)** and **Python** environments.

---

## Key Capabilities

*   **Dual-Path Verification (DPV)**: Validates natural language claims and structured tool calls in parallel to minimize response latency.
*   **Factual Entailment (NLI)**: Evaluates if agent assertions are logically entailed by retrieved grounding context documents, featuring a built-in Gemini-powered NLI verifier and a fallback token-overlap heuristic.
*   **Symbolic Validation**: Enforces strict schema compliance (using Zod in Node.js and Pydantic in Python) for proposed tool calls and arguments to block parameter-level hallucinations.
*   **Real-Time Token Streaming Parser**: Processes streamed token outputs on-the-fly, allowing validation checks to execute as soon as tag closures are detected.
*   **Middleware & Route Dependencies**: Mounts seamlessly as route middleware (Express in Node.js, FastAPI in Python) to validate outputs inline.

---

## Package Locations

Z-Guard is structured as a multi-language repository:

### 🟢 Node.js / TypeScript
The Node.js package is located in the repository root directory.
*   **Source Entrypoint**: [src/index.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/src/index.ts)
*   **Runnable Express Example**: [example/server.js](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/example/server.js)
*   **Vitest Test Suite**: [tests/zguard.test.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/tests/zguard.test.ts)

### 🟢 Python
The Python package is located in the `zguard-python` subdirectory.
*   **Python Readme**: [zguard-python/README.md](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/zguard-python/README.md)
*   **Runnable FastAPI Example**: [zguard-python/example/server.py](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/zguard-python/example/server.py)
*   **Pytest Test Suite**: [zguard-python/tests/test_zguard.py](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/zguard-python/tests/test_zguard.py)

---

## Contributing

We welcome community contributions in both languages. For guidelines on setting up local environments, running test suites, and opening Pull Requests, please review our [CONTRIBUTING.md](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/CONTRIBUTING.md) guide.

---

## License

Z-Guard is open-source software licensed under the [MIT License](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/LICENSE).

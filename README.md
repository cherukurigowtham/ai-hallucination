# Z-Guard

The Open-Source Runtime Factual Grounding and Symbolic Verification Engine for Agentic AI.

Z-Guard is a lightweight, zero-dependency safety and compliance layer designed for autonomous AI agent workflows. It intercepts generative outputs at runtime to guarantee factual alignment with grounding contexts and execution safety for tool invocations before they reach end users or backend APIs.

---

## Key Capabilities

*   **Dual-Path Verification (DPV)**: Validates natural language claims and structured tool calls in parallel to minimize response latency.
*   **Factual Entailment (NLI)**: Evaluates if agent assertions are logically entailed by retrieved grounding context documents, featuring a built-in Gemini-powered NLI verifier and a fallback token-overlap heuristic.
*   **Symbolic Validation (Zod)**: Enforces strict schema compliance for proposed tool calls and arguments to block parameter-level hallucinations.
*   **Real-Time Token Streaming Parser**: Processes streamed token outputs on-the-fly, allowing validation checks to execute as soon as tag closures are detected.
*   **Express Middleware**: Mounts seamlessly as routing-layer middleware to validate outputs inline.

---

## Getting Started

### Installation

Install the package via the package manager:

`npm install @z-guard/core zod`

### Integration and Examples

To keep documentation clean, all integration guides and runnable code snippets are located directly within the repository files:

*   For a fully functional, live Express server integration, review the [example/server.js](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/example/server.js) file.
*   For complete type definitions, options interfaces, and class structures, read the consolidated source entrypoint in [src/index.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/src/index.ts).
*   For test assertions covering validation rules, refer to [tests/zguard.test.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/tests/zguard.test.ts).

---

## Contributing

We welcome community contributions. For guidelines on setting up local environments, running Vitest suites, and opening Pull Requests, please review our [CONTRIBUTING.md](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/CONTRIBUTING.md) guide.

---

## License

Z-Guard is open-source software licensed under the [MIT License](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/LICENSE).

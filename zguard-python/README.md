# Z-Guard (Python)

Z-Guard is a lightweight, neuro-symbolic safety and compliance layer designed for Python-based Agentic AI workflows (such as CrewAI, AutoGen, or custom LangChain setups). It intercepts generative outputs at runtime to guarantee factual alignment with grounding contexts and execution safety for tool invocations before they reach end users or backend APIs.

## Core Capabilities

*   **Dual-Path Verification (DPV)**: Validates natural language claims and structured tool calls in parallel to minimize response latency.
*   **Factual Entailment (NLI)**: Evaluates if agent assertions are logically entailed by retrieved grounding context documents, featuring built-in verifiers for Gemini, OpenAI, Anthropic, DeepSeek, Groq, Mistral, and local Ollama models.
*   **Symbolic Validation (Pydantic)**: Enforces strict schema compliance for proposed tool calls and arguments using Pydantic models to block parameter-level hallucinations.
*   **Real-Time Token Streaming Parser**: Processes streamed token outputs on-the-fly, allowing validation checks to execute as soon as tag closures are detected.
*   **Schema-to-Prompt Compiler**: Automatically compiles Pydantic schemas into exact prompt instructions for your LLM, guiding output structure before generation begins.
*   **FastAPI Route Dependency**: Integrates seamlessly as a dependency for FastAPI route handlers to validate outputs inline.

## Getting Started

1. Install package requirements using pip.
2. Initialize a FastAPI safety proxy server and template grounding database in your directory using the CLI command: `zguard init`.
3. Review `example/crewai_example.py` to see how to implement agentic self-correction callbacks using Z-Guard's validation feedbacks.
4. Run your test suite using pytest to confirm local setup validation.

## License

Z-Guard is open-source software licensed under the MIT License.

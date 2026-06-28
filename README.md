# Z-Guard

Z-Guard is a neuro-symbolic factual verification and hallucination mitigation engine designed specifically for Agentic AI workflows. It protects production applications by verifying natural language claims and enforcing strict parameter types on tool calls before they execute.

## Core Capabilities

*   **Factual Alignment (Neural)**: Validates generated claims against grounding documents using Natural Language Inference (NLI). Out-of-the-box support is included for Gemini, OpenAI, Anthropic, DeepSeek, Groq, Mistral, and local Ollama models.
*   **Symbolic Parameter Checking**: Evaluates LLM tool-calling payloads against schemas (Zod in JavaScript, Pydantic in Python) to block malformed arguments.
*   **Early Stream Aborting**: Parses tokens in real-time as they stream. If a verification check fails, Z-Guard stops the stream immediately to save API costs and prevent output leaks.
*   **Self-Correction Feedback**: Translates validation exceptions into clear feedback so your AI agent can debug and correct its parameters programmatically.
*   **Schema-to-Prompt Compiler**: Automatically compiles Zod or Pydantic schemas into exact prompt instructions for your LLM, guiding output structure before generation begins.

## Repository Structure

*   `bin/`: CLI tools for terminal verification and local workspace scaffolding.
*   `example/`: Express server templates, LangChain custom parsers, and runnable agent self-correction loop scripts.
*   `src/`: Node.js and TypeScript core library and verifiers.
*   `tests/`: Core Vitest assertions.
*   `zguard-python/`: The complete Python implementation package, containing:
    *   `zguard/`: Factual, Symbolic, and Multi-Model verifiers, alongside FastAPI dependencies.
    *   `example/`: FastAPI server setups and CrewAI task callback blueprints.
    *   `tests/`: Complete Pytest unit test coverage.

## Getting Started

1. Install the package dependencies in either the JS or Python directories.
2. Initialize a local safety proxy server in your project folder using the CLI command: `zguard init`. This instantly creates a pre-configured server template (`zguard-server.js` or `zguard_server.py`) and a default grounding database (`sources.json`) in your directory.
3. Start the server and send payloads to the validation route to verify agent actions.

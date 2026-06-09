# Contributing to Z-Guard 🛡️

We welcome and encourage contributions of all shapes and sizes! Whether you are fixing a bug, improving the NLI heuristics, adding new verifiers, or expanding test coverage, here is a quick guide to getting started.

---

## 🛠️ Local Development Setup

1.  **Fork and Clone**: Fork the repository on GitHub and clone your fork locally:
    ```bash
    git clone https://github.com/your-username/ai-hallucination.git
    cd ai-hallucination/zguard
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Compilation & Tests**: Ensure everything works out-of-the-box:
    ```bash
    npm run test   # Run Vitest suite
    npm run build  # Verify build outputs
    ```

---

## 💡 How to Submit a Change

1.  **Create a branch**: Create a new branch off `main` for your feature:
    ```bash
    git checkout -b feat/my-new-verifier
    ```
2.  **Make your changes**: Implement your logic and write corresponding tests inside [tests/zguard.test.ts](file:///Users/gowthamcherukuri/.gemini/antigravity/worktrees/hallucinations/research-mitigate-ai-hallucinations/zguard/tests/zguard.test.ts).
3.  **Ensure tests pass**: Run the test runner to verify nothing is broken:
    ```bash
    npm run test
    ```
4.  **Commit and Push**: Keep commit messages concise and informative:
    ```bash
    git add .
    git commit -m "feat: add local HuggingFace NLI verifier integration"
    git push origin feat/my-new-verifier
    ```
5.  **Open a Pull Request**: Go to the GitHub repository and open a Pull Request (PR) describing your change!

---

## 💬 Community & Help

If you run into issues, feel free to open a GitHub Issue or reach out in the discussions tab. Thank you for contributing to AI safety and reliability!

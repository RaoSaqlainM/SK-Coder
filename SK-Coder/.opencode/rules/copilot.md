# Autonomous Copilot System Rules

## 1. Execution & Self-Correction Workflow
- **Plan First:** For complex tasks, pass the workflow to `@plan` (Claude Sonnet 4.6) to generate a concise, multi-step execution plan before modifying any code.
- **Execute Cleanly:** Pass code generation tasks to `@build` (GPT-6 Luna). Generate full, production-ready TypeScript/JavaScript code without placeholders or `// TODO` comments.
- **Deep System Design:** Route structural refactoring and schema tasks to `@general` (GLM-5).
- **Auto-Validate:** After writing or editing code, automatically test imports and run build checks before marking a task complete.

## 2. Token Optimization & Code Quality
- **No Over-Engineering:** Follow `@dietrichgebert/ponytail` rules. Always prefer native language features and existing utility functions over installing new npm dependencies.
- **Minimal Diffs:** Modify only the files directly involved in the user request. Do not rewrite untouched functions or reformat unrelated files.
- **Concise Outputs:** Explain *what* was changed in 2 to 3 sentences maximum. Avoid long introductory explanations.

## 3. Memory & Context Awareness
- Always inspect existing project files in the target folder before creating new duplicates.
- Maintain consistency with existing component patterns, naming conventions, and tailwind styling.
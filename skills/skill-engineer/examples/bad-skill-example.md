# Bad Skill Example: code-helper

<!-- PURPOSE: This file is a teaching counter-example. It shows every common
     anti-pattern in skill design so you can recognize and avoid them.
     Every section includes commentary explaining what is wrong and how to
     fix it. NEVER use this as a template — use good-skill-example.md instead. -->

---

Below is a deliberately flawed SKILL.md for a fictional "code-helper" skill.
Every section contains anti-patterns with annotations explaining the problems.

---

```markdown
---
name: codeHelper
description: A helpful skill for various coding tasks
---
```

<!-- WHY THIS FRONTMATTER IS BAD:

     PROBLEM 1 — Name is camelCase, not kebab-case.
     "codeHelper" violates the naming convention. The validator will reject it.
     It also does not match any reasonable folder name.
     FIX: Use "code-helper" (kebab-case matching the folder name).

     PROBLEM 2 — Name is too generic.
     "code-helper" tells you nothing about what the skill actually does.
     Is it a code reviewer? A code generator? A debugger? A skill that helps
     with code in some undefined way is a skill that triggers on everything
     and does nothing well.
     FIX: Pick a specific capability: "python-code-reviewer", "test-generator",
     "api-migration-assistant". One skill, one job.

     PROBLEM 3 — Description is vague and uses forbidden words.
     "A helpful skill for various coding tasks" contains THREE anti-pattern
     words: "helpful", "various", and "tasks". The validator penalizes these.
     More importantly, there are ZERO trigger conditions. When should the
     agent activate this skill? On every message? Never? The agent cannot
     tell.
     FIX: Name specific trigger conditions: "Use when the user asks to review
     Python code, check for style violations, or requests a PR review." -->

```markdown
# Code Helper

This skill is designed to be a comprehensive assistant for all your coding needs. It can help you with code reviews, writing tests, deploying applications, generating documentation, refactoring code, and much more. Whether you're working on a small script or a large enterprise application, this skill has you covered. It supports Python, JavaScript, TypeScript, Go, Rust, Java, C++, C#, Ruby, PHP, Swift, Kotlin, and many other languages. It can also help with DevOps tasks like CI/CD pipeline configuration, Docker container management, and Kubernetes deployment.

## How to Use

When you want help with code, just ask this skill. It will analyze your code and provide suggestions. The skill uses advanced techniques to understand your codebase and can provide context-aware recommendations. It works best when you provide clear descriptions of what you want to achieve.

For code reviews, the skill will look at your code and identify potential issues. It considers things like code style, potential bugs, performance issues, security vulnerabilities, and best practices. The skill draws on extensive knowledge of software engineering principles to provide thorough and thoughtful reviews.

For test writing, the skill can generate unit tests, integration tests, and end-to-end tests. It understands common testing frameworks like pytest, Jest, JUnit, and others. It will analyze your code to identify the most important test cases and generate comprehensive test suites that provide good coverage.

For deployment, the skill can help you set up CI/CD pipelines, configure Docker containers, write Kubernetes manifests, and manage cloud infrastructure. It understands AWS, GCP, Azure, and other cloud providers. It can also help with infrastructure-as-code tools like Terraform and Pulumi.

For documentation, the skill generates docstrings, README files, API documentation, architecture decision records, and other forms of technical documentation. It follows best practices for technical writing and ensures documentation is clear, accurate, and up-to-date.

For refactoring, the skill can identify code smells, suggest design pattern applications, help extract functions and classes, and improve overall code architecture. It understands SOLID principles, DRY, KISS, and other software design guidelines.
```

<!-- WHY THIS INTRODUCTION AND INSTRUCTIONS SECTION IS BAD:

     PROBLEM 1 — Prose paragraphs instead of numbered steps.
     The agent needs to follow a SEQUENCE of actions. Paragraphs like "the skill
     will look at your code and identify potential issues" are vague descriptions,
     not instructions. The agent does not know WHAT to do first, second, third.
     FIX: Convert to numbered steps: "1. Run lint script. 2. Read the file.
     3. Check against the review checklist. 4. Present findings."

     PROBLEM 2 — Way too long. This section alone is ~2000 tokens, and the
     full SKILL.md would exceed 5000 tokens with everything combined.
     The agent loads the entire SKILL.md into context on activation. Bloated
     instructions waste context window and dilute the important parts.
     FIX: Keep SKILL.md under 3000 tokens total. Move detailed checklists,
     framework-specific guides, and reference material to references/.

     PROBLEM 3 — Mixed concerns. This single skill tries to handle:
       - Code review
       - Test generation
       - Deployment and CI/CD
       - Documentation
       - Refactoring
     Each of these is a full skill on its own. Cramming them together means
     none of them is done well. The agent has no clear workflow for any task.
     FIX: Split into separate skills: "python-code-reviewer",
     "test-generator", "deploy-assistant", "doc-generator", "refactoring-guide".
     One skill, one responsibility.

     PROBLEM 4 — Hardcoded assumptions about frameworks and languages.
     The skill lists 13 programming languages, 4 testing frameworks,
     3 cloud providers, and 2 IaC tools. This is both too broad (no skill can
     cover all of these well) and too narrow (it will break when the user
     uses a language not listed).
     FIX: Pick one language/domain per skill. Let the skill name make the
     scope clear: "python-code-reviewer" not "code-helper".

     PROBLEM 5 — No imperative voice. Sentences like "The skill draws on
     extensive knowledge" and "It understands common testing frameworks"
     describe the skill in third person instead of telling the agent what to
     do. The agent is not reading a marketing brochure.
     FIX: Use imperative voice: "Run the lint script", "Read the file",
     "Check for mutable default arguments." -->

```markdown
The skill also integrates with various tools and services. When working with React applications, make sure to check for proper hook usage, component lifecycle management, and state management patterns. For Django applications, verify URL routing, model definitions, and template rendering. For Express.js servers, check middleware ordering, error handling, and route parameter validation. For Spring Boot applications, review dependency injection, bean configuration, and transaction management.

When reviewing database code, check for SQL injection vulnerabilities, N+1 query problems, missing indexes, and improper transaction handling. For PostgreSQL specifically, check for proper use of JSONB columns, array types, and window functions. For MongoDB, verify proper indexing, aggregation pipeline efficiency, and schema design.
```

<!-- WHY THIS ADDITIONAL SECTION IS BAD:

     PROBLEM 1 — Framework-specific knowledge crammed into SKILL.md.
     Django URL routing checks, React hook patterns, Spring Boot bean
     configuration — these are detailed checklists that belong in
     references/ files, not in the top-level instructions. This bloats
     the SKILL.md and wastes tokens on context that may be irrelevant
     to the user's current request.
     FIX: Create references/react-checklist.md, references/django-checklist.md,
     etc. In SKILL.md, write: "Read the relevant checklist from references/
     based on the detected framework."

     PROBLEM 2 — No progressive disclosure.
     Everything is in one flat file. The agent loads ALL of this on activation,
     even if the user only wants to review a simple Python script. Progressive
     disclosure means: SKILL.md has the core workflow, references/ has the
     details, and the agent loads details only when needed.
     FIX: SKILL.md should be ~50 lines of core workflow. Supplementary
     checklists go in references/. Examples go in examples/. -->

<!-- NOTICE: There is no Examples section at all.

     WHY THIS IS BAD:
     Without usage examples, the agent has to guess how to behave for
     different user inputs. Examples serve as few-shot demonstrations
     that calibrate the agent's response format and decision-making.

     FIX: Add at least 2-3 examples showing:
       - User input (what the user says)
       - Expected agent behavior (numbered steps the agent should follow)
     See good-skill-example.md for the correct format. -->

<!-- NOTICE: There is no "Do NOT" section at all.

     WHY THIS IS BAD:
     Without explicit scope boundaries, the agent will try to do everything.
     Ask it to review code? It might also run the tests, deploy to staging,
     and rewrite the README. There is nothing telling it where to stop.

     Scope boundaries prevent:
     - The agent from taking destructive actions (deploying, deleting files)
     - Scope creep into adjacent workflows
     - The agent from spending 10 minutes on irrelevant tasks

     FIX: Add a "Do NOT" section with 4-6 explicit boundaries:
       - "Do NOT deploy code or run CI/CD pipelines."
       - "Do NOT modify files without user approval."
       - "Do NOT review files in languages outside the skill's scope."
     See good-skill-example.md for the correct format. -->

<!-- NOTICE: There is no scripts/ directory or references/ directory.

     WHY THIS IS BAD:
     1. No scripts means ALL work is done by the LLM. Linting, type-checking,
        and test execution are DETERMINISTIC tasks that should be handled by
        scripts. The LLM should not guess at lint results — it should run
        ruff and read the output.
     2. No references/ means all knowledge is crammed into SKILL.md or,
        worse, the LLM is expected to "just know" the right answer.

     FIX: Create scripts/ for deterministic tasks (lint.sh, run-tests.sh).
     Create references/ for checklists, style guides, and framework-specific
     knowledge that the agent loads on-demand. -->

---

## Summary of Anti-Patterns

| Anti-Pattern | What's Wrong | Fix |
|---|---|---|
| camelCase name | Violates kebab-case convention, breaks validator | Use `python-code-reviewer` |
| Vague description | No trigger conditions, uses "helpful" / "various" | Name 2-3 specific trigger conditions |
| Prose paragraphs | Agent cannot follow a sequence of actions | Use numbered step-by-step instructions |
| 5000+ tokens | Wastes context window, dilutes key information | Keep under 3000 tokens, use references/ |
| Mixed concerns | One skill tries to do 5 unrelated jobs | One skill, one responsibility |
| Hardcoded frameworks | Too broad to be useful, too narrow to be general | Pick one language/domain per skill |
| No examples | Agent guesses at response format and behavior | Add 2-3 examples with input and expected behavior |
| No Do NOT section | Agent has no scope boundaries, tries everything | Add 4-6 explicit boundaries |
| No scripts/ | Deterministic tasks handled by non-deterministic LLM | Delegate linting, testing to scripts |
| No references/ | Everything crammed into one file, no progressive disclosure | Move checklists and guides to references/ |
| Passive/marketing voice | "The skill is designed to..." is not an instruction | Use imperative: "Run X", "Check Y", "Present Z" |

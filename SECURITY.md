# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** through GitHub's built-in security advisory flow:

→ https://github.com/ianherzing/Altair/security/advisories/new

Or navigate to the repository's **Security** tab and click **"Report a vulnerability"**.

Public issues should **not** be used for security reports — please don't open one for a vulnerability.

We'll acknowledge new reports within 7 days.

## Supported Versions

Altair does not yet ship versioned releases. Reports against `main` are accepted.

## Scope

**In scope:** anything in this repository — application code, database schema, RLS policies, workflows, deployment configs, and documentation.

**Out of scope:**
- Vulnerabilities in upstream dependencies (please report those to the upstream maintainers).
- Social engineering, phishing, physical access.
- Denial-of-service through resource exhaustion.
- Issues that require a malicious admin (`pmo_admin` role) to exploit — that role is trusted by design.

## What to include in a report

- Affected file(s) / endpoint(s) / table(s)
- Steps to reproduce, ideally a minimal proof of concept
- Impact (what an attacker can read, write, or break)
- Your suggested fix, if you have one

Thanks for helping keep Altair safe.

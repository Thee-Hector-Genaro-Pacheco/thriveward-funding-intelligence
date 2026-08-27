# Development Authentication

This workflow is only for the dedicated local `bridge_ai_dev` database and the development-only ADMIN identity `dev-admin@projectthriveward.local`. It refuses operational, acceptance, Vitest, and unknown databases by checking PostgreSQL `current_database()`.

## Human setup

1. Create `bridge_ai_dev` in a separately authorized phase and apply its schema.
2. Copy `.env.development.example` to `.env.development.local`.
3. Choose the development password and store it only in that Git-ignored file or a password manager.
4. From the repository root, run `npm run dev:auth:bootstrap` once. If the account already exists, only its email, role, and active state are checked; its password remains unchanged and is not verified.

## Agent usage

Coding agents may run `npm run dev:auth:inspect`. It reports only whether the expected account exists and its email, role, and active state after verifying the connected database. It does not require or read a password and does not create a session.

Coding agents must not perform application login, password verification, credential retries, browser authentication, or password resets. The human performs login acceptance manually. Agents must never alter the human acceptance account.

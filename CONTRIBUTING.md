# Contributing to Mainline

Thanks for your interest in contributing! Mainline is a personal productivity app — contributions that improve reliability, accessibility, and the core workflow are welcome.

## Getting Started

1. Fork the repo and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Neon database URL
4. Run the dev server: `npm run dev`
5. Open `http://localhost:3000` and complete the setup wizard

## Before Submitting a PR

- Run `npm run lint` — must pass with zero errors
- Run `npm test` — all tests must pass
- Run `npm run build` — must compile cleanly
- Keep PRs focused on a single change

## Code Style

- TypeScript strict mode is enabled
- Use the Neon tagged template (`sql\`...\``) for all database queries — never interpolate user input into raw SQL strings
- API routes should validate input, catch errors, and never leak stack traces
- Frontend pages should handle loading, empty, and error states

## What We're Looking For

- Bug fixes with clear reproduction steps
- Accessibility improvements
- Performance improvements (fewer queries, smaller bundles)
- Offline/sync reliability improvements

## What We're Not Looking For

- New features without prior discussion — open an issue first
- UI redesigns or major UX changes
- Dependencies that increase bundle size significantly

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

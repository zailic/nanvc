# Contributing to nanvc

Thank you for taking the time to contribute. `nanvc` is a small TypeScript client for the HashiCorp Vault HTTP API, and contributions that improve correctness, documentation, compatibility, and developer experience are welcome.

## Ways to Contribute

- Report bugs with clear reproduction steps.
- Suggest improvements or new Vault API coverage.
- Improve documentation, examples, and type information.
- Submit fixes with focused pull requests.

## Before You Start

Please check the existing issues and pull requests first to avoid duplicate work. For larger changes, open an issue before implementing so the approach can be discussed early.

## Development Setup

This project requires Node.js `>= 20` and npm.

```bash
npm install
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Integration tests require Docker and a local Vault test environment:

```bash
npm run test:integration
```

## Pull Request Guidelines

- Keep pull requests focused on one change or closely related set of changes.
- Add or update tests when behavior changes.
- Update documentation and examples when public APIs change.
- Make sure `npm run typecheck`, `npm run lint`, and `npm run test` pass before requesting review.
- Include a short summary of the change and any relevant testing notes in the pull request description.

## Coding Style

Follow the existing TypeScript style in the repository. Prefer clear, typed APIs and small changes that fit the current client design. Avoid unrelated formatting or refactoring in the same pull request as a functional change.

## Security

Please do not open public issues for suspected security vulnerabilities. Instead, contact the maintainer using the email listed in `package.json` so the issue can be handled responsibly.

## Community

By participating in this project, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

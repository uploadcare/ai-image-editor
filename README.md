# @uploadcare/ai-enhancer

AI image generation and editing web component for Uploadcare, plus a React wrapper.

## Packages

| Package | Description |
|---|---|
| [`@uploadcare/ai-enhancer`](packages/ai-enhancer) | Standalone `<uc-ai-editor>` web component + optional `/plugin` sub-export for the Uploadcare file uploader. |
| [`@uploadcare/react-ai-enhancer`](packages/react-ai-enhancer) | Thin React wrapper around the web component. |

## Quick start

```sh
npm install
npm run dev          # vite dev server on the standalone demo
npm run build        # build all packages
npm test             # run unit + e2e tests
npm run lint         # biome lint
```

## Layout

This is an npm workspaces + lerna independent monorepo using nx for task caching
and Biome for lint/format.

## License

MIT

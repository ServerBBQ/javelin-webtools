# Javelin web tools

This repo contains third party web tools for [Javelin](https://lim.au/#/software/javelin-steno)

You can use the official web tools [here](https://lim.au/#/software/javelin-steno-tools)

## Running dev server

```bash
npm run dev
```

Open [http://localhost:3000/javelin-webtools](http://localhost:3000/javelin-webtools) with your browser to see the result.

## Creating your own web tool

1. Duplicate the example in `tools/example`
2. Rename the tool
3. Edit `tool/<your-tool-name>/metadata.json`.
4. It should automatically be added to the tool list
5. Modify `tool/<your-tool-name>/page.tsx` to your liking
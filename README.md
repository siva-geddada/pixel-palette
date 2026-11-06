# Pixel Palette

Turn any image into a colour palette, and see which colours are readable together.

Drop in an image and Pixel Palette finds its main colours with k-means clustering, then scores every text and background pairing against WCAG contrast rules.

Everything runs in your browser. The production build includes a Content Security Policy with `connect-src 'none'`, so the browser blocks all network requests and your image can't leave your device.

## Features

- Drag and drop, file picker or paste from the clipboard
- 2 to 10 colours, with the share of the image each one covers
- Contrast table with AAA, AA, AA Large and Fail ratings
- Click a colour to copy it, or copy the palette as CSS variables
- Light and dark themes, keyboard accessible

## How it works

1. The image is scaled down on a canvas, as finding colours doesn't need every pixel.
2. Pixels are grouped into 32,768 colour buckets, so clustering runs on buckets and stays fast.
3. Weighted k-means runs in the CIE Lab colour space, because distances there match how people see colour difference. It uses a fixed seed, so an image always gives the same palette.
4. Clusters that look alike are merged.
5. Each pair is scored with the WCAG relative luminance formula.

Clustering runs in a Web Worker, so the page stays responsive.

## Run it

```bash
npm install
npm run dev      # development server
npm test         # unit tests
npm run build    # type check, then build to dist/
npm run preview  # serve the production build
```

`dist/` is a static site that any static host can serve.

## Stack

TypeScript, Vite, Canvas API, Web Workers, CSS and Vitest. There are no runtime dependencies.

## License

MIT. See [LICENSE](LICENSE).

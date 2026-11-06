import { extractPalette, type Swatch } from './palette';

export interface PaletteRequest {
  id: number;
  pixels: Uint8ClampedArray;
  size: number;
}

export interface PaletteResponse {
  id: number;
  palette: Swatch[];
}

addEventListener('message', (event: MessageEvent<PaletteRequest>) => {
  const { id, pixels, size } = event.data;
  const response: PaletteResponse = { id, palette: extractPalette(pixels, size) };
  postMessage(response);
});

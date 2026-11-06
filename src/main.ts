import { contrastRatio, formatRatio, wcagLevel, type WcagLevel } from './color';
import { toCssVariables, type Swatch } from './palette';
import type { PaletteRequest, PaletteResponse } from './worker';

const MAX_SIDE = 240; // plenty for finding colours, and keeps large photos fast

const element = <T extends HTMLElement>(id: string) => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
};

const fileInput = element<HTMLInputElement>('file');
const dropzone = element('dropzone');
const sampleButton = element<HTMLButtonElement>('sample');
const errorText = element('error');
const results = element('results');
const preview = element<HTMLImageElement>('preview');
const sizeInput = element<HTMLInputElement>('size');
const sizeValue = element<HTMLOutputElement>('size-value');
const swatchList = element<HTMLUListElement>('swatches');
const paletteHint = element('palette-hint');
const summary = element('summary');
const matrix = element<HTMLTableElement>('matrix');
const cssOutput = element('css');
const copyCssButton = element<HTMLButtonElement>('copy-css');

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let pixels: Uint8ClampedArray | undefined;
let previewUrl: string | undefined;
let latestRequest = 0;

function showError(message: string) {
  errorText.textContent = message;
  errorText.hidden = false;
}

function requestPalette() {
  if (!pixels) return;
  latestRequest++;
  const request: PaletteRequest = {
    id: latestRequest,
    pixels: pixels.slice(), // a copy, because the slider sends these pixels again
    size: Number(sizeInput.value),
  };
  worker.postMessage(request, [request.pixels.buffer]);
}

worker.addEventListener('message', (event: MessageEvent<PaletteResponse>) => {
  // Dragging the slider starts several runs. Only the newest one should be shown.
  if (event.data.id !== latestRequest) return;

  if (event.data.palette.length === 0) {
    results.hidden = true;
    showError('That image is fully transparent, so there are no colours to read.');
    return;
  }
  render(event.data.palette);
});

worker.addEventListener('error', () => showError('Something went wrong reading that image.'));

async function loadImage(file: File) {
  errorText.hidden = true;

  if (!file.type.startsWith('image/')) {
    showError('That file is not an image. Try a PNG, JPG, WebP or GIF.');
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    showError('That image could not be opened. It may be damaged or an unsupported format.');
    return;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    showError('That image has no size, so its colours cannot be read.');
    return;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    URL.revokeObjectURL(url);
    showError('Your browser could not read this image.');
    return;
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = url;
  preview.src = url;

  requestPalette();
}

function renderSwatches(palette: Swatch[]) {
  swatchList.replaceChildren(
    ...palette.map((swatch) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.setAttribute('aria-label', `Copy ${swatch.hex}`);

      const colour = document.createElement('span');
      colour.className = 'swatch-colour';
      colour.style.backgroundColor = swatch.hex;

      const hex = document.createElement('code');
      hex.textContent = swatch.hex;

      const share = document.createElement('span');
      share.className = 'swatch-share';
      share.textContent = swatch.share < 0.01 ? 'under 1%' : `${Math.round(swatch.share * 100)}%`;

      button.append(colour, hex, share);
      button.addEventListener('click', () => void copy(swatch.hex, paletteHint));
      item.append(button);
      return item;
    }),
  );
}

const badgeClass = (level: WcagLevel) =>
  level === 'Fail' ? 'fail' : level === 'AA Large' ? 'large' : 'pass';

function renderMatrix(palette: Swatch[]) {
  const headerRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = 'Text ↓ / Background →';
  headerRow.append(corner);

  for (const swatch of palette) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.append(chip(swatch));
    headerRow.append(heading);
  }

  const head = document.createElement('thead');
  head.append(headerRow);

  const body = document.createElement('tbody');
  for (const text of palette) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.append(chip(text));
    row.append(heading);

    for (const background of palette) {
      const cell = document.createElement('td');
      if (text === background) {
        cell.className = 'same';
        cell.textContent = '—';
        cell.setAttribute('aria-label', 'Same colour');
      } else {
        const ratio = contrastRatio(text.rgb, background.rgb);
        const level = wcagLevel(ratio);

        const sample = document.createElement('span');
        sample.className = 'sample';
        sample.textContent = 'Aa';
        sample.setAttribute('aria-hidden', 'true');
        sample.style.color = text.hex;
        sample.style.backgroundColor = background.hex;

        const value = document.createElement('span');
        value.className = 'ratio';
        value.textContent = formatRatio(ratio);

        const badge = document.createElement('span');
        badge.className = `badge ${badgeClass(level)}`;
        badge.textContent = level;

        cell.append(sample, value, badge);
      }
      row.append(cell);
    }
    body.append(row);
  }
  matrix.replaceChildren(head, body);
}

function chip(swatch: Swatch) {
  const wrapper = document.createElement('span');
  wrapper.className = 'chip';
  const dot = document.createElement('span');
  dot.className = 'chip-dot';
  dot.style.backgroundColor = swatch.hex;
  const label = document.createElement('code');
  label.textContent = swatch.hex;
  wrapper.append(dot, label);
  return wrapper;
}

function renderSummary(palette: Swatch[]) {
  let total = 0;
  let passing = 0;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const a = palette[i];
      const b = palette[j];
      if (!a || !b) continue;
      total++;
      if (contrastRatio(a.rgb, b.rgb) >= 4.5) passing++;
    }
  }

  if (total === 0) {
    summary.textContent = 'This image has only one main colour, so there are no pairs to compare.';
    return;
  }
  const noun = total === 1 ? 'pair' : 'pairs';
  summary.textContent = `${passing} of ${total} colour ${noun} pass AA for normal text.`;
}

function render(palette: Swatch[]) {
  renderSwatches(palette);
  renderMatrix(palette);
  renderSummary(palette);
  cssOutput.textContent = toCssVariables(palette);
  results.hidden = false;
}

async function copy(text: string, status: HTMLElement) {
  const original = status.textContent;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = `Copied ${text.split('\n').length > 1 ? 'CSS' : text}`;
  } catch {
    status.textContent = 'Copying was blocked by your browser. Select the text instead.';
  }
  setTimeout(() => {
    status.textContent = original;
  }, 1800);
}

/** Builds a sunset scene, so the sample needs no image file. */
function sampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);

  const sky = context.createLinearGradient(0, 0, 0, 280);
  sky.addColorStop(0, '#1a2a4a');
  sky.addColorStop(0.55, '#c8456b');
  sky.addColorStop(1, '#ff9a3d');
  context.fillStyle = sky;
  context.fillRect(0, 0, 640, 280);

  context.fillStyle = '#ffe9a8';
  context.beginPath();
  context.arc(430, 230, 62, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#123c46';
  context.fillRect(0, 280, 640, 120);

  context.fillStyle = '#0d1b2a';
  context.beginPath();
  context.moveTo(0, 300);
  context.lineTo(150, 170);
  context.lineTo(290, 300);
  context.closePath();
  context.fill();

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadImage(file);
  fileInput.value = ''; // lets the same file be chosen twice
});

for (const type of ['dragenter', 'dragover'] as const) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('active');
  });
}
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('active'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('active');
  const file = event.dataTransfer?.files[0];
  if (file) void loadImage(file);
});

document.addEventListener('paste', (event) => {
  const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (file) void loadImage(file);
});

sampleButton.addEventListener('click', () => {
  void sampleImage().then((blob) => {
    if (blob) void loadImage(new File([blob], 'sample.png', { type: 'image/png' }));
  });
});

sizeInput.addEventListener('input', () => {
  sizeValue.textContent = sizeInput.value;
  requestPalette();
});

copyCssButton.addEventListener('click', () => {
  const originalLabel = copyCssButton.textContent;
  void navigator.clipboard.writeText(cssOutput.textContent ?? '').then(
    () => {
      copyCssButton.textContent = 'Copied';
      setTimeout(() => {
        copyCssButton.textContent = originalLabel;
      }, 1800);
    },
    () => {
      copyCssButton.textContent = 'Copy blocked, select the text instead';
    },
  );
});

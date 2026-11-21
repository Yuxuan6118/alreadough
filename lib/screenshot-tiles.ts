/**
 * Browser side of screenshot import: each screenshot is scaled to a readable width and long ones are cut into pieces
 * the model can read. Cuts go through a row of plain chat background, so a bubble is never split in two.
 */
const MAX_WIDTH = 1000;
const PIECE_RATIO = 2; // a piece is at most twice as tall as it is wide
const SEARCH = 0.25; // look this share of a piece upward for a clean row to cut at
const QUALITY = 0.82;

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width; element.height = height;
  return element;
}

/** True when the whole row is (nearly) one colour, i.e. background between messages. */
function plainRow(data: Uint8ClampedArray, width: number, y: number) {
  const at = (x: number) => (y * width + x) * 4;
  const base = at(Math.min(2, width - 1));
  let off = 0, seen = 0;
  for (let x = 0; x < width; x += 4) {
    const i = at(x);
    seen++;
    if (Math.abs(data[i] - data[base]) + Math.abs(data[i + 1] - data[base + 1]) + Math.abs(data[i + 2] - data[base + 2]) > 24) off++;
  }
  return off <= seen * 0.01;
}

function findCut(bitmap: ImageBitmap, scale: number, width: number, from: number, to: number) {
  const band = to - from;
  const area = canvas(width, band);
  const context = area.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, from / scale, bitmap.width, band / scale, 0, 0, width, band);
  const data = context.getImageData(0, 0, width, band).data;
  for (let y = band - 1; y >= 0; y--) if (plainRow(data, width, y)) return from + y;
  return to;
}

function toDataUrl(element: HTMLCanvasElement) {
  return element.toDataURL("image/jpeg", QUALITY);
}

export async function screenshotPieces(files: File[], maxPieces: number): Promise<string[]> {
  const pieces: string[] = [];
  for (const file of files) {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_WIDTH / bitmap.width);
      const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
      const pieceHeight = Math.round(width * PIECE_RATIO);
      let top = 0;
      while (top < height) {
        if (pieces.length >= maxPieces) throw new Error("TOO_MANY");
        let bottom = Math.min(height, top + pieceHeight);
        if (bottom < height) bottom = findCut(bitmap, scale, width, bottom - Math.round(pieceHeight * SEARCH), bottom);
        if (bottom <= top) bottom = Math.min(height, top + pieceHeight);
        const piece = canvas(width, bottom - top);
        piece.getContext("2d")!.drawImage(bitmap, 0, top / scale, bitmap.width, (bottom - top) / scale, 0, 0, width, bottom - top);
        pieces.push(toDataUrl(piece));
        top = bottom;
      }
    } finally { bitmap.close(); }
  }
  return pieces;
}

/**
 * Recorta el logo real de HI Travel (`Insumos/Logo Hi Travel 2025 definitivo
 * solo.png`, 1920×1080 con mucho margen transparente) y deja los assets web
 * del repo (spec M1-06 #13, docs/arquitectura/marca.md §4):
 *
 * - `public/marca/logo-hi-travel.png`: logo completo, sin márgenes, 160 px de
 *   alto (nítido a 32 px en el header y a 64 px en el login, en pantallas 2x).
 * - `public/marca/favicon-hi.png` y `src/app/icon.png`: solo el triángulo
 *   "hi", centrado en un cuadrado transparente.
 *
 * Uso: `npx tsx scripts/generar-assets-marca.ts` (una sola vez, o cuando
 * cambie el logo). `Insumos/` no se commitea; los assets resultantes sí.
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const ORIGEN = "Insumos/Logo Hi Travel 2025 definitivo solo.png";

async function main() {
  mkdirSync("public/marca", { recursive: true });

  const recortado = await sharp(ORIGEN).trim({ threshold: 1 }).toBuffer();

  await sharp(recortado)
    .resize({ height: 160 })
    .png({ compressionLevel: 9, palette: true })
    .toFile("public/marca/logo-hi-travel.png");

  // El triángulo naranja ocupa la franja izquierda del logo recortado: se
  // busca su borde derecho por color en vez de fijar un número a mano.
  const { data, info } = await sharp(recortado).raw().toBuffer({ resolveWithObject: true });
  let bordeDerecho = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const esNaranja = data[i + 3] > 128 && data[i] > 180 && data[i + 2] < 90;
      if (esNaranja && x > bordeDerecho) bordeDerecho = x;
    }
  }
  // Se copia solo lo naranja: la letra "t" (azul) arranca dentro de esa franja.
  const ancho = bordeDerecho + 1;
  const soloNaranja = Buffer.alloc(ancho * info.height * 4);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * info.width + x) * info.channels;
      const j = (y * ancho + x) * 4;
      const esAzul = data[i + 2] > data[i] + 30;
      soloNaranja[j] = data[i];
      soloNaranja[j + 1] = data[i + 1];
      soloNaranja[j + 2] = data[i + 2];
      soloNaranja[j + 3] = esAzul ? 0 : data[i + 3];
    }
  }
  const triangulo = await sharp(soloNaranja, { raw: { width: ancho, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  for (const [destino, lado] of [
    ["public/marca/favicon-hi.png", 64],
    ["src/app/icon.png", 64],
  ] as const) {
    await sharp(triangulo)
      .resize({ width: lado, height: lado, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(destino);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Generates app/store branding assets from assets/icon_gpt.png.
 * Run: node scripts/generate-branding-assets.mjs
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const masterPath = join(root, 'assets', 'icon_gpt.png');
const imagesDir = join(root, 'assets', 'images');
const releaseDir = join(root, 'release-artifacts');

mkdirSync(imagesDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

const master = sharp(masterPath);
const meta = await master.metadata();
console.log(`Master: ${masterPath} (${meta.width}x${meta.height})`);

// Sample corner color for adaptive background.
const { data, info } = await master
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });
const corners = [
	0,
	info.width - 1,
	(info.height - 1) * info.width,
	(info.height - 1) * info.width + (info.width - 1),
];
let r = 0;
let g = 0;
let b = 0;
for (const index of corners) {
	const offset = index * info.channels;
	r += data[offset];
	g += data[offset + 1];
	b += data[offset + 2];
}
r = Math.round(r / 4);
g = Math.round(g / 4);
b = Math.round(b / 4);
const background = { r, g, b, alpha: 255 };
console.log(
	`Adaptive background: #${r.toString(16).padStart(2, '0')}${g
		.toString(16)
		.padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
);

async function writePng(bufferPromise, targetPath) {
	await bufferPromise.png().toFile(targetPath);
}

// Standard icon — 1024×1024.
await writePng(
	sharp(masterPath).resize(1024, 1024, { fit: 'contain', background }),
	join(imagesDir, 'icon.png')
);

// RuStore storefront icon — exact 512×512.
await writePng(
	sharp(masterPath).resize(512, 512, { fit: 'contain', background }),
	join(releaseDir, 'rustore-icon-512.png')
);

// Adaptive background — solid cream sampled from master corners.
await sharp({
	create: {
		width: 1024,
		height: 1024,
		channels: 4,
		background,
	},
})
	.png()
	.toFile(join(imagesDir, 'android-icon-background.png'));

// Adaptive foreground — inset master into Android safe zone (~72%).
const foregroundSize = 1024;
const foregroundDraw = Math.round(foregroundSize * 0.72);
const foregroundOffset = Math.round((foregroundSize - foregroundDraw) / 2);
const insetMaster = await sharp(masterPath)
	.resize(foregroundDraw, foregroundDraw, { fit: 'contain', background: { ...background, alpha: 0 } })
	.png()
	.toBuffer();
await sharp({
	create: {
		width: foregroundSize,
		height: foregroundSize,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.composite([{ input: insetMaster, left: foregroundOffset, top: foregroundOffset }])
	.png()
	.toFile(join(imagesDir, 'android-icon-foreground.png'));

// Monochrome — dark garden silhouette derived from master luminance.
const monoBase = await sharp(masterPath)
	.resize(foregroundDraw, foregroundDraw, { fit: 'contain', background: { ...background, alpha: 0 } })
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });

const monoPixels = Buffer.alloc(monoBase.info.width * monoBase.info.height * 4);
for (let i = 0; i < monoBase.info.width * monoBase.info.height; i++) {
	const offset = i * monoBase.info.channels;
	const pr = monoBase.data[offset];
	const pg = monoBase.data[offset + 1];
	const pb = monoBase.data[offset + 2];
	const pa = monoBase.info.channels === 4 ? monoBase.data[offset + 3] : 255;
	const bgDistance = Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b);
	const gray = (pr + pg + pb) / 3;
	const out = i * 4;
	if (pa < 16 || bgDistance < 42 || gray > 210) {
		monoPixels[out] = 0;
		monoPixels[out + 1] = 0;
		monoPixels[out + 2] = 0;
		monoPixels[out + 3] = 0;
	} else {
		monoPixels[out] = 45;
		monoPixels[out + 1] = 90;
		monoPixels[out + 2] = 61;
		monoPixels[out + 3] = 255;
	}
}

const monoBuffer = await sharp(monoPixels, {
	raw: {
		width: monoBase.info.width,
		height: monoBase.info.height,
		channels: 4,
	},
})
	.png()
	.toBuffer();

await sharp({
	create: {
		width: foregroundSize,
		height: foregroundSize,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.composite([{ input: monoBuffer, left: foregroundOffset, top: foregroundOffset }])
	.png()
	.toFile(join(imagesDir, 'android-icon-monochrome.png'));

// Splash — centered master on transparent canvas.
const splashDraw = Math.round(1024 * 0.62);
const splashOffset = Math.round((1024 - splashDraw) / 2);
const splashArt = await sharp(masterPath)
	.resize(splashDraw, splashDraw, { fit: 'contain', background: { ...background, alpha: 0 } })
	.png()
	.toBuffer();
await sharp({
	create: {
		width: 1024,
		height: 1024,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.composite([{ input: splashArt, left: splashOffset, top: splashOffset }])
	.png()
	.toFile(join(imagesDir, 'splash-icon.png'));

// Favicon.
await writePng(sharp(masterPath).resize(48, 48, { fit: 'contain', background }), join(imagesDir, 'favicon.png'));

console.log('Branding assets generated.');

/**
 * Re-captures specific RuStore screenshots that need correction.
 */

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const adb =
	process.env.ADB_PATH ??
	'C:\\Users\\alex1c\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const outDir = join(process.cwd(), 'release-artifacts', 'screenshots');
const tempDir = join(process.cwd(), 'release-artifacts', '_tmp-shots');

function adbShell(command) {
	execSync(`"${adb}" shell ${command}`, { stdio: 'inherit' });
}

function sleep(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function capture(name) {
	const remote = `/sdcard/${name}-raw.png`;
	const localRaw = join(tempDir, `${name}-raw.png`);
	const localFinal = join(outDir, `${name}.png`);
	adbShell(`screencap -p ${remote}`);
	execSync(`"${adb}" pull ${remote} "${localRaw}"`, { stdio: 'inherit' });
	adbShell(`rm ${remote}`);

	const meta = await sharp(localRaw).metadata();
	const width = meta.width ?? 1080;
	const height = meta.height ?? 2424;
	const targetRatio = 1080 / 1920;
	const sourceRatio = width / height;
	let extract = { left: 0, top: 0, width, height };

	if (sourceRatio > targetRatio) {
		// Crop horizontal overflow while keeping full vertical content.
		const newWidth = Math.round(height * targetRatio);
		extract = {
			left: Math.round((width - newWidth) / 2),
			top: 0,
			width: newWidth,
			height,
		};
	} else {
		// Bottom-align portrait crop so the tab bar stays visible.
		const cropHeight = Math.round(width / targetRatio);
		extract = {
			left: 0,
			top: Math.max(0, height - cropHeight),
			width,
			height: Math.min(cropHeight, height),
		};
	}

	await sharp(localRaw).extract(extract).resize(1080, 1920).png().toFile(localFinal);
}

async function main() {
	mkdirSync(outDir, { recursive: true });
	mkdirSync(tempDir, { recursive: true });

	execSync(
		`"${adb}" shell am start -n com.calculatorplatform.gardendiary/.MainActivity`,
		{ stdio: 'inherit' }
	);
	sleep(4000);

	// Ensure Today tab is active before the first capture.
	adbShell('input tap 108 2330');
	sleep(1500);

	// Today
	await capture('01-today');

	// Plot tab
	adbShell('input tap 324 2330');
	sleep(1500);
	await capture('02-plot');

	// Greenhouse plantings from plot
	adbShell('input tap 540 980');
	sleep(1500);
	await capture('03-plantings');
	adbShell('input keyevent 4');
	sleep(800);

	// Diary tab
	adbShell('input tap 540 2330');
	sleep(1500);
	await capture('04-diary');

	// Stats tab
	adbShell('input tap 756 2330');
	sleep(1500);
	adbShell('input swipe 540 1200 540 500 350');
	sleep(800);
	await capture('05-statistics');

	// Seasons screen via deep link (UI button uses /season route)
	execSync(
		`"${adb}" shell am start -a android.intent.action.VIEW -d "gardendiary://season" com.calculatorplatform.gardendiary`,
		{ stdio: 'inherit' }
	);
	sleep(1500);
	await capture('06-seasons-data');

	console.log('Recaptured screenshots.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

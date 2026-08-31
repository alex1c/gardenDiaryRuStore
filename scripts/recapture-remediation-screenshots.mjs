/**
 * Recapture RuStore screenshots 01, 02, 03, 05 after remediation.
 * Uses an exact 1080×1920 emulator viewport so titles are not cropped.
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
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
	const height = meta.height ?? 1920;

	// Prefer exact 1080×1920; otherwise scale proportionally without distortion.
	if (width === 1080 && height === 1920) {
		copyFileSync(localRaw, localFinal);
	} else {
		await sharp(localRaw)
			.resize(1080, 1920, { fit: 'cover', position: 'top' })
			.png()
			.toFile(localFinal);
	}

	const finalMeta = await sharp(localFinal).metadata();
	console.log(`saved ${name}: ${finalMeta.width}x${finalMeta.height}`);
}

async function main() {
	mkdirSync(outDir, { recursive: true });
	mkdirSync(tempDir, { recursive: true });

	// Lock a true 9:16 phone canvas for store captures.
	adbShell('wm size 1080x1920');
	sleep(1500);

	try {
		execSync(
			`"${adb}" shell am force-stop com.calculatorplatform.gardendiary`,
			{ stdio: 'inherit' }
		);
		sleep(1000);
		execSync(
			`"${adb}" shell am start -n com.calculatorplatform.gardendiary/.MainActivity`,
			{ stdio: 'inherit' }
		);
		sleep(12000);

		// Today tab
		adbShell('input tap 108 1850');
		sleep(2000);
		await capture('01-today');

		// Plot tab
		adbShell('input tap 324 1850');
		sleep(2000);
		await capture('02-plot');

		// Greenhouse plantings (first zone card)
		adbShell('input tap 540 700');
		sleep(2000);
		await capture('03-plantings');
		adbShell('input keyevent 4');
		sleep(1000);

		// Statistics tab — capture from top (no scroll)
		adbShell('input tap 756 1850');
		sleep(2000);
		await capture('05-statistics');
	} finally {
		// Restore default emulator resolution.
		adbShell('wm size reset');
	}

	console.log('Remediation screenshots captured.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

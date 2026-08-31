/**
 * Captures six RuStore screenshots from the running Android emulator.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const adb =
	process.env.ADB_PATH ??
	'C:\\Users\\alex1c\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const packageName = 'com.calculatorplatform.gardendiary';
const outDir = join(process.cwd(), 'release-artifacts', 'screenshots');
const tempDir = join(process.cwd(), 'release-artifacts', '_tmp-shots');

function adbShell(command) {
	return execSync(`"${adb}" shell ${command}`, { encoding: 'utf8' }).trim();
}

function adbExec(args) {
	execSync(`"${adb}" ${args}`, { stdio: 'pipe' });
}

function sleep(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function launchApp() {
	adbExec(
		`shell am start -n ${packageName}/.MainActivity -W`
	);
	sleep(5000);
}

function tap(x, y) {
	adbShell(`input tap ${x} ${y}`);
	sleep(1500);
}

function swipeDown() {
	adbShell('input swipe 540 900 540 400 350');
	sleep(800);
}

async function capture(name) {
	const remote = `/sdcard/${name}-raw.png`;
	const localRaw = join(tempDir, `${name}-raw.png`);
	const localFinal = join(outDir, `${name}.png`);
	rmSync(localRaw, { force: true });
	adbExec(`shell screencap -p ${remote}`);
	adbExec(`pull ${remote} "${localRaw}"`);
	adbExec(`shell rm ${remote}`);

	// Center-crop portrait frame to exact 1080×1920 without distortion.
	const meta = await sharp(localRaw).metadata();
	const width = meta.width ?? 1080;
	const height = meta.height ?? 2424;
	const targetRatio = 1080 / 1920;
	const sourceRatio = width / height;
	let extract = { left: 0, top: 0, width, height };

	if (sourceRatio > targetRatio) {
		const newWidth = Math.round(height * targetRatio);
		extract = {
			left: Math.round((width - newWidth) / 2),
			top: 0,
			width: newWidth,
			height,
		};
	} else {
		const newHeight = Math.round(width / targetRatio);
		extract = {
			left: 0,
			top: Math.round((height - newHeight) / 2),
			width,
			height: newHeight,
		};
	}

	await sharp(localRaw)
		.extract(extract)
		.resize(1080, 1920)
		.png()
		.toFile(localFinal);
}

async function main() {
	mkdirSync(outDir, { recursive: true });
	mkdirSync(tempDir, { recursive: true });

	adbShell('settings put global policy_control immersive.status=*');
	adbShell('settings put global policy_control immersive.navigation=*');

	launchApp();

	// Tab centers for 1080×2424 layout (5 tabs).
	const tabs = {
		today: [108, 2330],
		plot: [324, 2330],
		diary: [540, 2330],
		stats: [756, 2330],
		more: [972, 2330],
	};

	await capture('01-today');

	tap(...tabs.plot);
	await capture('02-plot');

	// Open Теплица area with plantings.
	tap(540, 980);
	await capture('03-plantings');
	adbShell('input keyevent 4');
	sleep(1000);

	tap(...tabs.diary);
	await capture('04-diary');

	tap(...tabs.stats);
	swipeDown();
	await capture('05-statistics');

	tap(...tabs.more);
	sleep(1000);
	tap(540, 560);
	sleep(1500);
	await capture('06-seasons-data');

	console.log(`Screenshots saved to ${outDir}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

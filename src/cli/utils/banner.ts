import packageJson from "../../../package.json";
export function buildBanner(): string {
	const rgb = (r: number, g: number, b: number, t: string) =>
		`\x1b[1;38;2;${r};${g};${b}m${t}\x1b[0m`;
	const dim = (t: string) => `\x1b[38;5;243m${t}\x1b[0m`;
	const br = (t: string) => rgb(90, 200, 170, t);

	// Mint green (#46FFC8) to ice blue (#7BCFE0) gradient
	const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
	const gradient = (i: number, total: number, text: string) => {
		const t = i / (total - 1);
		return rgb(lerp(70, 123, t), lerp(255, 207, t), lerp(200, 224, t), text);
	};

	// Plain-text rows (no ANSI). We'll measure, find max width, then colorize.
	const artPlain = [
		" █████  ███   ██ ██   ██ ████████ ██  ██ ██ ███   ██  ██████",
		"██   ██ ████  ██  ██ ██     ██    ██  ██ ██ ████  ██ ██",
		"███████ ██ ██ ██   ████     ██    █████  ██ ██ ██ ██ ██  ███",
		"██   ██ ██  ████    ██      ██    ██  ██ ██ ██  ████ ██   ██",
		"██   ██ ██   ███    ██      ██    ██  ██ ██ ██   ███  ██████",
	];

	const llmPlain = [
		"██      ██      ██   ██",
		"██      ██      ███ ███",
		"██      ██      ██ █ ██",
		"██      ██      ██   ██",
		"███████ ███████ ██   ██",
	];

	const tagline = "✦ Chat with your AnythingLLM instance from the terminal ✦";
	const version = `v${packageJson.version}`;

	// W = inner content width (between the ║ borders)
	const W = Math.max(...artPlain.map((l) => l.length)) + 2; // +2 for breathing room

	const padLine = (text: string, width: number) =>
		text + " ".repeat(Math.max(0, width - text.length));

	const row = (colored: string, visibleLen: number) =>
		`${br("║")} ${colored}${" ".repeat(Math.max(0, W - visibleLen))} ${br("║")}`;

	const empty = () => row("", 0);
	const top = br(`╔${"═".repeat(W + 2)}╗`);
	const bot = br(`╚${"═".repeat(W + 2)}╝`);

	const lines: string[] = ["", top, empty()];

	// ANYTHING rows — mint green end of gradient
	const totalRows = artPlain.length + llmPlain.length;
	for (let i = 0; i < artPlain.length; i++) {
		const text = artPlain[i] as string;
		lines.push(row(gradient(i, totalRows, padLine(text, W)), W));
	}

	lines.push(empty());

	// LLM rows — ice blue end of gradient, left-padded to center
	const llmW = (llmPlain[0] as string).length;
	const llmLeft = Math.floor((W - llmW) / 2);
	for (let i = 0; i < llmPlain.length; i++) {
		const gi = artPlain.length + i;
		const text = llmPlain[i] as string;
		const prefix = " ".repeat(llmLeft);
		if (i === 0) {
			const visLen = llmLeft + text.length + 2 + version.length;
			lines.push(
				row(
					`${prefix}${gradient(gi, totalRows, text)}  ${dim(version)}`,
					visLen,
				),
			);
		} else {
			lines.push(
				row(prefix + gradient(gi, totalRows, text), llmLeft + text.length),
			);
		}
	}

	lines.push(empty());

	// Tagline - centered
	const tagLeft = Math.floor((W - tagline.length) / 2);
	lines.push(row(" ".repeat(tagLeft) + dim(tagline), tagLeft + tagline.length));

	lines.push(empty(), bot, "");
	return lines.join("\n");
}

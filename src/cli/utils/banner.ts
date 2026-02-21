import packageJson from "../../../package.json";

async function health(): Promise<boolean> {
	const baseUrl = process.env.ANYTHING_LLM_BASE_URL;
	try {
		const res = await fetch(`${baseUrl}/api/ping`, {
			method: "GET",
			signal: AbortSignal.timeout(2000),
		});
		return res.ok;
	} catch {
		return false;
	}
}
export async function buildBanner(): Promise<string> {
	const isHealthy = await health();

	const rgb = (r: number, g: number, b: number, t: string) =>
		`\x1b[1;38;2;${r};${g};${b}m${t}\x1b[0m`;
	const dim = (t: string) => `\x1b[38;5;243m${t}\x1b[0m`;
	const warn = (t: string) => `\x1b[1;38;5;214m${t}\x1b[0m`;

	const br = isHealthy
		? (t: string) => rgb(90, 200, 170, t)
		: (t: string) => rgb(200, 60, 60, t);

	const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
	const gradient = isHealthy
		? (i: number, total: number, text: string) => {
				// Mint green (#46FFC8) to ice blue (#7BCFE0)
				const t = i / (total - 1);
				return rgb(
					lerp(70, 123, t),
					lerp(255, 207, t),
					lerp(200, 224, t),
					text,
				);
			}
		: (i: number, total: number, text: string) => {
				// Dark red to bright red
				const t = i / (total - 1);
				return rgb(lerp(180, 220, t), lerp(40, 70, t), lerp(40, 60, t), text);
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

	if (isHealthy) {
		lines.push(empty());
		const baseUrl =
			process.env.ANYTHING_LLM_BASE_URL || "http://localhost:3001";
		const isDesktop = baseUrl === "http://localhost:3001";

		let statusText: string;
		if (isDesktop) {
			statusText = "● Connected to AnythingLLM Desktop";
		} else {
			const prefix = "● Connected to AnythingLLM Web · ";
			const maxUrlLen = W - prefix.length;
			const displayUrl =
				baseUrl.length > maxUrlLen
					? `${baseUrl.slice(0, maxUrlLen - 1)}…`
					: baseUrl;
			statusText = `${prefix}${displayUrl}`;
		}

		const statusLeft = Math.max(0, Math.floor((W - statusText.length) / 2));
		lines.push(
			row(
				" ".repeat(statusLeft) + rgb(90, 200, 170, statusText),
				statusLeft + statusText.length,
			),
		);
	}

	if (!isHealthy) {
		lines.push(empty());

		const baseUrl = process.env.ANYTHING_LLM_BASE_URL;
		const hasBaseUrl = !!baseUrl;
		const isPosix = process.platform !== "win32";

		const center = (text: string, style: (t: string) => string) => {
			const left = Math.max(0, Math.floor((W - text.length) / 2));
			lines.push(row(" ".repeat(left) + style(text), left + text.length));
		};

		if (hasBaseUrl) {
			center("Could not connect to your AnythingLLM instance.", warn);
			center("Ensure your instance is running and reachable.", warn);
		} else {
			center("Welcome! No AnythingLLM connection configured.", warn);
		}

		lines.push(empty());

		if (isPosix) {
			center("Run `any setup` to get started.", dim);
			center("Or set these environment variables:", dim);
		} else {
			center("Set these environment variables to connect:", dim);
		}

		lines.push(empty());

		const envLines = [
			"ANYTHING_LLM_API_KEY   - API key for your instance",
			"ANYTHING_LLM_BASE_URL  - Instance URL",
		];

		// Left-align the env var block as a group, centered within the box.
		const maxEnvLen = Math.max(...envLines.map((l) => l.length));
		const envLeft = Math.max(0, Math.floor((W - maxEnvLen) / 2));

		for (const el of envLines) {
			lines.push(row(" ".repeat(envLeft) + dim(el), envLeft + el.length));
		}
	}

	lines.push(empty(), bot, "");
	return lines.join("\n");
}

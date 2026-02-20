import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
	".txt": "text/plain",
	".csv": "text/csv",
	".json": "application/json",
	".md": "text/markdown",
	".doc": "application/msword",
	".docx":
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls": "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function fileToAttachment(filePath: string) {
	const resolved = resolve(filePath);
	const ext = extname(resolved).toLowerCase();
	const mime = MIME_TYPES[ext];
	if (!mime) {
		console.error(
			`Unsupported file type: ${ext}\nSupported: ${Object.keys(MIME_TYPES).join(", ")}`,
		);
		process.exit(1);
	}
	const buffer = readFileSync(resolved);
	const base64 = buffer.toString("base64");
	return {
		name: basename(resolved),
		mime,
		contentString: `data:${mime};base64,${base64}`,
	};
}

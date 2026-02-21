import type { Command } from "commander";
import { setupHandler } from "./handler";

export function registerSetupCommand(program: Command) {
	program
		.command("setup")
		.alias("s")
		.description("Configure the AnythingLLM CLI settings")
		.action(setupHandler);
}

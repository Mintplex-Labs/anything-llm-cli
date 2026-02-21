import type { Command } from "commander";
import { setupHandler } from "./handler";

export function registerSetupCommand(program: Command) {
	program
		.command("setup")
		.alias("s")
		.description("Setup the connection to your AnythingLLM instance")
		.action(setupHandler);
}

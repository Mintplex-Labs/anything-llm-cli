import { program } from "commander";
import packageJson from "../../package.json";
import { registerPromptCommand } from "./subcommands/prompt";
import { registerSetupCommand } from "./subcommands/setup";
import { buildBanner } from "./utils/banner";

program
	.name("any")
	.description("A simple CLI tool to interact with AnythingLLM")
	.version(packageJson.version)
	.addHelpText("before", await buildBanner());

if (process.platform !== "win32") {
	registerSetupCommand(program);
}
registerPromptCommand(program);

export { program };

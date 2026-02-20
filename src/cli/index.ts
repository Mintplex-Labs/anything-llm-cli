import { program } from "commander";
import packageJson from "../../package.json";
import { registerPromptCommand } from "./subcommands/prompt";
import { buildBanner } from "./utils/banner";

program
	.name("any")
	.description("A simple CLI tool to interact with AnythingLLM")
	.version(packageJson.version)
	.addHelpText("before", buildBanner());

registerPromptCommand(program);

export { program };

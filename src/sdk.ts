export class AnythingLLM {
	private apiKey: string = process.env.ANYTHINGLLM_API_KEY || "";
	private baseUrl: URL = new URL("http://localhost:3001");

	private streamResponse(
		endpoint: string,
		body: Record<string, unknown>,
	): AsyncIterable<AnythingLLM.StreamChunk> {
		const self = this;
		return {
			[Symbol.asyncIterator]() {
				return (async function* () {
					const url = new URL(endpoint, self.baseUrl);
					const res = await fetch(url.href, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${self.apiKey}`,
						},
						body: JSON.stringify(body),
					});

					if (!res.ok || !res.body) {
						throw new Error(`Stream request failed with status ${res.status}`);
					}

					const decoder = new TextDecoder();
					let buffer = "";

					for await (const raw of res.body as unknown as AsyncIterable<Uint8Array>) {
						buffer += decoder.decode(raw, { stream: true });
						const parts = buffer.split("\n\n");
						buffer = parts.pop() || ""; // Keep the last part in the buffer (it may be incomplete)

						for (const part of parts) {
							const line = part.trim();
							if (!line.startsWith("data:")) continue;
							const json = JSON.parse(line.slice("data:".length).trim());
							yield json as AnythingLLM.StreamChunk;
						}
					}
				})();
			},
		};
	}

	private async callApi<Data>(
		endpoint: string,
		options: {
			method?: string;
			body?: Record<string, unknown>;
		} = {},
	): Promise<AnythingLLM.Result<Data>> {
		try {
			const url = new URL(endpoint, this.baseUrl);
			const res = await fetch(url.href, {
				method: options.method || "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: options.body ? JSON.stringify(options.body) : undefined,
			});

			if (!res.ok) {
				const errorText = await res.text();
				throw new Error(
					`API request failed with status ${res.status}: ${errorText}`,
				);
			}

			const data = await res.json();

			return {
				ok: true,
				data: data as Data,
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	admin = {};
	documents = {};
	systemSettings = {};
	embeds = {};
	workspaces = {
		/**
		 * Create a new workspace.
		 *
		 * @example
		 * ```ts
		 * const result = await client.workspaces.create({ name: "My Workspace" });
		 * if (result.ok) console.log(result.data.workspace.slug);
		 * ```
		 */
		create: async (params: {
			/** Name of the workspace */
			name: string;
			/** Similarity threshold for vector search (0-1) */
			similarityThreshold?: number;
			/** LLM temperature for responses */
			temperature?: number;
			/** Number of previous messages to include as context */
			historyMessageCount?: number;
			/** System prompt for the workspace */
			systemPrompt?: string;
			/** Response when a query finds no relevant documents */
			queryRefusalResponse?: string;
			/** `"chat"` for open conversation, `"query"` for document Q&A */
			mode?: "chat" | "query";
			/** Number of top similar documents to retrieve */
			topN?: number;
		}) => {
			return this.callApi<{
				workspace: AnythingLLM.Workspace;
			}>("api/v1/workspace/new", {
				method: "POST",
				body: {
					...params,
					openAiTemp: params.temperature,
					openAiHistory: params.historyMessageCount,
					openAiPrompt: params.systemPrompt,
					chatMode: params.mode,
				},
			});
		},
		/**
		 * List all available workspaces.
		 *
		 * @example
		 * ```ts
		 * const result = await client.workspaces.list();
		 * if (result.ok) result.data.workspaces.forEach(ws => console.log(ws.name));
		 * ```
		 */
		list: async () => {
			return this.callApi<{
				workspaces: AnythingLLM.Workspace[];
			}>("api/v1/workspaces");
		},
		/**
		 * Get a workspace by its slug.
		 *
		 * @example
		 * ```ts
		 * const result = await client.workspaces.get({ slug: "my-workspace" });
		 * ```
		 */
		get: async (params: {
			/** The slug of the workspace */
			slug: string;
		}) => {
			return this.callApi<{ workspace: AnythingLLM.Workspace[] }>(
				`api/v1/workspace/${params.slug}`,
			);
		},
		/**
		 * Send a chat message to a workspace and get a complete response.
		 *
		 * @example
		 * ```ts
		 * const result = await client.workspaces.chat({
		 *   slug: "my-workspace",
		 *   message: "What is AnythingLLM?",
		 *   mode: "chat",
		 * });
		 * ```
		 */
		chat: async (params: {
			/** The slug of the workspace to chat with */
			slug: string;
			/** The message to send to the workspace */
			message: string;
			/** `"chat"` for open conversation, `"query"` for document Q&A. Defaults to `"chat"`. */
			mode?: "chat" | "query";

			/** Optional attachments to include with the message
			 *
			 * Each attachment should include a name, MIME type, and content string (e.g. a data URI for files).
			 * Attachments can be used to provide additional context to the model, such as images or documents relevant to the conversation.
			 * @example
			 * ```ts
			 * const png = Bun.file("./image.png");
			 * const buffer = Buffer.from(await png.arrayBuffer());
			 * const base64 = buffer.toString("base64");
			 * const dataUri = `data:${png.type};base64,${base64}`;
			 *
			 * const result = await client.workspaces.chat({
			 *   slug: "my-workspace",
			 *   message: "What is in this image?",
			 *   attachments: [
			 *     {
			 *       name: "image.png",
			 *       mime: png.type,
			 *       contentString: dataUri,
			 *     },
			 *   ],
			 * });
			 * */
			attachments?: AnythingLLM.Attachment[];
		}): Promise<AnythingLLM.Result<AnythingLLM.ChatResponse>> => {
			return this.callApi(`api/v1/workspace/${params.slug}/chat`, {
				method: "POST",
				body: {
					message: params.message,
					mode: params.mode ?? "chat",
					attachments: params.attachments,
				},
			});
		},
		/**
		 * Send a chat message and stream the response as SSE chunks.
		 *
		 * @example
		 * ```ts
		 * const stream = client.workspaces.streamChat({
		 *   slug: "my-workspace",
		 *   message: "Hello!",
		 *   mode: "chat",
		 * });
		 * for await (const chunk of stream) {
		 *   if (chunk.type === "textResponseChunk") process.stdout.write(chunk.textResponse);
		 * }
		 * ```
		 */
		streamChat: (params: {
			slug: string;
			message: string;
			/** `"chat"` for open conversation, `"query"` for document Q&A. Defaults to `"chat"`. */
			mode?: "chat" | "query";
			/** Optional attachments to include with the message
			 *
			 * Each attachment should include a name, MIME type, and content string (e.g. a data URI for files).
			 * Attachments can be used to provide additional context to the model, such as images or documents relevant to the conversation.
			 * @example
			 * ```ts
			 * const png = Bun.file("./image.png");
			 * const buffer = Buffer.from(await png.arrayBuffer());
			 * const base64 = buffer.toString("base64");
			 * const dataUri = `data:${png.type};base64,${base64}`;
			 *
			 * const stream = client.workspaces.streamChat({
			 *   slug: "my-workspace",
			 *   message: "What is in this image?",
			 *   attachments: [
			 *     {
			 *       name: "image.png",
			 *       mime: png.type,
			 *       contentString: dataUri,
			 *     },
			 *   ],
			 * });
			 * */
			attachments?: AnythingLLM.Attachment[];
		}): AsyncIterable<AnythingLLM.StreamChunk> => {
			return this.streamResponse(
				`api/v1/workspace/${params.slug}/stream-chat`,
				{
					message: params.message,
					mode: params.mode ?? "chat",
					attachments: params.attachments,
				},
			);
		},
	};
	threads = {
		/**
		 * Create a new thread within a workspace.
		 *
		 * @example
		 * ```ts
		 * const result = await client.threads.create({
		 *   workspaceSlug: "my-workspace",
		 *   title: "New conversation",
		 * });
		 * if (result.ok) console.log(result.data.thread.slug);
		 * ```
		 */
		create: async (params: {
			workspaceSlug: string;
			title: string;
			slug?: string;
			userId?: number;
		}) => {
			return this.callApi<{
				thread: AnythingLLM.Thread;
			}>(`api/v1/workspace/${params.workspaceSlug}/thread/new`, {
				method: "POST",
				body: {
					...params,
					name: params.title,
				},
			});
		},
		/**
		 * Send a message to a thread and get a complete response.
		 *
		 * @example
		 * ```ts
		 * const result = await client.threads.chat({
		 *   workspaceSlug: "my-workspace",
		 *   threadSlug: "thread-abc",
		 *   message: "What is AnythingLLM?",
		 *   mode: "chat",
		 * });
		 * ```
		 * if (result.ok) {
		 *   console.log("Response:", result.data.textResponse);
		 * }
		 */
		chat: async (params: {
			workspaceSlug: string;
			threadSlug: string;
			message: string;
			/** Optional attachments to include with the message
			 *
			 * Each attachment should include a name, MIME type, and content string (e.g. a data URI for files).
			 * Attachments can be used to provide additional context to the model, such as images or documents relevant to the conversation.
			 *
			 * @example
			 *
			 * ```ts
			 * const png = Bun.file("./image.png");
			 * const buffer = Buffer.from(await png.arrayBuffer());
			 * const base64 = buffer.toString("base64");
			 * const dataUri = `data:${png.type};base64,${base64}`;
			 *
			 * const result = await client.threads.chat({
			 *  workspaceSlug: "my-workspace",
			 *  threadSlug: "thread-abc",
			 *  message: "What is in this image?",
			 *  attachments: [
			 *   {
			 *    name: "image.png",
			 *    mime: png.type,
			 *    contentString: dataUri,
			 *   },
			 *  ],
			 * });
			 *
			 * ```
			 *
			 * */
			attachments?: AnythingLLM.Attachment[];
			/** `"chat"` for open conversation, `"query"` for document Q&A. Defaults to `"chat"`. */
			mode?: "chat" | "query";
		}): Promise<AnythingLLM.Result<AnythingLLM.ChatResponse>> => {
			return this.callApi(
				`api/v1/workspace/${params.workspaceSlug}/thread/${params.threadSlug}/chat`,
				{
					method: "POST",
					body: {
						message: params.message,
						mode: params.mode ?? "chat",
						attachments: params.attachments,
					},
				},
			);
		},
		/**
		 * Send a message to a thread and stream the response as SSE chunks.
		 *
		 * @example
		 * ```ts
		 * const stream = client.threads.streamChat({
		 *   workspaceSlug: "my-workspace",
		 *   threadSlug: "thread-abc",
		 *   message: "Hello!",
		 *   mode: "chat",
		 * });
		 * for await (const chunk of stream) {
		 *   if (chunk.type === "textResponseChunk") process.stdout.write(chunk.textResponse);
		 * }
		 * ```
		 */
		streamChat: (params: {
			workspaceSlug: string;
			threadSlug: string;
			message: string;
			attachments?: AnythingLLM.Attachment[];
			/** `"chat"` for open conversation, `"query"` for document Q&A. Defaults to `"chat"`. */
			mode?: "chat" | "query";
		}): AsyncIterable<AnythingLLM.StreamChunk> => {
			return this.streamResponse(
				`api/v1/workspace/${params.workspaceSlug}/thread/${params.threadSlug}/stream-chat`,
				{
					message: params.message,
					mode: params.mode ?? "chat",
					attachments: params.attachments,
				},
			);
		},
		/**
		 * Get chat message history for a workspace or a specific thread.
		 * If `threadSlug` is omitted, returns messages from the workspace's default chat.
		 *
		 * @example
		 * ```ts
		 * // Get thread messages
		 * const result = await client.threads.getMessages({
		 *   workspaceSlug: "my-workspace",
		 *   threadSlug: "thread-abc",
		 * });
		 * if (result.ok) console.log(result.data.history);
		 * ```
		 */
		getMessages: async (params: {
			workspaceSlug: string;
			threadSlug?: string;
		}) => {
			const endpoint = params.threadSlug
				? `api/v1/workspace/${params.workspaceSlug}/thread/${params.threadSlug}/chats`
				: `api/v1/workspace/${params.workspaceSlug}/chats`;
			return this.callApi<{
				history: AnythingLLM.ChatMessage[];
			}>(endpoint);
		},
	};
	constructor({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) {
		this.apiKey = apiKey || this.apiKey;
		this.baseUrl = baseUrl ? new URL(baseUrl) : this.baseUrl;
	}
}

declare namespace AnythingLLM {
	type Ok<Data> = {
		ok: true;
		data: Data;
	};

	type Failure = {
		ok: false;
		error: string;
	};

	type Result<Data> = Ok<Data> | Failure;

	type Workspace = {
		id: number;
		name: string;
		slug: string;
		vectorTag: string | null;
		createdAt: string;
		openAiTemp: number;
		openAiHistory: number;
		lastUpdatedAt: string;
		openAiPrompt: string;
		similarityThreshold: number;
		chatProvider: string;
		chatModel: string;
		topN: number;
		chatMode: "chat" | "query";
		pfpFilename: string | null;
		agentProvider: string | null;
		agentModel: string | null;
		queryRefusalResponse: string;
		vectorSearchMode: string;
		documents: Document[];
		threads: { user_id: number | null; slug: string }[];
	};

	type Thread = {
		id: number;
		name: string;
		slug: string;
		workspace_id: number;
		user_id: number;
		createdAt: string;
		lastUpdatedAt: string;
	};

	type BaseMessage = {
		role: "user" | "assistant";
		content: string;
		sentAt: number;
		chatId: number;
	};

	type UserMessage = BaseMessage & {
		role: "user";
		attachments: Attachment[];
	};

	type AssistantMessage = BaseMessage & {
		type: "chat";
		role: "assistant";
		feedbackScore: null;
		metrics: {
			completion_tokens: number;
			prompt_tokens: number;
			total_tokens: number;
			outputTps: number;
			duration: number;
			model: string;
			timestamp: string;
		};
	};

	type ChatMessage = UserMessage | AssistantMessage;

	type Metrics = {
		completion_tokens: number;
		prompt_tokens: number;
		total_tokens: number;
		outputTps: number;
		duration: number;
		model: string;
		timestamp: string;
	};
	type ChatResponse = {
		id: string;
		type: "textResponse";
		close: boolean;
		error: string | null;
		sources: { title: string; chunk: string }[];
		attachments: Attachment[];
		textResponse: string;
		metrics: Metrics;
	};

	type Attachment = {
		name: string;
		mime: string;
		contentString: string;
	};

	type Document = {
		id: number;
		docId: string;
		filename: string;
		docpath: string;
		workspaceId: number;
		metadata: string;
		pinned: boolean;
		watched: boolean;
		createdAt: string;
		lastUpdatedAt: string;
	};

	type BaseStreamChunk = {
		uuid: string;
		type: "textResponseChunk" | "abort" | "finalizeResponseStream";
		close: boolean;
		error: string | null;
		sources: { title: string; chunk: string }[];
		attachments: Attachment[];
	};

	type AbortStreamChunk = BaseStreamChunk & {
		type: "abort";
		textResponse: null;
		close: true;
		error: string;
	};

	type TextResponseStreamChunk = BaseStreamChunk & {
		type: "textResponseChunk";
		textResponse: string;
	};

	type FinalizeResponseStreamChunk = BaseStreamChunk & {
		type: "finalizeResponseStream";
		close: true;
		chatId: number;
		metrics: Metrics;
	};

	type StreamChunk =
		| TextResponseStreamChunk
		| FinalizeResponseStreamChunk
		| AbortStreamChunk
		| AgentStreamChunk;

	type BaseAgentStreamChunk = {
		id: string;
		type: "textResponse" | "agentThought";
		sources: { title: string; chunk: string }[];
		attachments: Attachment[];
	};

	type AgentToolCallInvocationChunk = BaseAgentStreamChunk & {
		type: "textResponse";
		textResponse: ToolCallInvocationData;
	};

	type AgentThoughtChunk = BaseAgentStreamChunk & {
		type: "agentThought";
		thought: string;
	};

	type AgentTextResponseData = {
		uuid: string;
		type: "textResponseChunk";
		content: string;
	};
	type AgentTextResponseChunk = BaseAgentStreamChunk & {
		type: "textResponse";
		textResponse: AgentTextResponseData;
	};

	type AgentFinalizeResponseChunk = BaseAgentStreamChunk & {
		type: "finalizeResponseStream";
		textResponse: string;
		thoughts: string[];
		close: true;
	};

	type AgentStreamChunk =
		| AgentToolCallInvocationChunk
		| AgentThoughtChunk
		| AgentTextResponseChunk
		| AgentFinalizeResponseChunk;

	type ToolCallInvocationData = {
		uuid: string;
		type: "toolCallInvocation";
		content: string;
	};
}

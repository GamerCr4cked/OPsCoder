export type ProviderPreset = {
 id: string;
 name: string;
 mark: string;
 provider: "opencode-zen" | "custom";
 protocol: "opencode-zen" | "openai-chat-completions";
 baseUrl: string;
 defaultModelId: string;
 description: string;
};

export const CUSTOM_PROVIDER: ProviderPreset = {
 id: "custom",
 name: "Custom API",
 mark: "API",
 provider: "custom",
 protocol: "openai-chat-completions",
 baseUrl: "",
 defaultModelId: "",
 description: "Any OpenAI-compatible endpoint"
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
 { id: "opencode-zen", name: "OpenCode Zen", mark: "OZ", provider: "opencode-zen", protocol: "opencode-zen", baseUrl: "", defaultModelId: "", description: "Native OpenCode Zen access with automatic model discovery" },
 { id: "do", name: "DO", mark: "DO", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://inference.do-ai.run/v1", defaultModelId: "anthropic-claude-sonnet-5.5", description: "DigitalOcean Inference with Claude, GPT, Llama and more" },
 { id: "shannon-ai", name: "Shannon AI", mark: "SH", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.shannon-ai.com/v1", defaultModelId: "shannon-3.5", description: "Shannon models through api.shannon-ai.com" },
 { id: "siray-ai", name: "Siray AI", mark: "SY", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.siray.ai/v1", defaultModelId: "openai/gpt-6.2-sol", description: "Uncensored 300+ model catalogue through api.siray.ai" },
 { id: "z-ai", name: "Z.AI", mark: "Z", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.z.ai/api/paas/v4/", defaultModelId: "glm-5.3", description: "GLM models from the Z.AI open platform" },
 { id: "google-ai", name: "Google AI", mark: "G", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", defaultModelId: "gemini-4-hydrogen", description: "Gemini 4 through Google's OpenAI-compatible layer" },
 { id: "open-ai", name: "OpenAI", mark: "OA", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.openai.com/v1", defaultModelId: "gpt-6.2-sol", description: "GPT-6.2 and GPT-6 models from OpenAI" },
 { id: "groq-ai", name: "Groq AI", mark: "GQ", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.groq.com/openai/v1", defaultModelId: "openai/gpt-oss-120b", description: "Fast inference on GroqCloud" },
 { id: "anthropic-ai", name: "Anthropic", mark: "AN", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.anthropic.com/v1/", defaultModelId: "claude-sonnet-5-5", description: "Claude through Anthropic's OpenAI compatibility layer" },
 { id: "together-ai", name: "Together AI", mark: "TG", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.together.xyz/v1", defaultModelId: "openai/gpt-oss-120b", description: "Open-source and frontier models hosted by Together" },
 { id: "perplexity-ai", name: "Perplexity AI", mark: "PX", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.perplexity.ai", defaultModelId: "sonar", description: "Sonar search and reasoning models" },
 { id: "deepseek-ai", name: "DeepSeek AI", mark: "DS", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.deepseek.com", defaultModelId: "deepseek-flash", description: "DeepSeek V4.1 Flash and V4 Pro" },
 { id: "x-ai", name: "X.AI (Grok)", mark: "XA", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.x.ai/v1", defaultModelId: "grok-4.7", description: "Grok 4.7 models from xAI" },
 { id: "mistral-ai", name: "Mistral AI", mark: "MI", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.mistral.ai/v1", defaultModelId: "mistral-large-latest", description: "Mistral and Ministral models" },
 { id: "cohere-ai", name: "Cohere AI", mark: "CO", provider: "custom", protocol: "openai-chat-completions", baseUrl: "https://api.cohere.ai/compatibility/v1", defaultModelId: "command-a-plus-05-2026", description: "Command models through Cohere's compatibility API" }
];

export function providerById(id: string): ProviderPreset {
 if (id === CUSTOM_PROVIDER.id) return CUSTOM_PROVIDER;
 return PROVIDER_PRESETS.find(item => item.id === id) ?? PROVIDER_PRESETS[0];
}

export function providerForConnection(connection: { provider: "opencode-zen" | "custom"; base_url: string | null }): ProviderPreset {
 if (connection.provider === "opencode-zen") return providerById("opencode-zen");
 const base = normalizeBaseUrl(connection.base_url);
 if (!base) return CUSTOM_PROVIDER;
 return PROVIDER_PRESETS.find(item => item.provider === "custom" && normalizeBaseUrl(item.baseUrl) === base) ?? CUSTOM_PROVIDER;
}

function normalizeBaseUrl(value: string | null | undefined) {
 return (value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

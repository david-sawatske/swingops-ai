import { getModelProviderRuntimeConfig } from "../ai/model-provider-runtime-config.js";
import { env } from "./env.js";

const databaseUrl = new URL(env.DATABASE_URL);
const providerConfig = getModelProviderRuntimeConfig();
const configuredProviders = [
  providerConfig.openAiApiKey ? "OpenAI" : null,
  providerConfig.anthropicApiKey ? "Anthropic" : null,
  providerConfig.azureOpenAiApiKey &&
  providerConfig.azureOpenAiEndpoint &&
  providerConfig.azureOpenAiDeployment
    ? "Azure OpenAI"
    : null,
  providerConfig.ollamaBaseUrl ? "Ollama" : null
].filter((provider): provider is string => provider !== null);

console.log("SwingOps API configuration is valid.");
console.log(
  `Database: ${databaseUrl.hostname}:${databaseUrl.port || "5432"}${databaseUrl.pathname}`
);
console.log(`API listener: ${env.API_HOST}:${env.API_PORT}`);
console.log(`Allowed web origin: ${env.WEB_ORIGIN}`);
console.log(
  `Real model calls: ${providerConfig.enableRealModelCalls ? "enabled" : "disabled"}`
);
console.log(
  `Configured providers: ${configuredProviders.join(", ") || "none (deterministic/mock mode)"}`
);

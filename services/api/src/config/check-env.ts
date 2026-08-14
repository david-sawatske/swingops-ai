import { getModelProviderRuntimeConfig } from "../ai/model-provider-runtime-config.js";
import {
  getDatabaseDisplayName,
  resolveTestDatabaseUrl,
} from "./database-urls.js";
import { env } from "./env.js";

const testDatabaseUrl = resolveTestDatabaseUrl(env);
const providerConfig = getModelProviderRuntimeConfig();
const configuredProviders = [
  providerConfig.openAiApiKey ? "OpenAI" : null,
  providerConfig.anthropicApiKey ? "Anthropic" : null,
  providerConfig.azureOpenAiApiKey &&
  providerConfig.azureOpenAiEndpoint &&
  providerConfig.azureOpenAiDeployment
    ? "Azure OpenAI"
    : null,
  providerConfig.ollamaBaseUrl ? "Ollama" : null,
].filter((provider): provider is string => provider !== null);

console.log("SwingOps API configuration is valid.");
console.log(
  `Development database: ${getDatabaseDisplayName(env.DATABASE_URL)}`,
);
console.log(`Test database: ${getDatabaseDisplayName(testDatabaseUrl)}`);
console.log(`API listener: ${env.API_HOST}:${env.API_PORT}`);
console.log(`Allowed web origin: ${env.WEB_ORIGIN}`);
console.log(`Live demo retention: ${env.LIVE_DEMO_RETENTION_DAYS} days`);
console.log(
  `Scheduled Admin Ops maintenance: ${
    env.ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS > 0
      ? `every ${env.ADMIN_OPS_MAINTENANCE_INTERVAL_HOURS} hours`
      : "disabled"
  }`,
);
console.log(
  `Real model calls: ${providerConfig.enableRealModelCalls ? "enabled" : "disabled"}`,
);
console.log(
  `Configured providers: ${configuredProviders.join(", ") || "none (deterministic/mock mode)"}`,
);

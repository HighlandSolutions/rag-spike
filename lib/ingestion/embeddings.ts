/**
 * Embeddings API client
 */

import OpenAI from 'openai';

/**
 * Embeddings configuration
 */
export interface EmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

/**
 * Default embeddings configuration
 */
const DEFAULT_CONFIG: EmbeddingsConfig = {
  model: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
  batchSize: 100, // Process in batches to handle rate limits
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Initialize OpenAI client
 */
const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
  });
};

/**
 * Generate embeddings for a batch of texts
 */
export const generateEmbeddings = async (
  texts: string[],
  config: EmbeddingsConfig = DEFAULT_CONFIG
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const embeddings: number[][] = [];

  // Process in batches to handle rate limits
  for (let i = 0; i < texts.length; i += config.batchSize) {
    const batch = texts.slice(i, i + config.batchSize);
    let retries = 0;
    let success = false;

    while (!success && retries < config.maxRetries) {
      try {
        const response = await client.embeddings.create({
          model: config.model,
          input: batch,
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);
        embeddings.push(...batchEmbeddings);
        success = true;
      } catch (error) {
        retries++;

        if (retries >= config.maxRetries) {
          throw new Error(
            `Failed to generate embeddings after ${config.maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        // Wait before retrying (exponential backoff)
        const delay = config.retryDelay * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return embeddings;
};

/**
 * Generate embedding for a single text
 */
export const generateEmbedding = async (
  text: string,
  config: EmbeddingsConfig = DEFAULT_CONFIG
): Promise<number[]> => {
  const embeddings = await generateEmbeddings([text], config);
  return embeddings[0] || [];
};


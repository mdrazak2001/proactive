import { loadEnvFile } from 'node:process';

export function loadLocalEnvironment(): void {
  const envFile = process.env.BROKER_ENV_FILE?.trim() || '.env.local';

  try {
    loadEnvFile(envFile);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseJwtSecret(raw: string | undefined): string {
  if (!raw) {
    throw new Error("Missing required environment variable: NHOST_JWT_SECRET");
  }

  try {
    const parsed = JSON.parse(raw) as { key?: string };
    if (parsed.key) return parsed.key;
  } catch {
    // Fall through — treat as raw HS256 secret string.
  }

  return raw;
}

export const env = {
  get adminSecret(): string {
    return (
      process.env.NHOST_ADMIN_SECRET ??
      process.env.HASURA_GRAPHQL_ADMIN_SECRET ??
      required("NHOST_ADMIN_SECRET", undefined)
    );
  },

  get jwtSecret(): string {
    return parseJwtSecret(
      process.env.NHOST_JWT_SECRET ?? process.env.HASURA_GRAPHQL_JWT_SECRET
    );
  },

  get graphqlUrl(): string {
    if (process.env.NHOST_GRAPHQL_URL) {
      return process.env.NHOST_GRAPHQL_URL;
    }

    const subdomain = process.env.NHOST_SUBDOMAIN;
    const region = process.env.NHOST_REGION;
    if (subdomain && region) {
      return `https://${subdomain}.hasura.${region}.nhost.run/v1/graphql`;
    }

    throw new Error(
      "Missing GraphQL URL — set NHOST_GRAPHQL_URL or NHOST_SUBDOMAIN + NHOST_REGION"
    );
  },

  get adminApiSecret(): string | undefined {
    return process.env.ADMIN_SECRET;
  },
};

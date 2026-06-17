function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get adminSecret(): string {
    return (
      process.env.NHOST_ADMIN_SECRET ??
      process.env.HASURA_GRAPHQL_ADMIN_SECRET ??
      required("NHOST_ADMIN_SECRET", undefined)
    );
  },

  /** RS256 public key — matches Nhost cloud default JWT setup. */
  get jwtPublicKey(): string {
    return required(
      "NHOST_JWT_PUBLIC_KEY",
      process.env.NHOST_JWT_PUBLIC_KEY
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

import { env } from "./env";

export interface HasuraResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export async function hasuraQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<HasuraResponse<T>> {
  const response = await fetch(env.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": env.adminSecret,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    return {
      errors: [{ message: `Hasura request failed with status ${response.status}` }],
    };
  }

  return (await response.json()) as HasuraResponse<T>;
}

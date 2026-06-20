import { env } from "./env";

export interface HasuraResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export async function hasuraUserQuery<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<HasuraResponse<T>> {
  const response = await fetch(env.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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

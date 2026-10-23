import { queryOptions } from "@tanstack/react-query";
import { accountState } from "./account.functions";
import { ACCESS_STALE_MS } from "./cache-rules";

export const accountQueryOptions = (userId: string) => queryOptions({
  queryKey: ["account-state", userId],
  queryFn: () => accountState(),
  staleTime: ACCESS_STALE_MS,
  retry: false,
});
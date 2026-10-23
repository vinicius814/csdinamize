import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./auth";
import { connectionPresence } from "./conexoes.functions";
export function useConnectionPresence() {
  const { session } = useAuth();
  const read = useServerFn(connectionPresence);
  return useQuery({ queryKey: ["connection-presence",session?.user.id], queryFn: () => read(), enabled: !!session });
}
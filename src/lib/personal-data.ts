import {useQuery} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {useAuth} from "./auth";
import {personalOverview} from "./personal.functions";
export function usePersonal(){const {session}=useAuth();const read=useServerFn(personalOverview);return useQuery({queryKey:["personal",session?.user.id],queryFn:()=>read(),enabled:!!session});}
import { createFileRoute } from "@tanstack/react-router";
// Disabled: the Telegram bot is operated by Make, which calls /api/public/telegram/ingest.
const gone=()=>new Response("Gone",{status:410});
export const Route=createFileRoute("/api/public/telegram/webhook")({server:{handlers:{GET:gone,POST:gone}}});

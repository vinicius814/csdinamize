import {describe,it,expect} from "vitest";
import {briefingDue,retryTranscription,TRANSCRIPTION_ATTEMPTS} from "@/lib/telegram-rules";
describe("Telegram",()=>{
  it("limita a transcrição a três tentativas e não repete recusas",()=>{expect(TRANSCRIPTION_ATTEMPTS).toBe(3);expect(retryTranscription(503,2)).toBe(true);expect(retryTranscription(503,3)).toBe(false);expect(retryTranscription(403,1)).toBe(false);});
  it("respeita horário e fuso do usuário",()=>{expect(briefingDue(new Date("2026-10-23T10:29:00Z"),"America/Sao_Paulo","07:30:00")).toEqual({date:"2026-10-23",due:false});expect(briefingDue(new Date("2026-10-23T10:30:00Z"),"America/Sao_Paulo","07:30:00")).toEqual({date:"2026-10-23",due:true});});
});
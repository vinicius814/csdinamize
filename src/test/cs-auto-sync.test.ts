import { describe, it, expect } from "vitest";
import { csPrecisaAtualizar, csUltimoHorario } from "@/lib/cs-rules";
describe("atualização automática por acesso (08h e 12h SP)", () => {
 it("às 07h SP o último horário é 12h SP de ontem", () => { expect(csUltimoHorario(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-23T15:00:00.000Z"); });
 it("às 09h SP atualiza se a última tentativa foi antes das 08h", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T12:00:00Z"),"2026-10-24T10:59:00Z")).toBe(true); });
 it("não repete se já houve tentativa após as 08h", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T14:00:00Z"),"2026-10-24T11:05:00Z")).toBe(false); });
 it("às 12h30 SP atualiza de novo", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T15:30:00Z"),"2026-10-24T11:05:00Z")).toBe(true); });
});

import { Link } from "@tanstack/react-router";
import { Marca } from "@/components/dcs/Marca";

/** Termos e privacidade do Dinamize CS (texto provisório, sujeito à revisão jurídica). */
export function LegalPage({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="min-h-dvh bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8 shadow-[var(--glow-sm)]">
        <Link to="/auth" aria-label="Voltar para o login">
          <Marca sub="Diagnóstico e inteligência de contas" />
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">{privacy ? "Política de Privacidade" : "Termos de Uso"}</h1>
        <p className="my-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Texto provisório — versão de novembro de 2026, sujeito à revisão jurídica antes do uso definitivo.
        </p>
        <div className="space-y-6 text-sm leading-7 text-muted-foreground">
          {privacy ? (
            <>
              <section>
                <h2 className="font-semibold text-foreground">Dados e finalidade</h2>
                <p>
                  O Dinamize CS trata dados de contas de clientes da Dinamize (carteira, valores e atividades lidos do Pipedrive), diagnósticos,
                  planos de ação e registros de uso dos colaboradores autorizados, com a finalidade de apoiar a operação de Customer Success.
                </p>
              </section>
              <section>
                <h2 className="font-semibold text-foreground">Acesso e controle</h2>
                <p>
                  Cada colaborador vê apenas as carteiras e os clientes atribuídos pelo administrador. Valores financeiros só aparecem para quem tem
                  permissão específica. As permissões são aplicadas pelo banco de dados, e credenciais de integração não ficam expostas na aplicação.
                </p>
              </section>
              <section>
                <h2 className="font-semibold text-foreground">Direitos e retenção</h2>
                <p>
                  O titular pode solicitar acesso, correção e exclusão de seus dados conforme a legislação aplicável. Prazos de retenção, responsáveis
                  pelo tratamento, canal de contato e fornecedores devem ser definidos na revisão desta política.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="font-semibold text-foreground">Uso corporativo</h2>
                <p>
                  O Dinamize CS é uma ferramenta interna da Dinamize para diagnóstico e acompanhamento de contas. O acesso é pessoal, depende de
                  aprovação de um administrador e deve ser usado apenas para fins profissionais.
                </p>
              </section>
              <section>
                <h2 className="font-semibold text-foreground">Informações e integrações</h2>
                <p>
                  Os dados vêm do Pipedrive e de registros feitos pela equipe. Integrações dependem de serviços de terceiros e podem ficar
                  temporariamente indisponíveis. Nenhuma gravação é feita no Pipedrive sem autorização expressa.
                </p>
              </section>
              <section>
                <h2 className="font-semibold text-foreground">Acesso e responsabilidade</h2>
                <p>
                  Contas podem ser suspensas por uso indevido ou desligamento. O usuário é responsável pela segurança das suas credenciais. Condições
                  adicionais devem ser definidas na revisão destes termos.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

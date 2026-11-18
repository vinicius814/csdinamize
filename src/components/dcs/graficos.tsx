import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Barras agrupadas por semana (paleta validada: #3B82F6 / #EA5456). Uma escala, grade discreta, tooltip. */
export function BarrasSemanais<K extends string>({
  dados,
  series,
  altura = 240,
}: {
  dados: ({ semana: string } & Record<K, number>)[];
  series: { chave: K; rotulo: string; cor: string }[];
  altura?: number;
}) {
  const fmt = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return (
    <div style={{ height: altura }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dados}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          barGap={2}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="semana"
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#F3F4F6" }}
            labelFormatter={(s) => `Semana de ${fmt(String(s))}`}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 12,
              boxShadow: "0 4px 12px rgb(16 24 40 / .08)",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#3D3D3B" }}
          />
          {series.map((s) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              name={s.rotulo}
              fill={s.cor}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lista de barras horizontais com rótulo e valor (para rankings; texto sempre em cor de texto). */
export function Ranking({
  itens,
  cor = "bg-primary",
  sufixo,
}: {
  itens: {
    id: string;
    rotulo: string;
    valor: number;
    total?: number | undefined;
    detalhe?: string | undefined;
    onClick?: (() => void) | undefined;
  }[];
  cor?: string;
  sufixo?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.total ?? i.valor));
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => {
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{i.rotulo}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {i.valor}
                {i.total != null ? ` de ${i.total}` : ""}
                {sufixo}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${cor}`}
                style={{ width: `${Math.round((100 * i.valor) / max)}%` }}
              />
            </div>
            {i.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{i.detalhe}</p>}
          </>
        );
        return (
          <li key={i.id}>
            {i.onClick ? (
              <button
                type="button"
                onClick={i.onClick}
                className="block w-full rounded-md text-left hover:bg-surface-2"
              >
                {conteudo}
              </button>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
    </ul>
  );
}

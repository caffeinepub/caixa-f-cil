import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/contexts/AppContext";
import { endOfDay, formatDate, formatMZN, startOfDay } from "@/lib/db";
import { Download, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

type Periodo = "hoje" | "ontem" | "7dias" | "30dias" | "personalizado";

export function RelatoriosScreen() {
  const { vendas, produtos } = useData();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { start, end } = useMemo(() => {
    const now = new Date();
    switch (periodo) {
      case "hoje":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "ontem": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { start: startOfDay(y), end: endOfDay(y) };
      }
      case "7dias": {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        return { start: startOfDay(d), end: endOfDay(now) };
      }
      case "30dias": {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        return { start: startOfDay(d), end: endOfDay(now) };
      }
      case "personalizado": {
        const s = dataInicio ? new Date(dataInicio).getTime() : 0;
        const e = dataFim ? endOfDay(new Date(dataFim)) : Date.now();
        return { start: s, end: e };
      }
    }
  }, [periodo, dataInicio, dataFim]);

  const filteredVendas = useMemo(
    () => vendas.filter((v) => v.dataHora >= start && v.dataHora <= end),
    [vendas, start, end],
  );

  const stats = useMemo(() => {
    const totalVendido = filteredVendas.reduce((s, v) => s + v.total, 0);

    let totalCusto = 0;
    for (const venda of filteredVendas) {
      for (const item of venda.itens) {
        const p = produtos.find((pr) => pr.id === item.produtoId);
        if (p) totalCusto += p.precoCusto * item.quantidade;
      }
    }

    const lucro = totalVendido - totalCusto;

    // By payment method
    const porMetodo = {
      dinheiro: 0,
      mpesa: 0,
      emola: 0,
      outro: 0,
    };
    for (const v of filteredVendas) {
      porMetodo[v.metodoPagamento] =
        (porMetodo[v.metodoPagamento] ?? 0) + v.total;
    }

    // Top products
    const prodMap = new Map<
      number,
      { nome: string; qty: number; total: number }
    >();
    for (const venda of filteredVendas) {
      for (const item of venda.itens) {
        const existing = prodMap.get(item.produtoId);
        if (existing) {
          existing.qty += item.quantidade;
          existing.total += item.preco * item.quantidade;
        } else {
          prodMap.set(item.produtoId, {
            nome: item.nomeProduto,
            qty: item.quantidade,
            total: item.preco * item.quantidade,
          });
        }
      }
    }
    const topProdutos = Array.from(prodMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // By employee
    const funcMap = new Map<
      string,
      { nome: string; total: number; count: number }
    >();
    for (const venda of filteredVendas) {
      const key = venda.nomeFuncionario;
      const existing = funcMap.get(key);
      if (existing) {
        existing.total += venda.total;
        existing.count++;
      } else {
        funcMap.set(key, { nome: key, total: venda.total, count: 1 });
      }
    }
    const porFuncionario = Array.from(funcMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    return { totalVendido, lucro, porMetodo, topProdutos, porFuncionario };
  }, [filteredVendas, produtos]);

  function exportarCSV() {
    const headers = [
      "Data/Hora",
      "Funcionário",
      "Total (MZN)",
      "Desconto (MZN)",
      "Pagamento",
      "Itens",
    ];
    const rows = filteredVendas.map((v) => [
      formatDate(v.dataHora),
      v.nomeFuncionario,
      (v.total / 100).toFixed(2),
      (v.desconto / 100).toFixed(2),
      v.metodoPagamento,
      v.itens.map((i) => `${i.nomeProduto}(${i.quantidade})`).join(";"),
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${periodo}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodos: { key: Periodo; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7dias", label: "7 Dias" },
    { key: "30dias", label: "30 Dias" },
    { key: "personalizado", label: "Personalizado" },
  ];

  const metodoLabels: Record<string, string> = {
    dinheiro: "Dinheiro",
    mpesa: "M-Pesa",
    emola: "e-Mola",
    outro: "Outro",
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {/* Period Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {periodos.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriodo(p.key)}
            className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              periodo === p.key
                ? "bg-amber text-background font-bold"
                : "bg-card border border-border text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {periodo === "personalizado" && (
        <div className="grid grid-cols-2 gap-3 bg-card border border-border rounded-xl p-3">
          <div>
            <Label htmlFor="data-inicio" className="text-xs">
              De
            </Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="data-fim" className="text-xs">
              Até
            </Label>
            <Input
              id="data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-amber" />
            <span className="text-muted-foreground text-xs">Total Vendido</span>
          </div>
          <p className="font-display text-3xl font-black text-foreground">
            {formatMZN(stats.totalVendido)}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {filteredVendas.length} venda
            {filteredVendas.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-success" />
            <span className="text-muted-foreground text-xs">Lucro Est.</span>
          </div>
          <p
            className={`font-display text-xl font-black ${stats.lucro >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatMZN(stats.lucro)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingCart size={12} className="text-muted-foreground" />
            <span className="text-muted-foreground text-xs">Vendas</span>
          </div>
          <p className="font-display text-xl font-black text-foreground">
            {filteredVendas.length}
          </p>
        </div>
      </div>

      {/* Payment methods */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Por Método de Pagamento
        </h3>
        <div className="flex flex-col gap-2">
          {Object.entries(stats.porMetodo).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-foreground text-sm">
                {metodoLabels[key]}
              </span>
              <span className="font-medium text-foreground text-sm">
                {formatMZN(val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      {stats.topProdutos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top 10 Produtos
          </h3>
          <div className="flex flex-col gap-2">
            {stats.topProdutos.map((p, i) => (
              <div key={p.nome} className="flex items-center gap-3">
                <span
                  className={`font-display text-base font-black w-5 text-center ${i === 0 ? "text-amber" : "text-muted-foreground"}`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-foreground text-sm truncate">
                  {p.nome}
                </span>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {formatMZN(p.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.qty} un.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Employee */}
      {stats.porFuncionario.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Por Funcionário
          </h3>
          <div className="flex flex-col gap-2">
            {stats.porFuncionario.map((f) => (
              <div key={f.nome} className="flex justify-between items-center">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {f.nome}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {f.count} venda{f.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="font-medium text-foreground text-sm">
                  {formatMZN(f.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 gap-2"
        onClick={exportarCSV}
      >
        <Download size={16} />
        Exportar CSV
      </Button>
    </div>
  );
}

import { useAuth, useData } from "@/contexts/AppContext";
import { endOfDay, formatMZN, startOfDay } from "@/lib/db";
import {
  AlertTriangle,
  BarChart2,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

export function DashboardScreen({ onNavigate }: DashboardProps) {
  const { currentUser } = useAuth();
  const { produtos, vendas, config } = useData();

  const todayStats = useMemo(() => {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);

    const todayVendas = vendas.filter(
      (v) => v.dataHora >= start && v.dataHora <= end,
    );

    const totalVendido = todayVendas.reduce((sum, v) => sum + v.total, 0);
    const totalDesconto = todayVendas.reduce((sum, v) => sum + v.desconto, 0);

    // Compute profit
    let totalCusto = 0;
    for (const venda of todayVendas) {
      for (const item of venda.itens) {
        const produto = produtos.find((p) => p.id === item.produtoId);
        if (produto) {
          totalCusto += produto.precoCusto * item.quantidade;
        }
      }
    }
    const lucroEstimado = totalVendido - totalCusto;

    // Top products
    const produtoMap = new Map<
      number,
      { nome: string; quantidade: number; total: number }
    >();
    for (const venda of todayVendas) {
      for (const item of venda.itens) {
        const existing = produtoMap.get(item.produtoId);
        if (existing) {
          existing.quantidade += item.quantidade;
          existing.total += item.preco * item.quantidade;
        } else {
          produtoMap.set(item.produtoId, {
            nome: item.nomeProduto,
            quantidade: item.quantidade,
            total: item.preco * item.quantidade,
          });
        }
      }
    }
    const topProdutos = Array.from(produtoMap.entries())
      .sort((a, b) => b[1].quantidade - a[1].quantidade)
      .slice(0, 3)
      .map(([, v]) => v);

    return {
      totalVendido,
      totalDesconto,
      lucroEstimado,
      numVendas: todayVendas.length,
      topProdutos,
    };
  }, [vendas, produtos]);

  const lowStockItems = useMemo(
    () => produtos.filter((p) => p.stockAtual <= p.stockMinimo),
    [produtos],
  );

  const nomePrimeiro = currentUser?.nome.split(" ")[0] ?? "Admin";

  const quickActions = [
    {
      label: "Nova Venda",
      icon: ShoppingCart,
      screen: "venda",
      color: "bg-amber text-background",
      primary: true,
    },
    {
      label: "Produtos & Stock",
      icon: Package,
      screen: "produtos",
      color: "bg-card border border-border text-foreground",
      primary: false,
    },
    {
      label: "Relatórios",
      icon: BarChart2,
      screen: "relatorios",
      color: "bg-card border border-border text-foreground",
      primary: false,
    },
    {
      label: "Funcionários",
      icon: Users,
      screen: "funcionarios",
      color: "bg-card border border-border text-foreground",
      primary: false,
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <p className="text-muted-foreground text-sm">
            Olá, {nomePrimeiro} 👋
          </p>
          <h1 className="font-display text-3xl font-black text-foreground mt-0.5">
            {config?.nomeNegocio ?? "Caixa Fácil"}
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("pt-MZ", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </span>
          {lowStockItems.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("produtos")}
              className="mt-1 flex items-center gap-1 bg-destructive/10 text-destructive text-xs px-2 py-1 rounded-full font-medium"
            >
              <AlertTriangle size={10} />
              {lowStockItems.length} stock baixo
            </button>
          )}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-amber" />
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Vendas de Hoje
            </span>
          </div>
          <p className="font-display text-4xl font-black text-foreground">
            {formatMZN(todayStats.totalVendido)}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {todayStats.numVendas} venda{todayStats.numVendas !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-success" />
            <span className="text-muted-foreground text-xs font-medium">
              Lucro Est.
            </span>
          </div>
          <p
            className={`font-display text-2xl font-black ${todayStats.lucroEstimado >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatMZN(todayStats.lucroEstimado)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle
              size={13}
              className={
                lowStockItems.length > 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            />
            <span className="text-muted-foreground text-xs font-medium">
              Stock Baixo
            </span>
          </div>
          <p
            className={`font-display text-2xl font-black ${lowStockItems.length > 0 ? "text-destructive" : "text-foreground"}`}
          >
            {lowStockItems.length}
          </p>
        </div>
      </div>

      {/* Top Products */}
      {todayStats.topProdutos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Mais Vendidos Hoje
          </h3>
          <div className="flex flex-col gap-2">
            {todayStats.topProdutos.map((p, i) => (
              <div key={p.nome} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`font-display text-lg font-black w-6 text-center ${
                      i === 0 ? "text-amber" : "text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {p.nome}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">
                    {p.quantidade}× · {formatMZN(p.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.screen}
              type="button"
              onClick={() => onNavigate(action.screen)}
              className={`${action.color} rounded-xl p-4 flex flex-col items-start gap-3 h-24 active:opacity-80 transition-opacity shadow-card hover:shadow-card-hover`}
            >
              <action.icon size={22} />
              <span
                className={`font-display text-lg font-bold leading-tight ${action.primary ? "text-background" : ""}`}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

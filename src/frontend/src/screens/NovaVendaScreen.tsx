import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useData } from "@/contexts/AppContext";
import type { ProdutoDB } from "@/lib/db";
import { displayToCentavos, formatMZN } from "@/lib/db";
import {
  CheckCircle,
  Copy,
  Minus,
  Package,
  Plus,
  Share2,
  ShoppingCart,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type MetodoPagamento = "dinheiro" | "mpesa" | "emola" | "outro";

interface CartItem {
  produto: ProdutoDB;
  quantidade: number;
}

interface NovaVendaProps {
  onNavigate: (screen: string) => void;
}

type ViewState = "pos" | "cart" | "success";

export function NovaVendaScreen({ onNavigate: _onNavigate }: NovaVendaProps) {
  const { produtos, addVendaAction, config } = useData();
  const { currentUser } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [metodoPagamento, setMetodoPagamento] =
    useState<MetodoPagamento>("dinheiro");
  const [desconto, setDesconto] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<
    "todos" | "bebida" | "comida" | "outros"
  >("todos");
  const [view, setView] = useState<ViewState>("pos");
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [ultimaVendaRecibo, setUltimaVendaRecibo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const produtosFiltrados = useMemo(() => {
    let filtered = produtos.filter((p) => p.ativo && p.stockAtual > 0);
    if (categoriaFiltro !== "todos") {
      filtered = filtered.filter((p) => p.categoria === categoriaFiltro);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.nome.toLowerCase().includes(q));
    }
    return filtered;
  }, [produtos, categoriaFiltro, searchQuery]);

  const descontoCentavos = useMemo(() => {
    const v = Number.parseFloat(desconto || "0");
    if (Number.isNaN(v) || v < 0) return 0;
    return displayToCentavos(desconto);
  }, [desconto]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.produto.precoVenda * item.quantidade,
        0,
      ),
    [cart],
  );

  const total = useMemo(
    () => Math.max(0, subtotal - descontoCentavos),
    [subtotal, descontoCentavos],
  );

  const totalItems = useMemo(
    () => cart.reduce((s, i) => s + i.quantidade, 0),
    [cart],
  );

  function addToCart(produto: ProdutoDB) {
    setCart((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id);
      if (existing) {
        return prev.map((i) =>
          i.produto.id === produto.id
            ? {
                ...i,
                quantidade: Math.min(i.quantidade + 1, produto.stockAtual),
              }
            : i,
        );
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function updateQty(produtoId: number, delta: number) {
    setCart((prev) => {
      const updated = prev
        .map((i) =>
          i.produto.id === produtoId
            ? { ...i, quantidade: i.quantidade + delta }
            : i,
        )
        .filter((i) => i.quantidade > 0);
      return updated;
    });
  }

  function removeFromCart(produtoId: number) {
    setCart((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  function gerarRecibo(): string {
    const nomeNegocio = config?.nomeNegocio ?? "Caixa Fácil";
    const agora = new Date().toLocaleString("pt-MZ");
    const nomeFunc = currentUser?.nome ?? "—";
    const metodoLabels: Record<MetodoPagamento, string> = {
      dinheiro: "Dinheiro",
      mpesa: "M-Pesa",
      emola: "e-Mola",
      outro: "Outro",
    };

    const linhas = [
      "============================",
      `  ${nomeNegocio.toUpperCase()}`,
      "============================",
      `Data: ${agora}`,
      `Caixa: ${nomeFunc}`,
      "----------------------------",
      ...cart.map(
        (i) =>
          `${i.produto.nome}\n  ${i.quantidade}x ${formatMZN(i.produto.precoVenda)} = ${formatMZN(i.produto.precoVenda * i.quantidade)}`,
      ),
      "----------------------------",
      descontoCentavos > 0 ? `Subtotal: ${formatMZN(subtotal)}` : "",
      descontoCentavos > 0 ? `Desconto: -${formatMZN(descontoCentavos)}` : "",
      `TOTAL: ${formatMZN(total)}`,
      `Pagamento: ${metodoLabels[metodoPagamento]}`,
      "============================",
      "       OBRIGADO!",
      "============================",
    ]
      .filter(Boolean)
      .join("\n");

    return linhas;
  }

  async function finalizarVenda() {
    if (cart.length === 0) return;
    if (!currentUser) return;

    setIsFinalizando(true);
    try {
      await addVendaAction({
        itens: cart.map((i) => ({
          produtoId: i.produto.id,
          nomeProduto: i.produto.nome,
          preco: i.produto.precoVenda,
          quantidade: i.quantidade,
        })),
        total,
        desconto: descontoCentavos,
        metodoPagamento,
        funcionarioId: currentUser.id,
        nomeFuncionario: currentUser.nome,
        dataHora: Date.now(),
        observacoes: "",
      });

      const recibo = gerarRecibo();
      setUltimaVendaRecibo(recibo);
      setView("success");
      toast.success("Venda finalizada com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao finalizar venda.");
    } finally {
      setIsFinalizando(false);
    }
  }

  function resetVenda() {
    setCart([]);
    setDesconto("");
    setMetodoPagamento("dinheiro");
    setView("pos");
    setSearchQuery("");
  }

  async function copiarRecibo() {
    try {
      await navigator.clipboard.writeText(ultimaVendaRecibo);
      toast.success("Recibo copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function partilharRecibo() {
    if (navigator.share) {
      try {
        await navigator.share({ text: ultimaVendaRecibo, title: "Recibo" });
      } catch {
        /* user cancelled */
      }
    } else {
      await copiarRecibo();
    }
  }

  const categorias = [
    { key: "todos" as const, label: "Todos" },
    { key: "bebida" as const, label: "Bebidas" },
    { key: "comida" as const, label: "Comida" },
    { key: "outros" as const, label: "Outros" },
  ];

  const metodosPagamento: { key: MetodoPagamento; label: string }[] = [
    { key: "dinheiro", label: "Dinheiro" },
    { key: "mpesa", label: "M-Pesa" },
    { key: "emola", label: "e-Mola" },
    { key: "outro", label: "Outro" },
  ];

  // ---- SUCCESS VIEW ----
  if (view === "success") {
    return (
      <div className="flex flex-col items-center p-4 gap-5 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mt-6">
          <CheckCircle size={40} className="text-success" />
        </div>
        <div className="text-center">
          <h2 className="font-display text-3xl font-black text-foreground">
            Venda Registada!
          </h2>
          <p className="text-muted-foreground mt-1">
            Total:{" "}
            <span className="text-foreground font-bold">
              {formatMZN(total)}
            </span>
          </p>
        </div>

        {/* Receipt */}
        <div className="w-full bg-card border border-border rounded-xl p-4">
          <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-64">
            {ultimaVendaRecibo}
          </pre>
        </div>

        <div className="flex gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 gap-2"
            onClick={copiarRecibo}
          >
            <Copy size={16} />
            Copiar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 gap-2"
            onClick={partilharRecibo}
          >
            <Share2 size={16} />
            Partilhar
          </Button>
        </div>

        <Button
          type="button"
          className="w-full h-14 bg-amber text-background font-display text-xl font-bold hover:bg-amber-dark"
          onClick={resetVenda}
        >
          Nova Venda
        </Button>
      </div>
    );
  }

  // ---- CART VIEW ----
  if (view === "cart") {
    return (
      <div className="flex flex-col h-full animate-slide-up">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button
            type="button"
            onClick={() => setView("pos")}
            className="text-muted-foreground"
          >
            <X size={22} />
          </button>
          <h2 className="font-display text-2xl font-black text-foreground">
            Carrinho
          </h2>
          <span className="ml-auto text-muted-foreground text-sm">
            {totalItems} iten{totalItems !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <ShoppingCart size={28} />
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.produto.id}
                className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">
                    {item.produto.nome}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatMZN(item.produto.precoVenda)} × {item.quantidade} ={" "}
                    <span className="text-foreground font-medium">
                      {formatMZN(item.produto.precoVenda * item.quantidade)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQty(item.produto.id, -1)}
                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center active:opacity-70"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-display text-lg font-bold w-6 text-center">
                    {item.quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.produto.id, 1)}
                    disabled={item.quantidade >= item.produto.stockAtual}
                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center active:opacity-70 disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.produto.id)}
                    className="w-8 h-8 rounded-lg text-destructive flex items-center justify-center active:opacity-70 ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary & Finalize */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-border bg-card flex flex-col gap-4">
            {/* Discount */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="desconto-input"
                className="text-sm text-muted-foreground whitespace-nowrap w-24"
              >
                Desconto (MZN)
              </label>
              <Input
                id="desconto-input"
                type="number"
                placeholder="0.00"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className="flex-1 h-10"
                min="0"
              />
            </div>

            {/* Payment methods */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Método de Pagamento
              </p>
              <div className="grid grid-cols-4 gap-2">
                {metodosPagamento.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetodoPagamento(m.key)}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                      metodoPagamento === m.key
                        ? "bg-amber text-background font-bold"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-black text-foreground">
                {formatMZN(total)}
              </span>
            </div>

            <Button
              type="button"
              className="w-full h-14 bg-amber text-background font-display text-xl font-bold hover:bg-amber-dark"
              onClick={finalizarVenda}
              disabled={isFinalizando || cart.length === 0}
            >
              {isFinalizando ? "A registar..." : "FINALIZAR VENDA"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ---- POS VIEW ----
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 pb-2">
        <Input
          type="search"
          placeholder="Pesquisar produto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {categorias.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategoriaFiltro(cat.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              categoriaFiltro === cat.key
                ? "bg-amber text-background font-bold"
                : "bg-card border border-border text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4">
        {produtosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <Package size={28} />
            <p className="text-sm">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {produtosFiltrados.map((produto) => {
              const inCart = cart.find((i) => i.produto.id === produto.id);
              const stockBaixo = produto.stockAtual <= produto.stockMinimo;
              return (
                <button
                  key={produto.id}
                  type="button"
                  onClick={() => addToCart(produto)}
                  className={`bg-card border rounded-xl p-3 text-left active:scale-95 transition-transform relative ${
                    inCart ? "border-amber" : "border-border"
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber text-background flex items-center justify-center font-display text-xs font-bold">
                      {inCart.quantidade}
                    </div>
                  )}
                  <div
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${
                      produto.categoria === "bebida"
                        ? "bg-blue-500/10 text-blue-400"
                        : produto.categoria === "comida"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {produto.categoria === "bebida"
                      ? "Bebida"
                      : produto.categoria === "comida"
                        ? "Comida"
                        : "Outro"}
                  </div>
                  <p className="font-medium text-foreground text-sm leading-tight mt-0.5">
                    {produto.nome}
                  </p>
                  <p className="font-display text-lg font-black text-amber mt-1">
                    {formatMZN(produto.precoVenda)}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${stockBaixo ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    Stock: {produto.stockAtual} {produto.unidade}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart button */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={() => setView("cart")}
            className="w-full h-14 bg-amber text-background rounded-xl font-display text-xl font-bold flex items-center justify-between px-5 active:opacity-90 shadow-amber-lg"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={22} />
              <span>
                {totalItems} iten{totalItems !== 1 ? "s" : ""}
              </span>
            </div>
            <span>{formatMZN(subtotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

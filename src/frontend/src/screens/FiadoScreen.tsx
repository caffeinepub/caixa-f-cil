import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/contexts/AppContext";
import type { FiadoDB, ProdutoDB } from "@/lib/db";
import { formatDate, formatMZN } from "@/lib/db";
import { CheckCircle, ChevronDown, ChevronUp, Phone, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface NovoFiadoForm {
  clienteNome: string;
  clienteTelefone: string;
}

interface CartItem {
  produto: ProdutoDB;
  quantidade: number;
}

export function FiadoScreen() {
  const { fiados, produtos, addFiadoAction, updateFiadoAction } = useData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NovoFiadoForm>({
    clienteNome: "",
    clienteTelefone: "",
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPagos, setShowPagos] = useState(false);
  const [settleConfirm, setSettleConfirm] = useState<number | null>(null);

  const pendentes = useMemo(
    () => fiados.filter((f) => f.estado === "pendente"),
    [fiados],
  );
  const pagos = useMemo(
    () =>
      fiados
        .filter((f) => f.estado === "pago")
        .sort((a, b) => (b.dataPagamento ?? 0) - (a.dataPagamento ?? 0))
        .slice(0, 20),
    [fiados],
  );

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.produto.precoVenda * i.quantidade, 0),
    [cart],
  );

  function addToCart(produto: ProdutoDB) {
    setCart((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id);
      if (existing) {
        return prev.map((i) =>
          i.produto.id === produto.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i,
        );
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function removeFromCart(produtoId: number) {
    setCart((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  async function handleSave() {
    if (!form.clienteNome.trim()) {
      toast.error("Nome do cliente é obrigatório.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }

    setIsSaving(true);
    try {
      await addFiadoAction({
        clienteNome: form.clienteNome.trim(),
        clienteTelefone: form.clienteTelefone.trim(),
        itens: cart.map((i) => ({
          produtoId: i.produto.id,
          nomeProduto: i.produto.nome,
          preco: i.produto.precoVenda,
          quantidade: i.quantidade,
        })),
        total,
        data: Date.now(),
        estado: "pendente",
      });
      toast.success("Fiado registado.");
      setDialogOpen(false);
      setForm({ clienteNome: "", clienteTelefone: "" });
      setCart([]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registar fiado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSettle(fiado: FiadoDB) {
    try {
      await updateFiadoAction({
        ...fiado,
        estado: "pago",
        dataPagamento: Date.now(),
      });
      toast.success("Fiado marcado como pago.");
      setSettleConfirm(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao actualizar fiado.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">
        {/* Pendentes */}
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Pendentes ({pendentes.length})
        </h3>

        {pendentes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm mb-4">
            Nenhum fiado pendente 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {pendentes.map((f) => (
              <div
                key={f.id}
                className="bg-card border border-amber/30 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {f.clienteNome}
                    </p>
                    {f.clienteTelefone && (
                      <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                        <Phone size={10} />
                        {f.clienteTelefone}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs mt-1">
                      {formatDate(f.data)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.itens.map((item) => (
                        <span
                          key={`${item.produtoId}-${item.quantidade}`}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full text-foreground"
                        >
                          {item.nomeProduto} ×{item.quantidade}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-black text-amber">
                      {formatMZN(f.total)}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  {settleConfirm === f.id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSettleConfirm(null)}
                        className="flex-1 h-10 rounded-lg bg-muted text-foreground text-sm active:opacity-70"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSettle(f)}
                        className="flex-1 h-10 rounded-lg bg-success text-white text-sm font-bold active:opacity-70"
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSettleConfirm(f.id)}
                      className="w-full h-10 rounded-lg border border-success text-success text-sm font-medium flex items-center justify-center gap-2 active:opacity-70"
                    >
                      <CheckCircle size={16} />
                      Marcar como Pago
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagos (collapsible) */}
        {pagos.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowPagos((v) => !v)}
              className="flex items-center gap-2 w-full text-left mb-3"
            >
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pagos ({pagos.length})
              </h3>
              {showPagos ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </button>

            {showPagos && (
              <div className="flex flex-col gap-3">
                {pagos.map((f) => (
                  <div
                    key={f.id}
                    className="bg-card border border-border rounded-xl p-4 opacity-70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {f.clienteNome}
                        </p>
                        {f.clienteTelefone && (
                          <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            {f.clienteTelefone}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs mt-1">
                          Pago em:{" "}
                          {f.dataPagamento ? formatDate(f.dataPagamento) : "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-xl font-black text-success">
                          {formatMZN(f.total)}
                        </p>
                        <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                          Pago
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-10">
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true);
            setCart([]);
            setForm({ clienteNome: "", clienteTelefone: "" });
          }}
          className="w-14 h-14 rounded-full bg-amber text-background shadow-amber-lg flex items-center justify-center active:opacity-80"
          aria-label="Novo fiado"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg rounded-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Novo Fiado
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fiado-nome">Nome do Cliente</Label>
                <Input
                  id="fiado-nome"
                  value={form.clienteNome}
                  onChange={(e) =>
                    setForm({ ...form, clienteNome: e.target.value })
                  }
                  placeholder="Nome"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="fiado-tel">Telefone</Label>
                <Input
                  id="fiado-tel"
                  value={form.clienteTelefone}
                  onChange={(e) =>
                    setForm({ ...form, clienteTelefone: e.target.value })
                  }
                  placeholder="84x xxx xxx"
                  className="mt-1.5"
                  type="tel"
                />
              </div>
            </div>

            {/* Product grid */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Seleccionar Produtos
              </p>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {produtos.map((p) => {
                  const inCart = cart.find((i) => i.produto.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className={`border rounded-lg p-2 text-left relative active:scale-95 transition-transform ${
                        inCart
                          ? "border-amber bg-amber-light"
                          : "border-border bg-muted"
                      }`}
                    >
                      {inCart && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber text-background flex items-center justify-center font-bold text-[10px]">
                          {inCart.quantidade}
                        </div>
                      )}
                      <p className="text-xs font-medium text-foreground leading-tight truncate">
                        {p.nome}
                      </p>
                      <p className="text-amber text-xs font-bold mt-0.5">
                        {formatMZN(p.precoVenda)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cart summary */}
            {cart.length > 0 && (
              <div className="bg-muted rounded-xl p-3">
                <div className="flex flex-col gap-1.5 mb-2">
                  {cart.map((i) => (
                    <div
                      key={i.produto.id}
                      className="flex justify-between items-center"
                    >
                      <span className="text-foreground text-sm">
                        {i.produto.nome} ×{i.quantidade}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {formatMZN(i.produto.precoVenda * i.quantidade)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(i.produto.id)}
                          className="text-destructive text-xs"
                          aria-label="Remover"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-display font-black text-amber text-lg">
                    {formatMZN(total)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber text-background hover:bg-amber-dark font-bold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "A guardar..." : "Registar Fiado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

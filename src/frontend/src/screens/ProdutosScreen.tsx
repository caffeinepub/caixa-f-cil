import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/contexts/AppContext";
import type { ProdutoDB } from "@/lib/db";
import { displayToCentavos, formatMZN } from "@/lib/db";
import {
  AlertTriangle,
  ArrowUp,
  Edit2,
  Package,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Categoria = "bebida" | "comida" | "outros";
type Unidade = "garrafa" | "lata" | "unidade" | "prato";
type FiltroCategoria = "todos" | Categoria;

interface ProdutoForm {
  nome: string;
  categoria: Categoria;
  precoVenda: string;
  precoCusto: string;
  stockAtual: string;
  stockMinimo: string;
  unidade: Unidade;
}

const defaultForm: ProdutoForm = {
  nome: "",
  categoria: "bebida",
  precoVenda: "",
  precoCusto: "",
  stockAtual: "0",
  stockMinimo: "0",
  unidade: "unidade",
};

export function ProdutosScreen() {
  const {
    produtos,
    addProdutoAction,
    updateProdutoAction,
    deleteProdutoAction,
  } = useData();

  const [filtro, setFiltro] = useState<FiltroCategoria>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<ProdutoDB | null>(null);
  const [form, setForm] = useState<ProdutoForm>(defaultForm);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<ProdutoDB | null>(null);
  const [stockMode, setStockMode] = useState<"entrada" | "ajuste">("entrada");
  const [stockQty, setStockQty] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered =
    filtro === "todos"
      ? produtos
      : produtos.filter((p) => p.categoria === filtro);

  const categorias: { key: FiltroCategoria; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "bebida", label: "Bebidas" },
    { key: "comida", label: "Comida" },
    { key: "outros", label: "Outros" },
  ];

  function openAdd() {
    setEditingProduto(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(p: ProdutoDB) {
    setEditingProduto(p);
    setForm({
      nome: p.nome,
      categoria: p.categoria,
      precoVenda: (p.precoVenda / 100).toFixed(2),
      precoCusto: (p.precoCusto / 100).toFixed(2),
      stockAtual: p.stockAtual.toString(),
      stockMinimo: p.stockMinimo.toString(),
      unidade: p.unidade,
    });
    setDialogOpen(true);
  }

  function openStock(p: ProdutoDB, mode: "entrada" | "ajuste") {
    setStockTarget(p);
    setStockMode(mode);
    setStockQty("");
    setStockDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    const precoVenda = displayToCentavos(form.precoVenda);
    const precoCusto = displayToCentavos(form.precoCusto);
    if (precoVenda <= 0) {
      toast.error("Preço de venda inválido.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduto) {
        await updateProdutoAction({
          ...editingProduto,
          nome: form.nome.trim(),
          categoria: form.categoria,
          precoVenda,
          precoCusto,
          stockAtual: Number.parseInt(form.stockAtual) || 0,
          stockMinimo: Number.parseInt(form.stockMinimo) || 0,
          unidade: form.unidade,
        });
        toast.success("Produto actualizado.");
      } else {
        await addProdutoAction({
          nome: form.nome.trim(),
          categoria: form.categoria,
          precoVenda,
          precoCusto,
          stockAtual: Number.parseInt(form.stockAtual) || 0,
          stockMinimo: Number.parseInt(form.stockMinimo) || 0,
          unidade: form.unidade,
        });
        toast.success("Produto adicionado.");
      }
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao guardar produto.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteProdutoAction(id);
      toast.success("Produto removido.");
      setDeleteConfirm(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover produto.");
    }
  }

  async function handleStockUpdate() {
    if (!stockTarget) return;
    const qty = Number.parseInt(stockQty);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    setIsSaving(true);
    try {
      let newStock: number;
      if (stockMode === "entrada") {
        newStock = stockTarget.stockAtual + qty;
      } else {
        newStock = qty;
      }

      await updateProdutoAction({ ...stockTarget, stockAtual: newStock });
      toast.success("Stock actualizado.");
      setStockDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao actualizar stock.");
    } finally {
      setIsSaving(false);
    }
  }

  const categoriaColors: Record<Categoria, string> = {
    bebida: "bg-blue-500/10 text-blue-400",
    comida: "bg-orange-500/10 text-orange-400",
    outros: "bg-muted text-muted-foreground",
  };
  const categoriaLabels: Record<Categoria, string> = {
    bebida: "Bebida",
    comida: "Comida",
    outros: "Outro",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category Filter */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {categorias.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setFiltro(cat.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              filtro === cat.key
                ? "bg-amber text-background font-bold"
                : "bg-card border border-border text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Package size={28} />
            <p className="text-sm">Nenhum produto</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => {
              const stockBaixo = p.stockAtual <= p.stockMinimo;
              return (
                <div
                  key={p.id}
                  className={`bg-card border rounded-xl p-4 ${stockBaixo ? "border-destructive/50" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoriaColors[p.categoria]}`}
                        >
                          {categoriaLabels[p.categoria]}
                        </span>
                        {stockBaixo && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle size={10} />
                            Stock baixo
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground mt-1.5 truncate">
                        {p.nome}
                      </p>
                      <div className="flex gap-4 mt-1">
                        <span className="font-display text-lg font-black text-amber">
                          {formatMZN(p.precoVenda)}
                        </span>
                        <span className="text-muted-foreground text-xs self-end pb-0.5">
                          custo: {formatMZN(p.precoCusto)}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${stockBaixo ? "text-destructive font-medium" : "text-muted-foreground"}`}
                      >
                        Stock: {p.stockAtual} {p.unidade} (mín: {p.stockMinimo})
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:opacity-70"
                        aria-label="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      {deleteConfirm === p.id ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="w-9 h-9 rounded-lg bg-destructive flex items-center justify-center text-destructive-foreground active:opacity-70 text-xs font-bold"
                        >
                          OK
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(p.id)}
                          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-destructive active:opacity-70"
                          aria-label="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock quick actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openStock(p, "entrada")}
                      className="flex-1 h-9 rounded-lg bg-muted text-foreground text-xs font-medium flex items-center justify-center gap-1.5 active:opacity-70"
                    >
                      <ArrowUp size={13} />
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => openStock(p, "ajuste")}
                      className="flex-1 h-9 rounded-lg bg-muted text-foreground text-xs font-medium flex items-center justify-center gap-1.5 active:opacity-70"
                    >
                      <Settings2 size={13} />
                      Ajuste
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-10">
        <button
          type="button"
          onClick={openAdd}
          className="w-14 h-14 rounded-full bg-amber text-background shadow-amber-lg flex items-center justify-center active:opacity-80 transition-opacity"
          aria-label="Adicionar produto"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingProduto ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label htmlFor="prod-nome">Nome</Label>
              <Input
                id="prod-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Cerveja 2M"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-categoria">Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) =>
                    setForm({ ...form, categoria: v as Categoria })
                  }
                >
                  <SelectTrigger id="prod-categoria" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bebida">Bebida</SelectItem>
                    <SelectItem value="comida">Comida</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prod-unidade">Unidade</Label>
                <Select
                  value={form.unidade}
                  onValueChange={(v) =>
                    setForm({ ...form, unidade: v as Unidade })
                  }
                >
                  <SelectTrigger id="prod-unidade" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="garrafa">Garrafa</SelectItem>
                    <SelectItem value="lata">Lata</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="prato">Prato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-preco-venda">Preço Venda (MZN)</Label>
                <Input
                  id="prod-preco-venda"
                  type="number"
                  value={form.precoVenda}
                  onChange={(e) =>
                    setForm({ ...form, precoVenda: e.target.value })
                  }
                  placeholder="0.00"
                  className="mt-1.5"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="prod-preco-custo">Preço Custo (MZN)</Label>
                <Input
                  id="prod-preco-custo"
                  type="number"
                  value={form.precoCusto}
                  onChange={(e) =>
                    setForm({ ...form, precoCusto: e.target.value })
                  }
                  placeholder="0.00"
                  className="mt-1.5"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-stock-atual">Stock Actual</Label>
                <Input
                  id="prod-stock-atual"
                  type="number"
                  value={form.stockAtual}
                  onChange={(e) =>
                    setForm({ ...form, stockAtual: e.target.value })
                  }
                  className="mt-1.5"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="prod-stock-min">Stock Mínimo</Label>
                <Input
                  id="prod-stock-min"
                  type="number"
                  value={form.stockMinimo}
                  onChange={(e) =>
                    setForm({ ...form, stockMinimo: e.target.value })
                  }
                  className="mt-1.5"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
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
                {isSaving ? "A guardar..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {stockMode === "entrada" ? "Entrada de Stock" : "Ajuste de Stock"}
            </DialogTitle>
          </DialogHeader>

          {stockTarget && (
            <div className="flex flex-col gap-4 mt-2">
              <p className="text-foreground font-medium">{stockTarget.nome}</p>
              <p className="text-muted-foreground text-sm">
                Stock actual:{" "}
                <span className="text-foreground font-bold">
                  {stockTarget.stockAtual} {stockTarget.unidade}
                </span>
              </p>

              <div>
                <Label htmlFor="stock-qty">
                  {stockMode === "entrada"
                    ? "Quantidade a adicionar"
                    : "Novo valor do stock"}
                </Label>
                <Input
                  id="stock-qty"
                  type="number"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  placeholder="0"
                  className="mt-1.5"
                  min="0"
                  autoFocus
                />
              </div>

              {stockMode === "entrada" && stockQty && (
                <p className="text-sm text-muted-foreground">
                  Novo stock:{" "}
                  <span className="text-foreground font-bold">
                    {stockTarget.stockAtual + (Number.parseInt(stockQty) || 0)}{" "}
                    {stockTarget.unidade}
                  </span>
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStockDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-amber text-background hover:bg-amber-dark font-bold"
                  onClick={handleStockUpdate}
                  disabled={isSaving}
                >
                  {isSaving ? "A guardar..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { useAuth, useData } from "@/contexts/AppContext";
import type { FuncionarioDB } from "@/lib/db";
import { hashPin } from "@/lib/db";
import {
  Coffee,
  Copy,
  Edit2,
  Key,
  Link2,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Papel = "admin" | "caixa" | "garcom";
type Aba = "equipa" | "acesso";

interface FuncionarioForm {
  nome: string;
  pin: string;
  papel: Papel;
}

const defaultForm: FuncionarioForm = {
  nome: "",
  pin: "",
  papel: "caixa",
};

// ---- Aba Acesso ----
function AbaAcesso() {
  const appUrl = window.location.origin + window.location.pathname;
  const { codigoBar } = useAuth();
  const [codeVisible, setCodeVisible] = useState(false);

  function copyUrl() {
    navigator.clipboard
      .writeText(appUrl)
      .then(() => toast.success("Link copiado!"))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function copyCode() {
    if (!codigoBar) return;
    navigator.clipboard
      .writeText(codigoBar)
      .then(() => toast.success("Código copiado!"))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function shareUrl() {
    if (navigator.share) {
      navigator
        .share({
          title: "Caixa Fácil – Bar & Restaurant",
          text: "Acede ao Caixa Fácil aqui:",
          url: appUrl,
        })
        .catch(() => {
          /* user cancelled */
        });
    } else {
      copyUrl();
    }
  }

  function shareViaWhatsApp() {
    const codeText = codigoBar ? `\n\nCódigo do bar: *${codigoBar}*` : "";
    const msg = encodeURIComponent(
      `Olá! Acede ao Caixa Fácil aqui:\n${appUrl}${codeText}\n\nIntroduz o código do bar no primeiro acesso para activar o dispositivo, depois faz login com o teu PIN de 4 dígitos.`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* Link da aplicação */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link2 size={18} className="text-amber shrink-0" />
          <p className="font-semibold text-foreground">Link da Aplicação</p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Partilha este link com os colaboradores para acederem à aplicação a
          partir de qualquer dispositivo.
        </p>

        {/* URL box */}
        <div className="bg-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
          <span className="flex-1 text-xs text-foreground font-mono break-all">
            {appUrl}
          </span>
          <button
            type="button"
            onClick={copyUrl}
            className="shrink-0 w-8 h-8 rounded-md bg-background flex items-center justify-center active:opacity-70 border border-border"
            aria-label="Copiar link"
          >
            <Copy size={14} />
          </button>
        </div>

        {/* Botões de partilha */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={shareUrl}
            className="flex-1 h-11 rounded-xl bg-amber text-background font-semibold text-sm flex items-center justify-center gap-2 active:opacity-80"
          >
            <Share2 size={16} />
            Partilhar
          </button>
          <button
            type="button"
            onClick={shareViaWhatsApp}
            className="flex-1 h-11 rounded-xl bg-[#25D366] text-white font-semibold text-sm flex items-center justify-center gap-2 active:opacity-80"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </button>
        </div>
      </div>

      {/* Código do Bar */}
      <div className="bg-card border border-amber/30 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-amber shrink-0" />
          <p className="font-semibold text-foreground">Código do Bar</p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          O colaborador precisa deste código de 8 caracteres para{" "}
          <strong className="text-foreground">activar a aplicação</strong> no
          primeiro acesso em cada novo dispositivo.
        </p>

        {codigoBar ? (
          <>
            <div className="bg-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
              <span className="flex-1 font-mono text-xl font-black tracking-[0.3em] text-amber select-none">
                {codeVisible ? codigoBar : "••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setCodeVisible((v) => !v)}
                className="shrink-0 h-8 px-3 rounded-md bg-background text-xs font-medium border border-border active:opacity-70"
              >
                {codeVisible ? "Ocultar" : "Mostrar"}
              </button>
              {codeVisible && (
                <button
                  type="button"
                  onClick={copyCode}
                  className="shrink-0 w-8 h-8 rounded-md bg-background flex items-center justify-center active:opacity-70 border border-border"
                  aria-label="Copiar código"
                >
                  <Copy size={14} />
                </button>
              )}
            </div>

            <div className="bg-amber/10 border border-amber/20 rounded-lg px-3 py-2">
              <p className="text-amber text-xs">
                Partilha o código apenas com colaboradores de confiança. Cada
                dispositivo precisa deste código para a primeira activação.
              </p>
            </div>
          </>
        ) : (
          <div className="bg-muted rounded-lg px-3 py-3 text-center">
            <p className="text-muted-foreground text-xs">
              Código do bar não disponível
            </p>
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
        <p className="font-semibold text-foreground text-sm">
          Como funciona o acesso?
        </p>
        <ol className="flex flex-col gap-2">
          {[
            {
              id: "s1",
              text: "Partilha o link da aplicação com o colaborador",
            },
            {
              id: "s2",
              text: "O colaborador abre o link no browser do telemóvel (Chrome recomendado)",
            },
            {
              id: "s3",
              text: "No primeiro acesso, introduz o código do bar (8 caracteres)",
            },
            {
              id: "s4",
              text: "Dá um nome ao dispositivo e escolhe o tipo (Caixa, Tablet, PC...)",
            },
            {
              id: "s5",
              text: "Depois da activação, faz login com o PIN de 4 dígitos",
            },
            {
              id: "s6",
              text: "O dispositivo fica registado — pode gerir todos os dispositivos em Licença",
            },
          ].map(({ id, text }, i) => (
            <li key={id} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-amber text-background text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                {text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---- Aba Equipa ----
function AbaEquipa() {
  const {
    funcionarios,
    addFuncionarioAction,
    updateFuncionarioAction,
    deleteFuncionarioAction,
  } = useData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<FuncionarioDB | null>(null);
  const [form, setForm] = useState<FuncionarioForm>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function openAdd() {
    setEditingFunc(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(f: FuncionarioDB) {
    setEditingFunc(f);
    setForm({ nome: f.nome, pin: "", papel: f.papel });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (!editingFunc && form.pin.length !== 4) {
      toast.error("PIN deve ter 4 dígitos.");
      return;
    }
    if (form.pin && form.pin.length !== 4) {
      toast.error("PIN deve ter 4 dígitos.");
      return;
    }
    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      toast.error("PIN deve conter apenas números.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingFunc) {
        const pinHash = form.pin
          ? await hashPin(form.pin)
          : editingFunc.pinHash;
        await updateFuncionarioAction({
          ...editingFunc,
          nome: form.nome.trim(),
          pinHash,
          papel: form.papel,
        });
        toast.success("Funcionário actualizado.");
      } else {
        const pinHash = await hashPin(form.pin);
        await addFuncionarioAction({
          nome: form.nome.trim(),
          pinHash,
          papel: form.papel,
        });
        toast.success("Funcionário adicionado.");
      }
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao guardar funcionário.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteFuncionarioAction(id);
      toast.success("Funcionário removido.");
      setDeleteConfirm(null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Erro ao remover funcionário.";
      toast.error(msg);
    }
  }

  const papelConfig: Record<
    Papel,
    { label: string; icon: typeof ShieldCheck; color: string }
  > = {
    admin: {
      label: "Admin",
      icon: ShieldCheck,
      color: "text-amber bg-amber-light",
    },
    caixa: {
      label: "Caixa",
      icon: User,
      color: "text-blue-400 bg-blue-500/10",
    },
    garcom: {
      label: "Garçom",
      icon: Coffee,
      color: "text-green-400 bg-green-500/10",
    },
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">
        {funcionarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Users size={28} />
            <p className="text-sm">Nenhum funcionário</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {funcionarios.map((f) => {
              const cfg = papelConfig[f.papel];
              const PapelIcon = cfg.icon;
              return (
                <div
                  key={f.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}
                  >
                    <PapelIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{f.nome}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(f)}
                      className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:opacity-70"
                      aria-label="Editar"
                    >
                      <Edit2 size={15} />
                    </button>
                    {deleteConfirm === f.id ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        className="w-9 h-9 rounded-lg bg-destructive text-destructive-foreground flex items-center justify-center active:opacity-70 text-xs font-bold"
                      >
                        OK
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(f.id)}
                        className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-destructive active:opacity-70"
                        aria-label="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
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
          className="w-14 h-14 rounded-full bg-amber text-background shadow-amber-lg flex items-center justify-center active:opacity-80"
          aria-label="Adicionar funcionário"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingFunc ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label htmlFor="func-nome">Nome</Label>
              <Input
                id="func-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="func-pin">
                PIN {editingFunc && "(deixe em branco para manter)"}
              </Label>
              <Input
                id="func-pin"
                type="password"
                value={form.pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setForm({ ...form, pin: v });
                }}
                placeholder="4 dígitos"
                className="mt-1.5"
                inputMode="numeric"
                maxLength={4}
              />
            </div>

            <div>
              <Label htmlFor="func-papel">Papel</Label>
              <Select
                value={form.papel}
                onValueChange={(v) => setForm({ ...form, papel: v as Papel })}
              >
                <SelectTrigger id="func-papel" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="garcom">Garçom</SelectItem>
                </SelectContent>
              </Select>
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
    </>
  );
}

// ---- Main Screen ----
export function FuncionariosScreen() {
  const [abaActiva, setAbaActiva] = useState<Aba>("equipa");

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border px-4 shrink-0">
        <button
          type="button"
          onClick={() => setAbaActiva("equipa")}
          className={`flex items-center gap-2 px-1 py-3 mr-6 text-sm font-semibold border-b-2 transition-colors ${
            abaActiva === "equipa"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <Users size={15} />
          Equipa
        </button>
        <button
          type="button"
          onClick={() => setAbaActiva("acesso")}
          className={`flex items-center gap-2 px-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            abaActiva === "acesso"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <Link2 size={15} />
          Acesso
        </button>
      </div>

      {/* Content */}
      {abaActiva === "equipa" ? (
        <div className="flex-1 overflow-y-auto relative">
          <AbaEquipa />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24">
          <AbaAcesso />
        </div>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth, useData, useTheme } from "@/contexts/AppContext";
import { exportBackup, hashPin, importBackup } from "@/lib/db";
import { getBarPorCodigo, getLicencaPorBar } from "@/lib/licensing";
import {
  Download,
  Key,
  LogOut,
  Shield,
  Smartphone,
  Store,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ConfiguracoesScreenProps {
  onNavigate?: (screen: string) => void;
}

export function ConfiguracoesScreen({ onNavigate }: ConfiguracoesScreenProps) {
  const { config, updateConfigAction } = useData();
  const { logout, codigoBar } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [barNome, setBarNome] = useState("");
  const [licencaDias, setLicencaDias] = useState<number | null>(null);
  const [licencaStatus, setLicencaStatus] = useState<
    "ativa" | "expirando" | "expirada"
  >("ativa");

  useEffect(() => {
    if (!codigoBar) return;
    getBarPorCodigo(codigoBar)
      .then(async (bar) => {
        if (bar) {
          setBarNome(bar.nome);
          const lic = await getLicencaPorBar(bar.id);
          if (lic) {
            const dias = Math.ceil((lic.dataExpiracao - Date.now()) / 86400000);
            setLicencaDias(Math.max(0, dias));
            if (dias <= 0) setLicencaStatus("expirada");
            else if (dias <= 30) setLicencaStatus("expirando");
            else setLicencaStatus("ativa");
          }
        }
      })
      .catch(console.error);
  }, [codigoBar]);

  const [nomeNegocio, setNomeNegocio] = useState(config?.nomeNegocio ?? "");
  const [isSavingNome, setIsSavingNome] = useState(false);

  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [pinConfirmar, setPinConfirmar] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveNome() {
    if (!nomeNegocio.trim()) {
      toast.error("Nome não pode estar vazio.");
      return;
    }
    setIsSavingNome(true);
    try {
      if (config) {
        await updateConfigAction({
          ...config,
          nomeNegocio: nomeNegocio.trim(),
        });
        toast.success("Nome actualizado.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao guardar.");
    } finally {
      setIsSavingNome(false);
    }
  }

  async function handleChangePin() {
    if (!pinAtual || pinAtual.length !== 4 || !/^\d{4}$/.test(pinAtual)) {
      toast.error("PIN actual inválido.");
      return;
    }
    if (!pinNovo || pinNovo.length !== 4 || !/^\d{4}$/.test(pinNovo)) {
      toast.error("Novo PIN deve ter 4 dígitos.");
      return;
    }
    if (pinNovo !== pinConfirmar) {
      toast.error("PINs não coincidem.");
      return;
    }

    setIsSavingPin(true);
    try {
      // Import here to avoid circular dependencies
      const { getFuncionarios, updateFuncionario } = await import("@/lib/db");
      const pinAtualHash = await hashPin(pinAtual);
      const funcs = await getFuncionarios();
      const admin = funcs.find(
        (f) => f.papel === "admin" && f.pinHash === pinAtualHash,
      );
      if (!admin) {
        toast.error("PIN actual incorrecto.");
        return;
      }
      const novoPinHash = await hashPin(pinNovo);
      await updateFuncionario({ ...admin, pinHash: novoPinHash });
      toast.success("PIN alterado com sucesso.");
      setPinAtual("");
      setPinNovo("");
      setPinConfirmar("");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar PIN.");
    } finally {
      setIsSavingPin(false);
    }
  }

  async function handleExport() {
    try {
      const data = await exportBackup();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caixa-facil-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar dados.");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importBackup(text);
      toast.success("Dados importados. Recarregue a página.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar. Ficheiro inválido?");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-8">
      {/* Licence section */}
      <section className="bg-card border border-amber/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-amber" />
          <h3 className="font-display text-base font-bold text-foreground uppercase tracking-wide">
            Licença & Dispositivos
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          {codigoBar ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bar</span>
                <span className="text-sm font-medium text-foreground">
                  {barNome || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Código</span>
                <span className="font-mono text-sm font-bold text-amber tracking-wider">
                  {codigoBar}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estado</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    licencaStatus === "ativa"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : licencaStatus === "expirando"
                        ? "bg-orange-500/15 text-orange-500"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {licencaStatus === "ativa"
                    ? "Activa"
                    : licencaStatus === "expirando"
                      ? "Expira em breve"
                      : "Expirada"}
                </span>
              </div>
              {licencaDias !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Dias restantes
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {licencaDias}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum bar activado</p>
          )}
        </div>
        <Button
          type="button"
          className="w-full h-10 mt-3 bg-amber text-background hover:bg-amber-dark font-bold text-sm"
          onClick={() => onNavigate?.("licenca")}
        >
          Gerir Licença & Dispositivos
        </Button>
      </section>

      {/* Business Info */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Store size={16} className="text-amber" />
          <h3 className="font-display text-base font-bold text-foreground uppercase tracking-wide">
            Negócio
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="nome-negocio">Nome do Negócio</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="nome-negocio"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                placeholder="Nome do seu negócio"
                className="flex-1"
              />
              <Button
                type="button"
                className="bg-amber text-background hover:bg-amber-dark font-bold px-4"
                onClick={handleSaveNome}
                disabled={isSavingNome}
              >
                {isSavingNome ? "..." : "Guardar"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Moeda</span>
            <span className="font-medium text-foreground bg-muted px-3 py-1 rounded-full text-sm">
              MZN (Metical)
            </span>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone size={16} className="text-amber" />
          <h3 className="font-display text-base font-bold text-foreground uppercase tracking-wide">
            Aparência
          </h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground text-sm font-medium">Tema Escuro</p>
            <p className="text-muted-foreground text-xs">
              Tema actual: {theme === "escuro" ? "Escuro" : "Claro"}
            </p>
          </div>
          <Switch
            checked={theme === "escuro"}
            onCheckedChange={toggleTheme}
            aria-label="Alternar tema"
          />
        </div>
      </section>

      {/* Backup */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} className="text-amber" />
          <h3 className="font-display text-base font-bold text-foreground uppercase tracking-wide">
            Backup
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={handleExport}
          >
            <Download size={16} />
            Exportar Dados
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            Importar Backup
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <p className="text-muted-foreground text-xs text-center">
            O backup inclui todos os dados do negócio
          </p>
        </div>
      </section>

      {/* Security */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-amber" />
          <h3 className="font-display text-base font-bold text-foreground uppercase tracking-wide">
            Segurança
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Alterar PIN Admin</p>
          <div>
            <Label htmlFor="pin-atual">PIN Actual</Label>
            <Input
              id="pin-atual"
              type="password"
              value={pinAtual}
              onChange={(e) =>
                setPinAtual(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="4 dígitos"
              inputMode="numeric"
              maxLength={4}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pin-novo">Novo PIN</Label>
            <Input
              id="pin-novo"
              type="password"
              value={pinNovo}
              onChange={(e) =>
                setPinNovo(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="4 dígitos"
              inputMode="numeric"
              maxLength={4}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pin-confirmar">Confirmar Novo PIN</Label>
            <Input
              id="pin-confirmar"
              type="password"
              value={pinConfirmar}
              onChange={(e) =>
                setPinConfirmar(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="4 dígitos"
              inputMode="numeric"
              maxLength={4}
              className="mt-1.5"
            />
          </div>
          <Button
            type="button"
            className="w-full h-11 bg-amber text-background hover:bg-amber-dark font-bold"
            onClick={handleChangePin}
            disabled={isSavingPin}
          >
            {isSavingPin ? "A alterar..." : "Alterar PIN"}
          </Button>
        </div>
      </section>

      {/* App Info */}
      <section className="bg-card border border-border rounded-xl p-4">
        <p className="text-muted-foreground text-xs text-center">
          Caixa Fácil Bar & Restaurant v1.0.0
        </p>
        <p className="text-muted-foreground text-xs text-center mt-1">
          Dados guardados localmente no seu dispositivo
        </p>
      </section>

      {/* Logout */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
        onClick={logout}
      >
        <LogOut size={16} />
        Terminar Sessão
      </Button>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-2">
        © 2026. Feito com ❤️ usando{" "}
        <a
          href="https://caffeine.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber hover:underline"
        >
          caffeine.ai
        </a>
      </p>
    </div>
  );
}

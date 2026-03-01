import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AppContext";
import {
  type Bar,
  type Dispositivo,
  type Licenca,
  type RegistoActivacao,
  bloquearDispositivo,
  consultarDispositivos,
  consultarLogsActivacao,
  exportarArquitectura,
  gerarFingerprint,
  getBarPorCodigo,
  getLicencaPorBar,
  revogarDispositivo,
} from "@/lib/licensing";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Key,
  Monitor,
  RefreshCw,
  ShieldOff,
  Smartphone,
  Tablet,
  Terminal,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "licenca" | "dispositivos" | "logs" | "arquitectura";
type LogFilter = "todos" | "sucesso" | "falha";

// ---- Helpers ----
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "Agora mesmo";
  if (min < 60) return `${min} min atrás`;
  if (hrs < 24) return `${hrs}h atrás`;
  return `${days}d atrás`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-MZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDeviceIcon(type: Dispositivo["deviceType"]) {
  switch (type) {
    case "tablet":
      return Tablet;
    case "pc":
      return Monitor;
    default:
      return Smartphone;
  }
}

function getStatusConfig(status: Dispositivo["status"]) {
  switch (status) {
    case "ativo":
      return {
        label: "Activo",
        className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      };
    case "revogado":
      return {
        label: "Revogado",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "suspeito":
      return {
        label: "Suspeito",
        className: "bg-orange-500/15 text-orange-500 border-orange-500/30",
      };
  }
}

// ---- Tab: Licença ----
function AbaLicenca({
  bar,
  licenca,
  totalDispositivos,
  dispositivosAtivos,
}: {
  bar: Bar;
  licenca: Licenca;
  totalDispositivos: number;
  dispositivosAtivos: number;
}) {
  const agora = Date.now();
  const diasRestantes = Math.max(
    0,
    Math.ceil((licenca.dataExpiracao - agora) / 86400000),
  );
  const isExpired = licenca.dataExpiracao < agora;
  const isExpiringSoon = !isExpired && diasRestantes <= 30;
  const usoPct = Math.round(
    (dispositivosAtivos / licenca.limiteDispositivos) * 100,
  );

  const licencaStatus = isExpired
    ? {
        label: "Expirada",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      }
    : isExpiringSoon
      ? {
          label: "Expira em Breve",
          className: "bg-orange-500/15 text-orange-500 border-orange-500/30",
        }
      : {
          label: "Activa",
          className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
        };

  function copySignature() {
    navigator.clipboard
      .writeText(licenca.assinaturaDigital)
      .then(() => {
        toast.success("Assinatura copiada!");
      })
      .catch(() => {
        toast.error("Não foi possível copiar.");
      });
  }

  function copyCode() {
    navigator.clipboard
      .writeText(bar.codigoBar)
      .then(() => {
        toast.success("Código copiado!");
      })
      .catch(() => {
        toast.error("Não foi possível copiar.");
      });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Bar header card */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              Bar Licenciado
            </p>
            <h2 className="font-display text-2xl font-black text-foreground">
              {bar.nome}
            </h2>
          </div>
          <Badge className={`shrink-0 border ${licencaStatus.className}`}>
            {licencaStatus.label}
          </Badge>
        </div>

        {/* Code */}
        <div className="bg-muted rounded-lg p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              Código do Bar
            </p>
            <span className="font-mono text-xl font-black text-amber tracking-[0.2em]">
              {bar.codigoBar}
            </span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center active:opacity-70"
            aria-label="Copiar código"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Validity */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber" />
          <p className="font-semibold text-foreground text-sm">
            Validade da Licença
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Data de expiração
          </span>
          <span className="text-sm font-medium text-foreground">
            {formatDate(licenca.dataExpiracao)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Dias restantes</span>
          <span
            className={`text-sm font-bold ${
              isExpired
                ? "text-destructive"
                : isExpiringSoon
                  ? "text-orange-500"
                  : "text-emerald-500"
            }`}
          >
            {isExpired ? "Expirada" : `${diasRestantes} dias`}
          </span>
        </div>
        {!isExpired && (
          <div className="mt-1">
            <Progress
              value={Math.max(0, 100 - (diasRestantes / 365) * 100)}
              className={`h-2 ${isExpiringSoon ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500"}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((diasRestantes / 365) * 100)}% da licença restante
            </p>
          </div>
        )}
      </div>

      {/* Devices usage */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-amber" />
          <p className="font-semibold text-foreground text-sm">Dispositivos</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Activos / Limite
          </span>
          <span className="text-sm font-bold text-foreground">
            {dispositivosAtivos} / {licenca.limiteDispositivos}
          </span>
        </div>
        <Progress
          value={usoPct}
          className={`h-2 ${usoPct >= 90 ? "[&>div]:bg-destructive" : usoPct >= 70 ? "[&>div]:bg-orange-500" : "[&>div]:bg-amber"}`}
        />
        <p className="text-xs text-muted-foreground">
          {licenca.limiteDispositivos - dispositivosAtivos} posições disponíveis
          · Total: {totalDispositivos}
        </p>
      </div>

      {/* Digital signature */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-amber" />
          <p className="font-semibold text-foreground text-sm">
            Assinatura Digital
          </p>
        </div>
        <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
            {licenca.assinaturaDigital.slice(0, 32)}...
          </span>
          <button
            type="button"
            onClick={copySignature}
            className="shrink-0 w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center active:opacity-70"
            aria-label="Copiar assinatura"
          >
            <Copy size={12} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          HMAC-SHA256 · Emitida em {formatDate(licenca.dataInicio)}
        </p>
      </div>

      {/* Renew */}
      <button
        type="button"
        onClick={() =>
          toast.info(
            "Para renovar a licença, contacte o administrador do sistema ou aceda ao painel de gestão.",
          )
        }
        className="w-full h-12 rounded-xl border-2 border-amber/50 text-amber font-bold text-sm flex items-center justify-center gap-2 active:opacity-70"
      >
        <RefreshCw size={16} />
        Renovar Licença
      </button>
    </div>
  );
}

// ---- Tab: Dispositivos ----
function AbaDispositivos({
  dispositivos,
  currentFingerprint,
  onRevoke,
  onBlock,
}: {
  dispositivos: Dispositivo[];
  currentFingerprint: string;
  onRevoke: (id: number) => void;
  onBlock: (id: number) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<{
    type: "revoke" | "block";
    deviceId: number;
    deviceName: string;
  } | null>(null);

  if (dispositivos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground p-4">
        <Smartphone size={28} />
        <p className="text-sm">Nenhum dispositivo registado</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {dispositivos.map((d) => {
          const DevIcon = getDeviceIcon(d.deviceType);
          const statusCfg = getStatusConfig(d.status);
          const isCurrent = d.deviceFingerprint === currentFingerprint;
          const lastSeen = formatRelativeTime(d.ultimoHeartbeat);

          return (
            <div
              key={d.id}
              className={`bg-card border rounded-xl p-4 flex flex-col gap-3 ${
                isCurrent ? "border-amber/50" : "border-border"
              }`}
            >
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    d.status === "ativo" ? "bg-amber/10" : "bg-muted"
                  }`}
                >
                  <DevIcon
                    size={20}
                    className={
                      d.status === "ativo"
                        ? "text-amber"
                        : "text-muted-foreground"
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">
                      {d.deviceName}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber/20 text-amber font-bold">
                        Este dispositivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {d.deviceType}
                  </p>
                </div>
                <Badge
                  className={`shrink-0 border text-[10px] ${statusCfg.className}`}
                >
                  {statusCfg.label}
                </Badge>
              </div>

              {/* Info row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Activado em</p>
                  <p className="text-foreground font-medium">
                    {formatDate(d.ativadoEm)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último acesso</p>
                  <p
                    className={`font-medium ${
                      Date.now() - d.ultimoHeartbeat < 3600000
                        ? "text-emerald-500"
                        : "text-foreground"
                    }`}
                  >
                    {lastSeen}
                  </p>
                </div>
              </div>

              {/* Fingerprint */}
              <p className="font-mono text-[10px] text-muted-foreground">
                ID: {d.deviceFingerprint.slice(0, 20)}...
              </p>

              {/* Actions (not for current device) */}
              {!isCurrent && d.status === "ativo" && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "revoke",
                        deviceId: d.id,
                        deviceName: d.deviceName,
                      })
                    }
                    className="flex-1 h-9 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs font-semibold flex items-center justify-center gap-1.5 active:opacity-70"
                  >
                    <ShieldOff size={13} />
                    Revogar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "block",
                        deviceId: d.id,
                        deviceName: d.deviceName,
                      })
                    }
                    className="flex-1 h-9 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 active:opacity-70"
                  >
                    <AlertTriangle size={13} />
                    Bloquear
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              {confirmAction?.type === "revoke"
                ? "Revogar Dispositivo"
                : "Bloquear Dispositivo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "revoke"
                ? `Tem a certeza que quer revogar "${confirmAction?.deviceName}"? O dispositivo perderá acesso imediatamente.`
                : `Tem a certeza que quer bloquear "${confirmAction?.deviceName}" por uso suspeito? Esta acção pode ser revista.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "revoke") {
                  onRevoke(confirmAction.deviceId);
                } else {
                  onBlock(confirmAction.deviceId);
                }
                setConfirmAction(null);
              }}
              className={
                confirmAction?.type === "revoke"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-orange-500 hover:bg-orange-600"
              }
            >
              {confirmAction?.type === "revoke" ? "Revogar" : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---- Tab: Logs ----
function AbaLogs({ logs }: { logs: RegistoActivacao[] }) {
  const [filter, setFilter] = useState<LogFilter>("todos");

  const filtered = logs.filter((l) => {
    if (filter === "sucesso") return l.sucesso;
    if (filter === "falha") return !l.sucesso;
    return true;
  });

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Filter */}
      <div className="flex gap-2">
        {(["todos", "sucesso", "falha"] as LogFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
              filter === f
                ? "bg-amber text-background"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {f === "todos" ? "Todos" : f === "sucesso" ? "Sucesso" : "Falhas"}
            <span className="ml-1 opacity-70">
              (
              {f === "todos"
                ? logs.length
                : logs.filter((l) => (f === "sucesso" ? l.sucesso : !l.sucesso))
                    .length}
              )
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          <FileText size={24} />
          <p className="text-sm">Sem registos</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className={`bg-card border rounded-xl p-3 flex gap-3 items-start ${
                log.sucesso ? "border-border" : "border-destructive/20"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  log.sucesso ? "bg-emerald-500/15" : "bg-destructive/15"
                }`}
              >
                {log.sucesso ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <XCircle size={14} className="text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      log.sucesso ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {log.sucesso ? "Sucesso" : "Falha"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {log.motivo}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  FP: {log.deviceFingerprint}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Tab: Arquitectura ----
function AbaArquitectura() {
  const arch = exportarArquitectura();

  const sections = [
    {
      id: "fluxo",
      title: "Fluxo de Activação",
      icon: Activity,
      content: arch.split("## 2.")[0].split("## 1.")[1]?.trim() ?? "",
    },
    {
      id: "tabelas",
      title: "Estrutura das Tabelas (SQL)",
      icon: FileText,
      content: arch.split("## 3.")[0].split("## 2.")[1]?.trim() ?? "",
    },
    {
      id: "endpoints",
      title: "Endpoints da API REST",
      icon: Terminal,
      content: arch.split("## 4.")[0].split("## 3.")[1]?.trim() ?? "",
    },
    {
      id: "pseudocode",
      title: "Pseudocódigo Backend",
      icon: BookOpen,
      content: arch.split("## 5.")[0].split("## 4.")[1]?.trim() ?? "",
    },
    {
      id: "antipiracy",
      title: "Estratégia Anti-Pirataria",
      icon: ShieldOff,
      content: arch.split("## 6.")[0].split("## 5.")[1]?.trim() ?? "",
    },
    {
      id: "scale",
      title: "Escalabilidade",
      icon: Activity,
      content: arch.split("## 6.")[1]?.trim() ?? "",
    },
  ];

  function downloadArch() {
    const blob = new Blob([arch], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "caixa-facil-arquitectura.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Documento descarregado.");
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        type="button"
        onClick={downloadArch}
        className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-sm font-medium flex items-center justify-center gap-2 active:opacity-70"
      >
        <Download size={15} />
        Descarregar Documentação Completa
      </button>

      <Accordion type="single" collapsible className="flex flex-col gap-2">
        {sections.map(({ id, title, icon: Icon, content }) => (
          <AccordionItem
            key={id}
            value={id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Icon size={15} className="text-amber shrink-0" />
                <span className="text-sm font-semibold text-foreground text-left">
                  {title}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-4 pb-4">
                <pre className="bg-background/80 border border-border rounded-lg p-3 text-[10px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {content}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// ---- Main Screen ----
export function LicencaScreen() {
  const { codigoBar } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("licenca");
  const [bar, setBar] = useState<Bar | null>(null);
  const [licenca, setLicenca] = useState<Licenca | null>(null);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [logs, setLogs] = useState<RegistoActivacao[]>([]);
  const [currentFingerprint, setCurrentFingerprint] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [fp, barData, dispositivosData, logsData] = await Promise.all([
        gerarFingerprint(),
        getBarPorCodigo(codigoBar),
        consultarDispositivos(codigoBar),
        consultarLogsActivacao(codigoBar),
      ]);
      setCurrentFingerprint(fp);
      setBar(barData ?? null);
      if (barData) {
        const lic = await getLicencaPorBar(barData.id);
        setLicenca(lic ?? null);
      }
      setDispositivos(dispositivosData);
      setLogs(logsData);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados de licença.");
    } finally {
      setIsLoading(false);
    }
  }, [codigoBar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRevoke(deviceId: number) {
    try {
      await revogarDispositivo(deviceId);
      toast.success("Dispositivo revogado.");
      await loadData();
    } catch {
      toast.error("Erro ao revogar dispositivo.");
    }
  }

  async function handleBlock(deviceId: number) {
    try {
      await bloquearDispositivo(deviceId);
      toast.success("Dispositivo bloqueado.");
      await loadData();
    } catch {
      toast.error("Erro ao bloquear dispositivo.");
    }
  }

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
  }[] = [
    { id: "licenca", label: "Licença", icon: Key },
    { id: "dispositivos", label: "Dispositivos", icon: Smartphone },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "arquitectura", label: "Arquitectura", icon: Terminal },
  ];

  const dispositivosAtivos = dispositivos.filter(
    (d) => d.status === "ativo",
  ).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
          <Key size={20} className="text-amber" />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-amber animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!bar || !licenca) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 p-4 text-center">
        <AlertTriangle size={32} className="text-orange-500" />
        <p className="font-semibold text-foreground">Licença não encontrada</p>
        <p className="text-sm text-muted-foreground">
          Código do bar:{" "}
          <span className="font-mono text-amber">{codigoBar || "—"}</span>
        </p>
        <button
          type="button"
          onClick={loadData}
          className="h-10 px-4 rounded-xl bg-amber text-background font-semibold text-sm active:opacity-70"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              activeTab === id
                ? "border-amber text-amber"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "licenca" && (
          <AbaLicenca
            bar={bar}
            licenca={licenca}
            totalDispositivos={dispositivos.length}
            dispositivosAtivos={dispositivosAtivos}
          />
        )}
        {activeTab === "dispositivos" && (
          <AbaDispositivos
            dispositivos={dispositivos}
            currentFingerprint={currentFingerprint}
            onRevoke={handleRevoke}
            onBlock={handleBlock}
          />
        )}
        {activeTab === "logs" && <AbaLogs logs={logs} />}
        {activeTab === "arquitectura" && <AbaArquitectura />}
      </ScrollArea>
    </div>
  );
}

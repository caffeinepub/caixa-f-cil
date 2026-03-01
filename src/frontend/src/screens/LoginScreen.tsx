import { useAuth } from "@/contexts/AppContext";
import {
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";

// ---- Shared PIN pad logic ----
function PinPad({
  pin,
  maxLength,
  isLoading,
  onKey,
}: {
  pin: string;
  maxLength: 4 | 6;
  isLoading: boolean;
  onKey: (key: string) => void;
}) {
  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "",
    "0",
    "backspace",
  ];
  const dots = Array.from({ length: maxLength }, (_, i) => i);

  return (
    <>
      {/* Dots */}
      <div className="flex gap-3 mb-10 justify-center">
        {dots.map((i) => (
          <div
            key={`dot-${i}`}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
              pin.length > i
                ? "bg-amber border-amber shadow-amber"
                : "border-border bg-card"
            }`}
          >
            {pin.length > i && (
              <div className="w-3.5 h-3.5 rounded-full bg-background animate-scale-in" />
            )}
          </div>
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((key) => {
          if (key === "") return <div key="empty" />;

          if (key === "backspace") {
            return (
              <button
                key="backspace"
                type="button"
                onClick={() => onKey("backspace")}
                disabled={isLoading}
                className="pin-btn h-16 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-muted transition-colors disabled:opacity-50"
                aria-label="Apagar"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-foreground"
                  aria-hidden="true"
                >
                  <title>Apagar</title>
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="13" y2="14" />
                  <line x1="13" y1="9" x2="18" y2="14" />
                </svg>
              </button>
            );
          }

          return (
            <button
              key={`key-${key}`}
              type="button"
              onClick={() => onKey(key)}
              disabled={isLoading || pin.length >= maxLength}
              className="pin-btn h-16 rounded-2xl bg-card border border-border font-display text-3xl font-bold text-foreground active:bg-amber active:text-background transition-colors disabled:opacity-40"
            >
              {key}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---- Activation Screen (multi-step) ----
type ActivationStep = "codigo" | "dispositivo" | "resultado";

type DeviceType = "caixa" | "tablet" | "pc" | "outro";

interface DeviceTypeOption {
  value: DeviceType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
}

const deviceTypeOptions: DeviceTypeOption[] = [
  { value: "caixa", label: "Caixa", icon: Monitor, desc: "Terminal de caixa" },
  { value: "tablet", label: "Tablet", icon: Tablet, desc: "Tablet de serviço" },
  { value: "pc", label: "Computador", icon: Monitor, desc: "PC do gerente" },
  {
    value: "outro",
    label: "Outro",
    icon: HelpCircle,
    desc: "Outro dispositivo",
  },
];

function ActivationScreen() {
  const { activate } = useAuth();
  const [step, setStep] = useState<ActivationStep>("codigo");
  const [codigoBar, setCodigoBar] = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("caixa");
  const [isActivating, setIsActivating] = useState(false);
  const [resultadoSucesso, setResultadoSucesso] = useState(false);
  const [resultadoMotivo, setResultadoMotivo] = useState("");

  // Handle typed code input
  function handleCodigoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    setCodigoBar(v);
    setCodigoError("");
  }

  async function handleValidarCodigo() {
    if (codigoBar.length !== 8) {
      setCodigoError("O código deve ter exactamente 8 caracteres.");
      return;
    }
    setIsValidating(true);
    // Just validate format here — actual check happens on activation
    await new Promise((r) => setTimeout(r, 600)); // UX delay
    setIsValidating(false);
    setStep("dispositivo");
  }

  async function handleActivar() {
    if (!deviceName.trim()) {
      return;
    }
    setIsActivating(true);
    try {
      const result = await activate(codigoBar, deviceName.trim(), deviceType);
      setResultadoSucesso(result.sucesso);
      setResultadoMotivo(result.motivo);
      setStep("resultado");
    } catch (_e) {
      setResultadoSucesso(false);
      setResultadoMotivo(
        "Erro inesperado. Verifique a ligação e tente novamente.",
      );
      setStep("resultado");
    } finally {
      setIsActivating(false);
    }
  }

  function handleRetry() {
    setStep("codigo");
    setCodigoBar("");
    setCodigoError("");
    setDeviceName("");
    setDeviceType("caixa");
    setResultadoSucesso(false);
    setResultadoMotivo("");
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-10">
      {/* Header */}
      <div className="mb-6 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber mb-4 shadow-amber-lg">
          <span className="font-display text-3xl font-black text-background">
            CF
          </span>
        </div>
        <h1 className="font-display text-4xl font-black text-foreground tracking-tight">
          CAIXA FÁCIL
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Bar & Restaurant</p>
      </div>

      {/* Step indicator */}
      {step !== "resultado" && (
        <div className="flex items-center gap-2 mb-6">
          {(["codigo", "dispositivo"] as ActivationStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? "bg-amber text-background"
                    : step === "dispositivo" && s === "codigo"
                      ? "bg-amber/30 text-amber"
                      : "bg-card border border-border text-muted-foreground"
                }`}
              >
                {step === "dispositivo" && s === "codigo" ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  step === s ? "text-amber" : "text-muted-foreground"
                }`}
              >
                {s === "codigo" ? "Código" : "Dispositivo"}
              </span>
              {i === 0 && <ChevronRight size={14} className="text-border" />}
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Enter bar code */}
      {step === "codigo" && (
        <div className="w-full max-w-xs flex flex-col gap-4 animate-fade-in">
          <div className="px-4 py-2 rounded-full bg-amber/10 border border-amber/30 text-center">
            <p className="text-amber text-xs font-semibold tracking-wide uppercase">
              Activação do Dispositivo
            </p>
          </div>

          <p className="text-muted-foreground text-sm text-center">
            Introduza o código do bar (8 caracteres) para activar este
            dispositivo.
          </p>

          {/* Code input — char-by-char display */}
          <div className="flex gap-1.5 justify-center">
            {(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"] as const).map(
              (pos, i) => (
                <div
                  key={pos}
                  className={`w-9 h-11 rounded-lg border-2 flex items-center justify-center font-mono font-bold text-sm transition-all ${
                    i < codigoBar.length
                      ? "border-amber bg-amber/10 text-amber"
                      : i === codigoBar.length
                        ? "border-amber/60 bg-card text-muted-foreground animate-pulse"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {codigoBar[i] ?? ""}
                </div>
              ),
            )}
          </div>

          <input
            type="text"
            value={codigoBar}
            onChange={handleCodigoInput}
            placeholder="Ex: 91850736"
            className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground font-mono text-center text-lg tracking-[0.2em] uppercase focus:outline-none focus:border-amber transition-colors"
            maxLength={8}
            autoCapitalize="characters"
            spellCheck={false}
            autoCorrect="off"
          />

          {codigoError && (
            <p className="text-destructive text-xs text-center animate-fade-in">
              {codigoError}
            </p>
          )}

          <button
            type="button"
            onClick={handleValidarCodigo}
            disabled={codigoBar.length !== 8 || isValidating}
            className="w-full h-12 rounded-xl bg-amber text-background font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:opacity-80 transition-all"
          >
            {isValidating ? (
              <>
                <Loader2 size={18} className="animate-spin" />A validar...
              </>
            ) : (
              <>
                Validar Código
                <ChevronRight size={18} />
              </>
            )}
          </button>

          <p className="text-muted-foreground text-xs text-center">
            Peça o código ao administrador do bar
          </p>
        </div>
      )}

      {/* Step 2: Name device */}
      {step === "dispositivo" && (
        <div className="w-full max-w-xs flex flex-col gap-4 animate-fade-in">
          <div className="px-4 py-2 rounded-full bg-amber/10 border border-amber/30 text-center">
            <p className="text-amber text-xs font-semibold tracking-wide uppercase">
              Identificar Dispositivo
            </p>
          </div>

          <p className="text-muted-foreground text-sm text-center">
            Dê um nome e seleccione o tipo deste dispositivo.
          </p>

          {/* Device name */}
          <div>
            <label
              htmlFor="device-name"
              className="text-sm font-medium text-foreground block mb-1.5"
            >
              Nome do dispositivo
            </label>
            <input
              id="device-name"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ex: Caixa 1, Tablet Gerente..."
              className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground focus:outline-none focus:border-amber transition-colors"
              maxLength={40}
            />
          </div>

          {/* Device type selector */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Tipo de dispositivo
            </p>
            <div className="grid grid-cols-2 gap-2">
              {deviceTypeOptions.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeviceType(value)}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all active:opacity-80 ${
                    deviceType === value
                      ? "border-amber bg-amber/10"
                      : "border-border bg-card"
                  }`}
                >
                  <Icon
                    size={22}
                    className={
                      deviceType === value
                        ? "text-amber"
                        : "text-muted-foreground"
                    }
                  />
                  <span
                    className={`text-xs font-semibold ${
                      deviceType === value ? "text-amber" : "text-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("codigo")}
              className="flex-1 h-12 rounded-xl bg-card border border-border text-foreground font-medium text-sm active:opacity-70"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleActivar}
              disabled={!deviceName.trim() || isActivating}
              className="flex-[2] h-12 rounded-xl bg-amber text-background font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:opacity-80 transition-all"
            >
              {isActivating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />A activar...
                </>
              ) : (
                "Activar Dispositivo"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "resultado" && (
        <div className="w-full max-w-xs flex flex-col items-center gap-4 animate-fade-in">
          {resultadoSucesso ? (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 size={48} className="text-emerald-500" />
              </div>
              <div className="text-center">
                <h2 className="font-display text-2xl font-black text-foreground mb-1">
                  Activado!
                </h2>
                <p className="text-emerald-500 text-sm font-medium">
                  Dispositivo activado com sucesso
                </p>
              </div>

              <div className="w-full bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Código do Bar
                  </span>
                  <span className="font-mono font-bold text-amber tracking-wider">
                    {codigoBar}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Dispositivo
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {deviceName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tipo</span>
                  <span className="text-sm text-foreground capitalize">
                    {deviceType}
                  </span>
                </div>
              </div>

              <div className="w-full bg-amber/10 border border-amber/20 rounded-xl p-3">
                <p className="text-amber text-xs text-center">
                  Este dispositivo está activado. Pode fazer login com o seu PIN
                  de 4 dígitos.
                </p>
              </div>

              <p className="text-muted-foreground text-xs text-center">
                A redirecionar para o login...
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center">
                <XCircle size={48} className="text-destructive" />
              </div>
              <div className="text-center">
                <h2 className="font-display text-2xl font-black text-foreground mb-1">
                  Falhou
                </h2>
                <p className="text-destructive text-sm font-medium">
                  Activação não foi possível
                </p>
              </div>

              <div className="w-full bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                <p className="text-destructive text-sm text-center leading-relaxed">
                  {resultadoMotivo}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRetry}
                className="w-full h-12 rounded-xl bg-amber text-background font-bold active:opacity-80"
              >
                Tentar Novamente
              </button>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="mt-10 text-muted-foreground text-xs text-center">
        © {new Date().getFullYear()}. Feito com ❤️ usando{" "}
        <a
          href="https://caffeine.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber underline-offset-2 hover:underline"
        >
          caffeine.ai
        </a>
      </p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ---- Normal Login Screen (4-digit PIN) ----
function NormalLoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [shake, setShake] = useState(false);

  const handleKey = useCallback(
    async (key: string) => {
      if (isLogging) return;
      setError("");

      if (key === "backspace") {
        setPin((prev) => prev.slice(0, -1));
        return;
      }

      const newPin = pin + key;
      setPin(newPin);

      if (newPin.length === 4) {
        setIsLogging(true);
        const ok = await login(newPin);
        if (!ok) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setError("PIN incorreto. Tente novamente.");
          setPin("");
        }
        setIsLogging(false);
      }
    },
    [pin, isLogging, login],
  );

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="mb-10 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber mb-4 shadow-amber-lg">
          <span className="font-display text-3xl font-black text-background">
            CF
          </span>
        </div>
        <h1 className="font-display text-4xl font-black text-foreground tracking-tight">
          CAIXA FÁCIL
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Bar & Restaurant</p>
      </div>

      {/* Dots + shake */}
      <div
        className={`w-full flex flex-col items-center transition-all ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
      >
        <PinPad
          pin={pin}
          maxLength={4}
          isLoading={isLogging}
          onKey={handleKey}
        />
      </div>

      {/* Error */}
      <div className="h-6 mt-4">
        {error && (
          <p className="text-danger text-sm text-center animate-fade-in">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <p className="mt-12 text-muted-foreground text-xs text-center">
        © {new Date().getFullYear()}. Feito com ❤️ usando{" "}
        <a
          href="https://caffeine.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber underline-offset-2 hover:underline"
        >
          caffeine.ai
        </a>
      </p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ---- Main export: decides which screen to show ----
export function LoginScreen() {
  const { isActivated } = useAuth();

  if (!isActivated) {
    return <ActivationScreen />;
  }

  return <NormalLoginScreen />;
}

import { BottomNav } from "@/components/BottomNav";
import { MaisMenu } from "@/components/MaisMenu";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useAuth } from "@/contexts/AppContext";
import { ConfiguracoesScreen } from "@/screens/ConfiguracoesScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { FiadoScreen } from "@/screens/FiadoScreen";
import { FuncionariosScreen } from "@/screens/FuncionariosScreen";
import { LicencaScreen } from "@/screens/LicencaScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { NovaVendaScreen } from "@/screens/NovaVendaScreen";
import { ProdutosScreen } from "@/screens/ProdutosScreen";
import { RelatoriosScreen } from "@/screens/RelatoriosScreen";
import { useState } from "react";

type Screen =
  | "dashboard"
  | "venda"
  | "produtos"
  | "relatorios"
  | "funcionarios"
  | "fiado"
  | "configuracoes"
  | "licenca"
  | "mais";

const screenTitles: Record<Screen, string> = {
  dashboard: "Início",
  venda: "Nova Venda",
  produtos: "Produtos & Stock",
  relatorios: "Relatórios",
  funcionarios: "Funcionários",
  fiado: "Fiado",
  configuracoes: "Configurações",
  licenca: "Licença & Dispositivos",
  mais: "Mais",
};

function AppShell() {
  const { currentUser, isLoading } = useAuth();
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber flex items-center justify-center shadow-amber-lg">
            <span className="font-display text-3xl font-black text-background">
              CF
            </span>
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
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  // Role-based access: cashiers/waiters only see sales screens
  const isAdmin = currentUser.papel === "admin";
  const allowedScreens: Screen[] = isAdmin
    ? [
        "dashboard",
        "venda",
        "produtos",
        "relatorios",
        "funcionarios",
        "fiado",
        "configuracoes",
        "licenca",
      ]
    : ["venda", "produtos"];

  function navigate(screen: string) {
    const s = screen as Screen;
    if (allowedScreens.includes(s) || s === "dashboard") {
      setActiveScreen(s);
    }
  }

  function handleTabChange(tab: string) {
    if (tab === "mais") {
      setActiveScreen("mais");
    } else {
      navigate(tab);
    }
  }

  const getNavTab = (): string => {
    if (
      ["funcionarios", "fiado", "configuracoes", "licenca"].includes(
        activeScreen,
      )
    )
      return "mais";
    return activeScreen;
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "dashboard":
        return <DashboardScreen onNavigate={navigate} />;
      case "venda":
        return <NovaVendaScreen onNavigate={navigate} />;
      case "produtos":
        return <ProdutosScreen />;
      case "relatorios":
        return <RelatoriosScreen />;
      case "funcionarios":
        return isAdmin ? <FuncionariosScreen /> : null;
      case "fiado":
        return isAdmin ? <FiadoScreen /> : null;
      case "configuracoes":
        return isAdmin ? <ConfiguracoesScreen onNavigate={navigate} /> : null;
      case "licenca":
        return isAdmin ? <LicencaScreen /> : null;
      case "mais":
        return (
          <MaisMenu
            onNavigate={(s) => {
              navigate(s);
            }}
            onClose={() => setActiveScreen("dashboard")}
          />
        );
      default:
        return <DashboardScreen onNavigate={navigate} />;
    }
  };

  const showHeader = !["dashboard", "venda"].includes(activeScreen);

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-lg mx-auto relative">
      {/* Header (for non-dashboard, non-POS screens) */}
      {showHeader && (
        <header className="flex items-center px-4 py-3 border-b border-border bg-card sticky top-0 z-40">
          <button
            type="button"
            onClick={() => setActiveScreen("dashboard")}
            className="mr-3 text-muted-foreground"
            aria-label="Voltar"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="font-display text-xl font-bold text-foreground">
            {screenTitles[activeScreen]}
          </h1>
        </header>
      )}

      {/* Main content */}
      <main
        className={`flex-1 overflow-y-auto ${
          activeScreen === "venda" ? "flex flex-col overflow-hidden" : ""
        }`}
        style={{
          paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {renderScreen()}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={getNavTab()} onTabChange={handleTabChange} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
      <Toaster position="top-center" richColors />
    </AppProvider>
  );
}

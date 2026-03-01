import type {
  ConfigDB,
  FiadoDB,
  FuncionarioDB,
  ProdutoDB,
  VendaDB,
} from "@/lib/db";
import {
  addFiado,
  addFuncionario,
  addProduto,
  addVenda,
  getConfig,
  getFiados,
  getFuncionarios,
  getProdutos,
  getVendas,
  hashPin,
  saveConfig,
  seedIfNeeded,
  softDeleteFuncionario,
  softDeleteProduto,
  updateFiado,
  updateFuncionario,
  updateProduto,
} from "@/lib/db";
import {
  ativarDispositivo,
  getCodigoBarActivo,
  heartbeat,
  initLicensing,
  isDispositivoActivado,
} from "@/lib/licensing";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ---- Auth Context ----
interface AuthContextValue {
  currentUser: FuncionarioDB | null;
  isLoading: boolean;
  isActivated: boolean;
  codigoBar: string;
  activate: (
    codigoBar: string,
    deviceName: string,
    deviceType: string,
  ) => Promise<{ sucesso: boolean; motivo: string }>;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AppProvider");
  return ctx;
}

// ---- Theme Context ----
interface ThemeContextValue {
  theme: "escuro" | "claro";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside AppProvider");
  return ctx;
}

// ---- Data Context ----
interface DataContextValue {
  config: ConfigDB | null;
  produtos: ProdutoDB[];
  vendas: VendaDB[];
  fiados: FiadoDB[];
  funcionarios: FuncionarioDB[];
  isDataLoading: boolean;
  refreshProdutos: () => Promise<void>;
  refreshVendas: () => Promise<void>;
  refreshFiados: () => Promise<void>;
  refreshFuncionarios: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  addProdutoAction: (
    p: Omit<ProdutoDB, "id" | "criadoEm" | "ativo">,
  ) => Promise<ProdutoDB>;
  updateProdutoAction: (p: ProdutoDB) => Promise<void>;
  deleteProdutoAction: (id: number) => Promise<void>;
  addVendaAction: (v: Omit<VendaDB, "id" | "sincronizado">) => Promise<VendaDB>;
  addFiadoAction: (f: Omit<FiadoDB, "id">) => Promise<FiadoDB>;
  updateFiadoAction: (f: FiadoDB) => Promise<void>;
  addFuncionarioAction: (
    f: Omit<FuncionarioDB, "id" | "criadoEm" | "ativo">,
  ) => Promise<FuncionarioDB>;
  updateFuncionarioAction: (f: FuncionarioDB) => Promise<void>;
  deleteFuncionarioAction: (id: number) => Promise<void>;
  updateConfigAction: (c: ConfigDB) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside AppProvider");
  return ctx;
}

// ---- Combined Provider ----
export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FuncionarioDB | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [codigoBar, setCodigoBar] = useState("");
  const [theme, setTheme] = useState<"escuro" | "claro">("escuro");

  const [config, setConfig] = useState<ConfigDB | null>(null);
  const [produtos, setProdutos] = useState<ProdutoDB[]>([]);
  const [vendas, setVendas] = useState<VendaDB[]>([]);
  const [fiados, setFiados] = useState<FiadoDB[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioDB[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Initialize app
  useEffect(() => {
    async function init() {
      try {
        // Initialize licensing system (migrates old activations, seeds demo bar)
        await initLicensing();

        // Check device activation
        const activated = isDispositivoActivado();
        setIsActivated(activated);

        const codigo = getCodigoBarActivo();
        setCodigoBar(codigo);

        await seedIfNeeded();
        const [cfg, prods, vends, fids, funcs] = await Promise.all([
          getConfig(),
          getProdutos(),
          getVendas(),
          getFiados(),
          getFuncionarios(),
        ]);
        setConfig(cfg);
        setProdutos(prods);
        setVendas(vends);
        setFiados(fids);
        setFuncionarios(funcs);
        setTheme(cfg.tema);

        // Apply theme to DOM
        if (cfg.tema === "escuro") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }

        // Restore session
        const savedUserId = sessionStorage.getItem("currentUserId");
        if (savedUserId) {
          const user = funcs.find((f) => f.id === Number.parseInt(savedUserId));
          if (user) setCurrentUser(user);
        }
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setIsLoading(false);
        setIsDataLoading(false);
      }
    }
    init();
  }, []);

  // Heartbeat every 30 minutes when app is active
  useEffect(() => {
    if (!isActivated || !codigoBar) return;

    const interval = setInterval(
      async () => {
        try {
          await heartbeat(codigoBar);
        } catch {
          // Non-critical
        }
      },
      30 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [isActivated, codigoBar]);

  // Activation
  const activate = useCallback(
    async (
      barCode: string,
      deviceName: string,
      deviceType: string,
    ): Promise<{ sucesso: boolean; motivo: string }> => {
      const result = await ativarDispositivo(
        barCode,
        deviceName,
        deviceType as "caixa" | "tablet" | "pc" | "outro",
      );
      if (result.sucesso) {
        setIsActivated(true);
        setCodigoBar(barCode.toUpperCase());
      }
      return result;
    },
    [],
  );

  // Auth
  const login = useCallback(async (pin: string): Promise<boolean> => {
    const pinHash = await hashPin(pin);
    const funcs = await getFuncionarios();
    const user = funcs.find((f) => f.pinHash === pinHash && f.ativo);
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem("currentUserId", user.id.toString());
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem("currentUserId");
  }, []);

  // Theme
  const toggleTheme = useCallback(async () => {
    const newTheme: "escuro" | "claro" =
      theme === "escuro" ? "claro" : "escuro";
    setTheme(newTheme);
    if (newTheme === "escuro") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    if (config) {
      const newConfig: ConfigDB = { ...config, tema: newTheme };
      await saveConfig(newConfig);
      setConfig(newConfig);
    }
  }, [theme, config]);

  // Data refresh helpers
  const refreshProdutos = useCallback(async () => {
    setProdutos(await getProdutos());
  }, []);

  const refreshVendas = useCallback(async () => {
    setVendas(await getVendas());
  }, []);

  const refreshFiados = useCallback(async () => {
    setFiados(await getFiados());
  }, []);

  const refreshFuncionarios = useCallback(async () => {
    setFuncionarios(await getFuncionarios());
  }, []);

  const refreshConfig = useCallback(async () => {
    setConfig(await getConfig());
  }, []);

  // Product actions
  const addProdutoAction = useCallback(
    async (p: Omit<ProdutoDB, "id" | "criadoEm" | "ativo">) => {
      const result = await addProduto(p);
      await refreshProdutos();
      return result;
    },
    [refreshProdutos],
  );

  const updateProdutoAction = useCallback(
    async (p: ProdutoDB) => {
      await updateProduto(p);
      await refreshProdutos();
    },
    [refreshProdutos],
  );

  const deleteProdutoAction = useCallback(
    async (id: number) => {
      await softDeleteProduto(id);
      await refreshProdutos();
    },
    [refreshProdutos],
  );

  // Venda actions
  const addVendaAction = useCallback(
    async (v: Omit<VendaDB, "id" | "sincronizado">) => {
      const result = await addVenda(v);
      // Deduct stock
      const updatedProdutos = [...produtos];
      for (const item of v.itens) {
        const idx = updatedProdutos.findIndex((p) => p.id === item.produtoId);
        if (idx !== -1) {
          const updated = {
            ...updatedProdutos[idx],
            stockAtual: Math.max(
              0,
              updatedProdutos[idx].stockAtual - item.quantidade,
            ),
          };
          await updateProduto(updated);
          updatedProdutos[idx] = updated;
        }
      }
      setProdutos(updatedProdutos);
      await refreshVendas();
      return result;
    },
    [produtos, refreshVendas],
  );

  // Fiado actions
  const addFiadoAction = useCallback(
    async (f: Omit<FiadoDB, "id">) => {
      const result = await addFiado(f);
      await refreshFiados();
      return result;
    },
    [refreshFiados],
  );

  const updateFiadoAction = useCallback(
    async (f: FiadoDB) => {
      await updateFiado(f);
      await refreshFiados();
    },
    [refreshFiados],
  );

  // Funcionario actions
  const addFuncionarioAction = useCallback(
    async (f: Omit<FuncionarioDB, "id" | "criadoEm" | "ativo">) => {
      const result = await addFuncionario(f);
      await refreshFuncionarios();
      return result;
    },
    [refreshFuncionarios],
  );

  const updateFuncionarioAction = useCallback(
    async (f: FuncionarioDB) => {
      await updateFuncionario(f);
      await refreshFuncionarios();
    },
    [refreshFuncionarios],
  );

  const deleteFuncionarioAction = useCallback(
    async (id: number) => {
      const admins = funcionarios.filter((f) => f.papel === "admin" && f.ativo);
      const target = funcionarios.find((f) => f.id === id);
      if (target?.papel === "admin" && admins.length <= 1) {
        throw new Error("Não é possível remover o último administrador");
      }
      await softDeleteFuncionario(id);
      await refreshFuncionarios();
    },
    [funcionarios, refreshFuncionarios],
  );

  const updateConfigAction = useCallback(async (c: ConfigDB) => {
    await saveConfig(c);
    setConfig(c);
    setTheme(c.tema);
    if (c.tema === "escuro") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isActivated,
        codigoBar,
        activate,
        login,
        logout,
      }}
    >
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <DataContext.Provider
          value={{
            config,
            produtos,
            vendas,
            fiados,
            funcionarios,
            isDataLoading,
            refreshProdutos,
            refreshVendas,
            refreshFiados,
            refreshFuncionarios,
            refreshConfig,
            addProdutoAction,
            updateProdutoAction,
            deleteProdutoAction,
            addVendaAction,
            addFiadoAction,
            updateFiadoAction,
            addFuncionarioAction,
            updateFuncionarioAction,
            deleteFuncionarioAction,
            updateConfigAction,
          }}
        >
          {children}
        </DataContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

// IndexedDB database layer for Caixa Fácil
// Uses native IndexedDB API (no external dependencies needed)

export interface ProdutoDB {
  id: number;
  nome: string;
  categoria: "bebida" | "comida" | "outros";
  precoVenda: number; // stored in centavos (MZN × 100)
  precoCusto: number; // stored in centavos
  stockAtual: number;
  stockMinimo: number;
  unidade: "garrafa" | "lata" | "unidade" | "prato";
  ativo: boolean;
  criadoEm: number;
}

export interface FuncionarioDB {
  id: number;
  nome: string;
  pinHash: string; // hex encoded SHA-256
  papel: "admin" | "caixa" | "garcom";
  ativo: boolean;
  criadoEm: number;
}

export interface VendaItemDB {
  produtoId: number;
  nomeProduto: string;
  preco: number; // in centavos
  quantidade: number;
}

export interface VendaDB {
  id: number;
  itens: VendaItemDB[];
  total: number; // in centavos
  desconto: number; // in centavos
  metodoPagamento: "dinheiro" | "mpesa" | "emola" | "outro";
  funcionarioId: number;
  nomeFuncionario: string;
  dataHora: number; // timestamp ms
  observacoes: string;
  sincronizado: boolean;
}

export interface FiadoDB {
  id: number;
  clienteNome: string;
  clienteTelefone: string;
  itens: VendaItemDB[];
  total: number; // in centavos
  data: number; // timestamp ms
  dataPagamento?: number;
  estado: "pendente" | "pago";
}

export interface ConfigDB {
  id: 1; // singleton
  nomeNegocio: string;
  moeda: string;
  tema: "escuro" | "claro";
  versao: string;
}

const DB_NAME = "caixa-facil-db";
// Version bumped to 2 to add licensing stores (bars, licencas, dispositivos, registos_activacao, logs_sistema)
// The openDB() here shares the same database but licensing.ts handles the onupgradeneeded for new stores
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

// Allow licensing module to inject the shared db instance to avoid version conflicts
export function setSharedDB(db: IDBDatabase) {
  dbInstance = db;
}

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    // Use the same open request but defer to licensing.ts for upgrades
    // We import openLicensingDB lazily to avoid circular deps
    import("@/lib/licensing")
      .then(({ openLicensingDB }) => {
        openLicensingDB()
          .then((db) => {
            dbInstance = db;
            resolve(db);
          })
          .catch(reject);
      })
      .catch(() => {
        // Fallback: open directly if licensing not available
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          dbInstance = request.result;
          resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains("produtos")) {
            const s = db.createObjectStore("produtos", {
              keyPath: "id",
              autoIncrement: true,
            });
            s.createIndex("categoria", "categoria");
            s.createIndex("ativo", "ativo");
          }
          if (!db.objectStoreNames.contains("funcionarios")) {
            const s = db.createObjectStore("funcionarios", {
              keyPath: "id",
              autoIncrement: true,
            });
            s.createIndex("papel", "papel");
          }
          if (!db.objectStoreNames.contains("vendas")) {
            const s = db.createObjectStore("vendas", {
              keyPath: "id",
              autoIncrement: true,
            });
            s.createIndex("dataHora", "dataHora");
            s.createIndex("funcionarioId", "funcionarioId");
            s.createIndex("metodoPagamento", "metodoPagamento");
          }
          if (!db.objectStoreNames.contains("fiado")) {
            const s = db.createObjectStore("fiado", {
              keyPath: "id",
              autoIncrement: true,
            });
            s.createIndex("estado", "estado");
            s.createIndex("data", "data");
          }
          if (!db.objectStoreNames.contains("config")) {
            db.createObjectStore("config", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta", { keyPath: "key" });
          }
        };
      });
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<any>, // eslint-disable-line
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll());
}

// ---- PRODUTOS ----
export async function getProdutos(): Promise<ProdutoDB[]> {
  const all = await getAllFromStore<ProdutoDB>("produtos");
  return all.filter((p) => p.ativo);
}

export async function addProduto(
  p: Omit<ProdutoDB, "id" | "criadoEm" | "ativo">,
): Promise<ProdutoDB> {
  const produto: Omit<ProdutoDB, "id"> = {
    ...p,
    ativo: true,
    criadoEm: Date.now(),
  };
  const id = await withStore<number>("produtos", "readwrite", (store) =>
    store.add(produto),
  );
  return { id, ...produto };
}

export async function updateProduto(p: ProdutoDB): Promise<void> {
  await withStore<IDBValidKey>("produtos", "readwrite", (store) =>
    store.put(p),
  );
}

export async function softDeleteProduto(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("produtos", "readwrite");
    const store = tx.objectStore("produtos");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const p = getReq.result as ProdutoDB;
      if (p) {
        p.ativo = false;
        const putReq = store.put(p);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ---- FUNCIONÁRIOS ----
export async function getFuncionarios(): Promise<FuncionarioDB[]> {
  const all = await getAllFromStore<FuncionarioDB>("funcionarios");
  return all.filter((f) => f.ativo);
}

export async function addFuncionario(
  f: Omit<FuncionarioDB, "id" | "criadoEm" | "ativo">,
): Promise<FuncionarioDB> {
  const func: Omit<FuncionarioDB, "id"> = {
    ...f,
    ativo: true,
    criadoEm: Date.now(),
  };
  const id = await withStore<number>("funcionarios", "readwrite", (store) =>
    store.add(func),
  );
  return { id, ...func };
}

export async function updateFuncionario(f: FuncionarioDB): Promise<void> {
  await withStore<IDBValidKey>("funcionarios", "readwrite", (store) =>
    store.put(f),
  );
}

export async function softDeleteFuncionario(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("funcionarios", "readwrite");
    const store = tx.objectStore("funcionarios");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const f = getReq.result as FuncionarioDB;
      if (f) {
        f.ativo = false;
        const putReq = store.put(f);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ---- VENDAS ----
export async function getVendas(): Promise<VendaDB[]> {
  return getAllFromStore<VendaDB>("vendas");
}

export async function addVenda(
  v: Omit<VendaDB, "id" | "sincronizado">,
): Promise<VendaDB> {
  const venda: Omit<VendaDB, "id"> = { ...v, sincronizado: false };
  const id = await withStore<number>("vendas", "readwrite", (store) =>
    store.add(venda),
  );
  return { id, ...venda };
}

// ---- FIADO ----
export async function getFiados(): Promise<FiadoDB[]> {
  return getAllFromStore<FiadoDB>("fiado");
}

export async function addFiado(f: Omit<FiadoDB, "id">): Promise<FiadoDB> {
  const id = await withStore<number>("fiado", "readwrite", (store) =>
    store.add(f),
  );
  return { id, ...f };
}

export async function updateFiado(f: FiadoDB): Promise<void> {
  await withStore<IDBValidKey>("fiado", "readwrite", (store) => store.put(f));
}

// ---- CONFIG ----
export async function getConfig(): Promise<ConfigDB> {
  const result = await withStore<ConfigDB | undefined>(
    "config",
    "readonly",
    (store) => store.get(1),
  );
  return (
    result ?? {
      id: 1,
      nomeNegocio: "Caixa Fácil Bar",
      moeda: "MZN",
      tema: "escuro",
      versao: "1.0.0",
    }
  );
}

export async function saveConfig(config: ConfigDB): Promise<void> {
  await withStore<IDBValidKey>("config", "readwrite", (store) =>
    store.put(config),
  );
}

// ---- PIN HASHING ----
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- LEGACY activation (kept for migration reference only) ----
// These functions are replaced by the licensing system in licensing.ts
// Kept here for backward-compatibility with any existing imports
export function isDeviceActivated(): boolean {
  // Delegate to licensing system
  const raw = localStorage.getItem("cf_device_token");
  if (raw) {
    try {
      const token = JSON.parse(raw);
      return !!(token.codigoBar && token.fp && token.ts);
    } catch {
      return false;
    }
  }
  // Check legacy key
  return localStorage.getItem("caixa-facil-activated") === "1";
}

export async function activateDevice(_key: string): Promise<boolean> {
  // Deprecated — use ativarDispositivo from licensing.ts
  return false;
}

// ---- SEED DATA ----
export async function seedIfNeeded(): Promise<void> {
  const db = await openDB();

  const alreadySeeded = await new Promise<boolean>((resolve) => {
    const tx = db.transaction("meta", "readonly");
    const store = tx.objectStore("meta");
    const req = store.get("seeded");
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });

  if (alreadySeeded) return;

  // Seed products
  const produtos: Omit<ProdutoDB, "id">[] = [
    {
      nome: "Cerveja 2M",
      categoria: "bebida",
      precoVenda: 15000,
      precoCusto: 8000,
      stockAtual: 50,
      stockMinimo: 10,
      unidade: "garrafa",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Cerveja Laurentina",
      categoria: "bebida",
      precoVenda: 15000,
      precoCusto: 8000,
      stockAtual: 40,
      stockMinimo: 10,
      unidade: "garrafa",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Coca-Cola",
      categoria: "bebida",
      precoVenda: 8000,
      precoCusto: 4000,
      stockAtual: 30,
      stockMinimo: 5,
      unidade: "lata",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Água Mineral",
      categoria: "bebida",
      precoVenda: 5000,
      precoCusto: 2000,
      stockAtual: 60,
      stockMinimo: 10,
      unidade: "unidade",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Sumo de Manga",
      categoria: "bebida",
      precoVenda: 6000,
      precoCusto: 2500,
      stockAtual: 20,
      stockMinimo: 5,
      unidade: "lata",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Frango Grelhado",
      categoria: "comida",
      precoVenda: 35000,
      precoCusto: 18000,
      stockAtual: 10,
      stockMinimo: 2,
      unidade: "prato",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Espetada Mista",
      categoria: "comida",
      precoVenda: 25000,
      precoCusto: 12000,
      stockAtual: 15,
      stockMinimo: 3,
      unidade: "prato",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Sandes Mista",
      categoria: "comida",
      precoVenda: 12000,
      precoCusto: 6000,
      stockAtual: 20,
      stockMinimo: 3,
      unidade: "prato",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Amendoins",
      categoria: "outros",
      precoVenda: 3000,
      precoCusto: 1000,
      stockAtual: 100,
      stockMinimo: 20,
      unidade: "unidade",
      ativo: true,
      criadoEm: Date.now(),
    },
    {
      nome: "Cigarro",
      categoria: "outros",
      precoVenda: 2000,
      precoCusto: 1200,
      stockAtual: 200,
      stockMinimo: 50,
      unidade: "unidade",
      ativo: true,
      criadoEm: Date.now(),
    },
  ];

  const adminPinHash = await hashPin("1234");

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ["produtos", "funcionarios", "config", "meta"],
      "readwrite",
    );

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const produtosStore = tx.objectStore("produtos");
    for (const p of produtos) {
      produtosStore.add(p);
    }

    const funcStore = tx.objectStore("funcionarios");
    funcStore.add({
      nome: "Admin",
      pinHash: adminPinHash,
      papel: "admin",
      ativo: true,
      criadoEm: Date.now(),
    });

    const configStore = tx.objectStore("config");
    configStore.put({
      id: 1,
      nomeNegocio: "Caixa Fácil Bar",
      moeda: "MZN",
      tema: "escuro",
      versao: "1.0.0",
    });

    const metaStore = tx.objectStore("meta");
    metaStore.put({ key: "seeded", value: true });
  });
}

// ---- BACKUP & RESTORE ----
export async function exportBackup(): Promise<string> {
  const [produtos, funcionarios, vendas, fiados, config] = await Promise.all([
    getAllFromStore<ProdutoDB>("produtos"),
    getAllFromStore<FuncionarioDB>("funcionarios"),
    getAllFromStore<VendaDB>("vendas"),
    getAllFromStore<FiadoDB>("fiado"),
    getConfig(),
  ]);

  return JSON.stringify(
    {
      versao: "1.0.0",
      exportadoEm: new Date().toISOString(),
      produtos,
      funcionarios,
      vendas,
      fiados,
      config,
    },
    null,
    2,
  );
}

export async function importBackup(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const stores = [
      "produtos",
      "funcionarios",
      "vendas",
      "fiado",
      "config",
      "meta",
    ];
    const tx = db.transaction(stores, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    // Clear existing data
    for (const s of stores) {
      tx.objectStore(s).clear();
    }

    // Import data
    if (data.produtos) {
      const store = tx.objectStore("produtos");
      for (const p of data.produtos as ProdutoDB[]) {
        store.put(p);
      }
    }
    if (data.funcionarios) {
      const store = tx.objectStore("funcionarios");
      for (const f of data.funcionarios as FuncionarioDB[]) {
        store.put(f);
      }
    }
    if (data.vendas) {
      const store = tx.objectStore("vendas");
      for (const v of data.vendas as VendaDB[]) {
        store.put(v);
      }
    }
    if (data.fiados) {
      const store = tx.objectStore("fiado");
      for (const f of data.fiados as FiadoDB[]) {
        store.put(f);
      }
    }
    if (data.config) {
      tx.objectStore("config").put(data.config);
    }

    tx.objectStore("meta").put({ key: "seeded", value: true });
  });
}

// ---- CURRENCY HELPERS ----
export function formatMZN(centavos: number): string {
  return `${(centavos / 100).toFixed(2)} MZN`;
}

export function centavosToDisplay(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function displayToCentavos(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

// ---- DATE HELPERS ----
export function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-MZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-MZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

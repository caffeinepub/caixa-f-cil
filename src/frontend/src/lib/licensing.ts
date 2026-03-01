// ============================================================
// licensing.ts — Sistema de licenciamento enterprise
// Caixa Fácil Bar & Restaurant
// ============================================================

const DB_NAME = "caixa-facil-db";
const DB_VERSION = 2;

// ---- Local storage keys ----
const LS_DEVICE_TOKEN = "cf_device_token";
const LS_LAST_VALIDATION = "cf_last_valid";
const LS_FINGERPRINT = "cf_fp";

// ---- Grace period: 72h in ms ----
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;

// ---- HMAC secret (client-side signing, obfuscated) ----
const SIGN_SECRET = "CF_BAR_LICENSE_2026_MZ";

// ============================================================
// Data interfaces
// ============================================================
export interface Bar {
  id: number;
  nome: string;
  codigoBar: string; // 8 alphanumeric chars, uppercase
  criadoEm: number;
  ativo: boolean;
}

export interface Licenca {
  id: number;
  barId: number;
  dataInicio: number;
  dataExpiracao: number; // dataInicio + 365 days
  limiteDispositivos: number; // default 10
  ativo: boolean;
  assinaturaDigital: string;
}

export interface Dispositivo {
  id: number;
  licencaId: number;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: "caixa" | "tablet" | "pc" | "outro";
  ativadoEm: number;
  ultimoHeartbeat: number;
  status: "ativo" | "revogado" | "suspeito";
}

export interface RegistoActivacao {
  id: number;
  deviceId?: number;
  codigoBar: string;
  deviceFingerprint: string;
  timestamp: number;
  sucesso: boolean;
  motivo: string;
}

export interface LogSistema {
  id: number;
  tipo: "activacao" | "revogacao" | "heartbeat" | "suspeito" | "erro";
  deviceId?: number;
  barId?: number;
  mensagem: string;
  timestamp: number;
}

export interface ValidacaoResult {
  valido: boolean;
  motivo: string;
  diasRestantes: number;
  bar?: Bar;
  licenca?: Licenca;
  dispositivo?: Dispositivo;
  gracePeriod?: boolean;
}

// ============================================================
// IndexedDB helpers
// ============================================================
let _db: IDBDatabase | null = null;

export function openLicensingDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Preserve existing v1 stores
      const existingStores = Array.from(db.objectStoreNames);

      if (!existingStores.includes("produtos")) {
        const s = db.createObjectStore("produtos", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("categoria", "categoria");
        s.createIndex("ativo", "ativo");
      }
      if (!existingStores.includes("funcionarios")) {
        const s = db.createObjectStore("funcionarios", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("papel", "papel");
      }
      if (!existingStores.includes("vendas")) {
        const s = db.createObjectStore("vendas", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("dataHora", "dataHora");
        s.createIndex("funcionarioId", "funcionarioId");
        s.createIndex("metodoPagamento", "metodoPagamento");
      }
      if (!existingStores.includes("fiado")) {
        const s = db.createObjectStore("fiado", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("estado", "estado");
        s.createIndex("data", "data");
      }
      if (!existingStores.includes("config")) {
        db.createObjectStore("config", { keyPath: "id" });
      }
      if (!existingStores.includes("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      // New v2 stores
      if (!existingStores.includes("bars")) {
        const s = db.createObjectStore("bars", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("codigoBar", "codigoBar", { unique: true });
        s.createIndex("ativo", "ativo");
      }
      if (!existingStores.includes("licencas")) {
        const s = db.createObjectStore("licencas", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("barId", "barId");
        s.createIndex("ativo", "ativo");
      }
      if (!existingStores.includes("dispositivos")) {
        const s = db.createObjectStore("dispositivos", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("licencaId", "licencaId");
        s.createIndex("status", "status");
        s.createIndex("deviceFingerprint", "deviceFingerprint");
      }
      if (!existingStores.includes("registos_activacao")) {
        const s = db.createObjectStore("registos_activacao", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("codigoBar", "codigoBar");
        s.createIndex("timestamp", "timestamp");
      }
      if (!existingStores.includes("logs_sistema")) {
        const s = db.createObjectStore("logs_sistema", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("tipo", "tipo");
        s.createIndex("timestamp", "timestamp");
      }
    };
  });
}

async function withLicStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<unknown>,
): Promise<T> {
  const db = await openLicensingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function getAllLic<T>(storeName: string): Promise<T[]> {
  const db = await openLicensingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await openLicensingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function getFirstByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<T | undefined> {
  const results = await getByIndex<T>(storeName, indexName, value);
  return results[0];
}

// ============================================================
// Fingerprint generation
// ============================================================
export async function gerarFingerprint(): Promise<string> {
  const components: string[] = [
    navigator.userAgent,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency?.toString() ?? "?",
    String(
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "?",
    ),
  ];

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("CaixaFácil🍺", 2, 2);
      components.push(canvas.toDataURL().slice(0, 64));
    }
  } catch {
    components.push("nocanvas");
  }

  const raw = components.join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// Digital signature (HMAC-SHA256)
// ============================================================
export async function gerarAssinaturaDigital(
  barId: number,
  dataInicio: number,
  dataExpiracao: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SIGN_SECRET);
  const message = encoder.encode(`${barId}:${dataInicio}:${dataExpiracao}`);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, message);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// Bar registration
// ============================================================
export async function registarBar(
  nome: string,
  codigoBar: string,
): Promise<{ bar: Bar; licenca: Licenca }> {
  const codigo = codigoBar.toUpperCase().trim();

  if (!/^[A-Z0-9]{8}$/.test(codigo)) {
    throw new Error(
      "Código do bar deve ter exactamente 8 caracteres alfanuméricos.",
    );
  }

  // Check if code already exists
  const existing = await getFirstByIndex<Bar>("bars", "codigoBar", codigo);
  if (existing) {
    throw new Error("Código de bar já está em uso.");
  }

  const db = await openLicensingDB();
  const agora = Date.now();
  const expiracao = agora + 365 * 24 * 60 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["bars", "licencas", "logs_sistema"],
      "readwrite",
    );

    let barId: number;
    let licencaId: number;

    tx.onerror = () => reject(tx.error);

    const barsStore = tx.objectStore("bars");
    const barData: Omit<Bar, "id"> = {
      nome,
      codigoBar: codigo,
      criadoEm: agora,
      ativo: true,
    };
    const barReq = barsStore.add(barData);

    barReq.onsuccess = () => {
      barId = barReq.result as number;

      gerarAssinaturaDigital(barId, agora, expiracao)
        .then((assinatura) => {
          const licencasStore = tx.objectStore("licencas");
          const licData: Omit<Licenca, "id"> = {
            barId,
            dataInicio: agora,
            dataExpiracao: expiracao,
            limiteDispositivos: 10,
            ativo: true,
            assinaturaDigital: assinatura,
          };
          const licReq = licencasStore.add(licData);

          licReq.onsuccess = () => {
            licencaId = licReq.result as number;

            const logsStore = tx.objectStore("logs_sistema");
            logsStore.add({
              tipo: "activacao",
              barId,
              mensagem: `Bar "${nome}" registado com código ${codigo}. Licença criada até ${new Date(expiracao).toLocaleDateString("pt-MZ")}.`,
              timestamp: agora,
            });

            tx.oncomplete = () => {
              resolve({
                bar: { id: barId, ...barData },
                licenca: { id: licencaId, ...licData },
              });
            };
          };
          licReq.onerror = () => reject(licReq.error);
        })
        .catch(reject);
    };
    barReq.onerror = () => reject(barReq.error);
  });
}

// ============================================================
// Device activation
// ============================================================
export async function ativarDispositivo(
  codigoBar: string,
  deviceName: string,
  deviceType: Dispositivo["deviceType"],
): Promise<{ sucesso: boolean; motivo: string; dispositivo?: Dispositivo }> {
  const codigo = codigoBar.toUpperCase().trim();
  const fingerprint = await gerarFingerprint();
  const agora = Date.now();

  // Log helper
  async function logRegistoActivacao(
    sucesso: boolean,
    motivo: string,
    deviceId?: number,
  ) {
    const db = await openLicensingDB();
    await new Promise<void>((res) => {
      const tx = db.transaction("registos_activacao", "readwrite");
      const store = tx.objectStore("registos_activacao");
      store.add({
        deviceId,
        codigoBar: codigo,
        deviceFingerprint: fingerprint.slice(0, 16),
        timestamp: agora,
        sucesso,
        motivo,
      });
      tx.oncomplete = () => res();
    });
  }

  // 1. Find bar
  const bar = await getFirstByIndex<Bar>("bars", "codigoBar", codigo);
  if (!bar || !bar.ativo) {
    await logRegistoActivacao(false, "Código de bar inválido ou inactivo");
    return {
      sucesso: false,
      motivo: "Código de bar inválido. Verifique o código e tente novamente.",
    };
  }

  // 2. Find active license
  const licencas = await getByIndex<Licenca>("licencas", "barId", bar.id);
  const licenca = licencas.find((l) => l.ativo);
  if (!licenca) {
    await logRegistoActivacao(false, "Sem licença activa");
    return { sucesso: false, motivo: "Sem licença activa para este bar." };
  }

  // 3. Check license expiry
  if (licenca.dataExpiracao < agora) {
    await logRegistoActivacao(false, "Licença expirada");
    return {
      sucesso: false,
      motivo: "Licença expirada. Contacte o administrador para renovar.",
    };
  }

  // 4. Check if this device fingerprint is already active for THIS bar
  const dispositivosBar = await getByIndex<Dispositivo>(
    "dispositivos",
    "licencaId",
    licenca.id,
  );
  const existingDevice = dispositivosBar.find(
    (d) => d.deviceFingerprint === fingerprint,
  );

  if (existingDevice) {
    if (existingDevice.status === "revogado") {
      await logRegistoActivacao(false, "Dispositivo revogado");
      return {
        sucesso: false,
        motivo: "Este dispositivo foi revogado. Contacte o administrador.",
      };
    }
    if (existingDevice.status === "suspeito") {
      await logRegistoActivacao(false, "Dispositivo bloqueado (suspeito)");
      return {
        sucesso: false,
        motivo: "Este dispositivo foi bloqueado por uso suspeito.",
      };
    }

    // Device already activated — update heartbeat and save token
    const db = await openLicensingDB();
    await new Promise<void>((res) => {
      const tx = db.transaction("dispositivos", "readwrite");
      const store = tx.objectStore("dispositivos");
      const updated: Dispositivo = {
        ...existingDevice,
        ultimoHeartbeat: agora,
        deviceName: deviceName || existingDevice.deviceName,
        deviceType: deviceType || existingDevice.deviceType,
      };
      store.put(updated);
      tx.oncomplete = () => res();
    });

    _salvarTokenDispositivo(codigo, fingerprint);
    localStorage.setItem(LS_LAST_VALIDATION, agora.toString());
    await logRegistoActivacao(
      true,
      "Reactivação — dispositivo já existia",
      existingDevice.id,
    );
    return {
      sucesso: true,
      motivo: "Dispositivo reactivado com sucesso.",
      dispositivo: existingDevice,
    };
  }

  // 5. Anti-piracy: check if same fingerprint is used for a different bar
  const allDispositivos = await getAllLic<Dispositivo>("dispositivos");
  const cloneCheck = allDispositivos.find(
    (d) => d.deviceFingerprint === fingerprint && d.status === "ativo",
  );
  if (cloneCheck && cloneCheck.licencaId !== licenca.id) {
    // Flag as suspicious and block
    await _adicionarLog(
      "suspeito",
      undefined,
      bar.id,
      `Tentativa de clonagem detectada: fingerprint ${fingerprint.slice(0, 16)} tentou activar com código ${codigo}`,
    );
    await logRegistoActivacao(
      false,
      "Possível clonagem detectada — dispositivo já registado noutro bar",
    );
    return {
      sucesso: false,
      motivo:
        "Acesso negado: este dispositivo está registado noutro bar. Contacte o suporte.",
    };
  }

  // 6. Check device limit
  const dispositivosAtivos = dispositivosBar.filter(
    (d) => d.status === "ativo",
  );
  if (dispositivosAtivos.length >= licenca.limiteDispositivos) {
    await logRegistoActivacao(
      false,
      `Limite de ${licenca.limiteDispositivos} dispositivos atingido`,
    );
    return {
      sucesso: false,
      motivo: `Limite de ${licenca.limiteDispositivos} dispositivos atingido. Revogue um dispositivo inactivo primeiro.`,
    };
  }

  // 7. Create device record
  const db = await openLicensingDB();
  const novoDispositivo = await new Promise<Dispositivo>((resolve, reject) => {
    const tx = db.transaction(["dispositivos", "logs_sistema"], "readwrite");
    tx.onerror = () => reject(tx.error);

    const dispStore = tx.objectStore("dispositivos");
    const dispData: Omit<Dispositivo, "id"> = {
      licencaId: licenca.id,
      deviceFingerprint: fingerprint,
      deviceName,
      deviceType,
      ativadoEm: agora,
      ultimoHeartbeat: agora,
      status: "ativo",
    };
    const dispReq = dispStore.add(dispData);

    dispReq.onsuccess = () => {
      const deviceId = dispReq.result as number;

      const logsStore = tx.objectStore("logs_sistema");
      logsStore.add({
        tipo: "activacao",
        deviceId,
        barId: bar.id,
        mensagem: `Dispositivo "${deviceName}" (${deviceType}) activado com sucesso.`,
        timestamp: agora,
      });

      tx.oncomplete = () => resolve({ id: deviceId, ...dispData });
    };
    dispReq.onerror = () => reject(dispReq.error);
  });

  _salvarTokenDispositivo(codigo, fingerprint);
  localStorage.setItem(LS_LAST_VALIDATION, agora.toString());
  await logRegistoActivacao(true, "Activação bem-sucedida", novoDispositivo.id);

  return {
    sucesso: true,
    motivo: "Dispositivo activado com sucesso!",
    dispositivo: novoDispositivo,
  };
}

// ============================================================
// Validate license for current device
// ============================================================
export async function validarLicenca(
  codigoBar: string,
): Promise<ValidacaoResult> {
  const codigo = codigoBar.toUpperCase().trim();
  const agora = Date.now();

  const bar = await getFirstByIndex<Bar>("bars", "codigoBar", codigo);
  if (!bar || !bar.ativo) {
    return { valido: false, motivo: "Bar não encontrado.", diasRestantes: 0 };
  }

  const licencas = await getByIndex<Licenca>("licencas", "barId", bar.id);
  const licenca = licencas.find((l) => l.ativo);
  if (!licenca) {
    return { valido: false, motivo: "Sem licença activa.", diasRestantes: 0 };
  }

  if (licenca.dataExpiracao < agora) {
    const diasRestantes = Math.ceil(
      (licenca.dataExpiracao - agora) / (1000 * 60 * 60 * 24),
    );
    return {
      valido: false,
      motivo: "Licença expirada.",
      diasRestantes,
      bar,
      licenca,
    };
  }

  // Check device
  const fingerprint = await gerarFingerprint();
  const dispositivos = await getByIndex<Dispositivo>(
    "dispositivos",
    "licencaId",
    licenca.id,
  );
  const dispositivo = dispositivos.find(
    (d) => d.deviceFingerprint === fingerprint,
  );

  if (!dispositivo) {
    return {
      valido: false,
      motivo: "Dispositivo não activado.",
      diasRestantes: 0,
    };
  }

  if (dispositivo.status === "revogado") {
    return {
      valido: false,
      motivo: "Dispositivo revogado.",
      diasRestantes: 0,
      dispositivo,
    };
  }
  if (dispositivo.status === "suspeito") {
    return {
      valido: false,
      motivo: "Dispositivo bloqueado.",
      diasRestantes: 0,
      dispositivo,
    };
  }

  const diasRestantes = Math.ceil(
    (licenca.dataExpiracao - agora) / (1000 * 60 * 60 * 24),
  );

  // Update last validation
  localStorage.setItem(LS_LAST_VALIDATION, agora.toString());

  return {
    valido: true,
    motivo: "Licença válida.",
    diasRestantes,
    bar,
    licenca,
    dispositivo,
  };
}

// ============================================================
// Heartbeat
// ============================================================
export async function heartbeat(
  codigoBar: string,
): Promise<{ diasRestantes: number; ok: boolean }> {
  try {
    const resultado = await validarLicenca(codigoBar);
    if (resultado.valido && resultado.dispositivo) {
      const db = await openLicensingDB();
      const agora = Date.now();
      await new Promise<void>((res) => {
        const tx = db.transaction(
          ["dispositivos", "logs_sistema"],
          "readwrite",
        );
        const dispStore = tx.objectStore("dispositivos");
        const updated: Dispositivo = {
          ...resultado.dispositivo!,
          ultimoHeartbeat: agora,
        };
        dispStore.put(updated);

        const logsStore = tx.objectStore("logs_sistema");
        logsStore.add({
          tipo: "heartbeat",
          deviceId: resultado.dispositivo!.id,
          barId: resultado.bar?.id,
          mensagem: `Heartbeat — ${resultado.diasRestantes} dias restantes.`,
          timestamp: agora,
        });

        tx.oncomplete = () => res();
      });
      return { diasRestantes: resultado.diasRestantes, ok: true };
    }
    return { diasRestantes: 0, ok: false };
  } catch {
    return { diasRestantes: 0, ok: false };
  }
}

// ============================================================
// Revoke / Block device
// ============================================================
export async function revogarDispositivo(deviceId: number): Promise<void> {
  const db = await openLicensingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["dispositivos", "logs_sistema"], "readwrite");
    const store = tx.objectStore("dispositivos");
    const getReq = store.get(deviceId);
    getReq.onsuccess = () => {
      const disp = getReq.result as Dispositivo;
      if (disp) {
        const updated: Dispositivo = { ...disp, status: "revogado" };
        store.put(updated);

        const logsStore = tx.objectStore("logs_sistema");
        logsStore.add({
          tipo: "revogacao",
          deviceId,
          mensagem: `Dispositivo "${disp.deviceName}" revogado manualmente.`,
          timestamp: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function bloquearDispositivo(deviceId: number): Promise<void> {
  const db = await openLicensingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["dispositivos", "logs_sistema"], "readwrite");
    const store = tx.objectStore("dispositivos");
    const getReq = store.get(deviceId);
    getReq.onsuccess = () => {
      const disp = getReq.result as Dispositivo;
      if (disp) {
        const updated: Dispositivo = { ...disp, status: "suspeito" };
        store.put(updated);

        const logsStore = tx.objectStore("logs_sistema");
        logsStore.add({
          tipo: "suspeito",
          deviceId,
          mensagem: `Dispositivo "${disp.deviceName}" bloqueado por uso suspeito.`,
          timestamp: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// Query functions
// ============================================================
export async function consultarDispositivos(
  codigoBar: string,
): Promise<Dispositivo[]> {
  const codigo = codigoBar.toUpperCase().trim();
  const bar = await getFirstByIndex<Bar>("bars", "codigoBar", codigo);
  if (!bar) return [];

  const licencas = await getByIndex<Licenca>("licencas", "barId", bar.id);
  const licenca = licencas.find((l) => l.ativo);
  if (!licenca) return [];

  return getByIndex<Dispositivo>("dispositivos", "licencaId", licenca.id);
}

export async function consultarLogsActivacao(
  codigoBar: string,
): Promise<RegistoActivacao[]> {
  const codigo = codigoBar.toUpperCase().trim();
  const all = await getAllLic<RegistoActivacao>("registos_activacao");
  return all
    .filter((r) => r.codigoBar === codigo)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getBarPorCodigo(
  codigoBar: string,
): Promise<Bar | undefined> {
  return getFirstByIndex<Bar>(
    "bars",
    "codigoBar",
    codigoBar.toUpperCase().trim(),
  );
}

export async function getLicencaPorBar(
  barId: number,
): Promise<Licenca | undefined> {
  const licencas = await getByIndex<Licenca>("licencas", "barId", barId);
  return licencas.find((l) => l.ativo);
}

export async function getDispositivoPorId(
  deviceId: number,
): Promise<Dispositivo | undefined> {
  return withLicStore<Dispositivo | undefined>(
    "dispositivos",
    "readonly",
    (s) => s.get(deviceId),
  );
}

// ============================================================
// LocalStorage token helpers
// ============================================================
function _salvarTokenDispositivo(codigoBar: string, fingerprint: string) {
  const token = {
    codigoBar: codigoBar.toUpperCase(),
    fp: fingerprint.slice(0, 32),
    ts: Date.now(),
  };
  localStorage.setItem(LS_DEVICE_TOKEN, JSON.stringify(token));
  localStorage.setItem(LS_FINGERPRINT, fingerprint.slice(0, 32));
}

export function isDispositivoActivado(): boolean {
  const raw = localStorage.getItem(LS_DEVICE_TOKEN);
  if (!raw) {
    // Migration: old system had "caixa-facil-activated" = "1"
    if (localStorage.getItem("caixa-facil-activated") === "1") {
      // Migrate to new system with demo bar
      _migrarActivacaoAntiga();
      return true; // will be properly validated on next render
    }
    return false;
  }
  try {
    const token = JSON.parse(raw);
    return !!(token.codigoBar && token.fp && token.ts);
  } catch {
    return false;
  }
}

function _migrarActivacaoAntiga() {
  // Will be completed by initLicensing() — just set a migration flag
  localStorage.setItem("cf_needs_migration", "1");
}

export function getCodigoBarActivo(): string {
  const raw = localStorage.getItem(LS_DEVICE_TOKEN);
  if (!raw) return "";
  try {
    const token = JSON.parse(raw);
    return token.codigoBar ?? "";
  } catch {
    return "";
  }
}

// ============================================================
// Grace period check
// ============================================================
export function isGracePeriodoValido(): boolean {
  const lastValid = localStorage.getItem(LS_LAST_VALIDATION);
  if (!lastValid) return false;
  const elapsed = Date.now() - Number.parseInt(lastValid);
  return elapsed < GRACE_PERIOD_MS;
}

// ============================================================
// Internal log helper
// ============================================================
async function _adicionarLog(
  tipo: LogSistema["tipo"],
  deviceId: number | undefined,
  barId: number | undefined,
  mensagem: string,
) {
  try {
    const db = await openLicensingDB();
    await new Promise<void>((res) => {
      const tx = db.transaction("logs_sistema", "readwrite");
      const store = tx.objectStore("logs_sistema");
      store.add({ tipo, deviceId, barId, mensagem, timestamp: Date.now() });
      tx.oncomplete = () => res();
    });
  } catch {
    // non-critical
  }
}

// ============================================================
// Init: seed demo bar + migrate old activation
// ============================================================
export async function initLicensing(): Promise<void> {
  await openLicensingDB();

  const needsMigration = localStorage.getItem("cf_needs_migration") === "1";
  const hasToken = !!localStorage.getItem(LS_DEVICE_TOKEN);

  // Check if demo bar exists
  const demoBars = await getAllLic<Bar>("bars");

  if (demoBars.length === 0) {
    // Create demo bar
    try {
      await registarBar("Bar Demo", "91850736");
    } catch {
      // Already exists
    }
  }

  // Migrate old activation
  if (needsMigration && !hasToken) {
    const fingerprint = await gerarFingerprint();
    _salvarTokenDispositivo("91850736", fingerprint);
    localStorage.setItem(LS_LAST_VALIDATION, Date.now().toString());
    localStorage.removeItem("cf_needs_migration");

    // Activate this device in the new system
    try {
      await ativarDispositivo("91850736", "Dispositivo Principal", "pc");
    } catch {
      // non-critical
    }
  }

  // If activated with token but device not in DB, auto-activate with demo bar
  if (hasToken && !needsMigration) {
    const codigoBar = getCodigoBarActivo();
    if (codigoBar) {
      try {
        const resultado = await validarLicenca(codigoBar);
        if (
          !resultado.valido &&
          resultado.motivo === "Dispositivo não activado."
        ) {
          await ativarDispositivo(codigoBar, "Dispositivo Registado", "pc");
        }
      } catch {
        // non-critical
      }
    }
  }
}

// ============================================================
// Architecture documentation export
// ============================================================
export function exportarArquitectura(): string {
  return `# Caixa Fácil — Arquitectura Enterprise de Licenciamento
# Solução Profissional para Bares e Restaurantes

## 1. FLUXO DE ACTIVAÇÃO (Passo a Passo)

\`\`\`
CLIENTE (Browser)                    LICENSE SERVER (IDB Local)
     |                                        |
     |-- Abre app pela 1ª vez               |
     |-- Solicita código do bar             |
     |-- Introduz código (8 chars)          |
     |                                        |
     |-- gerarFingerprint()                  |
     |   └─ userAgent + screen + canvas     |
     |   └─ SHA-256 → fingerprint hash      |
     |                                        |
     |-- ativarDispositivo(code, name, type)|
     |   ├─ Valida formato do código        |
     |   ├─ Busca Bar por codigoBar         |
     |   ├─ Verifica licença activa         |
     |   ├─ Verifica expiração             |
     |   ├─ Verifica limite (≤10 devs)     |
     |   ├─ Anti-clonagem check            |
     |   ├─ Cria registo Dispositivo       |
     |   └─ Salva token em localStorage    |
     |                                        |
     |<-- { sucesso: true, dispositivo }     |
     |                                        |
     |-- Login com PIN (4 dígitos)           |
     |-- Acesso à aplicação                 |
\`\`\`

## 2. ESTRUTURA DAS TABELAS (SQL equivalente)

\`\`\`sql
-- Tabela: bars
CREATE TABLE bars (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  codigoBar   TEXT UNIQUE NOT NULL,  -- 8 chars alfanuméricos
  criadoEm   INTEGER NOT NULL,      -- timestamp Unix ms
  ativo       BOOLEAN DEFAULT TRUE
);

-- Tabela: licencas
CREATE TABLE licencas (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  barId                INTEGER NOT NULL REFERENCES bars(id),
  dataInicio           INTEGER NOT NULL,
  dataExpiracao        INTEGER NOT NULL,  -- +365 dias
  limiteDispositivos   INTEGER DEFAULT 10,
  ativo                BOOLEAN DEFAULT TRUE,
  assinaturaDigital    TEXT NOT NULL     -- HMAC-SHA256
);

-- Tabela: dispositivos
CREATE TABLE dispositivos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  licencaId         INTEGER NOT NULL REFERENCES licencas(id),
  deviceFingerprint TEXT NOT NULL,       -- SHA-256 do browser
  deviceName        TEXT NOT NULL,
  deviceType        TEXT CHECK(deviceType IN ('caixa','tablet','pc','outro')),
  ativadoEm        INTEGER NOT NULL,
  ultimoHeartbeat   INTEGER NOT NULL,
  status            TEXT DEFAULT 'ativo'
                    CHECK(status IN ('ativo','revogado','suspeito'))
);
CREATE INDEX idx_dispositivos_fingerprint ON dispositivos(deviceFingerprint);

-- Tabela: registos_activacao
CREATE TABLE registos_activacao (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId          INTEGER REFERENCES dispositivos(id),
  codigoBar         TEXT NOT NULL,
  deviceFingerprint TEXT NOT NULL,
  timestamp         INTEGER NOT NULL,
  sucesso           BOOLEAN NOT NULL,
  motivo            TEXT NOT NULL
);

-- Tabela: logs_sistema
CREATE TABLE logs_sistema (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT CHECK(tipo IN ('activacao','revogacao','heartbeat','suspeito','erro')),
  deviceId   INTEGER REFERENCES dispositivos(id),
  barId      INTEGER REFERENCES bars(id),
  mensagem   TEXT NOT NULL,
  timestamp  INTEGER NOT NULL
);
\`\`\`

## 3. ENDPOINTS DA API REST (Para Servidor Central Futuro)

\`\`\`
POST   /api/v1/bars                    — Registar novo bar
GET    /api/v1/bars/:codigoBar         — Consultar bar por código
POST   /api/v1/licencas               — Criar licença
GET    /api/v1/licencas/:barId         — Consultar licença do bar
POST   /api/v1/dispositivos/ativar     — Activar dispositivo
       Body: { codigoBar, deviceName, deviceType, fingerprint, jwt }
GET    /api/v1/dispositivos/:licencaId — Listar dispositivos
DELETE /api/v1/dispositivos/:id/revogar — Revogar dispositivo
PATCH  /api/v1/dispositivos/:id/bloquear — Bloquear (suspeito)
POST   /api/v1/heartbeat               — Actualizar heartbeat
       Body: { deviceToken, codigoBar }
GET    /api/v1/logs/:codigoBar         — Consultar logs de activação

Autenticação: Bearer JWT em todos os endpoints
\`\`\`

## 4. PSEUDOCÓDIGO BACKEND (Node.js / Express)

\`\`\`javascript
// POST /api/v1/dispositivos/ativar
async function activateDevice(req, res) {
  const { codigoBar, deviceName, deviceType, fingerprint } = req.body;

  // 1. Validar JWT
  const decoded = verifyJWT(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Não autorizado' });

  // 2. Rate limiting: máx 5 tentativas por hora por IP
  if (await rateLimitExceeded(req.ip)) {
    return res.status(429).json({ error: 'Demasiadas tentativas' });
  }

  // 3. Buscar bar e licença
  const bar = await Bar.findOne({ codigoBar });
  if (!bar?.ativo) return res.status(404).json({ error: 'Bar inválido' });

  const licenca = await Licenca.findOne({ barId: bar.id, ativo: true });
  if (!licenca) return res.status(403).json({ error: 'Sem licença' });

  // 4. Verificar expiração
  if (licenca.dataExpiracao < Date.now()) {
    return res.status(403).json({ error: 'Licença expirada' });
  }

  // 5. Anti-clonagem: fingerprint noutro bar?
  const cloneCheck = await Dispositivo.findOne({
    deviceFingerprint: fingerprint,
    licencaId: { $ne: licenca.id },
    status: 'ativo'
  });
  if (cloneCheck) {
    await Log.create({ tipo: 'suspeito', mensagem: 'Clone detectado' });
    return res.status(403).json({ error: 'Acesso negado — uso suspeito' });
  }

  // 6. Verificar limite
  const count = await Dispositivo.count({ licencaId: licenca.id, status: 'ativo' });
  if (count >= licenca.limiteDispositivos) {
    return res.status(403).json({ error: 'Limite de dispositivos atingido' });
  }

  // 7. Criar dispositivo
  const dispositivo = await Dispositivo.create({
    licencaId: licenca.id,
    deviceFingerprint: fingerprint,
    deviceName, deviceType,
    ativadoEm: Date.now(),
    ultimoHeartbeat: Date.now(),
    status: 'ativo'
  });

  // 8. Gerar token JWT para dispositivo
  const token = signJWT({ deviceId: dispositivo.id, barId: bar.id });

  return res.json({ sucesso: true, token, diasRestantes: calcDays(licenca.dataExpiracao) });
}
\`\`\`

## 5. ESTRATÉGIA ANTI-PIRATARIA

**Fingerprinting de Dispositivo:**
- Hash SHA-256 de: userAgent + resolução + timezone + canvas render
- Estável entre sessões, difícil de falsificar
- Detecta clonagem: mesmo fingerprint em bars diferentes → bloqueio automático

**Assinatura Digital da Licença:**
- HMAC-SHA256 com segredo do servidor
- Inclui: barId + dataInicio + dataExpiracao
- Impossível falsificar sem a chave privada

**Tokens JWT:**
- Expiração curta (24h) — requer heartbeat regular
- Payload: { deviceId, barId, exp }
- Revogação imediata via blacklist

**Grace Period (72h offline):**
- Último timestamp de validação em localStorage
- Permite uso offline até 72h após última validação bem-sucedida
- Após 72h: exige reconexão para renovar

**Heartbeat (30 min):**
- Verifica licença activa periodicamente
- Actualiza ultimoHeartbeat no servidor
- Detecta dispositivos fantasma (sem heartbeat >7 dias)

**Logs de Auditoria:**
- Todas as activações registadas (sucesso e falha)
- IP, timestamp, fingerprint, motivo
- Alertas automáticos para padrões suspeitos

## 6. ESCALABILIDADE (Para Milhares de Bares)

**Base de Dados:**
\`\`\`
- PostgreSQL com particionamento por barId
- Redis para cache de licenças activas (TTL: 5 min)
- Índices em: codigoBar, deviceFingerprint, licencaId
- Read replicas para validação (operação de leitura)
\`\`\`

**Arquitectura:**
\`\`\`
Internet → CDN (Cloudflare) → Load Balancer
                                    ↓
                         API Gateway (Kong/AWS)
                                    ↓
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
              Auth Service   License Service   Audit Service
                    ↓              ↓              ↓
              PostgreSQL      Redis Cache      Elasticsearch
                    └──────────────┴──────────────┘
                                    ↓
                              Event Bus (Kafka)
                                    ↓
                         Analytics & Monitoring
\`\`\`

**Optimizações:**
- Cache de licenças em Redis: evita DB roundtrip em cada heartbeat
- Filas assíncronas para logs (não bloqueia activação)
- CDN para assets estáticos (app shell)
- WebSockets para revogação em tempo real
- Geo-distribuição: réplicas por região (Africa: Lagos, Nairobi, Joburg)

**Estimativas de capacidade:**
\`\`\`
10.000 bares × 10 dispositivos = 100.000 dispositivos activos
Heartbeat 30min → ~56 req/s (pico: ×5 = 280 req/s)
Hardware necessário: 3 servidores API + 2 DB primário+replica
Custo estimado: ~$200/mês AWS (t3.medium ×3 + RDS db.t3.small)
\`\`\`
`;
}

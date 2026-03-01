import { CreditCard, Key, Settings, Users, X } from "lucide-react";

interface MaisMenuProps {
  onNavigate: (screen: string) => void;
  onClose: () => void;
}

const maisItems = [
  {
    screen: "funcionarios",
    label: "Funcionários",
    description: "Gerir equipa e PINs",
    icon: Users,
  },
  {
    screen: "fiado",
    label: "Fiado",
    description: "Vendas a crédito",
    icon: CreditCard,
  },
  {
    screen: "licenca",
    label: "Licença",
    description: "Dispositivos, logs, arquitectura",
    icon: Key,
  },
  {
    screen: "configuracoes",
    label: "Configurações",
    description: "Negócio, backup, segurança",
    icon: Settings,
  },
];

export function MaisMenu({ onNavigate, onClose }: MaisMenuProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display text-2xl font-black text-foreground">
          Mais
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:opacity-70"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {maisItems.map(({ screen, label, description, icon: Icon }) => (
          <button
            key={screen}
            type="button"
            onClick={() => onNavigate(screen)}
            className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl text-left active:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-light flex items-center justify-center shrink-0">
              <Icon size={20} className="text-amber" />
            </div>
            <div>
              <p className="font-medium text-foreground">{label}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

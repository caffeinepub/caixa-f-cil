import {
  BarChart2,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  ShoppingCart,
} from "lucide-react";

type NavTab = "dashboard" | "venda" | "produtos" | "relatorios" | "mais";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: NavTab) => void;
}

const navItems = [
  { tab: "dashboard" as NavTab, label: "Início", icon: LayoutDashboard },
  { tab: "venda" as NavTab, label: "Venda", icon: ShoppingCart },
  { tab: "produtos" as NavTab, label: "Produtos", icon: Package },
  { tab: "relatorios" as NavTab, label: "Relatórios", icon: BarChart2 },
  { tab: "mais" as NavTab, label: "Mais", icon: MoreHorizontal },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map(({ tab, label, icon: Icon }) => {
          const isActive =
            tab === "mais"
              ? ["funcionarios", "fiado", "configuracoes"].includes(activeTab)
              : activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors active:opacity-70 ${
                isActive ? "text-amber" : "text-muted-foreground"
              }`}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={isActive ? "text-amber" : ""}
              />
              <span
                className={`text-[10px] font-medium ${isActive ? "text-amber font-bold" : ""}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  MessageSquare,
  Camera,
  User,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  {
    href: "/dashboard",
    icon: Home,
    label: "Inicio",
  },
  {
    href: "/menu",
    icon: CalendarDays,
    label: "Menú",
  },
  {
    href: "/exercises",
    icon: Dumbbell,
    label: "Ejercicio",
  },
  {
    href: "/chat",
    icon: MessageSquare,
    label: "Chat",
  },
  {
    href: "/profile",
    icon: User,
    label: "Perfil",
  },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-lg safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // Fitts Law: 48px minimum touch target
                "relative flex h-12 w-16 flex-col items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110",
                )}
              />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

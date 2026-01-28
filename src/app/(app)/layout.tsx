import { BottomNavigation } from "@/components/layout/bottom-navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNavigation />
    </div>
  );
}

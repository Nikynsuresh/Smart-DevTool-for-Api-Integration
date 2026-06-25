import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#07080b] text-slate-100 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col relative bg-[#07080b]">
        {children}
      </main>
    </div>
  );
}

import { ClickerGame } from "@/components/clicker/ClickerGame";
import { loadClicker } from "@/lib/clicker/store";

export const dynamic = "force-dynamic";

export default async function ClickerPage() {
  const data = await loadClicker();
  return <ClickerGame initial={data} />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import ListPageClient from "@/components/ListPageClient";
import ListPageAuthenticated from "@/components/ListPageAuthenticated";

export default async function ListPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    const demoMode = cookieStore.get("moodlog_demo_mode")?.value;
    if (demoMode === "true") {
      return <ListPageClient />;
    }
    redirect("/");
  }

  const res = await fetchWithAuth("/entries?offset=0&limit=7");
  const data = res.ok ? await res.json() : { entries: [] };

  return <ListPageAuthenticated initialEntries={data.entries || []} />;
}

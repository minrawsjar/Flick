import type { Metadata } from "next";
import { connection } from "next/server";
import type { DashboardData } from "@backend/dashboard-data";
import { api } from "@/lib/api";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  // Live PayPal data: render per request, not at build time.
  await connection();
  const [data, models] = await Promise.all([
    api<DashboardData>("/api/dashboard"),
    api<string[]>("/api/ai/models"),
  ]);

  // Only the model ids reach the client; the OpenAI key stays in the backend (backend/src/ai.ts).
  return (
    <Dashboard
      data={data}
      licenseKey={process.env.AG_STUDIO}
      aiModels={models.length > 0 ? models : undefined}
    />
  );
}

import { useState, type FormEvent } from "react";
import { usePluginData, usePluginAction, type PluginPageProps } from "@paperclipai/plugin-sdk/ui";
import type { BillingAccountData } from "../types.js";

type OverviewData = {
  accounts: Array<{ id: string; externalId: string } & BillingAccountData>;
};

export function BillingPage(_props: PluginPageProps) {
  const { data, loading, error, refresh } = usePluginData<OverviewData>("billing-overview");
  const createAccount = usePluginAction("create-billing-account");
  const [showForm, setShowForm] = useState(false);

  if (loading) return <div style={{ padding: 24 }}>Loading billing data...</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>Error loading billing data</div>;
  if (!data) return null;

  const statusColor: Record<string, string> = {
    active: "#22c55e",
    past_due: "#f59e0b",
    suspended: "#ef4444",
    cancelled: "#6b7280",
  };

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createAccount({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      companyIds: [],
      markupPercent: Number(formData.get("markup") || 30),
    });
    setShowForm(false);
    refresh();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Billing Accounts</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Create Account"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Name</label>
            <input name="name" required style={{ width: "100%", padding: 6 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Email</label>
            <input name="email" type="email" required style={{ width: "100%", padding: 6 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Markup %</label>
            <input name="markup" type="number" defaultValue={30} style={{ width: 80, padding: 6 }} />
          </div>
          <button type="submit">Create</button>
        </form>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
            <th style={{ textAlign: "left", padding: 8 }}>Name</th>
            <th style={{ textAlign: "left", padding: 8 }}>Email</th>
            <th style={{ textAlign: "left", padding: 8 }}>Status</th>
            <th style={{ textAlign: "left", padding: 8 }}>Markup</th>
            <th style={{ textAlign: "left", padding: 8 }}>Companies</th>
            <th style={{ textAlign: "left", padding: 8 }}>Stripe ID</th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.map((account) => (
            <tr key={account.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: 8 }}>{account.name}</td>
              <td style={{ padding: 8 }}>{account.email}</td>
              <td style={{ padding: 8 }}>
                <span style={{
                  color: statusColor[account.status] ?? "#6b7280",
                  fontWeight: 600,
                  fontSize: 13,
                }}>
                  {account.status}
                </span>
              </td>
              <td style={{ padding: 8 }}>{account.markupPercent}%</td>
              <td style={{ padding: 8 }}>{account.companyIds.length}</td>
              <td style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>{account.externalId}</td>
            </tr>
          ))}
          {data.accounts.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>No billing accounts</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

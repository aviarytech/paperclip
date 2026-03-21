import { usePluginData, type PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";
import type { BillingAccountData } from "../types.js";

type OverviewData = {
  accounts: Array<{ id: string; externalId: string } & BillingAccountData>;
};

export function BillingWidget(_props: PluginWidgetProps) {
  const { data, loading, error } = usePluginData<OverviewData>("billing-overview");

  if (loading) return <div style={{ padding: 16 }}>Loading billing...</div>;
  if (error) return <div style={{ padding: 16, color: "red" }}>Error loading billing data</div>;
  if (!data) return null;

  const active = data.accounts.filter((a) => a.status === "active").length;
  const pastDue = data.accounts.filter((a) => a.status === "past_due").length;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Billing</div>
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data.accounts.length}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Accounts</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{active}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Active</div>
        </div>
        {pastDue > 0 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{pastDue}</div>
            <div style={{ fontSize: 12, color: "#666" }}>Past Due</div>
          </div>
        )}
      </div>
    </div>
  );
}

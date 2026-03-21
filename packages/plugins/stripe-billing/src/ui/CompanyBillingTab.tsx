import { useHostContext, usePluginData, usePluginAction, type PluginDetailTabProps } from "@paperclipai/plugin-sdk/ui";

type CompanyBillingData = {
  linked: boolean;
  account?: {
    id: string;
    externalId: string;
    name: string;
    email: string;
    status: string;
    markupPercent: number;
  };
  invoices?: Array<{
    id: string;
    externalId: string;
    amountCents: number;
    status: string;
    periodStart: string;
    periodEnd: string;
  }>;
};

export function CompanyBillingTab(_props: PluginDetailTabProps) {
  const { entityId } = useHostContext();
  const { data, loading, error, refresh } = usePluginData<CompanyBillingData>("company-billing", { companyId: entityId });
  const unlinkCompany = usePluginAction("unlink-company");

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "red" }}>Error: {String(error)}</div>;
  if (!data || !data.linked) {
    return (
      <div style={{ padding: 16 }}>
        <p>No billing account linked to this company.</p>
      </div>
    );
  }

  const { account, invoices = [] } = data;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: "0 0 12px" }}>Billing Account</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          <tr><td style={{ fontWeight: 600, padding: 4 }}>Name</td><td style={{ padding: 4 }}>{account!.name}</td></tr>
          <tr><td style={{ fontWeight: 600, padding: 4 }}>Email</td><td style={{ padding: 4 }}>{account!.email}</td></tr>
          <tr><td style={{ fontWeight: 600, padding: 4 }}>Status</td><td style={{ padding: 4 }}>{account!.status}</td></tr>
          <tr><td style={{ fontWeight: 600, padding: 4 }}>Markup</td><td style={{ padding: 4 }}>{account!.markupPercent}%</td></tr>
          <tr><td style={{ fontWeight: 600, padding: 4 }}>Stripe ID</td><td style={{ padding: 4 }}>{account!.externalId}</td></tr>
        </tbody>
      </table>

      <button onClick={async () => { await unlinkCompany({ companyId: entityId }); refresh(); }}>
        Unlink
      </button>

      {invoices.length > 0 && (
        <>
          <h3 style={{ margin: "16px 0 8px" }}>Invoices</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 4 }}>Invoice</th>
                <th style={{ textAlign: "left", padding: 4 }}>Amount</th>
                <th style={{ textAlign: "left", padding: 4 }}>Status</th>
                <th style={{ textAlign: "left", padding: 4 }}>Period</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ padding: 4 }}>{inv.externalId}</td>
                  <td style={{ padding: 4 }}>${(inv.amountCents / 100).toFixed(2)}</td>
                  <td style={{ padding: 4 }}>{inv.status}</td>
                  <td style={{ padding: 4 }}>{new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandlordNavbar } from "@/components/landlord/landlord-navbar";
import { StatsCard } from "@/components/dashboard/stats-card";
import { StatusChart } from "@/components/dashboard/status-chart";
import { PropertyMap } from "@/components/dashboard/property-map";
import { IssuesTable, type Issue, type IssueStatus } from "@/components/dashboard/issues-table";
import { LayoutDashboard, AlertCircle, Clock, DollarSign, CheckCircle } from "lucide-react";
import {
  approveIssue,
  fetchIssues,
  fetchVendors,
  fetchWallets,
  formatDate,
  mapIssueStatus,
  rejectIssue,
  topupWallet,
  updateWalletBalance,
  type WalletSummary,
} from "@/lib/api";

const sampleProperties = [
  {
    id: "1",
    name: "Alster Residences",
    address: "Jungfernstieg 12, Hamburg",
    activeIssues: 3,
    position: { x: 30, y: 35 },
  },
  {
    id: "2",
    name: "Speicherstadt Lofts",
    address: "Brooktorkai 5, Hamburg",
    activeIssues: 1,
    position: { x: 55, y: 55 },
  },
  {
    id: "3",
    name: "HafenCity Plaza",
    address: "Am Sandtorkai 48, Hamburg",
    activeIssues: 0,
    position: { x: 75, y: 45 },
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [walletEdits, setWalletEdits] = useState<Record<string, string>>({});
  const [topupEdits, setTopupEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [apiIssues, apiVendors, apiWallets] = await Promise.all([
          fetchIssues(),
          fetchVendors(),
          fetchWallets(),
        ]);
        const vendorMap = new Map(apiVendors.map((vendor) => [vendor.id, vendor.name]));
        const mappedIssues: Issue[] = apiIssues.map((issue) => ({
          id: issue.id,
          summary: issue.summary,
          dateReported: formatDate(issue.created_at),
          tenantName: `Tenant ${issue.tenant_id.slice(0, 6)}`,
          vendor: issue.vendor_id ? vendorMap.get(issue.vendor_id) ?? "Unassigned" : "Unassigned",
          cost: issue.estimated_cost ?? 0,
          urgency:
            issue.category === "plumbing" ||
            issue.category === "heating" ||
            issue.category === "electrical"
              ? "High"
              : "Medium",
          status: mapIssueStatus(issue.status) as IssueStatus,
        }));
        if (isMounted) {
          setIssues(mappedIssues);
          setWallets(apiWallets);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIssues([]);
          setWallets([]);
          setLoading(false);
        }
        console.error(error);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === id ? { ...issue, status } : issue
      )
    );
    if (status === "Approved") {
      await approveIssue(id);
    }
    if (status === "Rejected") {
      await rejectIssue(id);
    }
  };

  const refreshWallets = async () => {
    try {
      const apiWallets = await fetchWallets();
      setWallets(apiWallets);
    } catch (error) {
      console.error(error);
    }
  };

  const handleWalletBalanceSave = async (propertyId: string) => {
    const value = walletEdits[propertyId];
    if (!value) return;
    const balance = Number(value);
    if (Number.isNaN(balance)) return;
    await updateWalletBalance({ property_id: propertyId, balance });
    await refreshWallets();
  };

  const handleWalletTopup = async (propertyId: string) => {
    const value = topupEdits[propertyId];
    if (!value) return;
    const amount = Number(value);
    if (Number.isNaN(amount)) return;
    await topupWallet({ property_id: propertyId, amount, note: "Manual top-up" });
    setTopupEdits((prev) => ({ ...prev, [propertyId]: "" }));
    await refreshWallets();
  };

  const handleChat = (id: string) => {
    // Navigate to landlord chat page with issue id
    router.push(`/dashboard/chat/${id}`);
  };

  const handleDownloadReport = async (id: string) => {
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Issue Report #${id}`, 14, 20);
    doc.setFontSize(11);
    const lines = [
      `Summary: ${issue.summary}`,
      `Tenant: ${issue.tenantName}`,
      `Date Reported: ${issue.dateReported}`,
      `Status: ${issue.status}`,
      `Vendor: ${issue.vendor}`,
      `Cost: $${issue.cost.toLocaleString()}`,
    ];
    let y = 32;
    lines.forEach((line) => {
      doc.text(line, 14, y);
      y += 8;
    });
    doc.save(`issue-report-${id}.pdf`);
  };

  // Calculate stats
  const openIssues = issues.filter((i) => i.status !== "Completed" && i.status !== "Rejected").length;
  const pendingApproval = issues.filter((i) => i.status === "Pending").length;
  const completedIssues = issues.filter((i) => i.status === "Completed").length;
  const totalSpend = issues
    .filter((i) => i.status === "Completed" || i.status === "Approved" || i.status === "In Progress")
    .reduce((sum, i) => sum + i.cost, 0);

  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalWalletUsed = wallets.reduce((sum, wallet) => sum + wallet.used, 0);
  const totalWalletRemaining = wallets.reduce((sum, wallet) => sum + wallet.remaining, 0);

  // Chart data
  const statusChartData = [
    { status: "Pending", count: issues.filter(i => i.status === "Pending").length },
    { status: "Approved", count: issues.filter(i => i.status === "Approved").length },
    { status: "In Progress", count: issues.filter(i => i.status === "In Progress").length },
    { status: "Completed", count: issues.filter(i => i.status === "Completed").length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandlordNavbar notificationCount={pendingApproval} />
      <main className="container px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Landlord Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage and approve tenant maintenance requests
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatsCard
            title="Open Issues"
            value={openIssues}
            icon={AlertCircle}
            loading={loading}
          />
          <StatsCard
            title="Pending Approval"
            value={pendingApproval}
            icon={Clock}
            loading={loading}
          />
          <StatsCard
            title="Completed"
            value={completedIssues}
            icon={CheckCircle}
            loading={loading}
          />
          <StatsCard
            title="Total Spend"
            value={`$${totalSpend.toLocaleString()}`}
            icon={DollarSign}
            loading={loading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatsCard
            title="Wallet Total"
            value={`$${totalWalletBalance.toLocaleString()}`}
            icon={DollarSign}
            loading={loading}
          />
          <StatsCard
            title="Wallet Used"
            value={`$${totalWalletUsed.toLocaleString()}`}
            icon={DollarSign}
            loading={loading}
          />
          <StatsCard
            title="Wallet Remaining"
            value={`$${totalWalletRemaining.toLocaleString()}`}
            icon={DollarSign}
            loading={loading}
          />
        </div>

        {/* Charts and Map Row */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <StatusChart data={statusChartData} />
          <PropertyMap
            properties={sampleProperties.map((property) => {
              const wallet = wallets.find((item) => item.property_id === property.id);
              return {
                ...property,
                walletBalance: wallet?.balance,
                walletUsed: wallet?.used,
                walletRemaining: wallet?.remaining,
              };
            })}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Property Wallets
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sampleProperties.map((property) => {
              const wallet = wallets.find((item) => item.property_id === property.id);
              return (
                <div
                  key={property.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{property.name}</p>
                      <p className="text-xs text-muted-foreground">{property.address}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Used: ${wallet?.used.toLocaleString() ?? 0}</div>
                      <div>Remaining: ${wallet?.remaining.toLocaleString() ?? 0}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        placeholder={wallet ? `${wallet.balance}` : "Set balance"}
                        value={walletEdits[property.id] ?? ""}
                        onChange={(event) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [property.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                        onClick={() => handleWalletBalanceSave(property.id)}
                      >
                        Save
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Top-up amount"
                        value={topupEdits[property.id] ?? ""}
                        onChange={(event) =>
                          setTopupEdits((prev) => ({
                            ...prev,
                            [property.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                        onClick={() => handleWalletTopup(property.id)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues Table */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Maintenance Requests
          </h2>
          <IssuesTable
            issues={issues}
            onStatusChange={handleStatusChange}
            onChat={handleChat}
            onDownloadReport={handleDownloadReport}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}

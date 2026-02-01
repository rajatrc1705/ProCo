"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandlordNavbar } from "@/components/landlord/landlord-navbar";
import { StatsCard } from "@/components/dashboard/stats-card";
import { StatusChart } from "@/components/dashboard/status-chart";
import { PropertyMap } from "@/components/dashboard/property-map";
import { IssuesTable, type Issue, type IssueStatus } from "@/components/dashboard/issues-table";
import { LayoutDashboard, AlertCircle, Clock, DollarSign, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  approveIssue,
  type ApiVendor,
  fetchIssues,
  fetchProperties,
  fetchUser,
  fetchVendors,
  fetchWallets,
  formatDate,
  mapIssueStatus,
  rejectIssue,
  topupWallet,
  updateWalletBalance,
  type WalletSummary,
} from "@/lib/api";

type Property = {
  id: string;
  name: string;
  address: string;
  activeIssues: number;
  latitude?: number | null;
  longitude?: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [walletEdits, setWalletEdits] = useState<Record<string, string>>({});
  const [topupEdits, setTopupEdits] = useState<Record<string, string>>({});
  const [issueSearch, setIssueSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [apiIssues, apiVendors, apiWallets, apiProperties] = await Promise.all([
          fetchIssues(),
          fetchVendors(),
          fetchWallets(),
          fetchProperties(),
        ]);
        const vendorMap = new Map(apiVendors.map((vendor) => [vendor.id, vendor.name]));
        const propertyAddressMap = new Map(
          apiProperties.map((property) => [property.id, property.address])
        );
        const uniqueTenantIds = Array.from(new Set(apiIssues.map((issue) => issue.tenant_id)));
        const tenantEntries = await Promise.all(
          uniqueTenantIds.map(async (tenantId) => {
            try {
              const user = await fetchUser(tenantId);
              return [tenantId, user.name] as const;
            } catch (error) {
              console.error(error);
              return [tenantId, "Unknown"] as const;
            }
          })
        );
        const tenantMap = new Map(tenantEntries);
        const mappedIssues: Issue[] = apiIssues.map((issue) => ({
          id: issue.id,
          summary: issue.summary,
          description: issue.description,
          propertyId: issue.property_id,
          propertyAddress: propertyAddressMap.get(issue.property_id) ?? "Unknown property",
          category: issue.category,
          dateReported: formatDate(issue.created_at),
          dateAppointment: formatDate(issue.appointment_at ?? undefined),
          tenantName: tenantMap.get(issue.tenant_id) ?? "Unknown",
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
        const activeIssuesByProperty = apiIssues.reduce<Record<string, number>>(
          (acc, issue) => {
            const status = mapIssueStatus(issue.status);
            if (status !== "Completed" && status !== "Rejected") {
              acc[issue.property_id] = (acc[issue.property_id] ?? 0) + 1;
            }
            return acc;
          },
          {}
        );
        const mappedProperties: Property[] = apiProperties.map((property) => ({
          id: property.id,
          name: property.address.split(",")[0] ?? property.address,
          address: property.address,
          activeIssues: activeIssuesByProperty[property.id] ?? 0,
          latitude: property.latitude,
          longitude: property.longitude,
        }));
        if (isMounted) {
          setIssues(mappedIssues);
          setVendors(apiVendors);
          setWallets(apiWallets);
          setProperties(mappedProperties);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIssues([]);
          setVendors([]);
          setWallets([]);
          setProperties([]);
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
    if (status === "Not Enough Budget") {
      return;
    }
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

  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalWalletUsed = wallets.reduce((sum, wallet) => sum + wallet.used, 0);
  const totalWalletRemaining = wallets.reduce((sum, wallet) => sum + wallet.remaining, 0);

  const walletRemainingByProperty = wallets.reduce<Record<string, number>>(
    (acc, wallet) => {
      acc[wallet.property_id] = wallet.remaining;
      return acc;
    },
    {}
  );

  const suggestedVendorsByIssue = issues.reduce<Record<string, ApiVendor[]>>(
    (acc, issue) => {
      const desired = issue.category === "other" ? "general" : issue.category;
      acc[issue.id] = vendors.filter((vendor) => vendor.specialty === desired);
      return acc;
    },
    {}
  );

  const issuesWithBudgetStatus = issues.map((issue) => {
    const remaining = walletRemainingByProperty[issue.propertyId] ?? 0;
    const suggested = suggestedVendorsByIssue[issue.id] ?? [];
    const withinBudget = suggested.filter((vendor) => vendor.hourly_rate <= remaining);
    if (
      withinBudget.length === 0 &&
      issue.status !== "Completed" &&
      issue.status !== "Rejected"
    ) {
      return { ...issue, status: "Not Enough Budget" as IssueStatus };
    }
    return issue;
  });

  // Calculate stats
  const openIssues = issuesWithBudgetStatus.filter(
    (i) => i.status !== "Completed" && i.status !== "Rejected"
  ).length;
  const pendingApproval = issuesWithBudgetStatus.filter((i) => i.status === "Pending").length;
  const completedIssues = issuesWithBudgetStatus.filter((i) => i.status === "Completed").length;
  const totalSpend = issuesWithBudgetStatus
    .filter((i) => i.status === "Completed" || i.status === "Approved" || i.status === "In Progress")
    .reduce((sum, i) => sum + i.cost, 0);

  // Chart data
  const statusChartData = [
    { status: "Pending", count: issuesWithBudgetStatus.filter(i => i.status === "Pending").length },
    { status: "Approved", count: issuesWithBudgetStatus.filter(i => i.status === "Approved").length },
    { status: "In Progress", count: issuesWithBudgetStatus.filter(i => i.status === "In Progress").length },
    { status: "Not Enough Budget", count: issuesWithBudgetStatus.filter(i => i.status === "Not Enough Budget").length },
    { status: "Completed", count: issuesWithBudgetStatus.filter(i => i.status === "Completed").length },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <LandlordNavbar />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8 rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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

        {/* Charts and Map Row */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <StatusChart data={statusChartData} />
          <PropertyMap
            properties={properties.map((property) => {
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
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Property Wallets
            </h2>
            <p className="text-xs text-muted-foreground">
              Total ${totalWalletBalance.toLocaleString()} · Used $
              {totalWalletUsed.toLocaleString()} · Remaining $
              {totalWalletRemaining.toLocaleString()}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => {
              const wallet = wallets.find((item) => item.property_id === property.id);
              return (
                <Card
                  key={property.id}
                  className="border-border/70 bg-card/90 shadow-sm"
                >
                  <CardContent className="p-4">
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
                        <Input
                          placeholder={wallet ? `${wallet.balance}` : "Set balance"}
                          value={walletEdits[property.id] ?? ""}
                          onChange={(event) =>
                            setWalletEdits((prev) => ({
                              ...prev,
                              [property.id]: event.target.value,
                            }))
                          }
                        />
                        <Button onClick={() => handleWalletBalanceSave(property.id)}>
                          Save
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Top-up amount"
                          value={topupEdits[property.id] ?? ""}
                          onChange={(event) =>
                            setTopupEdits((prev) => ({
                              ...prev,
                              [property.id]: event.target.value,
                            }))
                          }
                        />
                        <Button variant="secondary" onClick={() => handleWalletTopup(property.id)}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Issues Table */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Maintenance Requests
            </h2>
            <Input
              value={issueSearch}
              onChange={(event) => setIssueSearch(event.target.value)}
              placeholder="Search by property or tenant"
              className="w-full sm:w-[260px]"
            />
          </div>
          <IssuesTable
            issues={issuesWithBudgetStatus.filter((issue) => {
              const term = issueSearch.trim().toLowerCase();
              if (!term) return true;
              return (
                issue.propertyAddress.toLowerCase().includes(term) ||
                issue.tenantName.toLowerCase().includes(term)
              );
            })}
            onStatusChange={handleStatusChange}
            onChat={handleChat}
            onDownloadReport={handleDownloadReport}
            vendors={vendors}
            walletRemainingByProperty={walletRemainingByProperty}
            suggestedVendorsByIssue={suggestedVendorsByIssue}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}

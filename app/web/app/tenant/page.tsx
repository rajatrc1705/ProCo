"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TenantNavbar } from "@/components/tenant/tenant-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MessageSquare, Calendar } from "lucide-react";
import { fetchIssues, fetchUser, fetchVendors, formatDate, mapIssueStatus } from "@/lib/api";
import { useActiveTenant } from "@/lib/tenant";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IssueStatus = "Pending" | "Approved" | "In Progress" | "Completed";

interface SubmittedIssue {
  id: string;
  summary: string;
  status: IssueStatus;
  dateSubmitted: string;
  createdAt: string;
}

interface TenantIssue {
  id: string;
  summary: string;
  createdAt: string;
  appointmentAt: string | null;
  vendorId: string | null;
  status: string;
}

interface AppointmentRow {
  id: string;
  vendorName: string;
  date: string;
  issueTitle: string;
}

type IssueViewMode = "mine" | "apartment";

function getStatusColor(status: IssueStatus) {
  switch (status) {
    case "Pending":
      return "bg-warning/10 text-warning-foreground border-warning/20";
    case "Approved":
      return "bg-info/10 text-info border-info/20";
    case "In Progress":
      return "bg-primary/10 text-primary border-primary/20";
    case "Completed":
      return "bg-success/10 text-success border-success/20";
    default:
      return "";
  }
}

const faqs = [
  {
    question: "How long do repairs typically take?",
    answer: "Most repairs are addressed within 3-5 business days. Emergency issues like no heat or water leaks are prioritized and typically resolved within 24 hours.",
  },
  {
    question: "How will I be notified about my issue status?",
    answer: "You'll receive notifications in the app when there are updates to your issues. Click the bell icon in the top navigation to see all your notifications.",
  },
  {
    question: "Can I track my issue after reporting?",
    answer: "Yes! Your submitted issues are listed on this page with their current status. Click the chat icon to continue the conversation about any issue.",
  },
  {
    question: "What if I need to cancel or reschedule a repair?",
    answer: "Contact your landlord through the app or reach out to the assigned vendor directly. You can find contact information in your issue details.",
  },
];

export default function TenantHomePage() {
  const router = useRouter();
  const { tenantId } = useActiveTenant();
  const [submittedIssues, setSubmittedIssues] = useState<SubmittedIssue[]>([]);
  const [apartmentIssues, setApartmentIssues] = useState<SubmittedIssue[]>([]);
  const [tenantIssues, setTenantIssues] = useState<TenantIssue[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const [tenantName, setTenantName] = useState("Tenant");
  const [tenantPropertyId, setTenantPropertyId] = useState<string | null>(null);
  const [issueView, setIssueView] = useState<IssueViewMode>("mine");
  const [vendorsById, setVendorsById] = useState<Record<string, string>>({});
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const appointmentsPageSize = 5;

  const handleChatClick = (issueId: string) => {
    router.push(`/tenant/report?chat=${issueId}`);
  };

  useEffect(() => {
    let isMounted = true;
    const loadIssues = async () => {
      if (!tenantId) {
        setSubmittedIssues([]);
        setApartmentIssues([]);
        return;
      }
      try {
        const apiIssues = await fetchIssues();
        const propertyMatch = tenantPropertyId
          ? (issue: (typeof apiIssues)[number]) => issue.property_id === tenantPropertyId
          : () => false;
        const tenantIssues = apiIssues
          .filter((issue) => issue.tenant_id === tenantId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((issue) => ({
            id: issue.id,
            summary: issue.summary,
            status: mapIssueStatus(issue.status) as IssueStatus,
            dateSubmitted: formatDate(issue.created_at),
            createdAt: issue.created_at,
          }));
        const apartmentIssueList = apiIssues
          .filter(propertyMatch)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((issue) => ({
            id: issue.id,
            summary: issue.summary,
            status: mapIssueStatus(issue.status) as IssueStatus,
            dateSubmitted: formatDate(issue.created_at),
            createdAt: issue.created_at,
          }));
        const appointmentIssues = apiIssues
          .filter((issue) =>
            tenantPropertyId ? issue.property_id === tenantPropertyId : issue.tenant_id === tenantId
          )
          .map((issue) => ({
            id: issue.id,
            summary: issue.summary,
            createdAt: issue.created_at,
            appointmentAt: issue.appointment_at,
            vendorId: issue.vendor_id,
            status: issue.status,
          }));
        if (isMounted) {
          setSubmittedIssues(tenantIssues);
          setApartmentIssues(apartmentIssueList);
          setTenantIssues(appointmentIssues);
        }
      } catch (error) {
        if (isMounted) {
          setSubmittedIssues([]);
          setApartmentIssues([]);
          setTenantIssues([]);
        }
        console.error(error);
      }
    };

    loadIssues();
    return () => {
      isMounted = false;
    };
  }, [tenantId, tenantPropertyId]);

  useEffect(() => {
    if (!tenantId) {
      setTenantName("Tenant");
      setTenantPropertyId(null);
      return;
    }

    let isMounted = true;
    const loadTenant = async () => {
      try {
        const user = await fetchUser(tenantId);
        if (isMounted) {
          setTenantName(user.name || "Tenant");
          setTenantPropertyId(user.property_id ?? null);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setTenantName("Tenant");
          setTenantPropertyId(null);
        }
      }
    };

    loadTenant();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;
    const loadVendors = async () => {
      try {
        const vendors = await fetchVendors();
        if (!isMounted) return;
        const next = vendors.reduce<Record<string, string>>((acc, vendor) => {
          acc[vendor.id] = vendor.name;
          return acc;
        }, {});
        setVendorsById(next);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setVendorsById({});
        }
      }
    };

    loadVendors();
    return () => {
      isMounted = false;
    };
  }, []);

  const issuesForView = issueView === "apartment" ? apartmentIssues : submittedIssues;
  const filteredIssues = issuesForView.filter((issue) =>
    issue.summary.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );
  const upcomingAppointments: AppointmentRow[] = tenantIssues
    .filter((issue) => issue.vendorId)
    .filter((issue) => issue.status === "in_progress")
    .filter((issue) => Boolean(issue.appointmentAt))
    .sort(
      (a, b) =>
        new Date(a.appointmentAt ?? a.createdAt).getTime() -
        new Date(b.appointmentAt ?? b.createdAt).getTime()
    )
    .map((issue) => ({
      id: issue.id,
      vendorName: vendorsById[issue.vendorId ?? ""] ?? "Assigned vendor",
      date: formatDate(issue.appointmentAt ?? issue.createdAt),
      issueTitle: issue.summary,
    }));
  const appointmentsTotalPages = Math.max(
    1,
    Math.ceil(upcomingAppointments.length / appointmentsPageSize)
  );
  const pagedAppointments = upcomingAppointments.slice(
    (appointmentsPage - 1) * appointmentsPageSize,
    appointmentsPage * appointmentsPageSize
  );
  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const pagedIssues = filteredIssues.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filteredIssues.length, issueView]);

  useEffect(() => {
    setAppointmentsPage(1);
  }, [upcomingAppointments.length]);

  return (
    <div className="min-h-screen bg-background">
      <TenantNavbar />
      <main className="container px-4 py-8 md:px-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {tenantName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            How can we help you today?
          </p>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Report Issue Card */}
          <Card className="bg-card h-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Report an Issue</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Chat with our AI assistant to report a maintenance problem
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/tenant/report">Start Chat</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card className="bg-card h-full">
            <CardHeader>
              <CardTitle className="text-foreground">Upcoming Appointments</CardTitle>
              <CardDescription>Confirmed vendor visits for your issues</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length > 0 ? (
                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/70 bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-muted-foreground font-medium">
                          Vendor
                        </TableHead>
                        <TableHead className="text-muted-foreground font-medium">
                          Date
                        </TableHead>
                        <TableHead className="text-muted-foreground font-medium">
                          Issue
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAppointments.map((appointment) => (
                        <TableRow
                          key={appointment.id}
                          className="border-border hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="text-foreground">
                            {appointment.vendorName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {appointment.date}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {appointment.issueTitle}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No confirmed appointments yet.
                  </p>
                </div>
              )}
            </CardContent>
            {upcomingAppointments.length > 0 && (
              <div className="flex items-center justify-between border-t border-border/70 px-6 py-3 text-sm">
                <span className="text-muted-foreground">
                  Showing {(appointmentsPage - 1) * appointmentsPageSize + 1}-
                  {Math.min(
                    appointmentsPage * appointmentsPageSize,
                    upcomingAppointments.length
                  )}{" "}
                  of {upcomingAppointments.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAppointmentsPage((prev) => Math.max(1, prev - 1))}
                    disabled={appointmentsPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {appointmentsPage} of {appointmentsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAppointmentsPage((prev) =>
                        Math.min(appointmentsTotalPages, prev + 1)
                      )
                    }
                    disabled={appointmentsPage === appointmentsTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Submitted Issues List */}
        <Card className="bg-card mb-8">
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-foreground">Your Submitted Issues</CardTitle>
              <CardDescription>Track the status of your maintenance requests</CardDescription>
            </div>
            <ToggleGroup
              type="single"
              value={issueView}
              onValueChange={(value) => {
                if (!value) return;
                setIssueView(value as IssueViewMode);
              }}
              variant="outline"
              size="sm"
              className="w-full md:w-auto"
            >
              <ToggleGroupItem value="mine" className="px-3 shrink whitespace-normal text-center">
                My Issues
              </ToggleGroupItem>
              <ToggleGroupItem
                value="apartment"
                className="px-3 shrink whitespace-normal text-center"
              >
                Apartment Issues
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search issues by name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            {filteredIssues.length > 0 ? (
              <div className="divide-y divide-border">
                {pagedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleChatClick(issue.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleChatClick(issue.id);
                      }
                    }}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0 cursor-pointer rounded-md px-2 -mx-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    title="Open chat"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{issue.summary}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge className={getStatusColor(issue.status)}>
                          {issue.status}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {issue.dateSubmitted}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No issues reported yet</p>
              </div>
            )}
            {filteredIssues.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, filteredIssues.length)} of{" "}
                  {filteredIssues.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-foreground">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

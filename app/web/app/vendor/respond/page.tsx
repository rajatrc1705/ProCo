"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type SubmitState = "idle" | "submitting" | "success" | "error";

function VendorResponseContent() {
  const searchParams = useSearchParams();
  const issueId = searchParams.get("issue_id")?.trim() ?? "";
  const [decision, setDecision] = useState<"accept" | "decline">("accept");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const requiresAppointment = decision === "accept";
  const canSubmit = Boolean(issueId) && (!requiresAppointment || Boolean(appointmentAt));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!issueId) {
      setErrorMessage("Missing issue ID.");
      setSubmitState("error");
      return;
    }
    if (requiresAppointment && !appointmentAt) {
      setErrorMessage("Please choose an appointment date and time.");
      setSubmitState("error");
      return;
    }
    setSubmitState("submitting");
    setErrorMessage("");

    const appointmentIso =
      requiresAppointment && appointmentAt ? new Date(appointmentAt).toISOString() : null;

    try {
      const response = await fetch(`${API_BASE_URL}/issues/${issueId}/vendor-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: decision === "accept",
          appointment_at: appointmentIso,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to submit response.");
      }
      setSubmitState("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit response.";
      setErrorMessage(message);
      setSubmitState("error");
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container px-4 py-10 md:px-6">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>Vendor Response</CardTitle>
            <CardDescription>
              Let the landlord and tenant know whether you can take the job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!issueId ? (
              <p className="text-sm text-destructive">
                Missing issue ID. Please use the link from the email.
              </p>
            ) : submitState === "success" ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground">Thanks! Your response is recorded.</p>
                <p className="text-xs text-muted-foreground">
                  You can close this page now.
                </p>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="decision">Decision</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={decision === "accept" ? "default" : "outline"}
                      onClick={() => setDecision("accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant={decision === "decline" ? "default" : "outline"}
                      onClick={() => setDecision("decline")}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointment">Appointment date and time</Label>
                  <Input
                    id="appointment"
                    type="datetime-local"
                    value={appointmentAt}
                    onChange={(event) => setAppointmentAt(event.target.value)}
                    disabled={!requiresAppointment}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required when accepting.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add any notes for the landlord or tenant."
                  />
                </div>
                {submitState === "error" && (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                )}
                <Button type="submit" disabled={!canSubmit || submitState === "submitting"}>
                  {submitState === "submitting" ? "Submitting..." : "Submit Response"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VendorRespondPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      <VendorResponseContent />
    </Suspense>
  );
}

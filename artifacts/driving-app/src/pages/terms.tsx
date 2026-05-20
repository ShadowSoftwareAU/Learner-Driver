import { useAcceptTerms } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

type Props = { onAccepted: () => void };

export default function TermsPage({ onAccepted }: Props) {
  const acceptTerms = useAcceptTerms();

  const handleAccept = () => {
    acceptTerms.mutate(undefined, { onSuccess: onAccepted });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-tight">Privacy & Terms</h1>
          <p className="text-muted-foreground mt-2">Please review and accept before continuing.</p>
        </div>

        <Card className="max-h-[50vh] overflow-y-auto">
          <CardContent className="p-6 prose prose-sm max-w-none text-foreground">
            <h2 className="text-lg font-semibold mb-3">Privacy Policy — Version 1.0</h2>
            <p className="text-sm text-muted-foreground mb-4">Effective date: 1 January 2025</p>

            <h3 className="font-semibold mt-4 mb-1">1. Data We Collect</h3>
            <p>DriveTrack collects your name, email address, role information, and driving-related assessment data necessary to operate the platform. Instructors additionally provide professional credential documents for verification purposes.</p>

            <h3 className="font-semibold mt-4 mb-1">2. How We Use Your Data</h3>
            <p>Your data is used solely to provide the DriveTrack service: tracking learner progress, scheduling lessons, conducting assessments, and verifying instructor credentials. We do not sell your data to third parties.</p>

            <h3 className="font-semibold mt-4 mb-1">3. Data Ownership</h3>
            <p>You retain ownership of your personal data. Learner drivers own their assessment records and progress data. Instructors retain copyright to their uploaded credential documents. You may request deletion of your account and associated data at any time by contacting support.</p>

            <h3 className="font-semibold mt-4 mb-1">4. Data Storage & Security</h3>
            <p>All data is stored on secure Australian servers. Credential documents are stored in encrypted object storage accessible only to authorised DriveTrack administrators. We use industry-standard TLS encryption for all data in transit.</p>

            <h3 className="font-semibold mt-4 mb-1">5. Sharing With Third Parties</h3>
            <p>We share data only where required by Australian law (e.g. to comply with a lawful request from TMR Queensland), or with your explicit consent. Authentication is provided by Clerk Inc. under their privacy policy.</p>

            <h3 className="font-semibold mt-4 mb-1">6. Queensland Compliance</h3>
            <p>DriveTrack operates in accordance with the Queensland Information Privacy Act 2009 and the Transport Operations (Road Use Management) Act 1995. Instructor verifications align with TMR licensing requirements for Approved Driving Instructors (ADIs).</p>

            <h3 className="font-semibold mt-4 mb-1">7. Contact</h3>
            <p>For privacy enquiries or data deletion requests, contact: <span className="font-medium">privacy@drivetrack.com.au</span></p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAccept}
            disabled={acceptTerms.isPending}
          >
            {acceptTerms.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
            ) : (
              "I have read and accept the Privacy Policy & Terms"
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By clicking above, you agree to DriveTrack's Privacy Policy (v1.0) and grant us permission to process your data as described.
          </p>
        </div>
      </div>
    </div>
  );
}

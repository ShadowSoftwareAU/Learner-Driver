import { useClerk } from "@clerk/clerk-react";
import { AlertTriangle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  remainingSeconds: number;
  onStaySignedIn: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Modal shown when the user has been inactive for 25 minutes.
 * Gives them 5 minutes to stay signed in before automatic sign-out.
 */
export function SessionTimeoutWarning({ open, remainingSeconds, onStaySignedIn }: Props) {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* already expired */ }
    window.location.assign("/");
  };

  const isUrgent = remainingSeconds <= 60;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isUrgent ? "text-destructive" : "text-amber-500"}`} />
            Session expiring soon
          </DialogTitle>
          <DialogDescription className="sr-only">
            Your session will expire due to inactivity. Click Stay signed in to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            You've been inactive for a while. For your security, you'll be automatically signed out in:
          </p>
          <div className={`flex items-center justify-center gap-2 text-4xl font-mono font-bold tabular-nums transition-colors ${isUrgent ? "text-destructive" : "text-foreground"}`}>
            <Clock className={`w-8 h-8 shrink-0 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} />
            {formatTime(remainingSeconds)}
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Click <strong>Stay signed in</strong> to continue your session.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
            Sign out now
          </Button>
          <Button onClick={onStaySignedIn} autoFocus>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useSubmitAssessmentFeedback, useGetAssessmentFeedback } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Star, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RatingRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function RatingRow({ label, value, onChange }: RatingRowProps) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm font-medium min-w-0 flex-1">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 rounded focus:outline-none"
            aria-label={`${i} star`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                i <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StudentFeedback() {
  const [, params] = useRoute("/student/feedback/:assessmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const assessmentId = params?.assessmentId ? parseInt(params.assessmentId, 10) : 0;

  const [overallRating, setOverallRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [safetyFocusRating, setSafetyFocusRating] = useState(0);
  const [lessonQualityRating, setLessonQualityRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Check if already submitted
  const { data: existing, isLoading: existingLoading } = useGetAssessmentFeedback(assessmentId, {
    query: { queryKey: [`/api/assessments/${assessmentId}/feedback`], retry: false },
  });

  const { mutate: submit, isPending } = useSubmitAssessmentFeedback({
    mutation: {
      onSuccess: () => {
        setSubmitted(true);
      },
      onError: (err: any) => {
        toast({ title: err?.response?.data?.error ?? "Failed to submit feedback", variant: "destructive" });
      },
    },
  });

  function handleSubmit() {
    if (!overallRating || !communicationRating || !safetyFocusRating || !lessonQualityRating) {
      toast({ title: "Please rate all categories before submitting", variant: "destructive" }); return;
    }
    if (wouldRecommend === null) {
      toast({ title: "Please answer the recommendation question", variant: "destructive" }); return;
    }
    submit({
      id: assessmentId,
      data: {
        overallRating,
        communicationRating,
        safetyFocusRating,
        lessonQualityRating,
        wouldRecommend,
        comments: comments || undefined,
      },
    });
  }

  if (existingLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (submitted || existing) {
    return (
      <SidebarLayout>
        <div className="max-w-md mx-auto mt-12 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Thank you for your feedback!</h1>
          <p className="text-muted-foreground">
            Your response helps your driving school continuously improve the quality of lessons.
          </p>
          <Button onClick={() => setLocation("/student/dashboard")} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">How was your lesson?</h1>
          <p className="text-muted-foreground mt-1">
            Your feedback is confidential and helps your driving school improve. It takes about 1 minute.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate Your Experience</CardTitle>
            <CardDescription>1 = Poor, 5 = Excellent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RatingRow label="Overall satisfaction" value={overallRating} onChange={setOverallRating} />
            <RatingRow label="Instructor communication" value={communicationRating} onChange={setCommunicationRating} />
            <RatingRow label="Safety focus" value={safetyFocusRating} onChange={setSafetyFocusRating} />
            <RatingRow label="Lesson quality & structure" value={lessonQualityRating} onChange={setLessonQualityRating} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Would You Recommend This Instructor?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-all ${
                  wouldRecommend === true
                    ? "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-400 ring-offset-1"
                    : "border-border text-muted-foreground hover:border-green-400 hover:text-green-700"
                }`}
              >
                <ThumbsUp className="w-4 h-4" /> Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-all ${
                  wouldRecommend === false
                    ? "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-400 ring-offset-1"
                    : "border-border text-muted-foreground hover:border-red-400 hover:text-red-700"
                }`}
              >
                <ThumbsDown className="w-4 h-4" /> No
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Share any specific feedback, suggestions, or highlights from your lesson…"
              className="resize-none h-28"
              maxLength={2000}
            />
            {comments.length > 1800 && (
              <p className="text-xs text-muted-foreground mt-1 text-right">{2000 - comments.length} characters remaining</p>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={isPending} className="w-full" size="lg">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submit Feedback
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Your responses are private and only visible to your school's management.
        </p>
      </div>
    </SidebarLayout>
  );
}

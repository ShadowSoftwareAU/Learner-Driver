import { useState } from "react";
import { useGetToiletSummary, useRateToilet } from "@workspace/api-client-react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ToiletRatingWidgetProps {
  osmId: number;
  lat: number;
  lng: number;
  name: string;
  fee: boolean;
  wheelchair: boolean;
  openingHours?: string;
  qualityScore: number;
}

function StarRow({
  value,
  selected,
  pending,
  onPick,
}: {
  value: number;
  selected: number;
  pending: boolean;
  onPick: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const effective = hovered || selected;
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() => onPick(s)}
          onMouseEnter={() => setHovered(s)}
          className="p-0 border-0 bg-transparent cursor-pointer disabled:cursor-not-allowed"
          aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
        >
          <Star
            size={18}
            className={
              s <= effective
                ? value === s && s === selected
                  ? "fill-amber-500 text-amber-500"
                  : "fill-amber-400 text-amber-400"
                : "fill-none text-gray-300"
            }
          />
        </button>
      ))}
    </div>
  );
}

const CLEANLINESS_LABELS: Record<number, string> = {
  1: "Very dirty",
  2: "Dirty",
  3: "OK",
  4: "Clean",
  5: "Spotless",
};

export function ToiletRatingWidget({
  osmId,
  lat,
  lng,
  name,
  fee,
  wheelchair,
  openingHours,
  qualityScore,
}: ToiletRatingWidgetProps) {
  const [pendingStar, setPendingStar] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  const { data: summary, isLoading, refetch } = useGetToiletSummary(osmId, {
    query: { queryKey: ["toilet-summary", osmId] },
  });

  const { mutate: submitRating, isPending } = useRateToilet({
    mutation: {
      onSuccess: () => {
        refetch();
        setPendingStar(null);
        setShowComment(false);
        setComment("");
      },
    },
  });

  function handleStarPick(star: number) {
    setPendingStar(star);
    setShowComment(true);
  }

  function handleSubmit() {
    if (!pendingStar) return;
    submitRating({
      osmId,
      data: { cleanliness: pendingStar, comment: comment.trim() || undefined },
    });
  }

  const myRating = summary?.myRating?.cleanliness ?? 0;
  const avg = summary?.avgCleanliness;
  const total = summary?.totalRatings ?? 0;

  return (
    <div style={{ minWidth: 200, maxWidth: 240 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{name || "Public Toilet"}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        {fee ? (
          <span style={tagStyle("#fef3c7", "#92400e")}>💰 Paid</span>
        ) : (
          <span style={tagStyle("#d1fae5", "#065f46")}>✅ Free</span>
        )}
        {wheelchair && <span style={tagStyle("#ede9fe", "#4c1d95")}>♿ Accessible</span>}
      </div>

      {openingHours && (
        <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>🕐 {openingHours}</p>
      )}

      {/* Community rating */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6, marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 }}>
          Community cleanliness
        </p>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#9ca3af", fontSize: 11 }}>
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : total === 0 ? (
          <p style={{ fontSize: 11, color: "#9ca3af" }}>No ratings yet — be the first!</p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ display: "flex", gap: 1 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={13}
                  className={
                    avg !== null && avg !== undefined && s <= Math.round(avg)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-none text-gray-300"
                  }
                />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "#374151" }}>
              {avg?.toFixed(1)} <span style={{ color: "#9ca3af" }}>({total})</span>
            </span>
          </div>
        )}
      </div>

      {/* My rating */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 }}>
          {myRating ? "Your rating" : "Rate this toilet"}
        </p>
        <StarRow
          value={myRating}
          selected={pendingStar ?? myRating}
          pending={isPending}
          onPick={handleStarPick}
        />
        {myRating > 0 && !pendingStar && (
          <p style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
            {CLEANLINESS_LABELS[myRating]}
            {summary?.myRating?.comment && (
              <> · <em>"{summary.myRating.comment}"</em></>
            )}
          </p>
        )}
        {pendingStar && (
          <p style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
            {CLEANLINESS_LABELS[pendingStar]}
          </p>
        )}
      </div>

      {showComment && (
        <div style={{ marginTop: 6 }}>
          <Textarea
            placeholder="Optional comment (max 200 chars)"
            maxLength={200}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="text-xs"
            style={{ fontSize: 11, resize: "none" }}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <Button
              size="sm"
              className="h-6 text-xs px-2 flex-1"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending ? <Loader2 size={10} className="animate-spin mr-1" /> : null}
              {myRating ? "Update" : "Submit"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={() => { setShowComment(false); setPendingStar(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <p style={{ fontSize: 9, color: "#d1d5db" }}>OSM · quality score {qualityScore}/4</p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 9, color: "#6b7280", textDecoration: "underline" }}
        >
          Google Maps ↗
        </a>
      </div>
    </div>
  );
}

function tagStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    fontWeight: 500,
  };
}

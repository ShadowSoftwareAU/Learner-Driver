export default function Slide08GPS() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Yellow bottom accent stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-[1vh] bg-[#F5C400]" />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        {/* Title block */}
        <div className="flex items-end gap-[3vw] mb-[2vh]">
          <p
            className="font-display font-black uppercase text-[#E8E8E8] tracking-tight"
            style={{ fontSize: "6vw", lineHeight: 1 }}
          >
            GPS Route Tracking
          </p>
          <div className="mb-[1vh] px-[1.5vw] py-[0.5vh] bg-[#F5C400]">
            <p className="font-display font-black uppercase text-[#1C1C1E]" style={{ fontSize: "2vw" }}>
              No App Required
            </p>
          </div>
        </div>
        <div className="mb-[5vh] w-[10vw] h-[0.5vh] bg-[#F5C400]" />

        {/* 4 features in 2x2 */}
        <div className="grid grid-cols-2 gap-x-[6vw] gap-y-[4vh]">

          <div>
            <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "3.2vw", lineHeight: 1 }}>
              Real-Time Route Capture
            </p>
            <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              GPS trail recorded from the moment a guided lesson starts — works on any mobile browser.
            </p>
          </div>

          <div>
            <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "3.2vw", lineHeight: 1 }}>
              Manoeuvre Location Pins
            </p>
            <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Each manoeuvre is geotagged at the exact location it was assessed during the lesson.
            </p>
          </div>

          <div>
            <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "3.2vw", lineHeight: 1 }}>
              Interactive Route Maps
            </p>
            <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Assessment reports include a full interactive map of the lesson route and manoeuvre markers.
            </p>
          </div>

          <div>
            <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "3.2vw", lineHeight: 1 }}>
              School-Wide Heatmap
            </p>
            <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Admins see aggregated route density across all instructors to identify popular training zones.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

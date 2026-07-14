export default function Slide04Instructors() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Yellow left edge */}
      <div className="absolute left-0 top-0 w-[0.8vw] h-full bg-[#F5C400]" />

      <div className="absolute inset-0 flex flex-col justify-center pl-[7vw] pr-[7vw]">
        {/* Title */}
        <p
          className="font-display font-black uppercase text-[#E8E8E8] tracking-tight"
          style={{ fontSize: "5.5vw", lineHeight: 1 }}
        >
          For Instructors
        </p>
        <div className="mt-[1.5vh] mb-[5vh] w-[8vw] h-[0.5vh] bg-[#F5C400]" />

        {/* Feature rows */}
        <div className="flex flex-col gap-[4vh]">

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#F5C400] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              01
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                Guided &amp; Manual Assessment
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                Step through all 44 Queensland TMR manoeuvres across 8 QSAFE categories, or log results freehand after the lesson.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#F5C400] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              02
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                GPS Route Recording
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                Every lesson route is mapped in real time from any mobile browser. Manoeuvre locations are pinned automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#F5C400] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              03
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                Report Generation &amp; Dispatch
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                Generate, approve, and send PDF assessment reports directly from the platform. Full audit trail on every action.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

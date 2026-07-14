export default function Slide02Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Red left edge bar */}
      <div className="absolute left-0 top-0 w-[0.8vw] h-full bg-[#D42B2B]" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-center pl-[7vw] pr-[8vw]">
        {/* Title */}
        <p
          className="font-display font-black uppercase text-[#F5C400] tracking-tight"
          style={{ fontSize: "6vw", lineHeight: 1 }}
        >
          The Problem
        </p>
        {/* Yellow rule */}
        <div className="mt-[1.5vh] mb-[4vh] w-[10vw] h-[0.5vh] bg-[#F5C400]" />

        {/* Pain points */}
        <div className="flex flex-col gap-[3vh]">

          <div className="flex items-start gap-[3vw]">
            <span
              className="font-display font-black text-[#D42B2B] shrink-0"
              style={{ fontSize: "4.5vw", lineHeight: 1 }}
            >
              01
            </span>
            <div>
              <p className="font-display font-bold text-[#E8E8E8] uppercase" style={{ fontSize: "3.2vw", lineHeight: 1.1 }}>
                Paper logs are lost, damaged, and unverifiable
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Instructors carry clipboards. Records disappear.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <span
              className="font-display font-black text-[#D42B2B] shrink-0"
              style={{ fontSize: "4.5vw", lineHeight: 1 }}
            >
              02
            </span>
            <div>
              <p className="font-display font-bold text-[#E8E8E8] uppercase" style={{ fontSize: "3.2vw", lineHeight: 1.1 }}>
                No standardised TMR or QSAFE compliance tracking
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Queensland's 44-manoeuvre framework sits on paper sheets.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <span
              className="font-display font-black text-[#D42B2B] shrink-0"
              style={{ fontSize: "4.5vw", lineHeight: 1 }}
            >
              03
            </span>
            <div>
              <p className="font-display font-bold text-[#E8E8E8] uppercase" style={{ fontSize: "3.2vw", lineHeight: 1.1 }}>
                Parents have zero visibility
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Families paying for lessons receive no progress data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <span
              className="font-display font-black text-[#D42B2B] shrink-0"
              style={{ fontSize: "4.5vw", lineHeight: 1 }}
            >
              04
            </span>
            <div>
              <p className="font-display font-bold text-[#E8E8E8] uppercase" style={{ fontSize: "3.2vw", lineHeight: 1.1 }}>
                Instructor admin eats into lesson time
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Booking, reporting, and note-keeping are all manual.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

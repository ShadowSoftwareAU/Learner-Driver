export default function Slide07Compliance() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Subtle yellow glow top-left */}
      <div className="absolute top-0 left-0 w-[50vw] h-[50vh] bg-[radial-gradient(ellipse_at_top_left,_rgba(245,196,0,0.08)_0%,_transparent_70%)]" />

      <div className="absolute inset-0 flex">
        {/* Left — big stat */}
        <div className="w-[45vw] flex flex-col items-center justify-center border-r border-[#333335]">
          <span
            className="font-display font-black text-[#F5C400]"
            style={{ fontSize: "18vw", lineHeight: 0.85 }}
          >
            44
          </span>
          <p className="font-display font-bold uppercase text-[#E8E8E8] text-center mt-[2vh]" style={{ fontSize: "3vw", letterSpacing: "0.1em" }}>
            TMR Manoeuvres
          </p>
          <p className="font-body text-[#888888] text-center mt-[1vh]" style={{ fontSize: "2.4vw" }}>
            Across 8 QSAFE categories
          </p>
        </div>

        {/* Right — compliance details */}
        <div className="flex-1 flex flex-col justify-center pl-[5vw] pr-[7vw]">
          <p
            className="font-display font-black uppercase text-[#F5C400] tracking-tight"
            style={{ fontSize: "4.5vw", lineHeight: 1 }}
          >
            Compliance Built In
          </p>
          <div className="mt-[1.5vh] mb-[4vh] w-[6vw] h-[0.5vh] bg-[#F5C400]" />

          <div className="flex flex-col gap-[3vh]">

            <div>
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw" }}>
                Three Assessment Programs
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                QSAFE, Q-Ride (motorcycle), and Heavy Vehicle — all supported natively.
              </p>
            </div>

            <div>
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw" }}>
                Full Audit Trail
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Every view, create, and update is logged against the user, timestamp, and action.
              </p>
            </div>

            <div>
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw" }}>
                Finalization Workflow
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Draft → Pending Approval → Approved → Dispatched. No report leaves without sign-off.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

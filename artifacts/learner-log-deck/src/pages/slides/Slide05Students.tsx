export default function Slide05Students() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* White left edge */}
      <div className="absolute left-0 top-0 w-[0.8vw] h-full bg-[#E8E8E8]" />

      <div className="absolute inset-0 flex flex-col justify-center pl-[7vw] pr-[7vw]">
        {/* Title */}
        <p
          className="font-display font-black uppercase text-[#E8E8E8] tracking-tight"
          style={{ fontSize: "5.5vw", lineHeight: 1 }}
        >
          For Learner Drivers
        </p>
        <div className="mt-[1.5vh] mb-[5vh] w-[8vw] h-[0.5vh] bg-[#E8E8E8]" />

        {/* Feature rows */}
        <div className="flex flex-col gap-[4vh]">

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#E8E8E8] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              01
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                Personal Progress Dashboard
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                See exactly which manoeuvres are mastered, in progress, or still to practise — updated after every lesson.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#E8E8E8] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              02
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                Instructor Feedback After Every Lesson
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                Confidence notes, focus areas for next session, and manoeuvre-level comments from the instructor.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-[4vw]">
            <span className="font-display font-black text-[#E8E8E8] shrink-0" style={{ fontSize: "7vw", lineHeight: 1 }}>
              03
            </span>
            <div className="pt-[0.5vh]">
              <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "3.5vw", lineHeight: 1.1 }}>
                Downloadable PDF Reports
              </p>
              <p className="font-body text-[#888888] mt-[1vh]" style={{ fontSize: "2.6vw" }}>
                Each approved assessment generates a print-ready report with GPS route, results, and instructor notes.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Slide03Solution() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Yellow top bar accent */}
      <div className="absolute top-0 left-0 right-0 h-[1vh] bg-[#F5C400]" />

      <div className="absolute inset-0 flex flex-col pt-[8vh] pb-[5vh] px-[7vw]">
        {/* Title */}
        <p
          className="font-display font-black uppercase text-[#F5C400] tracking-tight"
          style={{ fontSize: "6vw", lineHeight: 1 }}
        >
          One Platform. Every Role.
        </p>
        <div className="mt-[1.5vh] mb-[2vh] w-[10vw] h-[0.5vh] bg-[#F5C400]" />
        <p className="font-body text-[#888888] mb-[4vh]" style={{ fontSize: "2.6vw" }}>
          Learner Log connects every person in the driving school ecosystem.
        </p>

        {/* 2x2 role grid */}
        <div className="grid grid-cols-2 gap-[2.5vw] flex-1">

          {/* Instructor */}
          <div className="bg-[#252528] border-l-[0.5vw] border-[#F5C400] px-[3vw] py-[3vh] flex flex-col justify-center">
            <p className="font-display font-black uppercase text-[#F5C400] tracking-tight" style={{ fontSize: "3.8vw", lineHeight: 1 }}>
              Instructor
            </p>
            <p className="font-body text-[#E8E8E8] mt-[1.5vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Log assessments, track manoeuvres, capture GPS routes, and manage students.
            </p>
          </div>

          {/* Student */}
          <div className="bg-[#252528] border-l-[0.5vw] border-[#E8E8E8] px-[3vw] py-[3vh] flex flex-col justify-center">
            <p className="font-display font-black uppercase text-[#E8E8E8] tracking-tight" style={{ fontSize: "3.8vw", lineHeight: 1 }}>
              Learner Driver
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              View progress, mastered manoeuvres, instructor feedback, and lesson reports.
            </p>
          </div>

          {/* Parent */}
          <div className="bg-[#252528] border-l-[0.5vw] border-[#D42B2B] px-[3vw] py-[3vh] flex flex-col justify-center">
            <p className="font-display font-black uppercase text-[#D42B2B] tracking-tight" style={{ fontSize: "3.8vw", lineHeight: 1 }}>
              Parent / Guardian
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Follow progress, top up lesson credits, and stay informed without being in the car.
            </p>
          </div>

          {/* Admin */}
          <div className="bg-[#252528] border-l-[0.5vw] border-[#888888] px-[3vw] py-[3vh] flex flex-col justify-center">
            <p className="font-display font-black uppercase text-[#888888] tracking-tight" style={{ fontSize: "3.8vw", lineHeight: 1 }}>
              School Admin
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.5vw", lineHeight: 1.4 }}>
              Fleet overview, audit logs, instructor management, and compliance reporting.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

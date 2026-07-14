export default function Slide06Parents() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Red left edge */}
      <div className="absolute left-0 top-0 w-[0.8vw] h-full bg-[#D42B2B]" />

      <div className="absolute inset-0 flex flex-col justify-center pl-[7vw] pr-[7vw]">
        {/* Title */}
        <p
          className="font-display font-black uppercase text-[#D42B2B] tracking-tight"
          style={{ fontSize: "5.5vw", lineHeight: 1 }}
        >
          For Parents &amp; Guardians
        </p>
        <div className="mt-[1.5vh] mb-[2vh] w-[8vw] h-[0.5vh] bg-[#D42B2B]" />
        <p className="font-body text-[#888888] mb-[4vh]" style={{ fontSize: "2.6vw" }}>
          Stay connected to your learner's progress without interfering with the lesson.
        </p>

        {/* 3 feature cards horizontal */}
        <div className="grid grid-cols-3 gap-[2.5vw]">

          <div className="bg-[#252528] px-[2.5vw] py-[3vh]">
            <div className="w-[4vw] h-[0.6vh] bg-[#D42B2B] mb-[2vh]" />
            <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw", lineHeight: 1.1 }}>
              Progress Visibility
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.4vw", lineHeight: 1.5 }}>
              Link to your learner's profile with a viewer code and follow their journey lesson by lesson.
            </p>
          </div>

          <div className="bg-[#252528] px-[2.5vw] py-[3vh]">
            <div className="w-[4vw] h-[0.6vh] bg-[#D42B2B] mb-[2vh]" />
            <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw", lineHeight: 1.1 }}>
              Lesson Credits Wallet
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.4vw", lineHeight: 1.5 }}>
              Top up lesson credits directly in the app and pay for bookings without phone calls or bank transfers.
            </p>
          </div>

          <div className="bg-[#252528] px-[2.5vw] py-[3vh]">
            <div className="w-[4vw] h-[0.6vh] bg-[#D42B2B] mb-[2vh]" />
            <p className="font-display font-bold uppercase text-[#E8E8E8]" style={{ fontSize: "2.8vw", lineHeight: 1.1 }}>
              Report Access
            </p>
            <p className="font-body text-[#888888] mt-[1.5vh]" style={{ fontSize: "2.4vw", lineHeight: 1.5 }}>
              View and download PDF assessment reports once the instructor approves and dispatches them.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

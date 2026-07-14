export default function Slide09Platform() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Top right yellow accent block */}
      <div className="absolute top-0 right-0 w-[2vw] h-full bg-[#F5C400] opacity-60" />
      <div className="absolute top-0 right-[2vw] w-[0.5vw] h-full bg-[#D42B2B] opacity-80" />

      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-[10vw]">
        <p
          className="font-display font-black uppercase text-[#E8E8E8] tracking-tight"
          style={{ fontSize: "5.5vw", lineHeight: 1 }}
        >
          Platform Overview
        </p>
        <div className="mt-[1.5vh] mb-[5vh] w-[8vw] h-[0.5vh] bg-[#F5C400]" />

        <div className="flex flex-col gap-[2.5vh]">

          <div className="flex items-center gap-[3vw] bg-[#252528] px-[3vw] py-[2.5vh]">
            <div className="w-[1.5vw] h-[1.5vw] bg-[#F5C400] rounded-full shrink-0" />
            <div>
              <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "2.8vw", lineHeight: 1 }}>
                React + Node.js + PostgreSQL
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Modern full-stack web platform — fast, scalable, and built for production.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-[3vw] bg-[#252528] px-[3vw] py-[2.5vh]">
            <div className="w-[1.5vw] h-[1.5vw] bg-[#F5C400] rounded-full shrink-0" />
            <div>
              <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "2.8vw", lineHeight: 1 }}>
                Role-Based Authentication
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Instructor, Student, Parent, and Admin roles with secure, isolated access via Clerk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-[3vw] bg-[#252528] px-[3vw] py-[2.5vh]">
            <div className="w-[1.5vw] h-[1.5vw] bg-[#F5C400] rounded-full shrink-0" />
            <div>
              <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "2.8vw", lineHeight: 1 }}>
                Stripe-Powered Payments
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Parents top up lesson credit wallets via Stripe Checkout — no manual invoicing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-[3vw] bg-[#252528] px-[3vw] py-[2.5vh]">
            <div className="w-[1.5vw] h-[1.5vw] bg-[#F5C400] rounded-full shrink-0" />
            <div>
              <p className="font-display font-bold uppercase text-[#F5C400]" style={{ fontSize: "2.8vw", lineHeight: 1 }}>
                Mobile-First, No App Store Required
              </p>
              <p className="font-body text-[#888888] mt-[0.5vh]" style={{ fontSize: "2.4vw" }}>
                Works on any device or browser. GPS and camera access via standard browser APIs.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

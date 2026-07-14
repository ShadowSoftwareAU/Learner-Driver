const base = import.meta.env.BASE_URL;

export default function Slide10Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Yellow diagonal accent bottom-right */}
      <div className="absolute bottom-0 right-0 w-[35vw] h-[10vh] bg-[#F5C400] opacity-90" style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }} />
      <div className="absolute bottom-[10vh] right-0 w-[35vw] h-[3.5vh] bg-[#D42B2B]" style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }} />

      {/* Top left accent */}
      <div className="absolute top-0 left-0 w-[25vw] h-[6vh] bg-[#F5C400] opacity-80" style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }} />
      <div className="absolute top-[6vh] left-0 w-[25vw] h-[2.5vh] bg-[#D42B2B]" style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }} />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,196,0,0.06)_0%,_transparent_65%)]" />

      {/* Centre content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2vh]">
        <img
          src={`${base}learnerlog-logo.png`}
          crossOrigin="anonymous"
          alt="Learner Log"
          style={{ width: "44vw", objectFit: "contain" }}
        />
        <div className="w-[36vw] h-[0.4vh] bg-[#F5C400]" />
        <p
          className="font-display font-bold uppercase text-[#E8E8E8] tracking-widest text-center"
          style={{ fontSize: "2.4vw", letterSpacing: "0.22em" }}
        >
          Australia's Digital Driving School Platform
        </p>
      </div>

      {/* URL bottom */}
      <p
        className="absolute bottom-[4vh] w-full text-center font-body text-[#888888] tracking-wider uppercase"
        style={{ fontSize: "2.2vw" }}
      >
        learnerlog.com.au
      </p>
    </div>
  );
}

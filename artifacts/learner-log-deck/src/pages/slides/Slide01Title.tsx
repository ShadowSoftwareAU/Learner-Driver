const base = import.meta.env.BASE_URL;

export default function Slide01Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1C1C1E]">
      {/* Yellow diagonal accent top-right */}
      <div className="absolute top-0 right-0 w-[30vw] h-[8vh] bg-[#F5C400] opacity-90" style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }} />
      {/* Red diagonal accent below yellow */}
      <div className="absolute top-[8vh] right-0 w-[30vw] h-[3vh] bg-[#D42B2B]" style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }} />

      {/* Bottom left accent stripe */}
      <div className="absolute bottom-0 left-0 w-[25vw] h-[5vh] bg-[#F5C400] opacity-80" style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }} />
      <div className="absolute bottom-[5vh] left-0 w-[25vw] h-[2vh] bg-[#D42B2B]" style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }} />

      {/* Subtle radial glow centre */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,196,0,0.06)_0%,_transparent_65%)]" />

      {/* Logo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <img
          src={`${base}learnerlog-logo.png`}
          crossOrigin="anonymous"
          alt="Learner Log"
          style={{ width: "48vw", objectFit: "contain" }}
        />
        {/* Yellow rule */}
        <div className="mt-[3vh] w-[40vw] h-[0.4vh] bg-[#F5C400]" />
        {/* Tagline */}
        <p
          className="mt-[2.5vh] font-display font-bold tracking-widest text-[#E8E8E8] uppercase"
          style={{ fontSize: "2.4vw", letterSpacing: "0.25em", textWrap: "balance" }}
        >
          Australia's Digital Driving School Platform
        </p>
      </div>

      {/* URL bottom centre */}
      <p
        className="absolute bottom-[4vh] w-full text-center font-body text-[#888888] tracking-wider uppercase"
        style={{ fontSize: "2.2vw" }}
      >
        learnerlog.com.au
      </p>
    </div>
  );
}

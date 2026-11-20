import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { journeySteps } from "../../data/compro/journeySteps";
import { useLanguage } from "../../store/LanguageContext";
import { journeyAssets } from "../../data/compro/assetsMap";

const carouselStyles = `
  @keyframes glowPulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(212, 167, 44, 0.4);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(212, 167, 44, 0);
    }
  }

  .animate-glowPulse {
    animation: glowPulse 2s infinite;
  }
`;

export function JourneyCarousel() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const { language } = useLanguage();

  const totalSteps = journeySteps.length;
  const nextIdx = (currentIdx + 1) % totalSteps;
  const prevIdx = (currentIdx - 1 + totalSteps) % totalSteps;

  useEffect(() => {
    if (!isAutoPlay) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % totalSteps);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlay, totalSteps]);

  const handleNext = () => {
    setCurrentIdx(nextIdx);
    setIsAutoPlay(false);
    setTimeout(() => setIsAutoPlay(true), 8000);
  };

  const handlePrev = () => {
    setCurrentIdx(prevIdx);
    setIsAutoPlay(false);
    setTimeout(() => setIsAutoPlay(true), 8000);
  };

  const progressPercent = ((currentIdx + 1) / totalSteps) * 100;

  return (
    <>
      <style>{carouselStyles}</style>
      <div className="relative w-full bg-gradient-to-b from-[#EAF0F8] to-white py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#071B41] mb-3">
              {language === "id"
                ? "Perjalanan Pengiriman Bersama GMS Logistics"
                : "Shipping Journey with GMS Logistics"}
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
              {language === "id"
                ? "Dari proses administrasi hingga serah terima, setiap pengiriman dipantau dan dikelola secara terkoordinasi."
                : "From administrative process to delivery handoff, every shipment is monitored and managed in a coordinated manner."}
            </p>
          </div>

          {/* Premium Stepper - Logistics Journey Timeline */}
          <div className="mb-10 md:mb-12">
            <div className="flex justify-center px-2">
              <div className="relative w-full max-w-4xl">
                {/* Background connector line - container */}
                <div className="absolute top-6 left-0 right-0 h-1 bg-[#D4C5A9] rounded-full" 
                  style={{ top: '28px', zIndex: 0 }}
                />

                {/* Active progress line */}
                <div 
                  className="absolute h-1 bg-gradient-to-r from-[#0B2553] to-[#D4A72C] rounded-full transition-all duration-700"
                  style={{
                    top: '28px',
                    left: 0,
                    width: `${progressPercent}%`,
                    zIndex: 1,
                  }}
                />

                {/* Step Items Container */}
                <div className="flex justify-between items-flex-start gap-0.5 sm:gap-1 relative z-10">
                  {journeySteps.map((s, idx) => {
                    const isActive = idx === currentIdx;
                    const isPassed = idx < currentIdx;
                    
                    return (
                      <div
                        key={s.id}
                        className="flex flex-col items-center flex-1 min-w-0"
                      >
                        {/* Step Button */}
                        <button
                          onClick={() => {
                            setCurrentIdx(idx);
                            setIsAutoPlay(false);
                            setTimeout(() => setIsAutoPlay(true), 8000);
                          }}
                          className="relative z-20 flex-shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#D4A72C] focus:ring-offset-2 rounded-full"
                        >
                          {/* Glow effect for active */}
                          {isActive && (
                            <div 
                              className="absolute inset-0 rounded-full animate-glowPulse"
                              style={{
                                width: '56px',
                                height: '56px',
                                left: '-2px',
                                top: '-2px',
                              }}
                            />
                          )}

                          {/* Circle */}
                          <div
                            className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold font-display transition-all duration-300 shadow-md flex-shrink-0 ${
                              isActive
                                ? "bg-[#071B41] text-white ring-4 ring-[#D4A72C] shadow-lg scale-110"
                                : isPassed
                                  ? "bg-[#0B2553] text-white"
                                  : "bg-white border-2 border-[#D4C5A9] text-[#071B41] hover:border-[#D4A72C]"
                            }`}
                          >
                            {isPassed ? (
                              <Check size={20} className="md:w-6 md:h-6" strokeWidth={3} />
                            ) : (
                              <span className="text-sm md:text-base">{idx + 1}</span>
                            )}
                          </div>
                        </button>

                        {/* Step Label - Proper spacing and alignment */}
                        <div className="relative mt-3 h-[76px] w-full flex-shrink-0 sm:static sm:mt-3 sm:h-auto sm:min-h-12 md:mt-4 px-1 text-center sm:flex sm:items-center sm:justify-center">
                          <span
                            className={`absolute right-1/2 top-1 origin-top-right -rotate-45 whitespace-nowrap text-xs sm:static sm:rotate-0 sm:whitespace-normal sm:text-sm md:text-base font-bold uppercase tracking-normal sm:tracking-wider transition-all duration-300 leading-tight ${
                              isActive
                                ? "text-[#071B41] scale-105 font-display"
                                : isPassed
                                  ? "text-[#0B2553] font-semibold"
                                  : "text-[#7A8A9E] font-semibold"
                            }`}
                          >
                            {s.short[language]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Image Carousel - Optimized sizing */}
          <div className="mb-6 md:mb-8 flex justify-center">
            <div className="w-full max-w-4xl">
              <div className="relative overflow-hidden rounded-2xl shadow-lg">
                {/* Slide Container - 16:9 aspect ratio, constrained */}
                <div className="relative w-full bg-black" style={{ aspectRatio: "16/9" }}>
                  {journeySteps.map((s, idx) => {
                    const isActive = idx === currentIdx;
                    const isNext = idx === nextIdx;
                    const isPrev = idx === prevIdx;

                    return (
                      <div
                        key={s.id}
                        className={`absolute inset-0 transition-all duration-700 ease-out ${
                          isActive
                            ? "opacity-100 scale-100 translate-x-0"
                            : isNext
                              ? "opacity-0 scale-95 translate-x-full"
                              : isPrev
                                ? "opacity-0 scale-95 -translate-x-full"
                                : "opacity-0 scale-95"
                        }`}
                      >
                        {/* Image - contain to prevent cropping */}
                        <img
                          src={journeyAssets[s.id]}
                          alt={s.imageAlt[language]}
                          loading="lazy"
                          className="w-full h-full object-contain bg-gradient-to-b from-slate-100 to-slate-50"
                        />

                        {/* Step label - bottom left corner */}
                        <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur px-3 py-2 rounded-lg">
                          <p className="text-xs font-bold text-[#D4A72C] uppercase tracking-wide whitespace-nowrap">
                            {`${String(currentIdx + 1).padStart(2, "0")} - ${s.short[language]}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation Buttons */}
                <button
                  onClick={handlePrev}
                  className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-[#071B41] p-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
                  aria-label="Previous step"
                >
                  <ChevronLeft size={24} />
                </button>

                <button
                  onClick={handleNext}
                  className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-[#071B41] p-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
                  aria-label="Next step"
                >
                  <ChevronRight size={24} />
                </button>

                {/* Progress Indicator Dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                  {journeySteps.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentIdx(idx);
                        setIsAutoPlay(false);
                        setTimeout(() => setIsAutoPlay(true), 8000);
                      }}
                      className={`transition-all duration-500 rounded-full ${
                        idx === currentIdx
                          ? "w-8 h-3 bg-[#D4A72C] shadow-lg"
                          : "w-3 h-3 bg-white/60 hover:bg-white/80"
                      }`}
                      aria-label={`Go to step ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

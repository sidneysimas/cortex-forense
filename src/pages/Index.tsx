import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import AboutSection from "@/components/landing/AboutSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
 import BenefitsSection from "@/components/landing/BenefitsSection";
 import TestimonialsSection from "@/components/landing/TestimonialsSection";
 import PricingSection from "@/components/landing/PricingSection";
import FooterSection from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <FeaturesSection />
       <BenefitsSection />
       <TestimonialsSection />
       <PricingSection />
      <FooterSection />
    </div>
  );
};

export default Index;

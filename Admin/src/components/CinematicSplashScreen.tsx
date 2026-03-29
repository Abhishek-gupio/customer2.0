import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './CinematicSplashScreen.css';

// Import images
import logoImg from '../assets/images/logo.png';
import carImg from '../assets/images/splashScreen_car.png';

import { GridScan } from './GridScan';

interface CinematicSplashScreenProps {
  onComplete: () => void;
}

const ANIMATION_CONFIG = {
  initialDelay: 0.3,
  carZoomDuration: 2.0,
  brandingHoldDelay: 0.8,
  navigationDelay: 0.5,
};

const CinematicSplashScreen: React.FC<CinematicSplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const totalDuration = (
      ANIMATION_CONFIG.initialDelay +
      ANIMATION_CONFIG.carZoomDuration +
      ANIMATION_CONFIG.brandingHoldDelay +
      ANIMATION_CONFIG.navigationDelay
    ) * 1000;

    const timer = setTimeout(() => {
      onComplete();
    }, totalDuration);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      className="splash-container"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
    >
      <GridScan
        sensitivity={0.55}
        lineThickness={1}
        linesColor="#FFB800"
        gridScale={0.1}
        scanColor="#FFF3E0"
        scanOpacity={0.4}
        scanDirection="backward"
        scanDelay={1.0}
        enablePost
        bloomIntensity={0.6}
        chromaticAberration={0.002}
        noiseIntensity={0.01}
      />

      <div className="splash-brand-section">
        <motion.div 
          className="splash-logo-wrap shimmer-mask"
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: { 
              delay: ANIMATION_CONFIG.initialDelay + 0.5, 
              duration: 1.2,
              ease: "easeOut" 
            }
          }}
        >
          <img src={logoImg} className="splash-logo-image" alt="Gupio Logo" />
        </motion.div>
      </div>

      <div className="splash-car-section">
        <motion.div 
          className="splash-shadow"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: 0.6, 
            scale: 1,
            transition: { 
              delay: ANIMATION_CONFIG.initialDelay, 
              duration: ANIMATION_CONFIG.carZoomDuration,
              ease: "easeOut" 
            }
          }}
        />
        <motion.img 
          src={carImg} 
          className="splash-car-image"
          initial={{ opacity: 0, scale: 0.6, y: 40 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { 
              delay: ANIMATION_CONFIG.initialDelay, 
              duration: ANIMATION_CONFIG.carZoomDuration,
              ease: "circOut" 
            }
          }}
        />
      </div>
    </motion.div>
  );
};

export default CinematicSplashScreen;

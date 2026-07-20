import React, { useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './LoginSuccess.css';

interface LoginSuccessProps {
  onComplete: () => void;
}

const LoginSuccess: React.FC<LoginSuccessProps> = ({ onComplete }) => {
  useEffect(() => {
    // Standard duration for a success animation to feel satisfying (2.5s)
    const timer = setTimeout(() => {
      onComplete();
    }, 2800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="login-success-overlay">
      <div className="login-success-content">
        <div className="lottie-container">
          <DotLottieReact
            src="https://lottie.host/801a6549-0636-407a-9a9f-4318357022d4/n787wD11Xy.json"
            autoplay
            style={{ width: '300px', height: '300px' }}
          />
        </div>
        <h2 className="success-text">Access Granted</h2>
        <p className="success-subtext">Redirecting to secure dashboard...</p>
      </div>
    </div>
  );
};

export default LoginSuccess;

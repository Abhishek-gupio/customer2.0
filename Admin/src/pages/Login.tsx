import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, ShieldCheck, Lock, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';
import Particles from '../components/Particles/Particles';
import SplitText from '../components/ui/SplitText/SplitText';
import './Auth.css';

type View = 'main' | 'forgot_email' | 'forgot_otp' | 'forgot_reset';

export default function Login() {
  const { token, login, signup, loading } = useAuth();
  const navigate = useNavigate();

  // --- Main login/signup state ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('SUPPORT');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // --- Forgot password flow state ---
  const [view, setView] = useState<View>('main');
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpMessage, setFpMessage] = useState('');
  const [fpSubmitting, setFpSubmitting] = useState(false);
  const [showFpNewPassword, setShowFpNewPassword] = useState(false);
  const [showFpConfirmPassword, setShowFpConfirmPassword] = useState(false);

  if (token && !loading) return <Navigate to="/" replace />;

  // ---- Main handlers ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) navigate('/', { replace: true });
    else setError(res.error ?? 'Login failed');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !name) {
      setError('Name, email and password are required');
      return;
    }
    setSubmitting(true);
    const res = await signup({ email: email.trim(), password, name: name.trim(), role });
    setSubmitting(false);
    if (res.ok) {
      const loginRes = await login(email.trim(), password);
      if (loginRes.ok) navigate('/', { replace: true });
      else setError('Account created but login failed. Please sign in manually.');
    } else {
      setError(res.error ?? 'Registration failed');
    }
  };

  // ---- Forgot password handlers ----
  const handleForgotSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpSubmitting(true);
    const res = await adminApi.forgotPassword(fpEmail.trim());
    setFpSubmitting(false);
    if (res.success) {
      setFpMessage('OTP sent to your email. Please check your inbox.');
      setView('forgot_otp');
    } else {
      setFpError(res.error.message ?? 'Failed to send OTP');
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpSubmitting(true);
    const res = await adminApi.verifyResetOtp(fpEmail.trim(), fpOtp.trim());
    setFpSubmitting(false);
    if (res.success && res.data.verified) {
      setFpMessage('');
      setView('forgot_reset');
    } else {
      setFpError(!res.success ? (res.error?.message ?? 'Invalid or expired OTP') : 'Invalid or expired OTP');
    }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError('Passwords do not match');
      return;
    }
    if (fpNewPassword.length < 8) {
      setFpError('Password must be at least 8 characters');
      return;
    }
    setFpSubmitting(true);
    const res = await adminApi.resetPassword(fpEmail.trim(), fpOtp.trim(), fpNewPassword);
    setFpSubmitting(false);
    if (res.success) {
      setView('main');
      setIsRightPanelActive(false);
      setFpEmail(''); setFpOtp(''); setFpNewPassword(''); setFpConfirmPassword('');
      setError('Password reset successful! Please sign in with your new password.');
    } else {
      setFpError(res.error.message ?? 'Failed to reset password');
    }
  };

  const resetForgotFlow = () => {
    setView('main');
    setFpEmail(''); setFpOtp(''); setFpNewPassword(''); setFpConfirmPassword('');
    setFpError(''); setFpMessage('');
  };

  // ---- Forgot password views ----
  if (view !== 'main') {
    return (
      <div className="auth-body">
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
          <Particles
            particleColors={["#ffffff"]}
            particleCount={200}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover
            alphaParticles={false}
            disableRotation={false}
            pixelRatio={1}
          />
        </div>

        <div className="container forgot-container" style={{ zIndex: 1 }}>
          <div className="form-container" style={{ width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            {/* Step indicator with labels */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                {(['forgot_email', 'forgot_otp', 'forgot_reset'] as View[]).map((step, idx) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: view === step ? 36 : 12,
                      height: 12,
                      borderRadius: 9999,
                      background: view === step ? '#000' : 'rgba(0,0,0,0.15)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: view === step ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                    }} />
                    {idx < 2 && (
                      <div style={{ width: '20px', height: '1px', background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: view === 'forgot_email' ? '#000' : 'rgba(0,0,0,0.3)' }}>Identify</span>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: view === 'forgot_otp' ? '#000' : 'rgba(0,0,0,0.3)' }}>Verify</span>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: view === 'forgot_reset' ? '#000' : 'rgba(0,0,0,0.3)' }}>Secure</span>
              </div>
            </div>

            {/* Step 1: Email */}
            {view === 'forgot_email' && (
              <form onSubmit={handleForgotSubmitEmail} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                  <Mail size={32} strokeWidth={1.5} color="#000" />
                </div>
                <SplitText
                  text="Reset Identity"
                  className="text-[24px] font-bold text-center mb-1"
                  delay={50}
                  duration={1.2}
                  splitType="chars"
                  tag="h1"
                  textAlign="center"
                />
                <p style={{ textAlign: 'center', marginBottom: '20px', opacity: 0.7, fontSize: '13px' }}>Enter your authorized email to receive a recovery code.</p>
                {fpError && <p className="error-msg">{fpError}</p>}
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  required
                  autoFocus
                />
                <button type="submit" disabled={fpSubmitting} style={{ width: '100%', marginTop: 16 }}>
                  {fpSubmitting ? 'Sending OTP…' : 'Send OTP'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 24 }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); resetForgotFlow(); }} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#000' }}>
                    <ChevronLeft size={16} /> Back to Sign In
                  </a>
                </p>
              </form>
            )}

            {/* Step 2: OTP */}
            {view === 'forgot_otp' && (
              <form onSubmit={handleForgotVerifyOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                  <ShieldCheck size={32} strokeWidth={1.5} color="#000" />
                </div>
                <SplitText
                  text="Verify Access"
                  className="text-[24px] font-bold text-center mb-1"
                  delay={50}
                  duration={1.2}
                  splitType="chars"
                  tag="h1"
                  textAlign="center"
                />
                <p style={{ textAlign: 'center', marginBottom: '20px', opacity: 0.7, fontSize: '13px' }}>
                  We've transmitted a specialized 6-digit security code to <strong>{fpEmail}</strong>
                </p>
                {fpMessage && <p style={{ textAlign: 'center', color: 'rgba(0,0,0,0.5)', fontSize: 13, marginBottom: 16, fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '10px 16px', borderRadius: 10 }}>{fpMessage}</p>}
                {fpError && <p className="error-msg">{fpError}</p>}
                <input
                  type="text"
                  placeholder="6-digit OTP"
                  value={fpOtp}
                  onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: 22, fontWeight: 700 }}
                />
                <button type="submit" disabled={fpSubmitting || fpOtp.length !== 6} style={{ width: '100%', marginTop: 16 }}>
                  {fpSubmitting ? 'Verifying…' : 'Verify OTP'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 20 }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot_email'); setFpOtp(''); setFpError(''); }} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#000' }}>
                    <ChevronLeft size={16} /> Re-enter Email
                  </a>
                </p>
              </form>
            )}

            {/* Step 3: New password */}
            {view === 'forgot_reset' && (
              <form onSubmit={handleForgotReset} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                  <Lock size={32} strokeWidth={1.5} color="#000" />
                </div>
                <SplitText
                  text="Secure Account"
                  className="text-[24px] font-bold text-center mb-1"
                  delay={50}
                  duration={1.2}
                  splitType="chars"
                  tag="h1"
                  textAlign="center"
                />
                <p style={{ textAlign: 'center', marginBottom: '20px', opacity: 0.7, fontSize: '13px' }}>Define a robust new cryptographic credential to finalize your recovery.</p>
                {fpError && <p className="error-msg">{fpError}</p>}
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showFpNewPassword ? "text" : "password"}
                    placeholder="New Password (min 8 chars)"
                    value={fpNewPassword}
                    onChange={(e) => setFpNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowFpNewPassword(!showFpNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '0',
                      bottom: '0',
                      margin: 'auto',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#000',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      zIndex: 10
                    }}
                  >
                    {showFpNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showFpConfirmPassword ? "text" : "password"}
                    placeholder="Confirm New Password"
                    value={fpConfirmPassword}
                    onChange={(e) => setFpConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowFpConfirmPassword(!showFpConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '0',
                      bottom: '0',
                      margin: 'auto',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#000',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      zIndex: 10
                    }}
                  >
                    {showFpConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <button type="submit" disabled={fpSubmitting} style={{ width: '100%', marginTop: 16 }}>
                  {fpSubmitting ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ---- Main login/signup view ----
  return (
    <div className="auth-body selection:bg-white selection:text-black">
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Particles
          particleColors={["#ffffff"]}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover
          alphaParticles={false}
          disableRotation={false}
          pixelRatio={1}
        />
      </div>
      <div className={`container ${isRightPanelActive ? 'right-panel-active' : ''}`} id="container">
        {/* Sign Up Container */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp}>
            <SplitText
              text="Create Account"
              className="text-[40px] font-bold text-white mb-2"
              delay={50}
              duration={1.2}
              splitType="chars"
              tag="h1"
            />
            <span className="auth-subtitle">Enter your details for registration</span>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showSignUpPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '0',
                  bottom: '0',
                  margin: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#000',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  zIndex: 10
                }}
              >
                {showSignUpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="SUPER_ADMIN">SUPER ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPPORT">SUPPORT</option>
            </select>
            {error && isRightPanelActive && <p className="error-msg">{error}</p>}
            <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Sign Up'}</button>
          </form>
        </div>

        {/* Sign In Container */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSubmit}>
            <SplitText
              text="Sign In"
              className="text-[40px] font-bold text-white mb-2"
              delay={50}
              duration={1.2}
              splitType="chars"
              tag="h1"
            />
            <span className="auth-subtitle">Use your admin email and password</span>
            <input
              type="email"
              placeholder="admin@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showSignInPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSignInPassword(!showSignInPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '0',
                  bottom: '0',
                  margin: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#000',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  zIndex: 10
                }}
              >
                {showSignInPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <a
              href="#"
              className="forgot-password-link"
              onClick={(e) => { e.preventDefault(); setFpEmail(email.trim()); setView('forgot_email'); }}
            >
              Forgot password?
            </a>
            {error && !isRightPanelActive && <p className="error-msg">{error}</p>}
            <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign In'}</button>
          </form>

        </div>

        {/* Overlay */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">

              <SplitText
                text="Welcome Back Admin"
                className="text-[32px] font-bold text-white mb-2"
                delay={50}
                duration={1.2}
                splitType="chars"
                tag="h1"
              />
              <p>Enter your enterprise credentials to manage the operator workspace.</p>
              <div className="module-grid">
                <div className="module-item"><i className="fas fa-shield-alt"></i><p>SECURITY</p></div>
                <div className="module-item"><i className="fas fa-terminal"></i><p>SYSTEM</p></div>
              </div>
              <button className="ghost" id="signIn" onClick={() => setIsRightPanelActive(false)}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">

              <SplitText
                text="Welcome Back Admin"
                className="text-[32px] font-bold text-white mb-2"
                delay={50}
                duration={1.2}
                splitType="chars"
                tag="h1"
                textAlign="center"
              />
              <p>Unified operations panel for fleet management, CRM, Expenses and support excellence.</p>
              <div className="module-grid">
                <div className="module-item"><i className="fas fa-users"></i><p>CRM</p></div>
                <div className="module-item"><i className="fas fa-car"></i><p>FLEET</p></div>
                <div className="module-item"><i className="fas fa-file-invoice"></i><p>EXPENSES</p></div>
                <div className="module-item"><i className="fas fa-headset"></i><p>SUPPORT</p></div>
              </div>
              <button className="ghost" id="signUp" onClick={() => setIsRightPanelActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

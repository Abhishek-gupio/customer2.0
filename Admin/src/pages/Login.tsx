import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { token, login, signup, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('SUPPORT');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);

  if (token && !loading) return <Navigate to="/" replace />;

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
      // Auto-login after signup
      const loginRes = await login(email.trim(), password);
      if (loginRes.ok) navigate('/', { replace: true });
      else setError('Account created but login failed. Please sign in manually.');
    } else {
      setError(res.error ?? 'Registration failed');
    }
  };

  const handleSignUpClick = () => {
    setIsRightPanelActive(true);
  };

  const handleSignInClick = () => {
    setIsRightPanelActive(false);
  };

  return (
    <div className="auth-body selection:bg-white selection:text-black">
      <div className={`container ${isRightPanelActive ? 'right-panel-active' : ''}`} id="container">
        {/* Sign Up Container */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            <span className="mt-8">Enter your details for registration</span>
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
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="role-select"
            >
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPPORT">SUPPORT</option>
            </select>
            <button type="submit" disabled={submitting}>
              {submitting ? 'CREATING...' : 'SIGN UP'}
            </button>
            {error && isRightPanelActive && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] font-bold text-red-500">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Sign In Container */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSubmit}>
            <div className="mb-6 text-left w-full">
              <h1 className="text-4xl mb-2 font-black">Sign In</h1>
              <p className="m-0 text-white/40 text-sm">Use your admin email and password</p>
            </div>
            
            <input 
              type="email" 
              placeholder="support@gmail.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <a href="#" className="forgot-password-link">Forgot password?</a>

            {error && isRightPanelActive === false && (
              <div className="w-full mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] font-bold text-red-500">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'AUTHENTICATING...' : 'SIGN IN'}
            </button>

            <div className="mt-12 w-full text-center">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-30">Premium monochrome theme</span>
            </div>
          </form>
        </div>

        {/* Overlay Container */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <div className="status-badge">
                <div className="pulse"></div>
                Secure Access
              </div>
              <h1 className="text-5xl mb-6">Welcome<br/>Back</h1>
              <p>Enter your enterprise credentials to manage the operator workspace.</p>
              
              <div className="module-grid">
                <div className="module-item">
                  <i className="fas fa-shield-alt"></i>
                  <p>Security</p>
                </div>
                <div className="module-item">
                  <i className="fas fa-terminal"></i>
                  <p>System</p>
                </div>
              </div>

              <button className="ghost mt-12" id="signIn" onClick={handleSignInClick}>
                SIGN IN
              </button>
            </div>
            <div className="overlay-panel overlay-right">
              <div className="status-badge">
                <div className="pulse"></div>
                System Online
              </div>
              <h1 className="text-5xl mb-6">Admin<br/>Console</h1>
              <p>Unified operations panel for fleet management, CRM, and support excellence.</p>
              
              <div className="module-grid">
                <div className="module-item">
                  <i className="fas fa-users"></i>
                  <p>CRM</p>
                </div>
                <div className="module-item">
                  <i className="fas fa-car-side"></i>
                  <p>Fleet</p>
                </div>
                <div className="module-item">
                  <i className="fas fa-file-invoice-dollar"></i>
                  <p>Billing</p>
                </div>
                <div className="module-item">
                  <i className="fas fa-headset"></i>
                  <p>Support</p>
                </div>
              </div>

              <button className="ghost mt-12" id="signUp" onClick={handleSignUpClick}>
                SIGN UP
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  try {
    await login(email, password);
    // REMOVE navigate('/') - The AuthProvider state change will 
    // automatically swap the Login form for the Admin content.
  } catch (err) {
    setError('Invalid Admin Credentials');
  }
};

  return (
    <div className={styles.pageContainer}>
      <div className={styles.loginCard}>
        <div className={styles.cardHeader}>
          <div className={styles.lockIconWrapper}><FiLock size={24} /></div>
          <h1>SwiftPOS Login</h1>
          <p>Please enter your credentials to continue</p>
        </div>
        <div className={styles.cardBody}>
          {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '12px' }}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <FiUser style={{marginRight: '10px', color: '#64748b'}} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <FiLock style={{marginRight: '10px', color: '#64748b'}} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <div onClick={() => setShowPassword(!showPassword)} style={{cursor:'pointer'}}>
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </div>
              </div>
            </div>
            <button type="submit" className={styles.submitBtn}>ACCESS TERMINAL</button>
          </form>
          <div className={styles.forgotPassword}>FORGOT PASSWORD? CONTACT ADMIN</div>
        </div>
      </div>
    </div>
  );
};
export default Login;
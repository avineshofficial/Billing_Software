// src/components/Layout/Layout.jsx
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiLogOut, FiLogIn } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import styles from './Layout.module.css';

const Layout = () => {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // After logout, just go back to the public POS screen
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className={styles.layoutWrapper}>
      <header className={styles.header}>
        <div className={styles.logo}>
          நெருங்கிய <span>கூட்டாளி</span>
        </div>

        <nav className={styles.nav}>
  <NavLink to="/" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>POS</NavLink>
  <NavLink to="/reports" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>REPORTS</NavLink>
  <NavLink to="/admin" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>ADMIN</NavLink>
  <NavLink to="/logs" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>LOGS</NavLink>
  <NavLink to="/customers" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>CUSTOMERS</NavLink>
  <NavLink to="/employees" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>EMPLOYEES</NavLink>
  </nav>


        <div className={styles.userSection}>
          {currentUser ? (
            <>
              {/* If logged in, show Admin details and Logout */}
              <div className={styles.userDetails}>
                <span className={styles.userName}>{currentUser.email ? currentUser.email.split('@')[0] : 'ADMIN'}</span>
                <span className={styles.userRole}>Admin Session</span>
              </div>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                <FiLogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              {/* If NOT logged in, show a generic label and Login button */}
              <div className={styles.userDetails}>
                <span className={styles.userName}>GUEST</span>
                <span className={styles.userRole}>Staff Terminal</span>
              </div>
              <button onClick={() => navigate('/login')} className={styles.logoutBtn}>
                <FiLogIn size={16} /> Login
              </button>
            </>
          )}
        </div>
      </header>

      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
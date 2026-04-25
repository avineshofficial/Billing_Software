// src/components/ProtectedRoute.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Outlet } from 'react-router-dom';
import Login from '../pages/Login/Login';

const ProtectedRoute = () => {
  const { currentUser } = useAuth();

  // If NOT logged in, show the Login component instead of the page content
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
        <Login />
      </div>
    );
  }

  // If logged in, show the protected content (Inventory, Logs, etc.)
  return <Outlet />;
};

export default ProtectedRoute;
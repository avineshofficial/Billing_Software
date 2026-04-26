import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import JsonImporter from './pages/Admin/JsonImporter';

// Pages
import POS from './pages/POS/POS';
import Inventory from './pages/Admin/Inventory';
import AddProduct from './pages/Admin/AddProduct';
import BulkAdd from './pages/Admin/BulkAdd';
import Reports from './pages/Reports/Reports';
import Logs from './pages/Logs/Logs';
import Customers from './pages/Customers/Customers';
import Employees from './pages/Employees/Employees';
import SalaryDetails from './pages/Employees/SalaryDetails';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              
              {/* --- PUBLIC ROUTES (No Login Needed) --- */}
              <Route index element={<POS />} />
              <Route path="reports" element={<Reports />} />

              {/* --- SECURE ROUTES (Login Card will show here) --- */}
              <Route element={<ProtectedRoute />}>
              <Route path="customers" element={<Customers />} />
                <Route path="logs" element={<Logs />} />
                <Route path="admin" element={<Inventory />} />
                <Route path="employees" element={<Employees />} />
                <Route path="employees/:id" element={<SalaryDetails />} />
                <Route path="admin/importer" element={<JsonImporter />} />
                <Route path="admin/add-product" element={<AddProduct />} />
                <Route path="admin/edit-product/:id" element={<AddProduct />} />
                <Route path="admin/bulk-add" element={<BulkAdd />} />
              </Route>

            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
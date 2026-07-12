import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import styles from './BulkAdd.module.css';

const BulkAdd = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Initial state with 3 empty rows
  const [rows, setRows] = useState([
    { id: 1, name: '', sku: '', category: 'General', purchasePrice: '', mrp: '', salePrice: '', stock: '', gst: '0' },
    { id: 2, name: '', sku: '', category: 'General', purchasePrice: '', mrp: '', salePrice: '', stock: '', gst: '0' },
    { id: 3, name: '', sku: '', category: 'General', purchasePrice: '', mrp: '', salePrice: '', stock: '', gst: '0' },
  ]);

  const addRow = () => {
    setRows([...rows, { 
        id: Date.now(), 
        name: '', 
        sku: '', 
        category: 'General', 
        purchasePrice: '',
        mrp: '', 
        salePrice: '', 
        stock: '', 
        gst: '0' 
    }]);
  };

  const deleteRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const updateRow = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.name.trim() !== "");
    if (validRows.length === 0) return alert("Please enter at least one product name.");

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      validRows.forEach(row => {
        const newDocRef = doc(collection(db, "products"));
        batch.set(newDocRef, {
          name: row.name,
          sku: row.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
          category: row.category || 'General',
          purchasePrice: Number(row.purchasePrice) || 0,
          mrp: Number(row.mrp) || 0,
          salePrice: Number(row.salePrice) || 0,
          stock: Number(row.stock) || 0,
          gst: Number(row.gst) || 0,
          image: '', // Bulk upload defaults to no image
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert(`Successfully added ${validRows.length} products!`);
      navigate('/admin');
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert("Failed to save products. Check console.");
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.backLink} onClick={() => navigate('/admin')}>
        <FiChevronLeft /> BACK TO INVENTORY
      </div>

      <div className={styles.header}>
        <h1>Bulk Add Products</h1>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Product Name*</th>
              <th style={{ width: '12%' }}>SKU (Opt)</th>
              <th style={{ width: '12%' }}>Category</th>
              <th style={{ width: '10%' }}>Purchase</th>
              <th style={{ width: '10%' }}>MRP</th>
              <th style={{ width: '10%' }}>Sale Price</th>
              <th style={{ width: '8%' }}>Stock</th>
              <th style={{ width: '8%' }}>GST %</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input 
                    placeholder="Enter name" 
                    value={row.name} 
                    onChange={(e) => updateRow(row.id, 'name', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    placeholder="Auto" 
                    value={row.sku} 
                    onChange={(e) => updateRow(row.id, 'sku', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    value={row.category} 
                    onChange={(e) => updateRow(row.id, 'category', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    placeholder="Cost" 
                    value={row.purchasePrice} 
                    onChange={(e) => updateRow(row.id, 'purchasePrice', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={row.mrp} 
                    onChange={(e) => updateRow(row.id, 'mrp', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={row.salePrice} 
                    onChange={(e) => updateRow(row.id, 'salePrice', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={row.stock} 
                    onChange={(e) => updateRow(row.id, 'stock', e.target.value)} 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    value={row.gst} 
                    onChange={(e) => updateRow(row.id, 'gst', e.target.value)} 
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <FiTrash2 className={styles.trashBtn} onClick={() => deleteRow(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <button className={styles.addRowBtn} onClick={addRow}>
          <FiPlus /> ADD ROW
        </button>

        <div className={styles.footer}>
          <button 
            className={styles.btnSaveAll} 
            onClick={handleSaveAll} 
            disabled={loading}
          >
            {loading ? "SAVING..." : "SAVE ALL PRODUCTS"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAdd;
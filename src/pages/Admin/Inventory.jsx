// src/pages/Admin/Inventory.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiTrash2, FiEdit3 } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import styles from './Inventory.module.css';

const Inventory = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Delete this product?")) await deleteDoc(doc(db, 'products', id));
  };

  const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={styles.adminContainer}>
      <div className={styles.headerRow}>
        <h1>Inventory Management</h1>
        <div className={styles.actionButtons}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/bulk-add')}>BULK ADD</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/add-product')}><FiPlus /> SINGLE ADD</button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.searchBox}><FiSearch /><input placeholder="Search..." onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <table className={styles.dataTable}>
          <thead>
            <tr><th>Code</th><th>Product Name</th><th>MRP</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    {p.image && <img src={p.image} alt="" style={{width:'30px', height:'30px', borderRadius:'4px', objectFit:'cover'}} />}
                    {p.name}
                </td>
                <td>₹{p.mrp}</td><td>₹{p.salePrice}</td><td>{p.stock}</td>
                <td style={{display:'flex', gap:'15px'}}>
                  <FiEdit3 style={{cursor:'pointer', color:'#0f172a'}} onClick={() => navigate(`/admin/edit-product/${p.id}`)} />
                  <FiTrash2 style={{cursor:'pointer', color:'#ef4444'}} onClick={() => handleDelete(p.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default Inventory;
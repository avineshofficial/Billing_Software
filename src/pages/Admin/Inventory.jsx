import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiSearch, FiPlus, FiTrash2, FiEdit3, FiRefreshCw, FiUpload, FiFilter 
} from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import styles from './Inventory.module.css';

const Inventory = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // MANUAL FETCH FUNCTION (Reduces Database Reads)
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Failed to fetch products:", e);
      alert("Could not connect to database.");
    }
    setLoading(false);
  };

  // Fetch data only once when the page first loads
  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This is permanent.`)) {
      try {
        await deleteDoc(doc(db, 'products', id));
        fetchProducts(); // Refresh the list after deleting
      } catch (e) {
        alert("Failed to delete product.");
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stockValue = products.reduce((total, p) => total + (Number(p.stock || 0) * Number(p.salePrice || 0)), 0);

  return (
    <div className={styles.adminContainer}>
      <div className={styles.headerRow}>
        <div>
          <h1>Inventory Management</h1>
          <p>Live Inventory Dashboard</p>
        </div>
        <div className={styles.actionButtons}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/bulk-add')}><FiUpload /> BULK UPLOAD</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/add-product')}><FiPlus /> SINGLE ADD</button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <FiSearch color="#94a3b8"/>
          <input 
            placeholder="Search by name or SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className={styles.btnSecondary} onClick={fetchProducts}>
          <FiRefreshCw className={loading ? "spin" : ""} /> REFRESH
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr><th>Code (SKU)</th><th>Product Name</th><th>MRP</th><th>Sale Price</th><th>Stock</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'30px'}}>Loading...</td></tr>
            ) : filteredProducts.map(p => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td style={{fontWeight:'700'}}>{p.name}</td>
                <td>₹{Number(p.mrp).toFixed(2)}</td>
                <td>₹{Number(p.salePrice).toFixed(2)}</td>
                <td style={{color: p.stock <= 0 ? '#ef4444' : 'inherit', fontWeight: p.stock <= 0 ? '700' : 'normal'}}>{p.stock}</td>
                <td style={{display:'flex', gap:'20px'}}>
                  <FiEdit3 style={{cursor:'pointer', color:'#0f172a'}} onClick={() => navigate(`/admin/edit-product/${p.id}`)} />
                  <FiTrash2 style={{cursor:'pointer', color:'#ef4444'}} onClick={() => handleDelete(p.id, p.name)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Items</div>
          <div className={styles.statValue}>{products.length}</div>
        </div>
      </div>
    </div>
  );
};
export default Inventory;
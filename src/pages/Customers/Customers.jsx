import React, { useState, useEffect } from 'react';
import { FiUsers, FiSearch, FiTrash2, FiPlus, FiPhone, FiUser } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from './Customers.module.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Form State for new customer
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newPhone) return alert("Phone number is required");
    
    try {
      await addDoc(collection(db, 'customers'), {
        name: newName || 'New Customer',
        phone: newPhone,
        points: 0,
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewPhone('');
      alert("Customer Added!");
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete ${name}?`)) await deleteDoc(doc(db, 'customers', id));
  };

  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1><FiUsers /> Customer Management</h1>
      </div>

      {/* MANUAL ADD SECTION */}
      <form className={styles.addForm} onSubmit={handleManualAdd}>
        <div className={styles.inputBox}>
            <label>Customer Name</label>
            <input type="text" placeholder="John Doe" value={newName} onChange={(e)=>setNewName(e.target.value)} />
        </div>
        <div className={styles.inputBox}>
            <label>Phone Number</label>
            <input type="text" placeholder="9876543210" value={newPhone} onChange={(e)=>setNewPhone(e.target.value)} />
        </div>
        <button type="submit" className={styles.btnAdd}><FiPlus /> ADD CUSTOMER</button>
      </form>

      <div className={styles.searchBarContainer}>
        <FiSearch />
        <input placeholder="Search directory..." onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.custTable}>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Points</th><th style={{textAlign:'right'}}>Manage</th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.phone}</td>
                <td><span className={styles.pointsBadge}>{c.points || 0} pts</span></td>
                <td style={{textAlign:'right'}}>
                  <FiTrash2 className={styles.deleteBtn} onClick={() => handleDelete(c.id, c.name)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Customers;
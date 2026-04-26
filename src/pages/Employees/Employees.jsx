import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiTrash2, FiPhone, FiUser, FiSearch } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from './Employees.module.css';

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- NEW: State for the search bar ---
  const [searchTerm, setSearchTerm] = useState('');

  // Form State for new employee
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!name || !phone) return alert("Employee Name and Phone are required.");
    
    try {
      await addDoc(collection(db, 'employees'), {
        name: name,
        phone: phone,
        role: role || 'Staff',
        salary: Number(salary) || 0,
        createdAt: serverTimestamp()
      });
      setName(''); setPhone(''); setRole(''); setSalary('');
      alert("Employee added successfully!");
    } catch (error) {
      console.error("Error adding employee:", error);
    }
  };

  const handleDelete = async (e, id, employeeName) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove ${employeeName}?`)) {
      await deleteDoc(doc(db, 'employees', id));
    }
  };

  // --- NEW: Filtering logic ---
  const filteredEmployees = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.phone?.includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1><FiUsers /> Employee Management</h1>
      </div>

      <form className={styles.addForm} onSubmit={handleAddEmployee}>
        <div className={styles.formGrid}>
          <div className={styles.inputGroup}>
            <label>Employee Name</label>
            <input type="text" placeholder="e.g., John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Phone Number</label>
            <input type="text" placeholder="e.g., 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Role</label>
            <input type="text" placeholder="e.g., Cashier, Manager" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label>Base Salary (Monthly)</label>
            <input type="number" placeholder="e.g., 15000" value={salary} onChange={(e) => setSalary(e.target.value)} />
          </div>
          <button type="submit" className={styles.btnAdd}><FiPlus /> ADD</button>
        </div>
      </form>

      {/* --- NEW: Search Bar Component --- */}
      <div className={styles.searchBarContainer}>
        <FiSearch color="#94a3b8" />
        <input 
          type="text"
          placeholder="Search employees by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.employeeTable}>
          <thead>
            <tr>
              <th>Employee Details</th>
              <th>Role</th>
              <th>Base Salary</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{textAlign:'center', padding:'40px'}}>Loading Employees...</td></tr>
            ) : filteredEmployees.map(emp => (
              <tr key={emp.id} className={styles.tableRow} onClick={() => navigate(`/employees/${emp.id}`)}>
                <td>
                  <div style={{fontWeight:'700', display:'flex', alignItems:'center', gap:'10px'}}><FiUser/> {emp.name}</div>
                  <div style={{fontSize:'12px', color:'#64748b', display:'flex', alignItems:'center', gap:'10px'}}><FiPhone/> {emp.phone}</div>
                </td>
                <td>{emp.role}</td>
                <td style={{fontWeight:'700'}}>₹{emp.salary.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className={styles.deleteBtn} onClick={(e) => handleDelete(e, emp.id, emp.name)}>
                    <FiTrash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Employees;
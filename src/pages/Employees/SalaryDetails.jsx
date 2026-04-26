import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiUser, FiPlus, FiTrash2 } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { doc, getDoc, collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';
import styles from './SalaryDetails.module.css';

const SalaryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [history, setHistory] = useState([]);
  
  // State for filtering
  const [filterType, setFilterType] = useState('');

  // Form state for new salary record
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
      const docRef = doc(db, 'employees', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEmployee({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    };
    fetchEmployee();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, `employees/${id}/salaryHistory`), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dateObj: doc.data().date?.toDate() || new Date() })));
    });
    return () => unsubscribe();
  }, [id]);

  const handleAddRecord = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `employees/${id}/salaryHistory`), {
      amount: Number(amount),
      type: type || 'General',
      notes: notes,
      date: serverTimestamp()
    });
    setAmount(''); setType(''); setNotes('');
  };

  const deleteRecord = async (recordId) => {
    if (window.confirm("Delete this record?")) await deleteDoc(doc(db, `employees/${id}/salaryHistory`, recordId));
  };

  // Filtering Logic
  const filteredHistory = history.filter(rec => {
    if (!filterType) return true; // Show all if filter is empty
    return rec.type.toLowerCase().includes(filterType.toLowerCase());
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.backLink} onClick={() => navigate('/employees')}>
        <FiChevronLeft /> BACK TO EMPLOYEE LIST
      </div>

      <div className={styles.profileCard}>
        <div className={styles.avatar}><FiUser size={40} /></div>
        <div className={styles.info}>
          <h1>{employee.name}</h1>
          <p>{employee.role} | {employee.phone}</p>
        </div>
      </div>

      <form className={styles.addRecordForm} onSubmit={handleAddRecord}>
        <h3>Add New Financial Record</h3>
        <div className={styles.formGrid}>
          <div className={styles.inputGroup}>
            <label>Amount (₹)</label>
            <input type="number" placeholder="e.g., 15000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Record Type</label>
            <input type="text" placeholder="e.g., Salary, Bonus" value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label>Notes (Optional)</label>
            <input type="text" placeholder="e.g., Performance Bonus" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="submit" className={styles.btnAdd}><FiPlus/> Add Record</button>
        </div>
      </form>

      {/* FILTER BAR */}
      <div className={styles.filterBar}>
        <h3>History</h3>
        <input 
          className={styles.filterInput}
          placeholder="Filter by type..."
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.historyTable}>
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th><th>Action</th></tr></thead>
          <tbody>
            {filteredHistory.map(rec => (
              <tr key={rec.id}>
                <td>{rec.dateObj.toLocaleDateString()}</td>
                <td><span className={styles.typeBadge}>{rec.type}</span></td>
                <td style={{fontWeight:700}}>₹{rec.amount.toFixed(2)}</td>
                <td>{rec.notes}</td>
                <td><FiTrash2 style={{cursor:'pointer', color:'#94a3b8'}} onClick={() => deleteRecord(rec.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default SalaryDetails;
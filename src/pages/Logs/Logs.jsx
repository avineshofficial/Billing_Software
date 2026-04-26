import React, { useState, useEffect } from 'react';
import { FiShield, FiClock, FiUser, FiTrash2, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import styles from './Logs.module.css';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().timestamp?.toDate().toLocaleString() || 'Syncing...'
      })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DELETE PARTICULAR LOG ---
  const deleteParticularLog = async (id) => {
    if (window.confirm("Permanently delete this log entry?")) {
      await deleteDoc(doc(db, 'logs', id));
    }
  };

  // --- DELETE ALL LOGS (Overall Delete) ---
  const clearAllLogs = async () => {
    if (window.confirm("CRITICAL: Are you sure you want to WIPE ALL audit logs? This cannot be undone.")) {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'logs'));
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      alert("Audit logs cleared.");
    }
  };

  const getActionColor = (action) => {
    if (action.includes('DELETED')) return { bg: '#fee2e2', text: '#991b1b' }; // Red
    if (action.includes('EDITED')) return { bg: '#fef3c7', text: '#92400e' };  // Yellow/Orange
    return { bg: '#dcfce7', text: '#166534' }; // Green
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><FiShield /> System Audit Logs</h1>
          <p className={styles.subtitle}>Full traceability of terminal modifications and financial edits.</p>
        </div>
        <button className={styles.clearAllBtn} onClick={clearAllLogs}>
          <FiTrash2 /> CLEAR ALL LOGS
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th>LOG ID / TIME</th>
              <th>OPERATOR</th>
              <th>ACTION</th>
              <th>MODIFICATION DETAILS</th>
              <th style={{ textAlign: 'right' }}>MANAGE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className={styles.loadingTd}>Loading Audit Trail...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="5" className={styles.loadingTd}>No logs recorded yet.</td></tr>
            ) : (
              logs.map(log => {
                const colors = getActionColor(log.action);
                return (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>
                      <div className={styles.logId}>#{log.id.slice(0, 8)}</div>
                      <div className={styles.timestamp}><FiClock size={12}/> {log.time}</div>
                    </td>
                    <td className={styles.userCell}>
                      <FiUser size={14} /> {log.user.split('@')[0]}
                      <div className={styles.fullEmail}>{log.user}</div>
                    </td>
                    <td>
                      <span className={styles.actionBadge} style={{ backgroundColor: colors.bg, color: colors.text }}>
                        {log.action}
                      </span>
                    </td>
                    <td className={styles.detailsCell}>
                      <FiInfo size={14} style={{ marginRight: '8px', color: '#94a3b8' }} />
                      {log.details}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className={styles.deleteRowBtn} onClick={() => deleteParticularLog(log.id)}>
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Logs;
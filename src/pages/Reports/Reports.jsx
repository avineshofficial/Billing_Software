import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  FiActivity, FiClock, FiSearch, FiCheckCircle, FiEye, 
  FiX, FiPrinter, FiMinus, FiPlus, FiCalendar, FiDownload, FiTrash2, FiFilter 
} from 'react-icons/fi';
import { db } from '../../services/firebase';
import { 
  collection, onSnapshot, query, orderBy, doc, 
  writeBatch, increment, serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logAction } from '../../utils/logger';
import { useReactToPrint } from 'react-to-print';
import InvoiceTicket from '../POS/InvoiceTicket';
import styles from './Reports.module.css';

const Reports = () => {
  const { currentUser } = useAuth();
  const printRef = useRef();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- DATE FILTER STATES ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal & Edit States
  const [selectedBill, setSelectedBill] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'bills'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        displayBillNo: doc.data().billNo || doc.data().billNumber || doc.id.slice(-6).toUpperCase(),
        dateObj: doc.data().timestamp?.toDate() || new Date()
      })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setSelectedBill(null)
  });

  const recalculateBill = (items) => {
    let sub = 0, gst = 0, disc = 0;
    items.forEach(i => {
      const price = Number(i.salePrice || 0);
      const qty = Number(i.qty || 0);
      const lineSub = price * qty;
      const lineDisc = lineSub * (Number(i.discountPercent || 0) / 100);
      const lineGst = (lineSub - lineDisc) * (Number(i.gstPercent || 0) / 100);
      sub += lineSub; disc += lineDisc; gst += lineGst;
    });
    return { subtotal: sub, gstTotal: gst, discount: disc, netPay: sub - disc + gst };
  };

  const handleQtyChange = (itemId, change) => {
    const updated = selectedBill.items.map(item => 
      item.id === itemId ? { ...item, qty: Math.max(0, item.qty + change) } : item
    );
    const totals = recalculateBill(updated);
    setSelectedBill({ ...selectedBill, items: updated, ...totals });
  };

  const saveChanges = async () => {
    try {
      const batch = writeBatch(db);
      const billRef = doc(db, 'bills', selectedBill.id);
      const original = bills.find(b => b.id === selectedBill.id);
      const finalItems = selectedBill.items.filter(i => i.qty > 0);

      if (finalItems.length === 0) {
        if (window.confirm("Delete this bill permanently?")) {
          original.items.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(i.qty) }); });
          batch.delete(billRef);
          await batch.commit();
          await logAction(currentUser?.email || "Terminal", "BILL_DELETED", `Deleted Bill #${selectedBill.displayBillNo}`);
          setSelectedBill(null);
        }
        return;
      }
      original.items.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(i.qty) }); });
      finalItems.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(-i.qty) }); });

      batch.update(billRef, {
        items: finalItems, subtotal: Number(selectedBill.subtotal), gstTotal: Number(selectedBill.gstTotal),
        discount: Number(selectedBill.discount), netPay: Number(selectedBill.netPay), editedAt: serverTimestamp()
      });

      await batch.commit();
      await logAction(currentUser?.email || "Terminal", "BILL_EDITED", `Updated Bill #${selectedBill.displayBillNo}`);
      setIsEditing(false);
      alert("Bill Updated!");
    } catch (e) { alert("Error updating record."); }
  };

  // --- STATS LOGIC (Always for Today, ignoring date filter) ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayIncome = bills
    .filter(b => b.dateObj >= todayStart && b.dateObj <= todayEnd)
    .reduce((s, b) => s + Number(b.netPay || 0), 0);
  
  const totalSalesValue = bills.reduce((s, b) => s + Number(b.netPay || 0), 0);

  // --- TABLE FILTER LOGIC ---
  const filteredBills = bills.filter(b => {
    const matchesSearch = b.displayBillNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.customer?.phone && b.customer.phone.includes(searchTerm));
    
    let matchesDate = true;
    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && b.dateObj >= sDate;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && b.dateObj <= eDate;
    }

    return matchesSearch && matchesDate;
  });

  const getFlowData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6-i));
      const start = new Date(d).setHours(0,0,0,0);
      const end = new Date(d).setHours(23,59,59,999);
      const val = bills.filter(b => b.dateObj >= start && b.dateObj <= end).reduce((s, b) => s + Number(b.netPay || 0), 0);
      return { day: days[d.getDay()], sales: val };
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Financial Reports</h1>
        <p>Real-time analytics and transaction history management.</p>
      </div>

      {/* --- INCOME STATEMENT (UNFILTERED) --- */}
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TODAY'S INCOME</span>
          <div className={styles.cardValue}>₹{todayIncome.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiActivity /> Fixed: Today strictly</div>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TOTAL SALES (LIFETIME)</span>
          <div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiCalendar /> {bills.length} total bills</div>
        </div>
        <div className={styles.cardDark}>
          <span className={styles.cardLabel}>ANNUAL REVENUE</span>
          <div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiCheckCircle /> Current FY</div>
        </div>
      </div>

      {/* --- DATE FILTER BAR --- */}
      <div className={styles.filterBar}>
        <div className={styles.dateGroup}>
          <label>From Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className={styles.dateGroup}>
          <label>To Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className={styles.searchBox}>
          <FiSearch />
          <input placeholder="Bill No or Phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button className={styles.resetBtn} onClick={() => {setStartDate(''); setEndDate(''); setSearchTerm('');}}>
          CLEAR FILTERS
        </button>
      </div>

      {/* --- BILL HISTORY TABLE --- */}
      <div className={styles.tableWrapper}>
        <div style={{padding:'15px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{fontSize:'16px'}}><FiClock /> Filtered Bills ({filteredBills.length})</h2>
        </div>
        <table className={styles.reportTable}>
          <thead>
            <tr><th>Date & Time</th><th>Bill No</th><th>Customer</th><th>Amount</th><th>Mode</th><th style={{textAlign:'right'}}>View</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'30px'}}>Loading...</td></tr>
            ) : filteredBills.map(bill => (
              <tr key={bill.id}>
                <td>{bill.dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{fontWeight:'800', color: '#0f172a'}}>{bill.displayBillNo}</td>
                <td>{bill.customer?.phone || "Guest"}</td>
                <td style={{fontWeight:'800'}}>₹{Number(bill.netPay).toFixed(2)}</td>
                <td><span className={styles.modeBadge}>{bill.paymentMode}</span></td>
                <td style={{textAlign:'right'}}>
                  <FiEye style={{cursor:'pointer', color:'#64748b'}} onClick={() => { setSelectedBill(bill); setIsEditing(false); }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- FLOW CHART --- */}
      <div className={styles.chartCard}>
        <h3>7-Day Sales Performance (Flow Chart)</h3>
        <div style={{ height: '320px', width: '100%', minWidth: '0' }}> 
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getFlowData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- EDIT/VIEW MODAL --- */}
      {selectedBill && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}><h3>Invoice: {selectedBill.displayBillNo}</h3><FiX style={{cursor:'pointer'}} onClick={() => setSelectedBill(null)} /></div>
            <div className={styles.modalBody}>
              {selectedBill.items.map(item => (
                <div key={item.id} className={styles.editItemRow}>
                  <div><div style={{fontWeight:'700'}}>{item.name}</div><div style={{fontSize:'11px'}}>₹{item.salePrice}</div></div>
                  {isEditing ? (
                    <div className={styles.qtyEditor}><button onClick={() => handleQtyChange(item.id, -1)}>-</button><span>{item.qty}</span><button onClick={() => handleQtyChange(item.id, 1)}>+</button></div>
                  ) : <div style={{fontWeight:'700'}}>x{item.qty}</div>}
                </div>
              ))}
              <div className={styles.modalSummary}>
                 <div className={styles.totalRow}><span>Subtotal:</span><span>₹{selectedBill.subtotal.toFixed(2)}</span></div>
                 <div className={styles.totalRow} style={{fontSize:'18px', fontWeight:'900', color:'#0f172a', borderTop:'1px solid #eee', marginTop:'10px', paddingTop:'10px'}}>
                   <span>TOTAL:</span><span>₹{selectedBill.netPay.toFixed(2)}</span>
                 </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              {isEditing ? <button className={styles.btnSave} onClick={saveChanges}>Save Changes</button> : 
              <><button className={styles.btnCancel} onClick={() => setIsEditing(true)}>Edit Bill</button><button className={styles.btnSave} onClick={handlePrint}><FiPrinter /> Print</button></>}
            </div>
          </div>
        </div>
      )}

      {/* Printing Logic Container */}
      <div style={{ display: 'none' }}><div ref={printRef}>
        {selectedBill && <InvoiceTicket cart={selectedBill.items} subtotal={selectedBill.subtotal} tax={selectedBill.gstTotal} discount={selectedBill.discount} total={selectedBill.netPay} billNo={selectedBill.displayBillNo} payMethod={selectedBill.paymentMode} custName={selectedBill.customer?.name} custPhone={selectedBill.customer?.phone} pointsEarned={0} pointsBalance={0} />}
      </div></div>
    </div>
  );
};

export default Reports;
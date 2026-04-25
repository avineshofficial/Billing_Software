import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  FiActivity, FiClock, FiSearch, FiCheckCircle, FiEye, 
  FiX, FiPrinter, FiMinus, FiPlus, FiCalendar, FiDownload, FiTrash2 
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
  
  // Modal & Edit States
  const [selectedBill, setSelectedBill] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // 1. Fetch Real-time Data (Public Access)
  useEffect(() => {
    console.log("Connecting to Firestore bills collection...");
    const q = query(collection(db, 'bills'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.warn("No bills found in database.");
        setBills([]);
      } else {
        setBills(snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Check for both possible field names for bill number
          displayBillNo: doc.data().billNo || doc.data().billNumber || doc.id.slice(-6).toUpperCase(),
          dateObj: doc.data().timestamp?.toDate() || new Date()
        })));
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore Read Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. CSV Export Logic
  const exportToCSV = () => {
    if (bills.length === 0) return alert("No data to export");
    const headers = ["Date", "Bill No", "Customer", "Amount", "Mode"];
    const rows = bills.map(b => [
      b.dateObj.toLocaleDateString(), 
      b.displayBillNo, 
      b.customer?.phone || "Guest", 
      b.netPay.toFixed(2), 
      b.paymentMode
    ]);
    const content = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(content);
    link.download = `SwiftPOS_Report_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // 3. Printing logic
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setSelectedBill(null)
  });

  // 4. CRUD: Recalculate totals during edit
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

  // 5. CRUD: Save Changes & Adjust Stock
  const saveChanges = async () => {
    try {
      const batch = writeBatch(db);
      const billRef = doc(db, 'bills', selectedBill.id);
      const original = bills.find(b => b.id === selectedBill.id);
      const finalItems = selectedBill.items.filter(i => i.qty > 0);

      // A. Delete bill if empty
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

      // B. Sync stock levels
      original.items.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(i.qty) }); });
      finalItems.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(-i.qty) }); });

      // C. Update Database
      batch.update(billRef, {
        items: finalItems, 
        subtotal: Number(selectedBill.subtotal), 
        gstTotal: Number(selectedBill.gstTotal),
        discount: Number(selectedBill.discount), 
        netPay: Number(selectedBill.netPay), 
        editedAt: serverTimestamp()
      });

      await batch.commit();
      await logAction(currentUser?.email || "Terminal", "BILL_EDITED", `Updated Bill #${selectedBill.displayBillNo}`);
      setIsEditing(false);
      alert("Bill Updated Successfully!");
    } catch (e) { alert("Database Error: " + e.message); }
  };

  // Summary Logic
  const todayStr = new Date().toDateString();
  const todayIncome = bills.filter(b => b.dateObj.toDateString() === todayStr).reduce((s, b) => s + b.netPay, 0);
  const totalSalesValue = bills.reduce((s, b) => s + b.netPay, 0);

  // Flow Chart Data
  const getFlowData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6-i));
      const val = bills.filter(b => b.dateObj.toDateString() === d.toDateString()).reduce((s, b) => s + b.netPay, 0);
      return { day: days[d.getDay()], sales: val };
    });
  };

  const filteredBills = bills.filter(b => 
    b.displayBillNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (b.customer?.phone && b.customer.phone.includes(searchTerm))
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div><h1>Financial Reports</h1><p>Monitor real-time income and manage transactions.</p></div>
        <button className={styles.btnDownload} onClick={exportToCSV}><FiDownload /> DOWNLOAD CSV</button>
      </div>

      {/* --- INCOME STATEMENT --- */}
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TODAY'S INCOME</span>
          <div className={styles.cardValue}>₹{todayIncome.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiActivity /> Live sales today</div>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TOTAL SALES</span>
          <div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiCalendar /> {bills.length} Bills</div>
        </div>
        <div className={styles.cardDark}>
          <span className={styles.cardLabel}>ANNUAL REVENUE</span>
          <div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div>
          <div className={styles.cardSubtext}><FiCheckCircle /> Current FY</div>
        </div>
      </div>

      {/* --- TRANSACTION TABLE --- */}
      <div className={styles.historyHeader}>
        <h2><FiClock /> Bill History</h2>
        <div className={styles.searchBox}>
          <FiSearch color="#94a3b8" />
          <input placeholder="Search INV# or Phone..." onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.reportTable}>
          <thead><tr><th>Date & Time</th><th>Bill No</th><th>Customer</th><th>Amount</th><th>Mode</th><th style={{textAlign:'right'}}>View</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'30px'}}>Syncing with Firestore...</td></tr>
            ) : filteredBills.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'30px'}}>No records found.</td></tr>
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

      {/* --- FLOW CHART SECTION (Fixed Warning) --- */}
      <div className={styles.chartCard} style={{ marginTop: '30px' }}>
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

      {/* --- VIEW / EDIT MODAL --- */}
      {selectedBill && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Invoice: {selectedBill.displayBillNo}</h3>
              <FiX style={{cursor:'pointer'}} onClick={() => setSelectedBill(null)} />
            </div>
            <div className={styles.modalBody}>
              {selectedBill.items.map(item => (
                <div key={item.id} className={styles.editItemRow}>
                  <div><div style={{fontWeight:'700'}}>{item.name}</div><div style={{fontSize:'11px'}}>₹{item.salePrice}</div></div>
                  {isEditing ? (
                    <div className={styles.qtyEditor}>
                      <button onClick={() => handleQtyChange(item.id, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => handleQtyChange(item.id, 1)}>+</button>
                    </div>
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
              {isEditing ? (
                <button className={styles.btnSave} onClick={saveChanges}>Save Changes</button>
              ) : (
                <><button className={styles.btnCancel} onClick={() => setIsEditing(true)}>Edit Bill</button>
                <button className={styles.btnSave} onClick={handlePrint}><FiPrinter /> Print</button></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Wrapper */}
      <div style={{ display: 'none' }}><div ref={printRef}>
        {selectedBill && <InvoiceTicket cart={selectedBill.items} subtotal={selectedBill.subtotal} tax={selectedBill.gstTotal} discount={selectedBill.discount} total={selectedBill.netPay} billNo={selectedBill.displayBillNo} payMethod={selectedBill.paymentMode} custName={selectedBill.customer?.name} custPhone={selectedBill.customer?.phone} pointsEarned={selectedBill.earnedPoints || 0} pointsBalance={0} />}
      </div></div>
    </div>
  );
};

export default Reports;
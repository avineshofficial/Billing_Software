import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  FiActivity, FiClock, FiSearch, FiCheckCircle, FiEye, 
  FiX, FiPrinter, FiMinus, FiPlus, FiCalendar, FiDownload 
} from 'react-icons/fi';
import { db } from '../../services/firebase';
import { 
  collection, onSnapshot, query, orderBy, doc, 
  writeBatch, increment, serverTimestamp, deleteDoc 
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
        displayBillNo: doc.data().billNo || doc.id.slice(-6).toUpperCase(),
        dateObj: doc.data().timestamp?.toDate() || new Date()
      })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- CSV DOWNLOAD LOGIC ---
  const exportToCSV = () => {
    if (filteredBills.length === 0) return alert("No filtered data to export.");

    const headers = ["Date", "Bill No", "Customer Phone", "Payment Mode", "Subtotal", "GST", "Discount", "Net Pay"];
    
    // Map the FILTERED bills to CSV rows
    const rows = filteredBills.map(bill => [
      `"${bill.dateObj.toLocaleString()}"`,
      bill.displayBillNo,
      bill.customer?.phone || "N/A",
      bill.paymentMode,
      bill.subtotal.toFixed(2),
      bill.gstTotal.toFixed(2),
      bill.discount.toFixed(2),
      bill.netPay.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SwiftPOS_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      const operator = currentUser?.email || "Terminal";

      if (finalItems.length === 0) {
        if (window.confirm("Delete this bill permanently?")) {
          original.items.forEach(i => { if(!i.isCustom) batch.update(doc(db, 'products', i.id), { stock: increment(i.qty) }); });
          batch.delete(billRef);
          await batch.commit();
          await logAction(operator, "BILL_DELETED", `Deleted Bill #${selectedBill.displayBillNo}`);
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
      await logAction(operator, "BILL_EDITED", `Modified Bill #${selectedBill.displayBillNo}`);
      setIsEditing(false);
      alert("Bill Updated!");
    } catch (e) { alert("Error updating record."); }
  };

  const todayIncome = bills.filter(b => b.dateObj.toDateString() === new Date().toDateString()).reduce((s, b) => s + Number(b.netPay || 0), 0);
  const totalSalesValue = bills.reduce((s, b) => s + Number(b.netPay || 0), 0);

  const filteredBills = bills.filter(b => {
    const matchesSearch = b.displayBillNo.toLowerCase().includes(searchTerm.toLowerCase()) || (b.customer?.phone && b.customer.phone.includes(searchTerm));
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && b.dateObj >= new Date(new Date(startDate).setHours(0,0,0,0));
    if (endDate) matchesDate = matchesDate && b.dateObj <= new Date(new Date(endDate).setHours(23,59,59,999));
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
        <div><h1>Financial Reports</h1><p>Analyze sales and manage transactions.</p></div>
        {/* --- DOWNLOAD BUTTON --- */}
        <button className={styles.btnDownload} onClick={exportToCSV}>
          <FiDownload /> DOWNLOAD FILTERED REPORT
        </button>
      </div>

      <div className={styles.cardsGrid}>
        <div className={styles.card}><span className={styles.cardLabel}>TODAY'S INCOME</span><div className={styles.cardValue}>₹{todayIncome.toFixed(2)}</div></div>
        <div className={styles.card}><span className={styles.cardLabel}>TOTAL LIFETIME SALES</span><div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div></div>
        <div className={styles.cardDark}><span className={styles.cardLabel}>ANNUAL REVENUE</span><div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div></div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.dateGroup}><label>From Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className={styles.dateGroup}><label>To Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div className={styles.searchBox}><FiSearch /><input placeholder="Bill No or Phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <button className={styles.resetBtn} onClick={() => {setStartDate(''); setEndDate(''); setSearchTerm('');}}>CLEAR</button>
      </div>

      <div className={styles.tableWrapper}>
        <div style={{padding:'15px', borderBottom:'1px solid #eee'}}>
            <h2 style={{fontSize:'16px'}}>Filtered Bills ({filteredBills.length})</h2>
        </div>
        <table className={styles.reportTable}>
          <thead><tr><th>Date & Time</th><th>Bill No</th><th>Customer</th><th>Amount</th><th>Mode</th><th style={{textAlign:'right'}}>Action</th></tr></thead>
          <tbody>
            {filteredBills.map(bill => (
              <tr key={bill.id}>
                <td>{bill.dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{fontWeight:'800', color: '#0f172a'}}>{bill.displayBillNo}</td>
                <td>{bill.customer?.phone || "Guest"}</td>
                <td style={{fontWeight:'800'}}>₹{Number(bill.netPay).toFixed(2)}</td>
                <td><span className={styles.modeBadge}>{bill.paymentMode}</span></td>
                <td style={{textAlign:'right'}}><FiEye style={{cursor:'pointer', color:'#64748b'}} onClick={() => { setSelectedBill(bill); setIsEditing(false); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.chartCard}>
        <h3>7-Day Sales Performance</h3>
        <div style={{ height: '320px' }}><ResponsiveContainer width="100%" height="100%"><BarChart data={getFlowData()}><XAxis dataKey="day" tick={{fontSize:12}} /><Tooltip /><Bar dataKey="sales" fill="#0f172a" /></BarChart></ResponsiveContainer></div>
      </div>

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
                 <div className={styles.totalRow} style={{fontSize:'18px', fontWeight:'900'}}><span>TOTAL:</span><span>₹{selectedBill.netPay.toFixed(2)}</span></div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              {isEditing ? <button className={styles.btnSave} onClick={saveChanges}>Save Changes</button> : 
              <><button className={styles.btnCancel} onClick={() => setIsEditing(true)}>Edit Bill</button><button className={styles.btnSave} onClick={handlePrint}><FiPrinter /> Print</button></>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'none' }}><div ref={printRef}>{selectedBill && <InvoiceTicket cart={selectedBill.items} subtotal={selectedBill.subtotal} tax={selectedBill.gstTotal} discount={selectedBill.discount} total={selectedBill.netPay} billNo={selectedBill.displayBillNo} payMethod={selectedBill.paymentMode} custName={selectedBill.customer?.name} custPhone={selectedBill.customer?.phone} pointsEarned={0} pointsBalance={0} />}</div></div>
    </div>
  );
};

export default Reports;
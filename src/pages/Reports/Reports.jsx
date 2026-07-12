import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  FiActivity, FiClock, FiSearch, FiCheckCircle, FiEye, 
  FiX, FiPrinter, FiMinus, FiPlus, FiCalendar, FiDownload, FiChevronRight
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
  
  // Tab State
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'profit'
  
  // --- DATE FILTER STATES (Default to Today) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Export Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

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
    let toExport = bills;
    if (exportStartDate) toExport = toExport.filter(b => b.dateObj >= new Date(new Date(exportStartDate).setHours(0,0,0,0)));
    if (exportEndDate) toExport = toExport.filter(b => b.dateObj <= new Date(new Date(exportEndDate).setHours(23,59,59,999)));

    if (toExport.length === 0) return alert("No data to export for selected dates.");

    const headers = ["Date", "Bill No", "Customer Phone", "Payment Mode", "Subtotal", "GST", "Discount", "Net Pay"];
    
    const rows = toExport.map(bill => [
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
    link.setAttribute("download", `SwiftPOS_Report_${exportStartDate || 'All'}_to_${exportEndDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, bills.length]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBills = filteredBills.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);

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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
           <div className={styles.tabToggle}>
              <button className={activeTab === 'general' ? styles.tabActive : styles.tabInactive} onClick={() => setActiveTab('general')}>General</button>
              <button className={activeTab === 'profit' ? styles.tabActive : styles.tabInactive} onClick={() => setActiveTab('profit')}>Bill Wise Profit</button>
           </div>
           {/* --- DOWNLOAD BUTTON --- */}
           <button className={styles.btnExport} onClick={() => setShowExportModal(true)}>
             <FiDownload /> DOWNLOAD CSV
           </button>
        </div>
      </div>

      {showExportModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Export Sales Report</h3>
              <FiX style={{cursor:'pointer'}} onClick={() => setShowExportModal(false)} />
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className={styles.dateGroup}>
                  <label>Start Date</label>
                  <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                </div>
                <div className={styles.dateGroup}>
                  <label>End Date</label>
                  <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                </div>
                <p style={{fontSize: '12px', color: '#64748b'}}>Leave dates empty to download all history.</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={exportToCSV}><FiDownload /> Download CSV</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.dateGroup}><label>From Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className={styles.dateGroup}><label>To Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div className={styles.searchBox}><FiSearch /><input placeholder="Bill No or Phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <button className={styles.resetBtn} onClick={() => {setStartDate(''); setEndDate(''); setSearchTerm('');}}>CLEAR</button>
      </div>

      {activeTab === 'general' ? (
        <>
          <div className={styles.cardsGrid}>
            <div className={styles.card}><span className={styles.cardLabel}>TODAY'S INCOME</span><div className={styles.cardValue}>₹{todayIncome.toFixed(2)}</div></div>
            <div className={styles.card}><span className={styles.cardLabel}>TOTAL LIFETIME SALES</span><div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div></div>
            <div className={styles.cardDark}><span className={styles.cardLabel}>ANNUAL REVENUE</span><div className={styles.cardValue}>₹{totalSalesValue.toFixed(2)}</div></div>
          </div>

          <div className={styles.tableWrapper}>
            <div style={{padding:'15px', borderBottom:'1px solid #eee'}}>
                <h2 style={{fontSize:'16px'}}>Filtered Bills ({filteredBills.length})</h2>
            </div>
            <table className={styles.reportTable}>
              <thead><tr><th>Date & Time</th><th>Bill No</th><th>Customer</th><th>Amount</th><th>Mode</th><th style={{textAlign:'right'}}>Action</th></tr></thead>
              <tbody>
                {currentBills.map(bill => (
                  <tr key={bill.id}>
                    <td>{bill.dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{fontWeight:'800', color: '#0f172a'}}>{bill.displayBillNo}</td>
                    <td>{bill.customer?.phone || "Guest"}</td>
                    <td style={{fontWeight:'800'}}>₹{Number(bill.netPay).toFixed(2)}</td>
                    <td><span className={styles.modeBadge}>{bill.paymentMode}</span></td>
                    <td style={{textAlign:'right'}}><FiEye style={{cursor:'pointer', color:'#64748b'}} onClick={() => { setSelectedBill(bill); setIsEditing(false); }} /></td>
                  </tr>
                ))}
                {currentBills.length === 0 && (
                  <tr><td colSpan="6" style={{textAlign:'center', padding: '30px', color: '#64748b'}}>No bills found for the selected filters.</td></tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            <div className={styles.paginationContainer}>
              <div className={styles.itemsPerPage}>
                <label>Rows per page:</label>
                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className={styles.pagination}>
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</button>
                <span>Page {currentPage} of {totalPages || 1}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
              </div>
            </div>
          </div>

          <div className={styles.chartCard}>
            <h3>7-Day Sales Performance</h3>
            <div style={{ height: '320px' }}><ResponsiveContainer width="100%" height="100%"><BarChart data={getFlowData()}><XAxis dataKey="day" tick={{fontSize:12}} /><Tooltip /><Bar dataKey="sales" fill="#0f172a" /></BarChart></ResponsiveContainer></div>
          </div>
        </>
      ) : (
        <div className={styles.profitViewContainer}>
            {(() => {
                const totalSale = filteredBills.reduce((acc, b) => acc + Number(b.netPay || 0), 0);
                const totalProfit = filteredBills.reduce((acc, b) => {
                    let cost = 0;
                    b.items?.forEach(i => {
                        cost += Number(i.purchasePrice || i.costPrice || 0) * (i.qty || 0);
                    });
                    return acc + (Number(b.netPay || 0) - cost);
                }, 0);

                return (
                    <>
                        <div className={styles.profitSummaryGrid}>
                            <div className={styles.profitCard}>
                                <span>Total Sale Amount</span>
                                <div className={styles.saleValue}>₹ {totalSale.toFixed(2)}</div>
                            </div>
                            <div className={styles.profitCard}>
                                <span>Total Profit (+) / Loss (-)</span>
                                <div className={totalProfit >= 0 ? styles.profitValuePos : styles.profitValueNeg}>
                                    {totalProfit >= 0 ? '+' : '-'} ₹ {Math.abs(totalProfit).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className={styles.profitListWrapper}>
                            <div className={styles.profitListHeader}>
                                <div style={{flex: 2}}>Party Name</div>
                                <div style={{flex: 1, textAlign: 'right'}}>Sale Amount</div>
                                <div style={{flex: 1, textAlign: 'right'}}>Profit/Loss</div>
                            </div>
                            
                            <div className={styles.profitList}>
                                {currentBills.map(bill => {
                                    let cost = 0;
                                    bill.items?.forEach(i => {
                                        cost += Number(i.purchasePrice || i.costPrice || 0) * (i.qty || 0);
                                    });
                                    const profit = Number(bill.netPay || 0) - cost;
                                    
                                    const partyName = bill.customer?.name && bill.customer.name !== 'Guest' 
                                        ? bill.customer.name 
                                        : (bill.customer?.phone || 'Guest');
                                    
                                    const formattedDate = bill.dateObj.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

                                    return (
                                        <div key={bill.id} className={styles.profitListItem} onClick={() => { setSelectedBill(bill); setIsEditing(false); }}>
                                            <div className={styles.partyInfo}>
                                                <div className={styles.partyName}>{partyName}</div>
                                                <div className={styles.billMeta}>
                                                    {formattedDate} • #{bill.displayBillNo}
                                                </div>
                                            </div>
                                            <div className={styles.saleAmt}>₹ {Number(bill.netPay).toFixed(2)}</div>
                                            <div className={profit >= 0 ? styles.profPos : styles.profNeg}>
                                                {profit >= 0 ? '+' : '-'} ₹ {Math.abs(profit).toFixed(2)} <FiChevronRight style={{marginLeft: '4px', opacity: 0.5}} />
                                            </div>
                                        </div>
                                    )
                                })}
                                {currentBills.length === 0 && (
                                    <div style={{padding: '30px', textAlign: 'center', color: '#64748b'}}>No bills match the selected filters.</div>
                                )}
                            </div>

                            {/* Pagination Controls for Profit View */}
                            <div className={styles.paginationContainer} style={{borderTop: '1px solid #f1f5f9'}}>
                              <div className={styles.itemsPerPage}>
                                <label>Rows per page:</label>
                                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                  <option value={10}>10</option>
                                  <option value={20}>20</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                              </div>
                              <div className={styles.pagination}>
                                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                <span>Page {currentPage} of {totalPages || 1}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
                              </div>
                            </div>
                        </div>
                    </>
                );
            })()}
        </div>
      )}

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
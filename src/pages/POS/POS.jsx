import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  FiSearch, FiUser, FiPrinter, FiCreditCard, 
  FiSmartphone, FiX, FiChevronUp, FiChevronDown, FiPlus, FiCheckCircle 
} from 'react-icons/fi';
import { BsCashStack } from 'react-icons/bs';
import { useReactToPrint } from 'react-to-print'; 
import { CartContext } from '../../context/CartContext';
import { db } from '../../services/firebase';
import { 
  collection, onSnapshot, addDoc, serverTimestamp, 
  doc, writeBatch, increment, query, where, getDocs 
} from 'firebase/firestore';
import InvoiceTicket from './InvoiceTicket'; 
import styles from './POS.module.css';

const POS = () => {
  const componentRef = useRef(); 
  const [dbProducts, setDbProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); 
  const [amtReceived, setAmtReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  
  // State for the ticket to read the ID
  const [billNoForPrinting, setBillNoForPrinting] = useState('');

  // Loyalty States
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [redeemApplied, setRedeemApplied] = useState(false);

  // Custom Item States
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const { 
    cart, addToCart, updateQuantity, updateItemDiscount, removeFromCart, clearCart, 
    subtotal, gstTotal, discount, netPay 
  } = useContext(CartContext);

  // 1. Fetch Products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      setDbProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.log("Product sync active."));
    return () => unsubscribe();
  }, []);

  // 2. Loyalty Search
  const searchCustomer = async () => {
    if(!customerPhone) return;
    setRedeemApplied(false);
    const q = query(collection(db, 'customers'), where('phone', '==', customerPhone));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setCustomerData({ id: snapshot.docs[0].id, ...data });
        setCustomerName(data.name || "");
    } else {
        if(window.confirm("Customer not found. Create new record?")) {
            setCustomerData({ isNew: true, points: 0 });
            setCustomerName("");
        }
    }
  };

  const handleAddCustomItem = () => {
    if (!customName || !customAmount) return;
    addToCart({ 
      id: `custom-${Date.now()}`, 
      name: customName, 
      salePrice: Number(customAmount), 
      isCustom: true, 
      gstPercent: 0, 
      mrp: Number(customAmount),
      discountPercent: 0
    });
    setCustomName(''); setCustomAmount('');
  };

  // Logic: Earn 2 points if bill > ₹300
  const earnedPoints = netPay >= 300 ? 2 : 0;
  const finalNetPay = Number(redeemApplied ? (netPay - 100) : netPay); 
  const totalSavings = cart.reduce((acc, item) => acc + ((Number(item.mrp || 0) - Number(item.salePrice || 0)) * item.qty), 0) + discount + (redeemApplied ? 100 : 0);

  // 3. Printing Setup
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  // 4. THE MASTER FUNCTION (Save to DB, then Print. DO NOT CLEAR CART)
  const handleProcessPayment = async () => {
    if (cart.length === 0) return;

    // A. Validation
    if (paymentMode === 'SPLIT') {
        const totalEntered = Number(splitCash) + Number(splitUpi);
        if (totalEntered.toFixed(2) !== finalNetPay.toFixed(2)) {
            alert(`Split mismatch: Entered ₹${totalEntered}, Expected ₹${finalNetPay.toFixed(2)}`);
            return;
        }
    }

    // B. Generate Bill ID
    const generatedID = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const batch = writeBatch(db);
      
      // C. Customer Logic
      if (customerPhone && customerPhone.trim() !== "") {
          const custQuery = query(collection(db, 'customers'), where('phone', '==', customerPhone));
          const custSnap = await getDocs(custQuery);
          
          if (custSnap.empty) {
              const newCustRef = doc(collection(db, "customers"));
              batch.set(newCustRef, { name: customerName || "Guest", phone: customerPhone, points: Number(earnedPoints), createdAt: serverTimestamp() });
          } else {
              const existingCustId = custSnap.docs[0].id;
              let pChange = Number(earnedPoints) - (redeemApplied ? 100 : 0);
              batch.update(doc(db, 'customers', existingCustId), { points: increment(pChange) });
          }
      }

      // D. Save Bill Record
      const billRef = doc(collection(db, 'bills'));
      batch.set(billRef, {
        billNo: generatedID, items: cart, subtotal: Number(subtotal), gstTotal: Number(gstTotal), 
        discount: Number(discount) + (redeemApplied ? 100 : 0), netPay: Number(finalNetPay), paymentMode, 
        timestamp: serverTimestamp(), customer: { name: (customerPhone ? (customerName || 'Customer') : 'Guest'), phone: customerPhone || 'N/A' },
        earnedPoints: customerPhone ? Number(earnedPoints) : 0, redeemUsed: redeemApplied
      });

      // E. Update Stock
      cart.forEach(item => {
        if (!item.isCustom) batch.update(doc(db, 'products', item.id), { stock: increment(-Number(item.qty)) });
      });

      // F. Commit to Firestore
      await batch.commit();

      // G. Trigger Print
      setBillNoForPrinting(generatedID);
      setTimeout(() => {
          handlePrint();
      }, 400);

    } catch (e) { 
      console.error("FIREBASE FAIL:", e);
      alert("Database error: Transaction aborted. Check internet connection.");
    }
  };

  const filteredProducts = dbProducts.filter(p => {
    const s = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
  });

  const balanceAmount = amtReceived ? (Number(amtReceived) - finalNetPay).toFixed(2) : "0.00";

  return (
    <div className={styles.posContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.searchBar}>
          <FiSearch size={18} /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className={styles.customItemRow}>
          <div className={styles.inputGroup}><label>Name</label><input value={customName} onChange={(e) => setCustomName(e.target.value)} /></div>
          <div className={styles.inputGroup} style={{flex: '0 0 100px'}}><label>Amt</label><input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} /></div>
          <button className={styles.addBtn} onClick={handleAddCustomItem}>+ ADD</button>
        </div>

        <div className={styles.itemsGrid}>
           {filteredProducts.map(product => {
             const inCart = cart.find(c => c.id === product.id);
             return (
               <div key={product.id} className={styles.itemCard} onClick={() => addToCart(product)}>
                  <span className={styles.categoryBadge}>{product.category}</span>
                  {inCart && <div className={styles.addedBadge}>{inCart.qty}</div>}
                  <h3 className={styles.itemName}>{product.name}</h3>
                  <div className={styles.priceRow}><span>₹{Number(product.salePrice).toFixed(2)}</span></div>
                  <div className={styles.stockGst}><span>Stock: {product.stock}</span><span>GST: {product.gst || 0}%</span></div>
               </div>
             )
           })}
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.loyaltyCard}>
          <div className={styles.loyaltyHeader}><FiUser /> CUSTOMER LOYALTY</div>
          <div className={styles.loyaltyInput}>
            <input type="text" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <button onClick={searchCustomer} style={{background: '#e2e8f0', border:'none', padding:'10px', borderRadius:'6px'}}><FiSearch /></button>
          </div>
          <input type="text" placeholder="Name" className={styles.fullInput} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          
          <div style={{marginTop: '10px', fontSize: '11px', borderTop: '1px solid #eee', paddingTop: '8px'}}>
             <div style={{display:'flex', justifyContent:'space-between'}}>
                <span>Earnable Points:</span>
                <strong style={{color: customerPhone ? '#16a34a' : '#94a3b8'}}>{customerPhone ? `+${earnedPoints}` : 'Add Phone to Earn'}</strong>
             </div>
             {customerData && !customerData.isNew && (
                <div style={{marginTop: '6px', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <span>Balance: <strong>{customerData.points}</strong></span>
                        {redeemApplied && <span style={{color:'#10b981', display:'flex', alignItems:'center', gap:'2px'}}><FiCheckCircle /> Redeemed</span>}
                    </div>
                    {customerData.points >= 100 && (
                        <button onClick={() => setRedeemApplied(!redeemApplied)} style={{width:'100%', marginTop:'8px', padding:'6px', background: redeemApplied ? '#ef4444' : '#0f172a', color:'white', borderRadius:'6px', cursor:'pointer', border:'none', fontSize:'11px', fontWeight:'700'}}>
                            {redeemApplied ? "CANCEL REDEEM" : "REDEEM 100 POINTS (₹100 OFF)"}
                        </button>
                    )}
                </div>
             )}
          </div>
        </div>

        <div className={styles.cartHeader}>CART ITEMS ({cart.length}) <span className={styles.clearBtn} onClick={clearCart}>CLEAR CART</span></div>
        <div className={styles.cartList}>
          {cart.map(item => (
            <div key={item.id} className={styles.cartItemCard}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <strong style={{fontSize:'13px'}}>{item.name}</strong>
                <FiX style={{cursor: 'pointer', color: '#94a3b8'}} onClick={()=>removeFromCart(item.id)}/>
              </div>
              <div className={styles.cartItemActions}>
                <div className={styles.qtyBox}><button onClick={()=>updateQuantity(item.id,-1)}>-</button><span>{item.qty}</span><button onClick={()=>updateQuantity(item.id,1)}>+</button></div>
                <div className={styles.discBox}><label>DISC%</label><input type="number" value={item.discountPercent} onChange={(e)=>updateItemDiscount(item.id,e.target.value)}/></div>
                <div style={{fontWeight:'800', fontSize:'14px'}}>₹{(item.salePrice * item.qty * (1 - item.discountPercent/100)).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.paymentFooter}>
          <div className={styles.collapsibleHeader} onClick={() => setShowDetails(!showDetails)}>
            <strong style={{fontSize:'14px'}}>NET PAY: ₹{finalNetPay.toFixed(2)}</strong>
            <div className={`${styles.arrowIcon} ${showDetails ? styles.arrowRotate : ''}`}><FiChevronUp size={18}/></div>
          </div>

          <div className={`${styles.footerContent} ${showDetails ? styles.expandedContent : ''}`}>
            <div className={styles.summarySection}>
                <div className={styles.totalRow}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className={styles.totalRow}><span>GST Tax</span><span>₹{gstTotal.toFixed(2)}</span></div>
                <div className={styles.totalRow}><span>Discounts</span><span>- ₹{(discount + (redeemApplied ? 100 : 0)).toFixed(2)}</span></div>
            </div>
            <div className={styles.balanceBox}>
              <div className={styles.inputGroup}><label style={{fontSize: '9px'}}>AMT RECEIVED (₹)</label>
                <input type="number" placeholder="Enter cash..." value={amtReceived} onChange={(e) => setAmtReceived(e.target.value)} />
              </div>
              <div className={styles.balanceResult}><label style={{fontSize: '9px'}}>CHANGE</label><strong style={{color:'#10b981', fontSize: '14px'}}>₹{(Number(amtReceived) - finalNetPay).toFixed(2)}</strong></div>
            </div>

            {paymentMode === 'SPLIT' && (
              <div className={styles.splitBreakdown}>
                <div className={styles.splitInputs}>
                  <div className={styles.inputGroup}><label>CASH</label><input type="number" value={splitCash} onChange={(e)=>setSplitCash(e.target.value)}/></div>
                  <div className={styles.inputGroup}><label>UPI</label><input type="number" value={splitUpi} onChange={(e)=>setSplitUpi(e.target.value)}/></div>
                </div>
                <div className={styles.remaining}>REMAINING: <span>₹{(finalNetPay - (Number(splitCash)+Number(splitUpi))).toFixed(2)}</span></div>
              </div>
            )}

            <div className={styles.paymentModes}>
              <button className={paymentMode === 'CASH' ? styles.active : ''} onClick={() => setPaymentMode('CASH')}><BsCashStack size={16}/> CASH</button>
              <button className={paymentMode === 'UPI' ? styles.active : ''} onClick={() => setPaymentMode('UPI')}><FiSmartphone size={16}/> UPI</button>
              <button className={paymentMode === 'SPLIT' ? styles.active : ''} onClick={() => setPaymentMode('SPLIT')}><FiCreditCard size={16}/> SPLIT</button>
            </div>
          </div>

          <div className={styles.actionArea}>
            <button className={styles.processBtn} onClick={handleProcessPayment} disabled={cart.length === 0}>
              <FiPrinter size={18} /> PROCESS PAYMENT
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
            <InvoiceTicket 
                cart={cart} subtotal={subtotal} tax={gstTotal} discount={discount + (redeemApplied ? 100 : 0)} total={finalNetPay}
                savings={totalSavings} billNo={billNoForPrinting} payMethod={paymentMode} cash={splitCash} upi={splitUpi}
                custName={customerName} custPhone={customerPhone} 
                pointsBalance={customerData?.points || 0} pointsEarned={customerPhone ? earnedPoints : 0} redeemUsed={redeemApplied}
            />
        </div>
      </div>
    </div>
  );
};

export default POS;
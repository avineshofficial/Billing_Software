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
  
  const [billNoForPrinting, setBillNoForPrinting] = useState('');

  // Loyalty States
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [redeemApplied, setRedeemApplied] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);

  // Custom Item States
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const { 
    cart, addToCart, updateQuantity, updateItemDiscount, removeFromCart, clearCart, 
    subtotal, gstTotal, discount, netPay 
  } = useContext(CartContext);

  // 1. Fetch Products & Customers
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setDbProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.log("Database connection active."));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setAllCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProducts(); unsubCustomers(); };
  }, []);

  // 2. Loyalty Auto-Populate Logic
  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setCustomerPhone(val);
    const existing = allCustomers.find(c => c.phone === val);
    if (existing) {
      setCustomerData(existing);
      setCustomerName(existing.name || "");
      setRedeemApplied(false);
    } else {
      setCustomerData(null);
      setCustomerName("");
      setRedeemApplied(false);
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

  const earnedPoints = netPay >= 300 ? 2 : 0;
  const finalNetPay = Number(redeemApplied ? (netPay - 100) : netPay); 
  const totalSavings = cart.reduce((acc, item) => acc + ((Number(item.mrp || 0) - Number(item.salePrice || 0)) * item.qty), 0) + discount + (redeemApplied ? 100 : 0);

  // 3. Printing Setup
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onAfterPrint: () => {
        // Requirement: DO NOT clear the cart automatically. 
        setBillNoForPrinting('');
    },
  });

  // 4. THE MASTER FUNCTION (Database Sync)
  const handleProcessPayment = async () => {
    if (cart.length === 0) return;

    if (paymentMode === 'SPLIT') {
        const totalSplit = Number(splitCash) + Number(splitUpi);
        if (totalSplit.toFixed(2) !== finalNetPay.toFixed(2)) {
            alert(`Split mismatch: Entered ₹${totalSplit}, Expected ₹${finalNetPay.toFixed(2)}`);
            return;
        }
    }

    const generatedID = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const batch = writeBatch(db);
      
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

      const billRef = doc(collection(db, 'bills'));
      batch.set(billRef, {
        billNo: generatedID,
        items: cart, 
        subtotal: Number(subtotal), 
        gstTotal: Number(gstTotal), 
        discount: Number(discount) + (redeemApplied ? 100 : 0), 
        netPay: Number(finalNetPay), 
        paymentMode, 
        timestamp: serverTimestamp(),
        customer: { name: (customerPhone ? (customerName || 'Customer') : 'Guest'), phone: customerPhone || 'N/A' },
        earnedPoints: customerPhone ? Number(earnedPoints) : 0,
        redeemUsed: redeemApplied
      });

      cart.forEach(item => {
        if (!item.isCustom) {
            batch.update(doc(db, 'products', item.id), { stock: increment(-Number(item.qty)) });
        }
      });

      await batch.commit();
      
      setBillNoForPrinting(generatedID);
      setTimeout(() => {
          handlePrint();
      }, 500);

    } catch (e) { 
      console.error("FIREBASE FAIL:", e);
      alert("Database error: Transaction aborted. Please check internet connection.");
    }
  };

  // --- WEIGHT-BASED SORTING LOGIC ---
  const extractWeight = (name) => {
    const match = name.match(/(\d+)\s*(g|kg|ml|l)/i);
    if (match) {
      let value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'kg' || unit === 'l') value *= 1000;
      return value;
    }
    return 999999; 
  };

  // --- ORDER-WISE SORTING LOGIC (Category first, then Weight) ---
  const filteredProducts = dbProducts
    .filter(p => {
      const s = searchTerm.toLowerCase();
      return p.name?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      // 1. Sort by Category Alphabetically
      const catA = a.category?.toLowerCase() || "";
      const catB = b.category?.toLowerCase() || "";
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      // 2. If categories are same, Sort by Weight
      return extractWeight(a.name) - extractWeight(b.name);
    });

  const balanceAmount = amtReceived ? (Number(amtReceived) - finalNetPay).toFixed(2) : "0.00";

  return (
    <div className={styles.posContainer} style={{ fontSize: '16px' }}>
      <div className={styles.leftPanel}>
        <div className={styles.searchBar}>
          <FiSearch size={22} /><input type="text" style={{ fontSize: '18px' }} placeholder="Search item, category, SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className={styles.customItemRow}>
          <div className={styles.inputGroup}><label style={{fontSize: '12px'}}>Item Name</label><input style={{fontSize: '16px'}} value={customName} onChange={(e) => setCustomName(e.target.value)} /></div>
          <div className={styles.inputGroup} style={{flex: '0 0 120px'}}><label style={{fontSize: '12px'}}>Amount</label><input style={{fontSize: '16px'}} type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} /></div>
          <button className={styles.addBtn} style={{fontSize: '16px'}} onClick={handleAddCustomItem}>+ ADD</button>
        </div>

        <div className={styles.itemsGrid}>
           {filteredProducts.map(product => {
             const inCart = cart.find(c => c.id === product.id);
             return (
               <div key={product.id} className={styles.itemCard} onClick={() => addToCart(product)}>
                  <span className={styles.categoryBadge} style={{fontSize: '12px'}}>{product.category}</span>
                  {inCart && <div className={styles.addedBadge} style={{width: '25px', height:'25px', fontSize:'14px'}}>{inCart.qty}</div>}
                  <h3 className={styles.itemName} style={{fontSize: '18px'}}>{product.name}</h3>
                  <div className={styles.priceRow} style={{fontSize: '20px'}}><span>₹{Number(product.salePrice).toFixed(2)}</span></div>
                  <div className={styles.stockGst} style={{fontSize: '14px'}}><span>Stock: {product.stock}</span><span>GST: {product.gst || 0}%</span></div>
               </div>
             )
           })}
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.loyaltyCard} style={{padding: '12px 16px'}}>
          <div className={styles.loyaltyHeader} style={{fontSize: '12px', marginBottom: '8px'}}><FiUser /> CUSTOMER</div>
          <div style={{display: 'flex', gap: '8px'}}>
            <input 
              type="text" 
              list="customer-phones" 
              placeholder="Mobile No." 
              value={customerPhone} 
              onChange={handlePhoneChange} 
              style={{flex: 1, padding: '8px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '6px', minWidth: 0}} 
            />
            <datalist id="customer-phones">
              {allCustomers.map(c => <option key={c.id} value={c.phone}>{c.name}</option>)}
            </datalist>
            <input 
              type="text" 
              placeholder="Name" 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)} 
              style={{flex: 1, padding: '8px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '6px', minWidth: 0}} 
            />
          </div>
          
          <div style={{marginTop: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
             <span style={{color: '#64748b'}}>Earn: <strong style={{color: customerPhone ? '#16a34a' : '#94a3b8'}}>{customerPhone ? `+${earnedPoints} pts` : '--'}</strong></span>
             {customerData && !customerData.isNew && (
                <span style={{color: '#0f172a'}}>Bal: <strong>{customerData.points} pts</strong></span>
             )}
          </div>
          {customerData && !customerData.isNew && customerData.points >= 100 && (
              <button onClick={() => setRedeemApplied(!redeemApplied)} style={{width:'100%', marginTop:'8px', padding:'8px', background: redeemApplied ? '#ef4444' : '#0f172a', color:'white', borderRadius:'6px', cursor:'pointer', border:'none', fontSize:'12px', fontWeight:'700'}}>
                  {redeemApplied ? "CANCEL REDEEM" : "REDEEM 100 PTS (₹100 OFF)"}
              </button>
          )}
        </div>

        <div className={styles.cartHeader} style={{fontSize: '13px'}}>CART ITEMS ({cart.length}) <span className={styles.clearBtn} onClick={clearCart}>CLEAR CART</span></div>
        <div className={styles.cartList}>
          {cart.map(item => (
            <div key={item.id} className={styles.cartItemCard}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <strong style={{fontSize: '16px'}}>{item.name}</strong>
                <FiX style={{cursor: 'pointer', color: '#94a3b8'}} size={20} onClick={()=>removeFromCart(item.id)}/>
              </div>
              <div className={styles.cartItemActions} style={{marginTop: '15px'}}>
                <div className={styles.qtyBox}>
                    <button style={{fontSize: '18px'}} onClick={()=>updateQuantity(item.id,-1)}>-</button>
                    <span style={{fontSize: '16px'}}>{item.qty}</span>
                    <button style={{fontSize: '18px'}} onClick={()=>updateQuantity(item.id,1)}>+</button>
                </div>
                <div className={styles.discBox}>
                    <label style={{fontSize: '10px'}}>DISC%</label>
                    <input type="number" style={{fontSize: '14px', width: '60px'}} value={item.discountPercent} onChange={(e)=>updateItemDiscount(item.id,e.target.value)}/>
                </div>
                <div style={{fontWeight:'800', fontSize: '18px'}}>₹{(item.salePrice * item.qty * (1 - item.discountPercent/100)).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.paymentFooter}>
          <div className={styles.collapsibleHeader} onClick={() => setShowDetails(!showDetails)}>
            <strong style={{fontSize:'18px'}}>NET PAY: ₹{finalNetPay.toFixed(2)}</strong>
            <div className={`${styles.arrowIcon} ${showDetails ? styles.arrowRotate : ''}`}><FiChevronUp size={22}/></div>
          </div>

          <div className={`${styles.footerContent} ${showDetails ? styles.expandedContent : ''}`}>
            <div className={styles.summarySection}>
                <div className={styles.totalRow} style={{fontSize: '14px'}}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className={styles.totalRow} style={{fontSize: '14px'}}><span>GST Tax</span><span>₹{gstTotal.toFixed(2)}</span></div>
                <div className={styles.totalRow} style={{fontSize: '14px'}}><span>Discounts</span><span>- ₹{(discount + (redeemApplied ? 100 : 0)).toFixed(2)}</span></div>
            </div>
            <div className={styles.balanceBox}>
              <div className={styles.inputGroup}><label style={{fontSize: '10px'}}>AMT RECEIVED (₹)</label>
                <input type="number" style={{fontSize: '18px'}} placeholder="Enter cash..." value={amtReceived} onChange={(e) => setAmtReceived(e.target.value)} />
              </div>
              <div className={styles.balanceResult}>
                <label style={{fontSize: '10px'}}>CHANGE</label>
                <strong style={{color:'#10b981', fontSize: '20px'}}>₹{(Number(amtReceived) - finalNetPay).toFixed(2)}</strong>
              </div>
            </div>

            {paymentMode === 'SPLIT' && (
              <div className={styles.splitBreakdown}>
                <div className={styles.splitInputs}>
                  <div className={styles.inputGroup}><label style={{fontSize:'10px'}}>CASH</label><input type="number" style={{fontSize:'16px'}} value={splitCash} onChange={(e)=>setSplitCash(e.target.value)}/></div>
                  <div className={styles.inputGroup}><label style={{fontSize:'10px'}}>UPI</label><input type="number" style={{fontSize:'16px'}} value={splitUpi} onChange={(e)=>setSplitUpi(e.target.value)}/></div>
                </div>
                <div className={styles.remaining} style={{fontSize:'14px'}}>REMAINING: <span style={{fontSize:'16px'}}>₹{(finalNetPay - (Number(splitCash)+Number(splitUpi))).toFixed(2)}</span></div>
              </div>
            )}

            <div className={styles.paymentModes}>
              <button className={paymentMode === 'CASH' ? styles.active : ''} onClick={() => setPaymentMode('CASH')}><BsCashStack size={20}/> CASH</button>
              <button className={paymentMode === 'UPI' ? styles.active : ''} onClick={() => setPaymentMode('UPI')}><FiSmartphone size={20}/> UPI</button>
              <button className={paymentMode === 'SPLIT' ? styles.active : ''} onClick={() => setPaymentMode('SPLIT')}><FiCreditCard size={20}/> SPLIT</button>
            </div>
          </div>

          <div className={styles.actionArea}>
            <button className={styles.processBtn} style={{height: '55px', fontSize: '18px'}} onClick={handleProcessPayment} disabled={cart.length === 0}>
              <FiPrinter size={22} /> PROCESS PAYMENT
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
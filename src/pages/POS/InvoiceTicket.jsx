import React, { forwardRef } from 'react';

const InvoiceTicket = forwardRef(({ 
  cart, 
  subtotal, 
  tax, 
  discount, 
  total, 
  savings, 
  billNo, 
  payMethod, 
  cash, 
  upi,
  custName,
  custPhone,
  pointsBalance,
  pointsEarned,
  redeemUsed
}, ref) => {
  // Safe numeric conversions
  const safePointsBalance = Number(pointsBalance) || 0;
  const safePointsEarned = Number(pointsEarned) || 0;
  const safeSavings = Number(savings) || 0;
  const hasCustomer = custPhone && custPhone !== "N/A" && custPhone !== "";

  return (
    <div ref={ref} style={{ 
      padding: '0px', 
      width: '240px', // Fixed width to prevent right-side overflow on 58mm printers
      fontFamily: "'Courier New', Courier, monospace", 
      color: '#000',
      backgroundColor: '#fff',
      lineHeight: '1.2',
      fontWeight: '900', 
      margin: '0',
      fontSize: '10px'
    }}>
      {/* --- PRINTER SETTINGS --- */}
      <style>{`
        @media print {
          @page { margin: 0; size: 58mm auto; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* --- STORE HEADER (TAMIL) --- */}
      <h2 style={{ textAlign: 'center', margin: '5px 0 0 0', fontSize: '14px', fontWeight: '900' }}>நெருங்கிய கூட்டாளி</h2>
      <p style={{ textAlign: 'center', margin: '0', fontSize: '10px', fontWeight: '900' }}>நிறுவனம்</p>
      
      {/* --- STORE ADDRESS --- */}
      <div style={{ textAlign: 'center', fontSize: '8px', fontWeight: '900', marginBottom: '4px', marginTop: '2px' }}>
        <div>7/39 B FISH MARKET STREET</div>
        <div>PARAMAKUDI - 623707</div>
        <div>PH: 9677794269, 7540038675</div>
        <div style={{ marginTop: '2px', border: '1px solid #000', display: 'inline-block', padding: '1px 3px' }}>
          GST: 33QEQPS8844G1ZG
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2px 0' }}></div>
      
      {/* --- BILL INFO --- */}
      <div style={{ fontSize: '9px', fontWeight: '900' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>INV:#{billNo || "0"}</span>
            <span>{new Date().toLocaleDateString()}</span>
         </div>
         <div>TIME:{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {/* --- CUSTOMER INFO SECTION --- */}
      {hasCustomer && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '2px 0' }}></div>
          <div style={{ fontSize: '9px', fontWeight: '900' }}>
            <div style={{ textTransform: 'uppercase' }}>CUST: {custName || 'CUSTOMER'}</div>
            <div>PH  : {custPhone}</div>
          </div>
        </>
      )}
      
      <div style={{ borderBottom: '1px solid #000', margin: '2px 0' }}></div>
      
      {/* --- ITEMS TABLE --- */}
      <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse', fontWeight: '900', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th align="left" style={{ width: '35%' }}>ITEM</th>
            <th align="right" style={{ width: '15%' }}>MRP</th>
            <th align="right" style={{ width: '18%' }}>PRC</th>
            <th align="center" style={{ width: '12%' }}>Q</th>
            <th align="right" style={{ width: '20%' }}>TOT</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item, index) => {
            const itemPrice = Number(item.salePrice || item.price || 0);
            const itemQty = Number(item.qty || item.quantity || 0);
            const itemDisc = Number(item.discountPercent || 0);
            const itemLineTotal = (itemPrice * itemQty) * (1 - itemDisc/100);
            
            return (
              <tr key={index}>
                <td style={{ padding: '2px 0', textTransform: 'uppercase', wordBreak: 'break-all' }}>
                  {item.name}
                </td>
                <td align="right">{item.mrp || itemPrice}</td>
                <td align="right">{itemPrice}</td>
                <td align="center">{itemQty}</td>
                <td align="right">{itemLineTotal.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderBottom: '1px solid #000', margin: '2px 0' }}></div>
      
      {/* --- TOTALS --- */}
      <div style={{ fontSize: '10px', fontWeight: '900' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
          <span>Subtotal:</span><span>₹{Number(subtotal).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
          <span>GST Tax:</span><span>₹{Number(tax).toFixed(2)}</span>
        </div>
        
        {Number(discount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Disc:</span><span>-₹{Number(discount).toFixed(2)}</span>
          </div>
        )}
        
        <div style={{ borderTop: '1.5px solid #000', marginTop: '2px', paddingTop: '2px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>NET PAYABLE:</span><span>₹{Number(total).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

      {/* --- PAYMENT & BREAKDOWN --- */}
      <div style={{ fontSize: '9px', fontWeight: '900' }}>
        <div>MODE: {payMethod?.toUpperCase()}</div>
        {payMethod === "SPLIT" && (
          <div style={{ marginTop: '2px', borderLeft: '2px solid #000', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CASH:</span><span>₹{Number(cash || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>UPI:</span><span>₹{Number(upi || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* --- LOYALTY POINTS SECTION --- */}
      {hasCustomer && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
          <div style={{ fontSize: '9px', fontWeight: '900' }}>
            {redeemUsed && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>REDEEMED:</span><span>100</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>POINTS EARNED:</span><span>{safePointsEarned}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px', borderTop: '0.5px solid #000', paddingTop: '1px' }}>
              <span>TOTAL BALANCE:</span><span>{safePointsBalance + safePointsEarned - (redeemUsed ? 100 : 0)}</span>
            </div>
          </div>
        </>
      )}

      <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

      {/* --- SAVINGS SECTION (SHADE REMOVED) --- */}
      <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '900', padding: '2px 0' }}>
        YOU SAVED ₹{safeSavings.toFixed(2)}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2px 0' }}></div>

      <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', fontWeight: 'bold' }}>
        THANK YOU! VISIT AGAIN
      </p>
    </div>
  );
});

export default InvoiceTicket;
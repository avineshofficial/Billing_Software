import React, { forwardRef } from 'react';

const InvoiceTicket = forwardRef(({ 
  cart, 
  subtotal, 
  tax, 
  discount, 
  total, 
  billNo, 
  payMethod, 
  cash = 0, 
  upi = 0,  
  custName,
  custPhone,
  pointsBalance = 0,
  pointsEarned = 0,
  redeemUsed = false
}, ref) => {
  // Calculate savings: (MRP - SalePrice) * Qty + Overall Discount
  const totalSavings = cart.reduce((acc, item) => {
    const mrp = Number(item.mrp || item.salePrice || 0);
    const price = Number(item.salePrice || 0);
    return acc + ((mrp - price) * Number(item.qty || 0));
  }, 0) + Number(discount || 0);

  const finalPointsBalance = Number(pointsBalance) + Number(pointsEarned) - (redeemUsed ? 100 : 0);
  const hasCustomer = custPhone && custPhone !== "N/A" && custPhone !== "";

  return (
    <div ref={ref} style={{ 
      padding: '0px 8px 12px 8px', 
      width: '250px', 
      fontFamily: "'Courier New', Courier, sans-serif", 
      color: '#000',
      backgroundColor: '#fff',
      lineHeight: '1.2',
      fontWeight: '900', 
      margin: '0'
    }}>
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* --- STORE HEADER (TAMIL) --- */}
      <h2 style={{ textAlign: 'center', margin: '5px 0 1px 0', fontSize: '16px', fontWeight: '900' }}>நெருங்கிய கூட்டாளி</h2>
      <p style={{ textAlign: 'center', margin: '0', fontSize: '12px', fontWeight: '900' }}>நிறுவனம்</p>
      
      {/* --- STORE ADDRESS --- */}
      <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: '900', marginBottom: '6px', marginTop: '4px' }}>
        <div>7/39 B FISH MARKET STREET</div>
        <div>PARAMAKUDI - 623707</div>
        <div>PH: 9677794269, 7540038675</div>
        <div style={{ marginTop: '4px', border: '1px solid #000', display: 'inline-block', padding: '1px 6px' }}>
          GST: 33QEQPS8844G1ZG
        </div>
      </div>

      <div style={{ borderBottom: '1.5px dashed #000', margin: '5px 0' }}></div>
      
      {/* --- BILL INFO --- */}
      <div style={{ fontSize: '10px', fontWeight: '900' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>INV:#{billNo || "0"}</span>
            <span>{new Date().toLocaleDateString()}</span>
         </div>
         <div style={{ marginTop: '1px' }}>
            TIME:{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
         </div>
      </div>

      {/* --- CUSTOMER INFO SECTION --- */}
      {hasCustomer && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
          <div style={{ fontSize: '10px', fontWeight: '900' }}>
            <div style={{ textTransform: 'uppercase' }}>CUST: {custName || 'VALUED CUSTOMER'}</div>
            <div style={{ marginTop: '1px' }}>PH  : {custPhone}</div>
          </div>
        </>
      )}
      
      <div style={{ borderBottom: '1.5px solid #000', margin: '6px 0' }}></div>
      
      {/* --- ITEMS TABLE --- */}
      <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', fontWeight: '900', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000' }}>
            <th align="left" style={{ width: '40%', paddingBottom: '3px' }}>ITEM</th>
            <th align="right" style={{ width: '18%', paddingBottom: '3px' }}>MRP</th>
            <th align="right" style={{ width: '18%', paddingBottom: '3px' }}>PRC</th>
            <th align="center" style={{ width: '10%', paddingBottom: '3px' }}>Q</th>
            <th align="right" style={{ width: '14%', paddingBottom: '3px' }}>TOT</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item, index) => {
            const price = Number(item.salePrice || 0);
            const qty = Number(item.qty || 0);
            const disc = Number(item.discountPercent || 0);
            const itemLineTotal = (price * qty) - (qty * price * (disc / 100));
            return (
              <tr key={index}>
                <td style={{ padding: '4px 0', textTransform: 'uppercase', fontSize: '8.5px', wordBreak: 'break-all', verticalAlign: 'top' }}>
                    {item.name}
                </td>
                <td align="right" style={{ verticalAlign: 'top', paddingTop: '4px' }}>{item.mrp || item.salePrice}</td>
                <td align="right" style={{ verticalAlign: 'top', paddingTop: '4px' }}>{item.salePrice}</td>
                <td align="center" style={{ verticalAlign: 'top', paddingTop: '4px' }}>{item.qty}</td>
                <td align="right" style={{ verticalAlign: 'top', paddingTop: '4px' }}>{itemLineTotal.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderBottom: '1.5px dashed #000', margin: '6px 0' }}></div>
      
      {/* --- TOTALS --- */}
      <div style={{ fontSize: '11px', fontWeight: '900' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>SUBTOTAL:</span><span>₹{Number(subtotal).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>GST TAX:</span><span>₹{Number(tax).toFixed(2)}</span>
        </div>
        <div style={{ borderTop: '2px solid #000', marginTop: '6px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span>NET PAYABLE:</span><span>₹{Number(total).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
      
      {/* --- PAYMENT METHOD --- */}
      <div style={{ fontSize: '10px', fontWeight: '900' }}>
        <div>MODE: {payMethod?.toUpperCase()}</div>
        {payMethod === "SPLIT" && (
          <div style={{ marginTop: '4px', borderLeft: '3px solid #000', paddingLeft: '6px', marginLeft: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CASH:</span><span>₹{Number(cash).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px' }}>
              <span>UPI:</span><span>₹{Number(upi).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* --- LOYALTY POINTS SECTION --- */}
      {hasCustomer && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          <div style={{ fontSize: '10px', fontWeight: '900' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>POINTS EARNED:</span><span>{pointsEarned}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', borderTop: '1px solid #000', paddingTop: '2px' }}>
              <span>TOTAL BALANCE:</span><span>{isNaN(finalPointsBalance) ? '0' : finalPointsBalance}</span>
            </div>
          </div>
        </>
      )}

      <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>

      {/* --- SAVINGS (REMOVED OVERLAY COLOR) --- */}
      <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '900', padding: '2px 0' }}>
        YOU SAVED ₹{totalSavings.toFixed(2)}
      </div>

      <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
        THANK YOU! VISIT AGAIN
      </p>
      
      <div style={{ textAlign: 'center', fontSize: '7px', marginTop: '8px', color: '#555' }}>
        --- Software by SwiftPOS ---
      </div>
    </div>
  );
});

export default InvoiceTicket;
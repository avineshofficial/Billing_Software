import React, { forwardRef } from 'react';

const InvoiceTicket = forwardRef(({ 
  cart, 
  subtotal, 
  tax, 
  discount, 
  total, 
  billNo, 
  payMethod, 
  cash = 0, // Default to 0 if not provided
  upi = 0,  // Default to 0 if not provided
  custName,
  custPhone,
  pointsBalance = 0,
  pointsEarned = 0,
  redeemUsed = false
}, ref) => {
  const totalSavings = cart.reduce((acc, item) => {
    const mrp = Number(item.mrp || item.salePrice || 0);
    const price = Number(item.salePrice || 0);
    return acc + ((mrp - price) * Number(item.qty || 0));
  }, 0) + Number(discount || 0);

  const finalPointsBalance = Number(pointsBalance) + Number(pointsEarned) - (redeemUsed ? 100 : 0);
  const hasCustomer = custPhone && custPhone !== "N/A" && custPhone !== "";

  return (
    <div ref={ref} style={{ 
      padding: '0px 5px 10px 5px', 
      width: '210px', 
      fontFamily: "'Courier New', Courier, sans-serif", 
      color: '#000',
      backgroundColor: '#fff',
      lineHeight: '1.2',
      fontWeight: '900', 
      margin: '0'
    }}>
      <style>{`
        @media print {
          @page { margin: 0; size: 58mm auto; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <h2 style={{ textAlign: 'center', margin: '5px 0 0 0', fontSize: '18px', fontWeight: '900' }}>நெருங்கிய கூட்டாளி</h2>
      <p style={{ textAlign: 'center', margin: '0', fontSize: '13px', fontWeight: '900' }}>நிறுவனம்</p>
      
      <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: '900', marginBottom: '5px' }}>
        <div>7/39 B FISH MARKET STREET</div>
        <div>PARAMAKUDI - 623707</div>
        <div>PH: 9677794269, 7540038675</div>
        <div style={{ marginTop: '2px', border: '1px solid #000', display: 'inline-block', padding: '1px 4px' }}>
          GST: 33QEQPS8844G1ZG
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
      
      <div style={{ fontSize: '10px', fontWeight: '900' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>INV:#{billNo || "0"}</span>
            <span>{new Date().toLocaleDateString()}</span>
         </div>
         <div>TIME:{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {hasCustomer && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
          <div style={{ fontSize: '10px', fontWeight: '900' }}>
            <div>CUST: {custName || 'VALUED CUSTOMER'}</div>
            <div>PH  : {custPhone}</div>
          </div>
        </>
      )}
      
      <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
      
      <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', fontWeight: '900', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000' }}>
            <th align="left" style={{ width: '40%' }}>ITEM</th>
            <th align="right" style={{ width: '18%' }}>MRP</th>
            <th align="right" style={{ width: '18%' }}>PRC</th>
            <th align="center" style={{ width: '8%' }}>Q</th>
            <th align="right" style={{ width: '16%' }}>TOT</th>
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
                <td style={{ padding: '4px 0', textTransform: 'uppercase', fontSize: '9px', wordBreak: 'break-all' }}>{item.name}</td>
                <td align="right">{item.mrp || item.salePrice}</td>
                <td align="right">{item.salePrice}</td>
                <td align="center">{item.qty}</td>
                <td align="right">{itemLineTotal.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
      
      <div style={{ fontSize: '11px', fontWeight: '900' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span><span>₹{Number(subtotal).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>GST Tax:</span><span>₹{Number(tax).toFixed(2)}</span>
        </div>
        <div style={{ borderTop: '2.5px solid #000', marginTop: '5px', paddingTop: '3px', display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
          <span>NET PAYABLE:</span><span>₹{Number(total).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
      <div style={{ fontSize: '10px', fontWeight: '900' }}>
        <div>MODE: {payMethod?.toUpperCase()}</div>
        {/* --- SPLIT METHOD FIX --- */}
        {payMethod === "SPLIT" && (
          <div style={{ marginTop: '3px', borderLeft: '3px solid #000', paddingLeft: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CASH:</span><span>₹{Number(cash).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>UPI:</span><span>₹{Number(upi).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

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

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '900' }}>
        You Have Saved ₹{totalSavings.toFixed(2)}
      </div>
      <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '11px', fontWeight: 'bold' }}>THANK YOU! VISIT AGAIN</p>
    </div>
  );
});

export default InvoiceTicket;
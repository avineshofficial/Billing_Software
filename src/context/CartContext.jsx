// src/context/CartContext.jsx
import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [gstTotal, setGstTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [netPay, setNetPay] = useState(0);

  useEffect(() => {
    let tempSubtotal = 0;
    let tempGst = 0;
    let tempDiscount = 0;

    cart.forEach(item => {
      // Use salePrice consistently and ensure they are Numbers
      const price = Number(item.salePrice) || 0;
      const qty = Number(item.qty) || 0;
      const discPercent = Number(item.discountPercent) || 0;
      const gstPercent = Number(item.gstPercent) || 0;

      const itemGross = price * qty;
      const itemDisc = itemGross * (discPercent / 100);
      const itemTaxable = itemGross - itemDisc;
      const itemTax = itemTaxable * (gstPercent / 100);

      tempSubtotal += itemGross;
      tempDiscount += itemDisc;
      tempGst += itemTax;
    });

    setSubtotal(tempSubtotal);
    setDiscount(tempDiscount);
    setGstTotal(tempGst);
    setNetPay(tempSubtotal - tempDiscount + tempGst);
  }, [cart]);

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { 
        ...product, 
        qty: 1, 
        discountPercent: 0,
        gstPercent: Number(product.gst) || 0,
        salePrice: Number(product.salePrice) || 0
      }];
    });
  };

  const updateQuantity = (id, change) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + change) } : item
      )
    );
  };

  const updateItemDiscount = (id, percent) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, discountPercent: Math.max(0, parseFloat(percent) || 0) } : item
      )
    );
  };

  const removeFromCart = (id) => setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{
      cart, addToCart, updateQuantity, updateItemDiscount, removeFromCart, clearCart,
      subtotal, gstTotal, discount, netPay
    }}>
      {children}
    </CartContext.Provider>
  );
};
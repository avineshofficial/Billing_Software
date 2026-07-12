import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const JsonImporter = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const navigate = useNavigate();

  const handleImport = async () => {
    if (!jsonInput.trim()) return setStatus({ type: 'error', msg: 'Please paste the JSON data first.' });

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      // 1. Parse the text into an actual Javascript Array
      const dataToUpload = JSON.parse(jsonInput);

      if (!Array.isArray(dataToUpload)) {
        throw new Error("Data must be an array of products [{}, {}]");
      }

      const batch = writeBatch(db);

      // 2. Loop through and map your JSON fields to the App fields
      dataToUpload.forEach((item) => {
        const newDocRef = doc(collection(db, "products"));
        batch.set(newDocRef, {
          name: item.name || "Unnamed Product",
          sku: item.product_code || `SKU-${Math.floor(Math.random() * 100000)}`,
          category: item.category || "General",
          purchasePrice: Number(item.purchasePrice || item.purchase_price || item.cost || 0),
          mrp: Number(item.mrp) || 0,
          salePrice: Number(item.price || item.salePrice) || 0,
          stock: Number(item.stock) || 0,
          gst: Number(item.gst_percentage) || 0,
          image: item.image_url || "",
          createdAt: serverTimestamp()
        });
      });

      // 3. Send to Firebase
      await batch.commit();
      setStatus({ type: 'success', msg: `Successfully imported ${dataToUpload.length} products!` });
      
      // Go back to inventory after 2 seconds
      setTimeout(() => navigate('/admin'), 2000);

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', msg: "Invalid JSON format. Check for missing commas or brackets." });
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Nuts & Dates Importer</h1>
        <p style={subTitleStyle}>Paste your list from the clipboard into the box below.</p>

        <textarea 
          placeholder='Paste your [ { ... } ] code here...'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          style={textareaStyle}
        />

        {status.msg && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: status.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: status.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center'
          }}>
            {status.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            {status.msg}
          </div>
        )}

        <button 
          onClick={handleImport} 
          disabled={loading}
          style={{
            ...buttonStyle,
            backgroundColor: loading ? '#94a3b8' : '#2dd4bf'
          }}
        >
          <FiUpload /> {loading ? "PROCESSING DATABASE..." : "START DIRECT SYNC"}
        </button>
      </div>
    </div>
  );
};

// --- CSS IN JS FOR ALIGNMENT ---
const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '80vh',
  padding: '40px'
};

const cardStyle = {
  background: 'white',
  padding: '40px',
  borderRadius: '16px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
  width: '100%',
  maxWidth: '600px',
  textAlign: 'center',
  border: '1px solid #e2e8f0'
};

const titleStyle = { fontSize: '24px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' };
const subTitleStyle = { fontSize: '14px', color: '#64748b', marginBottom: '24px' };

const textareaStyle = {
  width: '100%',
  height: '250px',
  padding: '15px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  fontFamily: 'monospace',
  fontSize: '12px',
  marginBottom: '20px',
  resize: 'none',
  outline: 'none'
};

const buttonStyle = {
  width: '100%',
  padding: '16px',
  color: 'white',
  borderRadius: '8px',
  fontWeight: '800',
  fontSize: '14px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  transition: 'all 0.2s'
};

export default JsonImporter;
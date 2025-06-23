import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, serverTimestamp, orderBy, limit, runTransaction, getDoc, setDoc, getDocs, where } from 'firebase/firestore';

// --- Helper scripts for PDF generation will be loaded dynamically ---

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyC9Tf7tOlZhYNe6ubDZ7JFJhsMswiimxPw",
  authDomain: "dlv-warehouse-tracker.firebaseapp.com",
  projectId: "dlv-warehouse-tracker",
  storageBucket: "dlv-warehouse-tracker.appspot.com",
  messagingSenderId: "267729758583",
  appId: "1:267729758583:web:f5f7ca26afc99c17819972",
  measurementId: "G-1DH9GT5RXS"
};
const appId = 'dlv-warehouse-tracker'; // Using your project ID as the app ID

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// setLogLevel('debug');

// --- Helper Components & Functions ---
const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const Modal = ({ children, onClose, size = 'md' }) => {
    const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '3xl': 'max-w-3xl', '5xl': 'max-w-5xl' };
    return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"><div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} p-6 relative transform transition-all duration-300 scale-95 opacity-0 animate-scale-in`}><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10" aria-label="Close modal"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>{children}</div></div>);
};

const Spinner = () => <div className="flex justify-center items-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => !isOpen ? null : <Modal onClose={onClose}><div className="text-center"><h3 className="text-lg font-medium text-gray-900 mb-4">{message}</h3><div className="flex justify-center gap-4"><button onClick={onClose} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200">Cancel</button><button onClick={onConfirm} className="px-6 py-2 text-white bg-red-600 rounded-full hover:bg-red-700">Confirm</button></div></div></Modal>;

const logAction = async (userName, action, details) => {
    try { await addDoc(collection(db, `artifacts/${appId}/public/data/logs`), { timestamp: serverTimestamp(), action, details, user: userName }); } 
    catch (error) { console.error("Failed to log action:", error); }
};

// --- Dashboard Widget Components ---
const StatsWidget = ({ inventory }) => {
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalValue = inventory.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
    const stats = [{ name: 'Total Unique Items', value: totalItems, icon: '📦' }, { name: 'Total Quantity', value: totalQuantity, icon: '🔢' }, { name: 'Total Inventory Value', value: formatCurrency(totalValue), icon: '💰' }];
    return (<div className="bg-white rounded-2xl shadow-lg p-6"><h3 className="text-lg font-bold text-gray-800 mb-4">At a Glance</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{stats.map(stat => (<div key={stat.name} className="bg-gray-50 rounded-lg p-4 flex items-center gap-4"><div><p className="text-sm text-gray-500">{stat.name}</p><p className="text-2xl font-bold text-gray-800">{stat.value}</p></div></div>))}</div></div>);
};

const AllInventoryWidget = ({ inventory, onEdit, onDelete, onAdjustStock, isLoading, searchTerm, setSearchTerm, isAdminMode, settings }) => (
     <div className="bg-white rounded-2xl shadow-lg p-6 lg:col-span-2">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Global Inventory</h3>
            <div className="relative w-full sm:w-64">
                <input type="text" placeholder="Search by SKU, name..." className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-full text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
        </div>
        {isLoading ? <Spinner /> : (
            <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left table-auto">
                    <thead><tr className="border-b-2 border-gray-100"><th className="p-4 text-sm font-semibold text-gray-600">SKU</th><th className="p-4 text-sm font-semibold text-gray-600">Name</th><th className="p-4 text-sm font-semibold text-gray-600">Price</th><th className="p-4 text-sm font-semibold text-gray-600">Qty</th><th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th></tr></thead>
                    <tbody>
                        {inventory.length > 0 ? inventory.map(item => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-4 font-mono text-xs text-gray-500">{item.sku}</td>
                                <td className="p-4"><p className="font-medium text-gray-800">{item.name}</p><p className="text-sm text-gray-500">{item.brand}</p></td>
                                <td className="p-4 text-gray-600">{formatCurrency(item.price)}</td>
                                <td className={`p-4 font-semibold ${Number(item.qty) < Number(item.reorderLevel || settings.reorderLevel) ? 'text-red-500' : 'text-gray-600'}`}>{item.qty}</td>
                                <td className="p-4 text-right"><div className="flex justify-end gap-1">{ isAdminMode && <>
                                    <button onClick={() => onAdjustStock(item)} className="p-2 text-gray-400 hover:text-green-600 rounded-full hover:bg-gray-100" title="Adjust Stock">±</button>
                                    <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100" title="Edit Item">✏️</button>
                                    <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100" title="Delete Item">🗑️</button>
                                </>}</div></td>
                            </tr>
                        )) : (<tr><td colSpan="5" className="text-center p-8 text-gray-500">{searchTerm ? `No items found.` : `Inventory is empty.`}</td></tr>)}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

const LogsWidget = ({ isLoading }) => {
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        const q = query(collection(db, `artifacts/${appId}/public/data/logs`), orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, snapshot => setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return () => unsub();
    }, []);
    return (<div className="bg-white rounded-2xl shadow-lg p-6"><h3 className="text-lg font-bold text-gray-800 mb-4">Activity Logs</h3>{isLoading ? <Spinner/> : logs.length > 0 ? (<ul className="space-y-3">{logs.map(log => (<li key={log.id} className="text-sm"><p className="font-medium text-gray-700">{log.action} by <span className="text-indigo-600">{log.user || 'System'}</span>: <span className="font-normal text-gray-600">{log.details}</span></p><p className="text-xs text-gray-400">{log.timestamp?.toDate().toLocaleString()}</p></li>))}</ul>) : <p className="text-center py-8 text-gray-500">No recent activity.</p>}</div>);
};

const AdminLoginModal = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(password);
    };
    return (<form onSubmit={handleSubmit} className="space-y-4"><h2 className="text-2xl font-bold text-center text-gray-800">Admin Access</h2><div><label className="block text-sm font-medium">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" autoFocus/></div><button type="submit" className="w-full px-6 py-2 text-white bg-indigo-600 rounded-full">Unlock</button></form>);
};

const ItemForm = ({ currentItem, onSave, onClose }) => {
    const [item, setItem] = useState({ name: '', brand: '', qty: '0', location: '', sku: '', price: '0.00', reorderLevel: '10' });
    useEffect(() => { currentItem ? setItem(currentItem) : setItem({ name: '', brand: '', qty: '0', location: '', sku: `SKU-${Date.now()}`, price: '0.00', reorderLevel: '10' }); }, [currentItem]);
    const handleChange = (e) => setItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => { e.preventDefault(); if (!item.name || !item.sku) return alert('SKU and Name are required.'); onSave({...item, qty: Number(item.qty), price: parseFloat(item.price), reorderLevel: Number(item.reorderLevel)}); };
    return (<form onSubmit={handleSubmit} className="space-y-4"><h2 className="text-2xl font-bold text-gray-800">{currentItem ? 'Edit Item' : 'Add New Item'}</h2><div><label className="block text-sm font-medium">SKU</label><input type="text" name="sku" value={item.sku} onChange={handleChange} required disabled={!currentItem} className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100" /></div><div><label className="block text-sm font-medium">Item Name</label><input type="text" name="name" value={item.name} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium">Brand</label><input type="text" name="brand" value={item.brand} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium">Location</label><input type="text" name="location" value={item.location} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium">Price</label><input type="number" step="0.01" name="price" value={item.price} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium">Reorder Level</label><input type="number" name="reorderLevel" value={item.reorderLevel} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg" /></div></div><div><label className="block text-sm font-medium">Initial Quantity</label><input type="number" name="qty" value={item.qty} onChange={handleChange} required disabled={!!currentItem} className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100" /></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-6 py-2 bg-gray-100 rounded-full">Cancel</button><button type="submit" className="px-6 py-2 text-white bg-indigo-600 rounded-full">{currentItem ? 'Save' : 'Add'}</button></div></form>);
};

const SiteManagementForm = ({ sites, onClose }) => {
    const [newSite, setNewSite] = useState({ name: '', drPrefix: ''});
    const handleAddSite = async (e) => {
        e.preventDefault();
        if (!newSite.name || !newSite.drPrefix) return alert("Site Name and DR Prefix are required.");
        await addDoc(collection(db, `artifacts/${appId}/public/data/sites`), { ...newSite, lastDrNumber: 0 });
        setNewSite({ name: '', drPrefix: ''});
    };
    return (<div className="space-y-6"><h2 className="text-2xl font-bold text-gray-800">Manage Sites</h2><form onSubmit={handleAddSite} className="flex gap-2 items-end"><div className="flex-grow"><label className="text-sm font-medium">Site Name</label><input type="text" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div><div className="flex-grow"><label className="text-sm font-medium">DR Prefix (e.g., MNL)</label><input type="text" value={newSite.drPrefix} onChange={e => setNewSite({...newSite, drPrefix: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div><button type="submit" className="px-4 py-2 text-white bg-indigo-600 rounded-lg">Add</button></form><div className="border-t pt-4"><h3 className="font-bold mb-2">Existing Sites</h3><ul className="space-y-2">{sites.map(s => <li key={s.id} className="p-2 bg-gray-50 rounded-lg">{s.name} ({s.drPrefix})</li>)}</ul></div><div className="flex justify-end"><button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-full mt-4">Done</button></div></div>);
};

const AdjustStockForm = ({ item, onAdjust, onClose }) => {
    const [adjustment, setAdjustment] = useState(0);
    return (<div className="text-center"><h2 className="text-2xl font-bold text-gray-800 mb-2">Adjust Stock</h2><p className="mb-1 text-gray-600">{item.name}</p><p className="mb-4 text-sm font-mono text-gray-400">{item.sku}</p><div className="flex justify-center items-center gap-4 my-4"><button onClick={() => setAdjustment(adj => adj - 1)} className="font-bold text-2xl w-12 h-12 rounded-full bg-gray-200">-</button><input type="number" value={adjustment} onChange={e => setAdjustment(Number(e.target.value))} className="w-24 text-center text-2xl font-bold border-gray-300 rounded-lg" /><button onClick={() => setAdjustment(adj => adj + 1)} className="font-bold text-2xl w-12 h-12 rounded-full bg-gray-200">+</button></div><p className="text-sm mb-4">New Quantity: {Number(item.qty) + adjustment}</p><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose}>Cancel</button><button onClick={() => onAdjust(item, adjustment)} className="px-6 py-2 text-white bg-indigo-600 rounded-full">Apply</button></div></div>)
};

const SettingsForm = ({ currentSettings, onClose }) => {
    const [settings, setSettings] = useState(currentSettings);
    const [template, setTemplate] = useState({ name: '', address: '', contact: '', logo: null });

    useEffect(() => {
        const fetchTemplate = async () => {
            const docRef = doc(db, `artifacts/${appId}/public/data/settings`, 'receiptTemplate');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setTemplate(docSnap.data());
            }
        };
        fetchTemplate();
    }, []);

    const handleGeneralChange = e => setSettings(s => ({ ...s, [e.target.name]: e.target.value }));
    const handleTemplateChange = e => setTemplate(t => ({...t, [e.target.name]: e.target.value }));
    const handleLogoChange = (e) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => setTemplate(p => ({...p, logo: ev.target.result}));
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    const handleSave = async () => {
        await setDoc(doc(db, `artifacts/${appId}/public/data/settings`, 'general'), { ...settings }, { merge: true });
        await setDoc(doc(db, `artifacts/${appId}/public/data/settings`, 'receiptTemplate'), template, { merge: true });
        alert('Settings saved!');
        onClose();
    };

    return (<div className="space-y-6"><h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <div className="p-4 border rounded-lg"><h3 className="font-bold mb-2">General Settings</h3><div><label className="block text-sm font-medium mt-2">Admin Password</label><input type="password" name="adminPass" value={settings.adminPass} onChange={handleGeneralChange} className="w-full px-3 py-2 border rounded-lg" /></div></div>
        <div className="p-4 border rounded-lg space-y-2"><h3 className="font-bold mb-2">Receipt Template</h3><div><label className="block text-sm font-medium">Company Name</label><input type="text" name="name" value={template.name} onChange={handleTemplateChange} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium">Company Address</label><input type="text" name="address" value={template.address} onChange={handleTemplateChange} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium">Company Contact</label><input type="text" name="contact" value={template.contact} onChange={handleTemplateChange} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium">Logo</label><input type="file" accept="image/*" onChange={handleLogoChange} className="w-full text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div></div>
        <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-6 py-2 bg-gray-100 rounded-full">Cancel</button><button onClick={handleSave} className="px-6 py-2 text-white bg-indigo-600 rounded-full">Save Settings</button></div>
    </div>);
};


const DeliveryReceiptForm = ({ allItems, sites, onComplete, currentUser }) => {
    const [view, setView] = useState('form');
    const [dispatchSiteId, setDispatchSiteId] = useState(sites[0]?.id || '');
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [signatories, setSignatories] = useState({ recipient: '', preparedBy: currentUser || 'User', checkedBy: '' });
    const [receiptData, setReceiptData] = useState(null);
    const [companyInfo, setCompanyInfo] = useState({ name: '', address: '', contact: '', logo: null, accentColor: '#4f46e5' });
    const [showPrices, setShowPrices] = useState(true);

    useEffect(() => {
        const fetchTemplate = async () => {
            const docRef = doc(db, `artifacts/${appId}/public/data/settings`, 'receiptTemplate');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { setCompanyInfo(docSnap.data()); }
        };
        fetchTemplate();
    }, []);


    const handleAddToCart = (item) => {
        if (item.qty <= 0) { alert("Item is out of stock."); return; }
        setCart(current => current.find(i => i.id === item.id) ? current.map(i => i.id === item.id && i.deliveryQty < i.qty ? { ...i, deliveryQty: i.deliveryQty + 1 } : i) : [...current, { ...item, deliveryQty: 1 }]);
    };
    
    const handleUpdateCartQty = (itemId, newQty) => {
        const item = allItems.find(i => i.id === itemId);
        if (newQty > item.qty) { alert(`Maximum stock for ${item.name} is ${item.qty}.`); return; }
        if (newQty <= 0) setCart(cart.filter(i => i.id !== itemId));
        else setCart(cart.map(i => i.id === itemId ? { ...i, deliveryQty: newQty } : i));
    };
    
    const handleSignatoryChange = (e) => {
        const {name, value} = e.target;
        setSignatories(s => ({...s, [name]: value}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (cart.length === 0 || !dispatchSiteId) return alert("Cart is empty or no dispatch site selected.");
        
        const siteRef = doc(db, `artifacts/${appId}/public/data/sites`, dispatchSiteId);
        const dispatchSiteName = sites.find(s => s.id === dispatchSiteId)?.name || '';
        let newDrNumberStr = '';

        try {
            const finalReceiptData = await runTransaction(db, async (transaction) => {
                const siteDoc = await transaction.get(siteRef);
                if (!siteDoc.exists()) throw "Site document does not exist!";
                const lastDrNumber = siteDoc.data().lastDrNumber || 0;
                const newDrNumber = lastDrNumber + 1;
                newDrNumberStr = `${siteDoc.data().drPrefix}-${String(newDrNumber).padStart(5, '0')}`;
                transaction.update(siteRef, { lastDrNumber: newDrNumber });

                const drData = {
                    drNumber: newDrNumberStr,
                    ...signatories,
                    dispatchSiteId, dispatchSiteName,
                    createdAt: serverTimestamp(),
                    items: cart.map(({id, sku, name, brand, price, deliveryQty}) => ({id, sku, name, brand, price, deliveryQty})),
                    totalValue: cart.reduce((s, i) => s + (i.deliveryQty * i.price), 0),
                    companyInfo,
                    showPrices
                };
                transaction.set(doc(collection(db, `artifacts/${appId}/public/data/deliveryReceipts`)), drData);

                for (const item of cart) {
                    const itemRef = doc(db, `artifacts/${appId}/public/data/inventory`, item.id);
                    const newQty = item.qty - item.deliveryQty;
                    transaction.update(itemRef, { qty: newQty });
                }
                return drData; // Return the final data
            });
            await logAction(currentUser, 'Delivery Receipt Created', `${newDrNumberStr} for ${signatories.recipient}.`);
            setReceiptData({ ...finalReceiptData, date: new Date() }); // Use client-side date for immediate display
            setView('receipt');
        } catch (error) { alert("Transaction failed: " + error); console.error(error); }
    };
    
    if (view === 'receipt') { return <DRDisplay receiptData={receiptData} onDone={onComplete} /> }
    
    const filteredItems = allItems.filter(item => (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
    const cartTotal = cart.reduce((sum, item) => sum + (item.deliveryQty * item.price), 0);

    return (
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6" style={{height: 'calc(90vh - 4rem)'}}>
            <div className="md:w-1/2 flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Products</h2>
                <input type="text" placeholder="Search all products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4" />
                <div className="flex-grow overflow-y-auto pr-2 border-t pt-4">
                    {filteredItems.map(item => (<div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"><div><p className="font-medium">{item.name}</p><p className="text-sm text-gray-500">{item.sku} - In Stock: {item.qty}</p></div><button type="button" onClick={() => handleAddToCart(item)} className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full hover:bg-indigo-200">Add</button></div>))}
                </div>
            </div>
            <div className="md:w-1/2 flex flex-col bg-gray-50 p-6 rounded-lg border">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Receipt Details</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div><label className="block text-sm font-medium">Dispatch Site</label><select value={dispatchSiteId} onChange={e => setDispatchSiteId(e.target.value)} className="w-full px-3 py-2 border rounded-lg"><option value="" disabled>-- Select Site --</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Prepared By</label><input type="text" name="preparedBy" value={signatories.preparedBy} onChange={handleSignatoryChange} required className="w-full px-3 py-2 border rounded-lg" /></div>
                        <div><label className="block text-sm font-medium">Checked By</label><input type="text" name="checkedBy" value={signatories.checkedBy} onChange={handleSignatoryChange} required className="w-full px-3 py-2 border rounded-lg" /></div>
                    </div>
                    <div><label className="block text-sm font-medium">Recipient Name</label><input type="text" name="recipient" value={signatories.recipient} onChange={handleSignatoryChange} required className="w-full px-3 py-2 border rounded-lg" /></div>
                    
                    <div>
                        <h3 className="font-bold pt-4 border-t mt-4">Cart</h3>
                        {cart.length > 0 ? cart.map(item => (<div key={item.id} className="flex items-center justify-between text-sm py-1"><div><p>{item.name}</p><p className="text-xs text-gray-500">{item.sku}</p></div><div className="flex items-center gap-2"><input type="number" value={item.deliveryQty} onChange={e => handleUpdateCartQty(item.id, Number(e.target.value))} className="w-16 px-2 py-1 border rounded-lg" /><span>x {formatCurrency(item.price)}</span></div></div>)) : <p className="text-gray-500 text-center py-4">Cart is empty</p>}
                    </div>
                     <div className="border-t pt-4">
                        <label className="flex items-center gap-2 mt-4 flex-grow justify-end"><input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} /> <span className="text-sm">Show Prices on Receipt</span></label>
                    </div>
                </div>
                <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(cartTotal)}</span></div>
                    <button type="submit" className="w-full mt-4 px-6 py-3 text-white bg-indigo-600 rounded-full hover:bg-indigo-700">Generate & Finalize Receipt</button>
                </div>
            </div>
        </form>
    );
};

const DRDisplay = ({ receiptData, onDone }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const handleDownloadPdf = () => {
        setIsDownloading(true);
        const { jsPDF } = window.jspdf;
        const html2canvas = window.html2canvas;
        if (!jsPDF || !html2canvas) { alert("PDF generation library not loaded. Please refresh."); setIsDownloading(false); return; }

        const input = document.getElementById('printable-receipt');
        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`DR-${receiptData.drNumber}.pdf`);
            setIsDownloading(false);
        });
    };
    
    const headerStyle = { backgroundColor: receiptData.companyInfo.accentColor, color: 'white' };
    return (<div><div id="printable-receipt" className="printable-area p-8 bg-white"><header className="flex justify-between items-start mb-8"><div>{receiptData.companyInfo.logo && <img src={receiptData.companyInfo.logo} alt="Logo" className="h-16 w-auto mb-4" />}<p className="font-bold text-lg">{receiptData.companyInfo.name || 'Your Company'}</p><p className="text-sm">{receiptData.companyInfo.address}</p><p className="text-sm">{receiptData.companyInfo.contact}</p></div><div className="text-right"><h2 className="text-3xl font-bold" style={{color: receiptData.companyInfo.accentColor}}>DELIVERY RECEIPT</h2><p>DR #: <span className="font-mono">{receiptData.drNumber}</span></p><p className="text-sm">Date: {new Date(receiptData.date || receiptData.createdAt?.seconds * 1000).toLocaleDateString()}</p></div></header><div className="mb-8 p-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Recipient</p><p className="font-bold">{receiptData.recipient}</p></div><table className="w-full text-left table-auto border-collapse"><thead><tr style={receiptData.showPrices ? headerStyle : {}}><th className="p-2">SKU</th><th className="p-2">Item</th><th className="p-2 text-right">Qty</th>{receiptData.showPrices && <><th className="p-2 text-right">Unit Price</th><th className="p-2 text-right">Total</th></>}</tr></thead><tbody>{receiptData.items.map(i => (<tr key={i.id} className="border-b"><td className="p-2 font-mono text-xs">{i.sku}</td><td className="p-2">{i.name}</td><td className="p-2 text-right">{i.deliveryQty}</td>{receiptData.showPrices && <><td className="p-2 text-right">{formatCurrency(i.price)}</td><td className="p-2 text-right">{formatCurrency(i.deliveryQty * i.price)}</td></>}</tr>))}</tbody>{receiptData.showPrices && <tfoot><tr className="font-bold"><td colSpan="4" className="p-2 text-right border-t-2">Grand Total</td><td className="p-2 text-right border-t-2">{formatCurrency(receiptData.totalValue || receiptData.total)}</td></tr></tfoot>}</table><div className="mt-16 grid grid-cols-3 gap-8 text-center text-sm"><div className="border-t pt-2">Prepared by:<br/>{receiptData.preparedBy}</div><div className="border-t pt-2">Checked by:<br/>{receiptData.checkedBy}</div><div className="border-t pt-2">Received by:</div></div></div><div className="flex justify-end gap-4 mt-8 no-print"><button onClick={onDone}>Back</button><button onClick={() => window.print()} className="px-6 py-2 bg-gray-600 text-white rounded-full">Print</button><button onClick={handleDownloadPdf} disabled={isDownloading} className="px-6 py-2 bg-indigo-600 text-white rounded-full disabled:bg-indigo-300">{isDownloading ? 'Downloading...' : 'Download PDF'}</button></div></div>)
};


const DRHistory = ({ }) => {
    const [receipts, setReceipts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewReceipt, setViewReceipt] = useState(null);

    useEffect(() => {
        const q = query(collection(db, `artifacts/${appId}/public/data/deliveryReceipts`), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => { setReceipts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))); setIsLoading(false); });
        return () => unsub();
    }, []);

    if (viewReceipt) {
        return <DRDisplay receiptData={viewReceipt} onDone={() => setViewReceipt(null)} />
    }

    return (<div><h2 className="text-2xl font-bold text-gray-800 mb-4">Delivery Receipt History</h2>{isLoading ? <Spinner/> : <div className="overflow-x-auto"><table className="w-full text-left table-auto"><thead><tr className="border-b-2"><th className="p-2">Date</th><th className="p-2">DR #</th><th className="p-2">Site</th><th className="p-2">Recipient</th><th className="p-2 text-right">Total</th><th className="p-2"></th></tr></thead><tbody>{receipts.map(r => (<tr key={r.id} className="border-b hover:bg-gray-50">
        <td className="p-2 text-sm">{new Date(r.createdAt?.seconds * 1000).toLocaleDateString()}</td>
        <td className="p-2 font-mono text-sm">{r.drNumber}</td>
        <td className="p-2 text-sm">{r.dispatchSiteName}</td>
        <td className="p-2 text-sm">{r.recipient}</td>
        <td className="p-2 text-sm text-right">{r.showPrices ? formatCurrency(r.totalValue) : 'N/A'}</td>
        <td className="p-2 text-right"><button onClick={() => setViewReceipt(r)} className="text-indigo-600 text-sm font-semibold">View</button></td>
    </tr>))}</tbody></table></div>}</div>);
};


function App() {
    const [user, setUser] = useState(null);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [sites, setSites] = useState([]);
    const [settings, setSettings] = useState({ adminPass: 'superadmin' });
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [modal, setModal] = useState(null);
    const [currentItem, setCurrentItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);
    
    useEffect(() => {
        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src; script.onload = resolve; script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
        Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
        ]).catch(console.error);
    }, []);

    useEffect(() => {
        onAuthStateChanged(auth, async authUser => {
            if (authUser) {
                setUser(authUser);
            } else { 
                try { await signInAnonymously(auth); } catch (e) { console.error("Anonymous sign-in failed", e); } 
            }
            setIsAuthReady(true);
        });
    }, []);

    useEffect(() => {
        if (!isAuthReady) return;
        setIsLoading(true);
        const basePath = `artifacts/${appId}/public/data`;
        const unsubInv = onSnapshot(query(collection(db, `${basePath}/inventory`), orderBy('name')), snap => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSites = onSnapshot(query(collection(db, `${basePath}/sites`), orderBy('name')), snap => setSites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSettings = onSnapshot(doc(db, `${basePath}/settings`, 'general'), (d) => { if (d.exists()) { setSettings(s => ({...s, ...d.data()})); } });

        setIsLoading(false);
        return () => { unsubInv(); unsubSites(); unsubSettings(); };
    }, [isAuthReady, appId]);

    const handleSaveItem = async (item) => {
        const path = `artifacts/${appId}/public/data/inventory`;
        try {
            if (currentItem?.id) { await updateDoc(doc(db, path, currentItem.id), item); await logAction(isAdminMode ? 'Admin' : 'User', 'Item Updated', `${item.name} (${item.sku})`); } 
            else { await addDoc(collection(db, path), item); await logAction(isAdminMode ? 'Admin' : 'User', 'Item Added', `${item.name} (${item.sku})`); }
            setModal(null); setCurrentItem(null);
        } catch (e) { console.error("Save error:", e); }
    };

    const confirmDeleteItem = (id) => setItemToDelete(id);
    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        const item = inventory.find(i => i.id === itemToDelete);
        try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/inventory`, itemToDelete)); await logAction(isAdminMode ? 'Admin' : 'User', 'Item Deleted', `${item.name} (${item.sku})`); } 
        catch (e) { console.error("Delete error:", e); } finally { setItemToDelete(null); }
    };
    
    const handleAdjustStock = async (item, adjustment) => {
        const newQty = Number(item.qty) + adjustment;
        if (newQty < 0) { alert("Stock cannot go below zero."); return; }
        await updateDoc(doc(db, `artifacts/${appId}/public/data/inventory`, item.id), { qty: newQty });
        await logAction(isAdminMode ? 'Admin' : 'User', adjustment > 0 ? "Stock In" : "Stock Out", `${Math.abs(adjustment)}x ${item.name}. New Qty: ${newQty}.`);
        setModal(null);
    };

    const handleAdminLogin = (password) => {
        if(password === settings.adminPass) {
            setIsAdminMode(true);
            setModal(null);
        } else {
            alert('Incorrect admin password.');
        }
    };

    const openModal = (type, item = null) => { setCurrentItem(item); setModal(type); };
    
    const filteredInventory = inventory.filter(item => (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
    
    if (!isAuthReady || !user) return <div className="bg-gray-100 min-h-screen flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'); body { font-family: 'Poppins', sans-serif; } @keyframes scale-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}.animate-scale-in{animation:scale-in .2s ease-out forwards}@media print{body *{visibility:hidden}.printable-area,.printable-area *{visibility:visible}.printable-area{position:absolute;left:0;top:0;width:100%}.no-print{display:none}}`}</style>
             <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div><h1 className="text-4xl font-bold text-gray-800">Warehouse Management</h1><p className="text-gray-500 mt-1">Logged in as: <span className={isAdminMode ? "font-bold text-indigo-600" : ""}>{isAdminMode ? "Administrator" : "User"}</span></p></div>
                    <div className="flex gap-2">
                         <button onClick={() => openModal('admin_login')} className="bg-white text-gray-700 font-semibold p-2 rounded-full hover:bg-gray-100 shadow-sm border" title="Admin Access">🛡️</button>
                         {isAdminMode && <button onClick={() => openModal('sites')} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-100 shadow-sm border">Manage Sites</button>}
                         {isAdminMode && <button onClick={() => openModal('settings')} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-100 shadow-sm border">⚙️ Settings</button>}
                         <button onClick={() => openModal('dr_history')} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-100 shadow-sm border">View Receipts</button>
                         <button onClick={() => openModal('receipt')} className="bg-teal-500 text-white font-semibold py-2 px-4 rounded-full hover:bg-teal-600 shadow-md">🧾 Create Receipt</button>
                         {isAdminMode && <button onClick={() => openModal('item')} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full hover:bg-indigo-700 shadow-md">➕ Add Item</button>}
                    </div>
                </header>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3"><StatsWidget inventory={filteredInventory} /></div>
                    <LogsWidget isLoading={isLoading} />
                    <AllInventoryWidget inventory={inventory} onEdit={(item) => openModal('item', item)} onDelete={confirmDeleteItem} onAdjustStock={(item) => openModal('stock', item)} isLoading={isLoading} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isAdminMode={isAdminMode} settings={settings} />
                </div>
            </div>
            {modal === 'item' && <Modal onClose={() => setModal(null)}><ItemForm currentItem={currentItem} onSave={handleSaveItem} onClose={() => setModal(null)} /></Modal>}
            {modal === 'stock' && <Modal onClose={() => setModal(null)} size="sm"><AdjustStockForm item={currentItem} onAdjust={handleAdjustStock} onClose={() => setModal(null)} /></Modal>}
            {modal === 'receipt' && <Modal onClose={() => setModal(null)} size="5xl"><DeliveryReceiptForm allItems={inventory} sites={sites} onComplete={() => setModal(null)} currentUser={isAdminMode ? 'Admin' : 'User'} /></Modal>}
            {modal === 'dr_history' && <Modal onClose={() => setModal(null)} size="5xl"><DRHistory /></Modal>}
            {isAdminMode && modal === 'sites' && <Modal onClose={() => setModal(null)} size="lg"><SiteManagementForm onClose={() => setModal(null)} sites={sites} /></Modal>}
            {isAdminMode && modal === 'settings' && <Modal onClose={() => setModal(null)} size="lg"><SettingsForm currentSettings={settings} onClose={() => setModal(null)} /></Modal>}
            {modal === 'admin_login' && <Modal onClose={() => setModal(null)} size="sm"><AdminLoginModal onLogin={handleAdminLogin} /></Modal>}
            <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteItem} message="Are you sure? This cannot be undone." />
        </div>
    );
}

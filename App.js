import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, serverTimestamp, orderBy, limit, runTransaction, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const { useState, useEffect, useRef } = React;

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
const appId = 'dlv-warehouse-tracker';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper Components & Functions ---
const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const Modal = ({ children, onClose, size = 'md' }) => {
    const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '3xl': 'max-w-3xl', '5xl': 'max-w-5xl', '7xl': 'max-w-7xl' };
    return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"><div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} p-6 relative transform transition-all duration-300 scale-95 opacity-0 animate-scale-in`}><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10" aria-label="Close modal"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>{children}</div></div>);
};

const Spinner = ({ text = "Loading..." }) => <div className="bg-gray-100 min-h-screen flex flex-col justify-center items-center p-4"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div><p className="mt-4 text-gray-500">{text}</p></div>;

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => !isOpen ? null : <Modal onClose={onClose}><div className="text-center"><h3 className="text-lg font-medium text-gray-900 mb-4">{message}</h3><div className="flex justify-center gap-4"><button onClick={onClose} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200">Cancel</button><button onClick={onConfirm} className="px-6 py-2 text-white bg-red-600 rounded-full hover:bg-red-700">Confirm</button></div></div></Modal>;

const logAction = async (userName, action, details) => {
    try { await addDoc(collection(db, `artifacts/${appId}/public/data/logs`), { timestamp: serverTimestamp(), action, details, user: userName }); } 
    catch (error) { console.error("Failed to log action:", error); }
};

// ... All other components (ItemForm, AnalyticsDashboard, etc.) go here, unchanged from the last full script. ...

export default function App() {
    const [user, setUser] = useState(null);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [sites, setSites] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [settings, setSettings] = useState({ adminPass: 'superadmin' });
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [modal, setModal] = useState(null);
    const [currentItem, setCurrentItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

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
        
        const unsubInv = onSnapshot(query(collection(db, `${basePath}/inventory`), orderBy('name')), snap => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt }))));
        const unsubSites = onSnapshot(query(collection(db, `${basePath}/sites`), orderBy('name')), snap => setSites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSettings = onSnapshot(doc(db, `${basePath}/settings`, 'general'), (d) => { if (d.exists()) { setSettings(s => ({...s, ...d.data()})); } });
        const unsubReceipts = onSnapshot(query(collection(db, `${basePath}/deliveryReceipts`), orderBy('createdAt', 'desc')), snap => setReceipts(snap.docs.map(d => ({id:d.id, ...d.data()}))));

        setIsLoading(false);
        return () => { unsubInv(); unsubSites(); unsubSettings(); unsubReceipts(); };
    }, [isAuthReady]);

    // ... All handler functions ...

    const handleSaveItem = async (item) => {
        const path = `artifacts/${appId}/public/data/inventory`;
        const itemToSave = { ...item, createdAt: item.id ? item.createdAt : serverTimestamp() };
        try {
            if (currentItem?.id) { await updateDoc(doc(db, path, currentItem.id), itemToSave); await logAction(isAdminMode ? 'Admin' : 'User', 'Item Updated', `${item.name} (${item.sku})`); } 
            else { await addDoc(collection(db, path), itemToSave); await logAction(isAdminMode ? 'Admin' : 'User', 'Item Added', `${item.name} (${item.sku})`); }
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
        if(password === settings.adminPass) { setIsAdminMode(true); setModal(null); } 
        else { alert('Incorrect admin password.'); }
    };
    const openModal = (type, item = null) => { setCurrentItem(item); setModal(type); };
    
    const filteredInventory = inventory.filter(item => (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
    
    if (!isAuthReady || !user) return <div className="bg-gray-100 min-h-screen flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'); body { font-family: 'Poppins', sans-serif; } @keyframes scale-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}.animate-scale-in{animation:scale-in .2s ease-out forwards}@media print{body *{visibility:hidden}.printable-area,.printable-area *{visibility:visible}.printable-area{position:absolute;left:0;top:0;width:100%}.no-print{display:none}}`}</style>
            {/* The entire dashboard UI and modals go here, identical to the last version */}
        </div>
    );
}

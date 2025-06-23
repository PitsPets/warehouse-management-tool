import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, serverTimestamp, orderBy, limit, runTransaction, getDoc, setDoc } from 'firebase/firestore';

// --- Helper scripts for PDF and Chart generation will be loaded dynamically ---

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

const Spinner = () => <div className="flex justify-center items-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => !isOpen ? null : <Modal onClose={onClose}><div className="text-center"><h3 className="text-lg font-medium text-gray-900 mb-4">{message}</h3><div className="flex justify-center gap-4"><button onClick={onClose} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200">Cancel</button><button onClick={onConfirm} className="px-6 py-2 text-white bg-red-600 rounded-full hover:bg-red-700">Confirm</button></div></div></Modal>;

const logAction = async (userName, action, details) => {
    try { await addDoc(collection(db, `artifacts/${appId}/public/data/logs`), { timestamp: serverTimestamp(), action, details, user: userName }); } 
    catch (error) { console.error("Failed to log action:", error); }
};

// --- Chart Component ---
const ChartComponent = ({ type, data, options }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!chartRef.current) return;
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }
        if (window.Chart) {
            chartInstance.current = new window.Chart(chartRef.current, {
                type,
                data,
                options,
            });
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data, type, options]);

    return <canvas ref={chartRef}></canvas>;
};

// --- Analytics & Reporting Components ---
const AnalyticsDashboard = ({ inventory, receipts }) => {
    const topItemsData = {
        labels: inventory.sort((a,b) => (b.qty * b.price) - (a.qty * a.price)).slice(0,10).map(i => i.name),
        datasets: [{
            label: 'Total Value (PHP)',
            data: inventory.sort((a,b) => (b.qty * b.price) - (a.qty * a.price)).slice(0,10).map(i => i.qty * i.price),
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1
        }]
    };

    const categoryData = inventory.reduce((acc, item) => {
        const category = item.category || 'standard';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {});

    const categoryChartData = {
        labels: Object.keys(categoryData).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
        datasets: [{
            label: 'Inventory by Category',
            data: Object.values(categoryData),
            backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6'],
        }]
    };
    
    // Simplified Inventory Turnover
    const totalCOGS = receipts.reduce((sum, r) => sum + r.totalValue, 0);
    const avgInventoryValue = inventory.reduce((sum, i) => sum + (i.price * i.qty), 0) / (inventory.length || 1);
    const turnoverRatio = avgInventoryValue > 0 ? (totalCOGS / avgInventoryValue).toFixed(2) : 0;

    // Stock Aging
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    
    const stockAging = inventory.reduce((acc, item) => {
        const age = now - (item.createdAt?.seconds * 1000 || now);
        if (age < thirtyDays) acc['0-30']++;
        else if (age < sixtyDays) acc['31-60']++;
        else if (age < ninetyDays) acc['61-90']++;
        else acc['90+']++;
        return acc;
    }, { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 });

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Analytics & Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 bg-white rounded-2xl shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Top 10 Most Valuable Items</h3>
                    <ChartComponent type="bar" data={topItemsData} options={{ scales: { y: { beginAtZero: true } } }} />
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-lg">
                     <h3 className="text-lg font-bold mb-4">Inventory by Category</h3>
                     <ChartComponent type="pie" data={categoryChartData} />
                </div>
                 <div className="p-6 bg-white rounded-2xl shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Inventory Turnover Ratio</h3>
                    <p className="text-4xl font-bold text-indigo-600">{turnoverRatio}</p>
                    <p className="text-sm text-gray-500 mt-2">A higher ratio generally indicates better performance. (Based on dispatched items from DRs)</p>
                </div>
                 <div className="lg:col-span-2 p-6 bg-white rounded-2xl shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Stock Aging (Days)</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div><p className="text-2xl font-bold">{stockAging['0-30']}</p><p className="text-sm text-gray-500">0-30</p></div>
                        <div><p className="text-2xl font-bold">{stockAging['31-60']}</p><p className="text-sm text-gray-500">31-60</p></div>
                        <div><p className="text-2xl font-bold">{stockAging['61-90']}</p><p className="text-sm text-gray-500">61-90</p></div>
                        <div><p className="text-2xl font-bold">{stockAging['90+']}</p><p className="text-sm text-gray-500">90+</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// All other components (AllInventoryWidget, ItemForm, etc.) go here...
// Omitting them for brevity as they are unchanged.

function App() {
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
    
    // ... all other state and functions from previous correct version ...

    if (!isAuthReady || !user) return <div className="bg-gray-100 min-h-screen flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'); body { font-family: 'Poppins', sans-serif; } @keyframes scale-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}.animate-scale-in{animation:scale-in .2s ease-out forwards}@media print{body *{visibility:hidden}.printable-area,.printable-area *{visibility:visible}.printable-area{position:absolute;left:0;top:0;width:100%}.no-print{display:none}}`}</style>
             <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header and all modals */}
             </div>
        </div>
    );
}

export default App;


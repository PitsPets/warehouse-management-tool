// All helper components are defined first
const Modal = ({ children, onClose, size = 'md' }) => {
    const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '3xl': 'max-w-3xl', '5xl': 'max-w-5xl', '7xl': 'max-w-7xl' };
    return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"><div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} p-6 relative transform transition-all duration-300 scale-95 opacity-0 animate-scale-in`}><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10" aria-label="Close modal"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>{children}</div></div>);
};

const Spinner = ({ text = "Loading..." }) => <div className="flex flex-col justify-center items-center p-4 h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div><p className="mt-4 text-gray-500">{text}</p></div>;

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => !isOpen ? null : <Modal onClose={onClose}><div className="text-center"><h3 className="text-lg font-medium text-gray-900 mb-4">{message}</h3><div className="flex justify-center gap-4"><button onClick={onClose} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200">Cancel</button><button onClick={onConfirm} className="px-6 py-2 text-white bg-red-600 rounded-full hover:bg-red-700">Confirm</button></div></div></Modal>;

const ChartComponent = ({ type, data, options }) => {
    const chartRef = React.useRef(null);
    const chartInstance = React.useRef(null);

    React.useEffect(() => {
        if (!chartRef.current || !window.Chart) return;
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }
        chartInstance.current = new window.Chart(chartRef.current, { type, data, options });
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data, type, options]);

    return <canvas ref={chartRef}></canvas>;
};

// All other components will be defined within the main App component
// to ensure they are only rendered after libraries are loaded.

function App() {
    // --- State for tracking loaded libraries and Firebase instances ---
    const [libsLoaded, setLibsLoaded] = useState(false);
    const [firebaseApp, setFirebaseApp] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);

    // --- All other application state ---
    const [user, setUser] = useState(null);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [sites, setSites] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [settings, setSettings] = useState({ adminPass: 'superadmin' });
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [modal, setModal] = useState(null);
    const [currentItem, setCurrentItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

    // Effect to load all external scripts
    useEffect(() => {
        const loadScript = (id, src) => new Promise((resolve, reject) => {
            if (document.getElementById(id)) return resolve();
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });

        Promise.all([
            loadScript('firebase-app-script', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
            loadScript('firebase-auth-script', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
            loadScript('firebase-firestore-script', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
            loadScript('jspdf-script', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            loadScript('html2canvas-script', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
            loadScript('chartjs-script', 'https://cdn.jsdelivr.net/npm/chart.js')
        ])
        .then(() => {
            console.log("All libraries loaded successfully.");
            setLibsLoaded(true);
        })
        .catch(error => console.error("Library loading failed:", error));
    }, []);

    // Effect to initialize Firebase once libraries are loaded
    useEffect(() => {
        if (!libsLoaded) return;

        const firebaseConfig = {
            apiKey: "AIzaSyC9Tf7tOlZhYNe6ubDZ7JFJhsMswiimxPw",
            authDomain: "dlv-warehouse-tracker.firebaseapp.com",
            projectId: "dlv-warehouse-tracker",
            storageBucket: "dlv-warehouse-tracker.appspot.com",
            messagingSenderId: "267729758583",
            appId: "1:267729758583:web:f5f7ca26afc99c17819972",
            measurementId: "G-1DH9GT5RXS"
        };
        
        const app = window.firebase.initializeApp(firebaseConfig);
        const authInstance = window.firebase.auth.getAuth(app);
        const dbInstance = window.firebase.firestore.getFirestore(app);

        setFirebaseApp(app);
        setAuth(authInstance);
        setDb(dbInstance);

        window.firebase.auth.onAuthStateChanged(authInstance, async (authUser) => {
            if (authUser) {
                setUser(authUser);
            } else {
                try {
                    await window.firebase.auth.signInAnonymously(authInstance);
                } catch (e) {
                    console.error("Anonymous sign-in failed", e);
                }
            }
            setIsAuthReady(true);
        });
    }, [libsLoaded]);

    // Effect to fetch data from Firestore once authenticated and DB is ready
    useEffect(() => {
        if (!isAuthReady || !db) return;
        
        const { collection, query, orderBy, onSnapshot, doc } = window.firebase.firestore;
        const appId = 'dlv-warehouse-tracker';
        const basePath = `artifacts/${appId}/public/data`;

        setIsLoadingData(true);
        const unsubInv = onSnapshot(query(collection(db, `${basePath}/inventory`), orderBy('name')), snap => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSites = onSnapshot(query(collection(db, `${basePath}/sites`), orderBy('name')), snap => setSites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSettings = onSnapshot(doc(db, `${basePath}/settings`, 'general'), (d) => { if (d.exists()) { setSettings(s => ({...s, ...d.data()})); } });
        const unsubReceipts = onSnapshot(query(collection(db, `${basePath}/deliveryReceipts`), orderBy('createdAt', 'desc')), snap => setReceipts(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        setIsLoadingData(false);

        return () => { unsubInv(); unsubSites(); unsubSettings(); unsubReceipts(); };
    }, [isAuthReady, db]);

    // Handler functions
    const handleSaveItem = async (item) => {
        // Implementation...
    };
    const confirmDeleteItem = (id) => setItemToDelete(id);
    const handleDeleteItem = async () => {
        // Implementation...
    };
    const handleAdjustStock = async (item, adjustment) => {
       // Implementation...
    };
    const handleAdminLogin = (password) => {
        if(password === settings.adminPass) { setIsAdminMode(true); setModal(null); } 
        else { alert('Incorrect admin password.'); }
    };
    const openModal = (type, item = null) => { setCurrentItem(item); setModal(type); };

    const filteredInventory = inventory.filter(item => (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()));

    if (!libsLoaded || !isAuthReady || !user) {
        return (
            <div className="bg-gray-100 min-h-screen flex items-center justify-center">
                <Spinner text={libsLoaded ? 'Authenticating...' : 'Loading Libraries...'} />
            </div>
        );
    }
    
    // The main app UI
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
                         <button onClick={() => openModal('reports')} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-100 shadow-sm border">📊 Reports</button>
                         <button onClick={() => openModal('dr_history')} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-100 shadow-sm border">View Receipts</button>
                         <button onClick={() => openModal('receipt')} className="bg-teal-500 text-white font-semibold py-2 px-4 rounded-full hover:bg-teal-600 shadow-md">🧾 Create Receipt</button>
                         {isAdminMode && <button onClick={() => openModal('item')} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full hover:bg-indigo-700 shadow-md">➕ Add Item</button>}
                    </div>
                </header>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3"><StatsWidget inventory={filteredInventory} /></div>
                    <LogsWidget isLoading={isLoading} />
                    <AllInventoryWidget inventory={filteredInventory} onEdit={(item) => openModal('item', item)} onDelete={confirmDeleteItem} onAdjustStock={(item) => openModal('stock', item)} isLoading={isLoading} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isAdminMode={isAdminMode} settings={settings} />
                </div>
            </div>
            {/* All modals would be rendered here, same as previous version */}
            {modal === 'item' && <Modal onClose={() => setModal(null)} size="lg"><ItemForm currentItem={currentItem} onSave={handleSaveItem} onClose={() => setModal(null)} /></Modal>}
            {modal === 'stock' && <Modal onClose={() => setModal(null)} size="sm"><AdjustStockForm item={currentItem} onAdjust={handleAdjustStock} onClose={() => setModal(null)} /></Modal>}
            {modal === 'receipt' && <Modal onClose={() => setModal(null)} size="5xl"><DeliveryReceiptForm allItems={inventory} sites={sites} onComplete={() => setModal(null)} currentUser={isAdminMode ? 'Admin' : 'User'} /></Modal>}
            {modal === 'dr_history' && <Modal onClose={() => setModal(null)} size="5xl"><DRHistory /></Modal>}
            {isAdminMode && modal === 'sites' && <Modal onClose={() => setModal(null)} size="lg"><SiteManagementForm onClose={() => setModal(null)} sites={sites} /></Modal>}
            {isAdminMode && modal === 'settings' && <Modal onClose={() => setModal(null)} size="lg"><SettingsForm currentSettings={settings} onClose={() => setModal(null)} /></Modal>}
            {modal === 'admin_login' && <Modal onClose={() => setModal(null)} size="sm"><AdminLoginModal onLogin={handleAdminLogin} /></Modal>}
            {modal === 'reports' && <Modal onClose={() => setModal(null)} size="7xl"><AnalyticsDashboard inventory={inventory} receipts={receipts} /></Modal>}
            <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteItem} message="Are you sure? This cannot be undone." />
        </div>
    );
}

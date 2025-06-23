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

    const { initializeApp } = React.lazy(() => import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"));
    const { getAuth, signInAnonymously, onAuthStateChanged } = React.lazy(() => import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"));
    const { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, serverTimestamp, orderBy, limit, runTransaction, getDoc, setDoc } = React.lazy(() => import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"));

    useEffect(() => {
        const loadScript = (src, integrity, crossorigin) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            if (integrity) script.integrity = integrity;
            if (crossorigin) script.crossOrigin = crossorigin;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });

        Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
            loadScript('https://cdn.jsdelivr.net/npm/chart.js')
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
        const unsubReceipts = onSnapshot(query(collection(db, `${basePath}/deliveryReceipts`), orderBy('createdAt', 'desc')), snap => setReceipts(snap.docs.map(d => ({id:d.id, ...d.data()}))));

        setIsLoading(false);
        return () => { unsubInv(); unsubSites(); unsubSettings(); unsubReceipts(); };
    }, [isAuthReady]);

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
            {modal === 'item' && <Modal onClose={() => setModal(null)} size="lg"><ItemForm currentItem={currentItem} onSave={handleSaveItem} onClose={() => setModal(null)} /></Modal>}
            {modal === 'stock' && <Modal onClose={() => setModal(null)} size="sm"><AdjustStockForm item={currentItem} onAdjust={handleAdjustStock} onClose={() => setModal(null)} /></Modal>}
            {modal === 'receipt' && <Modal onClose={() => setModal(null)} size="5xl"><DeliveryReceiptForm allItems={inventory} sites={sites} onComplete={() => setModal(null)} currentUser={isAdminMode ? 'Admin' : 'User'} /></Modal>}
            {modal === 'dr_history' && <Modal onClose={() => setModal(null)} size="5xl"><DRHistory /></Modal>}
            {modal === 'reports' && <Modal onClose={() => setModal(null)} size="7xl"><AnalyticsDashboard inventory={inventory} receipts={receipts} /></Modal>}
            {isAdminMode && modal === 'sites' && <Modal onClose={() => setModal(null)} size="lg"><SiteManagementForm onClose={() => setModal(null)} sites={sites} /></Modal>}
            {isAdminMode && modal === 'settings' && <Modal onClose={() => setModal(null)} size="lg"><SettingsForm currentSettings={settings} onClose={() => setModal(null)} /></Modal>}
            {modal === 'admin_login' && <Modal onClose={() => setModal(null)} size="sm"><AdminLoginModal onLogin={handleAdminLogin} /></Modal>}
            <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteItem} message="Are you sure? This cannot be undone." />
        </div>
    );
}

// All other components (ItemForm, SiteManagementForm, etc.) would go here.
// Omitting them for brevity as they are unchanged from the previous correct version. Assume all the other
// components are here.

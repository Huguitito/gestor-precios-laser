// Importar funciones necesarias de Firebase SDK (estilo modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
    query, orderBy, serverTimestamp, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --------------------------------------------------
// CONFIGURACIÓN DE FIREBASE (¡TU CONFIGURACIÓN!)
// --------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDJpAh_dkJGnrPBRaRBKVsdduhHconwEn0",
    authDomain: "gestor-precios-laser.firebaseapp.com",
    projectId: "gestor-precios-laser",
    storageBucket: "gestor-precios-laser.firebasestorage.app",
    messagingSenderId: "837754592507",
    appId: "1:837754592507:web:fef538b847430997ffa45e"
};

// --------------------------------------------------
// INICIALIZACIÓN DE FIREBASE
// --------------------------------------------------
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase inicializado correctamente usando SDK modular. 👍");
} catch (error) {
    console.error("Error inicializando Firebase:", error);
    const loginContainer = document.getElementById('login-container');
    if (loginContainer) {
        loginContainer.innerHTML = `<p style="color: red;">❌ Error grave al conectar con Firebase. Revisa la configuración y la consola.</p>`;
    } else {
        alert("Error grave al conectar con Firebase. Revisa la consola.");
    }
    throw new Error("Firebase initialization failed");
}

// --------------------------------------------------
// REFERENCIAS A ELEMENTOS DEL DOM
// --------------------------------------------------
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const adminControls = document.getElementById('admin-controls');
const dataEntryControls = document.getElementById('dataentry-controls');
const addProductButton = document.getElementById('add-product-button');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');
const productsTableContainer = document.getElementById('products-table-container');
const productsTbody = document.getElementById('products-tbody');
const noProductsMessage = document.getElementById('no-products-message');
const productFormModal = document.getElementById('product-form-modal');
const modalTitle = document.getElementById('modal-title');
const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const nombreInput = document.getElementById('product-nombre');
const descripcionInput = document.getElementById('product-descripcion');
const materialInput = document.getElementById('product-material');
const medidaInput = document.getElementById('product-medida');
const precioVentaInput = document.getElementById('product-precioVenta');
const adminPriceControls = document.getElementById('admin-price-controls');
const percentageInput = document.getElementById('product-percentage');
const increasePercentageButton = document.getElementById('increase-percentage-button');
const decreasePercentageButton = document.getElementById('decrease-percentage-button');
const saveProductButton = document.getElementById('save-product-button');
const formFeedback = document.getElementById('form-feedback');
const closeProductFormModalButton = document.getElementById('close-product-form-modal-button');
const cancelProductFormModalButton = document.getElementById('cancel-product-form-modal-button');
const globalPercentageInput = document.getElementById('global-percentage');
const increaseGlobalButton = document.getElementById('increase-global-button');
const decreaseGlobalButton = document.getElementById('decrease-global-button');
const globalUpdateFeedback = document.getElementById('global-update-feedback');
const qrCodeModal = document.getElementById('qr-code-modal');
const qrModalTitle = document.getElementById('qr-modal-title');
const qrCodeDisplay = document.getElementById('qr-code-display');
const printQrButton = document.getElementById('print-qr-button');
const closeQrModalButton = document.getElementById('close-qr-modal-button');
const closeQrModalButtonAlt = document.getElementById('close-qr-modal-button-alt');

// --------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------
let allProducts = [];
let currentUserRole = null;
let productsListener = null;
let listenersInitialized = false;

// --------------------------------------------------
// FUNCION PARA INICIALIZAR LISTENERS
// --------------------------------------------------
function initializeEventListeners() {
    if (listenersInitialized) return;
    console.log("Inicializando listeners de eventos...");
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (addProductButton) addProductButton.addEventListener('click', () => openProductModalForAdd());
    if (productForm) productForm.addEventListener('submit', handleFormSubmit);
    if (searchInput) searchInput.addEventListener('input', filterAndDisplayProducts);
    if (increaseGlobalButton) increaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(true));
    if (decreaseGlobalButton) decreaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(false));
    if (closeProductFormModalButton) closeProductFormModalButton.addEventListener('click', closeProductModal);
    if (cancelProductFormModalButton) cancelProductFormModalButton.addEventListener('click', closeProductModal);
    if (increasePercentageButton) increasePercentageButton.addEventListener('click', () => adjustPricePercentage(true));
    if (decreasePercentageButton) decreasePercentageButton.addEventListener('click', () => adjustPricePercentage(false));
    if (printQrButton) printQrButton.addEventListener('click', handlePrintQr);
    if (closeQrModalButton) closeQrModalButton.addEventListener('click', closeQrModal);
    if (closeQrModalButtonAlt) closeQrModalButtonAlt.addEventListener('click', closeQrModal);
    listenersInitialized = true;
    console.log("Listeners inicializados.");
}

// --------------------------------------------------
// MANEJO DE AUTENTICACIÓN Y ESTADO DE LA APP
// --------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('Usuario logueado:', user.email);
        try {
            const idTokenResult = await getIdTokenResult(user, true);
            currentUserRole = idTokenResult.claims.rol || null;
            console.log('Rol del usuario:', currentUserRole);
            updateUIVisibility(true);
            if (userEmailSpan) userEmailSpan.textContent = user.email;
            if (adminControls) adminControls.style.display = currentUserRole === 'administrador' ? 'block' : 'none';
            if (dataEntryControls) dataEntryControls.style.display = currentUserRole === 'dataEntry' ? 'block' : 'none';
            initializeEventListeners();
            loadProducts();
        } catch (error) {
            console.error("Error al obtener token/claims:", error); currentUserRole = null; handleLogout(); showLoginError("Error permisos.");
        }
    } else {
        console.log('Usuario no logueado.'); currentUserRole = null; updateUIVisibility(false);
        if (userEmailSpan) userEmailSpan.textContent = ''; if (adminControls) adminControls.style.display = 'none'; if (dataEntryControls) dataEntryControls.style.display = 'none';
        initializeEventListeners(); cleanupProductData(); listenersInitialized = false;
    }
});

function updateUIVisibility(isUserLoggedIn) { if (loginContainer) loginContainer.style.display = isUserLoggedIn ? 'none' : 'block'; if (appContainer) appContainer.style.display = isUserLoggedIn ? 'block' : 'none'; }
function cleanupProductData() { if (productsListener) { console.log("Deteniendo listener."); productsListener(); productsListener = null; } if (productsTbody) productsTbody.innerHTML = ''; allProducts = []; if (noProductsMessage) noProductsMessage.style.display = 'none'; if (loadingIndicator) loadingIndicator.style.display = 'none'; if (searchInput) searchInput.value = ''; }

// --------------------------------------------------
// FUNCIONES LOGIN / LOGOUT
// --------------------------------------------------
function handleLogin(e) { e.preventDefault(); if (!emailInput || !passwordInput || !loginButton || !loginError) return; const email = emailInput.value; const password = passwordInput.value; loginError.textContent = ''; loginError.style.display = 'none'; loginButton.disabled = true; loginButton.textContent = 'Entrando...'; signInWithEmailAndPassword(auth, email, password).then(uc => { console.log('Login OK:', uc.user.email); if(passwordInput) passwordInput.value = ''; }).catch(err => { console.error('Login Error:', err.code); showLoginError(getFirebaseErrorMessage(err)); }).finally(() => { if(loginButton) { loginButton.disabled = false; loginButton.textContent = 'Entrar 🔑'; } }); }
function handleLogout() { signOut(auth).then(() => { console.log('Logout OK.'); listenersInitialized = false; }).catch(err => { console.error('Logout Error:', err); alert("Error al cerrar sesión."); }); }
function showLoginError(message) { if (loginError) { loginError.textContent = `❌ ${message}`; loginError.style.display = 'block'; } }
function getFirebaseErrorMessage(error) { switch (error.code) { case 'auth/invalid-email': return 'Correo inválido.'; case 'auth/user-disabled': return 'Usuario deshabilitado.'; case 'auth/user-not-found': return 'Usuario no encontrado.'; case 'auth/wrong-password': return 'Contraseña incorrecta.'; case 'auth/invalid-credential': return 'Credenciales incorrectas.'; case 'auth/too-many-requests': return 'Demasiados intentos.'; default: return `Error (${error.code}).`; } }

// --------------------------------------------------
// LÓGICA DE GESTIÓN DE PRODUCTOS
// --------------------------------------------------

// --- Carga y Visualización ---
function formatPrice(price, includeSymbol = true) { const num = Number(price); if (isNaN(num)) return "N/A"; const opt = includeSymbol ? { style: 'currency', currency: 'ARS' } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }; return num.toLocaleString('es-AR', opt); }

// *** CORREGIDO: Texto del botón QR ***
function renderProductRow(product) {
    const tr = document.createElement('tr'); tr.setAttribute('data-id', product.id);
    tr.innerHTML = `
        <td>${product.nombre || 'N/A'}</td> <td>${product.descripcion || ''}</td>
        <td>${product.material || 'N/A'}</td> <td>${product.medida || 'N/A'}</td>
        <td>${formatPrice(product.precioVenta)}</td>
        <td>
            <button class="action-button edit-button" data-id="${product.id}" title="Editar Producto">✏️ Editar</button>
            <button class="action-button qr-button" data-id="${product.id}" title="Generar QR">QR</button> {/* CORREGIDO */}
            ${currentUserRole === 'administrador' ? `<button class="action-button delete-button" data-id="${product.id}" title="Eliminar Producto">🗑️ Borrar</button>` : ''}
        </td>`;
    if (productsTbody) productsTbody.appendChild(tr); else console.error("tbody missing");
}

function loadProducts() { if (productsListener) productsListener(); console.log("Loading products..."); if (loadingIndicator) loadingIndicator.style.display = 'block'; if (productsTableContainer) productsTableContainer.style.display = 'none'; if (noProductsMessage) noProductsMessage.style.display = 'none'; if (productsTbody) productsTbody.innerHTML = ''; allProducts = []; const q = query(collection(db, "productos"), orderBy("nombre")); productsListener = onSnapshot(q, (snap) => { console.log("Products updated."); allProducts = []; if (!productsTbody) return; productsTbody.innerHTML = ''; if (snap.empty) { if (noProductsMessage) noProductsMessage.style.display = 'block'; if (productsTableContainer) productsTableContainer.style.display = 'none'; } else { snap.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() })); filterAndDisplayProducts(); if (noProductsMessage) noProductsMessage.style.display = 'none'; if (productsTableContainer) productsTableContainer.style.display = 'block'; } if (loadingIndicator) loadingIndicator.style.display = 'none'; }, (err) => { console.error("Load error: ", err); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (productsTbody) productsTbody.innerHTML = `<tr><td colspan="6" style="color: red;">❌ Error: ${err.message}</td></tr>`; if (productsTableContainer) productsTableContainer.style.display = 'block'; if (noProductsMessage) noProductsMessage.style.display = 'none'; }); }

// --- Filtrado/Búsqueda ---
function filterAndDisplayProducts() { if (!searchInput || !productsTbody || !allProducts) return; const term = searchInput.value.toLowerCase().trim(); productsTbody.innerHTML = ''; const filtered = allProducts.filter(p => (p.nombre||'').toLowerCase().includes(term) || (p.descripcion||'').toLowerCase().includes(term) || (p.material||'').toLowerCase().includes(term) || (p.medida||'').toLowerCase().includes(term)); if (filtered.length === 0) { const msg = allProducts.length > 0 ? `No hay coincidencias para "${searchInput.value}".` : "No hay productos."; productsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${msg}</td></tr>`; if(allProducts.length === 0 && noProductsMessage) noProductsMessage.style.display = 'block'; else if (noProductsMessage) noProductsMessage.style.display = 'none'; if(allProducts.length === 0 && productsTableContainer) productsTableContainer.style.display = 'none'; else if (productsTableContainer) productsTableContainer.style.display = 'block'; } else { filtered.forEach(renderProductRow); if (noProductsMessage) noProductsMessage.style.display = 'none'; if (productsTableContainer) productsTableContainer.style.display = 'block'; } addTableActionListeners(); }

// --- Listeners para botones de la tabla ---
function addTableActionListeners() { if (!productsTbody) return; const addSafe = (sel, ev, hnd) => { productsTbody.querySelectorAll(sel).forEach(b => { b.removeEventListener(ev, hnd); b.addEventListener(ev, hnd); }); }; addSafe('.edit-button', 'click', handleEditClick); addSafe('.qr-button', 'click', handleQrClick); addSafe('.delete-button', 'click', handleDeleteClick); }
function handleEditClick(e) { const id = e.target.closest('button').dataset.id; if(id) openProductModalForEdit(id); }
function handleDeleteClick(e) { const id = e.target.closest('button').dataset.id; if(id) confirmDeleteProduct(id); }
function handleQrClick(e) { const id = e.target.closest('button').dataset.id; if(id) openQrModal(id); }

// --- Funciones Modal Producto ---
function openProductModalForAdd() { if (!productForm || !modalTitle || !formFeedback || !adminPriceControls || !precioVentaInput || !saveProductButton || !productFormModal || !nombreInput || !productIdInput) return; productForm.reset(); productIdInput.value = ''; modalTitle.textContent = '➕ Agregar'; formFeedback.textContent = ''; formFeedback.style.display = 'none'; adminPriceControls.style.display = 'none'; precioVentaInput.disabled = false; saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar'; productFormModal.style.display = 'block'; nombreInput.focus(); }
function openProductModalForEdit(productId) { if (!productForm || !modalTitle || !formFeedback || !nombreInput || !descripcionInput || !materialInput || !medidaInput || !precioVentaInput || !adminPriceControls || !percentageInput || !saveProductButton || !productFormModal || !productIdInput) return; const product = allProducts.find(p => p.id === productId); if (!product) return alert("Error: Producto no encontrado."); productForm.reset(); productIdInput.value = productId; modalTitle.textContent = '✏️ Editar'; formFeedback.textContent = ''; formFeedback.style.display = 'none'; nombreInput.value = product.nombre || ''; descripcionInput.value = product.descripcion || ''; materialInput.value = product.material || ''; medidaInput.value = product.medida || ''; precioVentaInput.value = product.precioVenta !== undefined ? product.precioVenta : ''; if (currentUserRole === 'administrador') { precioVentaInput.disabled = false; adminPriceControls.style.display = 'block'; percentageInput.value = ''; } else { precioVentaInput.disabled = true; adminPriceControls.style.display = 'none'; } saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar'; productFormModal.style.display = 'block'; nombreInput.focus(); }
function closeProductModal() { if (!productFormModal || !productForm || !formFeedback || !productIdInput) return; productFormModal.style.display = 'none'; productForm.reset(); formFeedback.textContent = ''; formFeedback.style.display = 'none'; productIdInput.value = ''; }
async function handleFormSubmit(event) { event.preventDefault(); if (!saveProductButton || !productIdInput || !nombreInput || !precioVentaInput || !descripcionInput || !materialInput || !medidaInput) return; saveProductButton.disabled = true; saveProductButton.textContent = 'Guardando...'; if(formFeedback){ formFeedback.textContent = ''; formFeedback.style.display = 'none';} const productId = productIdInput.value; const price = parseFloat(precioVentaInput.value); if (!nombreInput.value.trim()) { showFormFeedback("Nombre obligatorio.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar'; return; } if (isNaN(price) || price < 0) { showFormFeedback("Precio inválido.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar'; return; } let productData = { nombre: nombreInput.value.trim(), descripcion: descripcionInput.value.trim(), material: materialInput.value.trim(), medida: medidaInput.value.trim(), fechaModificacion: serverTimestamp() }; try { if (productId) { const ref = doc(db, "productos", productId); if (currentUserRole === 'administrador') { productData.precioVenta = price; } await updateDoc(ref, productData); showFormFeedback("Actualizado.", "success"); } else { productData.precioVenta = price; productData.fechaCreacion = serverTimestamp(); await addDoc(collection(db, "productos"), productData); showFormFeedback("Agregado.", "success"); } setTimeout(closeProductModal, 1500); } catch (error) { console.error("Save error:", error); let msg = `Error: ${error.message}`; if (error.code === 'permission-denied') msg = "Error: Permiso denegado."; showFormFeedback(msg, "error"); saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar'; } }
function showFormFeedback(message, type = "error") { if (!formFeedback) return; formFeedback.textContent = message; formFeedback.className = `feedback-message ${type}`; formFeedback.style.display = 'block'; }
function adjustPricePercentage(increase) { if (!percentageInput || !precioVentaInput) return; const perc = parseFloat(percentageInput.value); const curr = parseFloat(precioVentaInput.value); if (isNaN(perc) || perc <= 0) { alert("Porcentaje inválido."); percentageInput.focus(); return; } if (isNaN(curr)) { alert("Precio actual inválido."); precioVentaInput.focus(); return; } let nP = increase ? curr * (1 + perc / 100) : curr * (1 - perc / 100); nP = Math.max(0, Math.round(nP * 100) / 100); precioVentaInput.value = nP.toFixed(2); percentageInput.value = ''; }

// --- Borrado de Productos ---
function confirmDeleteProduct(productId) { const product = allProducts.find(p => p.id === productId); const name = product ? product.nombre : 'este'; if (window.confirm(`❓ ¿Eliminar "${name}"?\n\n⚠️ ¡Irreversible!`)) { deleteProductFromFirestore(productId, name); } else { console.log("Delete cancelled."); } }
async function deleteProductFromFirestore(productId, productName) { console.log(`Deleting ${productId}...`); const ref = doc(db, "productos", productId); try { await deleteDoc(ref); console.log(`✅ Deleted ${productId}.`); showTemporaryFeedback(`Eliminado: ${productName || productId}`, 'success'); } catch (error) { console.error(`❌ Delete error ${productId}: `, error); let msg = `Error: ${error.message}`; if (error.code === 'permission-denied') msg = "Error: Permiso denegado."; alert(msg); } }

// --- Actualización Global Precios ---
async function handleGlobalPriceUpdate(increase) { if (!globalPercentageInput || !globalUpdateFeedback || !increaseGlobalButton || !decreaseGlobalButton) return; const perc = parseFloat(globalPercentageInput.value); if (isNaN(perc) || perc === 0) { showGlobalFeedback("Porcentaje inválido.", "error"); return; } const absPerc = Math.abs(perc); const action = increase ? `AUMENTAR (+${absPerc}%)` : `BAJAR (-${absPerc}%)`; if (!window.confirm(`❓ ¿Aplicar ${action} a TODOS?\n\n⚠️ ¡Masivo!`)) { showGlobalFeedback("Cancelado.", "info"); return; } setGlobalControlsDisabled(true); showGlobalFeedback(`Procesando ${action}... ⏳`, "info"); try { const q = query(collection(db, "productos")); const snap = await getDocs(q); if (snap.empty) { showGlobalFeedback("No hay productos.", "info"); setGlobalControlsDisabled(false); return; } const batch = writeBatch(db); let count = 0; snap.forEach(docSnap => { const data = docSnap.data(); const price = data.precioVenta; if (typeof price === 'number' && !isNaN(price)) { let nP = increase ? price * (1 + absPerc / 100) : price * (1 - absPerc / 100); nP = Math.max(0, Math.round(nP * 100) / 100); batch.update(docSnap.ref, { precioVenta: nP, fechaModificacion: serverTimestamp() }); count++; } else { console.warn(`Omitido ${docSnap.id}`); } }); if (count > 0) { await batch.commit(); showGlobalFeedback(`✅ ${count} actualizados.`, "success"); globalPercentageInput.value = ''; } else { showGlobalFeedback("No se actualizaron.", "info"); } } catch (error) { console.error("Global error:", error); let msg = `Error: ${error.message}`; if (error.code === 'permission-denied') msg = "Error: Permiso denegado."; showGlobalFeedback(msg, "error"); } finally { setGlobalControlsDisabled(false); } }
function showGlobalFeedback(message, type = "info") { if (!globalUpdateFeedback) return; globalUpdateFeedback.textContent = message; globalUpdateFeedback.className = `feedback-message ${type}`; globalUpdateFeedback.style.display = 'block'; }
function setGlobalControlsDisabled(disabled) { if (!globalPercentageInput || !increaseGlobalButton || !decreaseGlobalButton) return; globalPercentageInput.disabled = disabled; increaseGlobalButton.disabled = disabled; decreaseGlobalButton.disabled = disabled; increaseGlobalButton.textContent = disabled ? "Procesando..." : "📈 Aumentar %"; decreaseGlobalButton.textContent = disabled ? "Procesando..." : "📉 Bajar %"; }


// --- Funciones Modal QR Code ---
// *** CORREGIDO: Limpieza más robusta del contenedor QR ***
function openQrModal(productId) {
    if (!qrModalTitle || !qrCodeDisplay || !qrCodeModal) return console.error("Missing QR modal elements.");
    const product = allProducts.find(p => p.id === productId); if (!product) { alert("Error: Producto no encontrado para QR."); return; }
    qrModalTitle.textContent = `QR: ${product.nombre}`;

    // Limpiar contenedor de forma robusta antes de generar nuevo QR
    while (qrCodeDisplay.firstChild) {
        qrCodeDisplay.removeChild(qrCodeDisplay.lastChild);
    }
    // qrCodeDisplay.innerHTML = ''; // Esta línea ya no es estrictamente necesaria con el while, pero no hace daño

    const priceText = formatPrice(product.precioVenta, false); const qrText = `Producto: ${product.nombre}\nPrecio: $${priceText}`;
    try { if (typeof QRCode === 'undefined') throw new Error("QRCode lib not found."); new QRCode(qrCodeDisplay, { text: qrText, width: 256, height: 256, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H }); console.log("QR generated for:", product.nombre); qrCodeModal.style.display = 'block'; } catch (error) { console.error("QR generation error:", error); alert("Error al generar QR."); qrCodeDisplay.innerHTML = '<p style="color:red;">Error al generar QR.</p>'; qrCodeModal.style.display = 'block'; }
}

function closeQrModal() { if (qrCodeModal) qrCodeModal.style.display = 'none'; if (qrCodeDisplay) qrCodeDisplay.innerHTML = ''; }
function handlePrintQr() { const btns = [printQrButton, closeQrModalButtonAlt, closeQrModalButton]; if (btns.some(b => !b)) console.warn("Missing QR modal buttons."); btns.forEach(b => { if (b) b.style.display = 'none'; }); window.print(); setTimeout(() => { if(printQrButton) printQrButton.style.display = 'inline-block'; if(closeQrModalButtonAlt) closeQrModalButtonAlt.style.display = 'inline-block'; if(closeQrModalButton) closeQrModalButton.style.display = 'block'; }, 1000); }

// --- Feedback Temporal ---
function showTemporaryFeedback(message, type = 'info', duration = 3000) { const el = document.createElement('div'); el.className = `temporary-feedback ${type}`; el.textContent = message; if(document.body) { document.body.appendChild(el); setTimeout(() => { el.remove(); }, duration); } else { console.warn("Feedback not shown: Body missing."); } }

// --- Fin del script ---
initializeEventListeners();
console.log("Script principal cargado.");
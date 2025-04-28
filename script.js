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

    // Listeners para botones de la tabla se añaden dinámicamente en addTableActionListeners()

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
            initializeEventListeners(); // Asegura listeners de la app principal
            loadProducts();
        } catch (error) {
            console.error("Error al obtener token/claims:", error);
            currentUserRole = null;
            handleLogout();
            showLoginError("Error al verificar permisos. Sesión cerrada.");
        }
    } else {
        console.log('Usuario no logueado.');
        currentUserRole = null;
        updateUIVisibility(false);
        if (userEmailSpan) userEmailSpan.textContent = '';
        if (adminControls) adminControls.style.display = 'none';
        if (dataEntryControls) dataEntryControls.style.display = 'none';
        initializeEventListeners(); // Asegura listeners del login
        cleanupProductData();
        listenersInitialized = false;
    }
});

function updateUIVisibility(isUserLoggedIn) {
    if (loginContainer) loginContainer.style.display = isUserLoggedIn ? 'none' : 'block';
    if (appContainer) appContainer.style.display = isUserLoggedIn ? 'block' : 'none';
}

function cleanupProductData() {
    if (productsListener) {
        console.log("Deteniendo listener de productos.");
        productsListener();
        productsListener = null;
    }
    if (productsTbody) productsTbody.innerHTML = '';
    allProducts = [];
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (searchInput) searchInput.value = '';
}

// --------------------------------------------------
// FUNCIONES LOGIN / LOGOUT
// --------------------------------------------------
function handleLogin(e) {
    e.preventDefault();
    if (!emailInput || !passwordInput || !loginButton || !loginError) return console.error("Elementos del formulario de login no encontrados.");
    const email = emailInput.value; const password = passwordInput.value;
    loginError.textContent = ''; loginError.style.display = 'none'; loginButton.disabled = true; loginButton.textContent = 'Entrando...';
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => { console.log('Login exitoso:', userCredential.user.email); if(passwordInput) passwordInput.value = ''; })
        .catch((error) => { console.error('Error login:', error.code); showLoginError(getFirebaseErrorMessage(error)); })
        .finally(() => { if(loginButton) { loginButton.disabled = false; loginButton.textContent = 'Entrar 🔑'; } });
}
function handleLogout() {
    signOut(auth).then(() => { console.log('Usuario deslogueado.'); listenersInitialized = false; })
                 .catch(error => { console.error('Error logout:', error); alert("Error al cerrar sesión."); });
}
function showLoginError(message) { if (loginError) { loginError.textContent = `❌ ${message}`; loginError.style.display = 'block'; } }
function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'El formato del correo no es válido.';
        case 'auth/user-disabled': return 'Este usuario ha sido deshabilitado.';
        case 'auth/user-not-found': return 'Usuario no encontrado con este correo.';
        case 'auth/wrong-password': return 'La contraseña es incorrecta.';
        case 'auth/invalid-credential': return 'Credenciales incorrectas.';
        case 'auth/too-many-requests': return 'Demasiados intentos fallidos. Intenta más tarde.';
        default: return `Error inesperado (${error.code}). Inténtalo de nuevo.`;
    }
}

// --------------------------------------------------
// LÓGICA DE GESTIÓN DE PRODUCTOS
// --------------------------------------------------

// --- Carga y Visualización ---
function formatPrice(price, includeSymbol = true) {
    const numberPrice = Number(price); if (isNaN(numberPrice)) return "N/A";
    const options = includeSymbol ? { style: 'currency', currency: 'ARS' } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return numberPrice.toLocaleString('es-AR', options);
}
function renderProductRow(product) {
    const tr = document.createElement('tr'); tr.setAttribute('data-id', product.id);
    tr.innerHTML = `
        <td>${product.nombre || 'N/A'}</td> <td>${product.descripcion || ''}</td>
        <td>${product.material || 'N/A'}</td> <td>${product.medida || 'N/A'}</td>
        <td>${formatPrice(product.precioVenta)}</td>
        <td>
            <button class="action-button edit-button" data-id="${product.id}" title="Editar Producto">✏️ Editar</button>
            <button class="action-button qr-button" data-id="${product.id}" title="Generar QR">큐알</button>
            ${currentUserRole === 'administrador' ? `<button class="action-button delete-button" data-id="${product.id}" title="Eliminar Producto">🗑️ Borrar</button>` : ''}
        </td>`;
    if (productsTbody) productsTbody.appendChild(tr); else console.error("productsTbody no encontrado para renderizar fila.");
}
function loadProducts() {
    if (productsListener) productsListener();
    console.log("Iniciando carga de productos...");
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (productsTableContainer) productsTableContainer.style.display = 'none';
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    if (productsTbody) productsTbody.innerHTML = '';
    allProducts = [];
    const q = query(collection(db, "productos"), orderBy("nombre"));
    productsListener = onSnapshot(q, (querySnapshot) => {
        console.log("Datos de productos recibidos/actualizados."); allProducts = [];
        if (productsTbody) productsTbody.innerHTML = ''; else return console.error("productsTbody no existe al recibir snapshot.");
        if (querySnapshot.empty) {
            if (noProductsMessage) noProductsMessage.style.display = 'block';
            if (productsTableContainer) productsTableContainer.style.display = 'none';
        } else {
            querySnapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
            filterAndDisplayProducts();
            if (noProductsMessage) noProductsMessage.style.display = 'none';
            if (productsTableContainer) productsTableContainer.style.display = 'block';
        }
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }, (error) => {
        console.error("Error al cargar productos: ", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (productsTbody) productsTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">❌ Error: ${error.message}</td></tr>`;
        if (productsTableContainer) productsTableContainer.style.display = 'block';
        if (noProductsMessage) noProductsMessage.style.display = 'none';
    });
}

// --- Filtrado/Búsqueda ---
function filterAndDisplayProducts() {
    if (!searchInput || !productsTbody || !allProducts) return console.warn("Faltan elementos para filtrar/mostrar productos.");
    const searchTerm = searchInput.value.toLowerCase().trim(); productsTbody.innerHTML = '';
    const filteredProducts = allProducts.filter(p => (p.nombre||'').toLowerCase().includes(searchTerm) || (p.descripcion||'').toLowerCase().includes(searchTerm) || (p.material||'').toLowerCase().includes(searchTerm) || (p.medida||'').toLowerCase().includes(searchTerm));
    if (filteredProducts.length === 0) {
        const message = allProducts.length > 0 ? `No se encontraron productos que coincidan con "${searchInput.value}".` : "No hay productos cargados.";
        productsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${message}</td></tr>`;
        if(allProducts.length === 0 && noProductsMessage) noProductsMessage.style.display = 'block'; else if (noProductsMessage) noProductsMessage.style.display = 'none';
        if(allProducts.length === 0 && productsTableContainer) productsTableContainer.style.display = 'none'; else if (productsTableContainer) productsTableContainer.style.display = 'block';
    } else {
        filteredProducts.forEach(renderProductRow);
        if (noProductsMessage) noProductsMessage.style.display = 'none';
        if (productsTableContainer) productsTableContainer.style.display = 'block';
    }
    addTableActionListeners();
}

// --- Listeners para botones de la tabla ---
function addTableActionListeners() {
    if (!productsTbody) return;
    const addSafeListener = (selector, event, handler) => {
        productsTbody.querySelectorAll(selector).forEach(button => {
            button.removeEventListener(event, handler); // Evitar duplicados
            button.addEventListener(event, handler);
        });
    };
    addSafeListener('.edit-button', 'click', handleEditClick);
    addSafeListener('.qr-button', 'click', handleQrClick);
    addSafeListener('.delete-button', 'click', handleDeleteClick);
}
function handleEditClick(event) { const id = event.target.closest('button').dataset.id; if(id) openProductModalForEdit(id); }
function handleDeleteClick(event) { const id = event.target.closest('button').dataset.id; if(id) confirmDeleteProduct(id); }
function handleQrClick(event) { const id = event.target.closest('button').dataset.id; if(id) openQrModal(id); }


// --- Funciones Modal Producto ---
function openProductModalForAdd() {
    if (!productForm || !modalTitle || !formFeedback || !adminPriceControls || !precioVentaInput || !saveProductButton || !productFormModal || !nombreInput || !productIdInput) return console.error("Faltan elementos del modal de producto.");
    productForm.reset(); productIdInput.value = ''; modalTitle.textContent = '➕ Agregar Nuevo Producto';
    formFeedback.textContent = ''; formFeedback.style.display = 'none'; adminPriceControls.style.display = 'none';
    precioVentaInput.disabled = false; saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar Nuevo';
    productFormModal.style.display = 'block'; nombreInput.focus();
}
function openProductModalForEdit(productId) {
    if (!productForm || !modalTitle || !formFeedback || !nombreInput || !descripcionInput || !materialInput || !medidaInput || !precioVentaInput || !adminPriceControls || !percentageInput || !saveProductButton || !productFormModal || !productIdInput) return console.error("Faltan elementos del modal de producto.");
    const product = allProducts.find(p => p.id === productId); if (!product) return alert("Error: Producto no encontrado.");
    productForm.reset(); productIdInput.value = productId; modalTitle.textContent = '✏️ Editar Producto';
    formFeedback.textContent = ''; formFeedback.style.display = 'none';
    nombreInput.value = product.nombre || ''; descripcionInput.value = product.descripcion || ''; materialInput.value = product.material || '';
    medidaInput.value = product.medida || ''; precioVentaInput.value = product.precioVenta !== undefined ? product.precioVenta : '';
    if (currentUserRole === 'administrador') {
        precioVentaInput.disabled = false; adminPriceControls.style.display = 'block'; percentageInput.value = '';
    } else { precioVentaInput.disabled = true; adminPriceControls.style.display = 'none'; }
    saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar Cambios'; productFormModal.style.display = 'block'; nombreInput.focus();
}
function closeProductModal() { if (!productFormModal || !productForm || !formFeedback || !productIdInput) return; productFormModal.style.display = 'none'; productForm.reset(); formFeedback.textContent = ''; formFeedback.style.display = 'none'; productIdInput.value = ''; }
async function handleFormSubmit(event) {
    event.preventDefault(); if (!saveProductButton || !productIdInput || !nombreInput || !precioVentaInput || !descripcionInput || !materialInput || !medidaInput) return console.error("Faltan elementos del formulario.");
    saveProductButton.disabled = true; saveProductButton.textContent = 'Guardando... 🔄'; if(formFeedback){ formFeedback.textContent = ''; formFeedback.style.display = 'none';}
    const productId = productIdInput.value; const price = parseFloat(precioVentaInput.value);
    if (!nombreInput.value.trim()) { showFormFeedback("El nombre es obligatorio.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo'; return; }
    if (isNaN(price) || price < 0) { showFormFeedback("El precio debe ser un número válido y no negativo.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo'; return; }
    let productData = { nombre: nombreInput.value.trim(), descripcion: descripcionInput.value.trim(), material: materialInput.value.trim(), medida: medidaInput.value.trim(), fechaModificacion: serverTimestamp() };
    try {
        if (productId) { const productRef = doc(db, "productos", productId); if (currentUserRole === 'administrador') { productData.precioVenta = price; } await updateDoc(productRef, productData); showFormFeedback("Producto actualizado.", "success"); } else { productData.precioVenta = price; productData.fechaCreacion = serverTimestamp(); const docRef = await addDoc(collection(db, "productos"), productData); showFormFeedback("Producto agregado.", "success"); }
        setTimeout(closeProductModal, 1500);
    } catch (error) { console.error("Error guardando:", error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; showFormFeedback(userMessage, "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo'; }
}
function showFormFeedback(message, type = "error") { if (!formFeedback) return; formFeedback.textContent = message; formFeedback.className = `feedback-message ${type}`; formFeedback.style.display = 'block'; }
function adjustPricePercentage(increase) {
    if (!percentageInput || !precioVentaInput) return;
    const percentage = parseFloat(percentageInput.value); const currentPrice = parseFloat(precioVentaInput.value);
    if (isNaN(percentage) || percentage <= 0) { alert("Introduce un porcentaje válido."); percentageInput.focus(); return; }
    if (isNaN(currentPrice)) { alert("Precio actual inválido."); precioVentaInput.focus(); return; }
    let newPrice = increase ? currentPrice * (1 + percentage / 100) : currentPrice * (1 - percentage / 100);
    newPrice = Math.max(0, Math.round(newPrice * 100) / 100); precioVentaInput.value = newPrice.toFixed(2); percentageInput.value = '';
}

// --- Borrado de Productos ---
function confirmDeleteProduct(productId) {
    const product = allProducts.find(p => p.id === productId); const productName = product ? product.nombre : 'este producto';
    if (window.confirm(`❓ ¿Eliminar "${productName}"?\n\n⚠️ ¡Acción irreversible!`)) { deleteProductFromFirestore(productId, productName); } else { console.log("Borrado cancelado."); }
}
async function deleteProductFromFirestore(productId, productName) {
    console.log(`Intentando eliminar ${productId}...`); const productRef = doc(db, "productos", productId);
    try { await deleteDoc(productRef); console.log(`✅ Producto ${productId} eliminado.`); showTemporaryFeedback(`Eliminado: ${productName || productId}`, 'success'); } catch (error) { console.error(`❌ Error al eliminar ${productId}: `, error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; alert(userMessage); }
}

// --- Actualización Global Precios ---
async function handleGlobalPriceUpdate(increase) {
    if (!globalPercentageInput || !globalUpdateFeedback || !increaseGlobalButton || !decreaseGlobalButton) return console.error("Faltan elementos de control global.");
    const percentage = parseFloat(globalPercentageInput.value); if (isNaN(percentage) || percentage === 0) { showGlobalFeedback("Introduce un porcentaje válido.", "error"); return; }
    const absPercentage = Math.abs(percentage); const actionText = increase ? `AUMENTAR (+${absPercentage}%)` : `BAJAR (-${absPercentage}%)`;
    if (!window.confirm(`❓ ¿Aplicar ${actionText} a TODOS?\n\n⚠️ ¡Acción masiva!`)) { showGlobalFeedback("Cancelado.", "info"); return; }
    setGlobalControlsDisabled(true); showGlobalFeedback(`Procesando ${actionText}... ⏳`, "info");
    try { const q = query(collection(db, "productos")); const querySnapshot = await getDocs(q); if (querySnapshot.empty) { showGlobalFeedback("No hay productos.", "info"); setGlobalControlsDisabled(false); return; } const batch = writeBatch(db); let updatedCount = 0; querySnapshot.forEach(docSnapshot => { const data = docSnapshot.data(); const price = data.precioVenta; if (typeof price === 'number' && !isNaN(price)) { let newPrice = increase ? price * (1 + absPercentage / 100) : price * (1 - absPercentage / 100); newPrice = Math.max(0, Math.round(newPrice * 100) / 100); batch.update(docSnapshot.ref, { precioVenta: newPrice, fechaModificacion: serverTimestamp() }); updatedCount++; } else { console.warn(`Omitido ${docSnapshot.id}: precio inválido.`); } }); if (updatedCount > 0) { await batch.commit(); showGlobalFeedback(`✅ ${updatedCount} productos actualizados.`, "success"); globalPercentageInput.value = ''; } else { showGlobalFeedback("No se actualizaron productos.", "info"); } } catch (error) { console.error("Error global:", error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; showGlobalFeedback(userMessage, "error"); } finally { setGlobalControlsDisabled(false); }
}
function showGlobalFeedback(message, type = "info") { if (!globalUpdateFeedback) return; globalUpdateFeedback.textContent = message; globalUpdateFeedback.className = `feedback-message ${type}`; globalUpdateFeedback.style.display = 'block'; }
function setGlobalControlsDisabled(disabled) { if (!globalPercentageInput || !increaseGlobalButton || !decreaseGlobalButton) return; globalPercentageInput.disabled = disabled; increaseGlobalButton.disabled = disabled; decreaseGlobalButton.disabled = disabled; increaseGlobalButton.textContent = disabled ? "Procesando..." : "📈 Aumentar Global %"; decreaseGlobalButton.textContent = disabled ? "Procesando..." : "📉 Bajar Global %"; }


// --- Funciones Modal QR Code ---
function openQrModal(productId) {
    if (!qrModalTitle || !qrCodeDisplay || !qrCodeModal) return console.error("Faltan elementos del modal QR.");
    const product = allProducts.find(p => p.id === productId); if (!product) { alert("Error: Producto no encontrado para QR."); return; }
    qrModalTitle.textContent = `QR: ${product.nombre}`; qrCodeDisplay.innerHTML = '';
    const priceText = formatPrice(product.precioVenta, false); const qrText = `Producto: ${product.nombre}\nPrecio: $${priceText}`;
    try { if (typeof QRCode === 'undefined') throw new Error("Librería QRCode no encontrada."); new QRCode(qrCodeDisplay, { text: qrText, width: 256, height: 256, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H }); console.log("QR generado para:", product.nombre); qrCodeModal.style.display = 'block'; } catch (error) { console.error("Error al generar QR:", error); alert("Error al generar código QR."); qrCodeDisplay.innerHTML = '<p style="color:red;">Error al generar QR.</p>'; qrCodeModal.style.display = 'block'; }
}
function closeQrModal() { if (qrCodeModal) qrCodeModal.style.display = 'none'; if (qrCodeDisplay) qrCodeDisplay.innerHTML = ''; }
function handlePrintQr() {
    const buttonsToToggle = [printQrButton, closeQrModalButtonAlt, closeQrModalButton];
    if (buttonsToToggle.some(btn => !btn)) console.warn("Faltan botones del modal QR para ocultar/mostrar al imprimir.");
    buttonsToToggle.forEach(btn => { if (btn) btn.style.display = 'none'; });
    window.print();
    setTimeout(() => { if(printQrButton) printQrButton.style.display = 'inline-block'; if(closeQrModalButtonAlt) closeQrModalButtonAlt.style.display = 'inline-block'; if(closeQrModalButton) closeQrModalButton.style.display = 'block'; }, 1000);
}

// --- Feedback Temporal ---
function showTemporaryFeedback(message, type = 'info', duration = 3000) {
    const feedbackElement = document.createElement('div'); feedbackElement.className = `temporary-feedback ${type}`; feedbackElement.textContent = message;
    if(document.body) { document.body.appendChild(feedbackElement); setTimeout(() => { feedbackElement.remove(); }, duration); } else { console.warn("Feedback temporal no mostrado: Body no encontrado aún."); }
}

// --- Fin del script ---
initializeEventListeners(); // Llamar una vez al inicio para listeners básicos (login)
console.log("Script principal cargado.");
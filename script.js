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
    // Detener la ejecución si Firebase no inicializa
    throw new Error("Firebase initialization failed");
}

// --------------------------------------------------
// REFERENCIAS A ELEMENTOS DEL DOM
// --------------------------------------------------
// Es importante obtener las referencias DESPUÉS de que el DOM esté listo,
// pero las declararemos aquí y las asignaremos más tarde o dentro de las funciones
// donde se usen por primera vez, o dentro de initializeEventListeners.
// Por simplicidad y dado que el script está al final del body, asignarlas aquí
// *debería* funcionar, pero moverlas dentro de initializeEventListeners es más seguro.
// Vamos a asignarlas aquí por ahora para mantener la estructura previa.

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
// *** NUEVO: Flag para asegurar que los listeners se inicializan una sola vez ***
let listenersInitialized = false;

// --------------------------------------------------
// FUNCION PARA INICIALIZAR LISTENERS (SE LLAMARÁ MÁS TARDE)
// --------------------------------------------------
function initializeEventListeners() {
    // Evitar inicializar múltiples veces
    if (listenersInitialized) {
        console.log("Listeners ya inicializados.");
        return;
    }
    console.log("Inicializando listeners de eventos...");

    // Listener para Login (asegurarse que el formulario exista)
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else {
        // Esto podría pasar si el usuario ya está logueado y el form no se muestra
        console.warn("Elemento #login-form no encontrado al añadir listener (puede ser normal).");
    }

    // Listeners para la App principal (solo si los elementos existen)
    // Es mejor verificar cada elemento antes de añadir el listener
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (addProductButton) addProductButton.addEventListener('click', () => openProductModalForAdd());
    if (productForm) productForm.addEventListener('submit', handleFormSubmit);
    if (searchInput) searchInput.addEventListener('input', filterAndDisplayProducts);
    if (increaseGlobalButton) increaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(true));
    if (decreaseGlobalButton) decreaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(false));

    // Modal Producto
    if (closeProductFormModalButton) closeProductFormModalButton.addEventListener('click', closeProductModal);
    if (cancelProductFormModalButton) cancelProductFormModalButton.addEventListener('click', closeProductModal);
    if (increasePercentageButton) increasePercentageButton.addEventListener('click', () => adjustPricePercentage(true));
    if (decreasePercentageButton) decreasePercentageButton.addEventListener('click', () => adjustPricePercentage(false));

    // Modal QR
    if (printQrButton) printQrButton.addEventListener('click', handlePrintQr);
    if (closeQrModalButton) closeQrModalButton.addEventListener('click', closeQrModal);
    if (closeQrModalButtonAlt) closeQrModalButtonAlt.addEventListener('click', closeQrModal);

    listenersInitialized = true; // Marcar como inicializados
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
            userEmailSpan.textContent = user.email;
            adminControls.style.display = currentUserRole === 'administrador' ? 'block' : 'none';
            dataEntryControls.style.display = currentUserRole === 'dataEntry' ? 'block' : 'none';
            // Asegurarse de que los listeners de la app principal estén listos AHORA
            initializeEventListeners();
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
        userEmailSpan.textContent = '';
        adminControls.style.display = 'none';
        dataEntryControls.style.display = 'none';
        // Asegurarse de que los listeners del login estén listos AHORA
        initializeEventListeners();
        cleanupProductData();
        listenersInitialized = false; // Permitir reinicializar si se vuelve a loguear
    }
});

function updateUIVisibility(isUserLoggedIn) {
    loginContainer.style.display = isUserLoggedIn ? 'none' : 'block';
    appContainer.style.display = isUserLoggedIn ? 'block' : 'none';
}

function cleanupProductData() {
    if (productsListener) {
        console.log("Deteniendo listener de productos.");
        productsListener();
        productsListener = null;
    }
    // Verificar si tbody existe antes de limpiar
    if(productsTbody) productsTbody.innerHTML = '';
    allProducts = [];
    if(noProductsMessage) noProductsMessage.style.display = 'none';
    if(loadingIndicator) loadingIndicator.style.display = 'none';
    if(searchInput) searchInput.value = '';
}

// --- Funciones de Login/Logout ---
function handleLogin(e) {
    e.preventDefault();
    // Verificar si los elementos existen antes de usarlos
    if (!emailInput || !passwordInput || !loginButton || !loginError) {
        console.error("Elementos del formulario de login no encontrados.");
        return;
    }
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.textContent = '';
    loginError.style.display = 'none';
    loginButton.disabled = true;
    loginButton.textContent = 'Entrando...';

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log('Login exitoso para:', userCredential.user.email);
            passwordInput.value = '';
            // onAuthStateChanged se encargará de actualizar UI y listeners
        })
        .catch((error) => {
            console.error('Error de inicio de sesión:', error.code, error.message);
            showLoginError(getFirebaseErrorMessage(error));
        })
        .finally(() => {
            // Verificar si el botón aún existe (podría haber cambiado la UI)
            if(loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Entrar 🔑';
            }
        });
}
function handleLogout() {
    signOut(auth).then(() => {
        console.log('Usuario deslogueado.');
        // onAuthStateChanged limpiará listeners y UI
        listenersInitialized = false; // Permitir reinicializar listeners para el login
    }).catch(error => {
        console.error('Error al cerrar sesión:', error);
        alert("Error al cerrar sesión. Intenta de nuevo.");
    });
}
function showLoginError(message) {
    if (loginError) {
        loginError.textContent = `❌ ${message}`;
        loginError.style.display = 'block';
    }
}
function getFirebaseErrorMessage(error) {
    // ... (código de la función sin cambios) ...
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
    // ... (código de la función sin cambios) ...
    const numberPrice = Number(price);
    if (isNaN(numberPrice)) return "N/A";
    const options = includeSymbol
        ? { style: 'currency', currency: 'ARS' }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return numberPrice.toLocaleString('es-AR', options);
}

function renderProductRow(product) {
    // ... (código de la función sin cambios, ya incluye botón QR) ...
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', product.id);
    tr.innerHTML = `
        <td>${product.nombre || 'N/A'}</td>
        <td>${product.descripcion || ''}</td>
        <td>${product.material || 'N/A'}</td>
        <td>${product.medida || 'N/A'}</td>
        <td>${formatPrice(product.precioVenta)}</td>
        <td>
            <button class="action-button edit-button" data-id="${product.id}" title="Editar Producto">✏️ Editar</button>
            <button class="action-button qr-button" data-id="${product.id}" title="Generar QR">큐알</button>
            ${currentUserRole === 'administrador' ? `
                <button class="action-button delete-button" data-id="${product.id}" title="Eliminar Producto">🗑️ Borrar</button>
            ` : ''}
        </td>
    `;
    // Verificar si tbody existe antes de añadir
    if (productsTbody) productsTbody.appendChild(tr);
}

function loadProducts() {
    // ... (código de la función sin cambios) ...
    if (productsListener) { productsListener(); }
    console.log("Iniciando carga de productos...");
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (productsTableContainer) productsTableContainer.style.display = 'none';
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    if (productsTbody) productsTbody.innerHTML = '';
    allProducts = [];
    const productosRef = collection(db, "productos");
    const q = query(productosRef, orderBy("nombre"));
    productsListener = onSnapshot(q, (querySnapshot) => {
        console.log("Datos de productos recibidos/actualizados.");
        allProducts = [];
        if (productsTbody) productsTbody.innerHTML = '';
        if (querySnapshot.empty) {
            if (noProductsMessage) noProductsMessage.style.display = 'block';
            if (productsTableContainer) productsTableContainer.style.display = 'none';
        } else {
            querySnapshot.forEach((doc) => { allProducts.push({ id: doc.id, ...doc.data() }); });
            filterAndDisplayProducts();
            if (noProductsMessage) noProductsMessage.style.display = 'none';
            if (productsTableContainer) productsTableContainer.style.display = 'block';
        }
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        // Listeners de tabla se añaden dentro de filterAndDisplayProducts
    }, (error) => {
        console.error("Error al cargar productos: ", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (productsTbody) productsTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">❌ Error al cargar productos: ${error.message}</td></tr>`;
        if (productsTableContainer) productsTableContainer.style.display = 'block';
        if (noProductsMessage) noProductsMessage.style.display = 'none';
    });
}

// --- Filtrado/Búsqueda ---
function filterAndDisplayProducts() {
    // Verificar elementos antes de usarlos
    if (!searchInput || !productsTbody || !allProducts) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    productsTbody.innerHTML = ''; // Limpiar tabla

    const filteredProducts = allProducts.filter(product => {
        // ... (lógica de filtro sin cambios) ...
        const nombre = (product.nombre || '').toLowerCase();
        const descripcion = (product.descripcion || '').toLowerCase();
        const material = (product.material || '').toLowerCase();
        const medida = (product.medida || '').toLowerCase();
        return nombre.includes(searchTerm) || descripcion.includes(searchTerm) ||
               material.includes(searchTerm) || medida.includes(searchTerm);
    });

    if (filteredProducts.length === 0) {
        if (allProducts.length > 0) {
            productsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No se encontraron productos que coincidan con "${searchInput.value}".</td></tr>`;
            if (productsTableContainer) productsTableContainer.style.display = 'block';
            if (noProductsMessage) noProductsMessage.style.display = 'none';
        } else {
            if (noProductsMessage) noProductsMessage.style.display = 'block';
            if (productsTableContainer) productsTableContainer.style.display = 'none';
        }
    } else {
        filteredProducts.forEach(renderProductRow); // Renderiza las filas
        if (noProductsMessage) noProductsMessage.style.display = 'none';
        if (productsTableContainer) productsTableContainer.style.display = 'block';
    }
    addTableActionListeners(); // Re-aplicar listeners a los botones nuevos/existentes
}

// --- Listeners para botones de la tabla ---
function addTableActionListeners() {
    // Verificar tbody antes de buscar botones
    if (!productsTbody) return;

    productsTbody.querySelectorAll('.edit-button').forEach(button => {
        button.removeEventListener('click', handleEditClick); // Prevenir duplicados
        button.addEventListener('click', handleEditClick);
    });
    productsTbody.querySelectorAll('.qr-button').forEach(button => {
        button.removeEventListener('click', handleQrClick); // Prevenir duplicados
        button.addEventListener('click', handleQrClick);
    });
    productsTbody.querySelectorAll('.delete-button').forEach(button => {
        button.removeEventListener('click', handleDeleteClick); // Prevenir duplicados
        button.addEventListener('click', handleDeleteClick);
    });
}
// Handlers (sin cambios, solo llaman a la función principal)
function handleEditClick(event) { const productId = event.target.closest('button').dataset.id; openProductModalForEdit(productId); }
function handleDeleteClick(event) { const productId = event.target.closest('button').dataset.id; confirmDeleteProduct(productId); }
function handleQrClick(event) { const productId = event.target.closest('button').dataset.id; openQrModal(productId); }


// --- Funciones Modal Producto ---
function openProductModalForAdd() { /* ... sin cambios ... */ }
function openProductModalForEdit(productId) { /* ... sin cambios ... */ }
function closeProductModal() { /* ... sin cambios ... */ }
async function handleFormSubmit(event) { /* ... sin cambios ... */ }
function showFormFeedback(message, type = "error") { /* ... sin cambios ... */ }
function adjustPricePercentage(increase) { /* ... sin cambios ... */ }
// --- Funciones Modal Producto --- (Incluyendo verificación de elementos)
function openProductModalForAdd() {
    if (!productForm || !productIdInput || !modalTitle || !formFeedback || !adminPriceControls || !precioVentaInput || !saveProductButton || !productFormModal || !nombreInput) return console.error("Faltan elementos del modal de producto.");
    productForm.reset(); productIdInput.value = ''; modalTitle.textContent = '➕ Agregar Nuevo Producto';
    formFeedback.textContent = ''; formFeedback.style.display = 'none'; adminPriceControls.style.display = 'none';
    precioVentaInput.disabled = false; saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar Nuevo';
    productFormModal.style.display = 'block'; nombreInput.focus();
}
function openProductModalForEdit(productId) {
    if (!productForm || !productIdInput || !modalTitle || !formFeedback || !nombreInput || !descripcionInput || !materialInput || !medidaInput || !precioVentaInput || !adminPriceControls || !percentageInput || !saveProductButton || !productFormModal) return console.error("Faltan elementos del modal de producto.");
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
function confirmDeleteProduct(productId) { /* ... sin cambios ... */ }
async function deleteProductFromFirestore(productId, productName) { /* ... sin cambios ... */ }
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
async function handleGlobalPriceUpdate(increase) { /* ... sin cambios ... */ }
function showGlobalFeedback(message, type = "info") { /* ... sin cambios ... */ }
function setGlobalControlsDisabled(disabled) { /* ... sin cambios ... */ }
// --- Actualización Global Precios --- (Incluyendo verificación de elementos)
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
    // Verificar elementos del modal QR
    if (!qrModalTitle || !qrCodeDisplay || !qrCodeModal) return console.error("Faltan elementos del modal QR.");

    const product = allProducts.find(p => p.id === productId);
    if (!product) { alert("Error: Producto no encontrado para QR."); return; }

    qrModalTitle.textContent = `QR: ${product.nombre}`;
    qrCodeDisplay.innerHTML = ''; // Limpiar

    // Usar formatPrice sin símbolo para QR, pero añadirlo manualmente
    const priceText = formatPrice(product.precioVenta, false);
    const qrText = `Producto: ${product.nombre}\nPrecio: $${priceText}`;

    try {
        // Asegurarse que la librería QRCode esté disponible globalmente
        if (typeof QRCode === 'undefined') {
             throw new Error("Librería QRCode no encontrada.");
        }
        new QRCode(qrCodeDisplay, {
            text: qrText, width: 256, height: 256,
            colorDark: "#000000", colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        console.log("QR generado para:", product.nombre);
        qrCodeModal.style.display = 'block';
    } catch (error) {
        console.error("Error al generar QR:", error);
        alert("Error al generar código QR.");
        qrCodeDisplay.innerHTML = '<p style="color:red;">Error al generar QR.</p>';
        qrCodeModal.style.display = 'block';
    }
}

function closeQrModal() {
    if (qrCodeModal) qrCodeModal.style.display = 'none';
    if (qrCodeDisplay) qrCodeDisplay.innerHTML = ''; // Limpiar
}

function handlePrintQr() {
    // Verificar elementos antes de ocultar/mostrar
    const buttonsToToggle = [printQrButton, closeQrModalButtonAlt, closeQrModalButton];
    if (buttonsToToggle.some(btn => !btn)) {
        console.warn("Faltan botones del modal QR para ocultar/mostrar al imprimir.");
    }

    buttonsToToggle.forEach(btn => { if (btn) btn.style.display = 'none'; });
    window.print();
    setTimeout(() => {
        if(printQrButton) printQrButton.style.display = 'inline-block';
        if(closeQrModalButtonAlt) closeQrModalButtonAlt.style.display = 'inline-block';
        if(closeQrModalButton) closeQrModalButton.style.display = 'block';
    }, 1000);
}

// --- Feedback Temporal ---
function showTemporaryFeedback(message, type = 'info', duration = 3000) {
    // ... (código de la función sin cambios) ...
    const feedbackElement = document.createElement('div'); feedbackElement.className = `temporary-feedback ${type}`; feedbackElement.textContent = message;
    if(document.body) { document.body.appendChild(feedbackElement); setTimeout(() => { feedbackElement.remove(); }, duration); } else { console.warn("Feedback temporal no mostrado: Body no encontrado aún."); }
}


// --- Fin del script ---
// Llamar a initializeEventListeners una vez al cargar el script
// Esto asegura que los listeners básicos (como el del login) estén listos.
// Los listeners de la app principal se re-verificarán/añadirán en onAuthStateChanged.
initializeEventListeners();

console.log("Script principal cargado.");
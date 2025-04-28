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
}

// --------------------------------------------------
// REFERENCIAS A ELEMENTOS DEL DOM
// --------------------------------------------------
// Login / App Containers
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
// Login Form
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
// Header / User Info
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
// Role Specific Controls
const adminControls = document.getElementById('admin-controls');
const dataEntryControls = document.getElementById('dataentry-controls');
// Global Admin Tools
const globalPercentageInput = document.getElementById('global-percentage');
const increaseGlobalButton = document.getElementById('increase-global-button');
const decreaseGlobalButton = document.getElementById('decrease-global-button');
const globalUpdateFeedback = document.getElementById('global-update-feedback');
// Product List / Search
const addProductButton = document.getElementById('add-product-button');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');
const productsTableContainer = document.getElementById('products-table-container');
const productsTbody = document.getElementById('products-tbody');
const noProductsMessage = document.getElementById('no-products-message');
// Product Form Modal
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
// *** NUEVO: QR Code Modal ***
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

// --------------------------------------------------
// EVENT LISTENERS INICIALES
// --------------------------------------------------
loginForm.addEventListener('submit', handleLogin);
logoutButton.addEventListener('click', handleLogout);
addProductButton.addEventListener('click', () => openProductModalForAdd());
productForm.addEventListener('submit', handleFormSubmit);
searchInput.addEventListener('input', filterAndDisplayProducts);
increaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(true));
decreaseGlobalButton.addEventListener('click', () => handleGlobalPriceUpdate(false));
// Modal Producto
closeProductFormModalButton.addEventListener('click', closeProductModal);
cancelProductFormModalButton.addEventListener('click', closeProductModal);
increasePercentageButton.addEventListener('click', () => adjustPricePercentage(true));
decreasePercentageButton.addEventListener('click', () => adjustPricePercentage(false));
// *** NUEVO: Modal QR ***
printQrButton.addEventListener('click', handlePrintQr);
closeQrModalButton.addEventListener('click', closeQrModal);
closeQrModalButtonAlt.addEventListener('click', closeQrModal);

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
        cleanupProductData();
    }
});

function updateUIVisibility(isUserLoggedIn) {
    loginContainer.style.display = isUserLoggedIn ? 'none' : 'block';
    appContainer.style.display = isUserLoggedIn ? 'block' : 'none';
}

function cleanupProductData() {
    if (productsListener) {
        productsListener(); // Detener listener
        productsListener = null;
    }
    productsTbody.innerHTML = '';
    allProducts = [];
    noProductsMessage.style.display = 'none';
    loadingIndicator.style.display = 'none';
    searchInput.value = '';
}

// --- Funciones Login/Logout --- (Sin cambios)
function handleLogin(e) { /* ... sin cambios ... */ }
function handleLogout() { /* ... sin cambios ... */ }
function showLoginError(message) { /* ... sin cambios ... */ }
function getFirebaseErrorMessage(error) { /* ... sin cambios ... */ }

// --- Funciones Login/Logout ---
function handleLogin(e) {
    e.preventDefault();
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
        })
        .catch((error) => {
            console.error('Error de inicio de sesión:', error.code, error.message);
            showLoginError(getFirebaseErrorMessage(error));
        })
        .finally(() => {
            loginButton.disabled = false;
            loginButton.textContent = 'Entrar 🔑';
        });
}
function handleLogout() {
    signOut(auth).then(() => console.log('Usuario deslogueado.')).catch(error => console.error('Error al cerrar sesión:', error));
}
function showLoginError(message) {
    loginError.textContent = `❌ ${message}`;
    loginError.style.display = 'block';
}
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
    const numberPrice = Number(price);
    if (isNaN(numberPrice)) return "N/A";
    const options = includeSymbol
        ? { style: 'currency', currency: 'ARS' }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return numberPrice.toLocaleString('es-AR', options);
}

// MODIFICADO: Añadido botón QR
function renderProductRow(product) {
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
            <button class="action-button qr-button" data-id="${product.id}" title="Generar QR">큐알</button> {/* Emoji coreano para QR */}
            ${currentUserRole === 'administrador' ? `
                <button class="action-button delete-button" data-id="${product.id}" title="Eliminar Producto">🗑️ Borrar</button>
            ` : ''}
        </td>
    `;
    productsTbody.appendChild(tr);
}

function loadProducts() {
    if (productsListener) {
        productsListener(); // Detener listener anterior si existe
    }
    console.log("Iniciando carga de productos...");
    loadingIndicator.style.display = 'block';
    productsTableContainer.style.display = 'none';
    noProductsMessage.style.display = 'none';
    productsTbody.innerHTML = '';
    allProducts = [];

    const productosRef = collection(db, "productos");
    const q = query(productosRef, orderBy("nombre"));

    productsListener = onSnapshot(q, (querySnapshot) => {
        console.log("Datos de productos recibidos/actualizados.");
        allProducts = [];
        productsTbody.innerHTML = '';
        if (querySnapshot.empty) {
            noProductsMessage.style.display = 'block';
            productsTableContainer.style.display = 'none';
        } else {
            querySnapshot.forEach((doc) => {
                allProducts.push({ id: doc.id, ...doc.data() });
            });
            filterAndDisplayProducts(); // Renderiza y añade listeners
            noProductsMessage.style.display = 'none';
            productsTableContainer.style.display = 'block';
        }
        loadingIndicator.style.display = 'none';
    }, (error) => {
        console.error("Error al cargar productos: ", error);
        loadingIndicator.style.display = 'none';
        productsTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">❌ Error al cargar productos: ${error.message}</td></tr>`;
        productsTableContainer.style.display = 'block';
        noProductsMessage.style.display = 'none';
    });
}

// --- Filtrado/Búsqueda --- (Sin cambios funcionales)
function filterAndDisplayProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    productsTbody.innerHTML = '';

    const filteredProducts = allProducts.filter(product => {
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
             productsTableContainer.style.display = 'block';
             noProductsMessage.style.display = 'none';
        } else {
            noProductsMessage.style.display = 'block';
            productsTableContainer.style.display = 'none';
        }
    } else {
        filteredProducts.forEach(renderProductRow);
        noProductsMessage.style.display = 'none';
        productsTableContainer.style.display = 'block';
    }
     addTableActionListeners(); // Re-aplicar listeners
}

// --- Listeners para botones de la tabla ---
// MODIFICADO: Añadido listener para botón QR
function addTableActionListeners() {
    productsTbody.querySelectorAll('.edit-button').forEach(button => {
        button.removeEventListener('click', handleEditClick);
        button.addEventListener('click', handleEditClick);
    });
    // *** NUEVO: Listener para QR ***
    productsTbody.querySelectorAll('.qr-button').forEach(button => {
        button.removeEventListener('click', handleQrClick);
        button.addEventListener('click', handleQrClick);
    });
    productsTbody.querySelectorAll('.delete-button').forEach(button => {
        button.removeEventListener('click', handleDeleteClick);
        button.addEventListener('click', handleDeleteClick);
    });
}

function handleEditClick(event) {
    const productId = event.target.closest('button').dataset.id;
    openProductModalForEdit(productId);
}

function handleDeleteClick(event) {
    const productId = event.target.closest('button').dataset.id;
    confirmDeleteProduct(productId);
}

// *** NUEVA FUNCIÓN: Manejar clic en botón QR ***
function handleQrClick(event) {
    const productId = event.target.closest('button').dataset.id;
    openQrModal(productId);
}


// --- Funciones Modal Producto --- (Sin cambios funcionales)
function openProductModalForAdd() { /* ... sin cambios ... */ }
function openProductModalForEdit(productId) { /* ... sin cambios ... */ }
function closeProductModal() { /* ... sin cambios ... */ }
async function handleFormSubmit(event) { /* ... sin cambios ... */ }
function showFormFeedback(message, type = "error") { /* ... sin cambios ... */ }
function adjustPricePercentage(increase) { /* ... sin cambios ... */ }

// --- Funciones Modal Producto ---
function openProductModalForAdd() {
    productForm.reset(); productIdInput.value = ''; modalTitle.textContent = '➕ Agregar Nuevo Producto';
    formFeedback.textContent = ''; formFeedback.style.display = 'none'; adminPriceControls.style.display = 'none';
    precioVentaInput.disabled = false; saveProductButton.disabled = false; saveProductButton.textContent = '💾 Guardar Nuevo';
    productFormModal.style.display = 'block'; nombreInput.focus();
}
function openProductModalForEdit(productId) {
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
function closeProductModal() { productFormModal.style.display = 'none'; productForm.reset(); formFeedback.textContent = ''; formFeedback.style.display = 'none'; productIdInput.value = ''; }
async function handleFormSubmit(event) {
    event.preventDefault(); saveProductButton.disabled = true; saveProductButton.textContent = 'Guardando... 🔄'; formFeedback.textContent = ''; formFeedback.style.display = 'none';
    const productId = productIdInput.value; const price = parseFloat(precioVentaInput.value);
    if (!nombreInput.value.trim()) { showFormFeedback("El nombre es obligatorio.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo'; return; }
    if (isNaN(price) || price < 0) { showFormFeedback("El precio debe ser un número válido y no negativo.", "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo'; return; }
    let productData = { nombre: nombreInput.value.trim(), descripcion: descripcionInput.value.trim(), material: materialInput.value.trim(), medida: medidaInput.value.trim(), fechaModificacion: serverTimestamp() };
    try {
        if (productId) {
            const productRef = doc(db, "productos", productId); if (currentUserRole === 'administrador') { productData.precioVenta = price; }
            await updateDoc(productRef, productData); showFormFeedback("Producto actualizado.", "success");
        } else {
            productData.precioVenta = price; productData.fechaCreacion = serverTimestamp(); const docRef = await addDoc(collection(db, "productos"), productData);
            showFormFeedback("Producto agregado.", "success");
        }
        setTimeout(closeProductModal, 1500);
    } catch (error) {
        console.error("Error guardando:", error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; showFormFeedback(userMessage, "error"); saveProductButton.disabled = false; saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo';
    }
}
function showFormFeedback(message, type = "error") { formFeedback.textContent = message; formFeedback.className = `feedback-message ${type}`; formFeedback.style.display = 'block'; }
function adjustPricePercentage(increase) {
    const percentage = parseFloat(percentageInput.value); const currentPrice = parseFloat(precioVentaInput.value);
    if (isNaN(percentage) || percentage <= 0) { alert("Introduce un porcentaje válido."); percentageInput.focus(); return; }
    if (isNaN(currentPrice)) { alert("Precio actual inválido."); precioVentaInput.focus(); return; }
    let newPrice = increase ? currentPrice * (1 + percentage / 100) : currentPrice * (1 - percentage / 100);
    newPrice = Math.max(0, Math.round(newPrice * 100) / 100); precioVentaInput.value = newPrice.toFixed(2); percentageInput.value = '';
}

// --- Borrado de Productos --- (Sin cambios funcionales)
function confirmDeleteProduct(productId) { /* ... sin cambios ... */ }
async function deleteProductFromFirestore(productId) { /* ... sin cambios ... */ }

// --- Borrado de Productos ---
function confirmDeleteProduct(productId) {
    const product = allProducts.find(p => p.id === productId); const productName = product ? product.nombre : 'este producto';
    if (window.confirm(`❓ ¿Eliminar "${productName}"?\n\n⚠️ ¡Acción irreversible!`)) { deleteProductFromFirestore(productId, productName); } else { console.log("Borrado cancelado."); }
}
async function deleteProductFromFirestore(productId, productName) {
    console.log(`Intentando eliminar ${productId}...`); const productRef = doc(db, "productos", productId);
    try { await deleteDoc(productRef); console.log(`✅ Producto ${productId} eliminado.`); showTemporaryFeedback(`Eliminado: ${productName || productId}`, 'success'); } catch (error) { console.error(`❌ Error al eliminar ${productId}: `, error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; alert(userMessage); }
}


// --- Actualización Global Precios --- (Sin cambios funcionales)
async function handleGlobalPriceUpdate(increase) { /* ... sin cambios ... */ }
function showGlobalFeedback(message, type = "info") { /* ... sin cambios ... */ }
function setGlobalControlsDisabled(disabled) { /* ... sin cambios ... */ }

// --- Actualización Global Precios ---
async function handleGlobalPriceUpdate(increase) {
    const percentage = parseFloat(globalPercentageInput.value); if (isNaN(percentage) || percentage === 0) { showGlobalFeedback("Introduce un porcentaje válido.", "error"); return; }
    const absPercentage = Math.abs(percentage); const actionText = increase ? `AUMENTAR (+${absPercentage}%)` : `BAJAR (-${absPercentage}%)`;
    if (!window.confirm(`❓ ¿Aplicar ${actionText} a TODOS?\n\n⚠️ ¡Acción masiva!`)) { showGlobalFeedback("Cancelado.", "info"); return; }
    setGlobalControlsDisabled(true); showGlobalFeedback(`Procesando ${actionText}... ⏳`, "info");
    try {
        const q = query(collection(db, "productos")); const querySnapshot = await getDocs(q); if (querySnapshot.empty) { showGlobalFeedback("No hay productos.", "info"); setGlobalControlsDisabled(false); return; }
        const batch = writeBatch(db); let updatedCount = 0;
        querySnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data(); const price = data.precioVenta; if (typeof price === 'number' && !isNaN(price)) { let newPrice = increase ? price * (1 + absPercentage / 100) : price * (1 - absPercentage / 100); newPrice = Math.max(0, Math.round(newPrice * 100) / 100); batch.update(docSnapshot.ref, { precioVenta: newPrice, fechaModificacion: serverTimestamp() }); updatedCount++; } else { console.warn(`Omitido ${docSnapshot.id}: precio inválido.`); }
        });
        if (updatedCount > 0) { await batch.commit(); showGlobalFeedback(`✅ ${updatedCount} productos actualizados.`, "success"); globalPercentageInput.value = ''; } else { showGlobalFeedback("No se actualizaron productos (precios inválidos).", "info"); }
    } catch (error) { console.error("Error global:", error); let userMessage = `Error: ${error.message}`; if (error.code === 'permission-denied') userMessage = "Error: Permiso denegado."; showGlobalFeedback(userMessage, "error"); } finally { setGlobalControlsDisabled(false); }
}
function showGlobalFeedback(message, type = "info") { globalUpdateFeedback.textContent = message; globalUpdateFeedback.className = `feedback-message ${type}`; globalUpdateFeedback.style.display = 'block'; }
function setGlobalControlsDisabled(disabled) { globalPercentageInput.disabled = disabled; increaseGlobalButton.disabled = disabled; decreaseGlobalButton.disabled = disabled; increaseGlobalButton.textContent = disabled ? "Procesando..." : "📈 Aumentar Global %"; decreaseGlobalButton.textContent = disabled ? "Procesando..." : "📉 Bajar Global %"; }


// --- *** NUEVAS FUNCIONES: Modal QR Code *** ---
function openQrModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        alert("Error: No se pudo encontrar la información del producto para generar el QR.");
        return;
    }

    qrModalTitle.textContent = `QR: ${product.nombre}`;
    qrCodeDisplay.innerHTML = ''; // Limpiar QR anterior

    // Texto a codificar en el QR (Nombre y Precio)
    // Usamos formatPrice sin símbolo de moneda para ahorrar espacio
    const qrText = `Producto: ${product.nombre}\nPrecio: $${formatPrice(product.precioVenta, false)}`;

    // Generar el QR usando la librería qrcode.js
    try {
        new QRCode(qrCodeDisplay, {
            text: qrText,
            width: 256, // Tamaño del QR en píxeles
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H // Nivel de corrección de errores (H es el más alto)
        });
        console.log("QR generado para:", product.nombre);
        qrCodeModal.style.display = 'block'; // Mostrar el modal
    } catch (error) {
        console.error("Error al generar el QR code:", error);
        alert("Hubo un problema al generar el código QR.");
        qrCodeDisplay.innerHTML = '<p style="color:red;">Error al generar QR.</p>';
        qrCodeModal.style.display = 'block'; // Mostrar modal con error
    }
}

function closeQrModal() {
    qrCodeModal.style.display = 'none';
    qrCodeDisplay.innerHTML = ''; // Limpiar el contenido al cerrar
}

function handlePrintQr() {
    // Ocultar temporalmente los botones para que no salgan en la impresión del modal
    // (Aunque los estilos @media print deberían encargarse, esto es un refuerzo)
    printQrButton.style.display = 'none';
    closeQrModalButtonAlt.style.display = 'none';
    closeQrModalButton.style.display = 'none'; // El de la X

    window.print(); // Abre el diálogo de impresión del navegador

    // Volver a mostrar los botones después de un pequeño retraso
    // (para dar tiempo a que se abra el diálogo de impresión)
    setTimeout(() => {
        printQrButton.style.display = 'inline-block';
        closeQrModalButtonAlt.style.display = 'inline-block';
        closeQrModalButton.style.display = 'block'; // El de la X
    }, 1000);
}

// --- Feedback Temporal --- (Sin cambios)
function showTemporaryFeedback(message, type = 'info', duration = 3000) { /* ... sin cambios ... */ }
function showTemporaryFeedback(message, type = 'info', duration = 3000) {
    const feedbackElement = document.createElement('div'); feedbackElement.className = `temporary-feedback ${type}`; feedbackElement.textContent = message;
    if(document.body) { document.body.appendChild(feedbackElement); setTimeout(() => { feedbackElement.remove(); }, duration); } else { console.warn("Feedback temporal no mostrado: Body no encontrado aún."); }
}


// --- Fin del script ---
console.log("Script principal cargado y listeners listos.");
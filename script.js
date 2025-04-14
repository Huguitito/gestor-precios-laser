// Importar funciones necesarias de Firebase SDK (estilo modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"; // Usar una versión reciente
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --------------------------------------------------
// CONFIGURACIÓN DE FIREBASE (¡TU CONFIGURACIÓN!)
// --------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDJpAh_dkJGnrPBRaRBKVsdduhHconwEn0", // TU API KEY REAL
    authDomain: "gestor-precios-laser.firebaseapp.com", // TU AUTH DOMAIN REAL
    projectId: "gestor-precios-laser",                // TU PROJECT ID REAL
    storageBucket: "gestor-precios-laser.firebasestorage.app", // TU STORAGE BUCKET REAL
    messagingSenderId: "837754592507",                 // TU MESSAGING SENDER ID REAL
    appId: "1:837754592507:web:fef538b847430997ffa45e"  // TU APP ID REAL
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
const closeModalButton = document.getElementById('close-modal-button');
const cancelModalButton = document.getElementById('cancel-modal-button');

const globalPercentageInput = document.getElementById('global-percentage');
const increaseGlobalButton = document.getElementById('increase-global-button');
const decreaseGlobalButton = document.getElementById('decrease-global-button');
const globalUpdateFeedback = document.getElementById('global-update-feedback');

// --------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------
let allProducts = []; // Almacena todos los productos cargados para filtrar
let currentUserRole = null; // Almacena el rol del usuario actual ('administrador', 'dataEntry', null)
let productsListener = null; // Referencia al listener de onSnapshot para poder detenerlo

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
closeModalButton.addEventListener('click', closeProductModal);
cancelModalButton.addEventListener('click', closeProductModal);
increasePercentageButton.addEventListener('click', () => adjustPricePercentage(true));
decreasePercentageButton.addEventListener('click', () => adjustPricePercentage(false));

// --------------------------------------------------
// MANEJO DE AUTENTICACIÓN Y ESTADO DE LA APP
// --------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('Usuario logueado:', user.email);
        try {
            const idTokenResult = await getIdTokenResult(user, true); // Forzar refresco para obtener claims actualizados
            currentUserRole = idTokenResult.claims.rol || null; // Leer claim 'rol'
            console.log('Rol del usuario:', currentUserRole);

            updateUIVisibility(true); // Mostrar la app principal
            userEmailSpan.textContent = user.email;

            // Mostrar/ocultar controles según rol
            adminControls.style.display = currentUserRole === 'administrador' ? 'block' : 'none';
            dataEntryControls.style.display = currentUserRole === 'dataEntry' ? 'block' : 'none';

            // Cargar productos solo después de confirmar el rol
            loadProducts();

        } catch (error) {
            console.error("Error al obtener el token o los claims:", error);
            currentUserRole = null;
            handleLogout(); // Desloguear si no podemos verificar el rol
            showLoginError("Error al verificar permisos. Sesión cerrada.");
        }
    } else {
        // Usuario no está logueado
        console.log('Usuario no logueado.');
        currentUserRole = null;
        updateUIVisibility(false); // Mostrar el login
        userEmailSpan.textContent = '';
        adminControls.style.display = 'none';
        dataEntryControls.style.display = 'none';
        cleanupProductData(); // Limpiar datos de productos y listener
    }
});

function updateUIVisibility(isUserLoggedIn) {
    loginContainer.style.display = isUserLoggedIn ? 'none' : 'block';
    appContainer.style.display = isUserLoggedIn ? 'block' : 'none';
}

function cleanupProductData() {
    if (productsListener) {
        console.log("Deteniendo listener de productos.");
        productsListener(); // Llama a la función de cancelación devuelta por onSnapshot
        productsListener = null;
    }
    productsTbody.innerHTML = '';
    allProducts = [];
    noProductsMessage.style.display = 'none';
    loadingIndicator.style.display = 'none';
    searchInput.value = ''; // Limpiar búsqueda
}

// --- Funciones de Login/Logout ---
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
            // onAuthStateChanged se encargará del resto
            passwordInput.value = ''; // Limpiar contraseña
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
    signOut(auth)
        .then(() => {
            console.log('Usuario deslogueado.');
            // onAuthStateChanged se encargará del resto
        })
        .catch((error) => {
            console.error('Error al cerrar sesión:', error);
            alert("Error al cerrar sesión. Intenta de nuevo.");
        });
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
function formatPrice(price) {
    const numberPrice = Number(price);
    if (isNaN(numberPrice)) {
        return "N/A"; // O manejar como prefieras si el precio no es número
    }
    return numberPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

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
            <button class="action-button edit-button" data-id="${product.id}">✏️ Editar</button>
            ${currentUserRole === 'administrador' ? `
                <button class="action-button delete-button" data-id="${product.id}">🗑️ Borrar</button>
            ` : ''}
        </td>
    `;
    productsTbody.appendChild(tr);
}

function loadProducts() {
    // Si ya hay un listener activo, detenerlo antes de crear uno nuevo
    if (productsListener) {
        console.log("Deteniendo listener anterior...");
        productsListener();
    }

    console.log("Iniciando carga de productos...");
    loadingIndicator.style.display = 'block';
    productsTableContainer.style.display = 'none';
    noProductsMessage.style.display = 'none';
    productsTbody.innerHTML = '';
    allProducts = [];

    const productosRef = collection(db, "productos");
    const q = query(productosRef, orderBy("nombre")); // Ordenar por nombre

    // Guardar la función de cancelación devuelta por onSnapshot
    productsListener = onSnapshot(q, (querySnapshot) => {
        console.log("Datos de productos recibidos/actualizados.");
        allProducts = []; // Limpiar antes de rellenar
        productsTbody.innerHTML = ''; // Limpiar vista

        if (querySnapshot.empty) {
            console.log("No se encontraron productos.");
            noProductsMessage.style.display = 'block';
            productsTableContainer.style.display = 'none';
        } else {
            console.log(`Procesando ${querySnapshot.size} productos.`);
            querySnapshot.forEach((doc) => {
                allProducts.push({ id: doc.id, ...doc.data() });
            });
            filterAndDisplayProducts(); // Mostrar filtrados (o todos si no hay filtro)
            noProductsMessage.style.display = 'none';
            productsTableContainer.style.display = 'block';
        }
        loadingIndicator.style.display = 'none';

        // Añadir listeners a los botones de acción DESPUÉS de renderizar la tabla
        addTableActionListeners();

    }, (error) => {
        console.error("Error al cargar productos: ", error);
        loadingIndicator.style.display = 'none';
        productsTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">❌ Error al cargar productos: ${error.message}</td></tr>`;
        productsTableContainer.style.display = 'block';
        noProductsMessage.style.display = 'none';
    });
}

// --- Filtrado/Búsqueda ---
function filterAndDisplayProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    productsTbody.innerHTML = ''; // Limpiar tabla

    const filteredProducts = allProducts.filter(product => {
        const nombre = (product.nombre || '').toLowerCase();
        const descripcion = (product.descripcion || '').toLowerCase();
        const material = (product.material || '').toLowerCase();
        const medida = (product.medida || '').toLowerCase();
        // Añadir más campos si se desea buscar en ellos
        return nombre.includes(searchTerm) ||
               descripcion.includes(searchTerm) ||
               material.includes(searchTerm) ||
               medida.includes(searchTerm);
    });

    if (filteredProducts.length === 0) {
        if (allProducts.length > 0) {
            productsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No se encontraron productos que coincidan con "${searchInput.value}".</td></tr>`;
             productsTableContainer.style.display = 'block'; // Mostrar tabla con el mensaje
             noProductsMessage.style.display = 'none';
        } else {
            // Si no hay productos en absoluto
            noProductsMessage.style.display = 'block';
            productsTableContainer.style.display = 'none';
        }
    } else {
        filteredProducts.forEach(renderProductRow);
        noProductsMessage.style.display = 'none';
        productsTableContainer.style.display = 'block';
    }
     // Re-añadir listeners después de filtrar/renderizar
     addTableActionListeners();
}

// --- Listeners para botones de la tabla (delegación de eventos) ---
function addTableActionListeners() {
    productsTbody.querySelectorAll('.edit-button').forEach(button => {
        button.removeEventListener('click', handleEditClick); // Prevenir duplicados
        button.addEventListener('click', handleEditClick);
    });

    productsTbody.querySelectorAll('.delete-button').forEach(button => {
        button.removeEventListener('click', handleDeleteClick); // Prevenir duplicados
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

// --- Funciones para el Modal de Producto ---
function openProductModalForAdd() {
    productForm.reset();
    productIdInput.value = '';
    modalTitle.textContent = '➕ Agregar Nuevo Producto';
    formFeedback.textContent = '';
    formFeedback.style.display = 'none';
    adminPriceControls.style.display = 'none';
    precioVentaInput.disabled = false; // Habilitado para todos al agregar
    saveProductButton.disabled = false;
    saveProductButton.textContent = '💾 Guardar Nuevo';
    productFormModal.style.display = 'block';
    nombreInput.focus(); // Poner foco en el primer campo
}

function openProductModalForEdit(productId) {
    console.log("Abriendo modal para editar:", productId);
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Producto no encontrado para editar:", productId);
        alert("Error: No se pudo encontrar el producto para editar.");
        return;
    }

    productForm.reset();
    productIdInput.value = productId;
    modalTitle.textContent = '✏️ Editar Producto';
    formFeedback.textContent = '';
    formFeedback.style.display = 'none';

    nombreInput.value = product.nombre || '';
    descripcionInput.value = product.descripcion || '';
    materialInput.value = product.material || '';
    medidaInput.value = product.medida || '';
    precioVentaInput.value = product.precioVenta !== undefined ? product.precioVenta : ''; // Manejar caso de precio 0

    if (currentUserRole === 'administrador') {
        precioVentaInput.disabled = false;
        adminPriceControls.style.display = 'block';
        percentageInput.value = '';
    } else { // Data Entry u otro
        precioVentaInput.disabled = true;
        adminPriceControls.style.display = 'none';
    }

    saveProductButton.disabled = false;
    saveProductButton.textContent = '💾 Guardar Cambios';
    productFormModal.style.display = 'block';
    nombreInput.focus();
}

function closeProductModal() {
    productFormModal.style.display = 'none';
    productForm.reset();
    formFeedback.textContent = '';
    formFeedback.style.display = 'none';
    // Limpiar específicamente campos que el reset podría no limpiar bien (depende del navegador)
    productIdInput.value = '';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    saveProductButton.disabled = true;
    saveProductButton.textContent = 'Guardando... 🔄';
    formFeedback.textContent = '';
    formFeedback.style.display = 'none';

    const productId = productIdInput.value;
    const price = parseFloat(precioVentaInput.value);

    // Validaciones
    if (!nombreInput.value.trim()) {
       showFormFeedback("El nombre es obligatorio.", "error");
       saveProductButton.disabled = false;
       saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo';
       return;
    }
    if (isNaN(price) || price < 0) {
        showFormFeedback("El precio debe ser un número válido y no negativo.", "error");
        saveProductButton.disabled = false;
        saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo';
        return;
    }

    let productData = {
        nombre: nombreInput.value.trim(),
        descripcion: descripcionInput.value.trim(),
        material: materialInput.value.trim(),
        medida: medidaInput.value.trim(),
        // Precio se maneja diferente según rol/acción
        fechaModificacion: serverTimestamp()
    };

    try {
        if (productId) {
            // --- Editando Producto Existente ---
            console.log(`Actualizando producto ${productId}...`);
            const productRef = doc(db, "productos", productId);

            // Solo el admin puede cambiar el precio al editar
            if (currentUserRole === 'administrador') {
                 productData.precioVenta = price;
            } else {
                // Data Entry NO puede cambiar el precio al editar.
                // No incluimos precioVenta en productData, así no se actualiza.
                // La regla de Firestore lo protegería de todas formas.
                console.log("Data Entry editando, precio no se modificará.");
            }

            await updateDoc(productRef, productData);
            showFormFeedback("Producto actualizado con éxito.", "success");
            console.log("Producto actualizado:", productId);

        } else {
            // --- Agregando Producto Nuevo ---
            console.log("Agregando nuevo producto...");
            productData.precioVenta = price; // Todos pueden poner precio inicial
            productData.fechaCreacion = serverTimestamp(); // Añadir fecha creación
            const docRef = await addDoc(collection(db, "productos"), productData);
            showFormFeedback("Producto agregado con éxito.", "success");
            console.log("Nuevo producto agregado con ID:", docRef.id);
        }

        setTimeout(closeProductModal, 1500); // Cerrar modal tras éxito

    } catch (error) {
        console.error("Error guardando producto: ", error);
        let userMessage = `Error al guardar: ${error.message}`;
        if (error.code === 'permission-denied') {
             userMessage = "Error: No tienes permiso para realizar esta acción (posiblemente cambiar el precio).";
        }
        showFormFeedback(userMessage, "error");
        saveProductButton.disabled = false; // Reactivar botón en error
        saveProductButton.textContent = productId ? '💾 Guardar Cambios' : '💾 Guardar Nuevo';
    }
}

function showFormFeedback(message, type = "error") {
    formFeedback.textContent = message;
    formFeedback.className = `feedback-message ${type}`;
    formFeedback.style.display = 'block';
}

// --- Ajuste de Precio Individual por Porcentaje (Modal Admin) ---
function adjustPricePercentage(increase) {
    const percentage = parseFloat(percentageInput.value);
    const currentPrice = parseFloat(precioVentaInput.value);

    if (isNaN(percentage) || percentage <= 0) {
        alert("Por favor, introduce un porcentaje válido y positivo.");
        percentageInput.focus();
        return;
    }
    if (isNaN(currentPrice)) {
         alert("El precio actual no es válido para calcular el porcentaje.");
         precioVentaInput.focus();
         return;
    }

    let newPrice;
    if (increase) {
        newPrice = currentPrice * (1 + percentage / 100);
    } else {
        newPrice = currentPrice * (1 - percentage / 100);
    }
    newPrice = Math.max(0, Math.round(newPrice * 100) / 100); // Redondear y evitar negativos

    precioVentaInput.value = newPrice.toFixed(2);
    percentageInput.value = ''; // Limpiar %
    console.log(`Precio ajustado visualmente a ${newPrice.toFixed(2)}`);
    // Recordar: El cambio se guarda al hacer clic en "Guardar Cambios" general.
}

// --- Borrado de Productos ---
function confirmDeleteProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    const productName = product ? product.nombre : 'este producto';

    console.log(`Solicitando confirmación para borrar: ${productName} (ID: ${productId})`);
    if (window.confirm(`❓ ¿Estás seguro de que quieres eliminar "${productName}"?\n\n⚠️ ¡Esta acción no se puede deshacer!`)) {
        console.log("Confirmación aceptada. Borrando...");
        deleteProductFromFirestore(productId);
    } else {
        console.log("Borrado cancelado.");
    }
}

async function deleteProductFromFirestore(productId) {
    console.log(`Intentando eliminar producto ${productId}...`);
    const productRef = doc(db, "productos", productId);
    try {
        await deleteDoc(productRef);
        console.log(`✅ Producto ${productId} eliminado.`);
        // onSnapshot actualizará la tabla automáticamente
        showTemporaryFeedback(`Producto eliminado: ${productName || productId}`, 'success'); // Opcional
    } catch (error) {
        console.error(`❌ Error al eliminar ${productId}: `, error);
        let userMessage = `Error al eliminar: ${error.message}`;
        if (error.code === 'permission-denied') {
             userMessage = "Error: No tienes permiso para eliminar productos.";
        }
        alert(userMessage);
        // showTemporaryFeedback(userMessage, 'error'); // Alternativa no bloqueante
    }
}

// --- Funciones para Actualización Global de Precios (Admin) ---
async function handleGlobalPriceUpdate(increase) {
    const percentage = parseFloat(globalPercentageInput.value);
    if (isNaN(percentage) || percentage === 0) {
        showGlobalFeedback("Introduce un porcentaje válido (distinto de cero).", "error");
        globalPercentageInput.focus();
        return;
    }

    const absPercentage = Math.abs(percentage); // Usar valor absoluto para el mensaje y cálculo
    const actionText = increase ? `AUMENTAR (+${absPercentage}%)` : `BAJAR (-${absPercentage}%)`;
    if (!window.confirm(`❓ ¿Aplicar ${actionText} a TODOS los precios?\n\n⚠️ ¡Acción masiva!`)) {
        showGlobalFeedback("Acción cancelada.", "info");
        return;
    }

    setGlobalControlsDisabled(true);
    showGlobalFeedback(`Procesando ${actionText}... ⏳`, "info");

    try {
        console.log("Obteniendo todos los productos para actualización global...");
        const productosRef = collection(db, "productos");
        const querySnapshot = await getDocs(productosRef); // Usar getDocs para operación única

        if (querySnapshot.empty) {
            showGlobalFeedback("No hay productos para actualizar.", "info");
            setGlobalControlsDisabled(false);
            return;
        }

        console.log(`Se procesarán ${querySnapshot.size} productos.`);
        const batch = writeBatch(db); // Crear batch desde la instancia de db
        let updatedCount = 0;

        querySnapshot.forEach(docSnapshot => { // Cambiado nombre de variable para claridad
            const productData = docSnapshot.data();
            const currentPrice = productData.precioVenta;
            const productId = docSnapshot.id;

            if (typeof currentPrice === 'number' && !isNaN(currentPrice)) {
                let newPrice;
                if (increase) {
                    newPrice = currentPrice * (1 + absPercentage / 100);
                } else {
                    newPrice = currentPrice * (1 - absPercentage / 100);
                }
                newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

                batch.update(docSnapshot.ref, {
                    precioVenta: newPrice,
                    fechaModificacion: serverTimestamp()
                });
                updatedCount++;
                console.log(` - ${productId}: ${currentPrice} -> ${newPrice.toFixed(2)}`);
            } else {
                console.warn(` - ${productId} omitido: precio inválido (${currentPrice}).`);
            }
        });

        if (updatedCount > 0) {
            console.log(`Confirmando batch con ${updatedCount} actualizaciones...`);
            await batch.commit();
            showGlobalFeedback(`✅ ¡${updatedCount} productos actualizados con éxito!`, "success");
            console.log("Batch completado.");
            globalPercentageInput.value = ''; // Limpiar input
        } else {
            showGlobalFeedback("No se encontraron productos con precios válidos.", "info");
        }

    } catch (error) {
        console.error("❌ Error durante la actualización global: ", error);
        let userMessage = `Error en actualización masiva: ${error.message}`;
         if (error.code === 'permission-denied') {
             userMessage = "Error: Permiso denegado para actualizar masivamente.";
        }
        showGlobalFeedback(userMessage, "error");
    } finally {
        setGlobalControlsDisabled(false); // Siempre reactivar controles
    }
}

function showGlobalFeedback(message, type = "info") {
    globalUpdateFeedback.textContent = message;
    globalUpdateFeedback.className = `feedback-message ${type}`;
    globalUpdateFeedback.style.display = 'block';
}

function setGlobalControlsDisabled(disabled) {
    globalPercentageInput.disabled = disabled;
    increaseGlobalButton.disabled = disabled;
    decreaseGlobalButton.disabled = disabled;
    const buttonText = disabled ? "Procesando..." : (increaseGlobalButton.id.includes('increase') ? "📈 Aumentar Global %" : "📉 Bajar Global %");
     if(disabled){
         increaseGlobalButton.textContent = "Procesando...";
         decreaseGlobalButton.textContent = "Procesando...";
     } else {
         increaseGlobalButton.textContent = "📈 Aumentar Global %";
         decreaseGlobalButton.textContent = "📉 Bajar Global %";
     }
}

// --- Función de Feedback Temporal (Opcional) ---
function showTemporaryFeedback(message, type = 'info', duration = 3000) {
    const feedbackElement = document.createElement('div');
    feedbackElement.className = `temporary-feedback ${type}`;
    feedbackElement.textContent = message;
    // Asegurarse de que el body existe antes de añadir
    if(document.body) {
        document.body.appendChild(feedbackElement);
        setTimeout(() => {
            feedbackElement.remove();
        }, duration);
    } else {
        console.warn("Feedback temporal no mostrado: Body no encontrado aún.");
    }
}

// --- Fin del script ---
console.log("Script principal cargado y listeners listos.");
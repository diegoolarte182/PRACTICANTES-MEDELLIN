// Estado global de la aplicación
const state = {
    data: [],           // Datos originales del Excel
    filteredData: [],   // Datos después de aplicar filtros y búsqueda
    currentView: 'table', // 'table' o 'cards'
    currentPage: 1,
    itemsPerPage: 10,
    sortCol: null,
    sortAsc: true,
    filters: {
        programa: '',
        zona: '',
        centro: '',
        estado: '',
        asignacion: ''
    },
    searchQuery: '',
    currentInternId: null // Para el modal de notas
};

// Columnas clave basadas en el requerimiento
const COLUMNS = {
    ID: 'IDENTIFICACIÓN',
    NAME: 'NOMBRES Y APELLIDOS',
    EMAIL: 'CORREO INSTITUCIONAL',
    PHONE: 'CELULAR',
    PROGRAM: 'PROGRAMA',
    ZONE: 'ZONA',
    CENTER: 'CENTRO',
    COURSES: ['CURSO 1', 'CURSO 2', 'CURSO 3', 'CURSO 4', 'CURSO 5'],
    LOCATION: 'UBICACIÓN LUGAR DEL ESCENARIO DE PRÁCTICAS',
    INSTITUTION: 'NOMBRE DE LA INSTITUCIÓN',
    REP: 'NOMBRE DEL REPRESENTANTE LEGAL',
    INST_EMAIL: 'CORREO DE LA INSTITUCIÓN',
    INST_PHONE: 'TELÉFONO DE LA INSTITUCIÓN',
    ASSIGNMENT: 'ASIGNACIÓN POR',
    STATUS: 'OBSERVACIONES Y CONFIRMACIÓN DE ESCENARIO'
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initApp();
});

async function initApp() {
    setupEventListeners();
    await loadExcelData();
}

// Carga de datos
async function loadExcelData() {
    showLoading(true);
    try {
        const response = await fetch('./data/practicantes.xlsx');
        if (!response.ok) throw new Error('Archivo no encontrado');
        
        const arrayBuffer = await response.arrayBuffer();
        processExcelData(arrayBuffer);
    } catch (error) {
        console.error('Error cargando Excel:', error);
        showError(true);
        showLoading(false);
    }
}

function processExcelData(arrayBuffer) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        // Limpiar y normalizar datos
        state.data = rawData.map(row => {
            const cleanRow = {};
            for (const key in row) {
                cleanRow[key.trim()] = row[key];
            }
            return cleanRow;
        });

        state.filteredData = [...state.data];
        
        showError(false);
        initFilters();
        updateUI();
    } catch (error) {
        console.error('Error procesando Excel:', error);
        showError(true);
    } finally {
        showLoading(false);
    }
}

// Event Listeners
function setupEventListeners() {
    // Búsqueda
    document.getElementById('search-input').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        state.currentPage = 1;
        applyFiltersAndSearch();
    });

    // Vistas
    document.getElementById('btn-view-table').addEventListener('click', () => switchView('table'));
    document.getElementById('btn-view-cards').addEventListener('click', () => switchView('cards'));

    // Limpiar filtros
    document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

    // Exportar CSV
    document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

    // Modal de Notas
    document.getElementById('btn-close-modal').addEventListener('click', closeNotesModal);
    document.getElementById('btn-save-notes').addEventListener('click', saveNotes);

    // Subida manual (Fallback)
    document.getElementById('file-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            processExcelData(e.target.result);
        };
        reader.readAsArrayBuffer(file);
    });
}

// Filtros y Búsqueda
function initFilters() {
    const filtersContainer = document.getElementById('filters-container');
    filtersContainer.innerHTML = '';

    const filterConfigs = [
        { id: 'programa', label: 'Programa', col: COLUMNS.PROGRAM },
        { id: 'zona', label: 'Zona', col: COLUMNS.ZONE },
        { id: 'centro', label: 'Centro', col: COLUMNS.CENTER },
        { id: 'estado', label: 'Estado', col: COLUMNS.STATUS },
        { id: 'asignacion', label: 'Asignación', col: COLUMNS.ASSIGNMENT }
    ];

    filterConfigs.forEach(config => {
        // Obtener valores únicos
        const uniqueValues = [...new Set(state.data.map(item => item[config.col]))]
            .filter(val => val !== undefined && val !== '')
            .sort();

        const group = document.createElement('div');
        group.className = 'filter-group';
        
        const label = document.createElement('label');
        label.htmlFor = `filter-${config.id}`;
        label.textContent = config.label;

        const select = document.createElement('select');
        select.id = `filter-${config.id}`;
        select.innerHTML = `<option value="">Todos</option>` + 
            uniqueValues.map(val => `<option value="${val}">${val}</option>`).join('');

        select.addEventListener('change', (e) => {
            state.filters[config.id] = e.target.value;
            state.currentPage = 1;
            applyFiltersAndSearch();
        });

        group.appendChild(label);
        group.appendChild(select);
        filtersContainer.appendChild(group);
    });
}

function applyFiltersAndSearch() {
    state.filteredData = state.data.filter(item => {
        // Filtros exactos
        const matchPrograma = !state.filters.programa || item[COLUMNS.PROGRAM] === state.filters.programa;
        const matchZona = !state.filters.zona || item[COLUMNS.ZONE] === state.filters.zona;
        const matchCentro = !state.filters.centro || item[COLUMNS.CENTER] === state.filters.centro;
        const matchEstado = !state.filters.estado || item[COLUMNS.STATUS] === state.filters.estado;
        const matchAsignacion = !state.filters.asignacion || item[COLUMNS.ASSIGNMENT] === state.filters.asignacion;

        // Búsqueda general
        let matchSearch = true;
        if (state.searchQuery) {
            const searchableText = [
                item[COLUMNS.NAME],
                item[COLUMNS.ID],
                item[COLUMNS.EMAIL],
                item[COLUMNS.INSTITUTION],
                item[COLUMNS.REP]
            ].join(' ').toLowerCase();
            
            matchSearch = searchableText.includes(state.searchQuery);
        }

        return matchPrograma && matchZona && matchCentro && matchEstado && matchAsignacion && matchSearch;
    });

    sortData();
    updateUI();
}

function clearFilters() {
    state.filters = { programa: '', zona: '', centro: '', estado: '', asignacion: '' };
    state.searchQuery = '';
    state.sortCol = null;
    
    document.getElementById('search-input').value = '';
    document.querySelectorAll('.filter-group select').forEach(select => select.value = '');
    
    state.currentPage = 1;
    applyFiltersAndSearch();
}

// Ordenamiento
function handleSort(column) {
    if (state.sortCol === column) {
        state.sortAsc = !state.sortAsc;
    } else {
        state.sortCol = column;
        state.sortAsc = true;
    }
    sortData();
    updateUI();
}

function sortData() {
    if (!state.sortCol) return;

    state.filteredData.sort((a, b) => {
        let valA = a[state.sortCol] || '';
        let valB = b[state.sortCol] || '';
        
        // Intentar orden numérico si aplica
        if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
            valA = Number(valA);
            valB = Number(valB);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return state.sortAsc ? -1 : 1;
        if (valA > valB) return state.sortAsc ? 1 : -1;
        return 0;
    });
}

// UI Updates
function updateUI() {
    updateMetrics();
    renderContent();
    renderPagination();
    lucide.createIcons();
}

function updateMetrics() {
    const container = document.getElementById('metrics-container');
    
    const total = state.filteredData.length;
    
    // Buscar confirmados (asumiendo que la columna estado contiene la palabra "confirmado" o similar)
    const confirmados = state.filteredData.filter(item => {
        const status = String(item[COLUMNS.STATUS] || '').toLowerCase();
        return status.includes('confirmado') || status.includes('aprobado') || status.includes('si');
    }).length;

    const zonasUnicas = new Set(state.filteredData.map(item => item[COLUMNS.ZONE]).filter(Boolean)).size;
    const centrosUnicos = new Set(state.filteredData.map(item => item[COLUMNS.CENTER]).filter(Boolean)).size;

    container.innerHTML = `
        <div class="metric-card">
            <span class="metric-title">Total Practicantes</span>
            <span class="metric-value">${total}</span>
        </div>
        <div class="metric-card">
            <span class="metric-title">Confirmados</span>
            <span class="metric-value">${confirmados}</span>
        </div>
        <div class="metric-card">
            <span class="metric-title">Zonas</span>
            <span class="metric-value">${zonasUnicas}</span>
        </div>
        <div class="metric-card">
            <span class="metric-title">Centros</span>
            <span class="metric-value">${centrosUnicos}</span>
        </div>
    `;
}

function switchView(view) {
    state.currentView = view;
    
    document.getElementById('btn-view-table').classList.toggle('active', view === 'table');
    document.getElementById('btn-view-cards').classList.toggle('active', view === 'cards');
    
    document.getElementById('table-view').classList.toggle('hidden', view !== 'table');
    document.getElementById('cards-view').classList.toggle('hidden', view !== 'cards');
    
    renderContent();
}

function renderContent() {
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const pageData = state.filteredData.slice(start, end);

    if (state.currentView === 'table') {
        renderTable(pageData);
    } else {
        renderCards(pageData);
    }
}

function getStatusClass(statusText) {
    const text = String(statusText || '').toLowerCase();
    if (text.includes('confirmado') || text.includes('aprobado') || text.includes('si')) return 'status-confirmed';
    if (text.includes('pendiente') || text.includes('proceso') || text.includes('no')) return 'status-pending';
    return 'status-default';
}

function renderTable(data) {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    
    const columnsToShow = [
        { key: COLUMNS.ID, label: 'ID' },
        { key: COLUMNS.NAME, label: 'Nombre' },
        { key: COLUMNS.PROGRAM, label: 'Programa' },
        { key: COLUMNS.CENTER, label: 'Centro' },
        { key: COLUMNS.INSTITUTION, label: 'Institución' },
        { key: COLUMNS.STATUS, label: 'Estado' },
        { key: 'actions', label: 'Acciones' }
    ];

    // Render Headers
    thead.innerHTML = columnsToShow.map(col => {
        if (col.key === 'actions') return `<th>${col.label}</th>`;
        
        let sortIcon = '<i data-lucide="arrow-up-down" class="sort-icon"></i>';
        let thClass = '';
        
        if (state.sortCol === col.key) {
            sortIcon = state.sortAsc ? '<i data-lucide="arrow-up" class="sort-icon"></i>' : '<i data-lucide="arrow-down" class="sort-icon"></i>';
            thClass = state.sortAsc ? 'sort-asc' : 'sort-desc';
        }
        
        return `<th class="${thClass}" onclick="handleSort('${col.key}')">${col.label} ${sortIcon}</th>`;
    }).join('');

    // Render Body
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columnsToShow.length}" style="text-align: center; padding: 2rem;">No se encontraron resultados</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(row => {
        const id = row[COLUMNS.ID] || Math.random().toString(36).substr(2, 9);
        const hasNotes = localStorage.getItem(`notes_${id}`);
        const notesIcon = hasNotes ? 'file-text' : 'file-edit';
        const notesColor = hasNotes ? 'var(--primary-color)' : 'inherit';

        return `
            <tr>
                <td>${row[COLUMNS.ID] || '-'}</td>
                <td style="font-weight: 500;">${row[COLUMNS.NAME] || '-'}</td>
                <td>${row[COLUMNS.PROGRAM] || '-'}</td>
                <td>${row[COLUMNS.CENTER] || '-'}</td>
                <td>${row[COLUMNS.INSTITUTION] || '-'}</td>
                <td><span class="status-tag ${getStatusClass(row[COLUMNS.STATUS])}">${row[COLUMNS.STATUS] || 'Sin estado'}</span></td>
                <td>
                    <button class="btn-icon" onclick="openNotesModal('${id}', '${row[COLUMNS.NAME]}')" title="Notas" style="color: ${notesColor}">
                        <i data-lucide="${notesIcon}"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

function renderCards(data) {
    const container = document.getElementById('cards-container');
    
    if (data.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">No se encontraron resultados</div>`;
        return;
    }

    container.innerHTML = data.map(row => {
        const id = row[COLUMNS.ID] || Math.random().toString(36).substr(2, 9);
        const hasNotes = localStorage.getItem(`notes_${id}`);
        
        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${row[COLUMNS.NAME] || 'Sin Nombre'}</div>
                        <div class="card-subtitle">${row[COLUMNS.ID] || 'Sin ID'} • ${row[COLUMNS.PROGRAM] || '-'}</div>
                    </div>
                    <span class="status-tag ${getStatusClass(row[COLUMNS.STATUS])}">${row[COLUMNS.STATUS] || 'Sin estado'}</span>
                </div>
                <div class="card-body">
                    <div class="card-field">
                        <span class="card-label">Institución</span>
                        <span>${row[COLUMNS.INSTITUTION] || '-'}</span>
                    </div>
                    <div class="card-field">
                        <span class="card-label">Centro / Zona</span>
                        <span>${row[COLUMNS.CENTER] || '-'} / ${row[COLUMNS.ZONE] || '-'}</span>
                    </div>
                    <div class="card-field">
                        <span class="card-label">Contacto</span>
                        <span>${row[COLUMNS.EMAIL] || '-'} <br> ${row[COLUMNS.PHONE] || '-'}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-secondary" onclick="openNotesModal('${id}', '${row[COLUMNS.NAME]}')">
                        <i data-lucide="${hasNotes ? 'file-text' : 'file-edit'}"></i> ${hasNotes ? 'Ver Notas' : 'Agregar Notas'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

function renderPagination() {
    const container = document.getElementById('pagination-container');
    const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${state.currentPage - 1})"><i data-lucide="chevron-left"></i></button>`;
    
    // Lógica simple para mostrar páginas (se puede mejorar para muchos números)
    let startPage = Math.max(1, state.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span style="color: var(--text-muted)">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="color: var(--text-muted)">...</span>`;
        html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" ${state.currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${state.currentPage + 1})"><i data-lucide="chevron-right"></i></button>`;
    
    container.innerHTML = html;
    lucide.createIcons();
}

// Funciones globales para eventos inline
window.changePage = (page) => {
    state.currentPage = page;
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.handleSort = handleSort;

// Notas (LocalStorage)
window.openNotesModal = (id, name) => {
    state.currentInternId = id;
    document.getElementById('modal-title').textContent = `Notas: ${name}`;
    document.getElementById('notes-textarea').value = localStorage.getItem(`notes_${id}`) || '';
    document.getElementById('notes-modal').classList.remove('hidden');
};

function closeNotesModal() {
    document.getElementById('notes-modal').classList.add('hidden');
    state.currentInternId = null;
}

function saveNotes() {
    if (!state.currentInternId) return;
    const notes = document.getElementById('notes-textarea').value.trim();
    
    if (notes) {
        localStorage.setItem(`notes_${state.currentInternId}`, notes);
    } else {
        localStorage.removeItem(`notes_${state.currentInternId}`);
    }
    
    closeNotesModal();
    renderContent(); // Para actualizar el icono
}

// Exportar CSV
function exportToCSV() {
    if (state.filteredData.length === 0) return;

    // Obtener todas las claves únicas de los datos filtrados
    const keys = Object.keys(state.filteredData[0]);
    
    const csvContent = [
        keys.join(','), // Cabeceras
        ...state.filteredData.map(row => {
            return keys.map(k => {
                let cell = row[k] === null || row[k] === undefined ? '' : String(row[k]);
                // Escapar comillas y envolver en comillas si hay comas
                cell = cell.replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(',');
        })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `practicantes_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Utilidades UI
function showLoading(show) {
    document.getElementById('loading-indicator').classList.toggle('hidden', !show);
    if (show) {
        document.getElementById('content-area').classList.add('hidden');
        document.getElementById('error-message').classList.add('hidden');
    }
}

function showError(show) {
    document.getElementById('error-message').classList.toggle('hidden', !show);
    if (!show) {
        document.getElementById('content-area').classList.remove('hidden');
    }
}

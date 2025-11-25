 // --- 1. CONFIGURACIÓN Y VARIABLES GLOBALES ---

        /** * =====================================================================
         * ¡IMPORTANTE! URL DE LA APLICACIÓN WEB DE GOOGLE APPS SCRIPT
         * * REEMPLAZA el siguiente placeholder con la URL que obtuviste 
         * * en el Paso 1.4 de la guía.
         * =====================================================================
         */
        //const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxhZHiDn6_DPUIZocP5c9iQTNGTuKn_Sx0mDGx6izvzw-EiPT3hLwjbSMb-ooxE2KCY/exec";
		const GOOGLE_SHEETS_API_URL = "https://golf-tracker-api.vercel.app/api/golf";
									   
	
        // Variables locales para simular el entorno de Firebase
        let userId = localStorage.getItem('golf_user_id') || `user_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('golf_user_id', userId); // Persistir el ID generado

        let historyData = []; // Almacena todas las partidas cargadas
        let editingGameId = null; // ID de la partida en modo edición

        const HOLES_COUNT = 18;

        // Referencias a elementos del DOM
        const DOMElements = {
            authStatus: document.getElementById('auth-status'),
            userIdDisplay: document.getElementById('user-id-display'),
            errorMessage: document.getElementById('error-message'),
            scoreTableBody: document.getElementById('score-table-body'),
            totalStrokes: document.getElementById('total-strokes'),
            totalHCP: document.getElementById('total-hcp'),
            totalSCH: document.getElementById('total-sch'),
            gameIdEdit: document.getElementById('game-id-edit'),
            entryTitle: document.getElementById('entry-title'),
            saveGameBtn: document.getElementById('save-game-btn'),
            historyList: document.getElementById('history-list'),
            courseName: document.getElementById('course-name'),
            handicapTotal: document.getElementById('handicap-total'),
            globalStats: document.getElementById('global-stats')
        };


        // --- 2. CLASE PRINCIPAL DE LA APLICACIÓN ---

        const APP = {
            
            /** Inicializa la UI */
            async initialize() {
                if (GOOGLE_SHEETS_API_URL.includes('REEMPLAZA_CON_TU_APPS_SCRIPT_URL_AQUI')) {
                    return APP.displayError("ERROR: Debes reemplazar 'REEMPLAZA_CON_TU_APPS_SCRIPT_URL_AQUI' en el script con la URL que obtuviste de Google Apps Script.");
                }
                
                // Actualizar estado de usuario
                DOMElements.userIdDisplay.textContent = `ID de Usuario: ${userId}`;
                
                // Inicializar la tabla y cargar datos
                APP.renderHoleInputs();
                APP.listenForGames(); 
            },

            /** Muestra mensajes de error en la UI */
            displayError(message) {
                console.error(message);
                DOMElements.errorMessage.textContent = `Error: ${message}`;
                DOMElements.errorMessage.classList.remove('hidden');
            },

            /** Cambia la vista activa */
            switchView(viewId) {
                document.querySelectorAll('.view').forEach(view => {
                    view.style.display = 'none';
                });
                document.getElementById(viewId).style.display = 'block';

                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.remove('bg-green-700', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-800');
                    if (btn.getAttribute('onclick').includes(viewId)) {
                        btn.classList.add('bg-green-700', 'text-white');
                        btn.classList.remove('bg-gray-200', 'text-gray-800');
                    }
                });

                // Cargar estadísticas si se cambia a la vista de estadísticas
                if (viewId === 'stats' && historyData.length > 0) {
                    APP.calculateGlobalStats(historyData);
                }
            },

            // --- 3. LÓGICA DE PUNTUACIÓN (SIN CAMBIOS) ---

            /**
             * Calcula los puntos HCP y SCH para un hoyo.
             * @param {number} par Par del hoyo.
             * @param {number} stars Estrellas (solo para HCP).
             * @param {number} strokes Golpes reales.
             * @returns {{hcp: number, sch: number}} Puntos calculados.
             */
            calculatePoints(par, stars, strokes) {
                if (strokes <= 0 || isNaN(par) || isNaN(stars) || isNaN(strokes)) {
                    return { hcp: 0, sch: 0 };
                }

                // CÁLCULO HCP
                const targetHCP = par + stars;
                const strokesDiffHCP = targetHCP - strokes;
                // Fórmula: Math.max(0, 2 + Diferencia)
                const hcpPoints = Math.max(0, 2 + strokesDiffHCP);

                // CÁLCULO SCRATCH (ignora estrellas, Target = Par)
                const targetSCH = par;
                const strokesDiffSCH = targetSCH - strokes;
                // Fórmula: Math.max(0, 2 + Diferencia)
                const schPoints = Math.max(0, 2 + strokesDiffSCH);

                return { hcp: hcpPoints, sch: schPoints };
            },

            // --- 4. MANEJO DE LA UI DE ENTRADA DE DATOS (SIN CAMBIOS SIGNIFICATIVOS) ---

            /** Genera las 18 filas de la tabla de hoyos */
            renderHoleInputs() {
                DOMElements.scoreTableBody.innerHTML = '';
                const defaultPar = [4, 4, 3, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 4, 5]; // Un set de Par estándar
                
                for (let i = 1; i <= HOLES_COUNT; i++) {
                    const row = DOMElements.scoreTableBody.insertRow();
                    row.id = `hole-row-${i}`;
                    row.classList.add('hover:bg-gray-50');

                    // 1. Hoyo
                    row.insertCell().textContent = i;
                    
                    // 2. Par
                    row.insertCell().innerHTML = `<input type="number" data-hole="${i}" data-type="par" class="hole-input par-input" min="1" value="${defaultPar[i-1] || 4}" oninput="APP.updateHoleScore(${i})">`;
                    
                    // 3. Estrellas
                    row.insertCell().innerHTML = `<input type="number" data-hole="${i}" data-type="stars" class="hole-input stars-input" min="0" value="0" oninput="APP.updateHoleScore(${i})">`;
                    
                    // 4. Golpes Reales
                    row.insertCell().innerHTML = `<input type="number" data-hole="${i}" data-type="strokes" class="hole-input strokes-input bg-yellow-50" min="1" value="" oninput="APP.updateHoleScore(${i})">`;
                    
                    // 5. Puntos HCP (Salida)
                    const hcpCell = row.insertCell();
                    hcpCell.id = `hcp-score-${i}`;
                    hcpCell.className = 'hcp-score px-3 py-2';
                    hcpCell.textContent = '0';

                    // 6. Puntos SCH (Salida)
                    const schCell = row.insertCell();
                    schCell.id = `sch-score-${i}`;
                    schCell.className = 'sch-score px-3 py-2';
                    schCell.textContent = '0';
                }
                APP.updateTotals();
            },

            /** Carga una partida guardada en el formulario de edición */
            loadGameForEditing(game) {
                editingGameId = game.id;
                DOMElements.entryTitle.textContent = `Editando Partida: ${game.courseName}`;
                DOMElements.saveGameBtn.textContent = 'Sobrescribir Partida';
                DOMElements.gameIdEdit.value = game.id;
                DOMElements.courseName.value = game.courseName || '';
                DOMElements.handicapTotal.value = game.handicapTotal || 0;

                // game.holes ahora se llama game.holesData en la hoja de cálculo
                const holes = game.holes || []; 

                holes.forEach((hole, index) => {
                    const i = index + 1;
                    // Es crucial que 'holes' sea un array de objetos con las propiedades correctas
                    document.querySelector(`#hole-row-${i} input[data-type="par"]`).value = hole.par || 4;
                    document.querySelector(`#hole-row-${i} input[data-type="stars"]`).value = hole.stars || 0;
                    document.querySelector(`#hole-row-${i} input[data-type="strokes"]`).value = hole.strokes || '';
                    
                    // Actualizar las celdas de puntaje con los valores guardados
                    document.getElementById(`hcp-score-${i}`).textContent = hole.hcpPoints || 0;
                    document.getElementById(`sch-score-${i}`).textContent = hole.schPoints || 0;
                });

                APP.updateTotals();
                APP.switchView('game-entry');
            },
            
            /** Actualiza el puntaje de un hoyo individual y recalcula totales */
            updateHoleScore(holeNumber) {
                const parInput = document.querySelector(`#hole-row-${holeNumber} input[data-type="par"]`);
                const starsInput = document.querySelector(`#hole-row-${holeNumber} input[data-type="stars"]`);
                const strokesInput = document.querySelector(`#hole-row-${holeNumber} input[data-type="strokes"]`);

                const par = parseInt(parInput.value) || 0;
                const stars = parseInt(starsInput.value) || 0;
                const strokes = parseInt(strokesInput.value) || 0;

                const { hcp, sch } = APP.calculatePoints(par, stars, strokes);

                document.getElementById(`hcp-score-${holeNumber}`).textContent = hcp;
                document.getElementById(`sch-score-${holeNumber}`).textContent = sch;
                
                APP.updateTotals();
            },

            /** Recalcula y muestra los totales de la partida */
            updateTotals() {
                let totalStrokes = 0;
                let totalHCP = 0;
                let totalSCH = 0;

                for (let i = 1; i <= HOLES_COUNT; i++) {
                    const strokesInput = document.querySelector(`#hole-row-${i} input[data-type="strokes"]`);
                    const strokes = parseInt(strokesInput.value) || 0;
                    totalStrokes += strokes;
                    
                    totalHCP += parseInt(document.getElementById(`hcp-score-${i}`).textContent) || 0;
                    totalSCH += parseInt(document.getElementById(`sch-score-${i}`).textContent) || 0;
                }

                DOMElements.totalStrokes.textContent = totalStrokes;
                DOMElements.totalHCP.textContent = totalHCP;
                DOMElements.totalSCH.textContent = totalSCH;
            },

            /** Limpia el formulario y lo pone en modo "Nueva Partida" */
            resetForm() {
                editingGameId = null;
                DOMElements.entryTitle.textContent = 'Nueva Partida de 18 Hoyos';
                DOMElements.saveGameBtn.textContent = 'Guardar Partida';
                DOMElements.gameIdEdit.value = 'NUEVA';
                DOMElements.courseName.value = 'Mi Campo Favorito';
                DOMElements.handicapTotal.value = 20;

                // Reiniciar los campos de hoyo
                for (let i = 1; i <= HOLES_COUNT; i++) {
                    // Mantener Par, limpiar estrellas y golpes
                    document.querySelector(`#hole-row-${i} input[data-type="stars"]`).value = 0;
                    document.querySelector(`#hole-row-${i} input[data-type="strokes"]`).value = '';
                }
                
                // Forzar la actualización de totales para limpiar los displays
                APP.renderHoleInputs();
            },

            // --- 5. PERSISTENCIA DE DATOS (GOOGLE SHEETS VIA APPS SCRIPT) ---

            /** Envía una petición POST a Apps Script para guardar/editar/eliminar */
            /** Envía una petición a Vercel Proxy (que sí permite CORS) */
			async sendApiRequest(action, data) {
				try {
					const response = await fetch(GOOGLE_SHEETS_API_URL, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action, data })
					});

					const text = await response.text();

					let json;
					try {
						json = JSON.parse(text);
					} catch {
						throw new Error("Respuesta inválida del servidor: " + text);
					}

					if (json.error) {
						throw new Error(json.error);
					}

					return json;

				} catch (e) {
					APP.displayError("Error de comunicación (proxy): " + e.message);
					throw e;
				}
			},




            /** Extrae los datos del formulario y los prepara para guardar */
            getGameData() {
                const holes = [];
                for (let i = 1; i <= HOLES_COUNT; i++) {
                    const par = parseInt(document.querySelector(`#hole-row-${i} input[data-type="par"]`).value) || 0;
                    const stars = parseInt(document.querySelector(`#hole-row-${i} input[data-type="stars"]`).value) || 0;
                    const strokes = parseInt(document.querySelector(`#hole-row-${i} input[data-type="strokes"]`).value) || 0;
                    const hcpPoints = parseInt(document.getElementById(`hcp-score-${i}`).textContent) || 0;
                    const schPoints = parseInt(document.getElementById(`sch-score-${i}`).textContent) || 0;

                    holes.push({ par, stars, strokes, hcpPoints, schPoints, hole: i });
                }

                const totalHCP = parseInt(DOMElements.totalHCP.textContent) || 0;
                const totalSCH = parseInt(DOMElements.totalSCH.textContent) || 0;
                const totalStrokes = parseInt(DOMElements.totalStrokes.textContent) || 0;

                return {
                    id: editingGameId, // El ID solo se usa en modo edición
                    courseName: DOMElements.courseName.value.trim() || 'Partida sin nombre',
                    handicapTotal: parseInt(DOMElements.handicapTotal.value) || 0,
                    scoreHCP: totalHCP,
                    scoreSCH: totalSCH,
                    totalStrokes: totalStrokes,
                    createdBy: userId,
                    holes: holes // Apps Script serializará esto a JSON en la columna 'holesData'
                };
            },

            /** Guarda o sobrescribe la partida */
            async saveGame() {
                
                // Validación básica de golpes
                const totalStrokes = parseInt(DOMElements.totalStrokes.textContent) || 0;
                if (totalStrokes === 0) {
                     return alertMessage('Introduce los golpes reales en al menos un hoyo.', 'bg-yellow-500');
                }

                const gameData = APP.getGameData();
                DOMElements.saveGameBtn.textContent = 'Guardando...';
                DOMElements.saveGameBtn.disabled = true;

                try {
                    const action = editingGameId ? 'save' : 'save'; // El script maneja la lógica de save/update
                    await APP.sendApiRequest(action, gameData);
                    
                    alertMessage(editingGameId ? 'Partida actualizada con éxito.' : 'Partida guardada con éxito.', 'bg-green-600');
                    
                    APP.resetForm();
                    APP.listenForGames(); // Recargar datos tras guardar
                    APP.switchView('history'); // Ir al historial tras guardar
                } catch (e) {
                    // El error ya se muestra en displayError dentro de sendApiRequest
                    alertMessage('Error al guardar la partida. Revisa la consola y tu Apps Script.', 'bg-red-500');
                } finally {
                    DOMElements.saveGameBtn.textContent = editingGameId ? 'Sobrescribir Partida' : 'Guardar Partida';
                    DOMElements.saveGameBtn.disabled = false;
                }
            },

            /** Elimina una partida de Google Sheets */
            async deleteGame(gameId) {
                // Usar modal simple en lugar de confirm()
                const confirmed = await new Promise(resolve => {
                    const modal = document.createElement('div');
                    modal.innerHTML = `
                        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div class="card p-6 w-full max-w-sm">
                                <p class="font-bold mb-4">Confirmación</p>
                                <p class="mb-6">¿Estás seguro de que quieres eliminar esta partida?</p>
                                <div class="flex justify-end space-x-3">
                                    <button class="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100" onclick="document.body.removeChild(this.closest('.fixed')); resolve(false);">Cancelar</button>
                                    <button class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" onclick="document.body.removeChild(this.closest('.fixed')); resolve(true);">Eliminar</button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                });

                if (!confirmed) return;
                
                try {
                    await APP.sendApiRequest('delete', { id: gameId });
                    alertMessage('Partida eliminada.', 'bg-red-500');
                    APP.listenForGames(); // Recargar datos tras eliminar
                } catch (e) {
                    // El error ya se muestra en displayError dentro de sendApiRequest
                    alertMessage('Error al eliminar la partida. Revisa la consola y tu Apps Script.', 'bg-red-500');
                }
            },

            /** Obtiene los datos de la colección de partidas (Simula onSnapshot) */
            async listenForGames() {
                DOMElements.historyList.innerHTML = '<p class="text-gray-500 text-center py-8">Cargando historial...</p>';
                
                try {
                    // El Apps Script usa doGet() para obtener todos los datos
                   const response = await fetch(GOOGLE_SHEETS_API_URL);
                    
                    if (!response.ok) {
                        throw new Error(`Error al cargar: ${response.status} ${response.statusText}`);
                    }
                    
                    const text = await response.text();
					const games = JSON.parse(text);
                    
                    // Asumiendo que `games` es el array de datos
                    if (games.error) {
                        throw new Error(games.error);
                    }

                    historyData = games;
                    
                    // Ordenar por fecha (el timestamp es una cadena de fecha)
                    historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    APP.renderHistoryList();
                    // Recalcular estadísticas cada vez que los datos cambian
                    if (document.getElementById('stats').style.display !== 'none') {
                         APP.calculateGlobalStats(historyData);
                    }

                } catch (error) {
                    APP.displayError(`Error al cargar el historial: ${error.message}`);
                    DOMElements.historyList.innerHTML = `<p class="text-red-500 p-4">Error al cargar datos. Asegúrate de que tu URL es correcta y el Apps Script está desplegado. ${error.message}</p>`;
                }
            },

            // --- 6. MANEJO DE LA VISTA DE HISTORIAL (CAMBIO EN EL MANEJO DE FECHAS) ---

            /** Renderiza la lista de partidas en la vista de Historial */
            renderHistoryList() {
                if (historyData.length === 0) {
                    DOMElements.historyList.innerHTML = '<p class="text-gray-500 text-center py-8">No hay partidas guardadas.</p>';
                    return;
                }

                DOMElements.historyList.innerHTML = historyData.map(game => {
                    // El timestamp ahora es una cadena de fecha estándar (ej. "Mon Oct 09 2023 11:30:00 GMT-0600 (Mountain Daylight Time)")
                    let dateStr = 'Fecha N/A';
                    try {
                        dateStr = new Date(game.timestamp).toLocaleDateString('es-ES', { timeZone: 'UTC' });
                    } catch (e) {
                        // Ignorar error y usar valor N/A
                    }
                    
                    return `
                        <div class="p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                            <!-- Info Principal -->
                            <div class="md:col-span-2">
                                <h3 class="text-lg font-bold text-gray-800">${game.courseName}</h3>
                                <p class="text-sm text-gray-500">Hándicap de Juego: ${game.handicapTotal}</p>
                                <p class="text-xs text-gray-400">Guardado el: ${dateStr}</p>
                            </div>
                            <!-- Puntuaciones -->
                            <div class="flex flex-col space-y-1">
                                <span class="score-box hcp-box">HCP: ${game.scoreHCP} pts</span>
                                <span class="score-box sch-box">SCH: ${game.scoreSCH} pts</span>
                                <span class="score-box bg-gray-100 text-gray-700">Golpes: ${game.totalStrokes}</span>
                            </div>
                            <!-- Acciones -->
                            <div class="flex space-x-2 mt-2 md:mt-0 justify-end">
                                <button onclick="APP.editGame('${game.id}')" class="p-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                                    Editar
                                </button>
                                <button onclick="APP.deleteGame('${game.id}')" class="p-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            },

            /** Busca una partida por ID y la carga para edición */
            editGame(gameId) {
                const game = historyData.find(g => g.id === gameId);
                if (game) {
                    APP.loadGameForEditing(game);
                } else {
                    alertMessage('Partida no encontrada.', 'bg-red-500');
                }
            },

            // --- 7. LÓGICA DE ESTADÍSTICAS (CAMBIO EN EL MANEJO DE FECHAS) ---

            /** Calcula y renderiza las estadísticas globales */
            calculateGlobalStats(data) {
                if (data.length === 0) {
                    document.querySelectorAll('#global-stats p.text-2xl').forEach(el => el.textContent = '0');
                    document.getElementById('stat-best-hcp').textContent = 'N/A';
                    document.getElementById('stat-best-sch').textContent = 'N/A';
                    document.getElementById('stats-chart-placeholder').textContent = "No hay datos suficientes para generar estadísticas.";
                    return;
                }

                const totalGames = data.length;
                const totalHCP = data.reduce((sum, g) => sum + g.scoreHCP, 0);
                const totalSCH = data.reduce((sum, g) => sum + g.scoreSCH, 0);

                const avgHCP = (totalHCP / totalGames).toFixed(1);
                const avgSCH = (totalSCH / totalGames).toFixed(1);
                
                // Mejor Partida (Puntuación más alta)
                const bestHCP = data.reduce((best, current) => current.scoreHCP > best.scoreHCP ? current : best, { scoreHCP: -1 });
                const bestSCH = data.reduce((best, current) => current.scoreSCH > best.scoreSCH ? current : best, { scoreSCH: -1 });

                // Renderizar Estadísticas
                document.getElementById('stat-total-games').textContent = totalGames;
                document.getElementById('stat-avg-hcp').textContent = avgHCP;
                document.getElementById('stat-avg-sch').textContent = avgSCH;
                
                document.getElementById('stat-best-hcp').innerHTML = `
                    ${bestHCP.scoreHCP} pts en ${bestHCP.courseName}
                    <span class="text-xs text-gray-500"> (HCP ${bestHCP.handicapTotal})</span>
                `;
                document.getElementById('stat-best-sch').innerHTML = `
                    ${bestSCH.scoreSCH} pts en ${bestSCH.courseName}
                    <span class="text-xs text-gray-500"> (HCP ${bestSCH.handicapTotal})</span>
                `;
                
                // Renderizar Gráfica Simple (Representación de evolución)
                APP.renderSimpleChart(data);
            },

            /** Genera una gráfica de texto/HTML simple para la evolución */
            renderSimpleChart(data) {
                const chartContainer = document.getElementById('stats-chart-placeholder');
                chartContainer.innerHTML = '';
                chartContainer.classList.remove('h-64', 'flex', 'items-center', 'justify-center');

                const lastGames = data.slice(0, 10).reverse(); // Últimas 10 partidas
                if (lastGames.length < 2) {
                    chartContainer.textContent = "Necesitas al menos 2 partidas para mostrar la evolución.";
                    chartContainer.classList.add('h-64', 'flex', 'items-center', 'justify-center');
                    return;
                }

                // Normalización para visualización (solo en el rango de los datos)
                const allScores = [...lastGames.map(g => g.scoreHCP), ...lastGames.map(g => g.scoreSCH)];
                const minScore = Math.min(...allScores) * 0.95; 
                const maxScore = Math.max(...allScores) * 1.05; 
                const range = maxScore - minScore;

                const chartWidth = 100 / lastGames.length;

                const chartHtml = lastGames.map((game, index) => {
                    const hcpHeight = ((game.scoreHCP - minScore) / range) * 90 + 5; // 5% min height
                    const schHeight = ((game.scoreSCH - minScore) / range) * 90 + 5;
                    
                    let date = 'N/A';
                    try {
                        // El timestamp viene como una cadena de texto desde Apps Script
                        date = new Date(game.timestamp).toLocaleDateString('es-ES');
                    } catch (e) {
                         date = 'N/A';
                    }
                    
                    return `
                        <div style="width: ${chartWidth}%; position: relative; display: flex; flex-direction: column; align-items: center; justify-end; height: 100%; border-left: 1px dotted #ccc; padding-top: 10px;">
                            <!-- Barra SCH (Azul) -->
                            <div title="SCH: ${game.scoreSCH} (${game.courseName})" 
                                 style="height: ${schHeight}%; background-color: #3b82f6; width: 40%; border-radius: 4px 4px 0 0; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); opacity: 0.7;">
                            </div>
                            <!-- Barra HCP (Verde) -->
                            <div title="HCP: ${game.scoreHCP} (${game.courseName})" 
                                 style="height: ${hcpHeight}%; background-color: #10b981; width: 40%; border-radius: 4px 4px 0 0; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) translate(50%, 0); margin-left: -25%;">
                            </div>
                            <span class="absolute -bottom-6 text-xs text-gray-600 rotate-45 transform origin-top-left">${date}</span>
                        </div>
                    `;
                }).join('');

                chartContainer.innerHTML = `
                    <div class="h-full w-full relative pt-8 pb-10">
                        <div class="absolute top-0 left-0 right-0 p-2 flex justify-end space-x-4 text-xs font-semibold">
                            <span class="flex items-center text-green-700"><div class="w-2 h-2 bg-green-500 rounded-full mr-1"></div> Puntos HCP</span>
                            <span class="flex items-center text-blue-700"><div class="w-2 h-2 bg-blue-500 rounded-full mr-1"></div> Puntos SCH</span>
                        </div>
                        <div class="flex items-end h-full border-l border-b border-gray-300" style="align-items: flex-end;">
                            ${chartHtml}
                        </div>
                        <div class="text-xs text-gray-500 absolute left-0 bottom-4">0 pts</div>
                        <div class="text-xs text-gray-500 absolute left-0 top-0">${Math.round(maxScore)} pts</div>
                    </div>
                `;
                chartContainer.classList.add('p-0'); // Remover padding extra de la card
            }
        };

        // Función auxiliar para mostrar notificaciones simples (en lugar de alert() o confirm())
        function alertMessage(message, bgColor) {
            const tempDiv = document.createElement('div');
            tempDiv.textContent = message;
            tempDiv.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white font-semibold shadow-xl ${bgColor}`;
            document.body.appendChild(tempDiv);
            setTimeout(() => {
                tempDiv.remove();
            }, 3000);
        }

        // Exponer la clase APP al ámbito global para los eventos onclick
        window.APP = APP;

        // Inicia la aplicación al cargar la ventana
        window.onload = APP.initialize;
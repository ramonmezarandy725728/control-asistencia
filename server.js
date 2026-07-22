const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- CONEXIÓN A SQLITE ---
const db = new sqlite3.Database('./asistencia.db', (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Conectado exitosamente a la base de datos SQLite.');
    }
});

// --- ESTRUCTURA DE TABLAS ---
db.serialize(() => {
    // 1. Tabla Personal
    db.run(`CREATE TABLE IF NOT EXISTS personal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        grado TEXT,
        cargo TEXT,
        skills TEXT
    )`);

    // Intentar agregar la columna 'grado' si la tabla ya existía sin ella
    db.run(`ALTER TABLE personal ADD COLUMN grado TEXT`, (err) => {
        // Ignorar error si la columna ya existe
    });

    // 2. Tabla Condiciones
    db.run(`CREATE TABLE IF NOT EXISTS condiciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
    )`);

    db.run(`INSERT OR IGNORE INTO condiciones (id, nombre) VALUES 
        (1, 'Presente'),
        (2, 'Vacaciones'),
        (3, 'Falta Justificada'),
        (4, 'Falta Injustificada'),
        (5, 'Licencia Médica')`);

    // 3. Tabla Asistencia
    db.run(`CREATE TABLE IF NOT EXISTS asistencia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personal_id INTEGER,
        condicion_id INTEGER,
        fecha TEXT DEFAULT CURRENT_DATE,
        observacion TEXT,
        FOREIGN KEY(personal_id) REFERENCES personal(id),
        FOREIGN KEY(condicion_id) REFERENCES condiciones(id)
    )`);
});

// --- RUTAS API: PERSONAL ---

// Obtener todo el personal
app.get('/api/personal', (req, res) => {
    db.all('SELECT id, nombre, IFNULL(grado, "") AS grado FROM personal ORDER BY id ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear nuevo personal
app.post('/api/personal', (req, res) => {
    const { nombre, grado } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const gradoValor = grado ? grado.trim() : '';
    db.run('INSERT INTO personal (nombre, grado) VALUES (?, ?)', 
        [nombre.trim(), gradoValor], 
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, nombre: nombre.trim(), grado: gradoValor });
        }
    );
});

// Editar personal
app.put('/api/personal/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, grado } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    const gradoValor = grado ? grado.trim() : '';
    db.run('UPDATE personal SET nombre = ?, grado = ? WHERE id = ?', 
        [nombre.trim(), gradoValor, id], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Personal actualizado correctamente' });
        }
    );
});

// Eliminar personal
app.delete('/api/personal/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM personal WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Personal eliminado correctamente' });
    });
});

// --- RUTAS API: CONDICIONES ---

app.get('/api/condiciones', (req, res) => {
    db.all('SELECT * FROM condiciones', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/condiciones', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la condición es obligatorio.' });

    db.run('INSERT INTO condiciones (nombre) VALUES (?)', [nombre.trim()], function (err) {
        if (err) return res.status(400).json({ error: 'La condición ya existe.' });
        res.json({ id: this.lastID, nombre: nombre.trim() });
    });
});

app.put('/api/condiciones/:id', (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    db.run('UPDATE condiciones SET nombre = ? WHERE id = ?', [nombre.trim(), id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Condición actualizada' });
    });
});

app.delete('/api/condiciones/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM condiciones WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Condición eliminada' });
    });
});

// --- RUTAS API: ASISTENCIA ---

app.get('/api/asistencia', (req, res) => {
    const query = `
        SELECT a.id, a.fecha, p.nombre AS personal, IFNULL(p.grado, '') AS grado, c.nombre AS condicion
        FROM asistencia a
        JOIN personal p ON a.personal_id = p.id
        JOIN condiciones c ON a.condicion_id = c.id
        ORDER BY a.fecha DESC, a.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/asistencia', (req, res) => {
    const { personal_id, condicion_id, fecha, observacion } = req.body;
    if (!personal_id || !condicion_id || !fecha) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos (personal_id, condicion_id, fecha).' });
    }

    const queryExiste = 'SELECT id FROM asistencia WHERE personal_id = ? AND fecha = ?';
    db.get(queryExiste, [personal_id, fecha], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run('UPDATE asistencia SET condicion_id = ?, observacion = ? WHERE id = ?', 
                [condicion_id, observacion || '', row.id], 
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Asistencia actualizada' });
                }
            );
        } else {
            db.run('INSERT INTO asistencia (personal_id, condicion_id, fecha, observacion) VALUES (?, ?, ?, ?)', 
                [personal_id, condicion_id, fecha, observacion || ''], 
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, message: 'Asistencia registrada' });
                }
            );
        }
    });
});

// Eliminar marca de asistencia (para funcionalidad desmarcar/alternar)
app.delete('/api/asistencia/eliminar', (req, res) => {
    const { personal_id, fecha } = req.body;
    if (!personal_id || !fecha) {
        return res.status(400).json({ error: 'Se requiere personal_id y fecha para eliminar.' });
    }

    db.run('DELETE FROM asistencia WHERE personal_id = ? AND fecha = ?', [personal_id, fecha], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Registro de asistencia desmarcado correctamente' });
    });
});

// Consulta acumulada por rango
app.get('/api/asistencia/rango', (req, res) => {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
        return res.status(400).json({ error: 'Parámetros desde y hasta son requeridos.' });
    }

    const query = `
        SELECT a.id, a.fecha, p.nombre AS personal, IFNULL(p.grado, '') AS grado, c.nombre AS condicion
        FROM asistencia a
        JOIN personal p ON a.personal_id = p.id
        JOIN condiciones c ON a.condicion_id = c.id
        WHERE a.fecha BETWEEN ? AND ?
        ORDER BY a.fecha ASC
    `;
    db.all(query, [desde, hasta], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- AI SKILL ANALYTICS ---
app.post('/api/ai/analizar', (req, res) => {
    const { registros } = req.body;

    if (!registros || registros.length === 0) {
        return res.json({
            asistenciaPorcentaje: 0,
            alerta: 'Sin información en el período seleccionado.',
            hallazgos: ['No hay registros guardados en estas fechas.'],
            recomendacion: 'Marca la asistencia diaria para activar la analítica.'
        });
    }

    const totalRegistros = registros.length;
    const presentes = registros.filter(r => r.condicion.toLowerCase().includes('presente')).length;
    const faltas = registros.filter(r => r.condicion.toLowerCase().includes('falta')).length;
    const vacaciones = registros.filter(r => r.condicion.toLowerCase().includes('vacacio')).length;

    const porcentajeAsistencia = Math.round((presentes / totalRegistros) * 100);

    let alertaPrincipal = 'Rendimiento general operativo dentro del rango esperado.';
    if (porcentajeAsistencia < 70) alertaPrincipal = '⚠️ Atención crítica: Asistencia por debajo del 70%.';

    res.json({
        asistenciaPorcentaje: porcentajeAsistencia,
        alerta: alertaPrincipal,
        hallazgos: [
            `Tasa General de Asistencia: ${porcentajeAsistencia}% (${presentes} presencias).`,
            `Faltas acumuladas: ${faltas} | Vacaciones: ${vacaciones}.`
        ],
        recomendacion: 'Mantener el seguimiento habitual diario.'
    });
});

// --- INICIAR SERVIDOR ---
const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Cierre ordenado de la base de datos al apagar el proceso
process.on('SIGINT', () => {
    db.close(() => {
        console.log('Conexión con SQLite cerrada.');
        process.exit(0);
    });
});
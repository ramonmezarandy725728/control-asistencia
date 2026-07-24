const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la base de datos PostgreSQL de Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- RUTAS DE LA API ---

// 1. Obtener Personal
app.get('/api/personal', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM personal ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Guardar Personal
app.post('/api/personal', async (req, res) => {
    const { nombre, grado } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO personal (nombre, grado) VALUES ($1, $2) RETURNING *',
            [nombre, grado || '']
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Modificar Personal
app.put('/api/personal/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, grado } = req.body;
    try {
        await pool.query('UPDATE personal SET nombre = $1, grado = $2 WHERE id = $3', [nombre, grado, id]);
        res.json({ message: 'Personal actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Eliminar Personal
app.delete('/api/personal/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM personal WHERE id = $1', [id]);
        res.json({ message: 'Personal eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Obtener Condiciones
app.get('/api/condiciones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM condiciones ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Guardar Condición
app.post('/api/condiciones', async (req, res) => {
    const { nombre } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO condiciones (nombre) VALUES ($1) RETURNING *',
            [nombre]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Modificar Condición
app.put('/api/condiciones/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    try {
        await pool.query('UPDATE condiciones SET nombre = $1 WHERE id = $2', [nombre, id]);
        res.json({ message: 'Condición actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Eliminar Condición
app.delete('/api/condiciones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM condiciones WHERE id = $1', [id]);
        res.json({ message: 'Condición eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Obtener Registros de Asistencia
app.get('/api/asistencia', async (req, res) => {
    try {
        const query = `
            SELECT a.id, p.nombre AS personal, p.grado, c.nombre AS condicion, TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha
            FROM asistencia a
            JOIN personal p ON a.personal_id = p.id
            JOIN condiciones c ON a.condicion_id = c.id
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Guardar/Actualizar Asistencia
app.post('/api/asistencia', async (req, res) => {
    const { personal_id, condicion_id, fecha } = req.body;
    try {
        const query = `
            INSERT INTO asistencia (personal_id, condicion_id, fecha)
            VALUES ($1, $2, $3)
            ON CONFLICT (personal_id, fecha)
            DO UPDATE SET condicion_id = EXCLUDED.condicion_id;
        `;
        await pool.query(query, [personal_id, condicion_id, fecha]);
        res.json({ message: 'Asistencia registrada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Eliminar Registro de Asistencia
app.delete('/api/asistencia/eliminar', async (req, res) => {
    const { personal_id, fecha } = req.body;
    try {
        await pool.query('DELETE FROM asistencia WHERE personal_id = $1 AND fecha = $2', [personal_id, fecha]);
        res.json({ message: 'Asistencia eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Consultar Asistencia por Rango de Fechas
app.get('/api/asistencia/rango', async (req, res) => {
    const { desde, hasta } = req.query;
    try {
        const query = `
            SELECT a.id, p.nombre AS personal, p.grado, c.nombre AS condicion, TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha
            FROM asistencia a
            JOIN personal p ON a.personal_id = p.id
            JOIN condiciones c ON a.condicion_id = c.id
            WHERE a.fecha BETWEEN $1 AND $2
        `;
        const { rows } = await pool.query(query, [desde, hasta]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
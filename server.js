const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3001;

// Middleware para JSON
app.use(express.json());

// CONFIGURAR CORS - IMPORTANTE!
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Configuração do banco PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'livevip-bd',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'livevip',
  user: process.env.DB_USER || 'livevip',
  password: process.env.DB_PASSWORD || '@Copa123',
});

// Health check
app.get('/health', (req, res) => {
  console.log('Health check solicitado');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'livevip-api',
    cors: 'enabled'
  });
});

// Buscar todas as streams
app.get('/api/streams', async (req, res) => {
  try {
    console.log('Buscando streams do banco...');
    
    const result = await pool.query(`
      SELECT 
        id::text,
        title,
        streamer,
        thumbnail,
        viewers,
        category,
        avatar
      FROM streams 
      ORDER BY created_at DESC
    `);
    
    console.log(`${result.rows.length} streams encontradas`);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar streams:', err);
    res.json([]); // Retorna array vazio se der erro
  }
});

// Salvar streams
app.post('/api/streams', async (req, res) => {
  try {
    const streams = req.body;
    console.log(`Salvando ${streams.length} streams...`);
    
    if (!Array.isArray(streams)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Criar tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streams (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        streamer VARCHAR(255) NOT NULL,
        thumbnail VARCHAR(500),
        viewers INTEGER DEFAULT 0,
        category VARCHAR(100) DEFAULT 'Geral',
        avatar VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Limpar e inserir
    await pool.query('DELETE FROM streams');
    
    for (const stream of streams) {
      await pool.query(`
        INSERT INTO streams (title, streamer, thumbnail, viewers, category, avatar)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        stream.title,
        stream.streamer,
        stream.thumbnail,
        stream.viewers || 0,
        stream.category || 'Geral',
        stream.avatar
      ]);
    }
    
    console.log('Streams salvas com sucesso');
    res.json({ success: true, count: streams.length });
    
  } catch (err) {
    console.error('Erro ao salvar:', err);
    res.json({ success: false, error: err.message });
  }
});

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`CORS habilitado para todas as origens`);
});

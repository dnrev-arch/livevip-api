const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3001;

// Middleware para JSON
app.use(express.json());

// CONFIGURAR CORS
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

// Função para criar tabela
async function createTable() {
  try {
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
    console.log('✅ Tabela streams criada/verificada');
    return true;
  } catch (err) {
    console.error('❌ Erro ao criar tabela:', err);
    return false;
  }
}

// Criar tabela na inicialização
createTable();

// Health check
app.get('/health', (req, res) => {
  console.log('🔍 Health check solicitado');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'livevip-api',
    cors: 'enabled'
  });
});

// Teste do banco
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as timestamp');
    console.log('✅ Conexão do banco OK');
    res.json({
      status: 'connected',
      timestamp: result.rows[0].timestamp,
      database: 'livevip'
    });
  } catch (err) {
    console.error('❌ Erro no banco:', err);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: err.message 
    });
  }
});

// Buscar todas as streams
app.get('/api/streams', async (req, res) => {
  try {
    console.log('📥 Buscando streams do banco...');
    
    // Garantir que tabela existe
    await createTable();
    
    const result = await pool.query(`
      SELECT 
        id::text,
        title,
        streamer,
        thumbnail,
        viewers,
        category,
        avatar,
        created_at
      FROM streams 
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ ${result.rows.length} streams encontradas`);
    res.json(result.rows);
    
  } catch (err) {
    console.error('❌ Erro ao buscar streams:', err);
    res.status(200).json([]); // Retorna array vazio em caso de erro
  }
});

// Salvar streams (POST)
app.post('/api/streams', async (req, res) => {
  try {
    console.log('📥 Requisição POST recebida');
    console.log('📦 Body da requisição:', JSON.stringify(req.body, null, 2));
    
    const streams = req.body;
    
    // Validação básica
    if (!streams || !Array.isArray(streams)) {
      console.log('❌ Dados inválidos - não é array');
      return res.status(400).json({ 
        error: 'Invalid data - expected array',
        received: typeof streams
      });
    }
    
    console.log(`💾 Salvando ${streams.length} streams no banco...`);
    
    // Garantir que tabela existe
    const tableCreated = await createTable();
    if (!tableCreated) {
      return res.status(500).json({ error: 'Failed to create table' });
    }
    
    // Limpar tabela existente
    await pool.query('DELETE FROM streams');
    console.log('🗑️ Tabela streams limpa');
    
    // Inserir novas streams
    let insertedCount = 0;
    for (const stream of streams) {
      try {
        // Validar campos obrigatórios
        if (!stream.title || !stream.streamer) {
          console.log('⚠️ Stream inválida:', stream);
          continue;
        }
        
        await pool.query(`
          INSERT INTO streams (title, streamer, thumbnail, viewers, category, avatar)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          stream.title,
          stream.streamer,
          stream.thumbnail || '',
          parseInt(stream.viewers) || 0,
          stream.category || 'Geral',
          stream.avatar || ''
        ]);
        
        insertedCount++;
        console.log(`✅ Stream inserida: ${stream.title} por ${stream.streamer}`);
        
      } catch (insertErr) {
        console.error('❌ Erro ao inserir stream:', insertErr);
        console.error('Stream problemática:', stream);
      }
    }
    
    console.log(`🎉 ${insertedCount} streams salvas com sucesso`);
    
    res.json({ 
      success: true, 
      count: insertedCount,
      total_received: streams.length
    });
    
  } catch (err) {
    console.error('❌ Erro geral ao salvar streams:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: err.message
    });
  }
});

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body).substring(0, 200) + '...');
  }
  next();
});

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`🌐 URL: http://localhost:${port}`);
  console.log(`📡 CORS habilitado`);
  console.log(`💾 Banco: ${process.env.DB_HOST || 'livevip-bd'}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 10e6,
    allowEIO3: true // Compatibilidade extra
});

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// ─── Utilitários de persistência ───────────────────────────────────────────
function carregarDB() {
    if (!fs.existsSync(DB_FILE)) return { ocorrencias: [], ufv_status: [] };
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { ocorrencias: [], ufv_status: [] };
    }
}

function salvarDB(dados) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2), 'utf8');
}

// ─── Lista de usinas padrão ─────────────────────────────────────────────────
const NOMES_USINAS = [
    "Água Clara", "Almino Afonso", "Aloândia 1", "Aparecida do Taboado", "Araruama 1",
    "Araruama 2", "Araruama 3", "Bonópolis", "Borda da Mata", "Botelhos 2",
    "Brejinho", "Buriti Alegre", "Cachoeira Alta 1", "Cambuí", "Campo Grande",
    "Corumbaíba 2", "Corumbaíba 3", "Frei Inocêncio", "Grossos 1", "Guará",
    "Iaciara 1", "Iaciara 2", "Itaguaí 4", "Itaguara", "Itarumã 1",
    "Itarumã 2", "Lambari", "Major Sales", "Mateus Leme 1", "Mateus Leme 2",
    "Monte Sião", "Mossoró 2", "Nova Andradina", "Nova Aurora 2", "Nova Lacerda",
    "Panamá de Goiás 1", "Panamá de Goiás 2", "Paranaiguara", "Paranatinga", "Paratinga",
    "Paty de Alferes", "Pedra Santa", "Pongaí", "Resende", "Rio do Antônio 1",
    "Rio do Antônio 2", "Rio Pardo de Minas", "Rota do Sol 1", "Santo Antônio do Descoberto",
    "São Francisco de Itabapoana", "São Gabriel do Oeste 1", "São Joaquim da Barra 1",
    "São Joaquim da Barra 2", "Serra do Mel", "Serra do Mel 2", "Vassouras", "Naque"
];

// ─── Inicializar DB se vazio ────────────────────────────────────────────────
function inicializarDB() {
    const dados = carregarDB();
    if (dados.ufv_status.length === 0) {
        dados.ufv_status = NOMES_USINAS.map(nome => ({
            id: nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            ufv: nome,
            digifort: "OK",
            anydesk: "OK",
            totalCam: 8,
            onCam: 8,
            fibra: "OK",
            seguranca: "SEM NECESSIDADE",
            pronta_resposta: "ATIVO"
        }));
        salvarDB(dados);
    }
    return dados;
}

// ─── Credenciais de acesso ──────────────────────────────────────────────────
const USUARIOS = [
    { usuario: "admin",    senha: "usina2026",  nome: "Gestor CFTV"  },
    { usuario: "everaldo", senha: "cftv2026",   nome: "Everaldo"     },
    { usuario: "layla",    senha: "cftv2026",   nome: "Layla"        },
    { usuario: "geilson",  senha: "cftv2026",   nome: "Geilson"      },
    { usuario: "vanuzia",  senha: "cftv2026",   nome: "Vanuzia"      }
];

// ─── Servir frontend estático ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API REST simples para exportação CSV ──────────────────────────────────
app.get('/api/exportar/ocorrencias', (req, res) => {
    const dados = carregarDB();
    let csv = "Data Início;Operador;Usina;Tipo;Status;Impacto;Solução;Data Final\n";
    dados.ocorrencias.forEach(o => {
        const linha = [
            new Date(o.data).toLocaleString('pt-BR'),
            o.operador || "",
            o.usina || "",
            o.tipo || "",
            o.status || "",
            o.impacto || "",
            (o.obs || "").replace(/(\n|;)/gm, " "),
            o.dataReg || ""
        ];
        csv += linha.join(";") + "\n";
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Relatorio_Ocorrencias.csv"');
    res.send('\ufeff' + csv);
});

app.get('/api/exportar/ufv_status', (req, res) => {
    const dados = carregarDB();
    let csv = "UFV;Segurança Patrimonial;Pronta Resposta;Fibra;Digifort;Anydesk;Total Cam;Cam ON\n";
    dados.ufv_status.sort((a, b) => a.ufv.localeCompare(b.ufv)).forEach(u => {
        const linha = [
            u.ufv || "N/A",
            u.seguranca || "SEM NECESSIDADE",
            u.pronta_resposta || "ATIVO",
            u.fibra || "OK",
            u.digifort || "OK",
            u.anydesk || "OK",
            u.totalCam || 0,
            u.onCam || 0
        ];
        csv += linha.join(";") + "\n";
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Status_UFVs.csv"');
    res.send('\ufeff' + csv);
});

// ─── Socket.io – lógica em tempo real ──────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[+] Cliente conectado: ${socket.id}`);

    // ── Autenticação ──────────────────────────────────────────────────────
    socket.on('autenticar', ({ usuario, senha }) => {
        console.log(`[?] Tentativa de login: ${usuario}`);
        const user = USUARIOS.find(u => u.usuario === usuario && u.senha === senha);
        if (user) {
            console.log(`[OK] Login bem-sucedido: ${user.nome}`);
            socket.emit('autenticado', { nome: user.nome });
        } else {
            console.log(`[ERRO] Login falhou para: ${usuario}`);
            socket.emit('auth_erro', { msg: 'Usuário ou senha inválidos.' });
        }
    });

    // ── Carregar dados iniciais ───────────────────────────────────────────
    socket.on('carregar_dados', () => {
        const dados = carregarDB();
        socket.emit('dados_iniciais', dados);
    });

    // ── Adicionar ocorrência ──────────────────────────────────────────────
    socket.on('add_ocorrencia', (ocorrencia) => {
        const dados = carregarDB();
        const nova = { ...ocorrencia, id: uuidv4() };
        dados.ocorrencias.push(nova);
        salvarDB(dados);
        io.emit('ocorrencia_adicionada', nova); // broadcast para todos
    });

    // ── Atualizar ocorrência ──────────────────────────────────────────────
    socket.on('update_ocorrencia', ({ id, campos }) => {
        const dados = carregarDB();
        const idx = dados.ocorrencias.findIndex(o => o.id === id);
        if (idx !== -1) {
            dados.ocorrencias[idx] = { ...dados.ocorrencias[idx], ...campos };
            salvarDB(dados);
            io.emit('ocorrencia_atualizada', dados.ocorrencias[idx]);
        }
    });

    // ── Excluir ocorrência ────────────────────────────────────────────────
    socket.on('delete_ocorrencia', ({ id }) => {
        const dados = carregarDB();
        dados.ocorrencias = dados.ocorrencias.filter(o => o.id !== id);
        salvarDB(dados);
        io.emit('ocorrencia_deletada', { id });
    });

    // ── Atualizar status de UFV ───────────────────────────────────────────
    socket.on('update_ufv', ({ id, campo, valor }) => {
        const dados = carregarDB();
        const ufv = dados.ufv_status.find(u => u.id === id);
        if (ufv) {
            ufv[campo] = isNaN(valor) ? valor : parseInt(valor);
            salvarDB(dados);
            io.emit('ufv_atualizada', ufv);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Cliente desconectado: ${socket.id}`);
    });
});

// ─── Iniciar servidor ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
inicializarDB();
server.listen(PORT, () => {
    console.log(`\n✅ Servidor Monitoramento CFTV rodando em http://localhost:${PORT}\n`);
});

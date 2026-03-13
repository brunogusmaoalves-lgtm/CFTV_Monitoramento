const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 10e6,
    allowEIO3: true
});

// ─── Configuração do MongoDB ───────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERRO: A variável MONGODB_URI não foi configurada no Render!');
} else {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
    })
    .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => console.error('❌ Erro crítico ao conectar ao MongoDB:', err.message));
}

// ─── Modelos de Dados ──────────────────────────────────────────────────────
const OcorrenciaSchema = new mongoose.Schema({
    dataInicio: String,
    dataFim: String,
    operador: String,
    impacto: String,
    usina: String,
    tipo: String,
    local: String,
    desc: String,
    foto: String,
    status: { type: String, default: 'ABERTO' }
}, { timestamps: true });

const UfvStatusSchema = new mongoose.Schema({
    nome: { type: String, unique: true },
    digifort: { type: String, default: 'OK' },
    anydesk: { type: String, default: 'OK' },
    totalCam: { type: Number, default: 8 },
    camOn: { type: Number, default: 8 },
    fibra: { type: String, default: 'OK' },
    seguranca: { type: String, default: 'SEM NECESSIDADE' },
    prontaResposta: { type: String, default: 'ATIVO' }
});

const Ocorrencia = mongoose.model('Ocorrencia', OcorrenciaSchema);
const UfvStatus = mongoose.model('UfvStatus', UfvStatusSchema);

// ─── Lista de Usuários (Mantida no código para simplicidade) ───────────────
const USUARIOS = [
    { usuario: 'admin', senha: 'usina2026', nome: 'Gestor CFTV' },
    { usuario: 'everaldo', senha: 'cftv2026', nome: 'Everaldo' },
    { usuario: 'layla', senha: 'cftv2026', nome: 'Layla' },
    { usuario: 'geilson', senha: 'cftv2026', nome: 'Geilson' },
    { usuario: 'vanuzia', senha: 'cftv2026', nome: 'Vanuzia' }
];

// ─── Inicialização das UFVs (Se o banco estiver vazio) ─────────────────────
const UFVS_INICIAIS = [
    "Água Clara", "Almino Afonso", "Aloândia 1", "Aparecida do Taboado", "Araruama 1", "Araruama 2", "Araruama 3",
    "Bonópolis", "Borda da Mata", "Botelhos 2", "Brejinho", "Buriti Alegre", "Cachoeira Alta 1", "Cambuí", "Campo Grande",
    "Corumbaíba 2", "Corumbaíba 3", "Frei Inocêncio", "Grossos 1", "Guará", "Iaciara 1", "Iaciara 2", "Itaguaí 4",
    "Itaguara", "Itarumã 1", "Itarumã 2", "Lambari", "Major Sales", "Mateus Leme 1", "Mateus Leme 2", "Monte Sião",
    "Mossoró 2", "Naque", "Nova Andradina", "Nova Aurora 2", "Nova Lacerda", "Panamá de Goiás 1", "Panamá de Goiás 2",
    "Paranaiguara", "Paranatinga", "Paratinga", "Paty de Alferes", "Pedra Santa", "Pongaí", "Resende", "Rio do Antônio 1",
    "Rio do Antônio 2", "Rio Pardo de Minas", "Rota do Sol 1", "Santo Antônio do Descoberto", "São Francisco de Itabapoana",
    "São Gabriel do Oeste 1", "São Joaquim da Barra 1", "São Joaquim da Barra 2", "Serra do Mel", "Serra do Mel 2", "Vassouras"
];

async function inicializarUFVs() {
    try {
        const count = await UfvStatus.countDocuments();
        if (count === 0) {
            console.log('[!] Inicializando lista de UFVs no banco...');
            const docs = UFVS_INICIAIS.map(nome => ({ nome }));
            await UfvStatus.insertMany(docs);
            console.log('✅ UFVs criadas com sucesso!');
        } else {
            console.log(`[OK] Banco já contém ${count} UFVs.`);
        }
    } catch (err) {
        console.error('❌ Erro ao inicializar UFVs:', err.message);
    }
}
inicializarUFVs();

// ─── Servir arquivos estáticos ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[+] Cliente conectado: ${socket.id}`);

    socket.on('autenticar', ({ usuario, senha }) => {
        const user = USUARIOS.find(u => u.usuario === usuario && u.senha === senha);
        if (user) {
            socket.emit('autenticado', { nome: user.nome });
        } else {
            socket.emit('auth_erro', { msg: 'Usuário ou senha inválidos.' });
        }
    });

    socket.on('carregar_dados', async () => {
        try {
            const ocorrencias = await Ocorrencia.find().sort({ createdAt: -1 });
            const ufv_status = await UfvStatus.find().sort({ nome: 1 });
            socket.emit('dados_iniciais', { ocorrencias, ufv_status });
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        }
    });

    socket.on('nova_ocorrencia', async (dados) => {
        try {
            const nova = new Ocorrencia(dados);
            await nova.save();
            io.emit('ocorrencia_criada', nova);
        } catch (err) {
            console.error('Erro ao criar ocorrência:', err);
        }
    });

    socket.on('editar_ocorrencia', async (dados) => {
        try {
            const { _id, ...updateData } = dados;
            const editada = await Ocorrencia.findByIdAndUpdate(_id, updateData, { new: true });
            io.emit('ocorrencia_editada', editada);
        } catch (err) {
            console.error('Erro ao editar ocorrência:', err);
        }
    });

    socket.on('excluir_ocorrencia', async (id) => {
        try {
            await Ocorrencia.findByIdAndDelete(id);
            io.emit('ocorrencia_excluida', id);
        } catch (err) {
            console.error('Erro ao excluir ocorrência:', err);
        }
    });

    socket.on('atualizar_ufv', async (dados) => {
        try {
            const { _id, ...updateData } = dados;
            const atualizada = await UfvStatus.findByIdAndUpdate(_id, updateData, { new: true });
            io.emit('ufv_atualizada', atualizada);
        } catch (err) {
            console.error('Erro ao atualizar UFV:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Cliente desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n✅ Servidor Monitoramento CFTV (MongoDB) rodando em http://localhost:${PORT}\n`);
});

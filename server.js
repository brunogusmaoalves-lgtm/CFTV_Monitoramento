const express = require('express');
const http = require('http' );
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app );
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Conectado ao MongoDB Atlas');
        inicializarUFVs(); 
    })
    .catch(err => console.error('❌ Erro MongoDB:', err.message));

const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({
    dataInicio: String, operador: String, impacto: String, usina: String, 
    tipo: String, local: String, desc: String, foto: String, status: { type: String, default: 'ABERTO' }
}, { timestamps: true }));

const UfvStatus = mongoose.model('UfvStatus', new mongoose.Schema({
    nome: { type: String, unique: true }, digifort: { type: String, default: 'OK' },
    anydesk: { type: String, default: 'OK' }, totalCam: { type: Number, default: 8 },
    camOn: { type: Number, default: 8 }, fibra: { type: String, default: 'OK' },
    seguranca: { type: String, default: 'SEM NECESSIDADE' }, prontaResposta: { type: String, default: 'ATIVO' }, status: { type: String, default: 'O&M' }, motivodaMobilazacao: { type: String, default: '-' },foto1: { type: String, default: '' },
    foto2: { type: String, default: '' }
}));

const Visita = mongoose.model('Visita', new mongoose.Schema({
    dataVisita: String, dataFim: String, usina: String, horarioEntrada: String, horarioSaida: String,
    nomeVisitante: String, empresa: String, documento: String, contato: String,
    motivoVisita: String, responsavelUsina: String, placaVeiculo: String,
    usoEPI: String, observacoes: String, visitanteRecorrente: Boolean,
    status: { type: String, default: 'ABERTO' },
    resultadoFibra: { type: String, default: '' }
}, { timestamps: true }));

const UFVS_INICIAIS = ["Água Clara", "Almino Afonso", "Alvorada do Norte", "Aloândia 1", "Aparecida do Taboado", "Araruama 1", "Araruama 2", "Araruama 3", "Bonópolis", "Borda da Mata", "Botelhos 2", "Brejinho", "Buriti Alegre", "Brumado", "Cachoeira Alta 1", "Cambuí", "Campo Grande", "Corumbaíba 2", "Corumbaíba 3", "Divino", "Frei Inocêncio", "Grossos 1", "Guará", "Iaciara 1", "Iaciara 2", "Itaguaí 4", "Itaguara", "Itarumã 1", "Itarumã 2", "Iramaia", "Lambari", "Major Sales", "Mateus Leme 1", "Mateus Leme 2", "Monte Sião", "Mossoró 2", "Naque", "Nova Andradina", "Nova Aurora 2", "Nova Lacerda", "Panamá de Goiás 1", "Panamá de Goiás 2", "Paranaiguara", "Paranatinga", "Paratinga", "Paty de Alferes", "Pedra Santa", "Pongaí", "Resende", "Rio do Antônio 1", "Rio do Antônio 2", "Rio Pardo de Minas", "Rota do Sol 1", "Santo Antônio do Descoberto", "Santa Rita de Caldas 1", "Santa Rita de Caldas 2", "São Francisco de Itabapoana", "São Gabriel do Oeste 1", "São Joaquim da Barra 1", "São Joaquim da Barra 2", "Sobral", "Seropédica", "Serra do Mel", "Serra do Mel 2", "Tangara", "Teixeira de Freitas 1", "Teixeira de Freitas 2", "Varginha 1", "Varginha 2", "Vassouras"];

async function inicializarUFVs() {
    try {
        for (const nome of UFVS_INICIAIS) {
            await UfvStatus.findOneAndUpdate(
                { nome }, 
                { $setOnInsert: { nome } }, 
                { upsert: true, new: true }
            );
        }
        console.log(`✅ UFVs sincronizadas com sucesso!`);
    } catch (err) { console.error('❌ Erro inicialização:', err.message); }
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    // Envia os dados IMEDIATAMENTE ao conectar, sem esperar o login
    async function enviarDados() {
    const ocorrencias = await Ocorrencia.find().sort({ createdAt: -1 });
    const ufv_status = await UfvStatus.find({}, { foto1: 0, foto2: 0 }).sort({ nome: 1 });
    const visitas = await Visita.find().sort({ createdAt: -1 });
    socket.emit('dados_iniciais', { ocorrencias, ufv_status, visitas });
}
    enviarDados();

    socket.on('autenticar', ({ usuario, senha }) => {
        const USUARIOS = [
            { usuario: 'admin', senha: 'usina2026', nome: 'Gestor CFTV' },
            { usuario: 'everaldo', senha: 'cftv2026', nome: 'Everaldo' },
            { usuario: 'layla', senha: 'cftv2026', nome: 'Layla' },
            { usuario: 'geilson', senha: 'cftv2026', nome: 'Geilson' },
            { usuario: 'vanuzia', senha: 'cftv2026', nome: 'Vanuzia' }
        ];
        const user = USUARIOS.find(u => u.usuario === usuario && u.senha === senha);
        if (user) socket.emit('autenticado', { nome: user.nome });
        else socket.emit('auth_erro', { msg: 'Usuário ou senha inválidos.' });
    });

    socket.on('carregar_dados', enviarDados);
    socket.on('nova_ocorrencia', async (d) => { const n = new Ocorrencia(d); await n.save(); io.emit('ocorrencia_criada', n); });
    socket.on('editar_ocorrencia', async (d) => { const { _id, ...upd } = d; const e = await Ocorrencia.findByIdAndUpdate(_id, upd, { new: true }); io.emit('ocorrencia_editada', e); });
    socket.on('excluir_ocorrencia', async (id) => { await Ocorrencia.findByIdAndDelete(id); io.emit('ocorrencia_excluida', id); });
    socket.on('atualizar_ufv', async (d) => { const { _id, ...upd } = d; const a = await UfvStatus.findByIdAndUpdate(_id, upd, { new: true }); io.emit('ufv_atualizada', a); });
socket.on('nova_visita', async (d) => { 
        const v = new Visita(d); 
        await v.save(); 
        io.emit('visita_registrada', v); 
    });
    socket.on('editar_visita', async (d) => {
    const { _id, ...upd } = d;
    const v = await Visita.findByIdAndUpdate(_id, upd, { new: true });
    io.emit('visita_editada', v);
});

socket.on('excluir_visita', async (id) => {
    await Visita.findByIdAndDelete(id);
    io.emit('visita_excluida', id);
});
socket.on('carregar_foto_ufv', async (id) => {
    const u = await UfvStatus.findById(id, { foto1: 1, foto2: 1 });
    socket.emit('foto_ufv_carregada', { _id: id, foto1: u?.foto1 || '', foto2: u?.foto2 || '' });
});
}); // <- fecha o io.on('connection', ...)

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Porta ${PORT}`));

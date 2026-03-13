# Monitoramento CFTV — IVI Energia
### Sistema Multi-usuário em Tempo Real (Node.js + Socket.io)

---

## Como Funciona

O sistema usa **WebSocket via Socket.io** para sincronizar dados entre todos os usuários conectados simultaneamente. Qualquer alteração feita por um operador (nova ocorrência, atualização de status de UFV, etc.) é propagada instantaneamente para todos os outros navegadores abertos.

Os dados são salvos em um arquivo `data/db.json` no servidor — sem necessidade de banco de dados externo.

---

## Pré-requisitos

- **Node.js** versão 16 ou superior → [https://nodejs.org](https://nodejs.org)

---

## Instalação

```bash
# 1. Entre na pasta do projeto
cd monitoramento-cftv

# 2. Instale as dependências
npm install

# 3. Inicie o servidor
npm start
```

O servidor estará disponível em: **http://localhost:3000**

---

## Acesso em Rede Local

Para que múltiplos computadores acessem o sistema na mesma rede:

1. Descubra o IP do computador servidor:
   - **Windows:** `ipconfig` no Prompt de Comando
   - **Linux/Mac:** `ip addr` ou `ifconfig`

2. Todos os outros computadores acessam pelo navegador:
   ```
   http://[IP-DO-SERVIDOR]:3000
   ```
   Exemplo: `http://192.168.1.100:3000`

---

## Credenciais de Acesso

| Usuário    | Senha      | Nome Exibido    |
|------------|------------|-----------------|
| `admin`    | `usina2026`| Gestor CFTV     |
| `everaldo` | `cftv2026` | Everaldo        |
| `layla`    | `cftv2026` | Layla           |
| `geilson`  | `cftv2026` | Geilson         |
| `vanuzia`  | `cftv2026` | Vanuzia         |

> Para adicionar ou alterar usuários, edite o array `USUARIOS` no arquivo `server.js`.

---

## Estrutura de Arquivos

```
monitoramento-cftv/
├── server.js          ← Servidor Node.js (backend + WebSocket)
├── package.json       ← Dependências do projeto
├── data/
│   └── db.json        ← Banco de dados (gerado automaticamente)
└── public/
    └── index.html     ← Interface do usuário (frontend)
```

---

## Funcionalidades em Tempo Real

| Ação                          | Comportamento                                      |
|-------------------------------|----------------------------------------------------|
| Registrar nova ocorrência     | Aparece imediatamente para todos os usuários       |
| Editar status de ocorrência   | Atualiza em tempo real para todos                  |
| Excluir ocorrência            | Remove instantaneamente para todos                 |
| Alterar status de UFV         | Sincroniza com todos os usuários conectados        |
| Exportar CSV                  | Download direto via servidor (dados completos)     |

---

## Indicador de Conexão

No canto superior direito do painel há um indicador de status:

- **Verde "CONECTADO"** — comunicação ativa com o servidor
- **Vermelho "DESCONECTADO"** — sem conexão (reconecta automaticamente)

---

## Executar como Serviço (Produção)

Para manter o servidor rodando continuamente, instale o **PM2**:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o servidor com PM2
pm2 start server.js --name "monitoramento-cftv"

# Configurar para iniciar automaticamente no boot
pm2 startup
pm2 save
```

---

## Backup dos Dados

Os dados ficam em `data/db.json`. Faça backup periódico deste arquivo para preservar o histórico de ocorrências.

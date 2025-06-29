# DApp Development Environment 🛠️

A full-stack blockchain application boilerplate using:

* **Hardhat** for smart contracts
* **PostgreSQL, MongoDB, Redis** for data and caching
* **Node.js/Express** backend
* **React** frontend
* **Docker Compose** for orchestration
* **Mailpit** for local email testing

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/dapp-monorepo.git
cd dapp-monorepo
```

### 2. Set up environment variables

Copy and modify the environment config:

```bash
cp .env.example .env
```

### 3. Start All Services

```bash
docker compose up --build
```

* Frontend: [http://localhost:3000](http://localhost:3000)
* Backend API: [http://localhost:5001/health](http://localhost:5001/health)
* Mongo Express: [http://localhost:8081](http://localhost:8081)
* RedisInsight: [http://localhost:8001](http://localhost:8001)
* PGAdmin: [http://localhost:8080](http://localhost:8080)
* Mailpit: [http://localhost:8025](http://localhost:8025)

---

## 📬 Email Testing

Test email via `/test-email`:

```bash
curl http://localhost:5001/test-email
```

Mailpit shows received emails at [http://localhost:8025](http://localhost:8025)

---

## 🔐 Ethereum Smart Contract Setup

### Configure API Keys

#### 1. Sepolia RPC URL

Sign up on [Infura](https://infura.io/) or [Alchemy](https://alchemy.com/) and create a project.

```env
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
```

#### 2. MetaMask Private Key

Export your private key from MetaMask settings and add it to your `.env`:

```env
PRIVATE_KEY=your_metamask_account_private_key
```

> **Never share your real `.env` or private keys.**

### Hardhat Network Config (`hardhat.config.js`)

```js
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

---

## 🧪 Testing MongoDB, Redis, and Postgres

### Mongo

```bash
docker exec -it dapp-mongo-1 mongosh
```

### Redis

```bash
docker exec -it dapp-redis-1 redis-cli
> set testkey "hello redis"
> get testkey
```

### Postgres

```bash
docker exec -it dapp-postgres-1 psql -U devuser -d dev_dapp
```

### MinIO Integration

```bash
docker exec -it dapp-minio-1 sh
mc alias set local http://localhost:9000 minio minio123
mc ls local
```

---

## 🔧 Debugging

* Check logs:

```bash
docker compose logs backend
```

* Restart a service:

```bash
docker compose restart redis
```

* Shell into a container:

```bash
docker exec -it dapp-backend-1 sh
```

---

## ✅ Coming Soon

* Smart contract deployment scripts
* Etherscan verification
* Email queueing via BullMQ
* CI pipelines for tests and builds

---

## 📁 Project Structure

```
.
├── backend
├── frontend
├── contracts
├── docker-compose.yml
├── .env / .env.example
└── README.md
```

---

## 📄 License

MIT © 2025

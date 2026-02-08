# Backr 🤝

**Trust-Based Credit Without Traditional Collateral**

Backr is a decentralized credit protocol that enables trust-based lending using social vouches and ENS reputation as collateral. Instead of locking up assets, users build credit through vouches from people who trust them.

![Backr](https://img.shields.io/badge/ETHGlobal-Hackmoney-blue)
![Yellow Network](https://img.shields.io/badge/Powered%20by-Yellow%20Nitrolite-yellow)
![ENS](https://img.shields.io/badge/ENS-Integrated-blueviolet)

## 🎯 Problem

Traditional DeFi lending requires over-collateralization (150%+), excluding millions of users who need capital but don't have assets to lock up. This creates a chicken-and-egg problem: you need assets to borrow, but you need to borrow to get assets.

## 💡 Solution

Backr introduces a **reputation-based credit system** where:
- Your **social trust network** becomes your collateral
- Friends/family **vouch** for you with their own funds at stake
- Your **ENS domain** can be staked for enhanced trust
- **Automatic wage garnishing** ensures responsible repayment
- **On-chain credit scores** build your DeFi reputation

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│           Dashboard • Vouch • Borrow • Repay • Settings          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Bun + Express)                      │
│   REST API • Backr Agents • Credit Scoring • Auto-Garnishing     │
└───────────┬─────────────────────────────────────────┬───────────┘
            │                                         │
┌───────────▼───────────┐               ┌─────────────▼───────────┐
│   YELLOW NETWORK       │               │      SMART CONTRACTS    │
│   (Base Sepolia)       │               │       (Sepolia)         │
│                        │               │                         │
│  • Nitrolite SDK       │               │  • BackrENSCollateral   │
│  • Payment Channels    │               │  • BackrENSReputation   │
│  • Instant Settlement  │               │  • ENS Integration      │
│  • Off-Chain Balance   │               │  • Slashing Logic       │
└────────────────────────┘               └─────────────────────────┘
```

## ⚡ Key Features

### 1. **Social Vouching System**
- Users vouch for others by putting their own funds at stake
- Vouches create a trust graph that becomes credit history
- Vouchers' credit scores are affected by borrower behavior

### 2. **ENS as Collateral**
- Stake your ENS domain as enhanced collateral
- Soft nuke: Default → "DEFAULTED" status written to ENS text records
- Hard nuke: Default → ENS transferred to burn address

### 3. **Automatic Garnishing (Backr Agents)**
- Each user gets a "Backr Agent" - a WebSocket-connected background process
- Monitors incoming transfers via Yellow Network
- Automatically garnishes a percentage toward debt repayment
- Configurable garnish percentage (10-100%)

### 4. **On-Chain Credit Scores**
- Credit scores (300-900) stored on-chain via ENS text records
- Timely repayment increases score
- Defaults and late payments decrease score
- Reputation travels with your wallet across DeFi

### 5. **Instant Settlements**
- Powered by Yellow Network's Nitrolite SDK
- Off-chain payment channels for instant transfers
- No gas fees for transfers between users
- On-chain settlement only when needed

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4, ethers.js v6 |
| **Backend** | Bun, Express, TypeScript, WebSocket |
| **Database** | Supabase (PostgreSQL) |
| **Blockchain** | Sepolia (ENS), Base Sepolia (Yellow) |
| **Payments** | Yellow Network Nitrolite SDK (@erc7824/nitrolite) |
| **Smart Contracts** | Solidity 0.8.20, Foundry |
| **Identity** | ENS (Ethereum Name Service) |

## 📁 Project Structure

```
backr/
├── frontend/          # Next.js 15 web application
│   ├── src/
│   │   ├── app/       # App router pages
│   │   ├── components/# UI components
│   │   ├── hooks/     # React hooks
│   │   └── lib/       # API client, utilities
│   └── package.json
│
├── backend/           # Bun + Express API server
│   ├── index.ts       # Main server & routes
│   ├── bankClient.ts  # Yellow Network integration
│   ├── contracts.ts   # Smart contract interactions
│   ├── services.ts    # Business logic
│   ├── db.ts          # Supabase client
│   └── test.ts        # Integration tests
│
└── contracts/         # Foundry smart contracts
    ├── src/
    │   ├── BackrENSCollateral.sol  # ENS staking
    │   └── BackrENSReputation.sol  # Credit scores
    └── test/          # Contract tests
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Supabase account
- Sepolia ETH (for contract deployment)
- Base Sepolia ETH (for Yellow Network)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/backr.git
cd backr

# Frontend
cd frontend && bun install

# Backend
cd ../backend && bun install

# Contracts
cd ../contracts && forge install
```

### 2. Environment Setup

**Backend `.env`:**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VAULT_ADDRESS=0x...  # For garnished funds
```

### 3. Database Setup

Run the SQL in `backend/supabase-schema.sql` in your Supabase dashboard.

### 4. Run Development Servers

```bash
# Terminal 1: Backend
cd backend && bun dev

# Terminal 2: Frontend
cd frontend && bun dev
```

### 5. Run Integration Tests

```bash
cd backend && bun run test:flow
```

## 📊 User Flow

1. **Connect Wallet** - User connects with MetaMask/WalletConnect
2. **Get Vouched** - Receive vouches from trusted parties
3. **Borrow** - Take a loan against your vouched credit
4. **Auto-Repay** - Incoming transfers automatically garnished
5. **Build Credit** - Timely repayment increases your score

## 🔐 Smart Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| ENS BaseRegistrar | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` |
| BackrENSCollateral | *Deploy with `forge script`* |
| BackrENSReputation | *Deploy with `forge script`* |

## 🤝 Yellow Network Integration

Backr uses Yellow Network's Nitrolite SDK for instant off-chain payments:

- **State Channels**: Users open payment channels with the Backr platform
- **Instant Transfers**: Sub-second settlement between users
- **Auto-Garnishing**: Backr Agents intercept incoming transfers and split payments
- **On-Chain Settlement**: Final settlement to Base Sepolia

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Yellow Network](https://yellow.org) - Nitrolite SDK for payment channels
- [ENS](https://ens.domains) - Decentralized identity & reputation
- [ETHGlobal](https://ethglobal.com) - Hackathon support

---

Built with 💛 for ETHGlobal Hackmoney 2025

# Local Development Guide

This guide explains how to set up and run the local development environment, including running the Hardhat node, deploying contracts, and testing the applications.

## Prerequisites

Ensure you have the following installed:
- Node.js (v16 or higher)
- pnpm (v7 or higher)
- Hardhat

## Running the Hardhat Node

1. Navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Start the Hardhat node:
   ```bash
   npx hardhat node
   ```

   This will start a local Ethereum blockchain at `http://127.0.0.1:8545/` with pre-funded accounts. The accounts and their private keys will be displayed in the terminal.

## Deploying Contracts

1. Open a new terminal and navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Deploy the contracts to the local Hardhat network:
   ```bash
   npx hardhat run --network localhost deploy/1_deploy_learn_token.js
   npx hardhat run --network localhost deploy/2_deploy_badge_nft.js
   ```

   The deployed contract addresses will be saved to `apps/contracts/deployed-addresses.json`.

## Running the Backend

1. Navigate to the `apps/backend` directory:
   ```bash
   cd apps/backend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the backend server:
   ```bash
   pnpm dev
   ```

## Running the Frontend

1. Navigate to the `apps/frontend` directory:
   ```bash
   cd apps/frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the frontend application:
   ```bash
   pnpm dev
   ```

   The frontend will be available at `http://localhost:3000/`.

## Testing Contracts

1. Navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Run the tests:
   ```bash
   npx hardhat test
   ```

   This will execute all the contract tests and display the results in the terminal.

## Summary

- Start the Hardhat node: `npx hardhat node`
- Deploy contracts: `npx hardhat run --network localhost deploy/<script>.js`
- Run the backend: `pnpm dev` in `apps/backend`
- Run the frontend: `pnpm dev` in `apps/frontend`
- Test contracts: `npx hardhat test`